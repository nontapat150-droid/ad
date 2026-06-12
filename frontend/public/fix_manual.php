<?php
header('Content-Type: application/json');
$backend = '/home/zvucfpsz/public_html/backend';

// Where are the files actually saving?
$p1 = $backend . '/uploads/reports';
$p2 = '/home/zvucfpsz/public_html/uploads/reports';

$files1 = is_dir($p1) ? scandir($p1) : [];
$files2 = is_dir($p2) ? scandir($p2) : [];

// Check frontend build dir
$public = '/home/zvucfpsz/public_html';

echo json_encode([
    'backend_uploads' => [
        'path' => $p1,
        'exists' => is_dir($p1),
        'files' => array_diff($files1, ['.', '..'])
    ],
    'public_uploads' => [
        'path' => $p2,
        'exists' => is_dir($p2),
        'files' => array_diff($files2, ['.', '..'])
    ]
]);
?>
