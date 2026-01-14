<?php
/**
 * Google Search Console API Integration
 * Provides OAuth2 authentication, sitemap submission, and performance data
 */

function handleGSCRoute($segments, $method, $body, $pdo, $config) {
    $action = $segments[1] ?? '';
    
    // Get Google OAuth credentials from config
    $clientId = $config['google']['client_id'] ?? getenv('GOOGLE_CLIENT_ID') ?? '';
    $clientSecret = $config['google']['client_secret'] ?? getenv('GOOGLE_CLIENT_SECRET') ?? '';
    
    switch ($action) {
        case 'authorize':
            return gscAuthorize($body, $clientId, $config);
        case 'callback':
            return gscCallback($body, $pdo, $clientId, $clientSecret);
        case 'status':
            return gscStatus($pdo);
        case 'disconnect':
            return gscDisconnect($pdo);
        case 'sites':
            return gscListSites($pdo, $clientId, $clientSecret);
        case 'select-site':
            return gscSelectSite($body, $pdo);
        case 'submit-sitemap':
            return gscSubmitSitemap($body, $pdo, $clientId, $clientSecret);
        case 'request-indexing':
            return gscRequestIndexing($body, $pdo, $clientId, $clientSecret);
        case 'performance':
            return gscPerformance($body, $pdo, $clientId, $clientSecret);
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown GSC action: ' . $action]);
    }
}

/**
 * Generate OAuth2 authorization URL
 */
function gscAuthorize($body, $clientId, $config) {
    if (empty($clientId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Google OAuth not configured. Please add GOOGLE_CLIENT_ID to config.']);
        return;
    }
    
    $redirectUri = $body['redirectUri'] ?? ($config['app_url'] ?? 'https://yourdomain.com') . '/api/gsc/callback';
    $scopes = [
        'https://www.googleapis.com/auth/webmasters.readonly',
        'https://www.googleapis.com/auth/webmasters',
        'https://www.googleapis.com/auth/indexing'
    ];
    
    $state = $body['state'] ?? bin2hex(random_bytes(16));
    
    $authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
        'client_id' => $clientId,
        'redirect_uri' => $redirectUri,
        'response_type' => 'code',
        'scope' => implode(' ', $scopes),
        'access_type' => 'offline',
        'prompt' => 'consent',
        'state' => $state
    ]);
    
    echo json_encode(['authUrl' => $authUrl, 'state' => $state]);
}

/**
 * Exchange authorization code for tokens
 */
function gscCallback($body, $pdo, $clientId, $clientSecret) {
    if (empty($clientId) || empty($clientSecret)) {
        http_response_code(400);
        echo json_encode(['error' => 'Google OAuth not configured']);
        return;
    }
    
    $code = $body['code'] ?? '';
    $redirectUri = $body['redirectUri'] ?? '';
    
    if (empty($code)) {
        http_response_code(400);
        echo json_encode(['error' => 'Authorization code required']);
        return;
    }
    
    // Exchange code for tokens
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query([
            'client_id' => $clientId,
            'client_secret' => $clientSecret,
            'code' => $code,
            'grant_type' => 'authorization_code',
            'redirect_uri' => $redirectUri
        ]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded']
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $tokens = json_decode($response, true);
    
    if (isset($tokens['error'])) {
        http_response_code(400);
        echo json_encode(['error' => $tokens['error_description'] ?? 'Token exchange failed']);
        return;
    }
    
    // Store tokens in database
    $gscTokens = [
        'access_token' => $tokens['access_token'],
        'refresh_token' => $tokens['refresh_token'] ?? '',
        'expires_at' => time() + ($tokens['expires_in'] ?? 3600) * 1000,
        'site_url' => null
    ];
    
    $stmt = $pdo->prepare("
        INSERT INTO app_settings (id, `key`, value, updated_at)
        VALUES (?, 'gsc_tokens', ?, NOW())
        ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()
    ");
    $stmt->execute([generateUUID(), json_encode($gscTokens), json_encode($gscTokens)]);
    
    echo json_encode(['success' => true]);
}

/**
 * Get GSC connection status
 */
function gscStatus($pdo) {
    $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'gsc_tokens'");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$row || !$row['value']) {
        echo json_encode(['connected' => false]);
        return;
    }
    
    $tokens = json_decode($row['value'], true);
    echo json_encode([
        'connected' => true,
        'siteUrl' => $tokens['site_url'] ?? null,
        'expiresAt' => $tokens['expires_at'] ?? null
    ]);
}

/**
 * Disconnect from GSC
 */
function gscDisconnect($pdo) {
    $stmt = $pdo->prepare("DELETE FROM app_settings WHERE `key` = 'gsc_tokens'");
    $stmt->execute();
    echo json_encode(['success' => true]);
}

/**
 * List verified sites
 */
function gscListSites($pdo, $clientId, $clientSecret) {
    $accessToken = getValidGSCToken($pdo, $clientId, $clientSecret);
    if (!$accessToken) {
        http_response_code(401);
        echo json_encode(['error' => 'Not connected to Google Search Console']);
        return;
    }
    
    $ch = curl_init('https://www.googleapis.com/webmasters/v3/sites');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken]
    ]);
    
    $response = curl_exec($ch);
    curl_close($ch);
    
    echo $response;
}

