<?php
header('Content-Type: application/json');

$host = 'localhost';
$db   = 'zvucfpsz_RT';
$user = 'zvucfpsz_BO';
$pass = '@2*]BC9AuGO^%P&-';

$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
    
    // Delete oil records where license plate is "ทีม"
    $deletedOil = $pdo->exec("DELETE FROM oil_records WHERE license_plate LIKE '%ทีม%' OR filler_name LIKE '%ทีม%'");

    // Get all license plates
    $platesStmt = $pdo->query("SELECT DISTINCT license_plate FROM oil_records");
    $plates = $platesStmt->fetchAll();

    // Get all teams
    $teamsStmt = $pdo->query("SELECT id, team_name FROM teams");
    $allTeams = $teamsStmt->fetchAll();

    echo json_encode([
        'success' => true, 
        'deleted_oil' => $deletedOil,
        'license_plates' => $plates,
        'teams' => $allTeams
    ]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
