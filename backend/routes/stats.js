const express = require('express');
const pool    = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

// ── GET /api/stats/dashboard — Admin overview numbers ──────
router.get('/dashboard', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const [[jobStats]] = await pool.query(
      `SELECT
         COUNT(*) AS total,
         SUM(status = 'completed') AS completed,
         SUM(status = 'pending')   AS pending,
         SUM(status = 'failed')    AS failed
       FROM jobs WHERE plan_arrival_date = ?`,
      [today]
    );

    const [[checkinStats]] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(is_late = 1) AS late
       FROM checkins WHERE DATE(checkin_time) = ?`,
      [today]
    );

    const [[oilStats]] = await pool.query(
      `SELECT COALESCE(SUM(liters), 0) AS total_liters,
              COALESCE(SUM(total_price), 0) AS total_cost
       FROM oil_records WHERE DATE_FORMAT(date_recorded, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`
    );

    res.json({ jobs: jobStats, checkins: checkinStats, oil: oilStats });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/stats/admin-dashboard — Admin Homepage ──────
router.get('/admin-dashboard', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    let inventoryCnt = 0, officeAssignedCnt = 0, officeUnassignedCnt = 0, maAssignedCnt = 0, maUnassignedCnt = 0;

    try {
      const [[inv]] = await pool.query(`SELECT SUM(quantity) as cnt FROM inventory_items`);
      inventoryCnt = inv.cnt || 0;
    } catch(e) {}

    try {
      const [[oa]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE DATE(create_time) = CURDATE() AND team_id IS NOT NULL`);
      officeAssignedCnt = oa.cnt || 0;
    } catch(e) {}

    try {
      const [[ou]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE DATE(create_time) = CURDATE() AND team_id IS NULL`);
      officeUnassignedCnt = ou.cnt || 0;
    } catch(e) {}

    try {
      const [[maA]] = await pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs WHERE plan_arrival_date = CURDATE() AND team_id IS NOT NULL`);
      maAssignedCnt = maA.cnt || 0;
    } catch(e) {}

    try {
      const [[maU]] = await pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs WHERE plan_arrival_date = CURDATE() AND team_id IS NULL`);
      maUnassignedCnt = maU.cnt || 0;
    } catch(e) {}

    const unassignedTotal = officeUnassignedCnt + maUnassignedCnt;

    const [announcements] = await pool.query(
      `SELECT * FROM announcements 
       WHERE (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 5`
    );

    let feed = [];
    
    // 1. Oil Records
    try {
      const [oilFeed] = await pool.query(`
        SELECT o.id, 'oil' AS type, o.date_recorded AS created_at, 'บันทึกบิลลงน้ำมัน' AS action, u.full_name as user_name
        FROM oil_records o
        LEFT JOIN users u ON u.id = o.tech_id
        ORDER BY o.date_recorded DESC LIMIT 10
      `);
      feed = feed.concat(oilFeed);
    } catch(e) {}

    // 2. Checkins
    try {
      const [checkinFeed] = await pool.query(`
        SELECT c.id, 'checkin' AS type, c.checkin_time AS created_at, 'เช็คอินเข้างาน' AS action, u.full_name as user_name
        FROM checkins c
        LEFT JOIN users u ON u.id = c.user_id
        ORDER BY c.checkin_time DESC LIMIT 10
      `);
      feed = feed.concat(checkinFeed);
    } catch(e) {}

    // 3. Job Logs
    try {
      const [jobFeed] = await pool.query(`
        SELECT j.id, 'job' AS type, j.created_at, 'ปิดงานเสร็จสิ้น' AS action, u.full_name as user_name
        FROM job_logs j
        LEFT JOIN users u ON u.id = j.tech_id
        WHERE j.status = 'completed'
        ORDER BY j.created_at DESC LIMIT 10
      `);
      feed = feed.concat(jobFeed);
    } catch(e) {}

    // Sort combined feed by created_at DESC and limit to 20
    feed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    feed = feed.slice(0, 20);

    res.json({
      summary: {
        totalInventory: inventoryCnt,
        officeAssignedToday: officeAssignedCnt,
        maAssignedToday: maAssignedCnt,
        unassignedToday: unassignedTotal
      },
      announcements,
      feed
    });
  } catch (err) {
    console.error('Admin Dashboard Stats Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/stats/super-admin-dashboard — Super Admin Homepage ──────
router.get('/super-admin-dashboard', auth, requireRole(['super_admin']), async (req, res) => {
  try {
    let usersCnt = 0, onlineCnt = 0, inventoryCnt = 0, nonCnt = 0, oilCnt = 0, entryCnt = 0;
    
    try { const [[r]] = await pool.query(`SELECT COUNT(*) as cnt FROM users`); usersCnt = r.cnt || 0; } catch(e) { console.error('Error users:', e); }
    try { const [[r]] = await pool.query(`SELECT COUNT(DISTINCT user_id) as cnt FROM checkins WHERE DATE(checkin_time) = CURDATE() AND checkout_time IS NULL`); onlineCnt = r.cnt || 0; } catch(e) { console.error('Error checkins:', e); }
    try { const [[r]] = await pool.query(`SELECT SUM(quantity) as cnt FROM inventory_items`); inventoryCnt = r.cnt || 0; } catch(e) { console.error('Error inventory:', e); }
    try { const [[r]] = await pool.query(`SELECT COUNT(DISTINCT access_no) as cnt FROM jobs WHERE access_no LIKE 'NON%'`); nonCnt = r.cnt || 0; } catch(e) { console.error('Error jobs:', e); }
    try { const [[r]] = await pool.query(`SELECT COUNT(*) as cnt FROM oil_records WHERE MONTH(date_recorded) = MONTH(CURDATE()) AND YEAR(date_recorded) = YEAR(CURDATE())`); oilCnt = r.cnt || 0; } catch(e) { console.error('Error oil:', e); }
    try { const [[r]] = await pool.query(`SELECT COUNT(*) as cnt FROM entry_fees WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`); entryCnt = r.cnt || 0; } catch(e) { console.error('Error entry_fees:', e); }

    let feed = [];
    
    // 1. Oil Records
    try {
      const [oilFeed] = await pool.query(`
        SELECT o.id, 'oil' AS type, o.date_recorded AS created_at, 'บันทึกบิลลงน้ำมัน' AS action, u.full_name as user_name
        FROM oil_records o
        LEFT JOIN users u ON u.id = o.tech_id
        ORDER BY o.date_recorded DESC LIMIT 10
      `);
      feed = feed.concat(oilFeed);
    } catch(e) { console.error('Feed error oil_records:', e); }

    // 2. Entry Fees
    try {
      const [entryFeed] = await pool.query(`
        SELECT e.id, 'entry_fee' AS type, e.created_at, 'บันทึกค่าแรกเข้า' AS action, u.full_name as user_name
        FROM entry_fees e
        LEFT JOIN users u ON u.id = e.created_by
        ORDER BY e.created_at DESC LIMIT 10
      `);
      feed = feed.concat(entryFeed);
    } catch(e) { console.error('Feed error entry_fees:', e); }

    // 3. Checkins
    try {
      const [checkinFeed] = await pool.query(`
        SELECT c.id, 'checkin' AS type, c.checkin_time AS created_at, 'เช็คอินเข้างาน' AS action, u.full_name as user_name
        FROM checkins c
        LEFT JOIN users u ON u.id = c.user_id
        ORDER BY c.checkin_time DESC LIMIT 10
      `);
      feed = feed.concat(checkinFeed);
    } catch(e) { console.error('Feed error checkins:', e); }

    // 4. Job Logs
    try {
      const [jobFeed] = await pool.query(`
        SELECT j.id, 'job' AS type, j.created_at, 'ปิดงานเสร็จสิ้น' AS action, u.full_name as user_name
        FROM job_logs j
        LEFT JOIN users u ON u.id = j.tech_id
        WHERE j.status = 'completed'
        ORDER BY j.created_at DESC LIMIT 10
      `);
      feed = feed.concat(jobFeed);
    } catch(e) { console.error('Feed error job_logs:', e); }

    // Sort combined feed by created_at DESC and limit to 20
    feed.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    feed = feed.slice(0, 20);

    let mechanicTeams = [];
    try {
      const [usersData] = await pool.query(`
        SELECT 
          u.id, u.full_name, u.role, u.profile_image, t.team_name,
          CASE WHEN c.id IS NOT NULL THEN 1 ELSE 0 END AS is_online
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN checkins c ON c.user_id = u.id AND DATE(c.checkin_time) = CURDATE() AND c.checkout_time IS NULL
        WHERE u.role NOT IN ('super_admin', 'admin')
      `);
      
      const teamMap = {};
      usersData.forEach(u => {
        const tName = u.team_name || 'ไม่มีทีม';
        if (!teamMap[tName]) teamMap[tName] = { team_name: tName, total: 0, online: 0, members: [] };
        teamMap[tName].total += 1;
        if (u.is_online) teamMap[tName].online += 1;
        teamMap[tName].members.push(u);
      });
      mechanicTeams = Object.values(teamMap).sort((a, b) => a.team_name.localeCompare(b.team_name));
      mechanicTeams.forEach(t => t.members.sort((a, b) => b.is_online - a.is_online));
    } catch(e) { console.error('Error mechanic teams:', e); }

    let jobsProportion = { total: 0, completed: 0, pending: 0, failed: 0 };
    try {
      const [[jp]] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(status = 'completed') as completed,
          SUM(status = 'pending') as pending,
          SUM(status = 'failed') as failed
        FROM jobs 
        WHERE MONTH(create_time) = MONTH(CURDATE()) AND YEAR(create_time) = YEAR(CURDATE())
      `);
      jobsProportion = {
        total: jp.total || 0,
        completed: jp.completed || 0,
        pending: jp.pending || 0,
        failed: jp.failed || 0
      };
    } catch(e) { console.error('Error jobs proportion:', e); }

    let jobsToday = 0, jobsPending = 0, jobsInProgress = 0, jobsCompletedToday = 0;
    try {
      const [[jobStats]] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(team_id IS NULL AND status NOT IN ('completed', 'failed')) as pending,
          SUM(team_id IS NOT NULL AND status NOT IN ('completed', 'failed')) as in_progress,
          SUM(status = 'completed') as completed
        FROM jobs 
        WHERE DATE(create_time) = CURDATE() OR plan_arrival_date = CURDATE()
      `);
      jobsToday += Number(jobStats.total || 0);
      jobsPending += Number(jobStats.pending || 0);
      jobsInProgress += Number(jobStats.in_progress || 0);
      jobsCompletedToday += Number(jobStats.completed || 0);

      const [[maStats]] = await pool.query(`
        SELECT 
          COUNT(*) as total,
          SUM(team_id IS NULL AND status NOT IN ('completed', 'failed')) as pending,
          SUM(team_id IS NOT NULL AND status NOT IN ('completed', 'failed')) as in_progress,
          SUM(status = 'completed') as completed
        FROM ma_jobs 
        WHERE plan_arrival_date = CURDATE()
      `);
      jobsToday += Number(maStats.total || 0);
      jobsPending += Number(maStats.pending || 0);
      jobsInProgress += Number(maStats.in_progress || 0);
      jobsCompletedToday += Number(maStats.completed || 0);
    } catch(e) { console.error('Error jobs today stats:', e); }

    res.json({
      summary: {
        totalUsers: usersCnt,
        onlineUsers: onlineCnt,
        totalInventory: inventoryCnt,
        totalNonCustomers: nonCnt,
        monthlyOilBills: oilCnt,
        monthlyEntryFees: entryCnt,
        jobsToday,
        jobsPending,
        jobsInProgress,
        jobsCompletedToday
      },
      feed,
      mechanicTeams,
      jobsProportion
    });
  } catch (err) {
    console.error('Super Admin Dashboard Stats Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/stats/efficiency?month=2026-05 ─────────────────
router.get('/efficiency', auth, async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  try {
    const [rows] = await pool.query(
      `SELECT t.id AS team_id, t.team_name,
              COALESCE(toc.case_count, 0) AS case_count,
              COALESCE(SUM(r.liters), 0)      AS total_liters,
              COALESCE(SUM(r.total_price), 0)  AS total_cost,
              CASE WHEN COALESCE(toc.case_count, 0) > 0
                   THEN ROUND(COALESCE(SUM(r.liters), 0) / toc.case_count, 2)
                   ELSE NULL END AS liters_per_job
       FROM teams t
       LEFT JOIN team_oil_cases toc
         ON toc.team_id = t.id AND toc.year_month = ?
       LEFT JOIN users u ON u.team_id = t.id
       LEFT JOIN oil_records r
         ON r.tech_id = u.id AND DATE_FORMAT(r.date_recorded, '%Y-%m') = ?
       GROUP BY t.id, t.team_name, toc.case_count
       ORDER BY liters_per_job ASC`,
      [month, month]
    );
    res.json({ month, teams: rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
// ── GET /api/stats/office-tech-dashboard — For Office Technician Homepage ──────
router.get('/office-tech-dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const teamId = req.user.team_id || null;
    
    let jobsToday = { cnt: 0 }, jobsCompleted = { cnt: 0 }, jobsFailed = { cnt: 0 };
    if (teamId) {
      [[jobsToday]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE team_id = ? AND DATE(create_time) = CURDATE()`, [teamId]);
      [[jobsCompleted]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE team_id = ? AND status='completed' AND DATE(create_time) = CURDATE()`, [teamId]);
      [[jobsFailed]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE team_id = ? AND status='failed' AND DATE(create_time) = CURDATE()`, [teamId]);
    }
    
    const [[oilToday]] = await pool.query(`SELECT COUNT(*) as cnt FROM oil_records WHERE tech_id = ? AND DATE(date_recorded) = CURDATE()`, [userId]);
    const [[entryToday]] = await pool.query(`SELECT COUNT(*) as cnt FROM entry_fees WHERE created_by = ? AND DATE(created_at) = CURDATE()`, [userId]);
    
    res.json({
      summary: {
        jobsToday: jobsToday.cnt || 0,
        jobsCompleted: jobsCompleted.cnt || 0,
        jobsFailed: jobsFailed.cnt || 0,
        oilToday: oilToday.cnt || 0,
        entryToday: entryToday.cnt || 0
      }
    });
  } catch (err) {
    console.error('Office Tech Dashboard Stats Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/stats/ma-tech-dashboard — For MA Technician Homepage ──────
router.get('/ma-tech-dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const teamId = req.user.team_id || null;
    
    let jobsToday = { cnt: 0 }, jobsCompleted = { cnt: 0 }, jobsFailed = { cnt: 0 };
    let completedMonth = { cnt: 0 };
    if (teamId) {
      [[jobsToday]] = await pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs WHERE team_id = ? AND plan_arrival_date = CURDATE()`, [teamId]);
      [[jobsCompleted]] = await pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs WHERE team_id = ? AND status='completed' AND plan_arrival_date = CURDATE()`, [teamId]);
      [[jobsFailed]] = await pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs WHERE team_id = ? AND status='failed' AND plan_arrival_date = CURDATE()`, [teamId]);
      [[completedMonth]] = await pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs WHERE team_id = ? AND status='completed' AND MONTH(completed_at) = MONTH(CURDATE()) AND YEAR(completed_at) = YEAR(CURDATE())`, [teamId]);
    }
    
    const [rows] = await pool.query(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key IN ('ma_target_days', 'ma_target_jobs')`);
    let ma_target_days = 26;
    let ma_target_jobs = 130;
    rows.forEach(r => {
      if (r.setting_key === 'ma_target_days') ma_target_days = parseInt(r.setting_value) || 26;
      if (r.setting_key === 'ma_target_jobs') ma_target_jobs = parseInt(r.setting_value) || 130;
    });
    
    const [[checkinsMonth]] = await pool.query(`SELECT COUNT(DISTINCT DATE(checkin_time)) as cnt FROM checkins WHERE user_id = ? AND MONTH(checkin_time) = MONTH(CURDATE()) AND YEAR(checkin_time) = YEAR(CURDATE())`, [userId]);
    
    const checkinsCount = checkinsMonth.cnt || 0;
    const completedCount = completedMonth.cnt || 0;
    const isConditionMet = (checkinsCount >= ma_target_days) && (completedCount >= ma_target_jobs);
    
    res.json({
      summary: {
        jobsToday: jobsToday.cnt || 0,
        jobsCompleted: jobsCompleted.cnt || 0,
        jobsFailed: jobsFailed.cnt || 0,
        targetDays: ma_target_days,
        targetJobs: ma_target_jobs,
        checkinsMonth: checkinsCount,
        completedMonth: completedCount,
        isConditionMet
      }
    });
  } catch (err) {
    console.error('MA Tech Dashboard Stats Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
