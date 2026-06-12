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

    // Alter table to use utf8mb4
    $pdo->exec("ALTER TABLE reports CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    $pdo->exec("ALTER TABLE reports MODIFY title VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL");
    $pdo->exec("ALTER TABLE reports MODIFY description TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL");

    echo json_encode(['success' => true, 'message' => 'Table reports converted to utf8mb4 successfully.']);
} catch (PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
?>
