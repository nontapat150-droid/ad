<?php
// Restrict restart to requests with RESTART_SECRET (set in hosting env or .htaccess SetEnv)
$secret = getenv('RESTART_SECRET') ?: '';
if ($secret === '' || ($_GET['token'] ?? '') !== $secret) {
    http_response_code(403);
    exit('Forbidden');
}

echo "<h1>Restarting Node.js App...</h1>";

// Try to touch restart.txt in the backend folder
$restart_file = __DIR__ . '/backend/tmp/restart.txt';
$tmp_dir = __DIR__ . '/backend/tmp';

if (!file_exists($tmp_dir)) {
    mkdir($tmp_dir, 0755, true);
}

if (touch($restart_file)) {
    echo "<p style='color:green;'>Successfully requested Node.js restart!</p>";
    echo "<p>Path: $restart_file</p>";
} else {
    echo "<p style='color:red;'>Failed to touch restart file. Permissions issue?</p>";
}

// Try the root just in case
$root_tmp = dirname(__DIR__) . '/tmp';
$root_restart = $root_tmp . '/restart.txt';
if (file_exists(dirname(__DIR__) . '/app.js') || file_exists(dirname(__DIR__) . '/server.js')) {
   if (!file_exists($root_tmp)) mkdir($root_tmp, 0755, true);
   if (touch($root_restart)) {
       echo "<p style='color:green;'>Successfully requested Node.js restart at root!</p>";
   }
}
?>
