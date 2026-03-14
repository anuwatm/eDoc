<?php
/**
 * eDoc System Configuration Checker
 * This script checks if the server environment meets the requirements to run eDoc.
 */
session_start();

// Handle Auto-Fix Actions
$fixMessage = '';
$fixStatus = '';

if (isset($_GET['fix'])) {
    $action = $_GET['fix'];
    if ($action === 'dir' && isset($_GET['path'])) {
        $targetDir = __DIR__ . $_GET['path'];
        // Validate path is within expected directories to prevent arbitrary dir creation
        $validDirs = ['/database', '/logs', '/eDoc/private', '/eDoc/private/avatar', '/eDoc/private/bg'];
        $isValid = false;
        foreach ($validDirs as $vd) {
            if ($_GET['path'] === $vd) {
                $isValid = true; break;
            }
        }
        
        if ($isValid) {
            if (!file_exists($targetDir)) {
                if (@mkdir($targetDir, 0777, true)) {
                    $fixMessage = "Successfully created directory: " . htmlspecialchars($_GET['path']);
                    $fixStatus = 'success';
                } else {
                    $fixMessage = "Failed to create directory: " . htmlspecialchars($_GET['path']) . ". Please check parent permissions.";
                    $fixStatus = 'error';
                }
            } else {
                $fixMessage = "Directory already exists.";
                $fixStatus = 'success';
            }
        } else {
            $fixMessage = "Invalid directory path provided for fix.";
            $fixStatus = 'error';
        }
    } elseif ($action === 'db') {
        $dbFile = __DIR__ . '/database/vDesktop.sqlite';
        $dbDir = __DIR__ . '/database';
        
        if (!file_exists($dbDir)) {
            @mkdir($dbDir, 0777, true);
        }
        
        if (!file_exists($dbFile)) {
            try {
                $db = new PDO("sqlite:" . $dbFile);
                $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                $db->exec("PRAGMA journal_mode = WAL;");
            } catch (PDOException $e) {
                $fixMessage = "Failed to create database: " . $e->getMessage();
                $fixStatus = 'error';
            }
        } else {
            try {
                $db = new PDO("sqlite:" . $dbFile);
                $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            } catch (PDOException $e) {
                $fixMessage = "Failed to connect to database: " . $e->getMessage();
                $fixStatus = 'error';
            }
        }
        
        if (isset($db)) {
            // Initialize database structure based on expected tables
            $expectedTablesInfo = [
                'users' => "CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password TEXT NOT NULL,
                    ipaddress TEXT,
                    lastlogin DATETIME,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )"
            ];
            
            try {
                foreach ($expectedTablesInfo as $tableName => $createQuery) {
                    $db->exec($createQuery);
                }
                $fixMessage = "Successfully created and initialized database tables.";
                $fixStatus = 'success';
            } catch (PDOException $e) {
                $fixMessage = "Failed to create tables: " . $e->getMessage();
                $fixStatus = 'error';
            }
        }
    }
}

$requirements = [
    'php_version' => '7.4.0',
    'extensions' => [
        'pdo',
        'pdo_sqlite',
        'sqlite3',
        'json',
        'mbstring',
        'gd',
        'curl',
        'xml',
        'fileinfo'
    ],
    'directories' => [
        __DIR__ . '/database',
        __DIR__ . '/logs',
        __DIR__ . '/eDoc/private',
    ]
];

// 1. Check PHP Version
$phpVersion = phpversion();
$phpVersionOk = version_compare($phpVersion, $requirements['php_version'], '>=');

// 2. Check Extensions
$extensionsStatus = [];
$allExtensionsOk = true;
foreach ($requirements['extensions'] as $ext) {
    if (extension_loaded($ext)) {
        $extensionsStatus[$ext] = true;
    } else {
        $extensionsStatus[$ext] = false;
        $allExtensionsOk = false;
    }
}

// 3. Check Directory Permissions
$directoriesStatus = [];
$allDirectoriesOk = true;
foreach ($requirements['directories'] as $dir) {
    $relativePath = str_replace(__DIR__, '', $dir);
    if (!file_exists($dir)) {
        $directoriesStatus[$relativePath] = ['status' => false, 'message' => 'Directory does not exist.', 'fixable' => true, 'fix_action' => 'dir&path=' . urlencode($relativePath), 'advice' => ''];
        $allDirectoriesOk = false;
    } elseif (!is_writable($dir)) {
        $directoriesStatus[$relativePath] = ['status' => false, 'message' => 'Directory is not writable.', 'fixable' => false, 'advice' => 'Please run <code>chmod -R 775 ' . htmlspecialchars($relativePath) . '</code> and change owner to web server user (e.g. www-data).'];
        $allDirectoriesOk = false;
    } else {
        $directoriesStatus[$relativePath] = ['status' => true, 'message' => 'Writable', 'fixable' => false];
    }
}

