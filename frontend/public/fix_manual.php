<?php
header('Content-Type: application/json');
$host = 'localhost';
$db   = 'zvucfpsz_RT';
$user = 'zvucfpsz_BO';
$pass = '@2*]BC9AuGO^%P&-';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);

    $reports = $pdo->query("SELECT id, title, image_path FROM reports ORDER BY id DESC LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['reports' => $reports]);
} catch (PDOException $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
?>
