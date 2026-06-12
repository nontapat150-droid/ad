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
    
    // Check if Team 5 exists
    $stmt = $pdo->query("SELECT id FROM teams WHERE name = 'ทีม 5' OR name LIKE '%5%' LIMIT 1");
    $team = $stmt->fetch();

    if ($team) {
        $teamId = $team['id'];
        
        // Unassign users from Team 5
        $pdo->exec("UPDATE users SET team_id = NULL WHERE team_id = $teamId");

        // Delete the team itself
        $deleted = $pdo->exec("DELETE FROM teams WHERE id = $teamId");

        echo json_encode(['success' => true, 'message' => "Team 5 (ID: $teamId) deleted.", 'deleted_rows' => $deleted]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Team 5 not found']);
    }

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
