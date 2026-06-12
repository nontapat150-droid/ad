<?php
header('Content-Type: application/json');
set_time_limit(10);

$output = [];

// Find all possible backend paths
$paths_to_check = [
    '/home/zvucfpsz/repositories/ad/backend',
    '/home/zvucfpsz/backend',
    '/home/zvucfpsz/public_html/backend',
    '/home/zvucfpsz/repositories/backend',
];

foreach ($paths_to_check as $p) {
    $output['path_exists'][$p] = file_exists($p);
    if (file_exists($p . '/routes/report.js')) {
        $lines = file($p . '/routes/report.js');
        $output['path_exists'][$p . '/routes/report.js'] = 'EXISTS - line4: ' . (isset($lines[3]) ? trim($lines[3]) : 'n/a');
    }
    if (file_exists($p . '/server.js')) {
        $output['path_exists'][$p . '/server.js'] = 'EXISTS';
    }
}

// Also find node process and its working dir
$node_proc = shell_exec('ps aux | grep node 2>&1');
$output['node_proc'] = $node_proc;

// Find where server.js actually is
$find_server = shell_exec('find /home/zvucfpsz -name "server.js" 2>/dev/null');
$output['find_server_js'] = $find_server;

// Read DB to check reports table structure
$host = 'localhost';
$db   = 'zvucfpsz_RT';
$user = 'zvucfpsz_BO';
$pass = '@2*]BC9AuGO^%P&-';
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $cols = $pdo->query("DESCRIBE reports")->fetchAll(PDO::FETCH_ASSOC);
    $output['reports_columns'] = array_column($cols, 'Field');
    
    // Try a test query like the one in report.js
    $test = $pdo->query("SELECT r.*, u.full_name, t.name AS team_name FROM reports r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN teams t ON u.team_id = t.id LIMIT 1")->fetchAll();
    $output['test_query'] = 'OK - rows: ' . count($test);
} catch (Exception $e) {
    $output['db_error'] = $e->getMessage();
}

echo json_encode($output, JSON_PRETTY_PRINT);
?>
