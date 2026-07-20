const admin = require('firebase-admin');
const { getMessaging } = require('firebase-admin/messaging');
const path = require('path');
const fs = require('fs');
const pool = require('./db');

let fcmSchemaReady = false;
let fcmSchemaPromise = null;

/** Ensure user_fcm_tokens exists (was missing from DB migrations). */
async function ensureFcmTokensSchema(db = pool) {
  if (fcmSchemaReady) return;
  if (fcmSchemaPromise) return fcmSchemaPromise;

  fcmSchemaPromise = (async () => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_fcm_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fcm_token VARCHAR(512) NOT NULL,
        device_info VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_fcm_token (fcm_token),
        KEY idx_user_fcm_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    fcmSchemaReady = true;
  })().catch((err) => {
    fcmSchemaPromise = null;
    throw err;
  });

  return fcmSchemaPromise;
}

// ── Initialize Firebase Admin ───────────────────────────────
const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
let firebaseInitialized = false;
let messagingInstance = null;

try {
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    const app = admin.initializeApp({
      credential: admin.cert(serviceAccount),
    });
    messagingInstance = getMessaging(app);
    firebaseInitialized = true;
    console.log('✅ Firebase Admin SDK initialized');
  } else {
    console.warn('⚠️  Firebase service account key not found at:', serviceAccountPath);
    console.warn('   Push notifications will not work. Please add the service account JSON file.');
  }
} catch (err) {
  console.error('❌ Firebase Admin SDK initialization failed:', err.message);
}

// ── Send Push Notification to a single FCM token ────────────
// Removed getFavicon to prevent unused code warnings

async function sendPushNotification(fcmToken, title, body, data = {}) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized — skipping push notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const origin = process.env.FRONTEND_ORIGIN || 'https://bonusais.com';
    const linkPath = data?.path && String(data.path).startsWith('/')
      ? String(data.path).replace(/^\/dispatch/, '/dispatch-dashboard')
      : '';
    const link = linkPath ? `${origin}${linkPath}` : undefined;

    const message = {
      token: fcmToken,
      notification: {
        title: title || 'การแจ้งเตือนใหม่',
        body: body || ''
      },
      data: {
        title: title || 'การแจ้งเตือนใหม่',
        body: body || '',
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          icon: '/favicon.ico',
          vibrate: [200, 100, 200],
        },
        fcmOptions: link ? { link } : undefined,
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10',
        },
        payload: {
          aps: {
            sound: 'default',
            'content-available': 1
          }
        }
      }
    };

    const response = await messagingInstance.send(message);
    console.log('✅ Push notification sent:', response);
    return { success: true, messageId: response };
  } catch (err) {
    console.error('❌ Push notification failed:', err.message);

    // If token is invalid, remove it from DB
    if (
      err.code === 'messaging/registration-token-not-registered' ||
      err.code === 'messaging/invalid-registration-token'
    ) {
      try {
        await pool.query('DELETE FROM user_fcm_tokens WHERE fcm_token = ?', [fcmToken]);
        console.log('🗑️  Removed invalid FCM token from DB');
      } catch (dbErr) {
        console.error('Failed to remove invalid token:', dbErr.message);
      }
    }

    return { success: false, error: err.message };
  }
}

// ── Send Push Notification to ALL devices of a user ─────────
async function sendToUser(userId, title, body, data = {}) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized — skipping push to user');
    return { success: false, sent: 0 };
  }

  try {
    await ensureFcmTokensSchema();
    const [tokens] = await pool.query(
      'SELECT fcm_token FROM user_fcm_tokens WHERE user_id = ?',
      [userId]
    );

    if (tokens.length === 0) {
      console.log(`No FCM tokens found for user ${userId}`);
      return { success: true, sent: 0 };
    }

    let sent = 0;
    let failed = 0;

    for (const row of tokens) {
      const result = await sendPushNotification(row.fcm_token, title, body, data);
      if (result.success) sent++;
      else failed++;
    }

    console.log(`Push to user ${userId}: ${sent} sent, ${failed} failed`);
    return { success: true, sent, failed };
  } catch (err) {
    console.error('Error sending push to user:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  admin,
  firebaseInitialized,
  ensureFcmTokensSchema,
  sendPushNotification,
  sendToUser,
};
