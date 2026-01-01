<?php
/**
 * Webhook Routes - Stripe and PayPal payment webhooks
 */

function handleWebhook($provider, $body, $pdo, $config) {
    $logger = ErrorLogger::getInstance(__DIR__ . '/../logs');
    
    switch ($provider) {
        case 'stripe':
            handleStripeWebhook($pdo, $config, $logger);
            break;
            
        case 'paypal':
            handlePaypalWebhook($pdo, $config, $logger);
            break;
            
        default:
            http_response_code(404);
            echo json_encode(['error' => 'Unknown webhook provider']);
    }
}

function handleStripeWebhook($pdo, $config, $logger) {
    // Get raw payload
    $payload = file_get_contents('php://input');
    $sigHeader = $_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '';
    
    // Get Stripe keys from database or config
    $stripeConfig = getPaymentConfig($pdo, 'stripe');
    $webhookSecret = $stripeConfig['webhook_secret'] ?? $config['stripe']['webhook_secret'] ?? '';
    
    if (empty($webhookSecret)) {
        $logger->warning('Stripe webhook received but no webhook secret configured');
        http_response_code(400);
        echo json_encode(['error' => 'Webhook secret not configured']);
        return;
    }
    
    // Verify signature
    try {
        $event = verifyStripeSignature($payload, $sigHeader, $webhookSecret);
    } catch (Exception $e) {
        $logger->error('Stripe webhook signature verification failed', ['error' => $e->getMessage()]);
        http_response_code(400);
        echo json_encode(['error' => 'Invalid signature']);
        return;
    }
    
    if (!$event) {
        $event = json_decode($payload, true);
    }
    
    $eventType = $event['type'] ?? '';
    $eventData = $event['data']['object'] ?? [];
    
    $logger->info('Stripe webhook received', ['type' => $eventType, 'id' => $event['id'] ?? 'unknown']);
    
    try {
        switch ($eventType) {
            case 'checkout.session.completed':
                handleCheckoutCompleted($pdo, $eventData, $logger, $config);
                break;
                
            case 'invoice.paid':
                handleInvoicePaid($pdo, $eventData, $logger, $config);
                break;
                
            case 'invoice.payment_failed':
                handlePaymentFailed($pdo, $eventData, $logger, $config);
                break;
                
            case 'customer.subscription.updated':
                handleSubscriptionUpdated($pdo, $eventData, $logger);
                break;
                
            case 'customer.subscription.deleted':
                handleSubscriptionDeleted($pdo, $eventData, $logger);
                break;
                
            default:
                $logger->info('Unhandled Stripe event type', ['type' => $eventType]);
        }
        
        echo json_encode(['received' => true]);
        
    } catch (Exception $e) {
        $logger->error('Stripe webhook processing error', ['error' => $e->getMessage(), 'type' => $eventType]);
        http_response_code(500);
        echo json_encode(['error' => 'Webhook processing failed']);
    }
}

function handlePaypalWebhook($pdo, $config, $logger) {
    $payload = file_get_contents('php://input');
    $headers = getallheaders();
    
    // Get PayPal config
    $paypalConfig = getPaymentConfig($pdo, 'paypal');
    $webhookId = $paypalConfig['webhook_id'] ?? $config['paypal']['webhook_id'] ?? '';
    
    // Verify PayPal webhook (simplified - production should use PayPal SDK)
    $event = json_decode($payload, true);
    
    if (!$event) {
        $logger->error('Invalid PayPal webhook payload');
        http_response_code(400);
        echo json_encode(['error' => 'Invalid payload']);
        return;
    }
    
    $eventType = $event['event_type'] ?? '';
    $resource = $event['resource'] ?? [];
    
    $logger->info('PayPal webhook received', ['type' => $eventType, 'id' => $event['id'] ?? 'unknown']);
    
    try {
        switch ($eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                handlePaypalPaymentCompleted($pdo, $resource, $logger, $config);
                break;
                
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                handlePaypalSubscriptionActivated($pdo, $resource, $logger, $config);
                break;
                
            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
                handlePaypalSubscriptionCancelled($pdo, $resource, $logger);
                break;
                
            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                handlePaypalPaymentFailed($pdo, $resource, $logger, $config);
                break;
                
            default:
                $logger->info('Unhandled PayPal event type', ['type' => $eventType]);
        }
        
        echo json_encode(['received' => true]);
        
    } catch (Exception $e) {
        $logger->error('PayPal webhook processing error', ['error' => $e->getMessage(), 'type' => $eventType]);
        http_response_code(500);
        echo json_encode(['error' => 'Webhook processing failed']);
    }
}

