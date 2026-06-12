<?php
header('Content-Type: application/json');
set_time_limit(10);

$output = [];

// Check actual backend path (we know it's public_html/backend)
$backend = '/home/zvucfpsz/public_html/backend';

// Read error_log
$lp = $backend . '/error_log.txt';
$output['error_log'] = file_exists($lp) ? substr(file_get_contents($lp), -3000) : 'no file';

// Check uploads dir
$uploads = $backend . '/uploads/reports';
$output['uploads_dir_exists'] = is_dir($uploads);
$output['uploads_writable'] = is_writable($backend . '/uploads') || is_writable(dirname($backend . '/uploads'));

// Create uploads dir if missing
if (!is_dir($uploads)) {
    $made = mkdir($uploads, 0755, true);
    $output['created_uploads'] = $made;
}
if (is_dir($uploads)) {
    chmod($uploads, 0755);
    $output['uploads_dir_now'] = 'exists';
}

// Read report.js lines 60-90 to see POST handler
$rp = $backend . '/routes/report.js';
if (file_exists($rp)) {
    $lines = file($rp);
    $output['report_js_lines_60_90'] = implode('', array_slice($lines, 59, 30));
    $output['report_js_line4'] = isset($lines[3]) ? trim($lines[3]) : 'n/a';
} else {
    $output['report_js'] = 'NOT FOUND at ' . $rp;
}

// Test INSERT query directly
$host = 'localhost';
$db   = 'zvucfpsz_RT';
$user = 'zvucfpsz_BO';
$pass = '@2*]BC9AuGO^%P&-';
try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    // Test SELECT (fixed query)
    $sel = $pdo->query("SELECT r.*, u.full_name, t.team_name FROM reports r LEFT JOIN users u ON r.user_id = u.id LEFT JOIN teams t ON u.team_id = t.id LIMIT 1")->fetchAll();
    $output['test_select'] = 'OK rows=' . count($sel);
    
    // Test INSERT
    $stmt = $pdo->prepare("INSERT INTO reports (user_id, title, description, image_path, status) VALUES (?, ?, ?, ?, 'pending')");
    $stmt->execute([1, 'test', 'test desc', null]);
    $id = $pdo->lastInsertId();
    $output['test_insert'] = 'OK id=' . $id;
    // Clean up test row
    $pdo->exec("DELETE FROM reports WHERE id = $id");
    $output['test_cleanup'] = 'OK';
} catch (Exception $e) {
    $output['db_error'] = $e->getMessage();
}

echo json_encode($output, JSON_PRETTY_PRINT);
?>
