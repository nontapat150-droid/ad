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
    
    $query = "
      SELECT r.*, u.full_name, t.name AS team_name, u.phone 
      FROM reports r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN teams t ON u.team_id = t.id
    ";

    $stmt = $pdo->query($query);
    $rows = $stmt->fetchAll();

    echo json_encode([
        'success' => true, 
        'rows' => $rows
    ]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
