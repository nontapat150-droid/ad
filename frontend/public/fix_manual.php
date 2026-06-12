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
    
    // Delete oil records where license plate is "ทีม 5"
    $deletedOil = $pdo->exec("DELETE FROM oil_records WHERE license_plate LIKE '%ทีม 5%' OR filler_name LIKE '%ทีม 5%'");

    // Check if Team 5 exists
    $stmt = $pdo->query("SELECT id FROM teams WHERE team_name = 'ทีม 5' LIMIT 1");
    $team = $stmt->fetch();

    if ($team) {
        $teamId = $team['id'];
        
        // Unassign users from Team 5 (set to NULL or unassigned)
        $pdo->exec("UPDATE users SET team_id = NULL WHERE team_id = $teamId");

        // Delete the team itself
        $deleted = $pdo->exec("DELETE FROM teams WHERE id = $teamId");

        echo json_encode(['success' => true, 'message' => "Team 5 (ID: $teamId) deleted. Also deleted $deletedOil oil records.", 'deleted_rows' => $deleted]);
    } else {
        echo json_encode(['success' => true, 'message' => "Team 5 not found. Deleted $deletedOil oil records."]);
    }

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
