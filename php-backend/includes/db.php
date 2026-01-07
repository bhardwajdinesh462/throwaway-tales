<?php
/**
 * Database Connection Helper
 * Provides a shared database connection function that handles both
 * constant-based and array-based config formats.
 */

/**
 * Get PDO database connection
 * Works with both constant-based (cron scripts) and array-based (main app) config
 */
function getDbConnection(): PDO {
    // Try constants first (for cron scripts)
    if (defined('DB_HOST')) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=utf8mb4";
        return new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    
    // Try loading config file
    $configPath = __DIR__ . '/../config.php';
    if (!file_exists($configPath)) {
        throw new Exception('Configuration file not found');
    }
    
    $config = require $configPath;
    
    // Handle array-based config
    if (is_array($config) && isset($config['db'])) {
        $db = $config['db'];
        $dsn = "mysql:host={$db['host']};dbname={$db['name']};charset=" . ($db['charset'] ?? 'utf8mb4');
        return new PDO($dsn, $db['user'], $db['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    }
    
    throw new Exception('Invalid database configuration');
}

/**
 * Get config value safely
 * Works with both constant-based and array-based config
 */
function getConfig(string $key, $default = null) {
    // Check constants first
    $constantName = strtoupper(str_replace('.', '_', $key));
    if (defined($constantName)) {
        return constant($constantName);
    }
    
    // Try loading config file
    static $config = null;
    if ($config === null) {
        $configPath = __DIR__ . '/../config.php';
        if (file_exists($configPath)) {
            $config = require $configPath;
        } else {
            $config = [];
        }
    }
    
    // Handle nested keys like 'db.host'
    $keys = explode('.', $key);
    $value = $config;
    foreach ($keys as $k) {
        if (is_array($value) && isset($value[$k])) {
            $value = $value[$k];
        } else {
            return $default;
        }
    }
    
    return $value;
}
