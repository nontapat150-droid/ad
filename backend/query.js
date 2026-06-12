const pool = require('./config/db');

async function test() {
  try {
    const [rows] = await pool.query('SHOW CREATE TABLE ma_jobs');
    console.log(rows[0]['Create Table']);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

test();