// =========== STRIPE HANDLERS ===========

function handleCheckoutCompleted($pdo, $session, $logger, $config = null) {
    $customerId = $session['customer'] ?? '';
    $subscriptionId = $session['subscription'] ?? '';
    $clientReferenceId = $session['client_reference_id'] ?? ''; // This should be user_id
    $metadata = $session['metadata'] ?? [];
    
    $userId = $clientReferenceId ?: ($metadata['user_id'] ?? '');
    $tierId = $metadata['tier_id'] ?? '';
    
    if (empty($userId) || empty($tierId)) {
        $logger->warning('Checkout completed but missing user_id or tier_id', ['session_id' => $session['id'] ?? '']);
        return;
    }
    
    // Get tier details for email
    $stmt = $pdo->prepare('SELECT name FROM subscription_tiers WHERE id = ?');
    $stmt->execute([$tierId]);
    $tier = $stmt->fetch(PDO::FETCH_ASSOC);
    $tierName = $tier['name'] ?? 'Premium';
    
    // Get subscription details from Stripe
    $periodEnd = date('Y-m-d H:i:s', time() + (30 * 24 * 60 * 60)); // Default 30 days
    
    // Check for existing subscription
    $stmt = $pdo->prepare('SELECT id FROM user_subscriptions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        // Update existing
        $stmt = $pdo->prepare('
            UPDATE user_subscriptions SET
                tier_id = ?,
                stripe_customer_id = ?,
                stripe_subscription_id = ?,
                status = ?,
                current_period_start = NOW(),
                current_period_end = ?,
                updated_at = NOW()
            WHERE user_id = ?
        ');
        $stmt->execute([$tierId, $customerId, $subscriptionId, 'active', $periodEnd, $userId]);
    } else {
        // Create new
        $stmt = $pdo->prepare('
            INSERT INTO user_subscriptions 
            (id, user_id, tier_id, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())
        ');
        $stmt->execute([generateUUID(), $userId, $tierId, $customerId, $subscriptionId, 'active', $periodEnd]);
    }
    
    // Log invoice
    $amount = ($session['amount_total'] ?? 0) / 100;
    $currency = $session['currency'] ?? 'usd';
    
    $stmt = $pdo->prepare('
        INSERT INTO user_invoices (id, user_id, stripe_payment_intent_id, amount_paid, currency, status, paid_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
    ');
    $stmt->execute([
        generateUUID(),
        $userId,
        $session['payment_intent'] ?? '',
        $amount,
        $currency,
        'paid'
    ]);
    
    $logger->info('Subscription created from checkout', [
        'user_id' => $userId,
        'tier_id' => $tierId,
        'subscription_id' => $subscriptionId
    ]);
    
    // Send payment confirmation email
    if ($config) {
        sendPaymentConfirmationEmail($pdo, $config, $userId, $tierName, $amount, $currency, 'stripe', $periodEnd, $logger);
    }
}

function handleInvoicePaid($pdo, $invoice, $logger, $config = null) {
    $subscriptionId = $invoice['subscription'] ?? '';
    $customerId = $invoice['customer'] ?? '';
    $amount = ($invoice['amount_paid'] ?? 0) / 100;
    $currency = $invoice['currency'] ?? 'usd';
    
    // Find user by subscription ID
    $stmt = $pdo->prepare('SELECT us.user_id, us.tier_id, st.name as tier_name FROM user_subscriptions us LEFT JOIN subscription_tiers st ON us.tier_id = st.id WHERE us.stripe_subscription_id = ?');
    $stmt->execute([$subscriptionId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$subscription) {
        $logger->warning('Invoice paid but subscription not found', ['subscription_id' => $subscriptionId]);
        return;
    }
    
    $userId = $subscription['user_id'];
    $tierName = $subscription['tier_name'] ?? 'Premium';
    
    // Extend subscription period
    $periodEnd = isset($invoice['lines']['data'][0]['period']['end']) 
        ? date('Y-m-d H:i:s', $invoice['lines']['data'][0]['period']['end'])
        : date('Y-m-d H:i:s', time() + (30 * 24 * 60 * 60));
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET
            status = ?,
            current_period_end = ?,
            updated_at = NOW()
        WHERE user_id = ?
    ');
    $stmt->execute(['active', $periodEnd, $userId]);
    
    // Log invoice
    $stmt = $pdo->prepare('
        INSERT INTO user_invoices (id, user_id, stripe_invoice_id, amount_paid, currency, status, 
                                   invoice_pdf, invoice_url, paid_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ');
    $stmt->execute([
        generateUUID(),
        $userId,
        $invoice['id'] ?? '',
        $amount,
        $currency,
        'paid',
        $invoice['invoice_pdf'] ?? null,
        $invoice['hosted_invoice_url'] ?? null
    ]);
    
    $logger->info('Invoice paid', ['user_id' => $userId, 'amount' => $amount]);
    
    // Send payment confirmation email for renewal
    if ($config) {
        sendPaymentConfirmationEmail($pdo, $config, $userId, $tierName, $amount, $currency, 'stripe', $periodEnd, $logger);
    }
}

function handlePaymentFailed($pdo, $invoice, $logger, $config = null) {
    $subscriptionId = $invoice['subscription'] ?? '';
    
    $stmt = $pdo->prepare('SELECT us.user_id, us.tier_id, st.name as tier_name FROM user_subscriptions us LEFT JOIN subscription_tiers st ON us.tier_id = st.id WHERE us.stripe_subscription_id = ?');
    $stmt->execute([$subscriptionId]);
    $subscription = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($subscription) {
        $stmt = $pdo->prepare('
            UPDATE user_subscriptions SET status = ?, updated_at = NOW()
            WHERE user_id = ?
        ');
        $stmt->execute(['past_due', $subscription['user_id']]);
        
        $logger->warning('Payment failed for subscription', [
            'user_id' => $subscription['user_id'],
            'subscription_id' => $subscriptionId
        ]);
        
        // Send payment failure notification email
        if ($config) {
            $amount = ($invoice['amount_due'] ?? 0) / 100;
            $currency = $invoice['currency'] ?? 'usd';
            sendPaymentFailureEmail($pdo, $config, $subscription['user_id'], $subscription['tier_name'] ?? 'Premium', $amount, $currency, 'stripe', $logger);
        }
    }
}

function handleSubscriptionUpdated($pdo, $subscription, $logger) {
    $subscriptionId = $subscription['id'] ?? '';
    $status = $subscription['status'] ?? 'active';
    $cancelAtPeriodEnd = $subscription['cancel_at_period_end'] ?? false;
    
    $periodEnd = isset($subscription['current_period_end'])
        ? date('Y-m-d H:i:s', $subscription['current_period_end'])
        : null;
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET
            status = ?,
            cancel_at_period_end = ?,
            current_period_end = COALESCE(?, current_period_end),
            updated_at = NOW()
        WHERE stripe_subscription_id = ?
    ');
    $stmt->execute([$status, $cancelAtPeriodEnd ? 1 : 0, $periodEnd, $subscriptionId]);
    
    $logger->info('Subscription updated', ['subscription_id' => $subscriptionId, 'status' => $status]);
}

function handleSubscriptionDeleted($pdo, $subscription, $logger) {
    $subscriptionId = $subscription['id'] ?? '';
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET status = ?, updated_at = NOW()
        WHERE stripe_subscription_id = ?
    ');
    $stmt->execute(['canceled', $subscriptionId]);
    
    $logger->info('Subscription canceled', ['subscription_id' => $subscriptionId]);
}

// =========== PAYPAL HANDLERS ===========

function handlePaypalPaymentCompleted($pdo, $resource, $logger, $config = null) {
    $orderId = $resource['supplementary_data']['related_ids']['order_id'] ?? '';
    $amount = $resource['amount']['value'] ?? 0;
    $currency = $resource['amount']['currency_code'] ?? 'USD';
    
    // Try to get user info from custom_id if available
    $customId = $resource['custom_id'] ?? '';
    $parts = explode(':', $customId);
    $userId = $parts[0] ?? '';
    $tierId = $parts[1] ?? '';
    
    if (!empty($userId) && !empty($tierId)) {
        // Get tier name
        $stmt = $pdo->prepare('SELECT name FROM subscription_tiers WHERE id = ?');
        $stmt->execute([$tierId]);
        $tier = $stmt->fetch(PDO::FETCH_ASSOC);
        $tierName = $tier['name'] ?? 'Premium';
        
        // Calculate next billing date (30 days from now)
        $nextBillingDate = date('Y-m-d H:i:s', time() + (30 * 24 * 60 * 60));
        
        // Send payment confirmation email
        if ($config) {
            sendPaymentConfirmationEmail($pdo, $config, $userId, $tierName, floatval($amount), strtolower($currency), 'paypal', $nextBillingDate, $logger);
        }
    }
    
    $logger->info('PayPal payment completed', ['order_id' => $orderId, 'amount' => $amount]);
}

function handlePaypalSubscriptionActivated($pdo, $resource, $logger, $config = null) {
    $subscriptionId = $resource['id'] ?? '';
    $customId = $resource['custom_id'] ?? ''; // user_id:tier_id
    
    $parts = explode(':', $customId);
    $userId = $parts[0] ?? '';
    $tierId = $parts[1] ?? '';
    
    if (empty($userId) || empty($tierId)) {
        $logger->warning('PayPal subscription activated but missing user/tier', ['subscription_id' => $subscriptionId]);
        return;
    }
    
    // Get tier details for email
    $stmt = $pdo->prepare('SELECT name, price_monthly FROM subscription_tiers WHERE id = ?');
    $stmt->execute([$tierId]);
    $tier = $stmt->fetch(PDO::FETCH_ASSOC);
    $tierName = $tier['name'] ?? 'Premium';
    $tierPrice = $tier['price_monthly'] ?? 0;
    
    $nextBillingTime = $resource['billing_info']['next_billing_time'] ?? '';
    $periodEnd = $nextBillingTime ? date('Y-m-d H:i:s', strtotime($nextBillingTime)) : date('Y-m-d H:i:s', time() + (30 * 24 * 60 * 60));
    
    // Check for existing subscription
    $stmt = $pdo->prepare('SELECT id FROM user_subscriptions WHERE user_id = ?');
    $stmt->execute([$userId]);
    $existing = $stmt->fetch();
    
    if ($existing) {
        $stmt = $pdo->prepare('
            UPDATE user_subscriptions SET
                tier_id = ?,
                stripe_subscription_id = ?,
                status = ?,
                current_period_start = NOW(),
                current_period_end = ?,
                updated_at = NOW()
            WHERE user_id = ?
        ');
        $stmt->execute([$tierId, 'paypal_' . $subscriptionId, 'active', $periodEnd, $userId]);
    } else {
        $stmt = $pdo->prepare('
            INSERT INTO user_subscriptions 
            (id, user_id, tier_id, stripe_subscription_id, status, current_period_start, current_period_end, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NOW(), ?, NOW(), NOW())
        ');
        $stmt->execute([generateUUID(), $userId, $tierId, 'paypal_' . $subscriptionId, 'active', $periodEnd]);
    }
    
    $logger->info('PayPal subscription activated', ['user_id' => $userId, 'tier_id' => $tierId]);
    
    // Send payment confirmation email
    if ($config) {
        // Get amount from billing info if available
        $amount = $resource['billing_info']['last_payment']['amount']['value'] ?? $tierPrice;
        $currency = $resource['billing_info']['last_payment']['amount']['currency_code'] ?? 'USD';
        
        sendPaymentConfirmationEmail($pdo, $config, $userId, $tierName, floatval($amount), strtolower($currency), 'paypal', $periodEnd, $logger);
    }
}

function handlePaypalSubscriptionCancelled($pdo, $resource, $logger) {
    $subscriptionId = $resource['id'] ?? '';
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET status = ?, updated_at = NOW()
        WHERE stripe_subscription_id = ?
    ');
    $stmt->execute(['canceled', 'paypal_' . $subscriptionId]);
    
    $logger->info('PayPal subscription cancelled', ['subscription_id' => $subscriptionId]);
}

function handlePaypalPaymentFailed($pdo, $resource, $logger, $config = null) {
    $subscriptionId = $resource['id'] ?? '';
    $customId = $resource['custom_id'] ?? '';
    
    $parts = explode(':', $customId);
    $userId = $parts[0] ?? '';
    $tierId = $parts[1] ?? '';
    
    $stmt = $pdo->prepare('
        UPDATE user_subscriptions SET status = ?, updated_at = NOW()
        WHERE stripe_subscription_id = ?
    ');
    $stmt->execute(['past_due', 'paypal_' . $subscriptionId]);
    
    $logger->warning('PayPal payment failed', ['subscription_id' => $subscriptionId]);
    
    // Send payment failure notification email
    if ($config && !empty($userId)) {
        $stmt = $pdo->prepare('SELECT name, price_monthly FROM subscription_tiers WHERE id = ?');
        $stmt->execute([$tierId]);
        $tier = $stmt->fetch(PDO::FETCH_ASSOC);
        
        sendPaymentFailureEmail($pdo, $config, $userId, $tier['name'] ?? 'Premium', $tier['price_monthly'] ?? 0, 'usd', 'paypal', $logger);
    }
}

// =========== EMAIL SENDING ===========

/**
 * Send payment confirmation email to user
 */
function sendPaymentConfirmationEmail($pdo, $config, $userId, $tierName, $amount, $currency, $paymentMethod, $nextBillingDate, $logger) {
    try {
        // Get user profile
        $stmt = $pdo->prepare('SELECT email, display_name FROM profiles WHERE user_id = ?');
        $stmt->execute([$userId]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$profile || empty($profile['email'])) {
            $logger->warning('Cannot send payment confirmation - no email', ['user_id' => $userId]);
            return false;
        }
        
        $email = $profile['email'];
        $name = $profile['display_name'] ?: 'Valued Customer';
        
        // Get site name from settings
        $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE `key` = ?');
        $stmt->execute(['general_settings']);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $generalSettings = $row ? json_decode($row['value'], true) : [];
        $siteName = $generalSettings['siteName'] ?? 'TempMail';
        
        // Get SMTP configuration from active mailbox
        $stmt = $pdo->query('SELECT * FROM mailboxes WHERE is_active = 1 ORDER BY priority ASC LIMIT 1');
        $mailbox = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$mailbox) {
            // Fallback to config.php
            $smtpHost = $config['smtp']['host'] ?? '';
            $smtpPort = $config['smtp']['port'] ?? 587;
            $smtpUser = $config['smtp']['user'] ?? '';
            $smtpPass = $config['smtp']['pass'] ?? '';
            $smtpFrom = $config['smtp']['from'] ?? $smtpUser;
        } else {
            $smtpHost = $mailbox['smtp_host'];
            $smtpPort = $mailbox['smtp_port'];
            $smtpUser = $mailbox['smtp_user'];
            $smtpPass = $mailbox['smtp_password'];
            $smtpFrom = $mailbox['smtp_from'] ?: $mailbox['smtp_user'];
        }
        
        if (empty($smtpHost) || empty($smtpUser)) {
            $logger->warning('Cannot send payment confirmation - SMTP not configured');
            return false;
        }
        
        // Format currency
        $currencySymbol = strtoupper($currency) === 'USD' ? '$' : (strtoupper($currency) === 'EUR' ? '€' : $currency . ' ');
        $formattedAmount = $currencySymbol . number_format($amount, 2);
        
        // Format next billing date
        $formattedNextBilling = $nextBillingDate ? date('F j, Y', strtotime($nextBillingDate)) : 'N/A';
        
        // Payment method display
        $paymentMethodDisplay = ucfirst($paymentMethod);
        
        // Build HTML email
        $subject = "Payment Confirmation - $siteName";
        
        $htmlBody = buildPaymentConfirmationHtml(
            $name,
            $tierName,
            $formattedAmount,
            $paymentMethodDisplay,
            $formattedNextBilling,
            $siteName,
            date('F j, Y, g:i A')
        );
        
        $plainBody = "Payment Confirmation\n\n";
        $plainBody .= "Dear $name,\n\n";
        $plainBody .= "Thank you for your payment! Your subscription has been successfully processed.\n\n";
        $plainBody .= "Subscription Details:\n";
        $plainBody .= "- Plan: $tierName\n";
        $plainBody .= "- Amount: $formattedAmount\n";
        $plainBody .= "- Payment Method: $paymentMethodDisplay\n";
        $plainBody .= "- Next Billing Date: $formattedNextBilling\n\n";
        $plainBody .= "If you have any questions, please contact our support team.\n\n";
        $plainBody .= "Best regards,\nThe $siteName Team";
        
        // Send email using existing function
        require_once __DIR__ . '/functions.php';
        $result = sendSmtpEmail($smtpHost, $smtpPort, $smtpUser, $smtpPass, $smtpFrom, $email, $subject, $plainBody, $htmlBody);
        
        // Log the attempt
        $stmt = $pdo->prepare("
            INSERT INTO email_logs (id, recipient_email, subject, status, smtp_host, mailbox_id, mailbox_name, 
                                   error_message, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            generateUUID(),
            $email,
            $subject,
            $result['success'] ? 'sent' : 'failed',
            $smtpHost,
            $mailbox['id'] ?? null,
            $mailbox['name'] ?? 'Config File',
            $result['error'] ?? null,
            $result['success'] ? date('Y-m-d H:i:s') : null
        ]);
        
        if ($result['success']) {
            $logger->info('Payment confirmation email sent', ['user_id' => $userId, 'email' => $email]);
        } else {
            $logger->warning('Payment confirmation email failed', ['user_id' => $userId, 'error' => $result['error'] ?? 'Unknown']);
        }
        
        return $result['success'];
        
    } catch (Exception $e) {
        $logger->error('Payment confirmation email error', ['user_id' => $userId, 'error' => $e->getMessage()]);
        return false;
    }
}

/**
 * Send payment failure notification email to user
 */
function sendPaymentFailureEmail($pdo, $config, $userId, $tierName, $amount, $currency, $paymentMethod, $logger) {
    try {
        // Get user profile
        $stmt = $pdo->prepare('SELECT email, display_name FROM profiles WHERE user_id = ?');
        $stmt->execute([$userId]);
        $profile = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$profile || empty($profile['email'])) {
            $logger->warning('Cannot send payment failure email - no email', ['user_id' => $userId]);
            return false;
        }
        
        $email = $profile['email'];
        $name = $profile['display_name'] ?: 'Valued Customer';
        
        // Get site name and URL from settings
        $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE `key` = ?');
        $stmt->execute(['general_settings']);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        $generalSettings = $row ? json_decode($row['value'], true) : [];
        $siteName = $generalSettings['siteName'] ?? 'TempMail';
        $siteUrl = $generalSettings['siteUrl'] ?? ($_SERVER['HTTP_ORIGIN'] ?? 'https://yourdomain.com');
        
        // Get SMTP configuration from active mailbox
        $stmt = $pdo->query('SELECT * FROM mailboxes WHERE is_active = 1 ORDER BY priority ASC LIMIT 1');
        $mailbox = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$mailbox) {
            $smtpHost = $config['smtp']['host'] ?? '';
            $smtpPort = $config['smtp']['port'] ?? 587;
            $smtpUser = $config['smtp']['user'] ?? '';
            $smtpPass = $config['smtp']['pass'] ?? '';
            $smtpFrom = $config['smtp']['from'] ?? $smtpUser;
        } else {
            $smtpHost = $mailbox['smtp_host'];
            $smtpPort = $mailbox['smtp_port'];
            $smtpUser = $mailbox['smtp_user'];
            $smtpPass = $mailbox['smtp_password'];
            $smtpFrom = $mailbox['smtp_from'] ?: $mailbox['smtp_user'];
        }
        
        if (empty($smtpHost) || empty($smtpUser)) {
            $logger->warning('Cannot send payment failure email - SMTP not configured');
            return false;
        }
        
        // Format currency
        $currencySymbol = strtoupper($currency) === 'USD' ? '$' : (strtoupper($currency) === 'EUR' ? '€' : $currency . ' ');
        $formattedAmount = $currencySymbol . number_format($amount, 2);
        
        // Build update payment URL
        $updatePaymentUrl = $siteUrl . '/billing';
        
        // Build HTML email
        $subject = "Action Required: Payment Failed - $siteName";
        
        $htmlBody = buildPaymentFailureHtml(
            $name,
            $tierName,
            $formattedAmount,
            ucfirst($paymentMethod),
            $updatePaymentUrl,
            $siteName
        );
        
        $plainBody = "Payment Failed\n\n";
        $plainBody .= "Dear $name,\n\n";
        $plainBody .= "We were unable to process your subscription payment.\n\n";
        $plainBody .= "Subscription Details:\n";
        $plainBody .= "- Plan: $tierName\n";
        $plainBody .= "- Amount: $formattedAmount\n";
        $plainBody .= "- Payment Method: " . ucfirst($paymentMethod) . "\n\n";
        $plainBody .= "Please update your payment method to avoid service interruption:\n";
        $plainBody .= "$updatePaymentUrl\n\n";
        $plainBody .= "If you have any questions, please contact our support team.\n\n";
        $plainBody .= "Best regards,\nThe $siteName Team";
        
        // Send email using existing function
        require_once __DIR__ . '/functions.php';
        $result = sendSmtpEmail($smtpHost, $smtpPort, $smtpUser, $smtpPass, $smtpFrom, $email, $subject, $plainBody, $htmlBody);
        
        // Log the attempt
        $stmt = $pdo->prepare("
            INSERT INTO email_logs (id, recipient_email, subject, status, smtp_host, mailbox_id, mailbox_name, 
                                   error_message, sent_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            generateUUID(),
            $email,
            $subject,
            $result['success'] ? 'sent' : 'failed',
            $smtpHost,
            $mailbox['id'] ?? null,
            $mailbox['name'] ?? 'Config File',
            $result['error'] ?? null,
            $result['success'] ? date('Y-m-d H:i:s') : null
        ]);
        
        if ($result['success']) {
            $logger->info('Payment failure email sent', ['user_id' => $userId, 'email' => $email]);
        } else {
            $logger->warning('Payment failure email failed', ['user_id' => $userId, 'error' => $result['error'] ?? 'Unknown']);
        }
        
        return $result['success'];
        
    } catch (Exception $e) {
        $logger->error('Payment failure email error', ['user_id' => $userId, 'error' => $e->getMessage()]);
        return false;
    }
}

/**
 * Build HTML payment failure email
 */
function buildPaymentFailureHtml($name, $tierName, $amount, $paymentMethod, $updatePaymentUrl, $siteName) {
    return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Failed</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                            <div style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); width: 60px; height: 60px; border-radius: 50%; line-height: 60px; margin-bottom: 16px;">
                                <span style="font-size: 28px; color: #ffffff;">!</span>
                            </div>
                            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #ef4444;">Payment Failed</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px 40px;">
                            <p style="margin: 0 0 20px; font-size: 16px; color: #374151; line-height: 1.6;">
                                Dear <strong>$name</strong>,
                            </p>
                            <p style="margin: 0 0 30px; font-size: 16px; color: #374151; line-height: 1.6;">
                                We were unable to process your subscription payment. Please update your payment method to avoid service interruption.
                            </p>
                            
                            <!-- Details Box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fef2f2; border-radius: 8px; margin-bottom: 30px; border: 1px solid #fecaca;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px;">
                                            Payment Details
                                        </h3>
                                        
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #991b1b; font-size: 14px;">Plan</span>
                                                </td>
                                                <td style="padding: 8px 0; text-align: right;">
                                                    <span style="color: #7f1d1d; font-size: 14px; font-weight: 600;">$tierName</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #991b1b; font-size: 14px;">Amount Due</span>
                                                </td>
                                                <td style="padding: 8px 0; text-align: right;">
                                                    <span style="color: #7f1d1d; font-size: 14px; font-weight: 600;">$amount</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #991b1b; font-size: 14px;">Payment Method</span>
                                                </td>
                                                <td style="padding: 8px 0; text-align: right;">
                                                    <span style="color: #7f1d1d; font-size: 14px; font-weight: 600;">$paymentMethod</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- CTA Button -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                <tr>
                                    <td align="center" style="padding: 10px 0 30px;">
                                        <a href="$updatePaymentUrl" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                                            Update Payment Method
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                                If you believe this is an error or need assistance, please contact our support team.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
                            <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                                Best regards,<br>
                                <strong style="color: #374151;">The $siteName Team</strong>
                            </p>
                            <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
                                This is an automated email. Please do not reply directly to this message.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;
}

/**
 * Build HTML payment confirmation email
 */
function buildPaymentConfirmationHtml($name, $tierName, $amount, $paymentMethod, $nextBillingDate, $siteName, $transactionDate) {
    return <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Payment Confirmation</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 20px; text-align: center; border-bottom: 1px solid #e5e7eb;">
                            <div style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 60px; height: 60px; border-radius: 50%; line-height: 60px; margin-bottom: 16px;">
                                <span style="font-size: 28px;">✓</span>
                            </div>
                            <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #10b981;">Payment Successful!</h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 30px 40px;">
                            <p style="margin: 0 0 20px; font-size: 16px; color: #374151; line-height: 1.6;">
                                Dear <strong>$name</strong>,
                            </p>
                            <p style="margin: 0 0 30px; font-size: 16px; color: #374151; line-height: 1.6;">
                                Thank you for your payment! Your subscription has been successfully processed.
                            </p>
                            
                            <!-- Receipt Box -->
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 30px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <h3 style="margin: 0 0 16px; font-size: 14px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">
                                            Receipt Details
                                        </h3>
                                        
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                                    <span style="color: #6b7280; font-size: 14px;">Plan</span>
                                                </td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                                    <span style="color: #111827; font-size: 14px; font-weight: 600;">$tierName</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                                    <span style="color: #6b7280; font-size: 14px;">Amount</span>
                                                </td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                                    <span style="color: #111827; font-size: 14px; font-weight: 600;">$amount</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                                    <span style="color: #6b7280; font-size: 14px;">Payment Method</span>
                                                </td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                                    <span style="color: #111827; font-size: 14px; font-weight: 600;">$paymentMethod</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                                                    <span style="color: #6b7280; font-size: 14px;">Transaction Date</span>
                                                </td>
                                                <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                                                    <span style="color: #111827; font-size: 14px; font-weight: 600;">$transactionDate</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <span style="color: #6b7280; font-size: 14px;">Next Billing Date</span>
                                                </td>
                                                <td style="padding: 8px 0; text-align: right;">
                                                    <span style="color: #111827; font-size: 14px; font-weight: 600;">$nextBillingDate</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <p style="margin: 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                                If you have any questions about your subscription, please don't hesitate to contact our support team.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 30px 40px; border-top: 1px solid #e5e7eb; text-align: center;">
                            <p style="margin: 0 0 8px; font-size: 14px; color: #6b7280;">
                                Best regards,<br>
                                <strong style="color: #374151;">The $siteName Team</strong>
                            </p>
                            <p style="margin: 16px 0 0; font-size: 12px; color: #9ca3af;">
                                This is an automated email. Please do not reply directly to this message.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;
}

// =========== HELPERS ===========

function getPaymentConfig($pdo, $provider) {
    $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE `key` = ?');
    $stmt->execute(['payment_settings']);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if ($row && $row['value']) {
        $settings = json_decode($row['value'], true);
        
        if ($provider === 'stripe') {
            return [
                'secret_key' => $settings['stripeSecretKey'] ?? '',
                'webhook_secret' => $settings['stripeWebhookSecret'] ?? '',
                'publishable_key' => $settings['stripePublishableKey'] ?? '',
            ];
        } elseif ($provider === 'paypal') {
            return [
                'client_id' => $settings['paypalClientId'] ?? '',
                'client_secret' => $settings['paypalClientSecret'] ?? '',
                'webhook_id' => $settings['paypalWebhookId'] ?? '',
                'mode' => $settings['paypalMode'] ?? 'sandbox',
            ];
        }
    }
    
    return [];
}

function verifyStripeSignature($payload, $sigHeader, $secret) {
    // Parse the signature header
    $parts = explode(',', $sigHeader);
    $timestamp = null;
    $signatures = [];
    
    foreach ($parts as $part) {
        $kv = explode('=', trim($part), 2);
        if (count($kv) === 2) {
            if ($kv[0] === 't') {
                $timestamp = $kv[1];
            } elseif ($kv[0] === 'v1') {
                $signatures[] = $kv[1];
            }
        }
    }
    
    if (!$timestamp || empty($signatures)) {
        throw new Exception('Invalid signature header');
    }
    
    // Check timestamp (allow 5 minutes tolerance)
    if (abs(time() - intval($timestamp)) > 300) {
        throw new Exception('Timestamp outside tolerance zone');
    }
    
    // Compute expected signature
    $signedPayload = $timestamp . '.' . $payload;
    $expectedSignature = hash_hmac('sha256', $signedPayload, $secret);
    
    // Check if any signature matches
    foreach ($signatures as $sig) {
        if (hash_equals($expectedSignature, $sig)) {
            return json_decode($payload, true);
        }
    }
    
    throw new Exception('Signature verification failed');
}
