const pool = require('../backend/config/db');

async function run() {
  try {
    console.log('Running ALTER TABLE...');
    await pool.query(`
      ALTER TABLE jobs 
      ADD COLUMN plan_arrival_time DATETIME DEFAULT NULL AFTER plan_arrival_date,
      ADD COLUMN field_engineer_id INT(11) DEFAULT NULL AFTER address,
      ADD COLUMN reject_reason TEXT DEFAULT NULL AFTER field_engineer_id,
      ADD COLUMN task_status VARCHAR(50) DEFAULT NULL AFTER reject_reason,
      ADD COLUMN called_assigner VARCHAR(150) DEFAULT 'None Call' AFTER order_no,
      ADD COLUMN called_engineer VARCHAR(150) DEFAULT 'None Call' AFTER called_assigner,
      ADD COLUMN product_owner VARCHAR(150) DEFAULT NULL AFTER task_order,
      ADD COLUMN order_type VARCHAR(100) DEFAULT NULL AFTER product_owner,
      ADD COLUMN install_device VARCHAR(150) DEFAULT NULL AFTER order_type,
      ADD COLUMN service_note TEXT DEFAULT NULL AFTER install_device,
      ADD COLUMN sub_access_mode VARCHAR(100) DEFAULT 'N/A' AFTER service_note,
      ADD COLUMN region VARCHAR(50) DEFAULT 'ROS' AFTER sub_access_mode,
      ADD COLUMN customer_order_no VARCHAR(50) DEFAULT NULL AFTER task_type,
      ADD COLUMN contract_team VARCHAR(255) DEFAULT 'หจก.โบนัส แอดว้านซ์ (สุราษฎร์ธานี)#Bonus Advance (Surat Thani) - AISPM_Install_Bonus Advance_Bonus Advance (Surat Thani)_1002136_FTH,PLB' AFTER customer_order_no,
      ADD COLUMN team_product_owner VARCHAR(150) DEFAULT NULL AFTER contract_team,
      ADD COLUMN province VARCHAR(100) DEFAULT NULL AFTER team_product_owner,
      ADD COLUMN task_duration VARCHAR(50) DEFAULT NULL AFTER province,
      ADD COLUMN sla_status VARCHAR(50) DEFAULT 'Normal' AFTER task_duration,
      ADD COLUMN create_time DATETIME DEFAULT NULL AFTER sla_status,
      ADD COLUMN deadline DATETIME DEFAULT NULL AFTER create_time,
      ADD COLUMN set_off_time DATETIME DEFAULT NULL AFTER deadline,
      ADD COLUMN arrival_time DATETIME DEFAULT NULL AFTER set_off_time,
      ADD COLUMN finish_time DATETIME DEFAULT NULL AFTER arrival_time,
      ADD COLUMN area_code VARCHAR(50) DEFAULT NULL AFTER finish_time,
      ADD COLUMN area_name VARCHAR(150) DEFAULT NULL AFTER area_code,
      ADD COLUMN processing_status VARCHAR(50) DEFAULT NULL AFTER area_name,
      ADD COLUMN create_user_role VARCHAR(50) DEFAULT NULL AFTER processing_status,
      ADD COLUMN fail_reason TEXT DEFAULT NULL AFTER create_user_role,
      ADD COLUMN event VARCHAR(150) DEFAULT NULL AFTER fail_reason,
      ADD COLUMN service_level VARCHAR(100) DEFAULT NULL AFTER event,
      ADD COLUMN type_of_installation VARCHAR(100) DEFAULT NULL AFTER service_level,
      ADD COLUMN reason_sync_system_failed TEXT DEFAULT NULL AFTER type_of_installation;
    `);
    
    // access_no might already have a UNIQUE key if we applied it from the previous session's checklist!
    // But in the node output for DESCRIBE it wasn't marked as UNIQUE. It had Key: ''. 
    // Let's add them via IGNORE to prevent crashing if they exist
    try { await pool.query('ALTER TABLE jobs ADD UNIQUE KEY uq_access_no (access_no);'); } catch(e) { console.log(e.message) }
    try { await pool.query('ALTER TABLE jobs ADD UNIQUE KEY uq_customer_order_no (customer_order_no);'); } catch(e) { console.log(e.message) }
    
    console.log('ALTER TABLE SUCCESSFUL.');
  } catch (err) {
    console.error('Migration Error:', err.message);
  } finally {
    process.exit(0);
  }
}
run();
