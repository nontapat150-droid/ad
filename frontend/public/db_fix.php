<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
$host = "localhost";
$user = "zvucfpsz_BO";
$pass = "@2*]BC9AuGO^%P&-";
$db = "zvucfpsz_RT";
$conn = new mysqli($host, $user, $pass, $db);
if ($conn->connect_error) { die("Connection failed: " . $conn->connect_error); }

$queries = [
    "CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT NOT NULL,
        receiver_id INT NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender (sender_id),
        INDEX idx_receiver (receiver_id)
    );",
    "CREATE TABLE IF NOT EXISTS announcements (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        target_role VARCHAR(50) DEFAULT 'all',
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );",
    "CREATE TABLE IF NOT EXISTS user_announcement_reads (
        user_id INT NOT NULL,
        announcement_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, announcement_id)
    );"
];

foreach ($queries as $sql) {
    if ($conn->query($sql) === TRUE) {
        echo "Query successful<br>";
    } else {
        echo "Error: " . $conn->error . "<br>";
    }
}

// Test insert
$test_sql = "INSERT INTO messages (sender_id, receiver_id, message) VALUES (1, 2, 'Test Message')";
if ($conn->query($test_sql) === TRUE) {
    echo "Test Insert successful. ID: " . $conn->insert_id . "<br>";
    $conn->query("DELETE FROM messages WHERE id = " . $conn->insert_id);
} else {
    echo "Insert Error: " . $conn->error . "<br>";
}

$conn->close();
?>
