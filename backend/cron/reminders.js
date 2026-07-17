const cron = require('node-cron');
const pool = require('../config/db');
const { sendToUser } = require('../config/firebase-admin');

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000;
const REMINDER_WINDOW_START = 7;  // 07:00 BKK
const REMINDER_WINDOW_END = 10;   // through 10:59 BKK

function getBkkNow() {
  return new Date(Date.now() + BKK_OFFSET_MS);
}

function reminderTimeFromThreshold(lateThreshold) {
  const parts = lateThreshold.split(':');
  if (parts.length < 2) return null;

  let hour = parseInt(parts[0], 10);
  let min = parseInt(parts[1], 10);
  hour -= 1;
  if (hour < 0) hour += 24;

  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

async function loadMaFirstJobTimes(maUsers, today) {
  const map = new Map();
  if (maUsers.length === 0) return map;

  const userIds = maUsers.map((u) => u.id);
  const [rows] = await pool.query(
    `SELECT u.id AS user_id, MIN(m.plan_arrival_time) AS first_job_time
     FROM users u
     INNER JOIN ma_jobs m
       ON m.plan_arrival_date = ?
      AND (m.team_id = u.team_id OR m.assigned_user_id = u.id)
     WHERE u.id IN (?)
     GROUP BY u.id`,
    [today, userIds]
  );

  for (const row of rows) {
    if (row.first_job_time) {
      map.set(row.user_id, row.first_job_time);
    }
  }

  for (const user of maUsers) {
    if (!map.has(user.id)) {
      map.set(user.id, '23:59:59');
    }
  }

  return map;
}

// Run every minute; exits early outside morning check-in window
cron.schedule('* * * * *', async () => {
  try {
    const bkkDate = getBkkNow();
    const hour = bkkDate.getUTCHours();
    if (hour < REMINDER_WINDOW_START || hour > REMINDER_WINDOW_END) return;

    const currentTimeStr = `${hour.toString().padStart(2, '0')}:${bkkDate.getUTCMinutes().toString().padStart(2, '0')}`;
    const today = bkkDate.toISOString().slice(0, 10);

    const [users] = await pool.query(
      `SELECT id, role, team_id, allow_late_time, full_name
       FROM users
       WHERE status = 'approved' AND id != 1`
    );
    if (users.length === 0) return;

    const [settings] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'late_time%'`
    );
    const globalLateTime = settings.find((s) => s.setting_key === 'late_time')?.setting_value || '08:30:00';
    const roleSettings = Object.fromEntries(settings.map((s) => [s.setting_key, s.setting_value]));

    const [checkins] = await pool.query(
      `SELECT user_id FROM checkins WHERE DATE(checkin_time) = ?`,
      [today]
    );
    const checkedInUserIds = new Set(checkins.map((c) => c.user_id));

    const pendingUsers = users.filter((u) => !checkedInUserIds.has(u.id));
    if (pendingUsers.length === 0) return;

    const maUsers = pendingUsers.filter((u) => u.role === 'ma_technician' || u.role === 'ma');
    const maFirstJobMap = await loadMaFirstJobTimes(maUsers, today);

    for (const user of pendingUsers) {
      let lateThreshold;
      if (user.role === 'ma_technician' || user.role === 'ma') {
        lateThreshold = maFirstJobMap.get(user.id) || '23:59:59';
      } else {
        lateThreshold = user.allow_late_time || roleSettings[`late_time_${user.role}`] || globalLateTime;
      }
      if (!lateThreshold) continue;

      const reminderTimeStr = reminderTimeFromThreshold(lateThreshold);
      if (!reminderTimeStr || currentTimeStr !== reminderTimeStr) continue;

      const msg = `🔔 อย่าลืมเช็คอินเข้างานนะครับ! กำหนดการเช็คอินของคุณคือเวลา ${lateThreshold.slice(0, 5)} น. (เหลือเวลาอีก 1 ชม.)`;
      await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, message, is_automated) VALUES (1, ?, ?, TRUE)`,
        [user.id, msg]
      );

      sendToUser(
        user.id,
        '⏰ เตือนเช็คอิน',
        `อย่าลืมเช็คอินเข้างานก่อน ${lateThreshold.slice(0, 5)} น. นะครับ (เหลืออีก 1 ชม.)`,
        { type: 'checkin_reminder' }
      ).catch((e) => console.error('Push reminder failed:', e.message));
    }
  } catch (error) {
    console.error('Check-in reminder cron error:', error);
  }
});
