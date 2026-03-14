<?php
// api/stats.php
session_start();
header('Content-Type: application/json');
require_once 'db.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false]);
    exit;
}

$username = $_SESSION['username'];

// Fetch User Info
$stmt = $db->prepare("SELECT lastlogin, ipaddress FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

$publicDir = __DIR__ . "/../eDoc/public";
$dir = __DIR__ . "/../eDoc/private/$username";
$limit = 1024 * 1024 * 1024; // Default storage limit of 1 GB

// --- CACHING LOGIC ---
$privateCacheFile = $dir . "/.stats_cache.json";
$publicCacheFile = $publicDir . "/.stats_cache.json";

function getCachedOrCalculateStats($targetDir, $cacheFile) {
    if (file_exists($cacheFile)) {
        $json = file_get_contents($cacheFile);
        if ($json) {
            $data = json_decode($json, true);
            if ($data && isset($data['fileCount']) && isset($data['totalSize'])) {
                return $data; // Return cached
            }
        }
    }

    // Calculate
    $fileCount = 0;
    $totalSize = 0;
    
    // Internal recursive struct
    $calc = function($currentDir) use (&$calc, &$fileCount, &$totalSize, $cacheFile) {
        if (!is_dir($currentDir)) return;
        $files = scandir($currentDir);
        foreach ($files as $file) {
            if ($file == '.' || $file == '..' || $file == basename($cacheFile)) continue;
            $path = "$currentDir/$file";
            if (is_dir($path)) {
                $calc($path);
            } else {
                $fileCount++;
                $totalSize += filesize($path);
            }
        }
    };
    
    $calc($targetDir);
    
    $result = ['fileCount' => $fileCount, 'totalSize' => $totalSize];
    file_put_contents($cacheFile, json_encode($result));
    return $result;
}

$privateStats = getCachedOrCalculateStats($dir, $privateCacheFile);
$fileCount = $privateStats['fileCount'];
$totalSize = $privateStats['totalSize'];

$publicStats = getCachedOrCalculateStats($publicDir, $publicCacheFile);
$publicFileCount = $publicStats['fileCount'];
$publicTotalSize = $publicStats['totalSize'];
// --- END CACHING LOGIC ---

// Helper to find avatar
function getAvatarPath($username)
{
    $base = __DIR__ . "/../eDoc/private/$username/avatar/";
    $allowed = ['jpg', 'jpeg', 'png', 'gif'];
    foreach ($allowed as $ext) {
        if (file_exists($base . "avatar.$ext")) {
            return "eDoc/private/$username/avatar/avatar.$ext";
        }
    }
    return "assets/defaults/avatar.png";
}

echo json_encode([
    'success' => true,
    'username' => $username,
    'fileCount' => $fileCount,
    'usedSpace' => $totalSize,
    'totalSpace' => $limit,
    'percent' => min(100, round(($totalSize / $limit) * 100)),
    'avatar' => getAvatarPath($username),
    'publicFileCount' => $publicFileCount,
    'publicUsedSpace' => $publicTotalSize,
    'lastlogin' => $user['lastlogin'] ?? 'Never',
    'ipaddress' => $user['ipaddress'] ?? 'Unknown'
]);
?>