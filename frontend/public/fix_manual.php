<?php
header('Content-Type: application/json');
set_time_limit(30);

$backend = '/home/zvucfpsz/public_html/backend';
$output = [];

// Write the CORRECT report.js directly to server
$report_js = <<<'JSEOF'
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { auth } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure reports upload directory exists
const uploadDir = path.join(__dirname, '../uploads/reports');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'report_' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('รองรับเฉพาะไฟล์รูปภาพเท่านั้น'));
    }
  }
});

// GET /api/report - Get list of reports
router.get('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [req.user.role];
    const isAdmin = roles.some(r => ['super_admin', 'admin'].includes(r));
    
    let query = `
      SELECT r.*, u.full_name, t.team_name
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id
    `;
    let params = [];

    if (!isAdmin) {
      query += ` WHERE r.user_id = ?`;
      params.push(req.user.id);
    }
    
    query += ` ORDER BY r.created_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/report - Create new report
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const imagePath = req.file ? `reports/${req.file.filename}` : null;

    if (!title || !description) {
      return res.status(400).json({ error: 'กรุณากรอกหัวข้อและรายละเอียด' });
    }

    const [result] = await pool.query(
      `INSERT INTO reports (user_id, title, description, image_path, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [req.user.id, title, description, imagePath]
    );

    res.status(201).json({ id: result.insertId, message: 'บันทึกการแจ้งปัญหาเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error creating report:', error);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', details: error.message });
  }
});

// PUT /api/report/:id/status - Admin change status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [req.user.role];
    if (!roles.some(r => ['super_admin', 'admin'].includes(r))) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ในการเปลี่ยนสถานะ' });
    }

    const { status } = req.body;
    if (!['pending', 'in_progress', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    }

    await pool.query(`UPDATE reports SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ message: 'อัปเดตสถานะเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({ error: 'ไม่สามารถอัปเดตสถานะได้' });
  }
});

// DELETE /api/report/:id - Admin delete report
router.delete('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [req.user.role];
    if (!roles.some(r => ['super_admin', 'admin'].includes(r))) {
      return res.status(403).json({ error: 'ไม่มีสิทธิ์ในการลบข้อมูล' });
    }

    const [rows] = await pool.query(`SELECT image_path FROM reports WHERE id = ?`, [req.params.id]);
    if (rows.length > 0 && rows[0].image_path) {
      const fullPath = path.join(__dirname, '../uploads', rows[0].image_path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }

    await pool.query(`DELETE FROM reports WHERE id = ?`, [req.params.id]);
    res.json({ message: 'ลบข้อมูลเรียบร้อยแล้ว' });
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({ error: 'ไม่สามารถลบข้อมูลได้' });
  }
});

module.exports = router;
JSEOF;

$rp = $backend . '/routes/report.js';
$written = file_put_contents($rp, $report_js);
$output['report_js_written'] = $written !== false ? $written . ' bytes' : 'FAILED';

// Verify line 40 (should now be t.team_name)
$lines = file($rp);
$output['line40_verify'] = isset($lines[39]) ? trim($lines[39]) : 'n/a';

// Restart Node by touching restart.txt
$restart_file = $backend . '/tmp/restart.txt';
@mkdir(dirname($restart_file), 0755, true);
$touched = touch($restart_file);
$output['restart_touched'] = $touched;

// Also try pkill
$kill = shell_exec('pkill -USR2 -f "node.*server" 2>&1; echo done');
$output['pkill'] = trim($kill);

echo json_encode($output, JSON_PRETTY_PRINT);
?>
