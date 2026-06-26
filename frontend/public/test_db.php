<?php
$envPath = __DIR__ . '/backend/.env';
if (!file_exists($envPath)) {
    die("No .env file found.");
}
$envVars = parse_ini_file($envPath);
$host = $envVars['DB_HOST'] ?? '127.0.0.1';
$user = $envVars['DB_USER'] ?? '';
$pass = $envVars['DB_PASSWORD'] ?? '';
$name = $envVars['DB_NAME'] ?? '';

echo "Connecting to $host with user $user...\n";
$mysqli = new mysqli($host, $user, $pass, $name);
if ($mysqli->connect_error) {
    die('Connect Error (' . $mysqli->connect_errno . ') ' . $mysqli->connect_error);
}
echo "✅ MySQL Connection OK via PHP!\n";
$mysqli->close();
?>
