<?php
header('Content-Type: application/json');
$backend = '/home/zvucfpsz/public_html/backend';

// Hard restart node
shell_exec('pkill -9 -f "node" 2>&1');
shell_exec('kill -9 $(pgrep -f node) 2>&1');
@mkdir($backend . '/tmp', 0755, true);
touch($backend . '/tmp/restart.txt');

// Read error logs
$lp = $backend . '/error_log.txt';
$log = file_exists($lp) ? substr(file_get_contents($lp), -5000) : 'no log';

// Check if report.js has the new multer handling (verify deploy success)
$rp = $backend . '/routes/report.js';
$report_content = file_exists($rp) ? file_get_contents($rp) : '';
$has_new_code = strpos($report_content, 'POST /api/report multer error') !== false;

echo json_encode([
    'restarted' => true,
    'deploy_success' => $has_new_code,
    'error_log' => $log
]);
?>
