<?php
session_start();
header('Content-Type: application/json');
require_once 'logger.php';

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$username = $_SESSION['username'];
$publicBase = __DIR__ . '/../eDoc/public';
$privateBase = __DIR__ . "/../eDoc/private/$username";
$storageLimit = 1024 * 1024 * 1024; // 1 GB private quota
$maxUploadFileSize = 100 * 1024 * 1024; // 100 MB per file
$blockedMimeTypes = ['application/x-php', 'application/x-msdownload', 'application/x-msdos-program'];
$blockedExtensions = ['php', 'phtml', 'phar', 'exe', 'bat', 'cmd', 'com', 'scr', 'msi', 'js', 'vbs', 'ps1'];
$previewMime = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'mp4' => 'video/mp4',
    'csv' => 'text/csv',
    'json' => 'application/json',
    'txt' => 'text/plain',
];

foreach ([$publicBase, $privateBase] as $dir) {
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

function jsonExit($payload, $code = 200)
{
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

function ensureDir($dir)
{
    if (!is_dir($dir) && !mkdir($dir, 0777, true)) {
        jsonExit(['success' => false, 'message' => 'Cannot create directory'], 500);
    }
    $real = realpath($dir);
    if (!$real) {
        jsonExit(['success' => false, 'message' => 'Invalid directory'], 500);
    }
    return $real;
}

function cleanRelPath($path)
{
    $path = trim(str_replace('\\', '/', $path ?? ''), '/');
    if ($path === '') {
        return '';
    }

    $parts = [];
    foreach (explode('/', $path) as $part) {
        if ($part === '' || $part === '.') {
            continue;
        }
        if ($part === '..' || str_contains($part, ':')) {
            jsonExit(['success' => false, 'message' => 'Invalid path'], 400);
        }
        $parts[] = $part;
    }
    return implode('/', $parts);
}

function isWithinBase($path, $base)
{
    $path = rtrim(str_replace('\\', '/', $path), '/');
    $base = rtrim(str_replace('\\', '/', $base), '/');
    return $path === $base || str_starts_with($path, $base . '/');
}

function safePath($base, $relPath, $allowMissing = false)
{
    $baseReal = ensureDir($base);
    $relPath = cleanRelPath($relPath);
    if ($relPath === '') {
        return $baseReal;
    }

    $fullPath = $baseReal . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relPath);
    if (file_exists($fullPath)) {
        $real = realpath($fullPath);
        if (!$real || !isWithinBase($real, $baseReal)) {
            jsonExit(['success' => false, 'message' => 'Invalid path'], 400);
        }
        return $real;
    }

    if (!$allowMissing) {
        jsonExit(['success' => false, 'message' => 'Not found'], 404);
    }

    $parent = dirname($fullPath);
    if (!is_dir($parent)) {
        mkdir($parent, 0777, true);
    }
    $parentReal = realpath($parent);
    if (!$parentReal || !isWithinBase($parentReal, $baseReal)) {
        jsonExit(['success' => false, 'message' => 'Invalid path'], 400);
    }
    return $parentReal . DIRECTORY_SEPARATOR . basename($fullPath);
}

function baseForContext($context, $publicBase, $privateBase)
{
    return $context === 'public' ? $publicBase : $privateBase;
}

function resolvePrefixedPath($path, $publicBase, $privateBase, $allowMissing = false)
{
    $path = cleanRelPath($path);
    if (str_starts_with($path, 'public/')) {
        return [safePath($publicBase, substr($path, 7), $allowMissing), $publicBase];
    }
    return [safePath($privateBase, $path, $allowMissing), $privateBase];
}

function invalidateStatsCache($baseDir)
{
    $cacheFile = rtrim($baseDir, '/\\') . '/.stats_cache.json';
    if (file_exists($cacheFile)) {
        unlink($cacheFile);
    }
}

function dirSize($dir)
{
    if (!is_dir($dir)) {
        return 0;
    }
    $size = 0;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $item) {
        if ($item->isFile() && $item->getFilename() !== '.stats_cache.json') {
            $size += $item->getSize();
        }
    }
    return $size;
}

