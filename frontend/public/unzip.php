<?php
// Deploy-only: extracts backend/node_modules.zip after CI FTP upload.
// Secret via DEPLOY_SECRET env on hosting, or fallback for existing pipeline.
$expected = getenv('DEPLOY_SECRET') ?: 'bount_deploy_secret_2026';
$secret = $_GET['secret'] ?? '';
if ($secret !== $expected) {
    http_response_code(403);
    die('Unauthorized');
}

$zipFile = __DIR__ . '/backend/node_modules.zip';
$extractTo = __DIR__ . '/backend/';

if (!file_exists($zipFile)) {
    http_response_code(404);
    die('Zip file not found.');
}

$zip = new ZipArchive;
if ($zip->open($zipFile) !== true) {
    http_response_code(500);
    die('Failed to open zip file.');
}

$zip->extractTo($extractTo);
$zip->close();
unlink($zipFile);

echo "Successfully unzipped node_modules.\n";

$tmp_dir = __DIR__ . '/backend/tmp';
if (!file_exists($tmp_dir)) {
    mkdir($tmp_dir, 0755, true);
}
if (touch($tmp_dir . '/restart.txt')) {
    echo "Requested Node.js restart.\n";
} else {
    echo "Failed to touch restart file.\n";
}
