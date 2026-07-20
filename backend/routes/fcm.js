const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const {
  sendPushNotification,
  sendToUser,
  firebaseInitialized,
  ensureFcmTokensSchema,
} = require('../config/firebase-admin');

const router = express.Router();

// ── POST /api/fcm/register-token — Save FCM token for current user ──
router.post('/register-token', auth, async (req, res) => {
  try {
    const { fcm_token, device_info } = req.body;
    if (!fcm_token) {
      return res.status(400).json({ error: 'fcm_token is required' });
    }

    await ensureFcmTokensSchema();

    // Upsert: if token already exists for this user, update it
    // If token exists for another user, reassign it (device changed user)
    await pool.query('DELETE FROM user_fcm_tokens WHERE fcm_token = ?', [fcm_token]);

    await pool.query(
      `INSERT INTO user_fcm_tokens (user_id, fcm_token, device_info, updated_at)
       VALUES (?, ?, ?, NOW())`,
      [req.user.id, fcm_token, device_info || null]
    );

    res.json({ success: true, message: 'FCM token registered' });
  } catch (error) {
    console.error('Error registering FCM token:', error);
    res.status(500).json({ error: 'Failed to register token' });
  }
});

// ── DELETE /api/fcm/unregister-token — Remove FCM token (on logout) ──
router.delete('/unregister-token', auth, async (req, res) => {
  try {
    const { fcm_token } = req.body;
    if (!fcm_token) {
      return res.status(400).json({ error: 'fcm_token is required' });
    }

    await pool.query(
      'DELETE FROM user_fcm_tokens WHERE user_id = ? AND fcm_token = ?',
      [req.user.id, fcm_token]
    );

    res.json({ success: true, message: 'FCM token unregistered' });
  } catch (error) {
    console.error('Error unregistering FCM token:', error);
    res.status(500).json({ error: 'Failed to unregister token' });
  }
});

// ── POST /api/fcm/test-send — Send a test push notification to yourself ──
router.post('/test-send', auth, async (req, res) => {
  try {
    if (!firebaseInitialized) {
      return res.status(503).json({
        error: 'Firebase Admin SDK not initialized. Please add service account key.',
      });
    }

    const result = await sendToUser(
      req.user.id,
      '🔔 ทดสอบการแจ้งเตือน',
      `สวัสดีคุณ ${req.user.full_name || req.user.username}! นี่คือข้อความทดสอบจากระบบ BOU`,
      { type: 'test', timestamp: new Date().toISOString() }
    );

    if (result.sent === 0) {
      return res.json({
        success: false,
        message: 'ไม่พบ FCM token — กรุณาอนุญาตการแจ้งเตือนในเบราว์เซอร์ก่อน',
      });
    }

    res.json({
      success: true,
      message: `ส่งการแจ้งเตือนทดสอบสำเร็จ ${result.sent} เครื่อง`,
      ...result,
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

// ── POST /api/fcm/send-to-user — Admin sends push to specific user ──
router.post('/send-to-user', auth, requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const { user_id, title, body } = req.body;
    if (!user_id || !title || !body) {
      return res.status(400).json({ error: 'user_id, title, and body are required' });
    }

    if (!firebaseInitialized) {
      return res.status(503).json({
        error: 'Firebase Admin SDK not initialized',
      });
    }

    const result = await sendToUser(user_id, title, body, {
      type: 'admin_message',
      sender_id: String(req.user.id),
      sender_name: req.user.full_name || req.user.username,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error sending push to user:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;
