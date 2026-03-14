<?php
// api/get_logs.php
session_start();

if (!isset($_SESSION['user_id'])) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$logDir = __DIR__ . '/../logs';

// GET all available log files
if (isset($_GET['action']) && $_GET['action'] === 'list') {
    $files = [];
    if (is_dir($logDir)) {
        $files = array_diff(scandir($logDir), array('.', '..'));
        $files = array_filter($files, function($f) { return str_starts_with($f, 'log_') && str_ends_with($f, '.txt'); });
        rsort($files); // Newest first
    }
    echo json_encode(array_values($files));
    exit;
}

// GET specific log file
if (isset($_GET['file'])) {
    $file = basename($_GET['file']);
    $path = "$logDir/$file";
    
    if (!file_exists($path)) {
        http_response_code(404);
        echo json_encode(['error' => 'Log file not found']);
        exit;
    }
    
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $events = [];
    
    // Format: [2026-03-14 12:00:00] [127.0.0.1] [User: admin] [login] Success
    $pattern = '/^\[(.*?)\] \[(.*?)\] \[User:\s*(.*?)\] \[(.*?)\]\s*(.*)$/';
    
    foreach ($lines as $line) {
        if (preg_match($pattern, $line, $matches)) {
            $events[] = [
                'timestamp' => $matches[1],
                'ip'        => trim($matches[2]),
                'user'      => trim($matches[3]),
                'action'    => trim(strtolower($matches[4])),
                'details'   => trim($matches[5])
            ];
        }
    }
    
    echo json_encode($events);
    exit;
}

http_response_code(400);
echo json_encode(['error' => 'Invalid request']);
