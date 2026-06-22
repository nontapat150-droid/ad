const pool = require('./backend/config/db');
pool.query("SHOW COLUMNS FROM inventory_items LIKE 'status'")
  .then(r => { console.log(r[0]); process.exit(0); })
  .catch(console.error);
