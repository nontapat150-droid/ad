const pool = require('./backend/config/db');

async function test() {
  try {
    const [models] = await pool.query('SELECT id, product_id, model_name, image_url FROM inventory_models WHERE image_url IS NOT NULL ORDER BY id DESC LIMIT 5');
    console.log('Models with image_url:');
    console.table(models);
    
    const [products] = await pool.query('SELECT id, name, image_url FROM inventory_products WHERE image_url IS NOT NULL ORDER BY id DESC LIMIT 5');
    console.log('Products with image_url:');
    console.table(products);

  } catch(err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}
test();
