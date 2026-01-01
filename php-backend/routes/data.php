<?php
/**
 * Data Routes - Database CRUD operations
 */

function handleData($path, $method, $body, $pdo, $config) {
    // Parse path: could be "table" or "table/upsert"
    $parts = explode('/', $path, 2);
    $table = preg_replace('/[^a-z0-9_]/', '', $parts[0]);
    $action = $parts[1] ?? null;
    
    // Get authenticated user
    $user = getAuthUser($pdo, $config);
    $userId = $user['id'] ?? null;
    $isAdmin = $userId ? checkIsAdmin($pdo, $userId) : false;

    // Table whitelist and access control
    $publicReadTables = [
        'domains', 'app_settings', 'banners', 'blogs', 'friendly_websites', 
        'homepage_sections', 'subscription_tiers', 'email_stats', 'email_templates'
    ];
    
    $authRequiredTables = [
        'profiles', 'temp_emails', 'received_emails', 'email_forwarding',
        'saved_emails', 'user_subscriptions', 'user_usage', 'user_2fa',
        'user_invoices', 'push_subscriptions'
    ];
    
    $adminOnlyTables = [
        'admin_audit_logs', 'admin_role_requests', 'backup_history', 'blocked_ips',
        'email_logs', 'email_restrictions', 'mailboxes', 'rate_limits',
        'user_roles', 'user_suspensions'
    ];

    // Access control
    if (in_array($table, $adminOnlyTables) && !$isAdmin) {
        http_response_code(403);
        echo json_encode(['error' => 'Admin access required']);
        return;
    }

    if (in_array($table, $authRequiredTables) && !$userId && $method !== 'GET') {
        // Allow guest temp_emails creation
        if ($table !== 'temp_emails' && $table !== 'push_subscriptions') {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            return;
        }
    }

    // Handle upsert action
    if ($action === 'upsert') {
        handleUpsert($table, $body, $pdo, $userId, $isAdmin);
        return;
    }

    switch ($method) {
        case 'GET':
            handleSelect($table, $pdo, $userId, $isAdmin);
            break;
        case 'POST':
            handleInsert($table, $body, $pdo, $userId, $isAdmin);
            break;
        case 'PATCH':
            handleUpdate($table, $body, $pdo, $userId, $isAdmin);
            break;
        case 'DELETE':
            handleDelete($table, $pdo, $userId, $isAdmin);
            break;
        default:
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
    }
}

function handleSelect($table, $pdo, $userId, $isAdmin) {
    $params = [];
    $where = [];
    
    // Parse query parameters
    $select = $_GET['select'] ?? '*';
    $limit = min(intval($_GET['limit'] ?? 100), 1000);
    $offset = intval($_GET['offset'] ?? 0);
    $single = isset($_GET['single']);
    $order = $_GET['order'] ?? null;

    // Parse filters
    foreach ($_GET as $key => $value) {
        if (preg_match('/^(eq|neq|gt|gte|lt|lte|like|ilike|in|is)\[(.+)\]$/', $key, $matches)) {
            $op = $matches[1];
            $column = preg_replace('/[^a-z0-9_]/', '', $matches[2]);
            
            switch ($op) {
                case 'eq':
                    $where[] = "$column = ?";
                    $params[] = $value;
                    break;
                case 'neq':
                    $where[] = "$column != ?";
                    $params[] = $value;
                    break;
                case 'gt':
                    $where[] = "$column > ?";
                    $params[] = $value;
                    break;
                case 'gte':
                    $where[] = "$column >= ?";
                    $params[] = $value;
                    break;
                case 'lt':
                    $where[] = "$column < ?";
                    $params[] = $value;
                    break;
                case 'lte':
                    $where[] = "$column <= ?";
                    $params[] = $value;
                    break;
                case 'like':
                    $where[] = "$column LIKE ?";
                    $params[] = $value;
                    break;
                case 'ilike':
                    $where[] = "LOWER($column) LIKE LOWER(?)";
                    $params[] = $value;
                    break;
                case 'in':
                    $values = explode(',', $value);
                    $placeholders = implode(',', array_fill(0, count($values), '?'));
                    $where[] = "$column IN ($placeholders)";
                    $params = array_merge($params, $values);
                    break;
                case 'is':
                    if (strtolower($value) === 'null') {
                        $where[] = "$column IS NULL";
                    } else {
                        $where[] = "$column IS NOT NULL";
                    }
                    break;
            }
        } elseif (preg_match('/^filter\[(.+)\]$/', $key, $matches)) {
            $column = preg_replace('/[^a-z0-9_]/', '', $matches[1]);
            $where[] = "$column = ?";
            $params[] = $value;
        }
    }

    // Apply RLS-like filtering
    $where = applyRowLevelSecurity($table, $where, $params, $userId, $isAdmin);

    // Build query
    $sql = "SELECT $select FROM $table";
    if (!empty($where)) {
        $sql .= ' WHERE ' . implode(' AND ', $where);
    }

    // Order
    if ($order) {
        $orders = explode(',', $order);
        $orderClauses = [];
        foreach ($orders as $o) {
            if (preg_match('/^([a-z0-9_]+)\.(asc|desc)$/i', trim($o), $m)) {
                $orderClauses[] = "{$m[1]} " . strtoupper($m[2]);
            }
        }
        if (!empty($orderClauses)) {
            $sql .= ' ORDER BY ' . implode(', ', $orderClauses);
        }
    }

    $sql .= " LIMIT $limit OFFSET $offset";

    try {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if ($single) {
            echo json_encode($results[0] ?? null);
        } else {
            echo json_encode($results);
        }
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Query failed: ' . $e->getMessage()]);
    }
}

