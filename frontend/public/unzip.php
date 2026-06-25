<?php
$secret = $_GET['secret'] ?? '';
if ($secret !== 'bount_deploy_secret_2026') {
    die("Unauthorized");
}

$zipFile = __DIR__ . '/backend/node_modules.zip';
$extractTo = __DIR__ . '/backend/';

if (file_exists($zipFile)) {
    $zip = new ZipArchive;
    if ($zip->open($zipFile) === TRUE) {
        $zip->extractTo($extractTo);
        $zip->close();
        echo "✅ Successfully unzipped node_modules.\n";
        unlink($zipFile); // Clean up the zip file
        
        // Trigger Node.js Restart
        $tmp_dir = __DIR__ . '/backend/tmp';
        if (!file_exists($tmp_dir)) {
            mkdir($tmp_dir, 0755, true);
        }
        if (touch($tmp_dir . '/restart.txt')) {
            echo "✅ Requested Node.js restart.\n";
        } else {
            echo "⚠️ Failed to touch restart file.\n";
        }
    } else {
        http_response_code(500);
        echo "❌ Failed to open zip file.\n";
    }
} else {
    http_response_code(404);
    echo "❌ Zip file not found.\n";
}
?>
