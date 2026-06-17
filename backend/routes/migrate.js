const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// ─── One-time migration: fix inventory tables AUTO_INCREMENT ─────────────────
router.get('/migrate-fix', async (req, res) => {
  const results = [];
  try {
    // Fix inventory_products: ensure id is AUTO_INCREMENT PRIMARY KEY
    try {
      await pool.query(`ALTER TABLE inventory_products MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`);
      results.push('✅ inventory_products.id -> AUTO_INCREMENT fixed');
    } catch(e) {
      results.push('inventory_products: ' + e.message);
    }
    
    // Add last_active to users
    try {
      await pool.query(`ALTER TABLE users ADD COLUMN last_active DATETIME NULL`);
      results.push('✅ users.last_active added');
    } catch(e) {
      results.push('users.last_active: ' + e.message);
    }

    // Fix inventory_models
    try {
      await pool.query(`ALTER TABLE inventory_models MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`);
      results.push('✅ inventory_models.id -> AUTO_INCREMENT fixed');
    } catch(e) {
      results.push('inventory_models: ' + e.message);
    }

    // Fix inventory_items
    try {
      await pool.query(`ALTER TABLE inventory_items MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`);
      results.push('✅ inventory_items.id -> AUTO_INCREMENT fixed');
    } catch(e) {
      results.push('inventory_items: ' + e.message);
    }

    // Fix inventory_logs
    try {
      await pool.query(`ALTER TABLE inventory_logs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`);
      results.push('✅ inventory_logs.id -> AUTO_INCREMENT fixed');
    } catch(e) {
      results.push('inventory_logs: ' + e.message);
    }

    // Show current structure of inventory_products
    const [cols] = await pool.query('SHOW CREATE TABLE inventory_products');
    results.push('');
    results.push('inventory_products structure:');
    results.push(cols[0]['Create Table'] || JSON.stringify(cols[0]));

    res.json({ success: true, results });
  } catch(err) {
    res.status(500).json({ error: err.message, results });
  }
});

module.exports = router;
