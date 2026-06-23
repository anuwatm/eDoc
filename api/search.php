<?php
// api/search.php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$username = $_SESSION['username'];
$query = trim($_GET['q'] ?? '');

if ($query === '') {
    echo json_encode(['success' => true, 'results' => []]);
    exit;
}

$results = [];

function searchDir($rootDir, $query, &$results, $context)
{
    if (!is_dir($rootDir)) {
        return;
    }

    $rootLen = strlen(rtrim($rootDir, DIRECTORY_SEPARATOR)) + 1;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($rootDir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $name = $item->getFilename();
        if (str_contains($item->getPathname(), DIRECTORY_SEPARATOR . '.trash' . DIRECTORY_SEPARATOR) || $name === '.stats_cache.json' || stripos($name, $query) === false) {
            continue;
        }

        $results[] = [
            'name' => $name,
            'path' => str_replace(DIRECTORY_SEPARATOR, '/', substr($item->getPathname(), $rootLen)),
            'context' => $context,
            'type' => $item->isDir() ? 'folder' : pathinfo($name, PATHINFO_EXTENSION)
        ];
    }
}

searchDir(__DIR__ . "/../eDoc/private/$username", $query, $results, 'Private');
searchDir(__DIR__ . "/../eDoc/public", $query, $results, 'Public');

echo json_encode(['success' => true, 'results' => $results]);
?>
