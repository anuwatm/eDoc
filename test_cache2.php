<?php
// Test script for cache invalidation isolated

// CACHE INVALIDATION
function invalidateStatsCache($baseDir) {
    $cacheFile = $baseDir . '/.stats_cache.json';
    if (file_exists($cacheFile)) {
        unlink($cacheFile);
    }
}

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