/**
 * Select a site for monitoring
 */
function gscSelectSite($body, $pdo) {
    $siteUrl = $body['siteUrl'] ?? '';
    
    $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'gsc_tokens'");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$row) {
        http_response_code(401);
        echo json_encode(['error' => 'Not connected']);
        return;
    }
    
    $tokens = json_decode($row['value'], true);
    $tokens['site_url'] = $siteUrl;
    
    $stmt = $pdo->prepare("UPDATE app_settings SET value = ?, updated_at = NOW() WHERE `key` = 'gsc_tokens'");
    $stmt->execute([json_encode($tokens)]);
    
    echo json_encode(['success' => true]);
}

/**
 * Submit sitemap to GSC
 */
function gscSubmitSitemap($body, $pdo, $clientId, $clientSecret) {
    $accessToken = getValidGSCToken($pdo, $clientId, $clientSecret);
    if (!$accessToken) {
        http_response_code(401);
        echo json_encode(['error' => 'Not connected to Google Search Console']);
        return;
    }
    
    // Get site URL from tokens
    $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'gsc_tokens'");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $tokens = json_decode($row['value'], true);
    
    $siteUrl = $body['siteUrl'] ?? $tokens['site_url'] ?? '';
    $sitemapUrl = $body['sitemapUrl'] ?? $siteUrl . '/sitemap.xml';
    
    if (empty($siteUrl)) {
        http_response_code(400);
        echo json_encode(['error' => 'No site URL configured']);
        return;
    }
    
    $apiUrl = 'https://www.googleapis.com/webmasters/v3/sites/' 
        . urlencode($siteUrl) . '/sitemaps/' . urlencode($sitemapUrl);
    
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST => 'PUT',
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $accessToken]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200 && $httpCode !== 204) {
        http_response_code($httpCode);
        echo json_encode(['success' => false, 'error' => 'Failed to submit sitemap']);
        return;
    }
    
    echo json_encode(['success' => true, 'sitemapUrl' => $sitemapUrl]);
}

/**
 * Request URL indexing
 */
function gscRequestIndexing($body, $pdo, $clientId, $clientSecret) {
    $accessToken = getValidGSCToken($pdo, $clientId, $clientSecret);
    if (!$accessToken) {
        http_response_code(401);
        echo json_encode(['error' => 'Not connected to Google Search Console']);
        return;
    }
    
    $urlToIndex = $body['urlToIndex'] ?? '';
    if (empty($urlToIndex)) {
        http_response_code(400);
        echo json_encode(['error' => 'URL to index required']);
        return;
    }
    
    $ch = curl_init('https://indexing.googleapis.com/v3/urlNotifications:publish');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'url' => $urlToIndex,
            'type' => 'URL_UPDATED'
        ]),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $result = json_decode($response, true);
    
    if ($httpCode !== 200) {
        http_response_code($httpCode);
        echo json_encode(['success' => false, 'error' => $result['error']['message'] ?? 'Indexing request failed']);
        return;
    }
    
    echo json_encode(['success' => true, 'result' => $result]);
}

