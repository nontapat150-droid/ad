const pool = require('./backend/config/db');

async function test() {
  try {
    const [cols] = await pool.query('SHOW COLUMNS FROM inventory_products');
    console.log('Columns in inventory_products:');
    console.table(cols);
    
    // Try inserting
    try {
      const [res] = await pool.query('INSERT INTO inventory_products (name, has_sn, prefix) VALUES (?, ?, ?)', ['TEST_PRODUCT', true, null]);
      console.log('Insert success:', res.insertId);
      await pool.query('DELETE FROM inventory_products WHERE id = ?', [res.insertId]);
    } catch(e) {
      console.error('Insert error:', e.message);
    }

  } catch(err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
test();
