const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const { upload, setUpload } = require('../middleware/upload');

// ── GET /api/reports ─── Get reports for current user (or all if admin)
router.get('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [req.user.role];
    const isAdmin = roles.includes('super_admin') || roles.includes('admin');
    
    let query = `
      SELECT r.*, u.full_name as reporter_name, t.team_name
      FROM issue_reports r
      JOIN users u ON r.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id
    `;
    let params = [];

    if (!isAdmin) {
      query += ` WHERE r.user_id = ? `;
      params.push(req.user.id);
    }
    
    query += ` ORDER BY r.created_at DESC`;
    
    const [reports] = await pool.query(query, params);
    res.json(reports);
  } catch (err) {
    console.error('Fetch reports error:', err);
    res.status(500).json({ error: 'Server error fetching reports' });
  }
});

// ── POST /api/reports ─── Create a new issue report
router.post('/',
  auth,
  setUpload('issues'),
  upload.single('image'),
  async (req, res) => {
    try {
      const { message } = req.body;
      const imageUrl = req.file ? req.file.filename : null;

      if (!message && !imageUrl) {
        return res.status(400).json({ error: 'ต้องระบุข้อความหรือรูปภาพ' });
      }

      const [result] = await pool.query(
        `INSERT INTO issue_reports (user_id, message, image_url, status) VALUES (?, ?, ?, 'pending')`,
        [req.user.id, message || '', imageUrl]
      );

      res.status(201).json({ message: 'บันทึกการแจ้งปัญหาสำเร็จ', id: result.insertId });
    } catch (err) {
      console.error('Create report error:', err);
      res.status(500).json({ error: 'Server error creating report' });
    }
  }
);

// ── PUT /api/reports/:id/status ─── Admin update status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [req.user.role];
    if (!roles.includes('super_admin') && !roles.includes('admin')) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง' });
    }

    const { status } = req.body;
    if (!['pending', 'reviewed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    }

    await pool.query(
      `UPDATE issue_reports SET status = ? WHERE id = ?`,
      [status, req.params.id]
    );

    res.json({ message: 'อัปเดตสถานะสำเร็จ' });
  } catch (err) {
    console.error('Update report status error:', err);
    res.status(500).json({ error: 'Server error updating report' });
  }
});

module.exports = router;
