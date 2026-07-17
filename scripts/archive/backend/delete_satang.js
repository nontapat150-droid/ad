const pool = require('./config/db');

async function deleteSatang() {
  try {
    const [result] = await pool.query("DELETE FROM oil_records WHERE license_plate = 'สตางค์'");
    console.log(`Deleted ${result.affectedRows} records with license_plate = 'สตางค์'`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

deleteSatang();
