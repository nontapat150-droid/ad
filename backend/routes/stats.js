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
    const [[inventoryResult]] = await pool.query(`SELECT SUM(quantity) as cnt FROM inventory_items`);
    const [[officeAssigned]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE DATE(create_time) = CURDATE() AND team_id IS NOT NULL`);
    const [[maAssigned]] = await pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs WHERE plan_arrival_date = CURDATE() AND team_id IS NOT NULL`);
    const [[officeUnassigned]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE DATE(create_time) = CURDATE() AND team_id IS NULL`);
    const [[maUnassigned]] = await pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs WHERE plan_arrival_date = CURDATE() AND team_id IS NULL`);
    const unassignedTotal = (officeUnassigned.cnt || 0) + (maUnassigned.cnt || 0);

    const [announcements] = await pool.query(
      `SELECT * FROM announcements 
       WHERE (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC LIMIT 5`
    );

    res.json({
      summary: {
        totalInventory: inventoryResult.cnt || 0,
        officeAssignedToday: officeAssigned.cnt || 0,
        maAssignedToday: maAssigned.cnt || 0,
        unassignedToday: unassignedTotal
      },
      announcements
    });
  } catch (err) {
    console.error('Admin Dashboard Stats Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/stats/super-admin-dashboard — Super Admin Homepage ──────
router.get('/super-admin-dashboard', auth, requireRole(['super_admin']), async (req, res) => {
  try {
    const [[usersResult]] = await pool.query(`SELECT COUNT(*) as cnt FROM users`);
    const [[onlineResult]] = await pool.query(`SELECT COUNT(DISTINCT user_id) as cnt FROM checkins WHERE DATE(checkin_time) = CURDATE() AND checkout_time IS NULL`);
    const [[inventoryResult]] = await pool.query(`SELECT SUM(quantity) as cnt FROM inventory_items`);
    const [[nonResult]] = await pool.query(`SELECT COUNT(DISTINCT access_no) as cnt FROM jobs WHERE access_no LIKE 'NON%'`);
    const [[oilResult]] = await pool.query(`SELECT COUNT(*) as cnt FROM oil_records WHERE MONTH(date_recorded) = MONTH(CURDATE()) AND YEAR(date_recorded) = YEAR(CURDATE())`);
    const [[entryResult]] = await pool.query(`SELECT COUNT(*) as cnt FROM entry_fees WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())`);

    const [feed] = await pool.query(`
      SELECT c.id, c.type, c.created_at, c.action, u.full_name as user_name
      FROM (
        (SELECT id, tech_id AS user_id, 'oil' AS type, date_recorded AS created_at, 'บันทึกบิลลงน้ำมัน' AS action FROM oil_records ORDER BY date_recorded DESC LIMIT 10)
        UNION ALL
        (SELECT id, created_by AS user_id, 'entry_fee' AS type, created_at, 'บันทึกค่าแรกเข้า' AS action FROM entry_fees ORDER BY created_at DESC LIMIT 10)
        UNION ALL
        (SELECT id, user_id, 'checkin' AS type, checkin_time AS created_at, 'เช็คอินเข้างาน' AS action FROM checkins ORDER BY checkin_time DESC LIMIT 10)
        UNION ALL
        (SELECT id, tech_id AS user_id, 'job' AS type, created_at, 'ปิดงานเสร็จสิ้น' AS action FROM job_logs WHERE status='completed' ORDER BY created_at DESC LIMIT 10)
      ) AS c
      LEFT JOIN users u ON u.id = c.user_id
      ORDER BY c.created_at DESC
      LIMIT 20
    `);

    res.json({
      summary: {
        totalUsers: usersResult.cnt || 0,
        onlineUsers: onlineResult.cnt || 0,
        totalInventory: inventoryResult.cnt || 0,
        totalNonCustomers: nonResult.cnt || 0,
        monthlyOilBills: oilResult.cnt || 0,
        monthlyEntryFees: entryResult.cnt || 0
      },
      feed
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
