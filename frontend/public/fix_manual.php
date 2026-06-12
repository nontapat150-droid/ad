<?php
header('Content-Type: application/json');
$backend = '/home/zvucfpsz/public_html/backend';

shell_exec('pkill -9 -f "node" 2>&1');
shell_exec('kill -9 $(pgrep -f node) 2>&1');
@mkdir($backend . '/tmp', 0755, true);
touch($backend . '/tmp/restart.txt');

echo json_encode(['restarted' => true]);
?>