function uniquePath($path)
{
    if (!file_exists($path)) {
        return $path;
    }
    $info = pathinfo($path);
    $ext = isset($info['extension']) ? '.' . $info['extension'] : '';
    $name = $info['filename'];
    return $info['dirname'] . '/' . $name . '_' . date('Ymd_His') . '_' . random_int(100, 999) . $ext;
}

function copyTree($src, $dest)
{
    if (is_file($src)) {
        return copy($src, $dest);
    }
    if (!is_dir($dest)) {
        mkdir($dest, 0777, true);
    }
    foreach (array_diff(scandir($src), ['.', '..']) as $item) {
        $from = $src . '/' . $item;
        $to = $dest . '/' . $item;
        if (is_dir($from)) {
            copyTree($from, $to);
        } else {
            copy($from, $to);
        }
    }
    return true;
}

function deletePath($path)
{
    if (is_file($path)) {
        return unlink($path);
    }
    if (!is_dir($path)) {
        return false;
    }
    foreach (array_diff(scandir($path), ['.', '..']) as $item) {
        if (!deletePath($path . '/' . $item)) {
            return false;
        }
    }
    return rmdir($path);
}

function trashBase($base)
{
    $dir = rtrim($base, '/\\') . '/.trash';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    return $dir;
}

function trashMetaPath($base)
{
    return trashBase($base) . '/.trash.json';
}

function loadTrashMeta($base)
{
    $file = trashMetaPath($base);
    if (!file_exists($file)) {
        return [];
    }
    $data = json_decode(file_get_contents($file), true);
    return is_array($data) ? $data : [];
}

function saveTrashMeta($base, $data)
{
    file_put_contents(trashMetaPath($base), json_encode(array_values($data), JSON_PRETTY_PRINT));
}

function addDirToZip($dirPath, $zip, $baseDirInZip = '')
{
    foreach (array_diff(scandir($dirPath), ['.', '..']) as $item) {
        if ($item === '.trash' || $item === '.stats_cache.json') {
            continue;
        }
        $fullPath = $dirPath . '/' . $item;
        $localPath = ltrim($baseDirInZip . '/' . $item, '/');
        if (is_dir($fullPath)) {
            $zip->addEmptyDir($localPath);
            addDirToZip($fullPath, $zip, $localPath);
        } else {
            $zip->addFile($fullPath, $localPath);
        }
    }
}

if ($action === 'list') {
    $type = $_GET['type'] ?? 'private';
    $path = cleanRelPath($_GET['path'] ?? '');
    $baseDir = baseForContext($type, $publicBase, $privateBase);
    $targetDir = safePath($baseDir, $path, true);

    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0777, true);
    }

    $files = [];
    foreach (scandir($targetDir) as $item) {
        if ($item === '.' || $item === '..' || $item === '.stats_cache.json' || $item === '.trash') {
            continue;
        }

        $fullPath = $targetDir . '/' . $item;
        if ($type === 'private' && is_dir($fullPath)) {
            continue;
        }

        $files[] = [
            'name' => $item,
            'isDir' => is_dir($fullPath),
            'size' => is_dir($fullPath) ? 0 : filesize($fullPath),
            'modTime' => filemtime($fullPath),
            'type' => is_dir($fullPath) ? 'folder' : strtolower(pathinfo($item, PATHINFO_EXTENSION)),
            'relPath' => ($path ? "$path/" : '') . $item
        ];
    }

    jsonExit(['success' => true, 'files' => $files]);
}

