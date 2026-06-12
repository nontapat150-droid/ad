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
    
    // Find Team 5
    $stmt = $pdo->query("SELECT * FROM teams WHERE name LIKE '%5%'");
    $teams = $stmt->fetchAll();

    // Find users in Team 5
    $stmt = $pdo->query("SELECT * FROM users WHERE team_id IN (SELECT id FROM teams WHERE name LIKE '%5%')");
    $users = $stmt->fetchAll();

    // Find oil records for team 5
    $stmt = $pdo->query("SELECT o.*, u.full_name, t.name as team_name FROM oil_records o LEFT JOIN users u ON o.tech_id = u.id LEFT JOIN teams t ON u.team_id = t.id WHERE t.name LIKE '%5%' OR o.filler_name LIKE '%5%'");
    $oil = $stmt->fetchAll();

    echo json_encode([
        'teams' => $teams,
        'users' => $users,
        'oil_records' => $oil
    ]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
