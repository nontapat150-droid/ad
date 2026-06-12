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
    
    $logPath = __DIR__ . '/../../backend/error_log.txt';
    $logContent = file_exists($logPath) ? file_get_contents($logPath) : 'Log not found';
    echo json_encode(['success' => true, 'log' => $logContent]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
