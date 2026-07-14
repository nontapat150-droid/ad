const express = require('express');
const pool    = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { upload, setUpload } = require('../middleware/upload');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

// ── Helper: Recalculate Oil Distance and Cost ──────────────────
async function recalculateOilData(conn, targetPlate = null) {
  let query = `SELECT id, license_plate, mileage, total_price, is_trip, date_recorded FROM oil_records`;
  const queryParams = [];
  
  if (targetPlate) {
    query += ` WHERE REPLACE(LOWER(license_plate), ' ', '') = ?`;
    queryParams.push(targetPlate.replace(/\s+/g, '').toLowerCase());
  }
  
  const [records] = await conn.query(query, queryParams);
  if (records.length === 0) return;

  // Sort in Node.js to ensure normalization matches exactly
  records.sort((a, b) => {
    const plateA = (a.license_plate || '').replace(/\s+/g, '').toLowerCase();
    const plateB = (b.license_plate || '').replace(/\s+/g, '').toLowerCase();
    if (plateA !== plateB) return plateA.localeCompare(plateB);
    
    let timeA = new Date(a.date_recorded || 0).getTime();
    let timeB = new Date(b.date_recorded || 0).getTime();
    if (isNaN(timeA)) timeA = 0;
    if (isNaN(timeB)) timeB = 0;
    if (timeA !== timeB) return timeA - timeB;
    
    return (a.id || 0) - (b.id || 0);
  });

  let lastMileageByPlate = {};
  const batchValues = [];

  for (const record of records) {
    const plate = record.license_plate ? record.license_plate.replace(/\s+/g, '').toLowerCase() : 'unknown';
    let distance = 0;
    
    const rawMileage = String(record.mileage || '').replace(/,/g, '');
    const currentMileage = parseFloat(rawMileage) || 0;

    if (lastMileageByPlate[plate] !== undefined) {
      distance = currentMileage - lastMileageByPlate[plate];
      if (isNaN(distance) || distance < 0) distance = 0;
    }
    lastMileageByPlate[plate] = currentMileage;

    const rawTotalPrice = String(record.total_price || '').replace(/,/g, '');
    const totalPrice = parseFloat(rawTotalPrice) || 0;
    const bahtPerKm = distance > 0 ? (totalPrice / distance).toFixed(2) : 0;
    batchValues.push([distance, parseFloat(bahtPerKm) || 0, record.id]);
    
    // Add debug logging
    if (plate.includes('3605')) {
      require('fs').appendFileSync('recalculate_debug.log', 
        `ID: ${record.id} | Date: ${record.date_recorded} | Mileage: ${currentMileage} | Last: ${lastMileageByPlate[plate]} | Dist: ${distance}\n`
      );
    }
  }

  const CHUNK_SIZE = 500;
  for (let i = 0; i < batchValues.length; i += CHUNK_SIZE) {
    const chunk = batchValues.slice(i, i + CHUNK_SIZE);
    const cases_dist = chunk.map(v => `WHEN ${v[2]} THEN ${v[0]}`).join(' ');
    const cases_bpk = chunk.map(v => `WHEN ${v[2]} THEN ${v[1]}`).join(' ');
    const ids = chunk.map(v => v[2]).join(',');
    await conn.query(
      `UPDATE oil_records SET 
         distance = CASE id ${cases_dist} END,
         baht_per_km = CASE id ${cases_bpk} END
       WHERE id IN (${ids})`
    );
  }
}

// ── Ensure indexes exist for performance ──────────────────────
(async () => {
  try {
    const conn = await pool.getConnection();
    await conn.query('CREATE INDEX IF NOT EXISTS idx_oil_date ON oil_records(date_recorded)').catch(() => {});
    await conn.query('CREATE INDEX IF NOT EXISTS idx_oil_tech ON oil_records(tech_id)').catch(() => {});
    await conn.query('CREATE INDEX IF NOT EXISTS idx_oil_plate ON oil_records(license_plate)').catch(() => {});
    await conn.query('CREATE INDEX IF NOT EXISTS idx_oil_img_record ON oil_images(record_id)').catch(() => {});
    conn.release();
  } catch (e) {
    // Indexes may already exist or lack permission — ignore
  }
})();

// ── GET /api/oil/records — My oil records (tech) or all (admin) ─
let lastRecalculateTime = 0;
let isRecalculating = false;

