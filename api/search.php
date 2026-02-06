<?php
// api/search.php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$username = $_SESSION['username'];
$query = $_GET['q'] ?? '';

if (strlen($query) < 1) {
    echo json_encode(['success' => true, 'results' => []]);
    exit;
}

$results = [];

// Helper to recursive search
function searchDir($dir, $baseRel, $query, &$results, $context)
{
    if (!is_dir($dir))
        return;

    $files = scandir($dir);
    foreach ($files as $file) {
        if ($file === '.' || $file === '..')
            continue;

        $path = "$dir/$file";
        $relPath = ($baseRel ? "$baseRel/" : "") . $file;

        if (stripos($file, $query) !== false) {
            $results[] = [
                'name' => $file,
                'path' => $relPath,
                'context' => $context, // Public or Private
                'type' => is_dir($path) ? 'folder' : pathinfo($file, PATHINFO_EXTENSION)
            ];
        }

        if (is_dir($path)) {
            searchDir($path, $relPath, $query, $results, $context);
        }
    }
}

// 1. Search Private
searchDir(__DIR__ . "/../eDoc/private/$username", "", $query, $results, 'Private');

// 2. Search Public
searchDir(__DIR__ . "/../eDoc/public", "", $query, $results, 'Public');

echo json_encode(['success' => true, 'results' => $results]);
?>