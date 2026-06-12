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

    // Check tables in zvucfpsz_RT
    $tables_rt = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);

    // Check if reports table exists in zvucfpsz_RT
    $reports_exists_rt = in_array('reports', $tables_rt);

    // Check reports table structure if exists
    $reports_columns = [];
    if ($reports_exists_rt) {
        $reports_columns = $pdo->query("DESCRIBE reports")->fetchAll();
    }

    // Read current server report.js
    $rp = '/home/zvucfpsz/repositories/ad/backend/routes/report.js';
    $report_js = file_exists($rp) ? file_get_contents($rp) : 'NOT FOUND';

    // Read .env
    $ep = '/home/zvucfpsz/repositories/ad/backend/.env';
    $env = file_exists($ep) ? file_get_contents($ep) : 'NOT FOUND';

    // Read error log
    $node_log = '';
    foreach (['/home/zvucfpsz/repositories/ad/backend/error_log.txt', '/home/zvucfpsz/backend/error_log.txt'] as $lp) {
        if (file_exists($lp)) {
            $node_log .= "=== $lp ===\n" . substr(file_get_contents($lp), -3000) . "\n";
        }
    }

    echo json_encode([
        'db_name' => 'zvucfpsz_RT',
        'tables' => $tables_rt,
        'reports_exists' => $reports_exists_rt,
        'reports_columns' => $reports_columns,
        'env' => $env,
        'report_js_first_10_lines' => implode("\n", array_slice(explode("\n", $report_js), 0, 10)),
        'node_log' => $node_log ?: 'No log files found',
    ]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
