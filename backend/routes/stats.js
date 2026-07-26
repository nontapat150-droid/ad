const express = require('express');
const pool    = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { ensureTeamsSchema } = require('../utils/teamsSchema');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

// Simple in-memory cache for heavy dashboard queries (15 seconds TTL)
const cache = {
  admin: { data: null, expiry: 0 },
  superAdmin: { data: null, expiry: 0 }
};
const CACHE_TTL = 60000; // 60s — frontend polls every 3 min; reduces DB load on shared hosting

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

// ── GET /api/stats/admin-dashboard — Admin Homepage (job-assignment focus) ──────
// Assigned = มี team_id หรือ assignee รายคน (field_engineer_id / assigned_user_id)
router.get('/admin-dashboard', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const now = Date.now();
  const forceFresh = req.query.refresh === '1';
  if (!forceFresh && cache.admin.data && cache.admin.expiry > now) {
    return res.json(cache.admin.data);
  }

  try {
    // Active (not truly postponed): status != postponed OR plan date already due
    const officeActive = `(j.status != 'postponed' OR j.plan_arrival_date IS NULL OR j.plan_arrival_date <= CURDATE())`;
    const maActive = `(j.status != 'postponed' OR j.plan_arrival_date IS NULL OR j.plan_arrival_date <= CURDATE())`;
    const officeUnassigned = `(j.team_id IS NULL AND j.field_engineer_id IS NULL)`;
    const maUnassigned = `(j.team_id IS NULL AND j.assigned_user_id IS NULL)`;
    const officeAssigned = `(j.team_id IS NOT NULL OR j.field_engineer_id IS NOT NULL)`;
    const maAssigned = `(j.team_id IS NOT NULL OR j.assigned_user_id IS NOT NULL)`;
    const officeIncomplete = `(j.customer IS NULL OR TRIM(j.customer) = '' OR j.phone IS NULL OR TRIM(j.phone) = '' OR j.access_no IS NULL OR TRIM(j.access_no) = '' OR j.address IS NULL OR TRIM(j.address) = '')`;
    const maIncomplete = `(j.customer IS NULL OR TRIM(j.customer) = '' OR j.phone IS NULL OR TRIM(j.phone) = '' OR COALESCE(NULLIF(TRIM(j.non_number), ''), NULLIF(TRIM(j.access_no), '')) IS NULL OR j.address IS NULL OR TRIM(j.address) = '')`;
    const trulyPostponed = `(j.status = 'postponed' AND (j.plan_arrival_date IS NULL OR j.plan_arrival_date > CURDATE()))`;

    const [
      officeTodayRes, maTodayRes,
      officeUnRes, maUnRes,
      incompleteOfficeRes, incompleteMaRes,
      postponedUnOfficeRes, postponedUnMaRes,
      announcementsRes, onlineRes,
    ] = await Promise.allSettled([
      // งานติดตั้งวันนี้ (นัดวันนี้) ที่มอบหมายแล้ว
      pool.query(`SELECT COUNT(*) as cnt FROM jobs j WHERE j.plan_arrival_date = CURDATE() AND ${officeAssigned}`),
      // งาน MA วันนี้ ที่มอบหมายแล้ว
      pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs j WHERE j.plan_arrival_date = CURDATE() AND ${maAssigned}`),
      // ยังไม่มอบหมาย — งาน active (รวมนัดวันนี้/ค้าง) ไม่นับ completed/failed และไม่นับเลื่อนอนาคต
      pool.query(`SELECT COUNT(*) as cnt FROM jobs j WHERE j.status NOT IN ('completed','failed') AND ${officeActive} AND ${officeUnassigned}`),
      pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs j WHERE j.status NOT IN ('completed','failed') AND ${maActive} AND ${maUnassigned}`),
      // ข้อมูลไม่ครบ (active)
      pool.query(`SELECT COUNT(*) as cnt FROM jobs j WHERE j.status NOT IN ('completed','failed') AND ${officeActive} AND ${officeIncomplete}`),
      pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs j WHERE j.status NOT IN ('completed','failed') AND ${maActive} AND ${maIncomplete}`),
      // เลื่อนแล้วรอมอบหมาย
      pool.query(`SELECT COUNT(*) as cnt FROM jobs j WHERE ${trulyPostponed} AND ${officeUnassigned}`),
      pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs j WHERE ${trulyPostponed} AND ${maUnassigned}`),
      pool.query(`SELECT * FROM announcements WHERE (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC LIMIT 5`),
      pool.query(`
        SELECT u.id, u.full_name, u.role, COALESCE(t.team_name, 'ไม่มีทีม') as team_name,
               (CASE WHEN u.last_active >= NOW() - INTERVAL 15 MINUTE THEN 1 ELSE 0 END) AS is_online,
               u.profile_image,
               GROUP_CONCAT(DISTINCT ur.role ORDER BY ur.role SEPARATOR ',') AS roles_csv,
               u.last_active
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.status = 'approved'
        GROUP BY u.id, u.full_name, u.role, t.team_name, u.profile_image, u.last_active
        ORDER BY t.team_name, u.full_name
      `),
    ]);

    const getVal = (result) => result.status === 'fulfilled' ? (result.value[0]?.[0]?.cnt ?? 0) : 0;
    const getRows = (result) => result.status === 'fulfilled' ? result.value[0] : [];

    const officeUnassignedCnt = getVal(officeUnRes);
    const maUnassignedCnt = getVal(maUnRes);
    const incompleteData = getVal(incompleteOfficeRes) + getVal(incompleteMaRes);
    const postponedUnassigned = getVal(postponedUnOfficeRes) + getVal(postponedUnMaRes);

    const onlineStatus = onlineRes.status === 'fulfilled'
      ? onlineRes.value[0].map(r => ({
          id: r.id, full_name: r.full_name, role: r.role, team_name: r.team_name,
          is_online: r.is_online, profile_image: r.profile_image, roles_csv: r.roles_csv,
          last_active: r.last_active ? new Date(r.last_active).toISOString() : null
        }))
      : [];

    const responseData = {
      summary: {
        officeAssignedToday: getVal(officeTodayRes),
        maAssignedToday: getVal(maTodayRes),
        unassignedToday: officeUnassignedCnt + maUnassignedCnt,
        officeUnassigned: officeUnassignedCnt,
        maUnassigned: maUnassignedCnt,
        incompleteData,
        postponedUnassigned,
      },
      announcements: getRows(announcementsRes),
      onlineStatus
    };

    cache.admin = { data: responseData, expiry: Date.now() + CACHE_TTL };
    res.json(responseData);
  } catch (err) {
    console.error('Admin Dashboard Stats Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/stats/super-admin-dashboard — Super Admin Homepage ──────
router.get('/super-admin-dashboard', auth, requireRole(['super_admin']), async (req, res) => {
  const now = Date.now();
  // Skip short-lived cache when client asks for fresh numbers
  const forceFresh = req.query.refresh === '1';
  if (!forceFresh && cache.superAdmin.data && cache.superAdmin.expiry > now) {
    return res.json(cache.superAdmin.data);
  }

  try {
    // Run ALL queries in parallel instead of sequentially
    const officeActive = `(j.status != 'postponed' OR j.plan_arrival_date IS NULL OR j.plan_arrival_date <= CURDATE())`;
    const maActive = `(j.status != 'postponed' OR j.plan_arrival_date IS NULL OR j.plan_arrival_date <= CURDATE())`;
    const officeUnassigned = `(j.team_id IS NULL AND j.field_engineer_id IS NULL)`;
    const maUnassigned = `(j.team_id IS NULL AND j.assigned_user_id IS NULL)`;

    const [
      usersRes, inventoryRes, nonRes, oilRes, entryRes, feedRes, onlineRes,
      pendingUsersRes, openReportsRes, officeUnRes, maUnRes,
    ] = await Promise.allSettled([
      pool.query(`SELECT COUNT(*) as cnt FROM users WHERE status = 'approved'`),
      pool.query(`SELECT COALESCE(SUM(quantity), 0) as cnt FROM inventory_items`),
      // NON customers live in ma_jobs / ma_customers — NOT jobs.access_no LIKE 'NON%'
      (async () => {
        try {
          return await pool.query(`
            SELECT COUNT(*) AS cnt FROM (
              SELECT non_number FROM ma_jobs
                WHERE non_number IS NOT NULL AND TRIM(non_number) <> ''
              UNION
              SELECT non_number FROM ma_customers
                WHERE non_number IS NOT NULL AND TRIM(non_number) <> ''
            ) non_all
          `);
        } catch {
          try {
            return await pool.query(`
              SELECT COUNT(DISTINCT non_number) AS cnt FROM ma_jobs
              WHERE non_number IS NOT NULL AND TRIM(non_number) <> ''
            `);
          } catch {
            return [[{ cnt: 0 }]];
          }
        }
      })(),
      pool.query(`SELECT COUNT(*) as cnt FROM oil_records WHERE date_recorded >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND date_recorded < DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')`),
      pool.query(`SELECT COUNT(*) as cnt FROM entry_fees WHERE created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01') AND created_at < DATE_FORMAT(CURDATE() + INTERVAL 1 MONTH, '%Y-%m-01')`),
      // Feed: simplified with smaller limits per source
      pool.query(`
        SELECT c.id, c.type, c.created_at, c.action, u.full_name as user_name, u.profile_image
        FROM (
          (SELECT id, tech_id AS user_id, 'oil' AS type, date_recorded AS created_at, 'บันทึกบิลลงน้ำมัน' AS action FROM oil_records WHERE date_recorded >= CURDATE() AND date_recorded < CURDATE() + INTERVAL 1 DAY ORDER BY date_recorded DESC LIMIT 10)
          UNION ALL
          (SELECT id, created_by AS user_id, 'entry_fee' AS type, created_at, 'บันทึกค่าแรกเข้า' AS action FROM entry_fees WHERE created_at >= CURDATE() AND created_at < CURDATE() + INTERVAL 1 DAY ORDER BY created_at DESC LIMIT 10)
          UNION ALL
          (SELECT id, user_id, 'checkin' AS type, checkin_time AS created_at, 'เช็คอินเข้างาน' AS action FROM checkins WHERE checkin_time >= CURDATE() AND checkin_time < CURDATE() + INTERVAL 1 DAY ORDER BY checkin_time DESC LIMIT 10)
          UNION ALL
          (SELECT id, user_id, 'checkin' AS type, checkin_time AS created_at, 'เช็คอินเข้างาน (MA)' AS action FROM ma_checkins WHERE checkin_time >= CURDATE() AND checkin_time < CURDATE() + INTERVAL 1 DAY ORDER BY checkin_time DESC LIMIT 10)
          UNION ALL
          (SELECT id, tech_id AS user_id, 'job' AS type, timestamp AS created_at, 'ปิดงานเสร็จสิ้น' AS action FROM job_logs WHERE status='completed' AND timestamp >= CURDATE() AND timestamp < CURDATE() + INTERVAL 1 DAY ORDER BY timestamp DESC LIMIT 10)
        ) AS c
        LEFT JOIN users u ON u.id = c.user_id
        ORDER BY c.created_at DESC
        LIMIT 30
      `),
      // Online status
      pool.query(`
        SELECT u.id, u.full_name, u.role, COALESCE(t.team_name, 'ไม่มีทีม') as team_name,
               (CASE WHEN u.last_active >= NOW() - INTERVAL 15 MINUTE THEN 1 ELSE 0 END) AS is_online,
               u.profile_image,
               GROUP_CONCAT(DISTINCT ur.role ORDER BY ur.role SEPARATOR ',') AS roles_csv,
               u.last_active
        FROM users u
        LEFT JOIN teams t ON u.team_id = t.id
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.status = 'approved'
        GROUP BY u.id, u.full_name, u.role, t.team_name, u.profile_image, u.last_active
        ORDER BY t.team_name, u.full_name
      `),
      pool.query(`SELECT COUNT(*) as cnt FROM users WHERE status = 'pending'`),
      (async () => {
        try {
          return await pool.query(`SELECT COUNT(*) as cnt FROM issue_reports WHERE status IN ('pending','open','in_progress') OR status IS NULL OR status = ''`);
        } catch {
          try {
            return await pool.query(`SELECT COUNT(*) as cnt FROM issue_reports WHERE status = 'pending'`);
          } catch {
            return [[{ cnt: 0 }]];
          }
        }
      })(),
      pool.query(`SELECT COUNT(*) as cnt FROM jobs j WHERE j.status NOT IN ('completed','failed') AND ${officeActive} AND ${officeUnassigned}`),
      pool.query(`SELECT COUNT(*) as cnt FROM ma_jobs j WHERE j.status NOT IN ('completed','failed') AND ${maActive} AND ${maUnassigned}`),
    ]);

    // Extract results safely
    const getVal = (result, defaultVal = 0) => {
      if (result.status === 'fulfilled') {
        return result.value[0]?.[0]?.cnt ?? defaultVal;
      }
      return defaultVal;
    };

    const feed = feedRes.status === 'fulfilled' ? feedRes.value[0] : [];

    const onlineStatus = onlineRes.status === 'fulfilled'
      ? onlineRes.value[0].map(r => ({
          id: r.id,
          full_name: r.full_name,
          role: r.role,
          team_name: r.team_name,
          is_online: r.is_online,
          profile_image: r.profile_image,
          roles_csv: r.roles_csv,
          last_active: r.last_active ? new Date(r.last_active).toISOString() : null
        }))
      : [];

    const onlineUsers = onlineStatus.filter(u => u.is_online).length;
    const unassignedToday = getVal(officeUnRes) + getVal(maUnRes);

    const responseData = {
      summary: {
        totalUsers: getVal(usersRes),
        onlineUsers,
        pendingUsers: getVal(pendingUsersRes),
        openReports: getVal(openReportsRes),
        unassignedToday,
        totalInventory: getVal(inventoryRes),
        totalNonCustomers: getVal(nonRes),
        monthlyOilBills: getVal(oilRes),
        monthlyEntryFees: getVal(entryRes)
      },
      feed,
      onlineStatus
    };
    
    cache.superAdmin = { data: responseData, expiry: Date.now() + CACHE_TTL };
    res.json(responseData);
  } catch (err) {
    console.error('Super Admin Dashboard Stats Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/stats/efficiency?month=2026-05 ─────────────────
router.get('/efficiency', auth, async (req, res) => {
  const month = req.query.month || new Date().toISOString().slice(0, 7);
  try {
    await ensureTeamsSchema(pool);
    const [rows] = await pool.query(
      `SELECT t.id AS team_id, t.team_name, t.team_type, t.counts_for_oil,
              COALESCE(toc.case_count, 0) AS case_count,
              COALESCE(SUM(r.liters), 0)      AS total_liters,
              COALESCE(SUM(r.total_price), 0)  AS total_cost,
              CASE WHEN COALESCE(toc.case_count, 0) > 0
                   THEN ROUND(COALESCE(SUM(r.liters), 0) / toc.case_count, 2)
                   ELSE NULL END AS liters_per_job
       FROM teams t
       LEFT JOIN team_oil_cases toc
         ON toc.team_id = t.id AND toc.\`year_month\` = ?
       LEFT JOIN users u ON u.team_id = t.id
       LEFT JOIN oil_records r
         ON r.tech_id = u.id AND DATE_FORMAT(r.date_recorded, '%Y-%m') = ?
       WHERE COALESCE(t.counts_for_oil, 1) = 1
       GROUP BY t.id, t.team_name, t.team_type, t.counts_for_oil, toc.case_count
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
      // นับงานทั้งหมดที่มอบหมายให้ทีม (ทุก status)
      [[jobsToday]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE team_id = ?`, [teamId]);
      [[jobsCompleted]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE team_id = ? AND status='completed' AND DATE(COALESCE(completed_at, create_time)) = CURDATE()`, [teamId]);
      [[jobsFailed]] = await pool.query(`SELECT COUNT(*) as cnt FROM jobs WHERE team_id = ? AND status='failed' AND DATE(COALESCE(updated_at, create_time)) = CURDATE()`, [teamId]);
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
    
    const [[checkinsMonth]] = await pool.query(`SELECT COUNT(DISTINCT DATE(checkin_time)) as cnt FROM ma_checkins WHERE user_id = ? AND MONTH(checkin_time) = MONTH(CURDATE()) AND YEAR(checkin_time) = YEAR(CURDATE())`, [userId]);
    
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