router.get('/records', auth, async (req, res) => {
  // Auto-recalculate if it hasn't been done in the last 1 minute
  if (!isRecalculating && Date.now() - lastRecalculateTime > 60000) {
    isRecalculating = true;
    try {
      const conn = await pool.getConnection();
      await recalculateOilData(conn);
      conn.release();
      lastRecalculateTime = Date.now();
    } catch (err) {
      console.error('Auto recalculate error:', err);
    } finally {
      isRecalculating = false;
    }
  }

  const userRoles = req.user.roles || [req.user.role];
  const isAdmin   = userRoles.some((r) => ADMIN_ROLES.includes(r));
  const { month, start_date, end_date, tech_id, team_ids, limit = 50 } = req.query;

  let where  = [];
  let params = [];

  if (!isAdmin) {
    where.push('r.tech_id = ?');
    params.push(req.user.id);
  } else if (tech_id) {
    where.push('r.tech_id = ?');
    params.push(tech_id);
  } else if (team_ids) {
    where.push('u.team_id IN (?)');
    params.push(team_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)));
  }

  if (start_date && end_date) {
    where.push("DATE(r.date_recorded) BETWEEN ? AND ?");
    params.push(start_date, end_date);
  } else if (month) {
    where.push("DATE_FORMAT(r.date_recorded, '%Y-%m') = ?");
    params.push(month);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [rows] = await pool.query(
      `SELECT r.*,
              u.full_name AS tech_name,
              u.role AS tech_role,
              u.team_id,
              t.team_name,
              (SELECT GROUP_CONCAT(i.image_path SEPARATOR ',')
               FROM oil_images i WHERE i.record_id = r.id) AS images
       FROM oil_records r
       LEFT JOIN users u ON u.id = r.tech_id
       LEFT JOIN teams t ON t.id = u.team_id
       ${whereClause}
       ORDER BY r.date_recorded DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );
    res.json(rows.map((r) => ({
      ...r,
      images: r.images ? r.images.split(',') : [],
    })));
  } catch (err) {
    console.error('Oil records error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── POST /api/oil/records — Add a fuel record ──────────────
router.post(
  '/records',
  auth,
  setUpload('oil_receipts'),
  upload.array('images', 5),
  async (req, res) => {
    const {
      tech_id, license_plate, liters, mileage, price_per_liter,
      total_price, distance, filler_name, date_recorded, is_trip
    } = req.body;

    if (!license_plate || !liters || !mileage || !price_per_liter) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const userRoles = req.user.roles || [req.user.role];
    const isAdmin = userRoles.some(r => ADMIN_ROLES.includes(r));
    const targetTechId = (isAdmin && tech_id) ? tech_id : req.user.id;

    const targetDate = date_recorded ? new Date(date_recorded) : new Date();

    const isTripMileage = is_trip === 'true' || is_trip === true;

    const bahtPerKm = distance && distance > 0 && !isTripMileage
      ? (parseFloat(total_price) / parseFloat(distance)).toFixed(2)
      : 0;

    const conn = await pool.getConnection();
    try {
      const cleanMileage = String(mileage).replace(/,/g, '').trim();

      // Get target user's team_id
      const [targetUser] = await conn.query('SELECT team_id FROM users WHERE id = ?', [targetTechId]);
      const targetTeamId = targetUser.length > 0 ? targetUser[0].team_id : null;

      // Check for duplicate record based on mileage and team, or anomaly (too close in time and mileage)
      const [existing] = await conn.query(
        `SELECT r.id 
         FROM oil_records r
         JOIN users u ON r.tech_id = u.id
         WHERE u.team_id <=> ?
           AND (
             r.mileage = ?
             OR 
             (
               ABS(r.mileage - ?) <= 50
               AND ABS(TIMESTAMPDIFF(MINUTE, r.date_recorded, ?)) <= 120
             )
           )`,
        [targetTeamId, cleanMileage, cleanMileage, targetDate]
      );

      if (existing.length > 0) {
        conn.release();
        return res.status(409).json({ error: 'ตรวจพบข้อมูลซ้ำซ้อนหรือผิดปกติ: ทีมของคุณมีการบันทึกน้ำมันในช่วงเวลา (ไม่เกิน 2 ชม.) และเลขไมล์ที่ใกล้เคียงกันมากเกินไปแล้ว!' });
      }

      await conn.beginTransaction();

      const [result] = await conn.query(
        `INSERT INTO oil_records
           (tech_id, license_plate, liters, mileage, price_per_liter, total_price,
            distance, baht_per_km, filler_name, date_recorded, is_trip)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          targetTechId, license_plate, liters, mileage, price_per_liter,
          total_price, isTripMileage ? 0 : (distance || 0), bahtPerKm, filler_name || null,
          (date_recorded ? date_recorded.replace('T', ' ') : null) || new Date(),
          isTripMileage ? 1 : 0
        ]
      );

      // Save receipt images
      if (req.files && req.files.length > 0) {
        const imgValues = req.files.map((f) => [result.insertId, f.filename]);
        await conn.query(
          `INSERT INTO oil_images (record_id, image_path) VALUES ?`, [imgValues]
        );
      }

      // Auto-recalculate for this specific vehicle
      await recalculateOilData(conn, license_plate);

      await conn.commit();
      res.status(201).json({ message: 'Oil record saved', id: result.insertId });
    } catch (err) {
      await conn.rollback();
      console.error('Add oil error:', err);
      res.status(500).json({ error: 'Server error: ' + err.message });
    } finally {
      conn.release();
    }
  }
);

// ── DELETE /api/oil/records/:id — Delete a fuel record ──────
router.delete('/records/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const recordId = req.params.id;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    
    // Get license plate before deleting so we can recalculate
    const [recordResult] = await conn.query('SELECT license_plate FROM oil_records WHERE id = ?', [recordId]);
    const targetPlate = recordResult.length > 0 ? recordResult[0].license_plate : null;

    // Delete associated images first
    await conn.query('DELETE FROM oil_images WHERE record_id = ?', [recordId]);
    await conn.query('DELETE FROM oil_records WHERE id = ?', [recordId]);
    
    if (targetPlate) {
      await recalculateOilData(conn, targetPlate);
    }
    
    await conn.commit();
    res.json({ message: 'Oil record deleted successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete oil record error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  } finally {
    conn.release();
  }
});

// ── POST /api/oil/recalculate ──────────────────────────────
router.post('/recalculate', auth, async (req, res) => {
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some(r => ['super_admin', 'admin'].includes(r));
  if (!isAdmin) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์ในการคำนวณใหม่' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await recalculateOilData(conn);
    await conn.commit();
    res.json({ message: 'คำนวณใหม่สำเร็จ' });
  } catch (err) {
    await conn.rollback();
    console.error('Recalculate error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการคำนวณใหม่' });
  } finally {
    conn.release();
  }
});

