<?php
// api/settings.php
session_start();
header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$username = $_SESSION['username'];
$userDir = __DIR__ . "/../eDoc/private/$username";

$type = $_POST['type'] ?? '';

if (isset($_FILES['file'])) {
    $file = $_FILES['file'];
    $tmp = $file['tmp_name'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'gif'])) {
        echo json_encode(['success' => false, 'message' => 'Invalid image format']);
        exit;
    }

    if ($type === 'avatar') {
        $target = "$userDir/avatar/avatar.$ext";
        // Remove old avatars if strictly one is allowed or just overwrite
        array_map('unlink', glob("$userDir/avatar/avatar.*"));
        if (move_uploaded_file($tmp, $target)) {
            echo json_encode(['success' => true, 'url' => "eDoc/private/$username/avatar/avatar.$ext"]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Upload failed']);
        }
    } elseif ($type === 'bg') {
        $target = "$userDir/bg/bg.$ext";
        array_map('unlink', glob("$userDir/bg/bg.*"));
        if (move_uploaded_file($tmp, $target)) {
            echo json_encode(['success' => true, 'url' => "eDoc/private/$username/bg/bg.$ext"]);
        } else {
            echo json_encode(['success' => false, 'message' => 'Upload failed']);
        }
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid type']);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'No file uploaded']);
}
?>