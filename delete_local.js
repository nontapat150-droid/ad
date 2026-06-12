const mysql = require('mysql2/promise');
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'zvucfpsz_RT', // or whatever their local db is named, wait, db.js says zvucfpsz_RT but uses env! Let's require db.js!
};

async function run() {
  const pool = require('./backend/config/db');
  try {
    const conn = await pool.getConnection();
    
    // 1. Find the team named "ทีม 5"
    const [teams] = await conn.query("SELECT id FROM teams WHERE team_name = 'ทีม 5'");
    if (teams.length > 0) {
      const teamId = teams[0].id;
      console.log('Found team 5 with ID:', teamId);
      await conn.query("UPDATE users SET team_id = NULL WHERE team_id = ?", [teamId]);
      await conn.query("DELETE FROM teams WHERE id = ?", [teamId]);
      console.log('Deleted team 5 from teams table.');
    } else {
      console.log('Team 5 not found in teams table.');
    }

    // 2. Delete oil records where license_plate is "ทีม 5"
    const [result] = await conn.query("DELETE FROM oil_records WHERE license_plate LIKE '%ทีม 5%' OR filler_name LIKE '%ทีม 5%'");
    console.log('Deleted oil records:', result.affectedRows);

    conn.release();
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
run();
