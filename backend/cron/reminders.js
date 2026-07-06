const cron = require('node-cron');
const pool = require('../config/db');
const { sendToUser } = require('../config/firebase-admin');

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    const now = new Date();
    // Offset by UTC+7 (Asia/Bangkok)
    const bkkDate = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const currentHour = bkkDate.getUTCHours().toString().padStart(2, '0');
    const currentMinute = bkkDate.getUTCMinutes().toString().padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMinute}`;
    const today = bkkDate.toISOString().slice(0, 10);

    // 1. Get all active users
    const [users] = await pool.query(`SELECT id, role, team_id, allow_late_time, full_name FROM users WHERE status = 'approved' AND id != 1`);
    
    // 2. Get global settings
    const [settings] = await pool.query(`SELECT setting_key, setting_value FROM system_settings WHERE setting_key LIKE 'late_time%'`);
    const globalLateTime = settings.find(s => s.setting_key === 'late_time')?.setting_value || '08:30:00';
    const roleSettings = {};
    settings.forEach(s => {
      roleSettings[s.setting_key] = s.setting_value;
    });

    // 3. Find who checked in today
    const [checkins] = await pool.query(`SELECT user_id FROM checkins WHERE DATE(checkin_time) = ?`, [today]);
    const checkedInUserIds = new Set(checkins.map(c => c.user_id));

    // 4. Determine late threshold for each user
    for (const user of users) {
      if (checkedInUserIds.has(user.id)) continue; // Already checked in

      let lateThreshold = null;

      if (user.role === 'ma_technician' || user.role === 'ma') {
        const [maJobs] = await pool.query(
          `SELECT MIN(plan_arrival_time) as first_job_time 
           FROM ma_jobs 
           WHERE (team_id = ? OR assigned_user_id = ?) 
             AND plan_arrival_date = ?`,
          [user.team_id, user.id, today]
        );
        if (maJobs.length > 0 && maJobs[0].first_job_time) {
          lateThreshold = maJobs[0].first_job_time; // format like HH:mm:ss
        } else {
          lateThreshold = '23:59:59';
        }
      } else {
        const roleLateTime = roleSettings[`late_time_${user.role}`];
        lateThreshold = user.allow_late_time || roleLateTime || globalLateTime;
      }

      if (!lateThreshold) continue;

      // Extract HH:mm from lateThreshold
      const parts = lateThreshold.split(':');
      if (parts.length >= 2) {
        let hour = parseInt(parts[0], 10);
        let min = parseInt(parts[1], 10);

        // Subtract 1 hour
        hour = hour - 1;
        if (hour < 0) {
            hour += 24;
        }

        const reminderHour = hour.toString().padStart(2, '0');
        const reminderMin = min.toString().padStart(2, '0');
        const reminderTimeStr = `${reminderHour}:${reminderMin}`;

        if (currentTimeStr === reminderTimeStr) {
          // Send message to DB
          const msg = `🔔 อย่าลืมเช็คอินเข้างานนะครับ! กำหนดการเช็คอินของคุณคือเวลา ${lateThreshold.slice(0, 5)} น. (เหลือเวลาอีก 1 ชม.)`;
          await pool.query(
            `INSERT INTO messages (sender_id, receiver_id, message, is_automated) VALUES (1, ?, ?, TRUE)`,
            [user.id, msg]
          );

          // 🔔 Also send push notification
          sendToUser(
            user.id,
            '⏰ เตือนเช็คอิน',
            `อย่าลืมเช็คอินเข้างานก่อน ${lateThreshold.slice(0, 5)} น. นะครับ (เหลืออีก 1 ชม.)`,
            { type: 'checkin_reminder' }
          ).catch(e => console.error('Push reminder failed:', e.message));
        }
      }
    }
  } catch (error) {
    console.error('Check-in reminder cron error:', error);
  }
});
