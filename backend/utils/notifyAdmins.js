/**
 * notifyAdmins.js
 * ─────────────────────────────────────────────────────────────
 * Centralized helper to:
 *  1. Insert a message record into the `messages` table for every admin/super_admin
 *  2. Send an FCM push notification to every admin device
 *
 * Usage:
 *   const { notifyAdmins, notifyUser } = require('../utils/notifyAdmins');
 *   await notifyAdmins(pool, '📦 นำเข้าสินค้า', 'แอดมินเพิ่มสินค้า WIFI6 AX55 จำนวน 5 ชิ้น', { type: 'inventory_receive' });
 */

const { sendToUser } = require('../config/firebase-admin');

/**
 * Send notification to all admins (push + in-app message).
 * @param {object} pool  - mysql2 pool
 * @param {string} title - Notification title
 * @param {string} body  - Notification body
 * @param {object} data  - Extra data for FCM (type, etc.)
 * @param {number|null} senderUserId - The user who performed the action (null = system)
 */
async function notifyAdmins(pool, title, body, data = {}, senderUserId = null) {
  try {
    // Get all admins/super_admins
    const [admins] = await pool.query(
      `SELECT DISTINCT u.id FROM users u
       LEFT JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.status = 'approved'
         AND (u.role IN ('super_admin','admin') OR ur.role IN ('super_admin','admin'))
         AND u.id != ?`,
      [senderUserId || 0]
    );

    for (const admin of admins) {
      // 1. Insert message record
      try {
        await pool.query(
          `INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`,
          [senderUserId || null, admin.id, `${title}\n${body}`]
        );
      } catch (dbErr) {
        console.error('[notifyAdmins] DB insert error:', dbErr.message);
      }

      // 2. Send FCM push (fire & forget)
      sendToUser(admin.id, title, body, { ...data, title, body })
        .catch(e => console.error('[notifyAdmins] FCM error:', e.message));
    }
  } catch (err) {
    console.error('[notifyAdmins] Error:', err.message);
  }
}

/**
 * Send notification to a specific user (push + in-app message).
 * @param {object} pool
 * @param {number} receiverId
 * @param {string} title
 * @param {string} body
 * @param {object} data
 * @param {number|null} senderUserId
 */
async function notifyUser(pool, receiverId, title, body, data = {}, senderUserId = null) {
  try {
    // Insert message record
    try {
      await pool.query(
        `INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)`,
        [senderUserId || null, receiverId, `${title}\n${body}`]
      );
    } catch (dbErr) {
      console.error('[notifyUser] DB insert error:', dbErr.message);
    }

    // Send FCM push
    sendToUser(receiverId, title, body, { ...data, title, body })
      .catch(e => console.error('[notifyUser] FCM error:', e.message));
  } catch (err) {
    console.error('[notifyUser] Error:', err.message);
  }
}

module.exports = { notifyAdmins, notifyUser };
