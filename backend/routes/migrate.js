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

    // Fix role column to VARCHAR(50) for users and user_roles to support new roles
    try {
      await pool.query(`ALTER TABLE users MODIFY COLUMN role VARCHAR(50)`);
      results.push('✅ users.role -> VARCHAR(50) fixed');
    } catch(e) {
      results.push('users.role: ' + e.message);
    }

    try {
      await pool.query(`ALTER TABLE user_roles MODIFY COLUMN role VARCHAR(50)`);
      results.push('✅ user_roles.role -> VARCHAR(50) fixed');
    } catch(e) {
      results.push('user_roles.role: ' + e.message);
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
          device_role ENUM('SOA','ONU','PB','Mesh','SIM','Cam','NoSN','TechBag') NOT NULL,
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

    // Widen device_role for existing DBs (NoSN + TechBag used by bag equipment)
    try {
      await pool.query(`
        ALTER TABLE job_used_inventory
        MODIFY COLUMN device_role ENUM('SOA','ONU','PB','Mesh','SIM','Cam','NoSN','TechBag') NOT NULL
      `);
      results.push('✅ job_used_inventory.device_role -> added NoSN, TechBag');
    } catch(e) {
      results.push('job_used_inventory.device_role: ' + e.message);
    }

    // ma_job_used_inventory — equipment used when completing MA jobs
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ma_job_used_inventory (
          id INT AUTO_INCREMENT PRIMARY KEY,
          ma_job_id INT NOT NULL,
          inventory_item_id INT NOT NULL,
          device_role VARCHAR(50) DEFAULT 'NoSN',
          sn VARCHAR(255) DEFAULT NULL,
          product_name VARCHAR(255) DEFAULT NULL,
          model_name VARCHAR(255) DEFAULT NULL,
          quantity DECIMAL(10,2) DEFAULT 1.00,
          used_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          used_by INT DEFAULT NULL,
          KEY idx_mjui_job (ma_job_id),
          KEY idx_mjui_item (inventory_item_id),
          KEY idx_mjui_used_by (used_by),
          KEY idx_mjui_used_at (used_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push('✅ ma_job_used_inventory table created');
    } catch(e) {
      results.push('ma_job_used_inventory: ' + e.message);
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

    // job_audit_logs — central audit trail for office/MA job actions
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS job_audit_logs (
          id BIGINT AUTO_INCREMENT PRIMARY KEY,
          job_type ENUM('office','ma') NOT NULL,
          job_id INT NOT NULL,
          action VARCHAR(50) NOT NULL,
          old_status VARCHAR(50) DEFAULT NULL,
          new_status VARCHAR(50) DEFAULT NULL,
          old_team_id INT DEFAULT NULL,
          new_team_id INT DEFAULT NULL,
          old_assignee_id INT DEFAULT NULL,
          new_assignee_id INT DEFAULT NULL,
          actor_id INT DEFAULT NULL,
          remark TEXT DEFAULT NULL,
          meta_json JSON DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          KEY idx_jal_job (job_type, job_id),
          KEY idx_jal_actor (actor_id),
          KEY idx_jal_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push('✅ job_audit_logs table created');
    } catch(e) {
      results.push('job_audit_logs: ' + e.message);
    }

    // user_import_aliases — shared Excel engineer aliases
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS user_import_aliases (
          id INT AUTO_INCREMENT PRIMARY KEY,
          job_type ENUM('office','ma','any') NOT NULL DEFAULT 'any',
          normalized_alias VARCHAR(150) NOT NULL,
          user_id INT DEFAULT NULL,
          team_id INT DEFAULT NULL,
          created_by INT DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_alias (job_type, normalized_alias),
          KEY idx_uia_user (user_id),
          KEY idx_uia_team (team_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push('✅ user_import_aliases table created');
    } catch(e) {
      results.push('user_import_aliases: ' + e.message);
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
      const { ensureNotificationsSchema } = require('../utils/notifyEvent');
      await ensureNotificationsSchema(pool);
      results.push('✅ notifications table ensured');
    } catch(e) { results.push('notifications: ' + e.message); }

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

// ─── One-time migration: add job completion detail columns ─────────────────
// เพิ่มคอลัมน์แยกสำหรับข้อมูลจบงาน (split_no, port_no, l3_name, cable_length, ref_id_3bb, sc_blue)
// ซึ่งก่อนหน้านี้ถูกเก็บรวมกันใน install_device string เท่านั้น
router.get('/migrate-job-completion-fields', async (req, res) => {
  const results = [];
  try {
    // jobs table — add separate completion columns
    const jobColumns = [
      { col: 'split_no',    def: `VARCHAR(100) DEFAULT NULL COMMENT 'หมายเลข Splitt'` },
      { col: 'port_no',     def: `VARCHAR(100) DEFAULT NULL COMMENT 'ใช้ Port หมายเลข'` },
      { col: 'l3_name',     def: `VARCHAR(150) DEFAULT NULL COMMENT 'ชื่อ L3'` },
      { col: 'cable_length',def: `DECIMAL(10,2) DEFAULT NULL COMMENT 'ระยะสายจริง (เมตร)'` },
      { col: 'ref_id_3bb',  def: `VARCHAR(100) DEFAULT NULL COMMENT 'Ref ID 3BB'` },
      { col: 'sc_blue',     def: `VARCHAR(100) DEFAULT NULL COMMENT 'ตัวต่อ SC สีฟ้า'` },
    ];

    for (const { col, def } of jobColumns) {
      try {
        await pool.query(`ALTER TABLE jobs ADD COLUMN ${col} ${def}`);
        results.push(`✅ jobs.${col} added`);
      } catch(e) { results.push(`jobs.${col}: ${e.message}`); }
    }

    // ma_jobs table — same columns if exists
    const maJobColumns = [
      { col: 'split_no',    def: `VARCHAR(100) DEFAULT NULL` },
      { col: 'port_no',     def: `VARCHAR(100) DEFAULT NULL` },
      { col: 'l3_name',     def: `VARCHAR(150) DEFAULT NULL` },
      { col: 'cable_length',def: `DECIMAL(10,2) DEFAULT NULL` },
      { col: 'ref_id_3bb',  def: `VARCHAR(100) DEFAULT NULL` },
      { col: 'sc_blue',     def: `VARCHAR(100) DEFAULT NULL` },
    ];

    for (const { col, def } of maJobColumns) {
      try {
        await pool.query(`ALTER TABLE ma_jobs ADD COLUMN ${col} ${def}`);
        results.push(`✅ ma_jobs.${col} added`);
      } catch(e) { results.push(`ma_jobs.${col}: ${e.message}`); }
    }

    // Backfill existing completed jobs: parse install_device string → populate new columns
    try {
      const [completedJobs] = await pool.query(
        `SELECT id, install_device FROM jobs WHERE install_device IS NOT NULL AND status = 'completed'`
      );
      let backfilled = 0;
      for (const job of completedJobs) {
        const parts = {};
        for (const segment of (job.install_device || '').split(/[\|\n]/)) {
          const ci = segment.indexOf(':');
          if (ci === -1) continue;
          const key = segment.slice(0, ci).trim();
          const val = segment.slice(ci + 1).trim();
          const map = {
            'Sp': 'split_no', 'Pt': 'port_no', 'L3': 'l3_name',
            'สาย': 'cable_length', '3BB': 'ref_id_3bb', 'SCฟ้า': 'sc_blue',
          };
          if (map[key]) parts[map[key]] = key === 'สาย' ? val.replace(/M$/i, '') : val;
        }
        if (Object.keys(parts).length > 0) {
          const sets = Object.entries(parts).map(([k]) => `${k} = ?`).join(', ');
          await pool.query(
            `UPDATE jobs SET ${sets} WHERE id = ? AND ${Object.keys(parts).map(k => `${k} IS NULL`).join(' AND ')}`,
            [...Object.values(parts), job.id]
          );
          backfilled++;
        }
      }
      results.push(`✅ Backfilled ${backfilled} completed jobs`);
    } catch(e) {
      results.push(`Backfill error: ${e.message}`);
    }

    // package_prices — master monthly package fees
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS package_prices (
          id INT AUTO_INCREMENT PRIMARY KEY,
          package_name VARCHAR(150) NOT NULL,
          monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_package_name (package_name)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push('✅ package_prices table created');
    } catch(e) {
      results.push('package_prices: ' + e.message);
    }

    // installed_customers — registry of successfully installed customers
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS installed_customers (
          id INT AUTO_INCREMENT PRIMARY KEY,
          customer_name VARCHAR(150) NOT NULL,
          non_number VARCHAR(50) NOT NULL,
          package_name VARCHAR(150) NOT NULL,
          monthly_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
          install_date DATE NOT NULL,
          job_id INT DEFAULT NULL,
          status ENUM('active','cancelled') NOT NULL DEFAULT 'active',
          cancelled_at DATE DEFAULT NULL,
          cancel_reason VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_installed_non (non_number),
          KEY idx_install_date (install_date),
          KEY idx_installed_status (status),
          KEY idx_cancelled_at (cancelled_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      results.push('✅ installed_customers table created');
    } catch(e) {
      results.push('installed_customers: ' + e.message);
    }

    res.json({ success: true, results });
  } catch(err) {
    res.status(500).json({ error: err.message, results });
  }
});

// ─── Teams: type / leader / oil flag ─────────────────────────────────────────
router.get('/migrate-teams-types', async (req, res) => {
  const results = [];
  try {
    const { ensureTeamsSchema } = require('../utils/teamsSchema');
    await ensureTeamsSchema(pool);
    results.push('✅ teams schema columns ensured');

    // Infer type from majority member role when still default office_install
    try {
      const [teams] = await pool.query(
        `SELECT t.id,
                SUM(CASE WHEN u.role IN ('technician') OR ur.role = 'technician' THEN 1 ELSE 0 END) AS c_tech,
                SUM(CASE WHEN u.role IN ('ma_technician') OR ur.role = 'ma_technician' THEN 1 ELSE 0 END) AS c_ma,
                SUM(CASE WHEN u.role IN ('contractor_office') OR ur.role = 'contractor_office' THEN 1 ELSE 0 END) AS c_co,
                SUM(CASE WHEN u.role IN ('contractor_ma') OR ur.role = 'contractor_ma' THEN 1 ELSE 0 END) AS c_cm
         FROM teams t
         LEFT JOIN users u ON u.team_id = t.id
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         WHERE t.team_type = 'office_install' OR t.team_type IS NULL
         GROUP BY t.id`
      );
      let updated = 0;
      for (const row of teams) {
        const scores = [
          ['office_install', Number(row.c_tech) || 0],
          ['office_ma', Number(row.c_ma) || 0],
          ['contractor_install', Number(row.c_co) || 0],
          ['contractor_ma', Number(row.c_cm) || 0],
        ];
        scores.sort((a, b) => b[1] - a[1]);
        if (scores[0][1] <= 0) continue;
        const nextType = scores[0][0];
        const oil = nextType.startsWith('contractor') ? 0 : 1;
        await pool.query(
          'UPDATE teams SET team_type = ?, counts_for_oil = ? WHERE id = ?',
          [nextType, oil, row.id]
        );
        updated++;
      }
      results.push(`✅ Inferred team_type for ${updated} teams from members`);
    } catch (e) {
      results.push(`Infer types: ${e.message}`);
    }

    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message, results });
  }
});

module.exports = router;
