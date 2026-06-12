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
    
    $git = shell_exec('cd /home/zvucfpsz/repositories/ad && git fetch --all && git reset --hard origin/แก้ระบบเช็คอิน && git pull 2>&1');
    $restart = shell_exec('cd /home/zvucfpsz/repositories/ad/backend && touch tmp/restart.txt 2>&1');
    echo json_encode(['success' => true, 'git' => $git, 'restart' => $restart]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
