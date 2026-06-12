<?php
header('Content-Type: application/json');
set_time_limit(10);

$host = 'localhost';
$db   = 'zvucfpsz_RT';
$user = 'zvucfpsz_BO';
$pass = '@2*]BC9AuGO^%P&-';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    // Check teams table structure
    $teams_cols = $pdo->query("DESCRIBE teams")->fetchAll(PDO::FETCH_ASSOC);
    
    // Check users table structure (check team_id column)
    $users_cols = $pdo->query("DESCRIBE users")->fetchAll(PDO::FETCH_ASSOC);
    
    // Check reports table structure
    $reports_cols = $pdo->query("DESCRIBE reports")->fetchAll(PDO::FETCH_ASSOC);
    
    // Sample data from teams
    $teams_sample = $pdo->query("SELECT * FROM teams LIMIT 3")->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'teams_columns' => array_column($teams_cols, 'Field'),
        'users_columns' => array_column($users_cols, 'Field'),
        'reports_columns' => array_column($reports_cols, 'Field'),
        'teams_sample' => $teams_sample,
    ]);

} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
