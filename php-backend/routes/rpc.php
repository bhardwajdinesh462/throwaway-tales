<?php
/**
 * RPC Routes - Stored procedure / function calls
 */

// Wrapper function called by index.php
function handleRpcRoute($functionName, $body, $pdo, $config) {
    handleRpc($functionName, $body, $pdo, $config);
}

function handleRpc($functionName, $params, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;
    $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;

    // Map function names to handlers
    switch ($functionName) {
        case 'create_temp_email':
            createTempEmail($params, $pdo, $userId);
            break;
        case 'is_admin':
            isAdminRpc($params, $pdo);
            break;
        case 'has_role':
            hasRole($params, $pdo);
            break;
        case 'check_rate_limit':
            checkRateLimit($params, $pdo);
            break;
        case 'verify_temp_email_token':
            verifyTempEmailToken($params, $pdo);
            break;
        case 'get_admin_users':
            getAdminUsers($pdo, $isAdmin);
            break;
        case 'get_all_profiles_for_admin':
            getAllProfilesForAdmin($params, $pdo, $isAdmin);
            break;
        case 'get_email_stats':
            getEmailStats($pdo);
            break;
        case 'get_email_logs':
            getEmailLogs($params, $pdo, $isAdmin);
            break;
        case 'suspend_user':
            suspendUser($params, $pdo, $userId, $isAdmin);
            break;
        case 'unsuspend_user':
            unsuspendUser($params, $pdo, $isAdmin);
            break;
        case 'add_admin_role':
            addAdminRole($params, $pdo, $isAdmin);
            break;
        case 'remove_admin_role':
            removeAdminRole($params, $pdo, $isAdmin);
            break;
        case 'admin_assign_subscription':
            adminAssignSubscription($params, $pdo, $isAdmin);
            break;
        case 'log_admin_access':
            logAdminAccess($params, $pdo, $userId, $isAdmin);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown function: ' . $functionName]);
    }
}

