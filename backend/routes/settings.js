const express = require('express');
const pool = require('../config/db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// ── GET /api/settings/targets — Get global targets ───────────────
router.get('/targets', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('ma_target_days', 'ma_target_jobs', 'target_tech_jobs', 'allowed_late_days')`
    );
    
    // Default values if not set
    const targets = {
      ma_target_days: 26,
      ma_target_jobs: 130,
      target_tech_jobs: 50,
      allowed_late_days: 0
    };

    rows.forEach(r => {
      targets[r.setting_key] = parseInt(r.setting_value) || 0;
    });

    res.json(targets);
  } catch (err) {
    console.error('Get targets error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/settings/targets — Update targets (Admin) ─────────
router.put('/targets', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(req.user.role);
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updates = req.body;
    const allowedKeys = ['ma_target_days', 'ma_target_jobs', 'target_tech_jobs', 'allowed_late_days'];

    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        const val = updates[key].toString();
        // insert or update
        const [existing] = await pool.query(`SELECT setting_key FROM system_settings WHERE setting_key = ?`, [key]);
        if (existing.length > 0) {
          await pool.query(`UPDATE system_settings SET setting_value = ? WHERE setting_key = ?`, [val, key]);
        } else {
          await pool.query(`INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)`, [key, val]);
        }
      }
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Update targets error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const { upload, setUpload } = require('../middleware/upload');
const fs = require('fs');
const path = require('path');

// ── GET /api/settings/global — Get public global settings (no auth required) ───────────────
router.get('/global', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT setting_key, setting_value FROM system_settings 
       WHERE setting_key IN ('website_name', 'website_logo', 'website_favicon', 'firebase_web_config', 'admin_phone', 'admin_line')`
    );
    
    const settings = {
      website_name: 'Bount ระบบจัดการงาน',
      website_logo: null,
      website_favicon: null,
      firebase_web_config: null,
      admin_phone: null,
      admin_line: null,
    };

    rows.forEach(r => {
      settings[r.setting_key] = r.setting_value;
    });

    res.json(settings);
  } catch (err) {
    console.error('Get global settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── GET /api/settings/firebase-config.js — Serve dynamic JS config ───────────────
router.get('/firebase-config.js', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'firebase_web_config'`
    );
    
    // Default fallback config if none is in the DB
    let configStr = JSON.stringify({
      apiKey: "AIzaSyDPrfWpTT1P51w5VguDMgNWXsUFcHSOXK4",
      authDomain: "notification-35907.firebaseapp.com",
      projectId: "notification-35907",
      storageBucket: "notification-35907.firebasestorage.app",
      messagingSenderId: "233471687863",
      appId: "1:233471687863:web:44db15f5a11c8bd26e2132",
      measurementId: "G-CQJ710ZM01",
      vapidKey: "BIwdBYoZYhw3qu3rKCge84TffrgAEkP1iEAltSAdtxegiQVZqmRWBbudvOMjJVG1fnJnYl5a4Z2LpYz5I1P6fSA"
    }, null, 2);

    if (rows.length > 0 && rows[0].setting_value) {
      try {
        // Validate it's proper JSON before using
        JSON.parse(rows[0].setting_value);
        configStr = rows[0].setting_value;
      } catch (e) {
        console.error('Invalid JSON in firebase_web_config DB setting');
      }
    }

    res.setHeader('Content-Type', 'application/javascript');
    // window.FIREBASE_CONFIG is for the React app, const firebaseConfig is for the Service Worker
    res.send(`
      if (typeof window !== 'undefined') {
        window.FIREBASE_CONFIG = ${configStr};
      }
      const firebaseConfig = ${configStr};
    `);
  } catch (err) {
    console.error('Get firebase config js error:', err);
    res.status(500).send('console.error("Server error loading firebase config");');
  }
});

// ── POST /api/settings/branding — Update branding settings (Admin) ─────────
router.post('/branding', auth, setUpload('branding'), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]), async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(req.user.role);
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { website_name, firebase_web_config, admin_phone, admin_line } = req.body;
    const updates = {};
    if (website_name !== undefined) updates.website_name = website_name;
    if (firebase_web_config !== undefined) updates.firebase_web_config = firebase_web_config;
    if (admin_phone !== undefined) updates.admin_phone = String(admin_phone).trim();
    if (admin_line !== undefined) updates.admin_line = String(admin_line).trim();

    if (req.files) {
      if (req.files.logo && req.files.logo.length > 0) {
        updates.website_logo = `/uploads/branding/${req.files.logo[0].filename}`;
      }
      if (req.files.favicon && req.files.favicon.length > 0) {
        updates.website_favicon = `/uploads/branding/${req.files.favicon[0].filename}`;
      }
    }

    for (const [key, val] of Object.entries(updates)) {
      const [existing] = await pool.query(`SELECT setting_key FROM system_settings WHERE setting_key = ?`, [key]);
      if (existing.length > 0) {
        await pool.query(`UPDATE system_settings SET setting_value = ? WHERE setting_key = ?`, [val, key]);
      } else {
        await pool.query(`INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)`, [key, val]);
      }
    }

    res.json({ message: 'Branding updated successfully', updates });
  } catch (err) {
    console.error('Update branding error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

const FREQUENT_NO_SN_KEY = 'frequent_no_sn_config';
const DEFAULT_FREQUENT_NO_SN = { product_ids: [], roles: [] };

async function ensureSettingsValueText(poolConn) {
  try {
    await poolConn.query('ALTER TABLE system_settings MODIFY setting_value TEXT NOT NULL');
  } catch { /* already TEXT or no permission */ }
}

async function upsertSetting(key, value) {
  await ensureSettingsValueText(pool);
  const [existing] = await pool.query(
    'SELECT setting_key FROM system_settings WHERE setting_key = ?',
    [key]
  );
  if (existing.length > 0) {
    await pool.query(
      'UPDATE system_settings SET setting_value = ? WHERE setting_key = ?',
      [value, key]
    );
  } else {
    await pool.query(
      'INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)',
      [key, value]
    );
  }
}

// ── GET /api/settings/frequent-no-sn — Auto-lock no-SN products on job complete ─
router.get('/frequent-no-sn', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT setting_value FROM system_settings WHERE setting_key = ? LIMIT 1',
      [FREQUENT_NO_SN_KEY]
    );
    let config = { ...DEFAULT_FREQUENT_NO_SN };
    if (rows.length && rows[0].setting_value) {
      try {
        const parsed = JSON.parse(rows[0].setting_value);
        config = {
          product_ids: Array.isArray(parsed.product_ids)
            ? parsed.product_ids.map((id) => parseInt(id, 10)).filter((n) => n > 0)
            : [],
          roles: Array.isArray(parsed.roles)
            ? parsed.roles.map((r) => String(r).trim()).filter(Boolean)
            : [],
        };
      } catch { /* keep default */ }
    }
    res.json(config);
  } catch (err) {
    console.error('Get frequent-no-sn error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── PUT /api/settings/frequent-no-sn — Admin configures frequent no-SN locks ─
router.put('/frequent-no-sn', auth, async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.some((r) => ['super_admin', 'admin'].includes(r))
      || ['super_admin', 'admin'].includes(req.user.role);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const productIds = Array.isArray(req.body.product_ids)
      ? [...new Set(req.body.product_ids.map((id) => parseInt(id, 10)).filter((n) => n > 0))]
      : [];
    const roleList = Array.isArray(req.body.roles)
      ? [...new Set(req.body.roles.map((r) => String(r).trim()).filter(Boolean))]
      : [];

    const config = { product_ids: productIds, roles: roleList };
    await upsertSetting(FREQUENT_NO_SN_KEY, JSON.stringify(config));
    res.json({ message: 'บันทึกการตั้งค่าอุปกรณ์ที่ใช้บ่อยแล้ว', ...config });
  } catch (err) {
    console.error('Update frequent-no-sn error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

module.exports = router;
