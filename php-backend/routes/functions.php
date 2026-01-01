<?php
/**
 * Functions Routes - Edge function equivalents
 */

function handleFunction($functionName, $body, $pdo, $config) {
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;
    $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;

    switch ($functionName) {
        case 'validate-temp-email':
            validateTempEmail($body, $pdo);
            break;
        case 'secure-email-access':
            secureEmailAccess($body, $pdo);
            break;
        case 'get-public-stats':
            getPublicStats($pdo);
            break;
        case 'verify-recaptcha':
            verifyRecaptcha($body, $config);
            break;
        case 'create-verification-and-send':
            createVerificationAndSend($body, $pdo, $config);
            break;
        case 'verify-email-token':
            verifyEmailToken($body, $pdo);
            break;
        case 'send-test-email':
            sendTestEmail($body, $pdo, $config, $isAdmin);
            break;
        case 'summarize-email':
            summarizeEmail($body, $pdo, $userId);
            break;
        case 'create-checkout':
            createCheckout($body, $pdo, $config, $userId);
            break;
        case 'email-webhook':
            emailWebhook($body, $pdo, $config);
            break;
        case 'generate-backup':
            generateBackup($pdo, $isAdmin, $userId);
            break;
        case 'email-health-check':
            emailHealthCheck($pdo, $isAdmin);
            break;
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown function: ' . $functionName]);
    }
}

function validateTempEmail($body, $pdo) {
    $tempEmailId = $body['tempEmailId'] ?? null;
    $token = $body['token'] ?? null;
    $emailIds = $body['emailIds'] ?? [];

    // Single email validation with token
    if ($tempEmailId && $token) {
        $stmt = $pdo->prepare('
            SELECT * FROM temp_emails 
            WHERE id = ? AND secret_token = ? AND is_active = 1 AND expires_at > NOW()
        ');
        $stmt->execute([$tempEmailId, $token]);
        $email = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($email) {
            echo json_encode(['valid' => true, 'email' => $email]);
        } else {
            echo json_encode(['valid' => false]);
        }
        return;
    }

    // Bulk validation
    if (!empty($emailIds)) {
        $placeholders = implode(',', array_fill(0, count($emailIds), '?'));
        $stmt = $pdo->prepare("
            SELECT * FROM temp_emails 
            WHERE id IN ($placeholders) AND is_active = 1 AND expires_at > NOW()
            ORDER BY created_at DESC
        ");
        $stmt->execute($emailIds);
        $validEmails = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (!empty($validEmails)) {
            $validIds = array_column($validEmails, 'id');
            echo json_encode([
                'valid' => true,
                'email' => $validEmails[0],
                'validEmailIds' => $validIds,
            ]);
        } else {
            echo json_encode(['valid' => false]);
        }
        return;
    }

    echo json_encode(['valid' => false, 'error' => 'No email ID provided']);
}

function secureEmailAccess($body, $pdo) {
    $tempEmailId = $body['temp_email_id'] ?? '';
    $token = $body['secret_token'] ?? '';

    if (empty($tempEmailId) || empty($token)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing temp_email_id or secret_token']);
        return;
    }

    $stmt = $pdo->prepare('
        SELECT te.*, d.name as domain_name
        FROM temp_emails te
        JOIN domains d ON d.id = te.domain_id
        WHERE te.id = ? AND te.secret_token = ? AND te.is_active = 1 AND te.expires_at > NOW()
    ');
    $stmt->execute([$tempEmailId, $token]);
    $email = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$email) {
        http_response_code(404);
        echo json_encode(['error' => 'Email not found or expired']);
        return;
    }

    // Get received emails
    $stmt = $pdo->prepare('
        SELECT * FROM received_emails 
        WHERE temp_email_id = ? 
        ORDER BY received_at DESC
    ');
    $stmt->execute([$tempEmailId]);
    $receivedEmails = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'temp_email' => $email,
        'received_emails' => $receivedEmails,
    ]);
}

function getPublicStats($pdo) {
    // Get email stats
    $stmt = $pdo->query("SELECT stat_key, stat_value FROM email_stats");
    $stats = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $stats[$row['stat_key']] = intval($row['stat_value']);
    }

    // Get domain count
    $stmt = $pdo->query("SELECT COUNT(*) FROM domains WHERE is_active = 1");
    $domainCount = $stmt->fetchColumn();

    echo json_encode([
        'total_emails_created' => $stats['total_emails_created'] ?? 0,
        'total_emails_received' => $stats['total_emails_received'] ?? 0,
        'active_domains' => intval($domainCount),
        'uptime_percentage' => 99.9,
    ]);
}

