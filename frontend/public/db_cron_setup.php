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
        target_users TEXT NULL,
        cron_expression VARCHAR(100) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
";

if ($conn->query($sql_create) === TRUE) {
    echo "<p style='color:green;'>CREATE TABLE scheduled_messages successful or already exists.</p>";
} else {
    echo "<p style='color:red;'>Error creating table scheduled_messages: " . $conn->error . "</p>";
}

// Convert existing table and specific columns to utf8mb4 to support Thai characters
$sql_charset = "ALTER TABLE scheduled_messages CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;";
$conn->query($sql_charset);

$sql_col1 = "ALTER TABLE scheduled_messages MODIFY message TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL;";
$conn->query($sql_col1);

$sql_col2 = "ALTER TABLE scheduled_messages MODIFY target_role VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT 'all';";
$conn->query($sql_col2);

$sql_col3 = "ALTER TABLE scheduled_messages MODIFY target_users TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;";
if ($conn->query($sql_col3) === TRUE) {
    echo "<p style='color:green;'>ALTER TABLE columns to utf8mb4 successful.</p>";
} else {
    echo "<p style='color:red;'>Error altering columns charset: " . $conn->error . "</p>";
}

echo "<br><b>Database setup complete!</b>";

$conn->close();
?>
