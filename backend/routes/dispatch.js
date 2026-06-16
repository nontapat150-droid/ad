const express = require('express');
const pool    = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { upload, setUpload } = require('../middleware/upload');

const router = express.Router();

const ADMIN_ROLES = ['super_admin', 'admin'];

// ── GET /api/dispatch/jobs — List jobs (team-filtered for techs) ─
router.get('/jobs', auth, async (req, res) => {
  try {
    const { status, date, team_id, type } = req.query;
    const userRoles = req.user.roles || [req.user.role];
    const isAdmin   = userRoles.some((r) => ADMIN_ROLES.includes(r));

    let where   = [];
    let params  = [];
    let table = 'jobs';

    if (type === 'ma') {
      table = 'ma_jobs';
    }

    if (type === 'postponed') {
      where.push(`j.id IN (SELECT job_id FROM job_logs WHERE status='postponed')`);
    }

    // Non-admin: restrict to own team only
    if (!isAdmin) {
      if (!req.user.team_id) return res.json([]);
      where.push('j.team_id = ?');
      params.push(req.user.team_id);
    } else if (team_id) {
      where.push('j.team_id = ?');
      params.push(team_id);
    }

    if (status) { where.push('j.status = ?'); params.push(status); }
    
    // For postponed tab, we might want to ignore date filter or include it
    if (date && type !== 'postponed')   { where.push('j.plan_arrival_date = ?'); params.push(date); }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const [rows] = await pool.query(
      `SELECT j.*, j.id AS id, t.team_name,
              u.full_name AS completed_by_name
       FROM ${table} j
       LEFT JOIN teams t ON t.id = j.team_id
       LEFT JOIN users u ON u.id = j.completed_by
       ${whereClause}
       ORDER BY j.plan_arrival_date ASC, j.seq ASC, j.id ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Get jobs error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/dispatch/jobs/:id — Single job detail ─────────
router.get('/jobs/:id', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT j.*, t.team_name FROM jobs j
       LEFT JOIN teams t ON t.id = j.team_id
       WHERE j.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/:id/complete — Tech completes a job ─
router.put(
  '/jobs/:id/complete',
  auth,
  setUpload('job_evidence'),
  upload.array('images', 20),
  async (req, res) => {
    const jobId  = req.params.id;
    const techId = req.user.id;
    const conn   = await pool.getConnection();

    try {
      await conn.beginTransaction();

      // 1. Fetch job & verify access
      const [[job]] = await conn.query(
        `SELECT * FROM jobs WHERE id = ? LIMIT 1`, [jobId]
      );
      if (!job) { await conn.rollback(); return res.status(404).json({ error: 'Job not found' }); }

      const userRoles = req.user.roles || [req.user.role];
      const isAdmin   = userRoles.some((r) => ADMIN_ROLES.includes(r));
      if (!isAdmin && job.team_id !== req.user.team_id) {
        await conn.rollback();
        return res.status(403).json({ error: 'Job does not belong to your team' });
      }
      if (job.status === 'completed') {
        await conn.rollback();
        return res.status(409).json({ error: 'Job already completed' });
      }

      // 2. Update job status
      await conn.query(
        `UPDATE jobs SET status = 'completed', completed_at = NOW(), completed_by = ?
         WHERE id = ?`,
        [techId, jobId]
      );

      // 3. Log to job_logs
      await conn.query(
        `INSERT INTO job_logs (job_id, tech_id, status, remark) VALUES (?, ?, 'completed', ?)`,
        [jobId, techId, req.body.remark || null]
      );

      // 4. Insert images
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          await conn.query(
            `INSERT INTO job_completion_images (job_id, image_path, uploaded_by) VALUES (?, ?, ?)`,
            [jobId, `/uploads/job_evidence/${file.filename}`, techId]
          );
        }
      }

      // 5. syncTeamOilMonth — increment case_count
      if (job.team_id) {
        const yearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        await conn.query(
          `INSERT INTO team_oil_cases (team_id, year_month, case_count)
           VALUES (?, ?, 1)
           ON DUPLICATE KEY UPDATE case_count = case_count + 1`,
          [job.team_id, yearMonth]
        );
      }

      await conn.commit();

      res.json({ message: 'Job completed successfully', job_id: jobId });
    } catch (err) {
      await conn.rollback();
      console.error('Complete job error:', err);
      res.status(500).json({ error: 'Server error' });
    } finally {
      conn.release();
    }
  }
);

// ── POST /api/dispatch/jobs — Admin creates/imports job ────
router.post('/jobs', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const {
    plan_arrival_date, plan_arrival_time, access_no, customer, phone, package: pkg, address,
    field_engineer_id, reject_reason, task_status, product, lat, lng, order_no,
    called_assigner, called_engineer, task_order, product_owner, order_type,
    install_device, service_note, sub_access_mode, region, task_type,
    customer_order_no, contract_team, team_product_owner, province, task_duration,
    sla_status, create_time, deadline, set_off_time, arrival_time, finish_time,
    area_code, area_name, processing_status, create_user_role, fail_reason,
    event, service_level, type_of_installation, reason_sync_system_failed,
    status, remark, seq, map_link, team_id
  } = req.body;

  if (!access_no) return res.status(400).json({ error: 'access_no is required' });

  try {
    const [result] = await pool.query(
      `INSERT INTO jobs
         (plan_arrival_date, plan_arrival_time, access_no, customer, phone, package, address,
          field_engineer_id, reject_reason, task_status, product, lat, lng, order_no,
          called_assigner, called_engineer, task_order, product_owner, order_type,
          install_device, service_note, sub_access_mode, region, task_type,
          customer_order_no, contract_team, team_product_owner, province, task_duration,
          sla_status, create_time, deadline, set_off_time, arrival_time, finish_time,
          area_code, area_name, processing_status, create_user_role, fail_reason,
          event, service_level, type_of_installation, reason_sync_system_failed,
          status, remark, seq, map_link, team_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        plan_arrival_date || null, plan_arrival_time || null, access_no, customer || null, phone || null, pkg || null, address || null,
        field_engineer_id || null, reject_reason || null, task_status || null, product || null, lat || null, lng || null, order_no || null,
        called_assigner || 'None Call', called_engineer || 'None Call', task_order || null, product_owner || null, order_type || null,
        install_device || null, service_note || null, sub_access_mode || 'N/A', region || 'ROS', task_type || null,
        customer_order_no || null, contract_team || 'หจก.โบนัส แอดว้านซ์ (สุราษฎร์ธานี)#Bonus Advance (Surat Thani) - AISPM_Install_Bonus Advance_Bonus Advance (Surat Thani)_1002136_FTH,PLB', team_product_owner || null, province || null, task_duration || null,
        sla_status || 'Normal', create_time || null, deadline || null, set_off_time || null, arrival_time || null, finish_time || null,
        area_code || null, area_name || null, processing_status || null, create_user_role || req.user.role || null, fail_reason || null,
        event || null, service_level || null, type_of_installation || null, reason_sync_system_failed || null,
        status || 'pending', remark || null, seq || null, map_link || null, team_id || null
      ]
    );
    res.status(201).json({ message: 'Job created', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Access No. หรือ Customer Order No. ซ้ำซ้อน' });
    }
    console.error('Job Creation Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/dispatch/jobs/bulk — Admin imports multiple jobs from Excel ────
router.post('/jobs/bulk', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const jobs = req.body.jobs;
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return res.status(400).json({ error: 'No jobs data provided' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let successCount = 0;
    let skippedCount = 0;

    for (const job of jobs) {
      const {
        access_no, customer, phone, package: pkg, address, lat, lng,
        plan_arrival_date, product, remark
      } = job;

      if (!access_no) {
        skippedCount++;
        continue; // Skip if no access_no
      }

      try {
        const [result] = await conn.query(
          `INSERT IGNORE INTO jobs
             (access_no, customer, phone, package, address, lat, lng,
              plan_arrival_date, product, remark,
              status, create_user_role)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
          [
            access_no, customer || null, phone || null, pkg || null, address || null,
            lat || null, lng || null, plan_arrival_date || null, product || null,
            remark || null, req.user.role || null
          ]
        );
        if (result.affectedRows > 0) {
          successCount++;
        } else {
          skippedCount++;
        }
      } catch (err) {
        console.error('Bulk insert error for access_no:', access_no, err);
        skippedCount++;
      }
    }
    
    await conn.commit();
    res.json({ message: 'Bulk import complete', successCount, skippedCount, total: jobs.length });
  } catch (err) {
    await conn.rollback();
    console.error('Bulk Import Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});


// ── PUT /api/dispatch/jobs/bulk-assign — Assign team to multiple jobs ──────
// IMPORTANT: This route MUST be defined BEFORE /jobs/:id routes to avoid Express treating 'bulk-assign' as an :id
router.put('/jobs/bulk-assign', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { ids, team_id, type } = req.body;
  
  console.log('[bulk-assign] received ids:', ids, 'team_id:', team_id, 'type:', type);
  
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No jobs selected' });
  }
  if (!team_id) {
    return res.status(400).json({ error: 'No team selected' });
  }
  
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  
  try {
    // ids is an array of numeric database IDs
    const placeholders = ids.map(() => '?').join(',');
    const [result] = await pool.query(`UPDATE ${table} SET team_id = ? WHERE id IN (${placeholders})`, [team_id, ...ids]);
    console.log('[bulk-assign] updated rows:', result.affectedRows);
    res.json({ message: 'Teams assigned successfully', updatedCount: result.affectedRows });
  } catch (err) {
    console.error('Bulk Assign Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/reorder-by-location — Reorder job seq from current location ──
// IMPORTANT: Must be defined BEFORE /jobs/:id routes
router.put('/jobs/reorder-by-location', auth, async (req, res) => {
  const { lat, lng, type, team_id } = req.body;
  if (!lat || !lng) return res.status(400).json({ error: 'lat and lng are required' });

  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  const userRoles = req.user.roles || [req.user.role];
  const isAdmin = userRoles.some(r => ADMIN_ROLES.includes(r));

  try {
    // Fetch jobs that have coordinates and are not yet completed/failed
    let where = `WHERE lat IS NOT NULL AND lng IS NOT NULL AND status NOT IN ('completed','failed')`;
    let params = [];

    if (!isAdmin) {
      if (!req.user.team_id) return res.json({ message: 'No team assigned', updated: 0 });
      where += ` AND team_id = ?`;
      params.push(req.user.team_id);
    } else if (team_id) {
      where += ` AND team_id = ?`;
      params.push(team_id);
    }

    const [jobs] = await pool.query(`SELECT id, lat, lng FROM ${table} ${where}`, params);

    if (jobs.length === 0) return res.json({ message: 'No jobs with coordinates', updated: 0 });

    // Sort by nearest-first using Haversine distance from current location
    const sorted = jobs
      .map(job => ({
        id: job.id,
        distance: getDistance(parseFloat(lat), parseFloat(lng), parseFloat(job.lat), parseFloat(job.lng))
      }))
      .sort((a, b) => a.distance - b.distance);

    // Update seq for each job
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < sorted.length; i++) {
        await conn.query(`UPDATE ${table} SET seq = ? WHERE id = ?`, [i + 1, sorted[i].id]);
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    res.json({ message: 'Jobs reordered successfully', updated: sorted.length, order: sorted.map(j => j.id) });
  } catch (err) {
    console.error('Reorder by location error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/:id/assign — Reassign team ──────
router.put('/jobs/:id/assign', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { team_id } = req.body;
  try {
    await pool.query(`UPDATE jobs SET team_id = ? WHERE id = ?`, [team_id, req.params.id]);
    res.json({ message: 'Team assigned' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Function to calculate distance between two lat/lng coordinates (Haversine formula)
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c; // Distance in km
}

// ── GET /api/dispatch/summary — Summary for Auto Dispatch ──
router.get('/summary', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [[{ unassignedJobsCount }]] = await pool.query(
      `SELECT COUNT(*) AS unassignedJobsCount FROM jobs WHERE status = 'pending' AND team_id IS NULL`
    );
    const [teamsList] = await pool.query(
      `SELECT id, team_name FROM teams ORDER BY id ASC`
    );
    res.json({ unassignedJobsCount, teams: teamsList, totalTeams: teamsList.length });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/dispatch/auto-assign — Auto Dispatch Logic ──
router.post('/auto-assign', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { teamQuotas } = req.body; // Array of { team_id, count }
  
  if (!teamQuotas || !Array.isArray(teamQuotas)) {
    return res.status(400).json({ error: 'Invalid teamQuotas array' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Fetch unassigned pending jobs with coordinates
    const [jobs] = await conn.query(
      `SELECT id, lat, lng FROM jobs WHERE status = 'pending' AND team_id IS NULL AND lat IS NOT NULL AND lng IS NOT NULL AND lat != '' AND lng != '' ORDER BY created_at ASC`
    );

    if (!jobs.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'ไม่พบงานที่มีพิกัด (ละติจูด/ลองจิจูด) หรือพิกัดไม่ถูกต้อง ทำให้ไม่สามารถคำนวณระยะทางได้' });
    }

    let unassignedJobs = [...jobs]; // Clone array for processing
    let totalAssigned = 0;

    // 2. Distribute jobs to teams based on proximity and TSP routing
    for (const quota of teamQuotas) {
      const { team_id, count } = quota;
      if (count <= 0) continue;

      let assignedToTeam = [];

      for (let i = 0; i < count; i++) {
        if (unassignedJobs.length === 0) break;

        if (assignedToTeam.length === 0) {
          // Pick the oldest unassigned job as the starting point for this team
          assignedToTeam.push(unassignedJobs[0]);
          unassignedJobs.splice(0, 1);
        } else {
          // Find the closest job to the LAST assigned job (Nearest Neighbor)
          const lastAssigned = assignedToTeam[assignedToTeam.length - 1];
          let closestIndex = 0;
          let minDistance = Infinity;

          for (let j = 0; j < unassignedJobs.length; j++) {
            const candidate = unassignedJobs[j];
            const dist = getDistance(parseFloat(lastAssigned.lat), parseFloat(lastAssigned.lng), parseFloat(candidate.lat), parseFloat(candidate.lng));
            if (dist < minDistance) {
              minDistance = dist;
              closestIndex = j;
            }
          }

          // Add closest job to team and remove from unassigned pool
          assignedToTeam.push(unassignedJobs[closestIndex]);
          unassignedJobs.splice(closestIndex, 1);
        }
      }

      // 3. Update database with team_id and routing sequence
      for (let seq = 0; seq < assignedToTeam.length; seq++) {
        const jobId = assignedToTeam[seq].id;
        // Notice seq+1 to start sequences at 1
        await conn.query(`UPDATE jobs SET team_id = ?, seq = ? WHERE id = ?`, [team_id, (seq + 1).toString(), jobId]);
        totalAssigned++;
      }
    }

    await conn.commit();
    res.json({ message: 'Auto dispatch successful', assignedCount: totalAssigned, remainingJobs: unassignedJobs.length });
  } catch (err) {
    await conn.rollback();
    console.error('Auto Assign Error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── GET /api/dispatch/search-access/:accessNo — Search Customer/Job by Access No ──
router.get('/search-access/:accessNo', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT jobs.*, teams.team_name, users.full_name as engineer_name 
       FROM jobs 
       LEFT JOIN teams ON jobs.team_id = teams.id 
       LEFT JOIN users ON jobs.field_engineer_id = users.id 
       WHERE jobs.access_no = ?`,
      [req.params.accessNo]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลจาก Access Number นี้' });
    }

    res.json(rows[0]); // Since access_no is unique, return the single object
  } catch (err) {
    console.error('Search Access Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/dispatch/entry-fee — Upload Entry Fee Image ──
router.post('/entry-fee', auth, upload.single('image'), async (req, res) => {
  try {
    const { access_no, customer_name } = req.body;
    if (!access_no) return res.status(400).json({ error: 'Missing access_no' });
    if (!customer_name) return res.status(400).json({ error: 'Missing customer_name' });
    if (!req.file) return res.status(400).json({ error: 'Missing image file' });

    const imagePath = '/uploads/' + req.file.filename;
    
    await pool.query(
      'INSERT INTO entry_fees (access_no, customer_name, image_path, created_by) VALUES (?, ?, ?, ?)',
      [access_no, customer_name, imagePath, req.user.id]
    );

    return res.json({ message: 'Entry fee saved successfully', imagePath });
  } catch (err) {
    console.error('Entry Fee Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/dispatch/entry-fee/history — Get Entry Fee History by Month ──
router.get('/entry-fee/history', auth, async (req, res) => {
  try {
    const { month } = req.query; // format: 'YYYY-MM'
    
    let query = `
      SELECT ef.*, u.full_name as creator_name
      FROM entry_fees ef
      LEFT JOIN users u ON ef.created_by = u.id
    `;
    const params = [];
    
    if (month) {
      query += ` WHERE DATE_FORMAT(ef.created_at, '%Y-%m') = ?`;
      params.push(month);
    }
    
    query += ` ORDER BY ef.created_at DESC`;
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Entry Fee History Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/:id/incomplete — Tech marks a job as incomplete ─
router.put('/jobs/:id/incomplete', auth, async (req, res) => {
  const jobId = req.params.id;
  const techId = req.user.id;
  const { remark } = req.body;
  if (!remark) return res.status(400).json({ error: 'Remark is required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
    if (!job) { await conn.rollback(); return res.status(404).json({ error: 'Job not found' }); }
    await conn.query('UPDATE jobs SET status = \'failed\', fail_reason = ? WHERE id = ?', [remark, jobId]);
    await conn.query('INSERT INTO job_logs (job_id, tech_id, status, remark) VALUES (?, ?, \'failed\', ?)', [jobId, techId, remark]);
    await conn.commit();
    res.json({ message: 'Job marked as incomplete' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/jobs/:id/postpone — Tech postpones a job ─
router.put('/jobs/:id/postpone', auth, async (req, res) => {
  const jobId = req.params.id;
  const techId = req.user.id;
  const { new_date, remark } = req.body;
  if (!new_date) return res.status(400).json({ error: 'New date is required' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[job]] = await conn.query('SELECT * FROM jobs WHERE id = ? LIMIT 1', [jobId]);
    if (!job) { await conn.rollback(); return res.status(404).json({ error: 'Job not found' }); }
    await conn.query('UPDATE jobs SET status = \'pending\', plan_arrival_date = ?, team_id = NULL, seq = NULL WHERE id = ?', [new_date, jobId]);
    await conn.query('INSERT INTO job_logs (job_id, tech_id, status, remark) VALUES (?, ?, \'postponed\', ?)', [jobId, techId, `Postponed to ${new_date}. Reason: ${remark || ''}`]);
    await conn.commit();
    res.json({ message: 'Job postponed' });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ── PUT /api/dispatch/jobs/clear-dispatch — Clear team assignments ─
router.put('/jobs/clear-dispatch', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { date } = req.body;
    let query = 'UPDATE jobs SET team_id = NULL WHERE status = \'pending\'';
    let params = [];
    if (date) {
      query += ' AND plan_arrival_date = ?';
      params.push(date);
    }
    await pool.query(query, params);
    res.json({ message: 'Cleared all pending dispatches' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/dispatch/jobs/clear-queue — Clear seq ─
router.put('/jobs/clear-queue', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const { date } = req.body;
    let query = 'UPDATE jobs SET seq = NULL WHERE status = \'pending\'';
    let params = [];
    if (date) {
      query += ' AND plan_arrival_date = ?';
      params.push(date);
    }
    await pool.query(query, params);
    res.json({ message: 'Cleared queue order' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});


// ── PUT /api/dispatch/jobs/:id — Update job details ─
router.put('/jobs/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { customer, phone, address, team_id, field_engineer_id, lat, lng, type } = req.body;
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  try {
    await pool.query(
      `UPDATE ${table} SET customer = COALESCE(?, customer), phone = COALESCE(?, phone), address = COALESCE(?, address), lat = ?, lng = ?, team_id = ?, field_engineer_id = ? WHERE id = ?`,
      [customer, phone, address, lat || null, lng || null, team_id || null, field_engineer_id || null, req.params.id]
    );
    res.json({ message: 'Job updated' });
  } catch (err) {
    console.error('Job update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/dispatch/jobs/bulk — Admin deletes multiple jobs ─
router.delete('/jobs/bulk', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { ids, type } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No job IDs provided' });
  }
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  try {
    const placeholders = ids.map(() => '?').join(',');
    await pool.query(`DELETE FROM ${table} WHERE id IN (${placeholders})`, ids);
    res.json({ message: 'Jobs deleted successfully' });
  } catch (err) {
    console.error('Bulk delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/dispatch/jobs/all — Admin deletes all pending jobs ─
router.delete('/jobs/all', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { date, type } = req.query;
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  try {
    let query = `DELETE FROM ${table} WHERE status = 'pending'`;
    let params = [];
    if (date) {
      query += ' AND plan_arrival_date = ?';
      params.push(date);
    }
    const [result] = await pool.query(query, params);
    res.json({ message: 'All pending jobs deleted', deletedCount: result.affectedRows });
  } catch (err) {
    console.error('Delete all error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/dispatch/jobs/:id — Admin deletes a single job ─
router.delete('/jobs/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { type } = req.query;
  const table = type === 'ma' ? 'ma_jobs' : 'jobs';
  try {
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Job deleted' });
  } catch (err) {
    console.error('Single delete error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
