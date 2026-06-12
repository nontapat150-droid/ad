<?php
header('Content-Type: application/json');

$host = 'localhost';
$db   = 'zvucfpsz_RT';
$user = 'zvucfpsz_BO';
$pass = '@2*]BC9AuGO^%P&-';

$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    
    $code = file_get_contents('/home/zvucfpsz/repositories/ad/backend/routes/report.js');
    $code = str_replace(
        "res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });",
        "try { require('fs').appendFileSync(__dirname + '/../error_log.txt', new Date().toISOString() + ' POST /api/report: ' + error.stack + '\\n\\n'); } catch(e) {}\n    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', details: error.message });",
        $code
    );
    file_put_contents('/home/zvucfpsz/repositories/ad/backend/routes/report.js', $code);
    file_put_contents('/home/zvucfpsz/backend/routes/report.js', $code);
    
    $restart = shell_exec('cd /home/zvucfpsz/repositories/ad/backend && touch tmp/restart.txt && pkill -f node 2>&1');
    $js = "
const mysql = require('mysql2/promise');
async function test() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'bonusais_usr',
        password: 'U%i0T6H^Q%zW',
        database: 'bonusais_db'
    });
    try {
        const [rows] = await pool.query('SHOW TABLES');
        console.log(JSON.stringify(rows));
        process.exit(0);
    } catch(e) {
        console.error(e.message);
        process.exit(1);
    }
}
test();
";
    file_put_contents('/home/zvucfpsz/repositories/ad/backend/test_db.js', $js);
    $js = "
const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../uploads/reports');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [req.user.role];
    let query = 'SELECT r.*, u.full_name, t.name AS team_name, u.phone FROM reports r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN teams t ON u.team_id = t.id';
    let params = [];
    if (!roles.some(r => ['super_admin', 'admin'].includes(r))) {
      query += ' WHERE r.user_id = ?';
      params.push(req.user.id);
    }
    query += ' ORDER BY r.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    try { require('fs').appendFileSync(__dirname + '/../error_log.txt', new Date().toISOString() + ' REWRITE GET /api/report: ' + error.stack + '\\n\\n'); } catch(e) {}
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการดึงข้อมูล' });
  }
});

router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description } = req.body;
    const imagePath = req.file ? 'reports/' + req.file.filename : null;
    if (!title || !description) return res.status(400).json({ error: 'กรุณากรอกหัวข้อและรายละเอียด' });
    const [result] = await pool.query('INSERT INTO reports (user_id, title, description, image_path, status) VALUES (?, ?, ?, ?, \\'pending\\')', [req.user.id, title, description, imagePath]);
    res.status(201).json({ id: result.insertId, message: 'บันทึกการแจ้งปัญหาเรียบร้อยแล้ว' });
  } catch (error) {
    try { require('fs').appendFileSync(__dirname + '/../error_log.txt', new Date().toISOString() + ' REWRITE POST /api/report: ' + error.stack + '\\n\\n'); } catch(e) {}
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', details: error.message });
  }
});

router.put('/:id/status', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [req.user.role];
    if (!roles.some(r => ['super_admin', 'admin'].includes(r))) return res.status(403).json({ error: 'ไม่มีสิทธิ์ในการเปลี่ยนสถานะ' });
    const { status } = req.body;
    if (!['pending', 'in_progress', 'resolved'].includes(status)) return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' });
    const [result] = await pool.query('UPDATE reports SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบรายการที่ต้องการแก้ไข' });
    res.json({ message: 'อัปเดตสถานะเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [req.user.role];
    const reportId = req.params.id;
    if (roles.some(r => ['super_admin', 'admin'].includes(r))) {
      await pool.query('DELETE FROM reports WHERE id = ?', [reportId]);
    } else {
      const [result] = await pool.query('DELETE FROM reports WHERE id = ? AND user_id = ?', [reportId, req.user.id]);
      if (result.affectedRows === 0) return res.status(404).json({ error: 'ไม่พบรายการหรือไม่มีสิทธิ์ลบ' });
    }
    res.json({ message: 'ลบข้อมูลเรียบร้อยแล้ว' });
  } catch (error) {
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการลบข้อมูล' });
  }
});

module.exports = router;
";
    file_put_contents('/home/zvucfpsz/repositories/ad/backend/routes/report.js', $js);
    file_put_contents('/home/zvucfpsz/backend/routes/report.js', $js);
    $restart = shell_exec('cd /home/zvucfpsz/repositories/ad/backend && touch tmp/restart.txt && pkill -f node 2>&1');
    $api_test = shell_exec('curl -s -i http://127.0.0.1:5000/api/test-db 2>&1');
    echo json_encode(['success' => true, 'api_test' => $api_test]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