// ── GET /api/oil/debug-log ──────────────────────────────
router.get('/debug-log', (req, res) => {
  try {
    const fs = require('fs');
    if (fs.existsSync('recalculate_debug.log')) {
      const log = fs.readFileSync('recalculate_debug.log', 'utf8');
      res.type('text/plain').send(log);
    } else {
      res.send('No log file found.');
    }
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// ── GET /api/oil/efficiency — Liters/Job analytics ─────────
router.get('/efficiency', auth, async (req, res) => {
  const { month, start_date, end_date, team_id, team_ids } = req.query;
  let where  = [];
  let params = [];

  let jobsWhere = [];
  let jobsParams = [];

  if (start_date && end_date) {
    where.push("DATE(r.date_recorded) BETWEEN ? AND ?");
    params.push(start_date, end_date);
    jobsWhere.push("DATE(j.completed_at) BETWEEN ? AND ?");
    jobsParams.push(start_date, end_date);
  } else if (month) { 
    where.push("DATE_FORMAT(r.date_recorded, '%Y-%m') = ?"); 
    params.push(month);
    jobsWhere.push("DATE_FORMAT(j.completed_at, '%Y-%m') = ?");
    jobsParams.push(month);
  }

  if (team_ids) { 
    where.push("u.team_id IN (?)"); 
    params.push(team_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))); 
  } else if (team_id) { 
    where.push("u.team_id = ?");   
    params.push(team_id); 
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const jobsWhereClause = jobsWhere.length ? ' AND ' + jobsWhere.join(' AND ') : '';

  try {
    const [rows] = await pool.query(
      `SELECT
         t.id AS team_id, t.team_name,
         COALESCE(jc.case_count, 0) AS case_count,
         COALESCE(SUM(r.liters), 0)            AS total_liters,
         COALESCE(SUM(r.total_price), 0)        AS total_cost,
         CASE WHEN COALESCE(jc.case_count, 0) > 0
              THEN ROUND(COALESCE(SUM(r.liters), 0) / jc.case_count, 2)
              ELSE 0 END                     AS liters_per_job,
         CASE WHEN COALESCE(jc.case_count, 0) > 0
              THEN ROUND(COALESCE(SUM(r.total_price), 0) / jc.case_count, 2)
              ELSE 0 END                     AS cost_per_job
       FROM oil_records r
       JOIN users u ON u.id = r.tech_id
       JOIN teams t ON t.id = u.team_id
       LEFT JOIN (
           SELECT j.team_id, COUNT(*) as case_count
           FROM jobs j
           WHERE j.status = 'completed' AND j.team_id IS NOT NULL
           ${jobsWhereClause}
           GROUP BY j.team_id
       ) jc ON jc.team_id = t.id
       ${whereClause}
       GROUP BY t.id, t.team_name, jc.case_count
       ORDER BY t.team_name ASC`,
      [...jobsParams, ...params]
    );
    res.json(rows);
  } catch (err) {
    console.error('Efficiency error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── GET /api/oil/analytics — Dashboard Charts ──────────────
router.get('/analytics', auth, async (req, res) => {
  const { month, start_date, end_date, team_ids } = req.query; // e.g., '2026-06'
  let where = [];
  let params = [];

  // Team scope? If normal tech, maybe restrict to their own records or team records?
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin   = userRoles.some((r) => ADMIN_ROLES.includes(r));
  
  if (!isAdmin) {
    where.push('r.tech_id = ?');
    params.push(req.user.id);
  } else if (team_ids) {
    where.push("u.team_id IN (?)");
    params.push(team_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)));
  }

  if (start_date && end_date) {
    where.push("DATE(r.date_recorded) BETWEEN ? AND ?");
    params.push(start_date, end_date);
  } else if (month) {
    where.push("DATE_FORMAT(r.date_recorded, '%Y-%m') = ?");
    params.push(month);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    const [byVehicle] = await pool.query(`
      SELECT COALESCE(t.team_name, r.license_plate) as license_plate, 
             SUM(r.liters) as total_liters, 
             SUM(r.total_price) as total_cost,
             SUM(r.distance) as total_distance,
             MAX(u.team_id) as main_team_id
      FROM oil_records r
      LEFT JOIN users u ON u.id = r.tech_id
      LEFT JOIN teams t ON t.id = u.team_id
      ${whereClause}
      GROUP BY COALESCE(t.team_name, r.license_plate)
      ORDER BY total_cost DESC
    `, params);

    const [rawDaily] = await pool.query(`
      SELECT DATE_FORMAT(r.date_recorded, '%Y-%m-%d') as date, 
             COALESCE(MAX(t.team_name), r.license_plate) as license_plate, 
             SUM(r.liters) as total_liters, SUM(r.total_price) as total_cost, SUM(r.distance) as total_distance
      FROM oil_records r
      LEFT JOIN users u ON u.id = r.tech_id
      LEFT JOIN teams t ON t.id = u.team_id
      ${whereClause}
      GROUP BY date, COALESCE(t.team_name, r.license_plate)
      ORDER BY date ASC
    `, params);

    const dateMap = {};
    for (const row of rawDaily) {
      if (!dateMap[row.date]) {
        dateMap[row.date] = { date: row.date, total_liters: 0, total_cost: 0, total_distance: 0 };
      }
      dateMap[row.date].total_liters += parseFloat(row.total_liters) || 0;
      dateMap[row.date].total_cost += parseFloat(row.total_cost) || 0;
      dateMap[row.date].total_distance += parseFloat(row.total_distance) || 0;
      
      const plate = row.license_plate || 'ไม่ระบุ';
      dateMap[row.date][`${plate}_liters`] = parseFloat(row.total_liters) || 0;
      dateMap[row.date][`${plate}_cost`] = parseFloat(row.total_cost) || 0;
      dateMap[row.date][`${plate}_distance`] = parseFloat(row.total_distance) || 0;
    }
    const dailyTrend = Object.values(dateMap).sort((a,b) => a.date.localeCompare(b.date));

    const [summaryResult] = await pool.query(`
      SELECT 
        SUM(total_price) as total_cost,
        SUM(liters) as total_liters,
        COUNT(*) as total_bills,
        CASE WHEN SUM(liters) > 0 THEN SUM(total_price) / SUM(liters) ELSE 0 END as avg_price_per_liter
      FROM oil_records r
      LEFT JOIN users u ON u.id = r.tech_id
      ${whereClause}
    `, params);

    // Calculate average refuel frequency (days) - Disabled LAG() for MySQL 5.7 compatibility
    const freqResult = [{ avg_days: 0 }];

    res.json({ 
      byVehicle, 
      dailyTrend, 
      summary: {
        total_cost: summaryResult[0]?.total_cost || 0,
        total_liters: summaryResult[0]?.total_liters || 0,
        total_bills: summaryResult[0]?.total_bills || 0,
        avg_price_per_liter: summaryResult[0]?.avg_price_per_liter || 0,
        avg_refuel_days: freqResult[0]?.avg_days || 0
      }
    });
  } catch (err) {
    console.error('Oil analytics error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/oil/records/:id — Edit a fuel record ──────────────
router.put(
  '/records/:id',
  auth,
  setUpload('oil_receipts'),
  upload.array('images', 5),
  async (req, res) => {
    const recordId = req.params.id;
    const {
      tech_id, license_plate, liters, mileage, total_price, date_recorded, existing_images, is_trip
    } = req.body;

    const userRoles = req.user.roles || [req.user.role];
    const isAdmin = userRoles.some(r => ADMIN_ROLES.includes(r));
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // Get old record
      const [old] = await conn.query('SELECT * FROM oil_records WHERE id = ?', [recordId]);
      if (old.length === 0) {
        await conn.rollback();
        return res.status(404).json({ error: 'Record not found' });
      }

      // Update basic details.
      // Notice: we don't recalculate distance here because /oil/recalculate will do it for all.
      // We just update the values. price_per_liter can be recalculated.
      const price_per_liter = parseFloat(liters) > 0 ? (parseFloat(total_price) / parseFloat(liters)).toFixed(2) : 0;
      
      const newIsTrip = is_trip !== undefined ? (is_trip === 'true' || is_trip === true) : old[0].is_trip;
      const newMileage = mileage || old[0].mileage;
      const cleanNewMileage = String(newMileage).replace(/,/g, '').trim();
      const newTechId = tech_id || old[0].tech_id;

      // Get target user's team_id
      const [targetUser] = await conn.query('SELECT team_id FROM users WHERE id = ?', [newTechId]);
      const targetTeamId = targetUser.length > 0 ? targetUser[0].team_id : null;

      const targetDate = date_recorded ? new Date(date_recorded) : new Date(old[0].date_recorded);

      // Check for duplicate record based on mileage and team (excluding current record), or anomaly
      const [existing] = await conn.query(
        `SELECT r.id 
         FROM oil_records r
         JOIN users u ON r.tech_id = u.id
         WHERE r.id != ?
           AND u.team_id <=> ?
           AND (
             r.mileage = ?
             OR 
             (
               ABS(r.mileage - ?) <= 50
               AND ABS(TIMESTAMPDIFF(MINUTE, r.date_recorded, ?)) <= 120
             )
           )`,
        [recordId, targetTeamId, cleanNewMileage, cleanNewMileage, targetDate]
      );

      if (existing.length > 0) {
        await conn.rollback();
        conn.release();
        return res.status(409).json({ error: 'ตรวจพบข้อมูลซ้ำซ้อนหรือผิดปกติ: ทีมของคุณมีการบันทึกน้ำมันในช่วงเวลา (ไม่เกิน 2 ชม.) และเลขไมล์ที่ใกล้เคียงกันมากเกินไปแล้ว!' });
      }

      await conn.query(
        `UPDATE oil_records
         SET tech_id = ?, license_plate = ?, liters = ?, mileage = ?, price_per_liter = ?, total_price = ?, date_recorded = ?, is_trip = ?
         WHERE id = ?`,
        [
          tech_id || old[0].tech_id, 
          license_plate || old[0].license_plate, 
          liters || old[0].liters, 
          mileage || old[0].mileage, 
          price_per_liter, 
          total_price || old[0].total_price, 
          (date_recorded ? date_recorded.replace('T', ' ') : null) || old[0].date_recorded,
          newIsTrip,
          recordId
        ]
      );

      // Handle images
      let keptImages = [];
      if (existing_images) {
        try {
          keptImages = JSON.parse(existing_images);
        } catch(e) {}
      }

      // Delete removed images from db
      if (keptImages.length > 0) {
        await conn.query(`DELETE FROM oil_images WHERE record_id = ? AND image_path NOT IN (?)`, [recordId, keptImages]);
      } else {
        await conn.query(`DELETE FROM oil_images WHERE record_id = ?`, [recordId]);
      }

      // Insert new images
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await conn.query(
            `INSERT INTO oil_images (record_id, image_path) VALUES (?, ?)`,
            [recordId, file.filename]
          );
        }
      }

      await conn.commit();
      res.json({ message: 'Updated successfully' });
    } catch (err) {
      await conn.rollback();
      console.error('Update oil record error:', err);
      res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  }
);

// ── DELETE /api/oil/records/:id — Delete a fuel record ──────────────
router.delete('/records/:id', auth, async (req, res) => {
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some(r => ADMIN_ROLES.includes(r));
  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM oil_images WHERE record_id = ?`, [req.params.id]);
    await conn.query(`DELETE FROM oil_records WHERE id = ?`, [req.params.id]);

    await conn.commit();
    res.json({ message: 'Deleted successfully' });
  } catch (err) {
    await conn.rollback();
    console.error('Delete oil record error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── GET /api/oil/team-records — Oil records for the user's own team ──
router.get('/team-records', auth, async (req, res) => {
  const { month } = req.query; // e.g. '2026-06'

  try {
    // Get the user's own team_id
    const [userRows] = await pool.query('SELECT team_id FROM users WHERE id = ?', [req.user.id]);
    if (userRows.length === 0 || !userRows[0].team_id) {
      return res.json([]);
    }
    const targetTeamId = userRows[0].team_id;

    let where = ['u.team_id = ?'];
    let params = [targetTeamId];

    if (month) {
      where.push("r.date_recorded >= STR_TO_DATE(?, '%Y-%m-%d') AND r.date_recorded < DATE_ADD(STR_TO_DATE(?, '%Y-%m-%d'), INTERVAL 1 MONTH)");
      params.push(`${month}-01`, `${month}-01`);
    }

    const whereClause = 'WHERE ' + where.join(' AND ');

    const [rows] = await pool.query(
      `SELECT r.*,
              u.full_name AS tech_name,
              u.role AS tech_role,
              u.profile_image AS tech_profile_image,
              u.team_id,
              t.team_name,
              (SELECT GROUP_CONCAT(i.image_path SEPARATOR ',')
               FROM oil_images i WHERE i.record_id = r.id) AS images
       FROM oil_records r
       INNER JOIN users u ON u.id = r.tech_id
       LEFT JOIN teams t ON t.id = u.team_id
       ${whereClause}
       ORDER BY r.date_recorded DESC
       LIMIT 500`,
      params
    );

    res.json(rows.map((r) => ({
      ...r,
      images: r.images ? r.images.split(',') : [],
    })));
  } catch (err) {
    console.error('Team oil records error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// ── GET /api/oil/vehicle-summary — Per-vehicle summary with anomaly detection ──
router.get('/vehicle-summary', auth, async (req, res) => {
  const { start_date, end_date, team_ids } = req.query;
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some(r => ADMIN_ROLES.includes(r));

  let where = [];
  let params = [];

  if (!isAdmin) {
    where.push('r.tech_id = ?');
    params.push(req.user.id);
  } else if (team_ids) {
    where.push('u.team_id IN (?)');
    params.push(team_ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)));
  }

  if (start_date && end_date) {
    where.push("DATE(r.date_recorded) BETWEEN ? AND ?");
    params.push(start_date, end_date);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  try {
    // Per-vehicle aggregation
    const [vehicles] = await pool.query(`
      SELECT 
        r.license_plate,
        MAX(t.team_name) AS team_name,
        MAX(u.team_id) AS main_team_id,
        COUNT(*) AS refuel_count,
        COALESCE(SUM(r.total_price), 0) AS total_cost,
        COALESCE(SUM(r.liters), 0) AS total_liters,
        COALESCE(SUM(r.distance), 0) AS total_distance,
        COALESCE(AVG(r.price_per_liter), 0) AS avg_price_per_liter,
        MAX(r.mileage) AS latest_mileage,
        MIN(r.mileage) AS earliest_mileage,
        MIN(r.date_recorded) AS first_refuel,
        MAX(r.date_recorded) AS last_refuel
      FROM oil_records r
      LEFT JOIN users u ON u.id = r.tech_id
      LEFT JOIN teams t ON t.id = u.team_id
      ${whereClause}
      GROUP BY r.license_plate
      ORDER BY total_cost DESC
    `, params);

    // Calculate fleet-wide averages for anomaly detection
    const totalVehicles = vehicles.length;
    if (totalVehicles === 0) {
      return res.json({ vehicles: [], anomalies: [], fleetAvg: {} });
    }

    const fleetTotalCost = vehicles.reduce((s, v) => s + parseFloat(v.total_cost), 0);
    const fleetTotalLiters = vehicles.reduce((s, v) => s + parseFloat(v.total_liters), 0);
    const fleetTotalDistance = vehicles.reduce((s, v) => s + parseFloat(v.total_distance), 0);
    const fleetTotalRefuels = vehicles.reduce((s, v) => s + parseInt(v.refuel_count), 0);

    const fleetAvg = {
      avg_cost: fleetTotalCost / totalVehicles,
      avg_liters: fleetTotalLiters / totalVehicles,
      avg_distance: fleetTotalDistance / totalVehicles,
      avg_refuels: fleetTotalRefuels / totalVehicles,
      avg_km_per_liter: fleetTotalLiters > 0 ? (fleetTotalDistance / fleetTotalLiters) : 0,
      avg_cost_per_km: fleetTotalDistance > 0 ? (fleetTotalCost / fleetTotalDistance) : 0,
    };

    // Enriched vehicle data with computed metrics
    const enrichedVehicles = vehicles.map(v => {
      const cost = parseFloat(v.total_cost);
      const liters = parseFloat(v.total_liters);
      const distance = parseFloat(v.total_distance);
      const refuels = parseInt(v.refuel_count);

      return {
        ...v,
        total_cost: cost,
        total_liters: liters,
        total_distance: distance,
        refuel_count: refuels,
        km_per_liter: liters > 0 ? parseFloat((distance / liters).toFixed(2)) : 0,
        cost_per_km: distance > 0 ? parseFloat((cost / distance).toFixed(2)) : 0,
        avg_cost_per_refuel: refuels > 0 ? parseFloat((cost / refuels).toFixed(2)) : 0,
        avg_liters_per_refuel: refuels > 0 ? parseFloat((liters / refuels).toFixed(2)) : 0,
      };
    });

    // Sort helpers for finding best/worst performers
    const sortedByEfficiency = [...enrichedVehicles].filter(v => v.km_per_liter > 0).sort((a, b) => b.km_per_liter - a.km_per_liter);
    const sortedByCostPerKm = [...enrichedVehicles].filter(v => v.cost_per_km > 0).sort((a, b) => a.cost_per_km - b.cost_per_km);
    const sortedByCost = [...enrichedVehicles].sort((a, b) => a.total_cost - b.total_cost);
    const sortedByDistance = [...enrichedVehicles].sort((a, b) => b.total_distance - a.total_distance);

    // Anomaly detection: compare each vehicle against fleet average AND specific vehicles
    const anomalies = [];
    const THRESHOLD = 0.4; // 40% deviation from average is flagged

    for (const v of enrichedVehicles) {
      // ── Anomaly 1: High cost but low distance ──
      if (fleetAvg.avg_cost > 0 && fleetAvg.avg_distance > 0) {
        const costRatio = v.total_cost / fleetAvg.avg_cost;
        const distRatio = v.total_distance / fleetAvg.avg_distance;
        if (costRatio > (1 + THRESHOLD) && distRatio < (1 - THRESHOLD)) {
          // Find the best counterpart: vehicle that spent less but drove more
          const betterVehicles = enrichedVehicles
            .filter(o => o.license_plate !== v.license_plate && o.total_cost < v.total_cost && o.total_distance > v.total_distance)
            .sort((a, b) => (b.total_distance - a.total_distance));
          const best = betterVehicles[0] || null;

          const comparisons = [];
          if (best) {
            const costDiff = v.total_cost - best.total_cost;
            const distDiff = best.total_distance - v.total_distance;
            comparisons.push({
              compare_plate: best.license_plate,
              compare_cost: best.total_cost,
              compare_distance: best.total_distance,
              compare_liters: best.total_liters,
              compare_km_per_liter: best.km_per_liter,
              cost_diff: costDiff,
              distance_diff: distDiff,
              narrative: `${best.license_plate} จ่ายน้อยกว่า ฿${costDiff.toLocaleString()} แต่วิ่งได้มากกว่า ${distDiff.toLocaleString()} กม.`
            });
          }

          anomalies.push({
            license_plate: v.license_plate,
            type: 'high_cost_low_distance',
            severity: 'high',
            message: `${v.license_plate} จ่ายค่าน้ำมัน ฿${v.total_cost.toLocaleString()} (สูงกว่าค่าเฉลี่ย ${((costRatio - 1) * 100).toFixed(0)}%) แต่วิ่งได้แค่ ${v.total_distance.toLocaleString()} กม. (น้อยกว่าค่าเฉลี่ย ${((1 - distRatio) * 100).toFixed(0)}%)`,
            detail: `เติมน้ำมันไป ${v.total_liters.toFixed(1)} ลิตร จำนวน ${v.refuel_count} ครั้ง | ประสิทธิภาพ: ${v.km_per_liter} กม./ลิตร`,
            formula: `สูตร: ค่าเบี่ยงเบน = (ค่าใช้จ่ายรถ ÷ ค่าเฉลี่ยทุกคัน) × 100 → (${v.total_cost.toLocaleString()} ÷ ${fleetAvg.avg_cost.toFixed(0)}) = ${(costRatio * 100).toFixed(0)}% | ระยะทาง: (${v.total_distance.toLocaleString()} ÷ ${fleetAvg.avg_distance.toFixed(0)}) = ${(distRatio * 100).toFixed(0)}%`,
            data_source: `ข้อมูลจากตาราง oil_records ช่วง ${start_date || 'ทั้งหมด'} ถึง ${end_date || 'ปัจจุบัน'} | รถทั้งหมด ${totalVehicles} คัน`,
            comparisons,
            vehicle_data: { cost: v.total_cost, liters: v.total_liters, distance: v.total_distance, refuels: v.refuel_count, km_per_liter: v.km_per_liter, cost_per_km: v.cost_per_km },
            fleet_data: { avg_cost: parseFloat(fleetAvg.avg_cost.toFixed(2)), avg_distance: parseFloat(fleetAvg.avg_distance.toFixed(2)), avg_km_per_liter: parseFloat(fleetAvg.avg_km_per_liter.toFixed(2)) }
          });
        }
      }

      // ── Anomaly 2: Low km/liter efficiency ──
      if (fleetAvg.avg_km_per_liter > 0 && v.km_per_liter > 0) {
        const effRatio = v.km_per_liter / fleetAvg.avg_km_per_liter;
        if (effRatio < (1 - THRESHOLD)) {
          const bestEffVehicle = sortedByEfficiency.find(o => o.license_plate !== v.license_plate);
          const comparisons = [];
          if (bestEffVehicle) {
            const effDiff = bestEffVehicle.km_per_liter - v.km_per_liter;
            comparisons.push({
              compare_plate: bestEffVehicle.license_plate,
              compare_km_per_liter: bestEffVehicle.km_per_liter,
              compare_liters: bestEffVehicle.total_liters,
              compare_distance: bestEffVehicle.total_distance,
              eff_diff: effDiff,
              narrative: `${bestEffVehicle.license_plate} (คันที่ดีที่สุด) เติม ${bestEffVehicle.total_liters.toFixed(1)} ลิตร วิ่งได้ ${bestEffVehicle.total_distance.toLocaleString()} กม. (${bestEffVehicle.km_per_liter} กม./ลิตร) ดีกว่า ${v.license_plate} อยู่ ${effDiff.toFixed(2)} กม./ลิตร`
            });
          }

          anomalies.push({
            license_plate: v.license_plate,
            type: 'low_efficiency',
            severity: 'medium',
            message: `${v.license_plate} ได้ ${v.km_per_liter} กม./ลิตร ต่ำกว่าค่าเฉลี่ย ${fleetAvg.avg_km_per_liter.toFixed(2)} กม./ลิตร อยู่ ${((1 - effRatio) * 100).toFixed(0)}% — เติมไป ${v.total_liters.toFixed(1)} ลิตร แต่วิ่งได้แค่ ${v.total_distance.toLocaleString()} กม.`,
            detail: `ถ้าประสิทธิภาพเท่าค่าเฉลี่ย (${fleetAvg.avg_km_per_liter.toFixed(2)} กม./ลิตร) ควรวิ่งได้ ${(v.total_liters * fleetAvg.avg_km_per_liter).toFixed(0).toLocaleString()} กม. แต่วิ่งจริงแค่ ${v.total_distance.toLocaleString()} กม. → หายไป ${((v.total_liters * fleetAvg.avg_km_per_liter) - v.total_distance).toFixed(0).toLocaleString()} กม.`,
            formula: `สูตร: กม./ลิตร = ระยะทางรวม ÷ ลิตรรวม → ${v.total_distance.toLocaleString()} ÷ ${v.total_liters.toFixed(1)} = ${v.km_per_liter} กม./ลิตร | ค่าเฉลี่ยทุกคัน: ${fleetAvg.avg_km_per_liter.toFixed(2)} กม./ลิตร (${fleetTotalDistance.toLocaleString()} ÷ ${fleetTotalLiters.toFixed(1)})`,
            data_source: `ข้อมูลจากตาราง oil_records ช่วง ${start_date || 'ทั้งหมด'} ถึง ${end_date || 'ปัจจุบัน'} | รถทั้งหมด ${totalVehicles} คัน`,
            comparisons,
            vehicle_data: { cost: v.total_cost, liters: v.total_liters, distance: v.total_distance, refuels: v.refuel_count, km_per_liter: v.km_per_liter },
            fleet_data: { avg_km_per_liter: parseFloat(fleetAvg.avg_km_per_liter.toFixed(2)) }
          });
        }
      }

      // ── Anomaly 3: High cost per km ──
      if (fleetAvg.avg_cost_per_km > 0 && v.cost_per_km > 0) {
        const cpkRatio = v.cost_per_km / fleetAvg.avg_cost_per_km;
        if (cpkRatio > (1 + THRESHOLD)) {
          const bestCpkVehicle = sortedByCostPerKm.find(o => o.license_plate !== v.license_plate);
          const comparisons = [];
          if (bestCpkVehicle) {
            const cpkDiff = v.cost_per_km - bestCpkVehicle.cost_per_km;
            comparisons.push({
              compare_plate: bestCpkVehicle.license_plate,
              compare_cost_per_km: bestCpkVehicle.cost_per_km,
              cpk_diff: cpkDiff,
              narrative: `${bestCpkVehicle.license_plate} (คันที่ประหยัดสุด) ต้นทุน ฿${bestCpkVehicle.cost_per_km}/กม. ขณะที่ ${v.license_plate} อยู่ที่ ฿${v.cost_per_km}/กม. แพงกว่า ฿${cpkDiff.toFixed(2)}/กม.`
            });
          }

          anomalies.push({
            license_plate: v.license_plate,
            type: 'high_cost_per_km',
            severity: 'medium',
            message: `${v.license_plate} ต้นทุน ฿${v.cost_per_km}/กม. สูงกว่าค่าเฉลี่ย ฿${fleetAvg.avg_cost_per_km.toFixed(2)}/กม. อยู่ ${((cpkRatio - 1) * 100).toFixed(0)}%`,
            detail: `จ่าย ฿${v.total_cost.toLocaleString()} วิ่ง ${v.total_distance.toLocaleString()} กม. | ถ้าต้นทุนเท่าค่าเฉลี่ย ควรจ่ายแค่ ฿${(v.total_distance * fleetAvg.avg_cost_per_km).toFixed(0).toLocaleString()} → จ่ายเกินไป ฿${(v.total_cost - (v.total_distance * fleetAvg.avg_cost_per_km)).toFixed(0).toLocaleString()}`,
            formula: `สูตร: ต้นทุน/กม. = ค่าใช้จ่ายรวม ÷ ระยะทางรวม → ฿${v.total_cost.toLocaleString()} ÷ ${v.total_distance.toLocaleString()} = ฿${v.cost_per_km}/กม. | ค่าเฉลี่ยทุกคัน: ฿${fleetAvg.avg_cost_per_km.toFixed(2)}/กม. (฿${fleetTotalCost.toLocaleString()} ÷ ${fleetTotalDistance.toLocaleString()})`,
            data_source: `ข้อมูลจากตาราง oil_records ช่วง ${start_date || 'ทั้งหมด'} ถึง ${end_date || 'ปัจจุบัน'} | รถทั้งหมด ${totalVehicles} คัน`,
            comparisons,
            vehicle_data: { cost: v.total_cost, distance: v.total_distance, cost_per_km: v.cost_per_km },
            fleet_data: { avg_cost_per_km: parseFloat(fleetAvg.avg_cost_per_km.toFixed(2)) }
          });
        }
      }

      // ── Anomaly 4: High refuel frequency ──
      if (fleetAvg.avg_refuels > 0) {
        const refuelRatio = v.refuel_count / fleetAvg.avg_refuels;
        if (refuelRatio > (1 + THRESHOLD * 1.5)) {
          const leastRefuelVehicle = [...enrichedVehicles].filter(o => o.license_plate !== v.license_plate).sort((a, b) => a.refuel_count - b.refuel_count)[0];
          const comparisons = [];
          if (leastRefuelVehicle) {
            comparisons.push({
              compare_plate: leastRefuelVehicle.license_plate,
              compare_refuels: leastRefuelVehicle.refuel_count,
              compare_liters: leastRefuelVehicle.total_liters,
              narrative: `${leastRefuelVehicle.license_plate} เติมแค่ ${leastRefuelVehicle.refuel_count} ครั้ง (${leastRefuelVehicle.total_liters.toFixed(1)} ลิตร) ขณะที่ ${v.license_plate} เติม ${v.refuel_count} ครั้ง (${v.total_liters.toFixed(1)} ลิตร) มากกว่า ${v.refuel_count - leastRefuelVehicle.refuel_count} ครั้ง`
            });
          }

          anomalies.push({
            license_plate: v.license_plate,
            type: 'high_refuel_freq',
            severity: 'low',
            message: `${v.license_plate} เติมน้ำมัน ${v.refuel_count} ครั้ง มากกว่าค่าเฉลี่ย ${fleetAvg.avg_refuels.toFixed(1)} ครั้ง อยู่ ${((refuelRatio - 1) * 100).toFixed(0)}%`,
            detail: `เติมรวม ${v.total_liters.toFixed(1)} ลิตร เฉลี่ยครั้งละ ${v.avg_liters_per_refuel} ลิตร | ค่าใช้จ่ายรวม ฿${v.total_cost.toLocaleString()} เฉลี่ยครั้งละ ฿${v.avg_cost_per_refuel.toLocaleString()}`,
            formula: `สูตร: อัตราเบี่ยงเบน = (จำนวนเติมรถคันนี้ ÷ ค่าเฉลี่ยทุกคัน) × 100 → (${v.refuel_count} ÷ ${fleetAvg.avg_refuels.toFixed(1)}) = ${(refuelRatio * 100).toFixed(0)}% | เกณฑ์แจ้งเตือน: เกิน 160%`,
            data_source: `ข้อมูลจากตาราง oil_records ช่วง ${start_date || 'ทั้งหมด'} ถึง ${end_date || 'ปัจจุบัน'} | รถทั้งหมด ${totalVehicles} คัน`,
            comparisons,
            vehicle_data: { refuels: v.refuel_count, liters: v.total_liters, avg_liters_per_refuel: v.avg_liters_per_refuel },
            fleet_data: { avg_refuels: parseFloat(fleetAvg.avg_refuels.toFixed(1)) }
          });
        }
      }
    }

    // Add formula explanations to the response — ใช้ภาษาไทยที่เข้าใจง่ายสำหรับผู้ใช้ทั่วไป
    const formulas = [
      { label: 'กิโลเมตรต่อลิตร', explanation: `นำระยะทางที่วิ่งทั้งหมดมาหารด้วยจำนวนลิตรที่เติมไป เช่น วิ่ง ${fleetTotalDistance.toLocaleString()} กม. เติมไป ${fleetTotalLiters.toFixed(1)} ลิตร ได้ ${fleetAvg.avg_km_per_liter.toFixed(2)} กม./ลิตร` },
      { label: 'ต้นทุนต่อกิโลเมตร', explanation: `นำค่าใช้จ่ายน้ำมันทั้งหมดมาหารด้วยระยะทางที่วิ่ง เช่น จ่ายไป ฿${fleetTotalCost.toLocaleString()} วิ่ง ${fleetTotalDistance.toLocaleString()} กม. ได้ ฿${fleetAvg.avg_cost_per_km.toFixed(2)}/กม.` },
      { label: 'ค่าเฉลี่ยต่อครั้งเติม', explanation: 'นำค่าใช้จ่ายทั้งหมดของรถคันนั้นมาหารด้วยจำนวนครั้งที่เติมน้ำมัน' },
      { label: 'ค่าเฉลี่ยค่าใช้จ่ายต่อคัน', explanation: `นำค่าใช้จ่ายรวมทุกคัน (฿${fleetTotalCost.toLocaleString()}) มาหารด้วยจำนวนรถทั้งหมด (${totalVehicles} คัน) ได้ ฿${fleetAvg.avg_cost.toFixed(0)} ต่อคัน` },
      { label: 'ค่าเฉลี่ยระยะทางต่อคัน', explanation: `นำระยะทางรวมทุกคัน (${fleetTotalDistance.toLocaleString()} กม.) มาหารด้วยจำนวนรถ (${totalVehicles} คัน) ได้ ${fleetAvg.avg_distance.toFixed(0)} กม. ต่อคัน` },
      { label: 'เกณฑ์ตรวจจับผิดปกติ', explanation: 'เมื่อค่าของรถคันใดแตกต่างจากค่าเฉลี่ยรถทุกคันมากกว่า 40% ระบบจะแจ้งเตือนว่าผิดปกติ' },
    ];

    res.json({
      vehicles: enrichedVehicles,
      anomalies,
      formulas,
      fleetAvg: {
        avg_cost: parseFloat(fleetAvg.avg_cost.toFixed(2)),
        avg_liters: parseFloat(fleetAvg.avg_liters.toFixed(2)),
        avg_distance: parseFloat(fleetAvg.avg_distance.toFixed(2)),
        avg_refuels: parseFloat(fleetAvg.avg_refuels.toFixed(1)),
        avg_km_per_liter: parseFloat(fleetAvg.avg_km_per_liter.toFixed(2)),
        avg_cost_per_km: parseFloat(fleetAvg.avg_cost_per_km.toFixed(2)),
        total_vehicles: totalVehicles,
        total_cost: parseFloat(fleetTotalCost.toFixed(2)),
        total_liters: parseFloat(fleetTotalLiters.toFixed(2)),
        total_distance: parseFloat(fleetTotalDistance.toFixed(2)),
        total_refuels: fleetTotalRefuels,
        date_range: { start: start_date || null, end: end_date || null },
      }
    });
  } catch (err) {
    console.error('Vehicle summary error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
