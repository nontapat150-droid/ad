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

    const values = [];
    for (const key of allowedKeys) {
      if (updates[key] !== undefined) {
        values.push([key, updates[key].toString()]);
      }
    }
    if (values.length > 0) {
      await pool.query(
        `INSERT INTO system_settings (setting_key, setting_value) VALUES ? 
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`, 
        [values]
      );
    }

    res.json({ message: 'Settings updated successfully' });
  } catch (err) {
    console.error('Update targets error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
