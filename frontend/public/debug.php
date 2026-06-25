<?php
header('Content-Type: text/plain');
echo "Node.js Version: \n";
exec("node -v", $out1);
print_r($out1);

echo "\nFirebase Admin exists: \n";
$fbPath = __DIR__ . '/backend/node_modules/firebase-admin/package.json';
if (file_exists($fbPath)) {
    echo "Yes. Version: \n";
    $pkg = json_decode(file_get_contents($fbPath), true);
    echo $pkg['version'] . "\n";
} else {
    echo "No.\n";
}

echo "\nPassenger Error Log (last 20 lines): \n";
$logFile = dirname(__DIR__) . '/tmp/passenger_error.log'; // sometimes passenger logs here, or we can check stderr
if (file_exists($logFile)) {
    echo shell_exec("tail -n 20 " . escapeshellarg($logFile));
} else {
    echo "No error log found at tmp/passenger_error.log. Try checking cPanel.\n";
}

echo "\nTesting server.js syntax: \n";
exec("cd " . dirname(__DIR__) . " && node -c backend/server.js 2>&1", $out2);
print_r($out2);
?>
