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
    "ALTER TABLE messages MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY",
    "ALTER TABLE announcements MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT PRIMARY KEY"
];

foreach ($queries as $sql) {
    try {
        if ($conn->query($sql) === TRUE) {
            echo "ALTER TABLE successful: " . htmlspecialchars($sql) . "<br>";
        } else {
            echo "Error altering table: " . $conn->error . " for query: " . htmlspecialchars($sql) . "<br>";
        }
    } catch (Exception $e) {
        // If it throws an exception (e.g. multiple primary key defined), we catch it
        echo "Exception altering table: " . $e->getMessage() . "<br>";
        // Fallback: try just AUTO_INCREMENT without PRIMARY KEY if it's already a primary key
        $fallback_sql = str_replace(" PRIMARY KEY", "", $sql);
        if ($conn->query($fallback_sql) === TRUE) {
             echo "Fallback ALTER TABLE successful: " . htmlspecialchars($fallback_sql) . "<br>";
        } else {
             echo "Fallback Error: " . $conn->error . "<br>";
        }
    }
}

// Test insert
$test_sql = "INSERT INTO messages (sender_id, receiver_id, message) VALUES (1, 2, 'Test Message')";
try {
    if ($conn->query($test_sql) === TRUE) {
        echo "Test Insert successful. ID: " . $conn->insert_id . "<br>";
        $conn->query("DELETE FROM messages WHERE id = " . $conn->insert_id);
    } else {
        echo "Insert Error: " . $conn->error . "<br>";
    }
} catch (Exception $e) {
    echo "Insert Exception: " . $e->getMessage() . "<br>";
}

$conn->close();
?>
