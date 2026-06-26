<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

// Configuration for your database
$host = "localhost";
$user = "zvucfpsz_BO";
$pass = "@2*]BC9AuGO^%P&-";
$db = "zvucfpsz_RT";

// Create connection
$conn = new mysqli($host, $user, $pass, $db);

// Check connection
if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
echo "Connected successfully<br><br>";

// 1. Create scheduled_messages table
$sql_create = "
    CREATE TABLE IF NOT EXISTS scheduled_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        message TEXT NOT NULL,
        target_role VARCHAR(50) DEFAULT 'all',
        target_users JSON NULL,
        cron_expression VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
";

if ($conn->query($sql_create) === TRUE) {
    echo "<strong style='color: green;'>SUCCESS:</strong> Table 'scheduled_messages' created or already exists.<br>";
} else {
    echo "<strong style='color: red;'>ERROR creating table:</strong> " . $conn->error . "<br>";
}

echo "<br><b>Database setup complete!</b>";

$conn->close();
?>
