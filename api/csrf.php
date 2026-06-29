<?php

function ensureCsrfToken(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function validateCsrfToken(): bool
{
    if (empty($_SESSION['csrf_token'])) {
        return false;
    }
    $token = $_POST['csrf_token'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    return $token !== '' && hash_equals($_SESSION['csrf_token'], $token);
}

function requireCsrfForPost(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        return;
    }
    if (!validateCsrfToken()) {
        http_response_code(403);
        header('Content-Type: application/json');
        echo json_encode(['success' => false, 'message' => 'Invalid CSRF token']);
        exit;
    }
}