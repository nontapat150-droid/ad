const cron = require('node-cron');
const db = require('./config/db');
const { getMessaging } = require('firebase-admin/messaging');

let activeJobs = {};

/**
 * Send an automated message to targets
 */
async function sendScheduledMessage(msgConfig) {
  try {
    const { id, message, target_role, target_users, created_by } = msgConfig;
    console.log(`[Scheduler] Executing scheduled message ID: ${id}`);

    // Determine target users
    let query = '';
    let queryParams = [];

    if (target_role === 'all') {
      query = 'SELECT id, role FROM users';
    } else if (target_role === 'specific') {
      let userIds = [];
      try {
        userIds = typeof target_users === 'string' ? JSON.parse(target_users) : target_users;
      } catch (e) {
        console.error(`[Scheduler] Failed to parse target_users for msg ${id}`);
        return;
      }
      if (!Array.isArray(userIds) || userIds.length === 0) return;
      query = `SELECT id, role FROM users WHERE id IN (${userIds.map(() => '?').join(',')})`;
      queryParams = userIds;
    } else {
      query = 'SELECT id, role FROM users WHERE role = ?';
      queryParams = [target_role];
    }

    const [users] = await db.execute(query, queryParams);
    if (users.length === 0) {
      console.log(`[Scheduler] No target users found for msg ${id}`);
      return;
    }

    // Insert messages for each target user
    for (const user of users) {
      await db.execute(
        'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
        [created_by, user.id, message]
      );
    }

    console.log(`[Scheduler] Inserted ${users.length} messages for scheduled msg ${id}`);

    // Fetch FCM tokens for these users
    const userIds = users.map(u => u.id);
    const [tokens] = await db.execute(
      `SELECT fcm_token FROM user_fcm_tokens WHERE user_id IN (${userIds.map(() => '?').join(',')})`,
      userIds
    );

    if (tokens.length > 0) {
      const fcmTokens = tokens.map(t => t.fcm_token);
      
      const payload = {
        notification: {
          title: 'ข้อความอัตโนมัติ 🕒',
          body: message
        }
      };

      try {
        const response = await getMessaging().sendEachForMulticast({
          tokens: fcmTokens,
          notification: payload.notification,
        });
        console.log(`[Scheduler] FCM push sent. Success: ${response.successCount}, Failures: ${response.failureCount}`);
      } catch (pushErr) {
        console.error('[Scheduler] FCM push error:', pushErr);
      }
    }

  } catch (err) {
    console.error('[Scheduler] Error executing scheduled message:', err);
  }
}

/**
 * Load and schedule all active messages
 */
async function loadSchedules() {
  try {
    // Clear existing jobs
    for (const jobId in activeJobs) {
      activeJobs[jobId].stop();
    }
    activeJobs = {};

    const [messages] = await db.execute('SELECT * FROM scheduled_messages WHERE is_active = TRUE');
    
    console.log(`[Scheduler] Loaded ${messages.length} active scheduled messages`);

    messages.forEach(msg => {
      // Validate cron expression
      if (cron.validate(msg.cron_expression)) {
        const job = cron.schedule(msg.cron_expression, () => {
          sendScheduledMessage(msg);
        });
        activeJobs[msg.id] = job;
      } else {
        console.error(`[Scheduler] Invalid cron expression for msg ${msg.id}: ${msg.cron_expression}`);
      }
    });

  } catch (err) {
    console.error('[Scheduler] Error loading schedules:', err);
  }
}

module.exports = {
  loadSchedules
};
