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
    
    $api = shell_exec('curl -s -i http://127.0.0.1:5000/api/report 2>&1');
    $api2 = shell_exec('curl -s -i https://bonusais.com/api/report 2>&1');
    $pkill = shell_exec('pkill -f node 2>&1');
    echo json_encode(['success' => true, 'api_local' => $api, 'api_remote' => $api2, 'pkill' => $pkill]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
