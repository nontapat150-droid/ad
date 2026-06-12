<?php
header('Content-Type: application/json');
$backend = '/home/zvucfpsz/public_html/backend';
$envFile = $backend . '/.env';
echo json_encode([
    'env_exists' => file_exists($envFile),
    'env_content' => file_exists($envFile) ? file_get_contents($envFile) : ''
]);
?>
