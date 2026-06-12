<?php
header('Content-Type: application/json');
set_time_limit(10);

$backend = '/home/zvucfpsz/public_html/backend';

// Read latest error log
$lp = $backend . '/error_log.txt';
$log = file_exists($lp) ? substr(file_get_contents($lp), -3000) : 'no log';

// Check multer installed
$multer_path = '/home/zvucfpsz/nodevenv/public_html/backend/20/lib/node_modules/multer';
$has_multer = is_dir($multer_path);

$multer_local = $backend . '/node_modules/multer';
$has_multer_local = is_dir($multer_local);

// Check uploads writable
$uploads = $backend . '/uploads/reports';
shell_exec("mkdir -p $uploads && chmod 755 $uploads");
$writable = is_writable($uploads);

// Read POST handler (lines 65-86)
$rp = $backend . '/routes/report.js';
$lines = file($rp);
$post_section = implode('', array_slice($lines, 64, 25));

echo json_encode([
    'error_log_tail' => $log,
    'multer_global' => $has_multer,
    'multer_local' => $has_multer_local,
    'uploads_writable' => $writable,
    'post_handler' => $post_section,
], JSON_PRETTY_PRINT);
?>
