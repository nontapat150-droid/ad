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
    
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $reports_exists = in_array('reports', $tables);
    
    // Create if missing
    if (!$reports_exists) {
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                image_path VARCHAR(255),
                status ENUM('pending','in_progress','resolved') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )");
            $created = 'OK with FK';
        } catch (Exception $e) {
            $pdo->exec("CREATE TABLE IF NOT EXISTS reports (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                title VARCHAR(255) NOT NULL,
                description TEXT NOT NULL,
                image_path VARCHAR(255),
                status ENUM('pending','in_progress','resolved') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )");
            $created = 'OK without FK (err: ' . $e->getMessage() . ')';
        }
    }
    
    $tables_after = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    
    // Read report.js first line to see which version is on server
    $rp = '/home/zvucfpsz/repositories/ad/backend/routes/report.js';
    $report_line4 = 'not found';
    if (file_exists($rp)) {
        $lines = file($rp);
        $report_line4 = isset($lines[3]) ? trim($lines[3]) : 'no line 4';
    }
    
    // Read error log
    $log = '';
    $lp = '/home/zvucfpsz/repositories/ad/backend/error_log.txt';
    if (file_exists($lp)) {
        $log = substr(file_get_contents($lp), -2000);
    }
    
    echo json_encode([
        'tables' => $tables_after,
        'reports_was_missing' => !$reports_exists,
        'created' => $created ?? 'already existed',
        'report_js_line4' => $report_line4,
        'error_log' => $log ?: 'empty',
    ]);
    
} catch (PDOException $e) {
    echo json_encode(['db_error' => $e->getMessage()]);
}
?>
