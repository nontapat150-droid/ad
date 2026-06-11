<?php
echo "<h1>Fixing Broken Images</h1>";

$backend_checkouts_dir = __DIR__ . '/backend/uploads/checkouts/';
$public_checkouts_dir = __DIR__ . '/uploads/checkouts/';

if (!file_exists($public_checkouts_dir)) {
    mkdir($public_checkouts_dir, 0755, true);
}

if (file_exists($backend_checkouts_dir) && is_dir($backend_checkouts_dir)) {
    $files = scandir($backend_checkouts_dir);
    $moved_count = 0;
    foreach ($files as $file) {
        if ($file !== '.' && $file !== '..') {
            $source = $backend_checkouts_dir . $file;
            $dest = $public_checkouts_dir . $file;
            
            // We just copy it so it exists exactly where the DB thinks it is
            if (copy($source, $dest)) {
                echo "<p>Copied: $file</p>";
                $moved_count++;
            } else {
                echo "<p style='color:red;'>Failed to copy: $file</p>";
            }
        }
    }
    echo "<h2>Done! Copied $moved_count files.</h2>";
} else {
    echo "<h2>Backend checkouts directory not found! No trapped files.</h2>";
}
?>
