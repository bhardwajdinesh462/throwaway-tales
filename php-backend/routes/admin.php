<?php
/**
 * Admin API Routes - User, Domain, Settings Management
 * Uses local SMTP/IMAP (no external services like Mailgun/SendGrid)
 */

function handleAdminRoute($action, $body, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;

    if (!$userId || !checkIsAdmin($pdo, $userId)) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    switch ($action) {
        // User Management
        case 'users':
            handleUsers($body, $pdo, $userId);
            break;
        case 'user-details':
            getUserDetails($body, $pdo);
            break;
        case 'suspend-user':
            suspendUser($body, $pdo, $userId);
            break;
        case 'unsuspend-user':
            unsuspendUser($body, $pdo, $userId);
            break;
        case 'delete-user':
            deleteUser($body, $pdo, $userId);
            break;
        case 'assign-role':
            assignRole($body, $pdo, $userId);
            break;
        case 'assign-subscription':
            assignSubscription($body, $pdo, $userId);
            break;

        // Domain Management
        case 'domains':
            handleDomains($body, $pdo, $userId);
            break;
        case 'domain-create':
            createDomain($body, $pdo, $userId);
            break;
        case 'domain-update':
            updateDomain($body, $pdo, $userId);
            break;
        case 'domain-delete':
            deleteDomain($body, $pdo, $userId);
            break;

        // Settings Management
        case 'settings':
            handleSettings($body, $pdo, $userId);
            break;
        case 'setting-update':
            updateSetting($body, $pdo, $userId);
            break;

        // Mailbox Management (SMTP/IMAP)
        case 'mailboxes':
            handleMailboxes($body, $pdo, $userId);
            break;
        case 'mailbox-create':
            createMailbox($body, $pdo, $userId);
            break;
        case 'mailbox-update':
            updateMailbox($body, $pdo, $userId);
            break;
        case 'mailbox-delete':
            deleteMailbox($body, $pdo, $userId);
            break;
        case 'mailbox-test-smtp':
            testSmtpConnection($body, $pdo, $config);
            break;
        case 'mailbox-test-imap':
            testImapConnection($body, $pdo, $config);
            break;
        case 'mailbox-fetch-emails':
            fetchImapEmails($body, $pdo, $config);
            break;

        // Email Logs
        case 'email-logs':
            getEmailLogs($body, $pdo);
            break;
        case 'email-stats':
            getEmailStats($pdo);
            break;

        // Audit Logs
        case 'audit-logs':
            getAuditLogs($body, $pdo);
            break;

        // Analytics
        case 'analytics':
            getAnalytics($body, $pdo);
            break;

        // Dashboard
        case 'dashboard':
            getDashboardStats($pdo);
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown admin action: ' . $action]);
    }
}

// =========== USER MANAGEMENT ===========

function handleUsers($body, $pdo, $adminId) {
    $page = intval($body['page'] ?? 1);
    $pageSize = intval($body['page_size'] ?? 20);
    $search = $body['search'] ?? '';
    $offset = ($page - 1) * $pageSize;

    $whereClause = '';
    $params = [];

    if ($search) {
        $whereClause = 'WHERE (p.email LIKE ? OR p.display_name LIKE ?)';
        $params = ["%$search%", "%$search%"];
    }

    // Get total count
    $countSql = "SELECT COUNT(*) FROM profiles p $whereClause";
    $stmt = $pdo->prepare($countSql);
    $stmt->execute($params);
    $totalCount = $stmt->fetchColumn();

    // Get users with roles
    $sql = "
        SELECT p.*, 
               COALESCE(r.role, 'user') as role,
               (SELECT COUNT(*) FROM temp_emails WHERE user_id = p.user_id) as email_count
        FROM profiles p
        LEFT JOIN user_roles r ON r.user_id = p.user_id
        $whereClause
        ORDER BY p.created_at DESC
        LIMIT $pageSize OFFSET $offset
    ";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Log admin access
    logAdminAction($pdo, $adminId, 'VIEW_USERS', 'profiles', null, ['search' => $search, 'page' => $page]);

    echo json_encode([
        'users' => $users,
        'total_count' => intval($totalCount),
        'page' => $page,
        'page_size' => $pageSize,
    ]);
}

