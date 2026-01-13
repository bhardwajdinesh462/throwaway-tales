<?php
/**
 * SEO Routes - Sitemap generation and search engine pinging
 */

if (!function_exists('handleSEORoute')) {
    function handleSEORoute($segments, $method, $body, $pdo, $config) {
        $action = $segments[1] ?? '';
        
        switch ($action) {
            case 'sitemap':
                return generateSitemap($pdo, $config);
            case 'ping':
                return pingSearchEngines($body, $pdo, $config);
            default:
                http_response_code(404);
                echo json_encode(['error' => 'Unknown SEO action']);
        }
    }
}

if (!function_exists('generateSitemap')) {
    function generateSitemap($pdo, $config) {
        $siteUrl = $config['site_url'] ?? 'https://nullsto.edu.pl';
        $today = date('Y-m-d');
        
        // Fetch blogs
        try {
            $stmt = $pdo->query("SELECT slug, updated_at, published_at FROM blogs WHERE published = 1");
            $blogs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $blogs = [];
        }
        
        // Fetch SEO settings to check for noIndex pages
        $seoSettings = null;
        try {
            $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'seo' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            if ($row) {
                $seoSettings = json_decode($row['value'], true);
            }
        } catch (Exception $e) {
            // Continue without SEO settings
        }
        
        // Static pages with priorities
        $pages = [
            ['path' => '/', 'priority' => '1.0', 'changefreq' => 'daily'],
            ['path' => '/dashboard', 'priority' => '0.9', 'changefreq' => 'daily'],
            ['path' => '/blog', 'priority' => '0.8', 'changefreq' => 'weekly'],
            ['path' => '/pricing', 'priority' => '0.8', 'changefreq' => 'monthly'],
            ['path' => '/about', 'priority' => '0.7', 'changefreq' => 'monthly'],
            ['path' => '/contact', 'priority' => '0.6', 'changefreq' => 'monthly'],
            ['path' => '/status', 'priority' => '0.7', 'changefreq' => 'daily'],
            ['path' => '/premium-features', 'priority' => '0.7', 'changefreq' => 'weekly'],
            ['path' => '/changelog', 'priority' => '0.5', 'changefreq' => 'weekly'],
            ['path' => '/api-access', 'priority' => '0.5', 'changefreq' => 'monthly'],
            ['path' => '/auth', 'priority' => '0.4', 'changefreq' => 'monthly'],
            ['path' => '/privacy-policy', 'priority' => '0.3', 'changefreq' => 'yearly'],
            ['path' => '/terms-of-service', 'priority' => '0.3', 'changefreq' => 'yearly'],
            ['path' => '/cookie-policy', 'priority' => '0.3', 'changefreq' => 'yearly'],
        ];
        
        // Generate XML
        $xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
        $xml .= '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
        
        // Add static pages
        foreach ($pages as $page) {
            // Check if page has noIndex
            if (!empty($seoSettings['pages'][$page['path']]['noIndex'])) {
                continue;
            }
            
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$siteUrl}{$page['path']}</loc>\n";
            $xml .= "    <lastmod>{$today}</lastmod>\n";
            $xml .= "    <changefreq>{$page['changefreq']}</changefreq>\n";
            $xml .= "    <priority>{$page['priority']}</priority>\n";
            $xml .= "  </url>\n";
        }
        
        // Add blog posts
        foreach ($blogs as $blog) {
            $lastmod = !empty($blog['updated_at']) 
                ? substr($blog['updated_at'], 0, 10) 
                : (!empty($blog['published_at']) ? substr($blog['published_at'], 0, 10) : $today);
            
            $xml .= "  <url>\n";
            $xml .= "    <loc>{$siteUrl}/blog/{$blog['slug']}</loc>\n";
            $xml .= "    <lastmod>{$lastmod}</lastmod>\n";
            $xml .= "    <changefreq>monthly</changefreq>\n";
            $xml .= "    <priority>0.6</priority>\n";
            $xml .= "  </url>\n";
        }
        
        $xml .= '</urlset>';
        
        // Update last generated timestamp
        try {
            if ($seoSettings) {
                $seoSettings['lastSitemapGenerated'] = date('c');
                $stmt = $pdo->prepare("UPDATE app_settings SET value = ?, updated_at = NOW() WHERE `key` = 'seo'");
                $stmt->execute([json_encode($seoSettings)]);
            }
        } catch (Exception $e) {
            // Non-critical, continue
        }
        
        header('Content-Type: application/xml');
        echo $xml;
    }
}

