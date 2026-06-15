const mysql = require('mysql2/promise');
require('dotenv').config({path: '../.env'});
async function run() {
  const p = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });
  try {
    const [t] = await p.query("SELECT id, team_name FROM teams WHERE team_name LIKE '%6%'");
    console.log('Teams:', t);
    const [o] = await p.query("SELECT id, date_recorded FROM oil_records WHERE license_plate LIKE '%6%'");
    console.log('Oil records:', o.length);
  } catch(e) {
    console.error(e);
  }
  process.exit();
}
run();