function getUserDetails($body, $pdo) {
    $userId = $body['user_id'] ?? '';

    if (empty($userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id required']);
        return;
    }

    $stmt = $pdo->prepare('SELECT * FROM profiles WHERE user_id = ?');
    $stmt->execute([$userId]);
    $profile = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$profile) {
        http_response_code(404);
        echo json_encode(['error' => 'User not found']);
        return;
    }

    // Get role
    $stmt = $pdo->prepare('SELECT role FROM user_roles WHERE user_id = ?');
    $stmt->execute([$userId]);
    $role = $stmt->fetchColumn() ?: 'user';

    // Get subscription
    $stmt = $pdo->prepare('
        SELECT us.*, st.name as tier_name 
        FROM user_subscriptions us 
        JOIN subscription_tiers st ON st.id = us.tier_id 
        WHERE us.user_id = ?
    ');
    $stmt->execute([$userId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);

    // Get temp emails
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM temp_emails WHERE user_id = ?');
    $stmt->execute([$userId]);
    $emailCount = $stmt->fetchColumn();

    echo json_encode([
        'profile' => $profile,
        'role' => $role,
        'subscription' => $subscription,
        'email_count' => intval($emailCount),
    ]);
}

function suspendUser($body, $pdo, $adminId) {
    $userId = $body['user_id'] ?? '';
    $reason = $body['reason'] ?? '';
    $until = $body['until'] ?? null;

    if (empty($userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id required']);
        return;
    }

    $stmt = $pdo->prepare('
        INSERT INTO user_suspensions (id, user_id, suspended_by, reason, suspended_until, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, 1, NOW())
    ');
    $stmt->execute([generateUUID(), $userId, $adminId, $reason, $until]);

    logAdminAction($pdo, $adminId, 'SUSPEND_USER', 'user_suspensions', $userId, ['reason' => $reason]);

    echo json_encode(['success' => true]);
}

function unsuspendUser($body, $pdo, $adminId) {
    $userId = $body['user_id'] ?? '';

    if (empty($userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id required']);
        return;
    }

    $stmt = $pdo->prepare('
        UPDATE user_suspensions 
        SET is_active = 0, lifted_at = NOW(), lifted_by = ?
        WHERE user_id = ? AND is_active = 1
    ');
    $stmt->execute([$adminId, $userId]);

    logAdminAction($pdo, $adminId, 'UNSUSPEND_USER', 'user_suspensions', $userId, []);

    echo json_encode(['success' => true]);
}

function deleteUser($body, $pdo, $adminId) {
    $userId = $body['user_id'] ?? '';

    if (empty($userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id required']);
        return;
    }

    // Delete related data
    $pdo->prepare('DELETE FROM temp_emails WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM user_roles WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM user_subscriptions WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM profiles WHERE user_id = ?')->execute([$userId]);
    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$userId]);

    logAdminAction($pdo, $adminId, 'DELETE_USER', 'users', $userId, []);

    echo json_encode(['success' => true]);
}

function assignRole($body, $pdo, $adminId) {
    $userId = $body['user_id'] ?? '';
    $role = $body['role'] ?? 'user';

    if (empty($userId)) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id required']);
        return;
    }

    // Update or insert role
    $stmt = $pdo->prepare('
        INSERT INTO user_roles (id, user_id, role, created_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE role = ?
    ');
    $stmt->execute([generateUUID(), $userId, $role, $role]);

    logAdminAction($pdo, $adminId, 'ASSIGN_ROLE', 'user_roles', $userId, ['role' => $role]);

    echo json_encode(['success' => true]);
}

function assignSubscription($body, $pdo, $adminId) {
    $userId = $body['user_id'] ?? '';
    $tierId = $body['tier_id'] ?? '';
    $months = intval($body['months'] ?? 1);

    if (empty($userId) || empty($tierId)) {
        http_response_code(400);
        echo json_encode(['error' => 'user_id and tier_id required']);
        return;
    }

    $periodEnd = date('Y-m-d H:i:s', strtotime("+$months months"));

    $stmt = $pdo->prepare('
        INSERT INTO user_subscriptions (id, user_id, tier_id, status, current_period_start, current_period_end, created_at, updated_at)
        VALUES (?, ?, ?, ?, NOW(), ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE tier_id = ?, current_period_end = ?, status = ?, updated_at = NOW()
    ');
    $stmt->execute([
        generateUUID(), $userId, $tierId, 'active', $periodEnd,
        $tierId, $periodEnd, 'active'
    ]);

    logAdminAction($pdo, $adminId, 'ASSIGN_SUBSCRIPTION', 'user_subscriptions', $userId, ['tier_id' => $tierId, 'months' => $months]);

    echo json_encode(['success' => true]);
}

// =========== DOMAIN MANAGEMENT ===========

function handleDomains($body, $pdo, $adminId) {
    $stmt = $pdo->query('SELECT * FROM domains ORDER BY created_at DESC');
    $domains = $stmt->fetchAll(PDO::FETCH_ASSOC);

    logAdminAction($pdo, $adminId, 'VIEW_DOMAINS', 'domains', null, []);

    echo json_encode(['domains' => $domains]);
}

function createDomain($body, $pdo, $adminId) {
    $name = $body['name'] ?? '';
    $isActive = $body['is_active'] ?? true;
    $isPremium = $body['is_premium'] ?? false;

    if (empty($name)) {
        http_response_code(400);
        echo json_encode(['error' => 'Domain name required']);
        return;
    }

    $id = generateUUID();
    $stmt = $pdo->prepare('
        INSERT INTO domains (id, name, is_active, is_premium, created_at)
        VALUES (?, ?, ?, ?, NOW())
    ');
    $stmt->execute([$id, strtolower($name), $isActive ? 1 : 0, $isPremium ? 1 : 0]);

    logAdminAction($pdo, $adminId, 'CREATE_DOMAIN', 'domains', $id, ['name' => $name]);

    echo json_encode(['success' => true, 'id' => $id]);
}

function updateDomain($body, $pdo, $adminId) {
    $id = $body['id'] ?? '';
    $name = $body['name'] ?? null;
    $isActive = $body['is_active'] ?? null;
    $isPremium = $body['is_premium'] ?? null;

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Domain ID required']);
        return;
    }

    $updates = [];
    $params = [];

    if ($name !== null) {
        $updates[] = 'name = ?';
        $params[] = strtolower($name);
    }
    if ($isActive !== null) {
        $updates[] = 'is_active = ?';
        $params[] = $isActive ? 1 : 0;
    }
    if ($isPremium !== null) {
        $updates[] = 'is_premium = ?';
        $params[] = $isPremium ? 1 : 0;
    }

    if (empty($updates)) {
        echo json_encode(['success' => true]);
        return;
    }

    $params[] = $id;
    $sql = 'UPDATE domains SET ' . implode(', ', $updates) . ' WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    logAdminAction($pdo, $adminId, 'UPDATE_DOMAIN', 'domains', $id, $body);

    echo json_encode(['success' => true]);
}

function deleteDomain($body, $pdo, $adminId) {
    $id = $body['id'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Domain ID required']);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM domains WHERE id = ?');
    $stmt->execute([$id]);

    logAdminAction($pdo, $adminId, 'DELETE_DOMAIN', 'domains', $id, []);

    echo json_encode(['success' => true]);
}

// =========== SETTINGS MANAGEMENT ===========

function handleSettings($body, $pdo, $adminId) {
    $key = $body['key'] ?? null;

    if ($key) {
        $stmt = $pdo->prepare('SELECT * FROM app_settings WHERE `key` = ?');
        $stmt->execute([$key]);
        $setting = $stmt->fetch(PDO::FETCH_ASSOC);
        echo json_encode(['setting' => $setting]);
    } else {
        $stmt = $pdo->query('SELECT * FROM app_settings ORDER BY `key` ASC');
        $settings = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['settings' => $settings]);
    }
}

function updateSetting($body, $pdo, $adminId) {
    $key = $body['key'] ?? '';
    $value = $body['value'] ?? null;

    if (empty($key)) {
        http_response_code(400);
        echo json_encode(['error' => 'Setting key required']);
        return;
    }

    $valueJson = is_string($value) ? $value : json_encode($value);

    $stmt = $pdo->prepare('
        INSERT INTO app_settings (id, `key`, value, updated_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()
    ');
    $stmt->execute([generateUUID(), $key, $valueJson, $valueJson]);

    logAdminAction($pdo, $adminId, 'UPDATE_SETTING', 'app_settings', null, ['key' => $key]);

    echo json_encode(['success' => true]);
}

// =========== MAILBOX MANAGEMENT (LOCAL SMTP/IMAP) ===========

function handleMailboxes($body, $pdo, $adminId) {
    $stmt = $pdo->query('
        SELECT id, name, smtp_host, smtp_port, smtp_user, smtp_from, 
               imap_host, imap_port, imap_user,
               is_active, priority, daily_limit, hourly_limit,
               emails_sent_today, emails_sent_this_hour,
               last_polled_at, last_error, last_error_at,
               created_at, updated_at
        FROM mailboxes 
        ORDER BY priority ASC
    ');
    $mailboxes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['mailboxes' => $mailboxes]);
}

function createMailbox($body, $pdo, $adminId) {
    $id = generateUUID();
    
    $stmt = $pdo->prepare('
        INSERT INTO mailboxes (
            id, name, smtp_host, smtp_port, smtp_user, smtp_password, smtp_from,
            imap_host, imap_port, imap_user, imap_password,
            is_active, priority, daily_limit, hourly_limit, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ');
    
    $stmt->execute([
        $id,
        $body['name'] ?? 'New Mailbox',
        $body['smtp_host'] ?? '',
        $body['smtp_port'] ?? 587,
        $body['smtp_user'] ?? '',
        $body['smtp_password'] ?? '',
        $body['smtp_from'] ?? $body['smtp_user'] ?? '',
        $body['imap_host'] ?? '',
        $body['imap_port'] ?? 993,
        $body['imap_user'] ?? '',
        $body['imap_password'] ?? '',
        ($body['is_active'] ?? true) ? 1 : 0,
        $body['priority'] ?? 1,
        $body['daily_limit'] ?? 500,
        $body['hourly_limit'] ?? 50,
    ]);

    logAdminAction($pdo, $adminId, 'CREATE_MAILBOX', 'mailboxes', $id, ['name' => $body['name'] ?? 'New Mailbox']);

    echo json_encode(['success' => true, 'id' => $id]);
}

function updateMailbox($body, $pdo, $adminId) {
    $id = $body['id'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Mailbox ID required']);
        return;
    }

    $fields = [
        'name', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'smtp_from',
        'imap_host', 'imap_port', 'imap_user', 'imap_password',
        'is_active', 'priority', 'daily_limit', 'hourly_limit'
    ];

    $updates = [];
    $params = [];

    foreach ($fields as $field) {
        if (isset($body[$field])) {
            $updates[] = "$field = ?";
            $value = $body[$field];
            if ($field === 'is_active') {
                $value = $value ? 1 : 0;
            }
            $params[] = $value;
        }
    }

    if (empty($updates)) {
        echo json_encode(['success' => true]);
        return;
    }

    $updates[] = 'updated_at = NOW()';
    $params[] = $id;

    $sql = 'UPDATE mailboxes SET ' . implode(', ', $updates) . ' WHERE id = ?';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    logAdminAction($pdo, $adminId, 'UPDATE_MAILBOX', 'mailboxes', $id, array_keys($body));

    echo json_encode(['success' => true]);
}

function deleteMailbox($body, $pdo, $adminId) {
    $id = $body['id'] ?? '';

    if (empty($id)) {
        http_response_code(400);
        echo json_encode(['error' => 'Mailbox ID required']);
        return;
    }

    $stmt = $pdo->prepare('DELETE FROM mailboxes WHERE id = ?');
    $stmt->execute([$id]);

    logAdminAction($pdo, $adminId, 'DELETE_MAILBOX', 'mailboxes', $id, []);

    echo json_encode(['success' => true]);
}

function testSmtpConnection($body, $pdo, $config) {
    $host = $body['host'] ?? '';
    $port = intval($body['port'] ?? 587);
    $user = $body['user'] ?? '';
    $pass = $body['password'] ?? '';
    $from = $body['from'] ?? $user;
    $testEmail = $body['test_email'] ?? '';

    if (empty($host) || empty($user) || empty($pass)) {
        http_response_code(400);
        echo json_encode(['error' => 'SMTP host, user, and password required']);
        return;
    }

    // Test DNS resolution
    $resolved = gethostbyname($host);
    if ($resolved === $host && !filter_var($host, FILTER_VALIDATE_IP)) {
        echo json_encode([
            'success' => false,
            'dns_resolved' => false,
            'error' => 'Could not resolve hostname: ' . $host
        ]);
        return;
    }

    // Test TCP connection
    $errno = 0;
    $errstr = '';
    $timeout = 10;
    $socket = @fsockopen($host, $port, $errno, $errstr, $timeout);

    if (!$socket) {
        echo json_encode([
            'success' => false,
            'dns_resolved' => true,
            'tcp_connected' => false,
            'error' => "Connection failed: $errstr ($errno)"
        ]);
        return;
    }

    fclose($socket);

    // If test email provided, send it
    if (!empty($testEmail)) {
        $result = sendEmailWithCredentials($testEmail, 'SMTP Test Email', 
            'This is a test email sent from your admin panel to verify SMTP settings.', 
            $host, $port, $user, $pass, $from);
        
        echo json_encode([
            'success' => $result['success'],
            'dns_resolved' => true,
            'tcp_connected' => true,
            'email_sent' => $result['success'],
            'error' => $result['error'] ?? null,
            'message' => $result['success'] ? 'Test email sent successfully!' : 'SMTP connection works but email sending failed'
        ]);
        return;
    }

    echo json_encode([
        'success' => true,
        'dns_resolved' => true,
        'tcp_connected' => true,
        'resolved_ip' => $resolved,
        'message' => 'SMTP server is reachable'
    ]);
}

function testImapConnection($body, $pdo, $config) {
    $host = $body['host'] ?? '';
    $port = intval($body['port'] ?? 993);
    $user = $body['user'] ?? '';
    $pass = $body['password'] ?? '';
    $ssl = $body['ssl'] ?? true;

    if (empty($host) || empty($user) || empty($pass)) {
        http_response_code(400);
        echo json_encode(['error' => 'IMAP host, user, and password required']);
        return;
    }

    // Test if IMAP extension is available
    if (!function_exists('imap_open')) {
        echo json_encode([
            'success' => false,
            'error' => 'PHP IMAP extension not installed. Please install php-imap.'
        ]);
        return;
    }

    $mailbox = '{' . $host . ':' . $port . '/imap' . ($ssl ? '/ssl' : '') . '/novalidate-cert}INBOX';

    $imap = @imap_open($mailbox, $user, $pass, OP_READONLY, 1);

    if ($imap) {
        $check = imap_check($imap);
        $msgCount = $check->Nmsgs ?? 0;
        imap_close($imap);

        echo json_encode([
            'success' => true,
            'message' => 'IMAP connection successful!',
            'message_count' => $msgCount
        ]);
    } else {
        $error = imap_last_error() ?: 'Unknown IMAP error';
        echo json_encode([
            'success' => false,
            'error' => $error
        ]);
    }
}

function fetchImapEmails($body, $pdo, $config) {
    $mailboxId = $body['mailbox_id'] ?? null;

    // Get mailbox config
    if ($mailboxId) {
        $stmt = $pdo->prepare('SELECT * FROM mailboxes WHERE id = ?');
        $stmt->execute([$mailboxId]);
    } else {
        $stmt = $pdo->query('SELECT * FROM mailboxes WHERE is_active = 1 ORDER BY priority ASC LIMIT 1');
    }

    $mailbox = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$mailbox) {
        http_response_code(404);
        echo json_encode(['error' => 'No active mailbox found']);
        return;
    }

    if (!function_exists('imap_open')) {
        echo json_encode(['success' => false, 'error' => 'PHP IMAP extension not installed']);
        return;
    }

    $host = $mailbox['imap_host'];
    $port = $mailbox['imap_port'] ?: 993;
    $user = $mailbox['imap_user'];
    $pass = $mailbox['imap_password'];
    $ssl = $port == 993;

    $imapPath = '{' . $host . ':' . $port . '/imap' . ($ssl ? '/ssl' : '') . '/novalidate-cert}INBOX';
    $imap = @imap_open($imapPath, $user, $pass);

    if (!$imap) {
        $error = imap_last_error() ?: 'Failed to connect to IMAP server';
        
        // Record error
        $stmt = $pdo->prepare('UPDATE mailboxes SET last_error = ?, last_error_at = NOW() WHERE id = ?');
        $stmt->execute([$error, $mailbox['id']]);

        echo json_encode(['success' => false, 'error' => $error]);
        return;
    }

    // Get unread emails
    $emails = imap_search($imap, 'UNSEEN');
    $stored = 0;
    $failed = 0;

    if ($emails) {
        foreach ($emails as $emailNum) {
            $header = imap_headerinfo($imap, $emailNum);
            $structure = imap_fetchstructure($imap, $emailNum);

            $from = $header->from[0]->mailbox . '@' . $header->from[0]->host;
            $to = $header->to[0]->mailbox . '@' . $header->to[0]->host;
            $subject = isset($header->subject) ? imap_utf8($header->subject) : '(No Subject)';
            $date = date('Y-m-d H:i:s', strtotime($header->date));

            // Get body
            $body = '';
            $htmlBody = '';

            if (isset($structure->parts) && count($structure->parts)) {
                foreach ($structure->parts as $partNum => $part) {
                    if ($part->subtype == 'PLAIN') {
                        $body = imap_fetchbody($imap, $emailNum, $partNum + 1);
                    } elseif ($part->subtype == 'HTML') {
                        $htmlBody = imap_fetchbody($imap, $emailNum, $partNum + 1);
                    }
                }
            } else {
                $body = imap_body($imap, $emailNum);
            }

            // Decode if needed
            if (isset($structure->encoding) && $structure->encoding == 3) {
                $body = base64_decode($body);
                $htmlBody = base64_decode($htmlBody);
            } elseif (isset($structure->encoding) && $structure->encoding == 4) {
                $body = quoted_printable_decode($body);
                $htmlBody = quoted_printable_decode($htmlBody);
            }

            // Find matching temp email
            $stmt = $pdo->prepare('SELECT id FROM temp_emails WHERE address = ? AND is_active = 1');
            $stmt->execute([strtolower($to)]);
            $tempEmail = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($tempEmail) {
                $emailId = generateUUID();
                $stmt = $pdo->prepare('
                    INSERT INTO received_emails (id, temp_email_id, from_address, subject, body, html_body, received_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                ');
                $stmt->execute([$emailId, $tempEmail['id'], $from, $subject, $body, $htmlBody, $date]);
                $stored++;

                // Mark as seen
                imap_setflag_full($imap, $emailNum, '\\Seen');
            } else {
                $failed++;
            }
        }
    }

    // Update mailbox polling timestamp
    $stmt = $pdo->prepare('UPDATE mailboxes SET last_polled_at = NOW(), last_error = NULL WHERE id = ?');
    $stmt->execute([$mailbox['id']]);

    // Update stats
    if ($stored > 0) {
        $stmt = $pdo->prepare("
            INSERT INTO email_stats (id, stat_key, stat_value, updated_at)
            VALUES (?, 'total_emails_received', ?, NOW())
            ON DUPLICATE KEY UPDATE stat_value = stat_value + ?, updated_at = NOW()
        ");
        $stmt->execute([generateUUID(), $stored, $stored]);
    }

    $check = imap_check($imap);
    imap_close($imap);

    echo json_encode([
        'success' => true,
        'message' => "Fetched $stored new emails",
        'stats' => [
            'totalMessages' => $check->Nmsgs ?? 0,
            'unseenMessages' => count($emails ?: []),
            'stored' => $stored,
            'failed' => $failed
        ]
    ]);
}

// =========== EMAIL LOGS ===========

function getEmailLogs($body, $pdo) {
    $page = intval($body['page'] ?? 1);
    $pageSize = intval($body['page_size'] ?? 20);
    $status = $body['status'] ?? null;
    $search = $body['search'] ?? '';
    $offset = ($page - 1) * $pageSize;

    $whereClause = '1=1';
    $params = [];

    if ($status && $status !== 'all') {
        $whereClause .= ' AND status = ?';
        $params[] = $status;
    }

    if ($search) {
        $whereClause .= ' AND (recipient_email LIKE ? OR subject LIKE ? OR error_message LIKE ?)';
        $params = array_merge($params, ["%$search%", "%$search%", "%$search%"]);
    }

    // Get total count
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM email_logs WHERE $whereClause");
    $stmt->execute($params);
    $totalCount = $stmt->fetchColumn();

    // Get logs
    $stmt = $pdo->prepare("
        SELECT el.*, m.name as mailbox_name
        FROM email_logs el
        LEFT JOIN mailboxes m ON m.id = el.mailbox_id
        WHERE $whereClause
        ORDER BY el.created_at DESC
        LIMIT $pageSize OFFSET $offset
    ");
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Add total_count to each log for pagination
    foreach ($logs as &$log) {
        $log['total_count'] = intval($totalCount);
    }

    echo json_encode($logs);
}

function getEmailStats($pdo) {
    // Get counts
    $stmt = $pdo->query("SELECT status, COUNT(*) as count FROM email_logs GROUP BY status");
    $statuses = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $statuses[$row['status']] = intval($row['count']);
    }

    // Get today's counts
    $stmt = $pdo->query("
        SELECT status, COUNT(*) as count 
        FROM email_logs 
        WHERE DATE(created_at) = CURDATE()
        GROUP BY status
    ");
    $todayStatuses = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $todayStatuses[$row['status']] = intval($row['count']);
    }

    $totalSent = $statuses['sent'] ?? 0;
    $totalFailed = $statuses['failed'] ?? 0;
    $totalBounced = $statuses['bounced'] ?? 0;
    $total = $totalSent + $totalFailed + $totalBounced;
    $successRate = $total > 0 ? round(($totalSent / $total) * 100, 1) : 0;

    echo json_encode([[
        'total_sent' => $totalSent,
        'total_failed' => $totalFailed,
        'total_bounced' => $totalBounced,
        'sent_today' => $todayStatuses['sent'] ?? 0,
        'failed_today' => $todayStatuses['failed'] ?? 0,
        'success_rate' => $successRate,
    ]]);
}

// =========== AUDIT LOGS ===========

function getAuditLogs($body, $pdo) {
    $page = intval($body['page'] ?? 1);
    $pageSize = intval($body['page_size'] ?? 20);
    $action = $body['action'] ?? '';
    $offset = ($page - 1) * $pageSize;

    $whereClause = '1=1';
    $params = [];

    if ($action) {
        $whereClause .= ' AND action LIKE ?';
        $params[] = "%$action%";
    }

    // Get total count
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM admin_audit_logs WHERE $whereClause");
    $stmt->execute($params);
    $totalCount = $stmt->fetchColumn();

    // Get logs with admin info
    $stmt = $pdo->prepare("
        SELECT aal.*, p.email as admin_email, p.display_name as admin_name
        FROM admin_audit_logs aal
        LEFT JOIN profiles p ON p.user_id = aal.admin_user_id
        WHERE $whereClause
        ORDER BY aal.created_at DESC
        LIMIT $pageSize OFFSET $offset
    ");
    $stmt->execute($params);
    $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Add total_count to each log
    foreach ($logs as &$log) {
        $log['total_count'] = intval($totalCount);
    }

    echo json_encode($logs);
}

// =========== ANALYTICS ===========

function getAnalytics($body, $pdo) {
    $period = $body['period'] ?? '7d';
    
    $days = match($period) {
        '24h' => 1,
        '7d' => 7,
        '30d' => 30,
        '90d' => 90,
        default => 7
    };

    // User signups by day
    $stmt = $pdo->prepare("
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM profiles
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$days]);
    $signups = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Emails created by day
    $stmt = $pdo->prepare("
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM temp_emails
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(created_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$days]);
    $emailsCreated = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Emails received by day
    $stmt = $pdo->prepare("
        SELECT DATE(received_at) as date, COUNT(*) as count
        FROM received_emails
        WHERE received_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        GROUP BY DATE(received_at)
        ORDER BY date ASC
    ");
    $stmt->execute([$days]);
    $emailsReceived = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'signups' => $signups,
        'emails_created' => $emailsCreated,
        'emails_received' => $emailsReceived,
    ]);
}

// =========== DASHBOARD ===========

function getDashboardStats($pdo) {
    // Total users
    $stmt = $pdo->query("SELECT COUNT(*) FROM profiles");
    $totalUsers = $stmt->fetchColumn();

    // New users today
    $stmt = $pdo->query("SELECT COUNT(*) FROM profiles WHERE DATE(created_at) = CURDATE()");
    $newUsersToday = $stmt->fetchColumn();

    // Active temp emails
    $stmt = $pdo->query("SELECT COUNT(*) FROM temp_emails WHERE is_active = 1 AND expires_at > NOW()");
    $activeEmails = $stmt->fetchColumn();

    // Emails received today
    $stmt = $pdo->query("SELECT COUNT(*) FROM received_emails WHERE DATE(received_at) = CURDATE()");
    $emailsToday = $stmt->fetchColumn();

    // Active domains
    $stmt = $pdo->query("SELECT COUNT(*) FROM domains WHERE is_active = 1");
    $activeDomains = $stmt->fetchColumn();

    // Premium users
    $stmt = $pdo->query("
        SELECT COUNT(*) FROM user_subscriptions us
        JOIN subscription_tiers st ON st.id = us.tier_id
        WHERE us.status = 'active' AND st.name != 'Free'
    ");
    $premiumUsers = $stmt->fetchColumn();

    // Active mailboxes
    $stmt = $pdo->query("SELECT COUNT(*) FROM mailboxes WHERE is_active = 1");
    $activeMailboxes = $stmt->fetchColumn();

    echo json_encode([
        'total_users' => intval($totalUsers),
        'new_users_today' => intval($newUsersToday),
        'active_emails' => intval($activeEmails),
        'emails_received_today' => intval($emailsToday),
        'active_domains' => intval($activeDomains),
        'premium_users' => intval($premiumUsers),
        'active_mailboxes' => intval($activeMailboxes),
    ]);
}

// =========== HELPER FUNCTIONS ===========

function logAdminAction($pdo, $adminId, $action, $table, $recordId, $details) {
    $stmt = $pdo->prepare('
        INSERT INTO admin_audit_logs (id, admin_user_id, action, table_name, record_id, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([
        generateUUID(),
        $adminId,
        $action,
        $table,
        $recordId,
        json_encode($details)
    ]);
}

function sendEmailWithCredentials($to, $subject, $body, $host, $port, $user, $pass, $from) {
    // Use PHPMailer if available, otherwise use mail()
    if (class_exists('PHPMailer\\PHPMailer\\PHPMailer')) {
        $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
        try {
            $mail->isSMTP();
            $mail->Host = $host;
            $mail->SMTPAuth = true;
            $mail->Username = $user;
            $mail->Password = $pass;
            $mail->SMTPSecure = $port == 465 ? 'ssl' : 'tls';
            $mail->Port = $port;
            $mail->setFrom($from);
            $mail->addAddress($to);
            $mail->Subject = $subject;
            $mail->Body = $body;
            $mail->send();
            return ['success' => true];
        } catch (\Exception $e) {
            return ['success' => false, 'error' => $mail->ErrorInfo];
        }
    }

    // Fallback to native mail() with SMTP context
    $headers = [
        'From' => $from,
        'Reply-To' => $from,
        'Content-Type' => 'text/plain; charset=UTF-8',
    ];

    $success = @mail($to, $subject, $body, implode("\r\n", array_map(fn($k, $v) => "$k: $v", array_keys($headers), $headers)));

    return ['success' => $success, 'error' => $success ? null : 'mail() function failed'];
}
