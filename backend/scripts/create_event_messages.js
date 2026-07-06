const pool = require('../config/db');

async function createTable() {
  try {
    console.log('Creating event_messages table...');
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS event_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        event_key VARCHAR(50) NOT NULL UNIQUE,
        event_label VARCHAR(100) NOT NULL,
        message_template TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        target_role VARCHAR(50) DEFAULT 'all',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // Seed standard events if they don't exist
    const standardEvents = [
      {
        key: 'job_dispatch',
        label: 'เมื่อมีการจ่ายงาน (Dispatch Job)',
        template: 'มีงานใหม่เข้ามา: {job_id}\\nผู้ปฏิบัติงาน: {tech_name}\\nรายละเอียด: {description}',
        role: 'tech'
      },
      {
        key: 'check_in',
        label: 'เมื่อพนักงานเช็คอิน (Check-in)',
        template: 'พนักงาน {tech_name} ได้เช็คอินที่: {location}\\nเวลานัด: {appointment_time}',
        role: 'admin'
      },
      {
        key: 'oil_record',
        label: 'เมื่อมีการบันทึกค่าน้ำมัน (Oil Record)',
        template: 'มีการบันทึกค่าน้ำมันใหม่โดย {tech_name}\\nจำนวนเงิน: {amount} บาท',
        role: 'admin'
      },
      {
        key: 'inventory_dispatch',
        label: 'เมื่อมีการเบิกอะไหล่ (Inventory Dispatch)',
        template: 'มีการเบิกอะไหล่โดย {tech_name}\\nรายการ: {items}',
        role: 'admin'
      }
    ];

    for (const evt of standardEvents) {
      const [existing] = await pool.execute('SELECT id FROM event_messages WHERE event_key = ?', [evt.key]);
      if (existing.length === 0) {
        await pool.execute(
          'INSERT INTO event_messages (event_key, event_label, message_template, target_role) VALUES (?, ?, ?, ?)',
          [evt.key, evt.label, evt.template, evt.role]
        );
        console.log(`Seeded event: ${evt.key}`);
      }
    }

    console.log('Table event_messages created and seeded successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error creating table:', err);
    process.exit(1);
  }
}

createTable();
