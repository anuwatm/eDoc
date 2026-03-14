<?php
// api/db.php
$dbPath = __DIR__ . '/../database/vDesktop.sqlite';

try {
    $db = new PDO("sqlite:$dbPath");
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Performance optimizations
    $db->exec("PRAGMA journal_mode = WAL;");
    $db->exec("PRAGMA synchronous = NORMAL;");
    $db->exec("PRAGMA temp_store = MEMORY;");

    // Create users table if not exists
    $db->exec("CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        ipaddress TEXT,
        lastlogin DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )");

} catch (PDOException $e) {
    die(json_encode(['error' => "Database connection failed: " . $e->getMessage()]));
}

