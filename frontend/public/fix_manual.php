<?php
header('Content-Type: application/json');

$host = 'localhost';
$db   = 'zvucfpsz_RT';
$user = 'zvucfpsz_BO';
$pass = '@2*]BC9AuGO^%P&-';

$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    
    $code = file_get_contents('/home/zvucfpsz/repositories/ad/backend/routes/report.js');
    $code = str_replace(
        "res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });",
        "try { require('fs').appendFileSync(__dirname + '/../error_log.txt', new Date().toISOString() + ' POST /api/report: ' + error.stack + '\\n\\n'); } catch(e) {}\n    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', details: error.message });",
        $code
    );
    file_put_contents('/home/zvucfpsz/repositories/ad/backend/routes/report.js', $code);
    file_put_contents('/home/zvucfpsz/backend/routes/report.js', $code);
    
    $restart = shell_exec('cd /home/zvucfpsz/repositories/ad/backend && touch tmp/restart.txt && pkill -f node 2>&1');
    $js = "
const mysql = require('mysql2/promise');
async function test() {
    const pool = mysql.createPool({
        host: 'localhost',
        user: 'bonusais_usr',
        password: 'U%i0T6H^Q%zW',
        database: 'bonusais_db'
    });
    try {
        const [rows] = await pool.query('SHOW TABLES');
        console.log(JSON.stringify(rows));
        process.exit(0);
    } catch(e) {
        console.error(e.message);
        process.exit(1);
    }
}
test();
";
    file_put_contents('/home/zvucfpsz/repositories/ad/backend/test_db.js', $js);
    $code = file_get_contents('/home/zvucfpsz/repositories/ad/backend/server.js');
    $code = str_replace(
        "res.status(500).send('Something broke!');",
        "try { require('fs').appendFileSync(__dirname + '/error_log.txt', new Date().toISOString() + ' GLOBAL ERROR: ' + err.stack + '\\n\\n'); } catch(e) {}\n  res.status(500).json({ error: 'Something broke!', details: err.message, stack: err.stack });",
        $code
    );
    file_put_contents('/home/zvucfpsz/repositories/ad/backend/server.js', $code);
    file_put_contents('/home/zvucfpsz/backend/server.js', $code);
    
    $restart = shell_exec('cd /home/zvucfpsz/repositories/ad/backend && touch tmp/restart.txt && pkill -f node 2>&1');
    $node_log = file_exists('/home/zvucfpsz/repositories/ad/backend/error_log.txt') ? substr(file_get_contents('/home/zvucfpsz/repositories/ad/backend/error_log.txt'), -5000) : 'Node log not found';
    echo json_encode(['success' => true, 'node_log' => $node_log]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
