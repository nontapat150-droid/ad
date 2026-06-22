/**
 * Run Entry Fee Migration
 * Usage: node scripts/run_entry_fee_migration.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function run() {
  const sqlPath = path.join(__dirname, 'migrate_entry_fee_upgrade.sql');
  const sqlRaw = fs.readFileSync(sqlPath, 'utf8');

  // Strip comment lines and empty lines, then split by semicolons
  const sql = sqlRaw
    .split('\n')
    .map(line => line.replace(/--.*$/, '').trim())
    .join('\n');

  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`\n🚀 Running Entry Fee migration (${statements.length} statements)...\n`);

  let success = 0;
  let skipped = 0;

  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      console.log(`  ✅ ${stmt.substring(0, 60).replace(/\n/g, ' ')}...`);
      success++;
    } catch (e) {
      if (e.message.includes('Duplicate column name')) {
        console.log(`  ⏭️  Skipped (already exists): ${stmt.substring(0, 50).replace(/\n/g, ' ')}...`);
        skipped++;
      } else {
        console.error(`  ❌ Error: ${e.message}`);
      }
    }
  }

  console.log(`\n✅ Migration complete! ${success} applied, ${skipped} skipped.\n`);
  process.exit(0);
}

run().catch(e => { console.error('Migration failed:', e); process.exit(1); });
