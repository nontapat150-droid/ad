const fs = require('fs');
const path = require('path');

const LOCK_PATH = path.join(__dirname, '..', 'tmp', '.cron_leader.lock');

/**
 * Ensure only one Node worker runs in-process cron (Passenger/lsnode spawns many).
 */
function tryAcquireCronLeader() {
  const dir = path.dirname(LOCK_PATH);
  fs.mkdirSync(dir, { recursive: true });

  if (fs.existsSync(LOCK_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
      process.kill(existing.pid, 0);
      return false;
    } catch {
      try { fs.unlinkSync(LOCK_PATH); } catch { /* stale lock */ }
    }
  }

  try {
    const fd = fs.openSync(LOCK_PATH, 'wx');
    fs.writeSync(fd, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
    fs.closeSync(fd);
  } catch {
    return false;
  }

  const release = () => {
    try {
      const cur = JSON.parse(fs.readFileSync(LOCK_PATH, 'utf8'));
      if (cur.pid === process.pid) fs.unlinkSync(LOCK_PATH);
    } catch { /* ignore */ }
  };

  process.on('exit', release);
  process.on('SIGTERM', release);
  process.on('SIGINT', release);
  return true;
}

module.exports = { tryAcquireCronLeader };
