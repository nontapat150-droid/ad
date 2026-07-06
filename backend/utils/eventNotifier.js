const db = require('../config/db');
const { getMessaging } = require('firebase-admin/messaging');

/**
 * Ensures the event_messages table exists and is seeded with standard events
 */
async function initializeEventMessages() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS event_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_key VARCHAR(50) NOT NULL UNIQUE,
        event_label VARCHAR(100) NOT NULL,
        message_template TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        target_role VARCHAR(50) DEFAULT 'all',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const standardEvents = [
      {
        key: 'job_dispatch',
        label: 'เมื่อมีการจ่ายงาน (Dispatch Job)',
        template: 'มีงานใหม่เข้ามา: {job_id}\\nผู้ปฏิบัติงาน: {tech_name}\\nรายละเอียด: {description}',
        role: 'target_user' // Special role: send only to the specific technician
      },
      {
        key: 'check_in',
        label: 'เมื่อพนักงานเช็คอิน (Check-in)',
        template: 'พนักงาน {tech_name} ได้เช็คอินที่: {location}\\nเวลานัด: {appointment_time}',
        role: 'admin'
      },
      {
        key: 'oil_record',
        label: 'เมื่อมีการบันทึกค่าน้ำมัน (Oil Record)',
        template: 'มีการบันทึกค่าน้ำมันใหม่โดย {tech_name}\\nจำนวนเงิน: {amount} บาท',
        role: 'admin'
      },
      {
        key: 'inventory_dispatch',
        label: 'เมื่อมีการเบิกอะไหล่ (Inventory Dispatch)',
        template: 'มีการเบิกอะไหล่โดย {tech_name}\\nรายการ: {items}',
        role: 'admin'
      }
    ];

    for (const evt of standardEvents) {
      const [existing] = await db.execute('SELECT id FROM event_messages WHERE event_key = ?', [evt.key]);
      if (existing.length === 0) {
        await db.execute(
          'INSERT INTO event_messages (event_key, event_label, message_template, target_role) VALUES (?, ?, ?, ?)',
          [evt.key, evt.label, evt.template, evt.role]
        );
      }
    }
    console.log('✅ Event messages system initialized.');
  } catch (err) {
    console.error('❌ Failed to initialize event messages:', err.message);
  }
}

/**
 * Sends an automated notification based on an event key
 * @param {string} eventKey - The key of the event (e.g. 'job_dispatch')
 * @param {object} variables - Object containing variables to replace in template (e.g. { job_id: 1, tech_name: 'John' })
 * @param {number} targetUserId - (Optional) specific user ID to send to if target_role is 'target_user'
 * @param {number} senderId - (Optional) user ID who triggered this event (default 1 = System)
 */
async function sendEventNotification(eventKey, variables = {}, targetUserId = null, senderId = 1) {
  try {
    const [events] = await db.execute('SELECT * FROM event_messages WHERE event_key = ? AND is_active = TRUE', [eventKey]);
    if (events.length === 0) return; // Event not active or doesn't exist

    const event = events[0];
    let messageText = event.message_template;

    // Replace variables in template
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{${key}}`, 'g');
      messageText = messageText.replace(regex, value || '-');
    }

    // Determine target users
    let users = [];
    if (event.target_role === 'target_user' && targetUserId) {
      users = [{ id: targetUserId }];
    } else if (event.target_role === 'all') {
      const [rows] = await db.execute("SELECT id FROM users WHERE status = 'approved'");
      users = rows;
    } else if (event.target_role === 'admin') {
      const [rows] = await db.execute("SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND status = 'approved'");
      users = rows;
    } else {
      const [rows] = await db.execute("SELECT id FROM users WHERE role = ? AND status = 'approved'", [event.target_role]);
      users = rows;
    }

    if (users.length === 0) return;

    // Insert into internal messages inbox
    for (const user of users) {
      await db.execute(
        'INSERT INTO messages (sender_id, receiver_id, message, is_automated) VALUES (?, ?, ?, TRUE)',
        [senderId, user.id, messageText]
      );
    }

    // Send FCM push notifications
    const userIds = users.map(u => u.id);
    const placeholders = userIds.map(() => '?').join(',');
    const [tokens] = await db.execute(`SELECT fcm_token FROM user_fcm_tokens WHERE user_id IN (${placeholders})`, userIds);

    if (tokens.length > 0) {
      const fcmTokens = tokens.map(t => t.fcm_token);
      try {
        await getMessaging().sendEachForMulticast({
          tokens: fcmTokens,
          notification: {
            title: 'ข้อความอัตโนมัติ ⚡',
            body: messageText
          },
        });
      } catch (pushErr) {
        console.error('[EventNotifier] FCM push error:', pushErr.message);
      }
    }
  } catch (err) {
    console.error('[EventNotifier] Error sending event notification:', err);
  }
}

module.exports = {
  initializeEventMessages,
  sendEventNotification
};
