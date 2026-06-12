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

    // Read error log
    $node_log = '';
    $log_paths = [
        '/home/zvucfpsz/repositories/ad/backend/error_log.txt',
        '/home/zvucfpsz/backend/error_log.txt',
    ];
    foreach ($log_paths as $lp) {
        if (file_exists($lp)) {
            $node_log .= "=== $lp ===\n" . substr(file_get_contents($lp), -3000) . "\n";
        }
    }

    // Also check if report.js has syntax issues by reading it
    $report_js = '';
    $rp = '/home/zvucfpsz/repositories/ad/backend/routes/report.js';
    if (file_exists($rp)) {
        $report_js = file_get_contents($rp);
    }

    // Check server.js for port
    $server_js = '';
    $sp = '/home/zvucfpsz/repositories/ad/backend/server.js';
    if (file_exists($sp)) {
        $server_js = file_get_contents($sp);
    }

    // Check db.js config
    $db_js = '';
    $dp = '/home/zvucfpsz/repositories/ad/backend/config/db.js';
    if (file_exists($dp)) {
        $db_js = file_get_contents($dp);
    }

    // Check env
    $env_content = '';
    $ep = '/home/zvucfpsz/repositories/ad/backend/.env';
    if (file_exists($ep)) {
        $env_content = file_get_contents($ep);
    }

    echo json_encode([
        'success' => true,
        'node_log' => $node_log ?: 'No log files found',
        'report_js_head' => substr($report_js, 0, 500),
        'server_js_head' => substr($server_js, 0, 500),
        'db_js' => $db_js,
        'env' => $env_content,
    ]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
