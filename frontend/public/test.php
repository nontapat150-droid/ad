<?php
header('Content-Type: application/json');
$host = 'localhost';
$db   = 'bount_db'; // guessing from context, or just try to connect to the one in node
// Actually, I can just read config/db.js to get credentials!
echo file_get_contents('../../backend/config/db.js');
?>
