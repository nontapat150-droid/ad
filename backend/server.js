require('./config/env');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// ── GLOBAL CRASH LOGGER FOR z.com ──
const logFile = path.join(__dirname, 'startup_debug.log');
fs.appendFileSync(logFile, `\n[${new Date().toISOString()}] === SERVER STARTING ===\n`);
process.on('uncaughtException', (err) => {
  fs.appendFileSync(logFile, `[UNCAUGHT EXCEPTION] ${err.stack || err}\n`);
});
process.on('unhandledRejection', (reason) => {
  fs.appendFileSync(logFile, `[UNHANDLED REJECTION] ${reason.stack || reason}\n`);
});

const pool = require('./config/db');
const { tryAcquireCronLeader } = require('./utils/cronLeader');

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
const fcmRouter = require('./routes/fcm');
const scheduledMessagesRouter = require('./routes/scheduledMessages');

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
app.use('/api/uploads', express.static(uploadDir)); // Fallback for PM2/Nginx proxy setups

// ── Health Check ────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const db = await pool.checkConnection()
    .catch((err) => ({
      ok: false,
      ...pool.getConnectionInfo(),
      error: pool.formatError(err),
    }));

  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'ok' : 'db_unavailable',
    service: 'BOU Operations API',
    version: '1.0.0',
    ts: new Date().toISOString(),
    db,
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
apiRouter.use('/notifications', require('./routes/notifications'));
apiRouter.use('/announcements', announcementsRouter);
apiRouter.use('/reports', require('./routes/reports'));
apiRouter.use('/settings', require('./routes/settings'));
apiRouter.use('/migrate', migrateRouter);
apiRouter.use('/upload', require('./routes/upload'));
apiRouter.use('/fcm', fcmRouter);
apiRouter.use('/scheduled-messages', scheduledMessagesRouter);


// เพื่อแก้ปัญหา cPanel Passenger ตัด /api ออก
app.use('/api', apiRouter);
app.use('/', apiRouter);

async function startBackgroundJobs() {
  if (process.env.ENABLE_CRON === 'false') {
    console.log('Background jobs disabled (ENABLE_CRON=false)');
    return;
  }

  if (!tryAcquireCronLeader()) {
    console.log('Background jobs skipped — another worker is cron leader');
    return;
  }

  try {
    await pool.checkConnection();
  } catch (err) {
    console.error('Background jobs skipped — DB unavailable:', pool.formatError(err));
    return;
  }

  require('./cron/reminders');

  try {
    const { loadSchedules } = require('./scheduler');
    await loadSchedules();
  } catch (err) {
    console.error('Failed to start automated messages scheduler:', err.message);
  }
}

startBackgroundJobs();

async function ensureAppSchema() {
  try {
    await pool.checkConnection();
    const { ensureNotificationsSchema } = require('./utils/notifyEvent');
    await ensureNotificationsSchema();
    console.log('✅ notifications schema ready');
  } catch (err) {
    console.error('App schema bootstrap failed:', pool.formatError(err));
  }
}

ensureAppSchema();

function shutdown(signal) {
  console.log(`Shutting down (${signal})`);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

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
const listenPort = process.env.PORT || PORT;
if (process.env.PASSENGER_APP_ENV) {
  app.listen('passenger');
} else {
  app.listen(listenPort, () => {
    console.log(`\n🚀 BOU API running on port ${listenPort}\n`);
  });
}

module.exports = app;
