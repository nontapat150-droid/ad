<?php
header('Content-Type: application/json');
$src = '/home/zvucfpsz/public_html/backend/uploads/reports';
$dest = '/home/zvucfpsz/public_html/uploads/reports';

@mkdir($dest, 0755, true);

$moved = [];
if (is_dir($src)) {
    $files = scandir($src);
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..') {
            rename("$src/$file", "$dest/$file");
            $moved[] = $file;
        }
    }
}

// Restart node as well
$backend = '/home/zvucfpsz/public_html/backend';
shell_exec('pkill -9 -f "node" 2>&1');
shell_exec('kill -9 $(pgrep -f node) 2>&1');
@mkdir($backend . '/tmp', 0755, true);
touch($backend . '/tmp/restart.txt');

echo json_encode([
    'moved_files' => $moved,
    'dest_exists' => is_dir($dest),
    'node_restarted' => true
]);
?>
