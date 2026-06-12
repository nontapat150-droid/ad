<?php
header('Content-Type: application/json');

// Force git pull and restart Node to get the correct code from repository
$output = [];

// Pull latest code from git
$git_pull = shell_exec('cd /home/zvucfpsz/repositories/ad && git pull 2>&1');
$output['git_pull'] = $git_pull;

// Check what report.js looks like now (first 5 lines)
$rp = '/home/zvucfpsz/repositories/ad/backend/routes/report.js';
if (file_exists($rp)) {
    $lines = file($rp);
    $output['report_js_line4'] = isset($lines[3]) ? trim($lines[3]) : 'N/A';
    $output['report_js_line1'] = isset($lines[0]) ? trim($lines[0]) : 'N/A';
}

// Check node_modules
$has_multer = is_dir('/home/zvucfpsz/repositories/ad/backend/node_modules/multer');
$output['has_multer'] = $has_multer;

// Install deps if multer missing
if (!$has_multer) {
    $npm_install = shell_exec('cd /home/zvucfpsz/repositories/ad/backend && npm install --production 2>&1');
    $output['npm_install'] = substr($npm_install, 0, 500);
}

// Create uploads/reports directory
shell_exec('mkdir -p /home/zvucfpsz/repositories/ad/backend/uploads/reports');
shell_exec('chmod -R 777 /home/zvucfpsz/repositories/ad/backend/uploads');

// Restart Node
$restart = shell_exec('pkill -f "node.*server" 2>&1; sleep 1; pkill -f node 2>&1');
$output['restart'] = $restart;

// Check if reports table exists in the DB Node is using
$host = 'localhost';
$db   = 'zvucfpsz_RT';
$user = 'zvucfpsz_BO';
$pass = '@2*]BC9AuGO^%P&-';
$dsn = "mysql:host=$host;dbname=$db;charset=utf8mb4";
try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $tables = $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
    $output['db'] = 'zvucfpsz_RT';
    $output['tables'] = $tables;
    $output['reports_exists'] = in_array('reports', $tables);
    
    // Create reports table if not exists
    if (!in_array('reports', $tables)) {
        try {
            $pdo->exec("
                CREATE TABLE IF NOT EXISTS reports (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    description TEXT NOT NULL,
                    image_path VARCHAR(255),
                    status ENUM('pending','in_progress','resolved') DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            ");
            $output['created_reports'] = 'success with FK';
        } catch (Exception $e) {
            // Try without FK
            try {
                $pdo->exec("
                    CREATE TABLE IF NOT EXISTS reports (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        user_id INT NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        description TEXT NOT NULL,
                        image_path VARCHAR(255),
                        status ENUM('pending','in_progress','resolved') DEFAULT 'pending',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                    )
                ");
                $output['created_reports'] = 'success without FK';
            } catch (Exception $e2) {
                $output['created_reports'] = 'FAILED: ' . $e2->getMessage();
            }
        }
    }
    
    // Re-check
    $output['reports_exists_after'] = in_array('reports', $pdo->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN));
    
} catch (PDOException $e) {
    $output['db_error'] = $e->getMessage();
}

echo json_encode($output, JSON_PRETTY_PRINT);
?>
