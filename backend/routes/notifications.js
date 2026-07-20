const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const { ensureNotificationsSchema } = require('../utils/notifyEvent');

const router = express.Router();

function parseDataJson(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// GET /api/notifications/unread-count
router.get('/unread-count', auth, async (req, res) => {
  try {
    await ensureNotificationsSchema();
    const [[row]] = await pool.query(
      `SELECT COUNT(*) AS count
       FROM notifications
       WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ count: Number(row?.count) || 0 });
  } catch (err) {
    console.error('notifications unread-count:', err);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// GET /api/notifications — list my notifications
router.get('/', auth, async (req, res) => {
  try {
    await ensureNotificationsSchema();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const unreadOnly = String(req.query.unread || '') === '1';

    const [rows] = await pool.query(
      `SELECT n.id, n.event_key, n.type, n.title, n.body, n.data_json,
              n.is_read, n.read_at, n.created_at, n.actor_id,
              u.full_name AS actor_name
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = ?
         ${unreadOnly ? 'AND n.is_read = 0' : ''}
       ORDER BY n.created_at DESC
       LIMIT ${limit}`,
      [req.user.id]
    );

    res.json(
      rows.map((r) => ({
        ...r,
        is_read: !!Number(r.is_read),
        data: parseDataJson(r.data_json),
      }))
    );
  } catch (err) {
    console.error('notifications list:', err);
    res.status(500).json({ error: 'Failed to fetch notifications', detail: err.message });
  }
});

// PUT /api/notifications/read-all  (must be before /:id/read)
router.put('/read-all', auth, async (req, res) => {
  try {
    await ensureNotificationsSchema();
    const [result] = await pool.query(
      `UPDATE notifications
       SET is_read = 1, read_at = NOW()
       WHERE user_id = ? AND is_read = 0`,
      [req.user.id]
    );
    res.json({ success: true, updated: result.affectedRows });
  } catch (err) {
    console.error('notifications read-all:', err);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', auth, async (req, res) => {
  try {
    await ensureNotificationsSchema();
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const [result] = await pool.query(
      `UPDATE notifications
       SET is_read = 1, read_at = NOW()
       WHERE id = ? AND user_id = ? AND is_read = 0`,
      [id, req.user.id]
    );

    res.json({ success: true, updated: result.affectedRows > 0 });
  } catch (err) {
    console.error('notifications mark read:', err);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureNotificationsSchema();
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: 'Invalid id' });

    const [result] = await pool.query(
      `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'ไม่พบการแจ้งเตือน' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('notifications delete:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

module.exports = router;
