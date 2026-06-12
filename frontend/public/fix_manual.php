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
    
    $htaccess = shell_exec('cat /home/zvucfpsz/public_html/bonusais.com/.htaccess 2>&1');
    $ftp_routes = shell_exec('ls -la /home/zvucfpsz/backend/routes/ 2>&1');
    $ftp_server = shell_exec('cat /home/zvucfpsz/backend/server.js 2>&1 | grep report');
    echo json_encode(['success' => true, 'htaccess' => $htaccess, 'ftp_routes' => $ftp_routes, 'ftp_server' => $ftp_server]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
