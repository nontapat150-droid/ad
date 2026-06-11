<?php
header('Content-Type: application/json');

$dbHost = '127.0.0.1';
$dbUser = 'nontapat150'; // Let's try root first, XAMPP default is root with no password
$dbPass = ''; 
$dbName = 'bount_db'; 

// Look for config in db.js
$configContent = @file_get_contents('../../backend/config/db.js');
if ($configContent) {
    if (preg_match("/user:\s*'(.*?)'/", $configContent, $m)) $dbUser = $m[1];
    if (preg_match("/password:\s*'(.*?)'/", $configContent, $m)) $dbPass = $m[1];
    if (preg_match("/database:\s*'(.*?)'/", $configContent, $m)) $dbName = $m[1];
}

$conn = new mysqli($dbHost, $dbUser, $dbPass, $dbName);

if ($conn->connect_error) {
    echo json_encode(["error" => "Connection failed: " . $conn->connect_error]);
    exit;
}

$results = [];

$queries = [
    "users" => "SELECT COUNT(*) as cnt FROM users",
    "checkins" => "SELECT COUNT(DISTINCT user_id) as cnt FROM checkins WHERE DATE(checkin_time) = CURDATE() AND checkout_time IS NULL",
    "inventory" => "SELECT SUM(quantity) as cnt FROM inventory_items",
    "non" => "SELECT COUNT(DISTINCT access_no) as cnt FROM jobs WHERE access_no LIKE 'NON%'",
    "oil" => "SELECT COUNT(*) as cnt FROM oil_records WHERE MONTH(date_recorded) = MONTH(CURDATE()) AND YEAR(date_recorded) = YEAR(CURDATE())",
    "entry" => "SELECT COUNT(*) as cnt FROM entry_fees WHERE MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())"
];

foreach ($queries as $key => $sql) {
    $res = $conn->query($sql);
    if ($res) {
        $row = $res->fetch_assoc();
        $results[$key] = $row['cnt'] ?? 0;
    } else {
        $results[$key] = "Error: " . $conn->error;
    }
}

echo json_encode($results);
$conn->close();
?>
