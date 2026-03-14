<?php
// Test script for cache invalidation
require 'api/files.php'; // This also pulls in logger.php but script will stop at session check if uncommented directly.
// We will just directly test the invalidateStatsCache function

$testDir = __DIR__ . '/eDoc/public';
if (!is_dir($testDir)) mkdir($testDir, 0777, true);

// 1. Create a dummy cache file
$cacheFile = $testDir . '/.stats_cache.json';
file_put_contents($cacheFile, '{"test":true}');

echo "Cache exists: " . (file_exists($cacheFile) ? "YES" : "NO") . "\n";

// 2. Call invalidate
invalidateStatsCache($testDir);

echo "Cache exists after invalidation: " . (file_exists($cacheFile) ? "YES" : "NO") . "\n";

?>