function verifyRecaptcha($body, $config) {
    $token = $body['token'] ?? '';
    $action = $body['action'] ?? '';

    // Skip if no reCAPTCHA configured
    if (empty($config['recaptcha']['secret_key'])) {
        echo json_encode(['success' => true, 'score' => 1.0]);
        return;
    }

    $response = file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, stream_context_create([
        'http' => [
            'method' => 'POST',
            'header' => 'Content-Type: application/x-www-form-urlencoded',
            'content' => http_build_query([
                'secret' => $config['recaptcha']['secret_key'],
                'response' => $token,
            ]),
        ],
    ]));

    $result = json_decode($response, true);

    if ($result['success'] && ($result['score'] ?? 0.5) >= 0.5) {
        echo json_encode(['success' => true, 'score' => $result['score'] ?? 0.5]);
    } else {
        echo json_encode(['success' => false, 'error' => 'reCAPTCHA verification failed']);
    }
}

function createVerificationAndSend($body, $pdo, $config) {
    $userId = $body['userId'] ?? '';
    $email = $body['email'] ?? '';
    $name = $body['name'] ?? '';

    if (empty($userId) || empty($email)) {
        http_response_code(400);
        echo json_encode(['error' => 'userId and email required']);
        return;
    }

    // Generate verification token
    $token = bin2hex(random_bytes(32));
    $expires = date('Y-m-d H:i:s', time() + 86400); // 24 hours

    $stmt = $pdo->prepare('
        INSERT INTO email_verifications (id, user_id, email, token, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([generateUUID(), $userId, $email, $token, $expires]);

    // Send email
    $verifyUrl = ($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com') . "/verify-email?token=$token";
    $subject = 'Verify your email address';
    $body = "Hi $name,\n\nPlease verify your email by clicking: $verifyUrl\n\nThis link expires in 24 hours.";

    sendEmail($email, $subject, $body, $config);

    echo json_encode(['success' => true]);
}

function verifyEmailToken($body, $pdo) {
    $token = $body['token'] ?? '';

    if (empty($token)) {
        http_response_code(400);
        echo json_encode(['error' => 'Token required']);
        return;
    }

    $stmt = $pdo->prepare('
        SELECT * FROM email_verifications 
        WHERE token = ? AND verified_at IS NULL AND expires_at > NOW()
    ');
    $stmt->execute([$token]);
    $verification = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$verification) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid or expired token']);
        return;
    }

    // Mark as verified
    $stmt = $pdo->prepare('UPDATE email_verifications SET verified_at = NOW() WHERE id = ?');
    $stmt->execute([$verification['id']]);

    // Update profile
    $stmt = $pdo->prepare('UPDATE profiles SET email_verified = 1 WHERE user_id = ?');
    $stmt->execute([$verification['user_id']]);

    echo json_encode(['success' => true, 'email' => $verification['email']]);
}

function sendTestEmail($body, $pdo, $config, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $to = $body['to'] ?? '';
    $subject = $body['subject'] ?? 'Test Email';
    $bodyText = $body['body'] ?? 'This is a test email.';

    if (empty($to)) {
        http_response_code(400);
        echo json_encode(['error' => 'Recipient email required']);
        return;
    }

    $success = sendEmail($to, $subject, $bodyText, $config);

    echo json_encode(['success' => $success]);
}

function summarizeEmail($body, $pdo, $userId) {
    // This would integrate with an AI service
    // For now, return a simple excerpt
    $emailId = $body['email_id'] ?? '';
    $content = $body['content'] ?? '';

    if (empty($content)) {
        $stmt = $pdo->prepare('SELECT body FROM received_emails WHERE id = ?');
        $stmt->execute([$emailId]);
        $email = $stmt->fetch(PDO::FETCH_ASSOC);
        $content = $email['body'] ?? '';
    }

    // Simple summary: first 200 characters
    $summary = substr(strip_tags($content), 0, 200);
    if (strlen($content) > 200) {
        $summary .= '...';
    }

    echo json_encode(['summary' => $summary]);
}

function createCheckout($body, $pdo, $config, $userId) {
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['error' => 'Authentication required']);
        return;
    }

    $tierId = $body['tier_id'] ?? '';
    $interval = $body['interval'] ?? 'monthly';

    // Get tier
    $stmt = $pdo->prepare('SELECT * FROM subscription_tiers WHERE id = ? AND is_active = 1');
    $stmt->execute([$tierId]);
    $tier = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tier) {
        http_response_code(404);
        echo json_encode(['error' => 'Subscription tier not found']);
        return;
    }

    // For Stripe integration, you would create a checkout session here
    // This is a placeholder response
    echo json_encode([
        'error' => 'Stripe integration not configured. Please set up Stripe keys in config.php',
    ]);
}

