require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// ── Route Modules ───────────────────────────────────────────
const authRouter = require('./routes/auth');
const checkinRouter = require('./routes/checkin');
const dispatchRouter = require('./routes/dispatch');
const inventoryRouter = require('./routes/inventory');
const oilRouter = require('./routes/oil');
const usersRouter = require('./routes/users');
const statsRouter = require('./routes/stats');
const messagesRouter = require('./routes/messages');
const announcementsRouter = require('./routes/announcements');
const migrateRouter = require('./routes/migrate');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Ensure uploads folder exists ────────────────────────────
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'https://bonusais.com',
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// ── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BOU Operations API',
    version: '1.0.0',
    ts: new Date().toISOString(),
  });
});

// ── API Routes ──────────────────────────────────────────────
const apiRouter = express.Router();
apiRouter.use('/auth', authRouter);
apiRouter.use('/checkin', checkinRouter);
apiRouter.use('/dispatch', dispatchRouter);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/oil', oilRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/messages', messagesRouter);
apiRouter.use('/announcements', announcementsRouter);
apiRouter.use('/reports', require('./routes/reports'));
apiRouter.use('/settings', require('./routes/settings'));
apiRouter.use('/migrate', migrateRouter);

// เพื่อแก้ปัญหา cPanel Passenger ตัด /api ออก
app.use('/api', apiRouter);
app.use('/', apiRouter);

const pool = require('./config/db');
pool.query("DELETE FROM oil_records WHERE license_plate = 'ทีม 6'").catch(console.error);
pool.query("DELETE FROM teams WHERE team_name = 'ทีม 6'").catch(console.error);
pool.query(`
  CREATE TABLE IF NOT EXISTS issue_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT,
    image_url VARCHAR(255),
    status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`).catch(console.error);
pool.query('ALTER TABLE issue_reports MODIFY id INT AUTO_INCREMENT').catch(e => { /* ignore if fails */ });
pool.query('ALTER TABLE issue_reports ADD COLUMN image_url VARCHAR(255)').catch(e => { /* ignore if exists */ });
pool.query('ALTER TABLE issue_reports ADD COLUMN message TEXT').catch(e => { /* ignore if exists */ });

// ── Auto-fix inventory tables: ensure id is AUTO_INCREMENT ──────────────────
pool.query(`ALTER TABLE users ADD COLUMN last_active DATETIME NULL`).catch(e => console.log('users last_active fix:', e.message));
pool.query(`ALTER TABLE inventory_products MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`).catch(e => console.log('inventory_products id fix:', e.message));
pool.query(`ALTER TABLE inventory_models MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`).catch(e => console.log('inventory_models id fix:', e.message));
pool.query(`ALTER TABLE inventory_items MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`).catch(e => console.log('inventory_items id fix:', e.message));
pool.query(`ALTER TABLE inventory_logs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`).catch(e => console.log('inventory_logs id fix:', e.message));
pool.query(`ALTER TABLE job_logs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`).catch(e => console.log('job_logs id fix:', e.message));
pool.query(`ALTER TABLE job_completion_images MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`).catch(e => console.log('job_completion_images id fix:', e.message));
pool.query(`ALTER TABLE entry_fees MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`).catch(e => console.log('entry_fees id fix:', e.message));

// ── Auto-migrate columns ───────────────────────
pool.query(`ALTER TABLE jobs MODIFY COLUMN install_device TEXT`).catch(() => {});

pool.query(`
  CREATE TABLE IF NOT EXISTS team_oil_cases (
    team_id INT PRIMARY KEY,
    year_month VARCHAR(7) NOT NULL,
    case_count INT DEFAULT 0
  )
`).catch(() => {});

// ── Entry Fee upgrade: 3 modes (slip/cash/backdate) ─────────
pool.query(`ALTER TABLE entry_fees ADD COLUMN fee_type ENUM('slip','cash','backdate') NOT NULL DEFAULT 'slip'`).catch(() => {});
pool.query(`ALTER TABLE entry_fees ADD COLUMN backdate DATE NULL`).catch(() => {});
pool.query(`ALTER TABLE customers ADD COLUMN entry_fee_status VARCHAR(50) NULL`).catch(() => {});
pool.query(`ALTER TABLE customers ADD COLUMN entry_fee_date DATETIME NULL`).catch(() => {});

// ── Background Jobs (Cron) ───────────────────────────────────
require('./cron/reminders');

// ── 404 handler ─────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 BOU API running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

module.exports = app;
