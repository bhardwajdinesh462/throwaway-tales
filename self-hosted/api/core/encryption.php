<?php
/**
 * Email Encryption Handler
 * AES-256-GCM encryption for email content
 */

class Encryption {
    private const CIPHER = 'aes-256-gcm';
    private const TAG_LENGTH = 16;
    
    /**
     * Get encryption key from config
     */
    private static function getKey(): string {
        $config = require dirname(__DIR__) . '/config.php';
        $key = $config['security']['encryption_key'];
        
        // Ensure key is 32 bytes for AES-256
        return hash('sha256', $key, true);
    }
    
    /**
     * Encrypt data
     */
    public static function encrypt(string $plaintext): string {
        $key = self::getKey();
        $iv = random_bytes(12); // 96-bit IV for GCM
        $tag = '';
        
        $ciphertext = openssl_encrypt(
            $plaintext,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag,
            '',
            self::TAG_LENGTH
        );
        
        if ($ciphertext === false) {
            throw new Exception('Encryption failed');
        }
        
        // Combine IV + Tag + Ciphertext and encode
        return base64_encode($iv . $tag . $ciphertext);
    }
    
    /**
     * Decrypt data
     */
    public static function decrypt(string $encrypted): string {
        $key = self::getKey();
        $data = base64_decode($encrypted);
        
        if ($data === false || strlen($data) < 12 + self::TAG_LENGTH) {
            throw new Exception('Invalid encrypted data');
        }
        
        $iv = substr($data, 0, 12);
        $tag = substr($data, 12, self::TAG_LENGTH);
        $ciphertext = substr($data, 12 + self::TAG_LENGTH);
        
        $plaintext = openssl_decrypt(
            $ciphertext,
            self::CIPHER,
            $key,
            OPENSSL_RAW_DATA,
            $iv,
            $tag
        );
        
        if ($plaintext === false) {
            throw new Exception('Decryption failed');
        }
        
        return $plaintext;
    }
    
    /**
     * Encrypt email content (subject, body, sender)
     */
    public static function encryptEmail(array $emailData): array {
        $encrypted = $emailData;
        
        if (isset($emailData['subject'])) {
            $encrypted['subject_encrypted'] = self::encrypt($emailData['subject']);
            unset($encrypted['subject']);
        }
        
        if (isset($emailData['body_text'])) {
            $encrypted['body_text_encrypted'] = self::encrypt($emailData['body_text']);
            unset($encrypted['body_text']);
        }
        
        if (isset($emailData['body_html'])) {
            $encrypted['body_html_encrypted'] = self::encrypt($emailData['body_html']);
            unset($encrypted['body_html']);
        }
        
        if (isset($emailData['from_email'])) {
            $encrypted['from_email_encrypted'] = self::encrypt($emailData['from_email']);
            unset($encrypted['from_email']);
        }
        
        if (isset($emailData['from_name'])) {
            $encrypted['from_name_encrypted'] = self::encrypt($emailData['from_name']);
            unset($encrypted['from_name']);
        }
        
        $encrypted['is_encrypted'] = true;
        
        return $encrypted;
    }
    
    /**
     * Decrypt email content
     */
    public static function decryptEmail(array $emailData): array {
        $decrypted = $emailData;
        
        if (!($emailData['is_encrypted'] ?? false)) {
            return $emailData;
        }
        
        try {
            if (isset($emailData['subject_encrypted'])) {
                $decrypted['subject'] = self::decrypt($emailData['subject_encrypted']);
            }
            
            if (isset($emailData['body_text_encrypted'])) {
                $decrypted['body_text'] = self::decrypt($emailData['body_text_encrypted']);
            }
            
            if (isset($emailData['body_html_encrypted'])) {
                $decrypted['body_html'] = self::decrypt($emailData['body_html_encrypted']);
            }
            
            if (isset($emailData['from_email_encrypted'])) {
                $decrypted['from_email'] = self::decrypt($emailData['from_email_encrypted']);
            }
            
            if (isset($emailData['from_name_encrypted'])) {
                $decrypted['from_name'] = self::decrypt($emailData['from_name_encrypted']);
            }
        } catch (Exception $e) {
            error_log("Email decryption failed: " . $e->getMessage());
            // Return original data if decryption fails
            return $emailData;
        }
        
        return $decrypted;
    }
    
    /**
     * Hash sensitive data for searching
     */
    public static function hash(string $data): string {
        $key = self::getKey();
        return hash_hmac('sha256', strtolower(trim($data)), $key);
    }
    
    /**
     * Generate secure random token
     */
    public static function generateSecureToken(int $length = 32): string {
        return bin2hex(random_bytes($length));
    }
}