function handleInsert($table, $body, $pdo, $userId, $isAdmin) {
    $data = $body['data'] ?? $body;
    $select = $body['select'] ?? null;

    // Handle array of records
    $records = isset($data[0]) && is_array($data[0]) ? $data : [$data];

    // Add automatic fields
    foreach ($records as &$record) {
        if (!isset($record['id'])) {
            $record['id'] = generateUUID();
        }
        if (!isset($record['created_at'])) {
            $record['created_at'] = date('Y-m-d H:i:s');
        }
        
        // Apply ownership for user-owned tables
        if (in_array($table, ['temp_emails', 'email_forwarding', 'saved_emails', 'user_usage'])) {
            if ($userId && !isset($record['user_id'])) {
                $record['user_id'] = $userId;
            }
        }
    }

    try {
        $inserted = [];
        foreach ($records as $record) {
            $columns = array_keys($record);
            $placeholders = implode(', ', array_fill(0, count($columns), '?'));
            $columnList = implode(', ', $columns);

            $sql = "INSERT INTO $table ($columnList) VALUES ($placeholders)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_values($record));
            $inserted[] = $record;
        }

        echo json_encode(count($inserted) === 1 ? $inserted[0] : $inserted);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Insert failed: ' . $e->getMessage()]);
    }
}

