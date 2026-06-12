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

    $byVehicleStmt = $pdo->query("
      SELECT r.license_plate, 
             SUM(r.liters) as total_liters, 
             SUM(r.total_price) as total_cost,
             SUM(r.distance) as total_distance,
             MAX(u.team_id) as main_team_id
      FROM oil_records r
      LEFT JOIN users u ON u.id = r.tech_id
      GROUP BY r.license_plate
      ORDER BY total_cost DESC
    ");
    $byVehicle = $byVehicleStmt->fetchAll(\PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true, 
        'byVehicle' => $byVehicle
    ]);

} catch (\PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
