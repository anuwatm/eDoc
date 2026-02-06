<?php
// api/stats.php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false]);
    exit;
}

$username = $_SESSION['username'];
$dir = __DIR__ . "/../eDoc/private/$username";

$fileCount = 0;
$totalSize = 0;
$limit = 100 * 1024 * 1024; // 100MB Quota (mock)

function getStats($dir, &$fileCount, &$totalSize)
{
    if (!is_dir($dir))
        return;
    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file == '.' || $file == '..')
            continue;
        $path = "$dir/$file";
        if (is_dir($path)) {
            getStats($path, $fileCount, $totalSize);
        } else {
            $fileCount++;
            $totalSize += filesize($path);
        }
    }
}

getStats($dir, $fileCount, $totalSize);

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
    'avatar' => getAvatarPath($username)
]);
?>