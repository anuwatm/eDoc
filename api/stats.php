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

$stmt = $db->prepare("SELECT lastlogin, ipaddress FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();

$publicDir = __DIR__ . "/../eDoc/public";
$dir = __DIR__ . "/../eDoc/private/$username";
$limit = 1024 * 1024 * 1024; // 1 GB

$privateCacheFile = $dir . "/.stats_cache.json";
$publicCacheFile = $publicDir . "/.stats_cache.json";

function getCachedOrCalculateStats($targetDir, $cacheFile)
{
    if (file_exists($cacheFile)) {
        $data = json_decode(file_get_contents($cacheFile), true);
        if (isset($data['fileCount'], $data['totalSize'])) {
            return $data;
        }
    }

    $fileCount = 0;
    $totalSize = 0;

    if (is_dir($targetDir)) {
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($targetDir, FilesystemIterator::SKIP_DOTS)
        );

        foreach ($iterator as $item) {
            if (!$item->isFile() || $item->getFilename() === basename($cacheFile)) {
                continue;
            }

            $fileCount++;
            $totalSize += $item->getSize();
        }
    }

    $result = ['fileCount' => $fileCount, 'totalSize' => $totalSize];
    file_put_contents($cacheFile, json_encode($result));
    return $result;
}

function getAvatarPath($username)
{
    $base = __DIR__ . "/../eDoc/private/$username/avatar/";
    foreach (['jpg', 'jpeg', 'png', 'gif'] as $ext) {
        if (file_exists($base . "avatar.$ext")) {
            return "eDoc/private/$username/avatar/avatar.$ext";
        }
    }
    return "assets/defaults/avatar.png";
}

$privateStats = getCachedOrCalculateStats($dir, $privateCacheFile);
$publicStats = getCachedOrCalculateStats($publicDir, $publicCacheFile);

echo json_encode([
    'success' => true,
    'username' => $username,
    'fileCount' => $privateStats['fileCount'],
    'usedSpace' => $privateStats['totalSize'],
    'totalSpace' => $limit,
    'percent' => min(100, round(($privateStats['totalSize'] / $limit) * 100)),
    'avatar' => getAvatarPath($username),
    'publicFileCount' => $publicStats['fileCount'],
    'publicUsedSpace' => $publicStats['totalSize'],
    'lastlogin' => $user['lastlogin'] ?? 'Never',
    'ipaddress' => $user['ipaddress'] ?? 'Unknown'
]);
?>