// 4. Check Database Connection & Tables
$dbStatus = ['status' => false, 'message' => '', 'fixable' => false, 'advice' => ''];
$tablesStatus = [];
$expectedTables = ['users']; // Add any future tables here
$dbFile = __DIR__ . '/database/vDesktop.sqlite';

if(!file_exists($dbFile)) {
    $dbStatus['message'] = 'Database file does not exist.';
    $dbStatus['fixable'] = true;
    $dbStatus['fix_action'] = 'db';
    foreach($expectedTables as $tbl) $tablesStatus[$tbl] = false;
} else if (!is_writable($dbFile)) {
    $dbStatus['message'] = 'Database file is not writable.';
    $dbStatus['fixable'] = false;
    $dbStatus['advice'] = 'Please check the file permissions for <code>database/vDesktop.sqlite</code>.';
    foreach($expectedTables as $tbl) $tablesStatus[$tbl] = false; // Cannot verify if not writable/readable securely
} else {
    try {
        $db = new PDO("sqlite:" . $dbFile);
        $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        $missingTables = [];
        foreach ($expectedTables as $tableName) {
            $stmt = $db->query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='$tableName'");
            if ($stmt && $stmt->fetchColumn() > 0) {
                $tablesStatus[$tableName] = true;
            } else {
                $tablesStatus[$tableName] = false;
                $missingTables[] = $tableName;
            }
        }
        
        if (empty($missingTables)) {
             $dbStatus = ['status' => true, 'message' => 'Connected successfully and all tables found.', 'fixable'=>false];
        } else {
             $dbStatus = ['status' => false, 'message' => 'Database exists but some tables are missing (' . implode(', ', $missingTables) . ').', 'fixable' => true, 'fix_action' => 'db'];
        }
    } catch (PDOException $e) {
        $dbStatus = ['status' => false, 'message' => 'Connection failed: ' . $e->getMessage(), 'fixable'=>false];
        foreach($expectedTables as $tbl) $tablesStatus[$tbl] = false;
    }
}

// 5. Check PHP Settings
$phpSettings = [
    'upload_max_filesize' => ini_get('upload_max_filesize'),
    'post_max_size' => ini_get('post_max_size'),
    'memory_limit' => ini_get('memory_limit'),
    'max_execution_time' => ini_get('max_execution_time') . 's',
    'file_uploads' => ini_get('file_uploads') ? 'Enabled' : 'Disabled',
];

$overallStatus = $phpVersionOk && $allExtensionsOk && $allDirectoriesOk && $dbStatus['status'];

