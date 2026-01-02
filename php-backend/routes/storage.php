<?php
/**
 * Storage Routes - File upload/download
 */

// Wrapper function called by index.php
function handleStorageRoute($segments, $method, $pdo, $config) {
    array_shift($segments); // Remove 'storage' prefix
    $action = implode('/', $segments);
    return handleStorage($action, $method, $pdo, $config);
}

function handleStorage($action, $method, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;

    switch ($action) {
        case 'upload':
            handleUpload($pdo, $config, $userId);
            break;
        case 'download':
            handleDownload($pdo, $config, $userId);
            break;
        case 'delete':
            handleStorageDelete($pdo, $config, $userId);
            break;
        default:
            // Check for public file access: public/{bucket}/{path}
            if (preg_match('#^public/([^/]+)/(.+)$#', $action, $matches)) {
                servePublicFile($matches[1], $matches[2], $config);
            } else {
                http_response_code(404);
                echo json_encode(['error' => 'Unknown storage action']);
            }
    }
}

function handleUpload($pdo, $config, $userId) {
    if (!isset($_FILES['file'])) {
        http_response_code(400);
        echo json_encode(['error' => 'No file uploaded']);
        return;
    }

    $file = $_FILES['file'];
    $bucket = $_POST['bucket'] ?? 'default';
    $path = $_POST['path'] ?? null;

    // Validate file
    if ($file['error'] !== UPLOAD_ERR_OK) {
        http_response_code(400);
        echo json_encode(['error' => 'Upload error: ' . $file['error']]);
        return;
    }

    $maxSize = $config['storage']['max_size'] ?? 10485760; // 10MB default
    if ($file['size'] > $maxSize) {
        http_response_code(400);
        echo json_encode(['error' => 'File too large. Maximum size: ' . round($maxSize / 1048576, 1) . 'MB']);
        return;
    }

    // Check file type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);

    $allowedTypes = $config['storage']['allowed_types'] ?? ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!in_array($mimeType, $allowedTypes)) {
        http_response_code(400);
        echo json_encode(['error' => 'File type not allowed: ' . $mimeType]);
        return;
    }

    // Create storage path
    $storagePath = $config['storage']['path'] ?? __DIR__ . '/../storage';
    $bucketPath = $storagePath . '/' . preg_replace('/[^a-z0-9_-]/', '', $bucket);

    if (!is_dir($bucketPath)) {
        mkdir($bucketPath, 0755, true);
    }

    // Generate unique filename if not provided
    if (!$path) {
        $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
        $path = bin2hex(random_bytes(16)) . '.' . $ext;
    }

    // Sanitize path
    $path = preg_replace('/\.\./', '', $path); // Prevent directory traversal
    $fullPath = $bucketPath . '/' . $path;

    // Create subdirectories if needed
    $dir = dirname($fullPath);
    if (!is_dir($dir)) {
        mkdir($dir, 0755, true);
    }

    if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
        http_response_code(500);
        echo json_encode(['error' => 'Failed to save file']);
        return;
    }

    // Generate URL
    $baseUrl = rtrim($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com', '/');
    $url = "$baseUrl/api/storage/public/$bucket/$path";

    echo json_encode([
        'path' => $path,
        'url' => $url,
        'bucket' => $bucket,
        'size' => $file['size'],
        'type' => $mimeType,
    ]);
}

function handleDownload($pdo, $config, $userId) {
    $bucket = $_GET['bucket'] ?? '';
    $path = $_GET['path'] ?? '';

    if (empty($bucket) || empty($path)) {
        http_response_code(400);
        echo json_encode(['error' => 'Bucket and path required']);
        return;
    }

    $storagePath = $config['storage']['path'] ?? __DIR__ . '/../storage';
    $fullPath = $storagePath . '/' . preg_replace('/[^a-z0-9_-]/', '', $bucket) . '/' . $path;

    // Prevent directory traversal
    $realPath = realpath($fullPath);
    $realStoragePath = realpath($storagePath);

    if (!$realPath || strpos($realPath, $realStoragePath) !== 0) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found']);
        return;
    }

    if (!file_exists($realPath)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found']);
        return;
    }

    // Serve file
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $realPath);
    finfo_close($finfo);

    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($realPath));
    header('Content-Disposition: attachment; filename="' . basename($path) . '"');
    
    readfile($realPath);
    exit;
}

function handleStorageDelete($pdo, $config, $userId) {
    $body = json_decode(file_get_contents('php://input'), true);
    $bucket = $body['bucket'] ?? '';
    $paths = $body['paths'] ?? [];

    if (empty($bucket) || empty($paths)) {
        http_response_code(400);
        echo json_encode(['error' => 'Bucket and paths required']);
        return;
    }

    $storagePath = $config['storage']['path'] ?? __DIR__ . '/../storage';
    $bucketPath = $storagePath . '/' . preg_replace('/[^a-z0-9_-]/', '', $bucket);

    $deleted = [];
    $failed = [];

    foreach ($paths as $path) {
        $fullPath = $bucketPath . '/' . $path;
        $realPath = realpath($fullPath);
        $realStoragePath = realpath($storagePath);

        if ($realPath && strpos($realPath, $realStoragePath) === 0 && file_exists($realPath)) {
            if (unlink($realPath)) {
                $deleted[] = $path;
            } else {
                $failed[] = $path;
            }
        } else {
            $failed[] = $path;
        }
    }

    echo json_encode([
        'deleted' => $deleted,
        'failed' => $failed,
    ]);
}

function servePublicFile($bucket, $path, $config) {
    $storagePath = $config['storage']['path'] ?? __DIR__ . '/../storage';
    $fullPath = $storagePath . '/' . preg_replace('/[^a-z0-9_-]/', '', $bucket) . '/' . $path;

    // Prevent directory traversal
    $realPath = realpath($fullPath);
    $realStoragePath = realpath($storagePath);

    if (!$realPath || strpos($realPath, $realStoragePath) !== 0) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found']);
        return;
    }

    if (!file_exists($realPath)) {
        http_response_code(404);
        echo json_encode(['error' => 'File not found']);
        return;
    }

    // Determine MIME type
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $realPath);
    finfo_close($finfo);

    // Cache headers for public files
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . filesize($realPath));
    header('Cache-Control: public, max-age=31536000');
    header('ETag: "' . md5_file($realPath) . '"');

    readfile($realPath);
    exit;
}
