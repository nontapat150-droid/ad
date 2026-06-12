const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'zvucfpsz_BO',
    password: process.env.DB_PASSWORD || '@2*]BC9AuGO^%P&-',
    database: process.env.DB_NAME || 'zvucfpsz_RT',
    port: process.env.DB_PORT || 3306,
  });

  try {
    const [teams] = await connection.query('SELECT * FROM teams WHERE name LIKE "%5%"');
    console.log('Teams:', teams);

    const [users] = await connection.query('SELECT id, username, full_name, team_id FROM users WHERE team_id IN (SELECT id FROM teams WHERE name LIKE "%5%") OR team_id=5');
    console.log('Users in team 5:', users);

    // Let's also check if there are oil records with team 5 (maybe filler_name)
    const [oil] = await connection.query(`
      SELECT o.*, u.full_name, t.name as team_name 
      FROM oil_records o 
      LEFT JOIN users u ON o.tech_id = u.id 
      LEFT JOIN teams t ON u.team_id = t.id 
      WHERE t.name LIKE "%5%" OR o.filler_name LIKE "%5%"
    `);
    console.log('Oil records:', oil);

  } catch (error) {
    console.error(error);
  } finally {
    await connection.end();
  }
}

run();