function handleUpdate($table, $body, $pdo, $userId, $isAdmin) {
    $data = $body['data'] ?? $body;
    $params = [];
    $where = [];

    // Parse filters from query string
    foreach ($_GET as $key => $value) {
        if (preg_match('/^filter\[(.+)\]$/', $key, $matches)) {
            $column = preg_replace('/[^a-z0-9_]/', '', $matches[1]);
            $where[] = "$column = ?";
            $params[] = $value;
        }
    }

    if (empty($where)) {
        http_response_code(400);
        echo json_encode(['error' => 'Filter required for update']);
        return;
    }

    // Apply ownership check
    if (!$isAdmin && in_array($table, ['temp_emails', 'profiles', 'email_forwarding', 'saved_emails', 'user_subscriptions'])) {
        if ($userId) {
            $where[] = 'user_id = ?';
            $params[] = $userId;
        }
    }

    // Build SET clause
    $setClauses = [];
    $setParams = [];
    foreach ($data as $column => $value) {
        $column = preg_replace('/[^a-z0-9_]/', '', $column);
        $setClauses[] = "$column = ?";
        $setParams[] = $value;
    }

    if (!in_array('updated_at', array_keys($data))) {
        $setClauses[] = 'updated_at = NOW()';
    }

    $allParams = array_merge($setParams, $params);

    try {
        $sql = "UPDATE $table SET " . implode(', ', $setClauses) . ' WHERE ' . implode(' AND ', $where);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($allParams);

        echo json_encode(['success' => true, 'affected' => $stmt->rowCount()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Update failed: ' . $e->getMessage()]);
    }
}

function handleDelete($table, $pdo, $userId, $isAdmin) {
    $params = [];
    $where = [];

    foreach ($_GET as $key => $value) {
        if (preg_match('/^filter\[(.+)\]$/', $key, $matches)) {
            $column = preg_replace('/[^a-z0-9_]/', '', $matches[1]);
            $where[] = "$column = ?";
            $params[] = $value;
        }
    }

    if (empty($where)) {
        http_response_code(400);
        echo json_encode(['error' => 'Filter required for delete']);
        return;
    }

    // Apply ownership check
    if (!$isAdmin && in_array($table, ['temp_emails', 'email_forwarding', 'saved_emails'])) {
        if ($userId) {
            $where[] = 'user_id = ?';
            $params[] = $userId;
        }
    }

    try {
        $sql = "DELETE FROM $table WHERE " . implode(' AND ', $where);
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);

        echo json_encode(['success' => true, 'affected' => $stmt->rowCount()]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Delete failed: ' . $e->getMessage()]);
    }
}

function handleUpsert($table, $body, $pdo, $userId, $isAdmin) {
    $data = $body['data'] ?? $body;
    $onConflict = $body['onConflict'] ?? 'id';

    $records = isset($data[0]) && is_array($data[0]) ? $data : [$data];

    try {
        $upserted = [];
        foreach ($records as $record) {
            if (!isset($record['id'])) {
                $record['id'] = generateUUID();
            }

            $columns = array_keys($record);
            $placeholders = implode(', ', array_fill(0, count($columns), '?'));
            $columnList = implode(', ', $columns);
            
            $updateClauses = [];
            foreach ($columns as $col) {
                if ($col !== $onConflict) {
                    $updateClauses[] = "$col = VALUES($col)";
                }
            }

            $sql = "INSERT INTO $table ($columnList) VALUES ($placeholders) 
                    ON DUPLICATE KEY UPDATE " . implode(', ', $updateClauses);
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute(array_values($record));
            $upserted[] = $record;
        }

        echo json_encode(count($upserted) === 1 ? $upserted[0] : $upserted);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['error' => 'Upsert failed: ' . $e->getMessage()]);
    }
}

function applyRowLevelSecurity($table, $where, &$params, $userId, $isAdmin) {
    if ($isAdmin) return $where;

    switch ($table) {
        case 'domains':
            $where[] = 'is_active = 1';
            break;
        case 'banners':
            $where[] = 'is_active = 1';
            $where[] = '(start_date IS NULL OR start_date <= NOW())';
            $where[] = '(end_date IS NULL OR end_date >= NOW())';
            break;
        case 'blogs':
            $where[] = 'published = 1';
            break;
        case 'friendly_websites':
            $where[] = 'is_active = 1';
            break;
        case 'subscription_tiers':
            $where[] = 'is_active = 1';
            break;
        case 'app_settings':
            $where[] = "`key` IN ('seo', 'general', 'appearance', 'pricing_content', 'friendly_sites_widget', 'blog_settings', 'announcement', 'seo_settings', 'general_settings', 'appearance_settings')";
            break;
        case 'profiles':
        case 'temp_emails':
        case 'email_forwarding':
        case 'saved_emails':
        case 'user_subscriptions':
        case 'user_usage':
        case 'user_2fa':
        case 'user_invoices':
            if ($userId) {
                $where[] = 'user_id = ?';
                $params[] = $userId;
            }
            break;
        case 'received_emails':
            if ($userId) {
                $where[] = 'temp_email_id IN (SELECT id FROM temp_emails WHERE user_id = ?)';
                $params[] = $userId;
            }
            break;
    }

    return $where;
}

function checkIsAdmin($pdo, $userId) {
    $stmt = $pdo->prepare("SELECT role FROM user_roles WHERE user_id = ? AND role = 'admin'");
    $stmt->execute([$userId]);
    return (bool) $stmt->fetch();
}