?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>eDoc System Check</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0f172a;
            --card-bg: #1e293b;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --border-color: #334155;
            --success-color: #10b981;
            --success-bg: rgba(16, 185, 129, 0.1);
            --error-color: #ef4444;
            --error-bg: rgba(239, 68, 68, 0.1);
            --warning-color: #f59e0b;
            --warning-bg: rgba(245, 158, 11, 0.1);
            --primary-color: #3b82f6;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.6;
            padding: 2rem 1rem;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
        }

        .header {
            text-align: center;
            margin-bottom: 2.5rem;
            animation: fadeInDown 0.8s ease-out;
        }

        .header h1 {
            font-size: 2.5rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            background: linear-gradient(135deg, #60a5fa, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .header p {
            color: var(--text-muted);
            font-size: 1.1rem;
        }

        .overall-status {
            padding: 1.5rem;
            border-radius: 12px;
            margin-bottom: 2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 1rem;
            font-size: 1.25rem;
            font-weight: 600;
            animation: fadeIn 1s ease-out;
            border: 1px solid transparent;
        }

        .status-pass {
            background-color: var(--success-bg);
            color: var(--success-color);
            border-color: rgba(16, 185, 129, 0.2);
        }

        .status-fail {
            background-color: var(--error-bg);
            color: var(--error-color);
            border-color: rgba(239, 68, 68, 0.2);
        }

        .section {
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            margin-bottom: 1.5rem;
            overflow: hidden;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            animation: slideUp 0.6s ease-out both;
        }

        .section:nth-child(3) { animation-delay: 0.1s; }
        .section:nth-child(4) { animation-delay: 0.2s; }
        .section:nth-child(5) { animation-delay: 0.3s; }
        .section:nth-child(6) { animation-delay: 0.4s; }
        .section:nth-child(7) { animation-delay: 0.5s; }

        .section-header {
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            background-color: rgba(0, 0, 0, 0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .section-title {
            font-size: 1.25rem;
            font-weight: 600;
            color: #e2e8f0;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .section-content {
            padding: 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
        }

        th, td {
            padding: 1rem 1.5rem;
            text-align: left;
            border-bottom: 1px solid var(--border-color);
        }

        th {
            color: var(--text-muted);
            font-weight: 500;
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        tr:last-child td {
            border-bottom: none;
        }

        tr:hover td {
            background-color: rgba(255, 255, 255, 0.02);
        }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
        }

        .badge-success {
            background-color: var(--success-bg);
            color: var(--success-color);
        }

        .badge-error {
            background-color: var(--error-bg);
            color: var(--error-color);
        }

        .badge-info {
            background-color: rgba(59, 130, 246, 0.1);
            color: #60a5fa;
        }

        .icon {
            width: 1.25rem;
            height: 1.25rem;
        }
        
        .icon-large {
            width: 2rem;
            height: 2rem;
        }
        
        .fix-btn {
            display: inline-block;
            padding: 0.35rem 0.8rem;
            background-color: var(--primary-color);
            color: white;
            border-radius: 6px;
            text-decoration: none;
            font-size: 0.8rem;
            font-weight: 600;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
            margin-top: 0.5rem;
        }

        .fix-btn:hover {
            background-color: #2563eb;
            transform: translateY(-1px);
        }
        
        .advice-text {
            display: block;
            margin-top: 0.5rem;
            font-size: 0.85rem;
            color: var(--warning-color);
            background: var(--warning-bg);
            padding: 0.5rem;
            border-radius: 6px;
            border-left: 3px solid var(--warning-color);
        }
        
        .advice-text code {
            background: rgba(0,0,0,0.3);
            padding: 2px 4px;
            border-radius: 4px;
            font-family: monospace;
        }
        
        .alert {
            padding: 1rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            animation: fadeInDown 0.5s ease-out;
        }
        .alert-success { background: var(--success-bg); color: var(--success-color); border: 1px solid rgba(16, 185, 129, 0.2); }
        .alert-error { background: var(--error-bg); color: var(--error-color); border: 1px solid rgba(239, 68, 68, 0.2); }

        @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .footer {
            text-align: center;
            margin-top: 3rem;
            padding-bottom: 2rem;
            color: var(--text-muted);
            font-size: 0.875rem;
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <h1>eDoc System Check</h1>
        <p>Verify your server configuration for optimal performance</p>
    </div>

    <?php if ($fixMessage): ?>
        <div class="alert alert-<?php echo $fixStatus; ?>">
            <strong><?php echo ucfirst($fixStatus); ?>:</strong> <?php echo $fixMessage; ?>
        </div>
    <?php endif; ?>

    <div class="overall-status <?php echo $overallStatus ? 'status-pass' : 'status-fail'; ?>">
        <?php if ($overallStatus): ?>
            <svg class="icon-large" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            All Systems Go! Your environment is ready.
        <?php else: ?>
            <svg class="icon-large" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            System Check Failed. Please resolve the issues below.
        <?php endif; ?>
    </div>

    <!-- PHP Version -->
    <div class="section">
        <div class="section-header">
            <h2 class="section-title">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>
                PHP Environment
            </h2>
        </div>
        <div class="section-content">
            <table>
                <tr>
                    <td>PHP Version</td>
                    <td>Required: <?php echo $requirements['php_version']; ?>+</td>
                    <td>
                        <?php echo $phpVersion; ?>
                        <?php if(!$phpVersionOk): ?>
                            <div class="advice-text">Please upgrade your PHP version via your hosting control panel or server package manager. eDoc requires at least PHP 7.4.</div>
                        <?php endif; ?>
                    </td>
                    <td style="text-align: right; vertical-align: top;">
                        <span class="badge <?php echo $phpVersionOk ? 'badge-success' : 'badge-error'; ?>">
                            <?php echo $phpVersionOk ? 'Passed' : 'Failed'; ?>
                        </span>
                    </td>
                </tr>
            </table>
        </div>
    </div>

    <!-- Required Extensions -->
    <div class="section">
        <div class="section-header">
            <h2 class="section-title">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2zM6 20h2a2 2 0 002-2v-2a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2z"></path></svg>
                PHP Extensions
            </h2>
        </div>
        <div class="section-content">
            <table>
                <thead>
                    <tr>
                        <th>Extension</th>
                        <th>Status</th>
                        <th style="text-align: right;">Result</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($extensionsStatus as $ext => $isLoaded): ?>
                    <tr>
                        <td style="vertical-align: top;"><?php echo $ext; ?></td>
                        <td>
                            <?php echo $isLoaded ? 'Loaded' : 'Missing'; ?>
                            <?php if(!$isLoaded): ?>
                                <div class="advice-text">Please enable the <code><?php echo $ext; ?></code> extension in your php.ini configuration file and restart your web server.</div>
                            <?php endif; ?>
                        </td>
                        <td style="text-align: right; vertical-align: top;">
                            <span class="badge <?php echo $isLoaded ? 'badge-success' : 'badge-error'; ?>">
                                <?php echo $isLoaded ? 'Passed' : 'Failed'; ?>
                            </span>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Directory Permissions -->
    <div class="section">
        <div class="section-header">
            <h2 class="section-title">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                Directory Permissions
            </h2>
        </div>
        <div class="section-content">
            <table>
                <thead>
                    <tr>
                        <th>Directory</th>
                        <th>Status</th>
                        <th style="text-align: right;">Result</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($directoriesStatus as $dir => $status): ?>
                    <tr>
                        <td style="vertical-align: top;"><?php echo $dir; ?></td>
                        <td>
                            <?php echo $status['message']; ?>
                            <?php if (!$status['status'] && isset($status['fixable']) && $status['fixable']): ?>
                                <br><a href="?fix=<?php echo $status['fix_action']; ?>" class="fix-btn">Auto Fix (Create Dir)</a>
                            <?php elseif (!$status['status'] && isset($status['advice'])): ?>
                                <div class="advice-text"><?php echo $status['advice']; ?></div>
                            <?php endif; ?>
                        </td>
                        <td style="text-align: right; vertical-align: top;">
                            <span class="badge <?php echo $status['status'] ? 'badge-success' : 'badge-error'; ?>">
                                <?php echo $status['status'] ? 'Passed' : 'Failed'; ?>
                            </span>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <!-- Database Connection and Tables -->
    <div class="section">
        <div class="section-header">
            <h2 class="section-title">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
                Database Connectivity & Tables (SQLite)
            </h2>
        </div>
        <div class="section-content">
            <table>
                <tr>
                    <td style="vertical-align: top; width: 30%;">Connection Status</td>
                    <td>
                        <?php echo htmlspecialchars($dbStatus['message']); ?>
                        <?php if (!$dbStatus['status'] && isset($dbStatus['fixable']) && $dbStatus['fixable']): ?>
                            <br><a href="?fix=<?php echo $dbStatus['fix_action']; ?>" class="fix-btn">Auto Fix (Create DB & Missing Tables)</a>
                        <?php elseif (!$dbStatus['status'] && isset($dbStatus['advice']) && $dbStatus['advice']): ?>
                            <div class="advice-text"><?php echo $dbStatus['advice']; ?></div>
                        <?php endif; ?>
                    </td>
                    <td style="text-align: right; vertical-align: top;">
                        <span class="badge <?php echo $dbStatus['status'] ? 'badge-success' : 'badge-error'; ?>">
                            <?php echo $dbStatus['status'] ? 'Passed' : 'Failed'; ?>
                        </span>
                    </td>
                </tr>
                <?php if (isset($tablesStatus) && count($tablesStatus) > 0): ?>
                <tr>
                    <td style="vertical-align: top; width: 30%;">Expected Tables</td>
                    <td colspan="2">
                        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
                            <?php foreach ($tablesStatus as $tableName => $exists): ?>
                                <span class="badge <?php echo $exists ? 'badge-info' : 'badge-error'; ?>">
                                    <svg class="icon" style="width: 1rem; height: 1rem; margin-right: 0.25rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                                    <?php echo $tableName; ?>: <?php echo $exists ? 'OK' : 'Missing'; ?>
                                </span>
                            <?php endforeach; ?>
                        </div>
                    </td>
                </tr>
                <?php endif; ?>
            </table>
        </div>
    </div>

    <!-- PHP Options & Settings -->
    <div class="section">
        <div class="section-header">
            <h2 class="section-title">
                <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
                Key PHP Settings
            </h2>
        </div>
        <div class="section-content">
            <table>
                <thead>
                    <tr>
                        <th>Directive</th>
                        <th style="text-align: right;">Local Value</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($phpSettings as $key => $val): ?>
                    <tr>
                        <td><?php echo $key; ?></td>
                        <td style="text-align: right;">
                            <span class="badge badge-info"><?php echo $val; ?></span>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>

    <div class="footer">
        Generated by eDoc System Check on <?php echo date('Y-m-d H:i:s'); ?>
    </div>
</div>

</body>
</html>
