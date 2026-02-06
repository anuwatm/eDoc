<?php
// api/files.php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$username = $_SESSION['username'];
$publicBase = __DIR__ . '/../eDoc/public';
$privateBase = __DIR__ . "/../eDoc/private/$username";

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Helper to sanitize and resolve paths
function resolvePath($requestedPath, $publicBase, $privateBase)
{
    if (strpos($requestedPath, 'public/') === 0) {
        $realBase = $publicBase;
        $relPath = substr($requestedPath, 7); // remove 'public/'
    } else {
        $realBase = $privateBase;
        $relPath = $requestedPath;
    }

    // Prevent traversal
    $relPath = str_replace('..', '', $relPath);
    $fullPath = $realBase . ($relPath ? '/' . $relPath : '');

    return [$fullPath, $realBase];
}

if ($action === 'list') {
    $type = $_GET['type'] ?? 'private'; // 'private' or 'public'
    $path = $_GET['path'] ?? '';

    $baseDir = ($type === 'public') ? $publicBase : $privateBase;
    $targetDir = $baseDir . ($path ? '/' . str_replace('..', '', $path) : '');

    if (!is_dir($targetDir)) {
        // Create if missing (sanity check)
        if (!mkdir($targetDir, 0777, true)) {
            echo json_encode(['success' => false, 'message' => 'Directory not found']);
            exit;
        }
    }

    $files = [];
    foreach (scandir($targetDir) as $item) {
        if ($item === '.' || $item === '..')
            continue;

        $fullPath = "$targetDir/$item";
        $files[] = [
            'name' => $item,
            'isDir' => is_dir($fullPath),
            'size' => is_dir($fullPath) ? 0 : filesize($fullPath),
            'modTime' => filemtime($fullPath),
            'type' => is_dir($fullPath) ? 'folder' : pathinfo($item, PATHINFO_EXTENSION),
            'relPath' => ($path ? "$path/" : "") . $item
        ];
    }

    echo json_encode(['success' => true, 'files' => $files]);

} elseif ($action === 'upload') {
    $type = $_POST['type'] ?? 'private';
    $path = $_POST['path'] ?? '';

    $baseDir = ($type === 'public') ? $publicBase : $privateBase;
    // Simple path sanitization
    $path = str_replace(['..', '\\'], '', $path);
    $targetDir = $baseDir . ($path ? '/' . $path : '');

    if (!is_dir($targetDir)) {
        if (!mkdir($targetDir, 0777, true)) {
            echo json_encode(['success' => false, 'message' => 'Target directory does not exist and cannot be created']);
            exit;
        }
    }

    // Handle multi-file upload
    if (isset($_FILES['files'])) {
        $files = $_FILES['files'];
        $uploaded = [];

        for ($i = 0; $i < count($files['name']); $i++) {
            $name = basename($files['name'][$i]);
            $tmp = $files['tmp_name'][$i];

            // Generate unique name if exists? For now, overwrite or simple append. 
            // Let's just overwrite for simplicity or standard OS behavior
            if (move_uploaded_file($tmp, "$targetDir/$name")) {
                $uploaded[] = $name;
            }
        }
        echo json_encode(['success' => true, 'uploaded' => $uploaded]);
    } else {
        echo json_encode(['success' => false, 'message' => 'No files sent']);
    }

} elseif ($action === 'delete') {
    $path = $_POST['path'] ?? ''; // relative to root context preference? No, let's explicit context
    $context = $_POST['context'] ?? 'private'; // public/private

    $base = ($context === 'public') ? $publicBase : $privateBase;
    $fullPath = $base . '/' . str_replace('..', '', $path);

    if (is_file($fullPath)) {
        unlink($fullPath);
        echo json_encode(['success' => true]);
    } elseif (is_dir($fullPath)) {
        // Simple Recursive Delete for folder
        // todo: unsafe for production without more checks, but ok for now
        rmdir($fullPath); // Only works if empty
        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Not found']);
    }

} elseif ($action === 'move' || $action === 'copy') {
    $srcPath = $_POST['src'] ?? '';
    $destPath = $_POST['dest'] ?? ''; // Format: public/foo.txt or foo.txt (implied private)

    // Simple implementation for now: assumes intra-context or explicit prefixes logic needed
    // For MVP/Proto, assume operations are within current User Context usually
    // Enhancing Resolve Logic:
    list($srcFile, ) = resolvePath($srcPath, $publicBase, $privateBase);
    list($destFile, ) = resolvePath($destPath, $publicBase, $privateBase);

    if (!file_exists($srcFile)) {
        echo json_encode(['success' => false, 'message' => 'Source not found']);
        exit;
    }

    if ($action === 'move') {
        rename($srcFile, $destFile);
    } else {
        copy($srcFile, $destFile);
    }
    echo json_encode(['success' => true]);

} else {
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
?>