<?php
function jsonExit($payload, $code = 200)
{
    http_response_code($code);
    echo json_encode($payload);
    exit;
}

function apiSuccess($data = [], $code = 200)
{
    jsonExit(array_merge(['success' => true], $data), $code);
}

function apiError($message, $code = 400, $extra = [])
{
    jsonExit(array_merge(['success' => false, 'message' => $message], $extra), $code);
}
?>
