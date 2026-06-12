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
const reportRouter = require('./routes/report');

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
apiRouter.use('/settings', require('./routes/settings'));
apiRouter.use('/report', reportRouter);

// เพื่อแก้ปัญหา cPanel Passenger ตัด /api ออก
app.use('/api', apiRouter);
app.use('/', apiRouter);

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

// ── Initialize DB & Start ────────────────────────────────────
const pool = require('./config/db');

async function initDB() {
  try {
    const query = `
      CREATE TABLE IF NOT EXISTS reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        image_path VARCHAR(255),
        status ENUM('pending', 'in_progress', 'resolved') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `;
    await pool.query(query);
    console.log('✅ Checked database tables (reports)');
  } catch (err) {
    console.error('❌ Failed to check/create database tables:', err);
  }
}

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 BOU API running at http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
});

module.exports = app;