if ($action === 'upload') {
    $type = $_POST['type'] ?? 'private';
    $path = cleanRelPath($_POST['path'] ?? '');
    $baseDir = baseForContext($type, $publicBase, $privateBase);
    $targetDir = safePath($baseDir, $path, true);

    if (!is_dir($targetDir)) {
        mkdir($targetDir, 0777, true);
    }

    if (!isset($_FILES['files'])) {
        jsonExit(['success' => false, 'message' => 'No files sent'], 400);
    }

    $files = $_FILES['files'];
    $incomingSize = array_sum(array_map('intval', $files['size'] ?? []));
    if ($type !== 'public' && dirSize($privateBase) + $incomingSize > $storageLimit) {
        jsonExit(['success' => false, 'message' => 'Storage quota exceeded'], 400);
    }

    $uploaded = [];
    global $blockedExtensions, $blockedMimeTypes, $maxUploadFileSize;
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    for ($i = 0; $i < count($files['name']); $i++) {
        if (($files['error'][$i] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            continue;
        }

        $name = basename($files['name'][$i]);
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if ($name === '' || in_array($ext, $blockedExtensions, true)) {
            continue;
        }

        if (($files['size'][$i] ?? 0) > $maxUploadFileSize) {
            continue;
        }

        $tmp = $files['tmp_name'][$i];
        $mime = $finfo ? finfo_file($finfo, $tmp) : '';
        if (in_array($mime, $blockedMimeTypes, true)) {
            continue;
        }

        $target = uniquePath(safePath($baseDir, ($path ? "$path/" : '') . $name, true));
        if (move_uploaded_file($tmp, $target)) {
            $uploaded[] = basename($target);
            writeLog('UPLOAD', "Uploaded file: " . basename($target));
        }
    }

    if ($finfo) {
        finfo_close($finfo);
    }

    if (!empty($uploaded)) {
        invalidateStatsCache($baseDir);
    }
    jsonExit(['success' => true, 'uploaded' => $uploaded]);
}

if ($action === 'delete') {
    $path = cleanRelPath($_POST['path'] ?? '');
    $context = $_POST['context'] ?? 'private';
    $base = baseForContext($context, $publicBase, $privateBase);
    $fullPath = safePath($base, $path);

    if ($path === '' || !file_exists($fullPath)) {
        jsonExit(['success' => false, 'message' => 'Not found'], 404);
    }

    $trashId = date('Ymd_His') . '_' . bin2hex(random_bytes(4));
    $trashPath = trashBase($base) . '/' . $trashId . '_' . basename($fullPath);
    if (!rename($fullPath, $trashPath)) {
        jsonExit(['success' => false, 'message' => 'Failed to move item to recycle bin'], 500);
    }

    $meta = loadTrashMeta($base);
    $meta[] = [
        'id' => $trashId,
        'name' => basename($fullPath),
        'originalPath' => $path,
        'trashName' => basename($trashPath),
        'context' => $context,
        'isDir' => is_dir($trashPath),
        'size' => is_file($trashPath) ? filesize($trashPath) : 0,
        'deletedAt' => time()
    ];
    saveTrashMeta($base, $meta);
    writeLog('DELETE', "Moved to recycle bin: $path");
    invalidateStatsCache($base);
    jsonExit(['success' => true]);
}

if ($action === 'trash_list') {
    $context = $_GET['context'] ?? 'private';
    $base = baseForContext($context, $publicBase, $privateBase);
    jsonExit(['success' => true, 'items' => loadTrashMeta($base)]);
}

if ($action === 'trash_restore') {
    $context = $_POST['context'] ?? 'private';
    $id = $_POST['id'] ?? '';
    $base = baseForContext($context, $publicBase, $privateBase);
    $meta = loadTrashMeta($base);

    foreach ($meta as $idx => $item) {
        if (($item['id'] ?? '') !== $id) {
            continue;
        }
        $trashPath = trashBase($base) . '/' . $item['trashName'];
        $restorePath = uniquePath(safePath($base, $item['originalPath'], true));
        if (!file_exists($trashPath) || !rename($trashPath, $restorePath)) {
            jsonExit(['success' => false, 'message' => 'Restore failed'], 500);
        }
        unset($meta[$idx]);
        saveTrashMeta($base, $meta);
        invalidateStatsCache($base);
        writeLog('RESTORE', "Restored file: " . $item['originalPath']);
        jsonExit(['success' => true]);
    }
    jsonExit(['success' => false, 'message' => 'Trash item not found'], 404);
}

if ($action === 'trash_clear') {
    $contexts = ['private' => $privateBase, 'public' => $publicBase];
    $deleted = 0;

    foreach ($contexts as $context => $base) {
        $trashDir = trashBase($base);
        $trashReal = realpath($trashDir);
        $meta = loadTrashMeta($base);

        $remaining = [];
        foreach ($meta as $item) {
            $trashPath = $trashDir . '/' . basename($item['trashName']);
            $targetReal = file_exists($trashPath) ? realpath($trashPath) : false;
            if (!$targetReal) {
                $deleted++;
                continue;
            }
            if ($trashReal && isWithinBase($targetReal, $trashReal) && deletePath($targetReal)) {
                $deleted++;
                continue;
            }
            $remaining[] = $item;
        }

        saveTrashMeta($base, $remaining);
        invalidateStatsCache($base);
    }

    writeLog('CLEAR_TRASH', "Cleared recycle bin: $deleted item(s)");
    jsonExit(['success' => true, 'deleted' => $deleted]);
}

if ($action === 'trash_delete') {
    $context = $_POST['context'] ?? 'private';
    $id = $_POST['id'] ?? '';
    $base = baseForContext($context, $publicBase, $privateBase);
    $trashDir = trashBase($base);
    $meta = loadTrashMeta($base);

    foreach ($meta as $idx => $item) {
        if (($item['id'] ?? '') !== $id) {
            continue;
        }
        $trashPath = $trashDir . '/' . basename($item['trashName']);
        $trashReal = realpath($trashDir);
        $targetReal = file_exists($trashPath) ? realpath($trashPath) : false;
        if ($targetReal && (!$trashReal || !isWithinBase($targetReal, $trashReal))) {
            jsonExit(['success' => false, 'message' => 'Invalid trash path'], 400);
        }
        if ($targetReal && !deletePath($targetReal)) {
            jsonExit(['success' => false, 'message' => 'Permanent delete failed'], 500);
        }
        unset($meta[$idx]);
        saveTrashMeta($base, $meta);
        invalidateStatsCache($base);
        writeLog('DELETE_FOREVER', "Permanently deleted: " . ($item['originalPath'] ?? $id));
        jsonExit(['success' => true]);
    }
    jsonExit(['success' => false, 'message' => 'Trash item not found'], 404);
}

if ($action === 'move' || $action === 'copy') {
    [$srcFile, $srcBase] = resolvePrefixedPath($_POST['src'] ?? '', $publicBase, $privateBase);
    [$destFile, $destBase] = resolvePrefixedPath($_POST['dest'] ?? '', $publicBase, $privateBase, true);
    $destFile = uniquePath($destFile);

    if (realpath($destBase) === realpath($privateBase) && realpath($srcBase) !== realpath($privateBase)) {
        $incomingSize = is_dir($srcFile) ? dirSize($srcFile) : filesize($srcFile);
        if (dirSize($privateBase) + $incomingSize > $storageLimit) {
            jsonExit(['success' => false, 'message' => 'Storage quota exceeded'], 400);
        }
    }

    $ok = $action === 'move' ? rename($srcFile, $destFile) : copyTree($srcFile, $destFile);
    if (!$ok) {
        jsonExit(['success' => false, 'message' => ucfirst($action) . ' failed'], 500);
    }

    writeLog(strtoupper($action), ucfirst($action) . " item from $srcFile to $destFile");
    invalidateStatsCache($srcBase);
    invalidateStatsCache($destBase);
    jsonExit(['success' => true]);
}

if ($action === 'download_zip') {
    $context = $_POST['context'] ?? $_GET['context'] ?? 'private';
    $pathsRaw = $_POST['paths'] ?? $_GET['paths'] ?? [];
    $paths = is_string($pathsRaw) ? json_decode($pathsRaw, true) : $pathsRaw;
    if (empty($paths) || !is_array($paths)) {
        jsonExit(['success' => false, 'message' => 'No paths provided for download'], 400);
    }

    $base = baseForContext($context, $publicBase, $privateBase);
    $zipFile = $base . '/.temp_export_' . time() . '_' . random_int(1000, 9999) . '.zip';
    $zip = new ZipArchive();
    if ($zip->open($zipFile, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
        jsonExit(['success' => false, 'message' => 'Failed to create zip archive'], 500);
    }

    foreach ($paths as $path) {
        $cleanPath = cleanRelPath($path);
        $fullPath = safePath($base, $cleanPath);
        if (is_dir($fullPath)) {
            $folderName = basename($fullPath);
            $zip->addEmptyDir($folderName);
            addDirToZip($fullPath, $zip, $folderName);
        } elseif (is_file($fullPath)) {
            $zip->addFile($fullPath, basename($fullPath));
        }
    }
    $zip->close();

    writeLog('DOWNLOAD', 'Downloaded ' . count($paths) . ' item(s) to ZIP.');
    $downloadName = count($paths) === 1 ? basename(cleanRelPath($paths[0])) . '.zip' : 'download.zip';

    header('Content-Type: application/zip');
    header('Content-Disposition: attachment; filename="' . $downloadName . '"');
    header('Content-Length: ' . filesize($zipFile));
    readfile($zipFile);
    unlink($zipFile);
    exit;
}

if ($action === 'read_content') {
    $type = $_GET['type'] ?? 'private';
    $path = cleanRelPath($_GET['path'] ?? '');

    if ($type === 'public') {
        $path = str_starts_with($path, 'public/') ? substr($path, 7) : $path;
        $baseDir = $publicBase;
    } else {
        $path = str_starts_with($path, 'private/') ? substr($path, 8) : $path;
        $userPrefix = cleanRelPath($username) . '/';
        $path = str_starts_with($path, $userPrefix) ? substr($path, strlen($userPrefix)) : $path;
        $baseDir = $privateBase;
    }

    $targetFile = safePath($baseDir, $path);

    if (!is_file($targetFile)) {
        http_response_code(404);
        echo 'File not found';
        exit;
    }

    $ext = strtolower(pathinfo($targetFile, PATHINFO_EXTENSION));
    global $previewMime;
    $mime = $previewMime[$ext] ?? 'application/octet-stream';
    writeLog('READ', "Read file content: $path");
    header("Content-Type: $mime");
    header('Content-Length: ' . filesize($targetFile));
    readfile($targetFile);
    exit;
}


if ($action === 'csv_list') {
    $items = [];
    foreach ([['Private', $privateBase], ['Public', $publicBase]] as [$context, $base]) {
        if (!is_dir($base)) {
            continue;
        }
        $rootLen = strlen(rtrim(realpath($base), DIRECTORY_SEPARATOR)) + 1;
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $item) {
            if (!$item->isFile() || strtolower($item->getExtension()) !== 'csv') {
                continue;
            }
            if (str_contains($item->getPathname(), DIRECTORY_SEPARATOR . '.trash' . DIRECTORY_SEPARATOR)) {
                continue;
            }
            $items[] = [
                'name' => $item->getFilename(),
                'path' => str_replace(DIRECTORY_SEPARATOR, '/', substr($item->getPathname(), $rootLen)),
                'context' => $context,
                'size' => $item->getSize(),
                'modTime' => $item->getMTime()
            ];
        }
    }
    usort($items, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    jsonExit(['success' => true, 'items' => $items]);
}

if ($action === 'recent') {
    $items = [];
    foreach ([['Private', $privateBase], ['Public', $publicBase]] as [$context, $base]) {
        if (!is_dir($base)) {
            continue;
        }
        $rootLen = strlen(rtrim(realpath($base), DIRECTORY_SEPARATOR)) + 1;
        $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
        foreach ($iterator as $item) {
            if (!$item->isFile() || str_contains($item->getPathname(), DIRECTORY_SEPARATOR . '.trash' . DIRECTORY_SEPARATOR) || $item->getFilename() === '.stats_cache.json') {
                continue;
            }
            $items[] = [
                'name' => $item->getFilename(),
                'path' => str_replace(DIRECTORY_SEPARATOR, '/', substr($item->getPathname(), $rootLen)),
                'context' => $context,
                'type' => strtolower(pathinfo($item->getFilename(), PATHINFO_EXTENSION)),
                'modTime' => $item->getMTime(),
                'size' => $item->getSize()
            ];
        }
    }
    usort($items, fn($a, $b) => $b['modTime'] <=> $a['modTime']);
    jsonExit(['success' => true, 'items' => array_slice($items, 0, 25)]);
}

jsonExit(['success' => false, 'message' => 'Invalid action'], 400);
?>
