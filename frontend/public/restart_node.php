<?php
echo "<h1>Restarting Node.js Backend...</h1>";
$output = shell_exec("pkill -f node");
echo "<pre>Output: $output</pre>";
// Also touch the restart.txt just in case
$restart_file = __DIR__ . '/../../backend/tmp/restart.txt';
if (file_exists(dirname($restart_file))) {
    touch($restart_file);
    echo "<p>Touched $restart_file</p>";
} else {
    echo "<p>Directory for restart.txt not found</p>";
}
echo "<p>Done! The backend should now be running the latest code.</p>";
?>