/**
 * Get search performance data
 */
function gscPerformance($body, $pdo, $clientId, $clientSecret) {
    $accessToken = getValidGSCToken($pdo, $clientId, $clientSecret);
    if (!$accessToken) {
        http_response_code(401);
        echo json_encode(['error' => 'Not connected to Google Search Console']);
        return;
    }
    
    // Get site URL from tokens
    $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'gsc_tokens'");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    $tokens = json_decode($row['value'], true);
    
    $siteUrl = $body['siteUrl'] ?? $tokens['site_url'] ?? '';
    
    if (empty($siteUrl)) {
        http_response_code(400);
        echo json_encode(['error' => 'No site URL configured']);
        return;
    }
    
    // Get last 28 days of data
    $endDate = date('Y-m-d');
    $startDate = date('Y-m-d', strtotime('-28 days'));
    
    $apiUrl = 'https://www.googleapis.com/webmasters/v3/sites/' 
        . urlencode($siteUrl) . '/searchAnalytics/query';
    
    $ch = curl_init($apiUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'startDate' => $startDate,
            'endDate' => $endDate,
            'dimensions' => ['date'],
            'rowLimit' => 28
        ]),
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json'
        ]
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        http_response_code($httpCode);
        echo json_encode(['error' => 'Failed to fetch performance data']);
        return;
    }
    
    $result = json_decode($response, true);
    
    // Calculate totals
    $totals = [
        'clicks' => 0,
        'impressions' => 0,
        'ctr' => 0,
        'position' => 0
    ];
    
    $rows = $result['rows'] ?? [];
    if (!empty($rows)) {
        foreach ($rows as $row) {
            $totals['clicks'] += $row['clicks'] ?? 0;
            $totals['impressions'] += $row['impressions'] ?? 0;
        }
        
        if ($totals['impressions'] > 0) {
            $totals['ctr'] = ($totals['clicks'] / $totals['impressions']) * 100;
        }
        
        $positionSum = array_reduce($rows, function($sum, $row) {
            return $sum + ($row['position'] ?? 0);
        }, 0);
        $totals['position'] = count($rows) > 0 ? $positionSum / count($rows) : 0;
    }
    
    echo json_encode([
        'clicks' => $totals['clicks'],
        'impressions' => $totals['impressions'],
        'ctr' => number_format($totals['ctr'], 2),
        'position' => number_format($totals['position'], 1),
        'rows' => $rows
    ]);
}

/**
 * Get valid access token, refreshing if needed
 */
function getValidGSCToken($pdo, $clientId, $clientSecret) {
    $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'gsc_tokens'");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$row || !$row['value']) {
        return null;
    }
    
    $tokens = json_decode($row['value'], true);
    
    // Check if token needs refresh (5 min buffer)
    if (time() * 1000 >= ($tokens['expires_at'] ?? 0) - 300000) {
        if (empty($tokens['refresh_token'])) {
            return null;
        }
        
        // Refresh the token
        $ch = curl_init('https://oauth2.googleapis.com/token');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query([
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'refresh_token' => $tokens['refresh_token'],
                'grant_type' => 'refresh_token'
            ]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded']
        ]);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $refreshData = json_decode($response, true);
        if (isset($refreshData['error'])) {
            return null;
        }
        
        $tokens['access_token'] = $refreshData['access_token'];
        $tokens['expires_at'] = time() * 1000 + ($refreshData['expires_in'] ?? 3600) * 1000;
        
        // Update stored tokens
        $stmt = $pdo->prepare("UPDATE app_settings SET value = ?, updated_at = NOW() WHERE `key` = 'gsc_tokens'");
        $stmt->execute([json_encode($tokens)]);
    }
    
    return $tokens['access_token'] ?? null;
}