function createTempEmail($params, $pdo, $userId) {
    $address = strtolower(trim($params['p_address'] ?? ''));
    $domainId = $params['p_domain_id'] ?? '';
    $passedUserId = $params['p_user_id'] ?? null;
    $expiresAt = $params['p_expires_at'] ?? null;
    $deviceId = $params['device_id'] ?? null;

    if (empty($address) || empty($domainId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Address and domain_id required']);
        return;
    }

    // Check if email already exists
    $stmt = $pdo->prepare('SELECT * FROM temp_emails WHERE address = ? AND is_active = 1 AND expires_at > NOW()');
    $stmt->execute([$address]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        echo json_encode(['success' => true, 'email' => $existing]);
        return;
    }

    // Get user's email creation limit from subscription tier
    $effectiveUserId = $passedUserId ?: $userId;
    $emailLimit = getUserEmailLimit($pdo, $effectiveUserId);
    $identifier = $effectiveUserId ?: $deviceId ?: 'anonymous';
    
    // Count emails created today by this user/device
    $emailsCreatedToday = countTodayEmailsCreated($pdo, $identifier);
    
    // Check if user has reached their limit (skip for unlimited = -1)
    if ($emailLimit !== -1 && $emailsCreatedToday >= $emailLimit) {
        http_response_code(429);
        echo json_encode([
            'success' => false, 
            'error' => "Daily email limit reached ($emailLimit emails). Please upgrade your plan for more.",
            'limit_reached' => true,
            'current_count' => $emailsCreatedToday,
            'max_limit' => $emailLimit
        ]);
        return;
    }

    // Generate secret token
    $secretToken = bin2hex(random_bytes(32));
    $id = generateUUID();
    $now = date('Y-m-d H:i:s');
    
    // Get expiry hours from tier (default 2 hours)
    $expiryHours = getUserEmailExpiryHours($pdo, $effectiveUserId);
    $expires = $expiresAt ?: date('Y-m-d H:i:s', time() + ($expiryHours * 3600));

    try {
        $pdo->beginTransaction();
        
        $stmt = $pdo->prepare('
            INSERT INTO temp_emails (id, address, domain_id, user_id, secret_token, expires_at, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        ');
        $stmt->execute([$id, $address, $domainId, $effectiveUserId, $secretToken, $expires, $now]);

        // Track usage in rate_limits for accurate counting
        trackEmailCreation($pdo, $identifier);
        
        // Update email_stats counter
        $stmt = $pdo->prepare("
            INSERT INTO email_stats (id, stat_key, stat_value, updated_at) 
            VALUES (?, 'total_emails_generated', 1, NOW())
            ON DUPLICATE KEY UPDATE stat_value = stat_value + 1, updated_at = NOW()
        ");
        $stmt->execute([generateUUID()]);
        
        $pdo->commit();

        $email = [
            'id' => $id,
            'address' => $address,
            'domain_id' => $domainId,
            'user_id' => $effectiveUserId,
            'secret_token' => $secretToken,
            'expires_at' => $expires,
            'is_active' => true,
            'created_at' => $now,
        ];

        echo json_encode(['success' => true, 'email' => $email]);
    } catch (PDOException $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to create email: ' . $e->getMessage()]);
    }
}

/**
 * Get user's email creation limit from their subscription tier
 */
function getUserEmailLimit($pdo, $userId) {
    // Default free tier limit
    $defaultLimit = 5;
    
    // Try to get from free tier first
    $stmt = $pdo->prepare("SELECT max_temp_emails FROM subscription_tiers WHERE LOWER(name) = 'free' AND is_active = 1 LIMIT 1");
    $stmt->execute();
    $freeTier = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($freeTier) {
        $defaultLimit = intval($freeTier['max_temp_emails']);
    }
    
    if (!$userId) {
        return $defaultLimit;
    }
    
    // Get user's subscription tier limit
    $stmt = $pdo->prepare("
        SELECT st.max_temp_emails 
        FROM user_subscriptions us
        JOIN subscription_tiers st ON us.tier_id = st.id
        WHERE us.user_id = ? AND us.status = 'active' AND us.current_period_end > NOW()
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($subscription) {
        return intval($subscription['max_temp_emails']);
    }
    
    return $defaultLimit;
}

/**
 * Get user's email expiry hours from their subscription tier
 */
function getUserEmailExpiryHours($pdo, $userId) {
    $defaultHours = 2;
    
    // Try to get from free tier first
    $stmt = $pdo->prepare("SELECT email_expiry_hours FROM subscription_tiers WHERE LOWER(name) = 'free' AND is_active = 1 LIMIT 1");
    $stmt->execute();
    $freeTier = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($freeTier) {
        $defaultHours = intval($freeTier['email_expiry_hours']);
    }
    
    if (!$userId) {
        return $defaultHours;
    }
    
    $stmt = $pdo->prepare("
        SELECT st.email_expiry_hours 
        FROM user_subscriptions us
        JOIN subscription_tiers st ON us.tier_id = st.id
        WHERE us.user_id = ? AND us.status = 'active' AND us.current_period_end > NOW()
        LIMIT 1
    ");
    $stmt->execute([$userId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($subscription) {
        return intval($subscription['email_expiry_hours']);
    }
    
    return $defaultHours;
}

/**
 * Count emails created today by identifier (user_id or device_id)
 */
function countTodayEmailsCreated($pdo, $identifier) {
    // Get emails created in the last 24 hours
    $windowStart = date('Y-m-d H:i:s', time() - 86400); // 24 hours ago
    
    $stmt = $pdo->prepare("
        SELECT COALESCE(SUM(request_count), 0) as total
        FROM rate_limits 
        WHERE identifier = ? AND action_type = 'generate_email' AND window_start > ?
    ");
    $stmt->execute([$identifier, $windowStart]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);
    
    return intval($result['total'] ?? 0);
}

/**
 * Track email creation in rate_limits table
 */
function trackEmailCreation($pdo, $identifier) {
    $windowStart = date('Y-m-d H:i:s', strtotime('today midnight'));
    
    // Try to update existing record for today
    $stmt = $pdo->prepare("
        UPDATE rate_limits 
        SET request_count = request_count + 1 
        WHERE identifier = ? AND action_type = 'generate_email' AND DATE(window_start) = CURDATE()
    ");
    $stmt->execute([$identifier]);
    
    if ($stmt->rowCount() === 0) {
        // Insert new record
        $stmt = $pdo->prepare("
            INSERT INTO rate_limits (id, identifier, action_type, request_count, window_start)
            VALUES (?, ?, 'generate_email', 1, ?)
        ");
        $stmt->execute([generateUUID(), $identifier, $windowStart]);
    }
}

function isAdminRpc($params, $pdo) {
    $checkUserId = $params['_user_id'] ?? '';
    
    if (empty($checkUserId)) {
        echo json_encode(false);
        return;
    }

    $stmt = $pdo->prepare("SELECT 1 FROM user_roles WHERE user_id = ? AND role = 'admin'");
    $stmt->execute([$checkUserId]);
    echo json_encode((bool) $stmt->fetch());
}

function hasRole($params, $pdo) {
    $checkUserId = $params['_user_id'] ?? '';
    $role = $params['_role'] ?? '';

    if (empty($checkUserId) || empty($role)) {
        echo json_encode(false);
        return;
    }

    $stmt = $pdo->prepare('SELECT 1 FROM user_roles WHERE user_id = ? AND role = ?');
    $stmt->execute([$checkUserId, $role]);
    echo json_encode((bool) $stmt->fetch());
}

function checkRateLimit($params, $pdo) {
    $identifier = $params['p_identifier'] ?? '';
    $actionType = $params['p_action_type'] ?? '';
    $maxRequests = intval($params['p_max_requests'] ?? 100);
    $windowMinutes = intval($params['p_window_minutes'] ?? 60);

    if (empty($identifier) || empty($actionType)) {
        echo json_encode(true);
        return;
    }

    $windowStart = date('Y-m-d H:i:s', time() - ($windowMinutes * 60));

    $stmt = $pdo->prepare('
        SELECT SUM(request_count) as total 
        FROM rate_limits 
        WHERE identifier = ? AND action_type = ? AND window_start > ?
    ');
    $stmt->execute([$identifier, $actionType, $windowStart]);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    $total = intval($result['total'] ?? 0);

    if ($total >= $maxRequests) {
        echo json_encode(false);
        return;
    }

    // Increment count
    $stmt = $pdo->prepare('
        INSERT INTO rate_limits (id, identifier, action_type, request_count, window_start)
        VALUES (?, ?, ?, 1, NOW())
        ON DUPLICATE KEY UPDATE request_count = request_count + 1
    ');
    $stmt->execute([generateUUID(), $identifier, $actionType]);

    echo json_encode(true);
}

function verifyTempEmailToken($params, $pdo) {
    $tempEmailId = $params['p_temp_email_id'] ?? '';
    $token = $params['p_token'] ?? '';

    if (empty($tempEmailId) || empty($token)) {
        echo json_encode(false);
        return;
    }

    $stmt = $pdo->prepare('
        SELECT 1 FROM temp_emails 
        WHERE id = ? AND secret_token = ? AND is_active = 1 AND expires_at > NOW()
    ');
    $stmt->execute([$tempEmailId, $token]);
    echo json_encode((bool) $stmt->fetch());
}

function getAdminUsers($pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $stmt = $pdo->query("
        SELECT ur.id, ur.user_id, ur.role, ur.created_at, 
               u.email, u.display_name
        FROM user_roles ur
        JOIN users u ON u.id = ur.user_id
        WHERE ur.role IN ('admin', 'moderator')
        ORDER BY ur.created_at DESC
    ");

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function getAllProfilesForAdmin($params, $pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $page = intval($params['p_page'] ?? 1);
    $pageSize = min(intval($params['p_page_size'] ?? 50), 100);
    $search = $params['p_search'] ?? '';
    $offset = ($page - 1) * $pageSize;

    $where = [];
    $whereParams = [];

    if (!empty($search)) {
        $where[] = '(u.email LIKE ? OR u.display_name LIKE ?)';
        $whereParams[] = "%$search%";
        $whereParams[] = "%$search%";
    }

    $whereClause = empty($where) ? '' : 'WHERE ' . implode(' AND ', $where);

    // Get total count
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM users u $whereClause");
    $stmt->execute($whereParams);
    $totalCount = $stmt->fetchColumn();

    // Get profiles
    $stmt = $pdo->prepare("
        SELECT u.id, u.id as user_id, u.email, u.display_name, u.avatar_url, 
               u.created_at, u.updated_at,
               COALESCE(ur.role, 'user') as role,
               $totalCount as total_count
        FROM users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        $whereClause
        ORDER BY u.created_at DESC
        LIMIT $pageSize OFFSET $offset
    ");
    $stmt->execute($whereParams);

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function getEmailStats($pdo) {
    $stmt = $pdo->query("
        SELECT 
            COALESCE(SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END), 0) as total_sent,
            COALESCE(SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END), 0) as total_failed,
            COALESCE(SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END), 0) as total_bounced,
            COALESCE(SUM(CASE WHEN status = 'sent' AND DATE(sent_at) = CURDATE() THEN 1 ELSE 0 END), 0) as sent_today,
            COALESCE(SUM(CASE WHEN status = 'failed' AND DATE(failed_at) = CURDATE() THEN 1 ELSE 0 END), 0) as failed_today
        FROM email_logs
    ");
    $stats = $stmt->fetch(PDO::FETCH_ASSOC);
    
    $totalAttempts = $stats['total_sent'] + $stats['total_failed'];
    $stats['success_rate'] = $totalAttempts > 0 ? round(($stats['total_sent'] / $totalAttempts) * 100, 2) : 100;

    echo json_encode([$stats]);
}

function getEmailLogs($params, $pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $page = intval($params['p_page'] ?? 1);
    $pageSize = min(intval($params['p_page_size'] ?? 50), 100);
    $search = $params['p_search'] ?? '';
    $statusFilter = $params['p_status_filter'] ?? '';
    $offset = ($page - 1) * $pageSize;

    $where = [];
    $whereParams = [];

    if (!empty($search)) {
        $where[] = '(recipient_email LIKE ? OR subject LIKE ?)';
        $whereParams[] = "%$search%";
        $whereParams[] = "%$search%";
    }

    if (!empty($statusFilter)) {
        $where[] = 'status = ?';
        $whereParams[] = $statusFilter;
    }

    $whereClause = empty($where) ? '' : 'WHERE ' . implode(' AND ', $where);

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM email_logs $whereClause");
    $stmt->execute($whereParams);
    $totalCount = $stmt->fetchColumn();

    $stmt = $pdo->prepare("
        SELECT *, $totalCount as total_count
        FROM email_logs
        $whereClause
        ORDER BY created_at DESC
        LIMIT $pageSize OFFSET $offset
    ");
    $stmt->execute($whereParams);

    echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC));
}

function suspendUser($params, $pdo, $adminUserId, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(false);
        return;
    }

    $targetUserId = $params['target_user_id'] ?? '';
    $reason = $params['suspension_reason'] ?? null;
    $until = $params['suspend_until'] ?? null;

    if (empty($targetUserId)) {
        echo json_encode(false);
        return;
    }

    $stmt = $pdo->prepare('
        INSERT INTO user_suspensions (id, user_id, suspended_by, reason, suspended_until, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, NOW())
    ');
    $stmt->execute([generateUUID(), $targetUserId, $adminUserId, $reason, $until]);

    echo json_encode(true);
}

function unsuspendUser($params, $pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(false);
        return;
    }

    $targetUserId = $params['target_user_id'] ?? '';

    $stmt = $pdo->prepare('UPDATE user_suspensions SET is_active = 0, lifted_at = NOW() WHERE user_id = ? AND is_active = 1');
    $stmt->execute([$targetUserId]);

    echo json_encode(true);
}

function addAdminRole($params, $pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(false);
        return;
    }

    $targetUserId = $params['target_user_id'] ?? '';
    $targetRole = $params['target_role'] ?? 'admin';

    $stmt = $pdo->prepare('DELETE FROM user_roles WHERE user_id = ?');
    $stmt->execute([$targetUserId]);

    $stmt = $pdo->prepare('INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, ?, NOW())');
    $stmt->execute([generateUUID(), $targetUserId, $targetRole]);

    echo json_encode(true);
}

function removeAdminRole($params, $pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(false);
        return;
    }

    $targetUserId = $params['target_user_id'] ?? '';

    $stmt = $pdo->prepare("DELETE FROM user_roles WHERE user_id = ? AND role IN ('admin', 'moderator')");
    $stmt->execute([$targetUserId]);

    $stmt = $pdo->prepare("INSERT INTO user_roles (id, user_id, role, created_at) VALUES (?, ?, 'user', NOW())");
    $stmt->execute([generateUUID(), $targetUserId]);

    echo json_encode(true);
}

function adminAssignSubscription($params, $pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(false);
        return;
    }

    $targetUserId = $params['target_user_id'] ?? '';
    $tierId = $params['target_tier_id'] ?? '';
    $durationMonths = intval($params['duration_months'] ?? 1);

    $stmt = $pdo->prepare('DELETE FROM user_subscriptions WHERE user_id = ?');
    $stmt->execute([$targetUserId]);

    $periodEnd = date('Y-m-d H:i:s', strtotime("+$durationMonths months"));

    $stmt = $pdo->prepare('
        INSERT INTO user_subscriptions (id, user_id, tier_id, status, current_period_start, current_period_end, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), ?, NOW(), NOW())
    ');
    $stmt->execute([generateUUID(), $targetUserId, $tierId, 'active', $periodEnd]);

    echo json_encode(true);
}

function logAdminAccess($params, $pdo, $adminUserId, $isAdmin) {
    if (!$isAdmin || !$adminUserId) {
        echo json_encode(null);
        return;
    }

    $action = $params['p_action'] ?? '';
    $tableName = $params['p_table_name'] ?? '';
    $recordId = $params['p_record_id'] ?? null;
    $details = $params['p_details'] ?? '{}';

    $id = generateUUID();
    $stmt = $pdo->prepare('
        INSERT INTO admin_audit_logs (id, admin_user_id, action, table_name, record_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([$id, $adminUserId, $action, $tableName, $recordId, json_encode($details)]);

    echo json_encode($id);
}
