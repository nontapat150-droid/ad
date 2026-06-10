const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function run() {
  try {
    const sqlPath = path.join(__dirname, 'create_announcements_table.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
    console.log('✅ announcements table created successfully!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error creating table:', err);
    process.exit(1);
  }
}

run();
