const pool = require('../config/db');
const { sendToUser } = require('../config/firebase-admin');

let schemaReady = false;
let schemaPromise = null;

/**
 * Ensure notifications inbox table exists (idempotent, hosting-safe).
 */
async function ensureNotificationsSchema(db = pool) {
  if (schemaReady) return;
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    // Prefer FK when allowed; fall back without FK on shared hosting.
    const baseDdl = `
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        event_key VARCHAR(190) NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'system',
        title VARCHAR(255) NOT NULL,
        body TEXT NULL,
        data_json LONGTEXT NULL,
        actor_id INT NULL,
        is_read TINYINT(1) NOT NULL DEFAULT 0,
        read_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_notifications_user_event (user_id, event_key),
        KEY idx_notifications_user_unread (user_id, is_read, created_at),
        KEY idx_notifications_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

    try {
      await db.query(`${baseDdl},
        CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`);
    } catch (err) {
      const fkBlocked =
        err.code === 'ER_CANNOT_ADD_FOREIGN'
        || err.code === 'ER_FK_INCOMPATIBLE_COLUMNS'
        || err.errno === 1005
        || err.errno === 1215
        || err.errno === 3780
        || /foreign key/i.test(String(err.message || ''));
      if (fkBlocked) {
        await db.query(`${baseDdl})`);
      } else if (err.code !== 'ER_TABLE_EXISTS_ERROR') {
        throw err;
      }
    }

    schemaReady = true;
  })().catch((err) => {
    schemaPromise = null;
    throw err;
  });

  return schemaPromise;
}

function normalizeRecipients(recipients, defaultTitle, defaultBody) {
  const list = [];
  const seen = new Set();

  for (const r of recipients || []) {
    let userId;
    let title = defaultTitle;
    let body = defaultBody;

    if (r == null) continue;
    if (typeof r === 'number' || typeof r === 'string') {
      userId = parseInt(r, 10);
    } else {
      userId = parseInt(r.userId ?? r.user_id ?? r.id, 10);
      if (r.title) title = r.title;
      if (r.body) body = r.body;
    }

    if (!userId || !Number.isFinite(userId) || seen.has(userId)) continue;
    seen.add(userId);
    list.push({ userId, title: title || 'แจ้งเตือน', body: body || '' });
  }

  return list;
}

/**
 * Event-driven notify: 1 event_key × 1 user = at most one inbox row + one push.
 *
 * @param {object} opts
 * @param {string} opts.eventKey  Unique key for this event (e.g. job.created:123:team:5)
 * @param {number|null} [opts.actorId]  Actor is skipped as recipient
 * @param {string} opts.title
 * @param {string} [opts.body]
 * @param {string} [opts.type='system']
 * @param {object} [opts.data]  Extra payload for deep links / FCM data
 * @param {Array<number|{userId,title?,body?}>} opts.recipients
 * @param {boolean} [opts.push=true]
 */
async function notifyEvent({
  eventKey,
  actorId = null,
  title,
  body = '',
  type = 'system',
  data = {},
  recipients = [],
  push = true,
} = {}) {
  if (!eventKey || !String(eventKey).trim()) {
    console.warn('notifyEvent: missing eventKey — skipped');
    return { inserted: 0, skipped: 0, pushed: 0, error: 'missing_event_key' };
  }

  try {
    await ensureNotificationsSchema();
  } catch (err) {
    console.error('notifyEvent schema error:', err.message);
    return { inserted: 0, skipped: 0, pushed: 0, error: err.message };
  }

  const actor = actorId != null ? parseInt(actorId, 10) : null;
  const list = normalizeRecipients(recipients, title, body).filter(
    (r) => !actor || r.userId !== actor
  );

  const results = { inserted: 0, skipped: 0, pushed: 0, ids: [] };
  const dataJson = JSON.stringify(data && typeof data === 'object' ? data : {});

  for (const r of list) {
    try {
      const [ins] = await pool.query(
        `INSERT IGNORE INTO notifications
           (user_id, event_key, type, title, body, data_json, actor_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          r.userId,
          String(eventKey).slice(0, 190),
          String(type || 'system').slice(0, 50),
          String(r.title || 'แจ้งเตือน').slice(0, 255),
          r.body || '',
          dataJson,
          actor || null,
        ]
      );

      if (!ins.affectedRows) {
        results.skipped += 1;
        continue;
      }

      results.inserted += 1;
      results.ids.push(ins.insertId);

      if (push) {
        const fcmData = {
          type: String(type || 'system'),
          event_key: String(eventKey),
          notification_id: String(ins.insertId),
          ...Object.fromEntries(
            Object.entries(data || {}).map(([k, v]) => [k, v == null ? '' : String(v)])
          ),
        };
        sendToUser(r.userId, r.title, r.body, fcmData)
          .then((res) => {
            if (res?.sent) results.pushed += res.sent;
          })
          .catch((e) => console.error('notifyEvent push failed:', e.message));
      }
    } catch (err) {
      console.error(`notifyEvent failed for user ${r.userId}:`, err.message);
    }
  }

  return results;
}

/**
 * Resolve approved user ids for a team (optional role filter via SQL fragment not needed in phase 1).
 */
async function getTeamMemberIds(teamId, { excludeUserId = null } = {}) {
  if (!teamId) return [];
  const [rows] = await pool.query(
    `SELECT id FROM users WHERE team_id = ? AND status = 'approved'`,
    [teamId]
  );
  return rows
    .map((r) => r.id)
    .filter((id) => !excludeUserId || Number(id) !== Number(excludeUserId));
}

async function getAdminIds() {
  const [rows] = await pool.query(
    `SELECT DISTINCT u.id FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     WHERE u.status = 'approved'
       AND (u.role IN ('super_admin','admin') OR ur.role IN ('super_admin','admin'))`
  );
  return rows.map((r) => r.id);
}

module.exports = {
  ensureNotificationsSchema,
  notifyEvent,
  getTeamMemberIds,
  getAdminIds,
};