function emailWebhook($body, $pdo, $config) {
    // Handle incoming email webhooks from Mailgun/SendGrid/etc.
    $from = $body['from'] ?? $body['sender'] ?? '';
    $to = $body['to'] ?? $body['recipient'] ?? '';
    $subject = $body['subject'] ?? '';
    $textBody = $body['body-plain'] ?? $body['text'] ?? $body['body'] ?? '';
    $htmlBody = $body['body-html'] ?? $body['html'] ?? '';

    if (empty($to)) {
        http_response_code(400);
        echo json_encode(['error' => 'Recipient required']);
        return;
    }

    // Find matching temp email
    $stmt = $pdo->prepare('
        SELECT id FROM temp_emails 
        WHERE address = ? AND is_active = 1 AND expires_at > NOW()
    ');
    $stmt->execute([strtolower($to)]);
    $tempEmail = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tempEmail) {
        http_response_code(404);
        echo json_encode(['error' => 'Recipient not found']);
        return;
    }

    // Store email
    $emailId = generateUUID();
    $stmt = $pdo->prepare('
        INSERT INTO received_emails (id, temp_email_id, from_address, subject, body, html_body, received_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([$emailId, $tempEmail['id'], $from, $subject, $textBody, $htmlBody]);

    // Update stats
    $stmt = $pdo->prepare("
        INSERT INTO email_stats (id, stat_key, stat_value, updated_at)
        VALUES (?, 'total_emails_received', 1, NOW())
        ON DUPLICATE KEY UPDATE stat_value = stat_value + 1, updated_at = NOW()
    ");
    $stmt->execute([generateUUID()]);

    echo json_encode(['success' => true, 'email_id' => $emailId]);
}

function generateBackup($pdo, $isAdmin, $userId) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    $tables = ['domains', 'app_settings', 'blogs', 'email_templates', 'friendly_websites', 'homepage_sections'];
    $backup = [];
    $rowCounts = [];

    foreach ($tables as $table) {
        $stmt = $pdo->query("SELECT * FROM $table");
        $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $backup[$table] = $data;
        $rowCounts[$table] = count($data);
    }

    // Store backup record
    $backupId = generateUUID();
    $stmt = $pdo->prepare('
        INSERT INTO backup_history (id, backup_type, tables_included, row_counts, created_by, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    ');
    $stmt->execute([
        $backupId,
        'manual',
        json_encode($tables),
        json_encode($rowCounts),
        $userId,
        'completed'
    ]);

    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="backup_' . date('Y-m-d_His') . '.json"');
    echo json_encode($backup, JSON_PRETTY_PRINT);
    exit;
}

function emailHealthCheck($pdo, $isAdmin) {
    if (!$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    // Check mailbox status
    $stmt = $pdo->query('
        SELECT id, name, is_active, last_polled_at, last_error, last_error_at,
               emails_sent_today, daily_limit, emails_sent_this_hour, hourly_limit
        FROM mailboxes
        ORDER BY priority ASC
    ');
    $mailboxes = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $health = [
        'status' => 'healthy',
        'mailboxes' => [],
        'issues' => [],
    ];

    foreach ($mailboxes as $mb) {
        $mailboxHealth = [
            'id' => $mb['id'],
            'name' => $mb['name'],
            'is_active' => (bool) $mb['is_active'],
            'last_polled' => $mb['last_polled_at'],
            'daily_usage' => $mb['emails_sent_today'] . '/' . $mb['daily_limit'],
            'hourly_usage' => $mb['emails_sent_this_hour'] . '/' . $mb['hourly_limit'],
        ];

        if ($mb['last_error']) {
            $mailboxHealth['last_error'] = $mb['last_error'];
            $mailboxHealth['last_error_at'] = $mb['last_error_at'];
            $health['issues'][] = "Mailbox {$mb['name']} has error: {$mb['last_error']}";
        }

        $health['mailboxes'][] = $mailboxHealth;
    }

    if (!empty($health['issues'])) {
        $health['status'] = 'degraded';
    }

    echo json_encode($health);
}
