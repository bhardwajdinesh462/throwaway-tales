<?php
/**
 * File Download Handler
 * GET /api/storage/download.php?id=xxx&token=xxx
 * 
 * Secure file downloads with token validation
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';

// Don't use Response class for file downloads
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$fileId = $_GET['id'] ?? '';
$token = $_GET['token'] ?? '';
$download = isset($_GET['download']);

if (empty($fileId)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'File ID is required']);
    exit;
}

try {
    $config = Database::getConfig();
    $uploadPath = $config['uploads']['path'] ?? dirname(__DIR__, 2) . '/uploads';
    
    // Try to find file by ID
    $file = Database::fetchOne(
        "SELECT * FROM file_uploads WHERE id = ?",
        [$fileId]
    );
    
    // Also check email_attachments table
    if (!$file) {
        $file = Database::fetchOne(
            "SELECT ea.*, ea.filename as original_filename 
             FROM email_attachments ea 
             WHERE ea.id = ?",
            [$fileId]
        );
    }
    
    if (!$file) {
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'File not found']);
        exit;
    }
    
    // Validate token if file has one
    if (!empty($file['token_hash'])) {
        if (empty($token)) {
            http_response_code(401);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Access token required']);
            exit;
        }
        
        $providedHash = hash('sha256', $token);
        if (!hash_equals($file['token_hash'], $providedHash)) {
            http_response_code(403);
            header('Content-Type: application/json');
            echo json_encode(['error' => 'Invalid access token']);
            exit;
        }
    }
    
    // Check expiry
    if (!empty($file['expires_at']) && strtotime($file['expires_at']) < time()) {
        http_response_code(410);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'File has expired']);
        exit;
    }
    
    // For email attachments, validate via email token
    if (isset($file['email_id']) && empty($file['token_hash'])) {
        // Get the email and validate access
        $emailToken = $_GET['email_token'] ?? '';
        
        if (!empty($emailToken)) {
            $tokenHash = hash('sha256', $emailToken);
            $email = Database::fetchOne(
                "SELECT re.*, te.token_hash 
                 FROM received_emails re
                 JOIN temp_emails te ON te.id = re.temp_email_id
                 WHERE re.id = ? AND te.token_hash = ?",
                [$file['email_id'], $tokenHash]
            );
            
            if (!$email) {
                http_response_code(403);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Access denied']);
                exit;
            }
        } else {
            // Require authentication
            $user = Auth::getCurrentUser();
            if (!$user) {
                http_response_code(401);
                header('Content-Type: application/json');
                echo json_encode(['error' => 'Authentication required']);
                exit;
            }
        }
    }
    
    // Build file path
    $filePath = $uploadPath . '/' . $file['storage_path'];
    
    if (!file_exists($filePath)) {
        error_log("File not found on disk: " . $filePath);
        http_response_code(404);
        header('Content-Type: application/json');
        echo json_encode(['error' => 'File not found on disk']);
        exit;
    }
    
    // Get file info
    $mimeType = $file['mime_type'] ?? mime_content_type($filePath);
    $fileSize = filesize($filePath);
    $filename = $file['original_filename'] ?? $file['filename'] ?? basename($filePath);
    
    // Sanitize filename for Content-Disposition
    $safeFilename = preg_replace('/[^\x20-\x7E]/', '', $filename);
    $safeFilename = str_replace(['"', '\\'], '', $safeFilename);
    
    // Set headers
    header('Content-Type: ' . $mimeType);
    header('Content-Length: ' . $fileSize);
    header('Accept-Ranges: bytes');
    header('Cache-Control: private, max-age=3600');
    header('ETag: "' . md5($fileId . $file['created_at']) . '"');
    
    if ($download) {
        header('Content-Disposition: attachment; filename="' . $safeFilename . '"');
    } else {
        // Inline for images and PDFs
        $inlineTypes = ['image/', 'application/pdf', 'text/'];
        $isInline = false;
        foreach ($inlineTypes as $type) {
            if (strpos($mimeType, $type) === 0) {
                $isInline = true;
                break;
            }
        }
        
        if ($isInline) {
            header('Content-Disposition: inline; filename="' . $safeFilename . '"');
        } else {
            header('Content-Disposition: attachment; filename="' . $safeFilename . '"');
        }
    }
    
    // Handle range requests for large files
    if (isset($_SERVER['HTTP_RANGE'])) {
        $range = $_SERVER['HTTP_RANGE'];
        
        if (preg_match('/bytes=(\d+)-(\d*)/', $range, $matches)) {
            $start = (int) $matches[1];
            $end = $matches[2] !== '' ? (int) $matches[2] : $fileSize - 1;
            
            if ($start >= $fileSize || $end >= $fileSize || $start > $end) {
                http_response_code(416);
                header('Content-Range: bytes */' . $fileSize);
                exit;
            }
            
            $length = $end - $start + 1;
            
            http_response_code(206);
            header('Content-Range: bytes ' . $start . '-' . $end . '/' . $fileSize);
            header('Content-Length: ' . $length);
            
            $fp = fopen($filePath, 'rb');
            fseek($fp, $start);
            echo fread($fp, $length);
            fclose($fp);
            exit;
        }
    }
    
    // Output file
    readfile($filePath);
    exit;
    
} catch (Exception $e) {
    error_log("Download error: " . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Download failed']);
    exit;
}
