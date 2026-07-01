const express = require('express');
const pool    = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { upload, setUpload } = require('../middleware/upload');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

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
router.get('/records', auth, async (req, res) => {
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
    // Delete associated images first
    await conn.query('DELETE FROM oil_images WHERE record_id = ?', [recordId]);
    await conn.query('DELETE FROM oil_records WHERE id = ?', [recordId]);
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

    // Get all records ordered by normalized license_plate and date_recorded
    const [records] = await conn.query(
      `SELECT id, license_plate, mileage, total_price, is_trip 
       FROM oil_records 
       ORDER BY REPLACE(LOWER(license_plate), ' ', '') ASC, date_recorded ASC, id ASC`
    );

    let lastMileageByPlate = {};
    const batchValues = [];

    for (const record of records) {
      const plate = record.license_plate.replace(/\s+/g, '').toLowerCase();
      let distance = 0;

      if (record.is_trip) {
        distance = 0;
      } else {
        if (lastMileageByPlate[plate] !== undefined) {
          distance = record.mileage - lastMileageByPlate[plate];
          if (distance < 0) distance = 0;
        }
        lastMileageByPlate[plate] = record.mileage;
      }

      const bahtPerKm = distance > 0 ? (parseFloat(record.total_price) / distance).toFixed(2) : 0;
      batchValues.push([distance, parseFloat(bahtPerKm), record.id]);
    }

    // Batch update in chunks of 500 instead of one-by-one
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
      SELECT r.license_plate, 
             SUM(r.liters) as total_liters, 
             SUM(r.total_price) as total_cost,
             SUM(r.distance) as total_distance,
             MAX(u.team_id) as main_team_id
      FROM oil_records r
      LEFT JOIN users u ON u.id = r.tech_id
      ${whereClause}
      GROUP BY r.license_plate
      ORDER BY total_cost DESC
    `, params);

    const [rawDaily] = await pool.query(`
      SELECT DATE_FORMAT(date_recorded, '%Y-%m-%d') as date, r.license_plate, SUM(liters) as total_liters, SUM(total_price) as total_cost, SUM(distance) as total_distance
      FROM oil_records r
      LEFT JOIN users u ON u.id = r.tech_id
      ${whereClause}
      GROUP BY date, r.license_plate
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
      tech_id, license_plate, liters, mileage, total_price, date_recorded, existing_images
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
         SET tech_id = ?, license_plate = ?, liters = ?, mileage = ?, price_per_liter = ?, total_price = ?, date_recorded = ?
         WHERE id = ?`,
        [
          tech_id || old[0].tech_id, 
          license_plate || old[0].license_plate, 
          liters || old[0].liters, 
          mileage || old[0].mileage, 
          price_per_liter, 
          total_price || old[0].total_price, 
          (date_recorded ? date_recorded.replace('T', ' ') : null) || old[0].date_recorded,
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

module.exports = router;
