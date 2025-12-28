<?php
/**
 * User Logout Endpoint
 * POST /api/auth/logout.php
 */

require_once dirname(__DIR__) . '/core/database.php';
require_once dirname(__DIR__) . '/core/auth.php';
require_once dirname(__DIR__) . '/core/response.php';

Response::setCorsHeaders();
Response::requireMethod('POST');

try {
    Auth::destroySession();
    Response::success(null, 'Logged out successfully');
} catch (Exception $e) {
    error_log("Logout error: " . $e->getMessage());
    Response::success(null, 'Logged out');
}
