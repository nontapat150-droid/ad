<?php
echo "<h1>Restarting Node.js Backend...</h1>";
$output = shell_exec("pkill -f node");
echo "<pre>Output: $output</pre>";
echo "<p>Done! The backend should now be running the latest code.</p>";
?>
