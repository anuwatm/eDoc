<?php
// api/auth.php
session_start();
header('Content-Type: application/json');
require_once 'db.php';

$action = $_POST['action'] ?? '';

if ($action === 'register') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if (empty($username) || strlen($password) < 6) {
        echo json_encode(['success' => false, 'message' => 'Invalid username or password (min 6 chars).']);
        exit;
    }

    // Check if user exists
    $stmt = $db->prepare("SELECT id FROM users WHERE username = ?");
    $stmt->execute([$username]);
    if ($stmt->fetch()) {
        echo json_encode(['success' => false, 'message' => 'Username already exists.']);
        exit;
    }

    // Create User Folders
    $userDir = __DIR__ . "/../eDoc/private/$username";
    if (!file_exists($userDir)) {
        mkdir($userDir, 0777, true);
        mkdir("$userDir/avatar", 0777, true);
        mkdir("$userDir/bg", 0777, true);
    }

    // Insert User
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $stmt = $db->prepare("INSERT INTO users (username, password, created_at) VALUES (?, ?, datetime('now'))");

    if ($stmt->execute([$username, $hash])) {
        echo json_encode(['success' => true, 'message' => 'Registration successful.']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Registration failed.']);
    }

} elseif ($action === 'login') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';
    $ip = $_SERVER['REMOTE_ADDR'];

    $stmt = $db->prepare("SELECT * FROM users WHERE username = ?");
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];

        // Update last login
        $update = $db->prepare("UPDATE users SET lastlogin = datetime('now'), ipaddress = ? WHERE id = ?");
        $update->execute([$ip, $user['id']]);

        echo json_encode(['success' => true]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid credentials.']);
    }

} elseif ($action === 'logout') {
    // Unset all session values
    $_SESSION = array();

    // Delete the session cookie
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }

    // Destroy the session
    session_destroy();
    
    echo json_encode(['success' => true]);
    exit;
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid action.']);
}
?>