if (!function_exists('pingSearchEngines')) {
    function pingSearchEngines($body, $pdo, $config) {
        $siteUrl = $body['siteUrl'] ?? $config['site_url'] ?? 'https://nullsto.edu.pl';
        $indexNowKey = $body['indexNowKey'] ?? '';
        $urlsToIndex = $body['urlsToIndex'] ?? [];
        
        $sitemapUrl = $siteUrl . '/sitemap.xml';
        $timestamp = date('c');
        
        $results = [
            'google' => ['success' => false, 'message' => '', 'timestamp' => $timestamp],
            'bing' => ['success' => false, 'message' => '', 'timestamp' => $timestamp],
            'yandex' => ['success' => false, 'message' => '', 'timestamp' => $timestamp],
            'seznam' => ['success' => false, 'message' => '', 'timestamp' => $timestamp],
        ];
        
        // Ping Google
        $googleUrl = 'https://www.google.com/ping?sitemap=' . urlencode($sitemapUrl);
        $ch = curl_init($googleUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Nullsto-SEO-Bot/1.0');
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        $results['google'] = [
            'success' => $httpCode >= 200 && $httpCode < 300,
            'message' => $httpCode >= 200 && $httpCode < 300 ? 'Sitemap submitted successfully' : "Error: HTTP $httpCode",
            'timestamp' => $timestamp,
        ];
        
        // IndexNow for Bing, Yandex, Seznam
        if ($indexNowKey) {
            if (empty($urlsToIndex)) {
                $urlsToIndex = [
                    $siteUrl,
                    $siteUrl . '/dashboard',
                    $siteUrl . '/blog',
                    $siteUrl . '/pricing',
                    $siteUrl . '/about',
                ];
            }
            
            $host = parse_url($siteUrl, PHP_URL_HOST);
            $indexNowPayload = json_encode([
                'host' => $host,
                'key' => $indexNowKey,
                'keyLocation' => $siteUrl . '/' . $indexNowKey . '.txt',
                'urlList' => $urlsToIndex,
            ]);
            
            $endpoints = [
                'bing' => 'https://www.bing.com/indexnow',
                'yandex' => 'https://yandex.com/indexnow',
                'seznam' => 'https://search.seznam.cz/indexnow',
            ];
            
            foreach ($endpoints as $name => $url) {
                $ch = curl_init($url);
                curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
                curl_setopt($ch, CURLOPT_POST, true);
                curl_setopt($ch, CURLOPT_POSTFIELDS, $indexNowPayload);
                curl_setopt($ch, CURLOPT_HTTPHEADER, [
                    'Content-Type: application/json; charset=utf-8',
                    'User-Agent: Nullsto-SEO-Bot/1.0',
                ]);
                curl_setopt($ch, CURLOPT_TIMEOUT, 10);
                
                $response = curl_exec($ch);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                curl_close($ch);
                
                $isSuccess = in_array($httpCode, [200, 202, 204]);
                $results[$name] = [
                    'success' => $isSuccess,
                    'message' => $isSuccess 
                        ? count($urlsToIndex) . ' URLs submitted' 
                        : "Error: HTTP $httpCode - $response",
                    'timestamp' => $timestamp,
                ];
            }
        } else {
            $noKeyMessage = 'IndexNow API key not configured';
            $results['bing']['message'] = $noKeyMessage;
            $results['yandex']['message'] = $noKeyMessage;
            $results['seznam']['message'] = $noKeyMessage;
        }
        
        // Save ping status to SEO settings
        try {
            $stmt = $pdo->prepare("SELECT value FROM app_settings WHERE `key` = 'seo' LIMIT 1");
            $stmt->execute();
            $row = $stmt->fetch();
            
            if ($row) {
                $seoSettings = json_decode($row['value'], true);
                $seoSettings['lastPingStatus'] = $results;
                
                $stmt = $pdo->prepare("UPDATE app_settings SET value = ?, updated_at = NOW() WHERE `key` = 'seo'");
                $stmt->execute([json_encode($seoSettings)]);
            }
        } catch (Exception $e) {
            // Non-critical
        }
        
        echo json_encode($results);
    }
}
