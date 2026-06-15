const pool = require('./config/db');

async function checkSchema() {
  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM inventory_products');
    console.log('Columns in inventory_products:');
    console.table(cols);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
checkSchema();
