const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { syncCustomerFromJob } = require('../utils/customerSync');

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

    // Fix inventory_items and add phone_number
    try {
      await pool.query(`ALTER TABLE inventory_items MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`);
      results.push('✅ inventory_items.id -> AUTO_INCREMENT fixed');
    } catch(e) {
      results.push('inventory_items: ' + e.message);
    }
    try {
      await pool.query(`ALTER TABLE inventory_items ADD COLUMN phone_number VARCHAR(50) NULL`);
      results.push('✅ inventory_items.phone_number added');
    } catch(e) {
      results.push('inventory_items.phone_number: ' + e.message);
    }

    // Fix inventory_logs
    try {
      await pool.query(`ALTER TABLE inventory_logs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`);
      results.push('✅ inventory_logs.id -> AUTO_INCREMENT fixed');
    } catch(e) {
      results.push('inventory_logs: ' + e.message);
    }

    // Widen install_device to TEXT (pipe-separated device string exceeds VARCHAR(150))
    try {
      await pool.query(`ALTER TABLE jobs MODIFY COLUMN install_device TEXT DEFAULT NULL`);
      results.push('✅ jobs.install_device -> TEXT');
    } catch(e) {
      results.push('jobs.install_device: ' + e.message);
    }

    // customers master table (office install)
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          access_no VARCHAR(50) NOT NULL,
          customer_name VARCHAR(150) DEFAULT NULL,
          phone VARCHAR(100) DEFAULT NULL,
          address TEXT DEFAULT NULL,
          province VARCHAR(100) DEFAULT NULL,
          area_code VARCHAR(50) DEFAULT NULL,
          area_name VARCHAR(150) DEFAULT NULL,
          lat DECIMAL(10,8) DEFAULT NULL,
          lng DECIMAL(11,8) DEFAULT NULL,
          map_link TEXT DEFAULT NULL,
          package VARCHAR(150) DEFAULT NULL,
          product VARCHAR(150) DEFAULT NULL,
          order_no VARCHAR(50) DEFAULT NULL,
          customer_order_no VARCHAR(50) DEFAULT NULL,
          task_type VARCHAR(50) DEFAULT NULL,
          task_order VARCHAR(50) DEFAULT NULL,
          product_owner VARCHAR(150) DEFAULT NULL,
          order_type VARCHAR(100) DEFAULT NULL,
          service_note TEXT DEFAULT NULL,
          sla_status VARCHAR(50) DEFAULT NULL,
          region VARCHAR(50) DEFAULT NULL,
          latest_job_id INT DEFAULT NULL,
          latest_job_status VARCHAR(50) DEFAULT NULL,
          install_device TEXT DEFAULT NULL,
          last_completed_at DATETIME DEFAULT NULL,
          completed_by INT DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_customers_access_no (access_no),
          KEY idx_customers_job (latest_job_id),
          CONSTRAINT customers_fk_job FOREIGN KEY (latest_job_id) REFERENCES jobs(id) ON DELETE SET NULL,
          CONSTRAINT customers_fk_completed_by FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push('✅ customers table created');
    } catch(e) {
      results.push('customers: ' + e.message);
    }

    // job_used_inventory — devices installed from tech bag
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS job_used_inventory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          job_id INT NOT NULL,
          inventory_item_id INT NOT NULL,
          device_role ENUM('SOA','ONU','PB','Mesh','SIM','Cam') NOT NULL,
          sn VARCHAR(255) DEFAULT NULL,
          product_name VARCHAR(255) DEFAULT NULL,
          model_name VARCHAR(255) DEFAULT NULL,
          quantity DECIMAL(10,2) DEFAULT 1.00,
          used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          used_by INT DEFAULT NULL,
          KEY idx_jui_job (job_id),
          KEY idx_jui_item (inventory_item_id),
          CONSTRAINT jui_fk_job FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
          CONSTRAINT jui_fk_item FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
          CONSTRAINT jui_fk_user FOREIGN KEY (used_by) REFERENCES users(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push('✅ job_used_inventory table created');
    } catch(e) {
      results.push('job_used_inventory: ' + e.message);
    }

    // inventory_items.status — add 'used'
    try {
      await pool.query(`ALTER TABLE inventory_items MODIFY COLUMN status ENUM('in_stock','staging','dispatched','expired','used') DEFAULT 'in_stock'`);
      results.push('✅ inventory_items.status -> added used');
    } catch(e) {
      results.push('inventory_items.status: ' + e.message);
    }

    // inventory_logs — add 'used' action + note column
    try {
      await pool.query(`ALTER TABLE inventory_logs MODIFY COLUMN action ENUM('receive','dispatch','transfer','expire','used') NOT NULL`);
      results.push('✅ inventory_logs.action -> added used');
    } catch(e) {
      results.push('inventory_logs.action: ' + e.message);
    }
    try {
      await pool.query(`ALTER TABLE inventory_logs ADD COLUMN note TEXT DEFAULT NULL`);
      results.push('✅ inventory_logs.note added');
    } catch(e) {
      results.push('inventory_logs.note: ' + e.message);
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

// ─── One-time migration: entry_fees upgrade ─────────────────
router.get('/migrate-entry-fee', async (req, res) => {
  const results = [];
  try {
    try {
      await pool.query(`ALTER TABLE entry_fees MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY`);
      results.push('✅ entry_fees.id -> AUTO_INCREMENT PRIMARY KEY added');
    } catch(e) {
      try {
        await pool.query(`ALTER TABLE entry_fees MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT`);
        results.push('✅ entry_fees.id -> AUTO_INCREMENT added');
      } catch(e2) {
        results.push('entry_fees.id: ' + e2.message);
      }
    }

    try {
      await pool.query(`ALTER TABLE entry_fees ADD COLUMN fee_type ENUM('slip','cash','backdate') NOT NULL DEFAULT 'slip'`);
      results.push('✅ entry_fees.fee_type added');
    } catch(e) { results.push('entry_fees.fee_type: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE entry_fees ADD COLUMN backdate DATE NULL`);
      results.push('✅ entry_fees.backdate added');
    } catch(e) { results.push('entry_fees.backdate: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE entry_fees ADD COLUMN network_provider ENUM('AIS', '3BB') NOT NULL DEFAULT 'AIS'`);
      results.push('✅ entry_fees.network_provider added');
    } catch(e) { results.push('entry_fees.network_provider: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE customers ADD COLUMN entry_fee_status VARCHAR(50) NULL`);
      results.push('✅ customers.entry_fee_status added');
    } catch(e) { results.push('customers.entry_fee_status: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE customers ADD COLUMN entry_fee_date DATETIME NULL`);
      results.push('✅ customers.entry_fee_date added');
    } catch(e) { results.push('customers.entry_fee_date: ' + e.message); }

    try {
      await pool.query(`UPDATE entry_fees SET fee_type = 'cash' WHERE image_path = 'รับหน้างาน'`);
      results.push('✅ entry_fees update legacy cash values');
    } catch(e) { results.push('entry_fees update legacy: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE oil_records ADD COLUMN is_trip BOOLEAN DEFAULT FALSE`);
      results.push('✅ oil_records.is_trip added');
    } catch(e) { results.push('oil_records.is_trip: ' + e.message); }

    // ── Inventory unit & crate conversion ──
    try {
      await pool.query(`ALTER TABLE inventory_products ADD COLUMN unit VARCHAR(50) DEFAULT 'ชิ้น'`);
      results.push('✅ inventory_products.unit added');
    } catch(e) { results.push('inventory_products.unit: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE inventory_products ADD COLUMN pieces_per_crate INT DEFAULT NULL`);
      results.push('✅ inventory_products.pieces_per_crate added');
    } catch(e) { results.push('inventory_products.pieces_per_crate: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE inventory_products ADD COLUMN crate_unit VARCHAR(50) DEFAULT 'ลัง'`);
      results.push('✅ inventory_products.crate_unit added');
    } catch(e) { results.push('inventory_products.crate_unit: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE messages ADD COLUMN is_automated BOOLEAN DEFAULT FALSE`);
      results.push('✅ messages.is_automated added');
    } catch(e) { results.push('messages.is_automated: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE customers ADD COLUMN fail_reason TEXT NULL`);
      results.push('✅ customers.fail_reason added');
    } catch(e) { results.push('customers.fail_reason: ' + e.message); }

    res.json({ success: true, results });
  } catch(err) {
    res.status(500).json({ error: err.message, results });
  }
});

// ─── Backfill customers from existing jobs ─────────────────
router.get('/backfill-customers', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const [jobs] = await conn.query('SELECT id FROM jobs WHERE access_no IS NOT NULL ORDER BY id ASC');
    let synced = 0;
    for (const { id } of jobs) {
      await syncCustomerFromJob(conn, id);
      synced++;
    }
    res.json({ success: true, synced });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// ─── One-time migration: add category to inventory_products ─────────────────
router.get('/migrate-category', async (req, res) => {
  const results = [];
  try {
    try {
      await pool.query(`ALTER TABLE inventory_products ADD COLUMN category VARCHAR(100) DEFAULT NULL`);
      results.push('✅ inventory_products.category added');
    } catch(e) { results.push('inventory_products.category: ' + e.message); }

    res.json({ success: true, results });
  } catch(err) {
    res.status(500).json({ error: err.message, results });
  }
});

// ─── One-time migration: add image_url and category metadata ─────────────────
router.get('/migrate-images', async (req, res) => {
  const results = [];
  try {
    try {
      await pool.query(`ALTER TABLE inventory_products ADD COLUMN image_url TEXT DEFAULT NULL`);
      results.push('✅ inventory_products.image_url added');
    } catch(e) { results.push('inventory_products.image_url: ' + e.message); }

    try {
      await pool.query(`CREATE TABLE IF NOT EXISTS inventory_category_metadata (
        category_name VARCHAR(100) PRIMARY KEY,
        image_url TEXT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      results.push('✅ inventory_category_metadata table created');
    } catch(e) { results.push('inventory_category_metadata: ' + e.message); }

    try {
      await pool.query(`ALTER TABLE inventory_models ADD COLUMN image_url TEXT DEFAULT NULL`);
      results.push('✅ inventory_models.image_url added');
    } catch(e) { results.push('inventory_models.image_url: ' + e.message); }

    res.json({ success: true, results });
  } catch(err) {
    res.status(500).json({ error: err.message, results });
  }
});

module.exports = router;
