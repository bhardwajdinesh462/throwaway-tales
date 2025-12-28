<?php
/**
 * File Upload Handler
 * POST /api/storage/upload.php
 * 
 * Handles secure file uploads for avatars, attachments, etc.
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

$user = Auth::getCurrentUser();
$config = Database::getConfig();

$uploadConfig = $config['uploads'] ?? [];
$uploadPath = $uploadConfig['path'] ?? dirname(__DIR__, 2) . '/uploads';
$maxSizeMB = $uploadConfig['max_size_mb'] ?? 25;
$maxSize = $maxSizeMB * 1024 * 1024;
$allowedTypes = $uploadConfig['allowed_types'] ?? [];

// Get upload type (avatar, attachment, backup)
$type = $_POST['type'] ?? 'attachment';
$validTypes = ['avatar', 'attachment', 'backup'];

if (!in_array($type, $validTypes)) {
    Response::error('Invalid upload type');
}

// Require auth for certain types
if ($type === 'avatar' && !$user) {
    Response::unauthorized('Authentication required for avatar upload');
}

if ($type === 'backup') {
    Auth::requireAdmin();
}

// Check if file was uploaded
if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE => 'File exceeds server maximum size',
        UPLOAD_ERR_FORM_SIZE => 'File exceeds form maximum size',
        UPLOAD_ERR_PARTIAL => 'File was only partially uploaded',
        UPLOAD_ERR_NO_FILE => 'No file was uploaded',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing temporary folder',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to disk',
        UPLOAD_ERR_EXTENSION => 'A PHP extension stopped the upload'
    ];
    
    $error = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
    Response::error($errorMessages[$error] ?? 'Upload failed');
}

$file = $_FILES['file'];

try {
    // Validate file size
    if ($file['size'] > $maxSize) {
        Response::error("File size exceeds maximum of {$maxSizeMB}MB");
    }
    
    // Validate MIME type
    $mimeType = mime_content_type($file['tmp_name']);
    
    if (!empty($allowedTypes) && !in_array($mimeType, $allowedTypes)) {
        Response::error('File type not allowed: ' . $mimeType);
    }
    
    // Additional security: check for PHP in files
    $content = file_get_contents($file['tmp_name'], false, null, 0, 1024);
    if (preg_match('/<\?php|<\?=/i', $content)) {
        Response::error('Invalid file content');
    }
    
    // Generate unique filename
    $fileId = Database::generateUUID();
    $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    
    // Sanitize extension
    $extension = preg_replace('/[^a-z0-9]/', '', $extension);
    if (empty($extension)) {
        $extension = 'bin';
    }
    
    // Build storage path based on type
    switch ($type) {
        case 'avatar':
            $storagePath = 'avatars/' . $user['id'] . '/' . $fileId . '.' . $extension;
            break;
        case 'backup':
            $storagePath = 'backups/' . date('Y/m') . '/' . $fileId . '.' . $extension;
            break;
        default:
            $storagePath = 'attachments/' . date('Y/m/d') . '/' . $fileId . '.' . $extension;
    }
    
    $fullPath = $uploadPath . '/' . $storagePath;
    
    // Create directory if needed
    $dir = dirname($fullPath);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0755, true)) {
            Response::serverError('Failed to create upload directory');
        }
    }
    
    // Move uploaded file
    if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
        Response::serverError('Failed to save uploaded file');
    }
    
    // Set proper permissions
    chmod($fullPath, 0644);
    
    // Generate access token for the file
    $accessToken = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $accessToken);
    
    // Store file metadata in database
    Database::insert('file_uploads', [
        'id' => $fileId,
        'user_id' => $user ? $user['id'] : null,
        'original_filename' => $file['name'],
        'storage_path' => $storagePath,
        'mime_type' => $mimeType,
        'size' => $file['size'],
        'type' => $type,
        'token_hash' => $tokenHash,
        'expires_at' => $type === 'attachment' ? date('Y-m-d H:i:s', time() + 86400 * 7) : null,
        'created_at' => date('Y-m-d H:i:s')
    ]);
    
    // If avatar, update user profile
    if ($type === 'avatar' && $user) {
        $avatarUrl = '/api/storage/download.php?id=' . $fileId . '&token=' . $accessToken;
        
        Database::update(
            'profiles',
            ['avatar_url' => $avatarUrl, 'updated_at' => date('Y-m-d H:i:s')],
            'user_id = ?',
            [$user['id']]
        );
    }
    
    // Build download URL
    $downloadUrl = '/api/storage/download.php?id=' . $fileId . '&token=' . $accessToken;
    
    Response::success([
        'id' => $fileId,
        'filename' => $file['name'],
        'size' => $file['size'],
        'mime_type' => $mimeType,
        'url' => $downloadUrl,
        'token' => $accessToken
    ], 'File uploaded successfully', 201);
    
} catch (Exception $e) {
    error_log("Upload error: " . $e->getMessage());
    Response::serverError('Upload failed');
}
