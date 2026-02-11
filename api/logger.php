<?php
// api/logger.php

function writeLog($action, $details = '')
{
    $logDir = __DIR__ . '/../logs'; // Adjusted path to be outside of api/
    
    // Ensure log directory exists
    if (!is_dir($logDir)) {
        if (!mkdir($logDir, 0777, true)) {
            // If we can't create the log dir, we can't log.
            // Silently fail or fallback to system log? 
            // For now, silent fail to not break the app flow.
            return;
        }
    }

    $date = date('Y-m-d');
    $logFile = "$logDir/log_$date.txt";

    $timestamp = date('Y-m-d H:i:s');
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
    $user = $_SESSION['username'] ?? 'Guest';
    
    // Format: [Timestamp] [IP] [User] [Action] Details
    $message = "[$timestamp] [$ip] [User: $user] [$action] $details" . PHP_EOL;

    // Append to log file
    file_put_contents($logFile, $message, FILE_APPEND);
}
?>
