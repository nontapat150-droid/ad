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
       WHERE setting_key IN ('website_name', 'website_logo', 'website_favicon')`
    );
    
    const settings = {
      website_name: 'Bount ระบบจัดการงาน',
      website_logo: null,
      website_favicon: null
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

// ── POST /api/settings/branding — Update branding settings (Admin) ─────────
router.post('/branding', auth, setUpload('branding'), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'favicon', maxCount: 1 }]), async (req, res) => {
  try {
    const roles = req.user.roles || [];
    const isAdmin = roles.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(req.user.role);
    
    if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { website_name } = req.body;
    const updates = {};
    if (website_name !== undefined) updates.website_name = website_name;

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

module.exports = router;
