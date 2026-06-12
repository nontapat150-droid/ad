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
    
    $code = file_get_contents('https://raw.githubusercontent.com/nontapat150-droid/ad/แก้ระบบเช็คอิน/backend/routes/report.js');
    if ($code) {
        file_put_contents('/home/zvucfpsz/repositories/ad/backend/routes/report.js', $code);
        file_put_contents('/home/zvucfpsz/backend/routes/report.js', $code);
    }
    $restart = shell_exec('cd /home/zvucfpsz/repositories/ad/backend && touch tmp/restart.txt && pkill -f node 2>&1');
    echo json_encode(['success' => true, 'wrote' => strlen($code)]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
