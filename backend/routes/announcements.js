const express = require('express');
const pool = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const ADMIN_ROLES = ['super_admin', 'admin'];

// ── GET /api/announcements/active ───────────────────────────
// All authenticated users can see active announcements
router.get('/active', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT * FROM announcements 
      WHERE status = 'active' 
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Fetch active announcements error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/announcements ──────────────────────────────────
// Admins can see all announcements
router.get('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT a.*, u.full_name as creator_name 
      FROM announcements a
      LEFT JOIN users u ON a.created_by = u.id
      ORDER BY a.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Fetch announcements error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/announcements ─────────────────────────────────
router.post('/', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { title, message, type, status, expires_at } = req.body;
  if (!title || !message) {
    return res.status(400).json({ error: 'Title and message are required' });
  }
  
  try {
    const [result] = await pool.query(
      `INSERT INTO announcements (title, message, type, status, expires_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [title, message, type || 'info', status || 'active', expires_at || null, req.user.id]
    );
    res.json({ message: 'Announcement created successfully', id: result.insertId });
  } catch (err) {
    console.error('Create announcement error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/announcements/:id ──────────────────────────────
router.put('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { title, message, type, status, expires_at } = req.body;
  const { id } = req.params;
  
  try {
    await pool.query(
      `UPDATE announcements 
       SET title = ?, message = ?, type = ?, status = ?, expires_at = ?
       WHERE id = ?`,
      [title, message, type, status, expires_at || null, id]
    );
    res.json({ message: 'Announcement updated successfully' });
  } catch (err) {
    console.error('Update announcement error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── DELETE /api/announcements/:id ───────────────────────────
router.delete('/:id', auth, requireRole(ADMIN_ROLES), async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM announcements WHERE id = ?', [id]);
    res.json({ message: 'Announcement deleted successfully' });
  } catch (err) {
    console.error('Delete announcement error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
