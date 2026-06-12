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
    $node_log = file_exists('/home/zvucfpsz/repositories/ad/backend/error_log.txt') ? substr(file_get_contents('/home/zvucfpsz/repositories/ad/backend/error_log.txt'), -5000) : 'Node log not found';
    echo json_encode(['success' => true, 'node_log' => $node_log, 'restarted' => $restart]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
