require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const fs       = require('fs');

// ── Route Modules ───────────────────────────────────────────
const authRouter      = require('./routes/auth');
const checkinRouter   = require('./routes/checkin');
const dispatchRouter  = require('./routes/dispatch');
const inventoryRouter = require('./routes/inventory');
const oilRouter       = require('./routes/oil');
const usersRouter     = require('./routes/users');
const statsRouter     = require('./routes/stats');
const messagesRouter  = require('./routes/messages');
const announcementsRouter = require('./routes/announcements');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Ensure uploads folder exists ────────────────────────────
const uploadDir = path.join(__dirname, process.env.UPLOAD_DIR || 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin:      process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// ── Health Check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'BOU Operations API',
    version: '1.0.0',
    ts:      new Date().toISOString(),
  });
});

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/checkin',   checkinRouter);
app.use('/api/dispatch',  dispatchRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/oil',       oilRouter);
app.use('/api/users',     usersRouter);
app.use('/api/stats',     statsRouter);
app.use('/api/messages',  messagesRouter);
app.use('/api/announcements', announcementsRouter);
app.use('/api/settings',  require('./routes/settings'));

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
