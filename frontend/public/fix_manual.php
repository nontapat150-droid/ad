<?php
header('Content-Type: application/json');
$backend = '/home/zvucfpsz/public_html/backend';
$lp = $backend . '/error_log.txt';
$log = file_exists($lp) ? substr(file_get_contents($lp), -5000) : 'no log';
echo json_encode(['error_log' => $log]);
?>
