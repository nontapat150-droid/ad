<?php
header('Content-Type: application/json');
set_time_limit(30);

$output = [];

// Kill node forcefully
$kill1 = shell_exec('pkill -9 -f "node" 2>&1; echo "done1"');
$output['kill1'] = trim($kill1);

sleep(2);

$kill2 = shell_exec('kill -9 $(pgrep -f node) 2>&1; echo "done2"');
$output['kill2'] = trim($kill2);

sleep(2);

// Touch restart file
$backend = '/home/zvucfpsz/public_html/backend';
@mkdir($backend . '/tmp', 0755, true);
touch($backend . '/tmp/restart.txt');
$output['restart_touched'] = true;

// Verify which version of report.js is on disk now
$lines = file($backend . '/routes/report.js');
$output['line40'] = isset($lines[39]) ? trim($lines[39]) : 'n/a';
$output['line48'] = isset($lines[47]) ? trim($lines[47]) : 'n/a';

// Check if node is still running
sleep(3);
$ps = shell_exec('ps aux | grep node | grep -v grep 2>&1');
$output['node_running'] = trim($ps);

echo json_encode($output, JSON_PRETTY_PRINT);
?>
