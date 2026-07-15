require('dotenv').config({path: './.env'});
const mysql = require('mysql2/promise');

async function recalculateOilData(conn, targetPlate = null) {
  console.log("Starting recalculate...");
  let query = `SELECT id, license_plate, mileage, total_price, is_trip, date_recorded FROM oil_records`;
  const queryParams = [];
  
  if (targetPlate) {
    query += ` WHERE REPLACE(LOWER(license_plate), ' ', '') = ?`;
    queryParams.push(targetPlate.replace(/\s+/g, '').toLowerCase());
  }
  
  const [records] = await conn.query(query, queryParams);
  console.log("Fetched records:", records.length);
  if (records.length === 0) return;

  records.sort((a, b) => {
    const plateA = (a.license_plate || '').replace(/\s+/g, '').toLowerCase();
    const plateB = (b.license_plate || '').replace(/\s+/g, '').toLowerCase();
    if (plateA !== plateB) return plateA.localeCompare(plateB);
    
    let timeA = new Date(a.date_recorded || 0).getTime();
    let timeB = new Date(b.date_recorded || 0).getTime();
    if (isNaN(timeA)) timeA = 0;
    if (isNaN(timeB)) timeB = 0;
    if (timeA !== timeB) return timeA - timeB;
    
    return (a.id || 0) - (b.id || 0);
  });

  let lastMileageByPlate = {};
  const batchValues = [];

  for (const record of records) {
    const plate = record.license_plate ? record.license_plate.replace(/\s+/g, '').toLowerCase() : 'unknown';
    let distance = 0;
    
    const rawMileage = String(record.mileage || '').replace(/,/g, '');
    const currentMileage = parseFloat(rawMileage) || 0;

    if (lastMileageByPlate[plate] !== undefined) {
      distance = currentMileage - lastMileageByPlate[plate];
      if (isNaN(distance) || distance < 0) distance = 0;
    }
    lastMileageByPlate[plate] = currentMileage;

    const rawTotalPrice = String(record.total_price || '').replace(/,/g, '');
    const totalPrice = parseFloat(rawTotalPrice) || 0;
    const bahtPerKm = distance > 0 ? (totalPrice / distance).toFixed(2) : 0;
    batchValues.push([distance, parseFloat(bahtPerKm) || 0, record.id]);
  }
  
  console.log("Batch values to update:", batchValues.length);
  const CHUNK_SIZE = 500;
  for (let i = 0; i < batchValues.length; i += CHUNK_SIZE) {
    const chunk = batchValues.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map(v => v[2]).join(',');
    const cases_dist = chunk.map(v => `WHEN ${v[2]} THEN ${v[0]}`).join(' ');
    const cases_bpk = chunk.map(v => `WHEN ${v[2]} THEN ${v[1]}`).join(' ');

    const sql = `UPDATE oil_records SET distance = CASE id ${cases_dist} END, baht_per_km = CASE id ${cases_bpk} END WHERE id IN (${ids})`;
    try {
      await conn.query(sql);
      console.log(`Updated chunk ${i} to ${i + CHUNK_SIZE}`);
    } catch(err) {
      console.error("SQL Error in chunk:", err.message);
    }
  }
  console.log("Done.");
}

async function run() {
  let pool;
  try {
    pool = mysql.createPool({
      host: process.env.DB_HOST || '127.0.0.1',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'test',
    });
    const conn = await pool.getConnection();
    await recalculateOilData(conn);
    conn.release();
    process.exit(0);
  } catch (err) {
    console.error("Connection Error:", err.message);
    process.exit(1);
  }
}
run();
