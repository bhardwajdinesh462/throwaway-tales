<?php
/**
 * Domain Management Dashboard
 * Add/remove email domains and verify DNS records
 */

session_start();

// Check admin authentication
if (!isset($_SESSION['admin_authenticated']) || $_SESSION['admin_authenticated'] !== true) {
    header('Location: install.php');
    exit;
}

require_once __DIR__ . '/api/core/database.php';
require_once __DIR__ . '/api/core/response.php';

$message = '';
$messageType = '';

// Handle form submissions
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    try {
        switch ($action) {
            case 'add_domain':
                $domain = strtolower(trim($_POST['domain'] ?? ''));
                $displayName = trim($_POST['display_name'] ?? '');
                $isPremium = isset($_POST['is_premium']) ? 1 : 0;
                
                // Validate domain format
                if (!preg_match('/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/', $domain)) {
                    throw new Exception('Invalid domain format.');
                }
                
                // Check if domain already exists
                $existing = Database::fetchOne("SELECT id FROM domains WHERE domain = ?", [$domain]);
                if ($existing) {
                    throw new Exception('Domain already exists.');
                }
                
                Database::execute(
                    "INSERT INTO domains (domain, display_name, is_premium, is_active, created_at) 
                     VALUES (?, ?, ?, 1, NOW())",
                    [$domain, $displayName ?: $domain, $isPremium]
                );
                
                $message = "Domain '$domain' added successfully.";
                $messageType = 'success';
                break;
                
            case 'toggle_domain':
                $domainId = (int)($_POST['domain_id'] ?? 0);
                $currentStatus = (int)($_POST['current_status'] ?? 1);
                $newStatus = $currentStatus ? 0 : 1;
                
                Database::execute(
                    "UPDATE domains SET is_active = ?, updated_at = NOW() WHERE id = ?",
                    [$newStatus, $domainId]
                );
                
                $message = $newStatus ? "Domain activated." : "Domain deactivated.";
                $messageType = 'success';
                break;
                
            case 'toggle_premium':
                $domainId = (int)($_POST['domain_id'] ?? 0);
                $currentPremium = (int)($_POST['current_premium'] ?? 0);
                $newPremium = $currentPremium ? 0 : 1;
                
                Database::execute(
                    "UPDATE domains SET is_premium = ?, updated_at = NOW() WHERE id = ?",
                    [$newPremium, $domainId]
                );
                
                $message = $newPremium ? "Domain marked as premium." : "Domain marked as free.";
                $messageType = 'success';
                break;
                
            case 'delete_domain':
                $domainId = (int)($_POST['domain_id'] ?? 0);
                
                // Check if domain has emails
                $emailCount = Database::fetchOne(
                    "SELECT COUNT(*) as c FROM emails WHERE to_email LIKE CONCAT('%@', (SELECT domain FROM domains WHERE id = ?))",
                    [$domainId]
                )['c'] ?? 0;
                
                if ($emailCount > 0 && !isset($_POST['force_delete'])) {
                    throw new Exception("Domain has $emailCount emails. Check 'Force delete' to remove anyway.");
                }
                
                Database::execute("DELETE FROM domains WHERE id = ?", [$domainId]);
                
                $message = "Domain deleted successfully.";
                $messageType = 'success';
                break;
                
            case 'update_domain':
                $domainId = (int)($_POST['domain_id'] ?? 0);
                $displayName = trim($_POST['display_name'] ?? '');
                
                Database::execute(
                    "UPDATE domains SET display_name = ?, updated_at = NOW() WHERE id = ?",
                    [$displayName, $domainId]
                );
                
                $message = "Domain updated successfully.";
                $messageType = 'success';
                break;
        }
    } catch (Exception $e) {
        $message = "Error: " . $e->getMessage();
        $messageType = 'error';
    }
}

// Fetch domains
$domains = Database::fetchAll(
    "SELECT d.*, 
            (SELECT COUNT(*) FROM emails WHERE to_email LIKE CONCAT('%@', d.domain)) as email_count
     FROM domains d
     ORDER BY d.is_premium DESC, d.domain ASC"
);

// DNS verification function
function verifyDNS($domain) {
    $results = [
        'mx' => ['status' => 'error', 'records' => []],
        'spf' => ['status' => 'error', 'record' => null],
        'dkim' => ['status' => 'warning', 'record' => null],
        'dmarc' => ['status' => 'warning', 'record' => null],
    ];
    
    // Check MX records
    $mxRecords = @dns_get_record($domain, DNS_MX);
    if ($mxRecords && count($mxRecords) > 0) {
        $results['mx']['status'] = 'success';
        $results['mx']['records'] = array_map(fn($r) => $r['target'] . ' (Priority: ' . $r['pri'] . ')', $mxRecords);
    }
    
    // Check SPF record
    $txtRecords = @dns_get_record($domain, DNS_TXT);
    if ($txtRecords) {
        foreach ($txtRecords as $record) {
            if (isset($record['txt']) && strpos($record['txt'], 'v=spf1') !== false) {
                $results['spf']['status'] = 'success';
                $results['spf']['record'] = $record['txt'];
                break;
            }
        }
    }
    
    // Check DKIM (common selector)
    $dkimRecords = @dns_get_record('default._domainkey.' . $domain, DNS_TXT);
    if ($dkimRecords && count($dkimRecords) > 0) {
        $results['dkim']['status'] = 'success';
        $results['dkim']['record'] = $dkimRecords[0]['txt'] ?? 'Found';
    }
    
    // Check DMARC
    $dmarcRecords = @dns_get_record('_dmarc.' . $domain, DNS_TXT);
    if ($dmarcRecords && count($dmarcRecords) > 0) {
        $results['dmarc']['status'] = 'success';
        $results['dmarc']['record'] = $dmarcRecords[0]['txt'] ?? 'Found';
    }
    
    return $results;
}

// Handle DNS check via AJAX-like approach
$dnsResults = [];
if (isset($_GET['check_dns'])) {
    $checkDomain = $_GET['check_dns'];
    $dnsResults[$checkDomain] = verifyDNS($checkDomain);
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Domain Management - Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        .modal { display: none; }
        .modal.active { display: flex; }
        .dns-check { animation: pulse 1s infinite; }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen">
    <!-- Navigation -->
    <nav class="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <i class="fas fa-globe text-2xl text-green-400"></i>
                <h1 class="text-xl font-bold">Domain Management</h1>
            </div>
            <div class="flex items-center space-x-4">
                <a href="health-dashboard.php" class="text-gray-400 hover:text-white">
                    <i class="fas fa-heartbeat mr-2"></i>Health
                </a>
                <a href="analytics.php" class="text-gray-400 hover:text-white">
                    <i class="fas fa-chart-bar mr-2"></i>Analytics
                </a>
                <a href="admin-users.php" class="text-gray-400 hover:text-white">
                    <i class="fas fa-users mr-2"></i>Users
                </a>
                <a href="settings.php" class="text-gray-400 hover:text-white">
                    <i class="fas fa-cog mr-2"></i>Settings
                </a>
            </div>
        </div>
    </nav>

    <div class="container mx-auto px-6 py-8">
        <?php if ($message): ?>
        <div class="mb-6 p-4 rounded-lg <?= $messageType === 'success' ? 'bg-green-900/50 border border-green-500 text-green-300' : 'bg-red-900/50 border border-red-500 text-red-300' ?>">
            <i class="fas <?= $messageType === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle' ?> mr-2"></i>
            <?= htmlspecialchars($message) ?>
        </div>
        <?php endif; ?>

        <!-- Add Domain Section -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h2 class="text-lg font-bold mb-4">
                <i class="fas fa-plus-circle text-green-400 mr-2"></i>Add New Domain
            </h2>
            <form method="POST" class="flex flex-wrap gap-4 items-end">
                <input type="hidden" name="action" value="add_domain">
                <div class="flex-1 min-w-[200px]">
                    <label class="block text-sm text-gray-400 mb-1">Domain Name</label>
                    <input type="text" name="domain" required placeholder="example.com"
                           pattern="^[a-zA-Z0-9]+([\-\.]{1}[a-zA-Z0-9]+)*\.[a-zA-Z]{2,}$"
                           class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-green-500 focus:outline-none">
                </div>
                <div class="flex-1 min-w-[200px]">
                    <label class="block text-sm text-gray-400 mb-1">Display Name (Optional)</label>
                    <input type="text" name="display_name" placeholder="My Domain"
                           class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-green-500 focus:outline-none">
                </div>
                <div class="flex items-center space-x-2">
                    <input type="checkbox" name="is_premium" id="is_premium" class="w-4 h-4 rounded bg-gray-700 border-gray-600">
                    <label for="is_premium" class="text-sm text-gray-400">Premium Only</label>
                </div>
                <button type="submit" class="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg transition">
                    <i class="fas fa-plus mr-2"></i>Add Domain
                </button>
            </form>
        </div>

        <!-- DNS Setup Guide -->
        <div class="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
            <h2 class="text-lg font-bold mb-4">
                <i class="fas fa-info-circle text-blue-400 mr-2"></i>DNS Configuration Guide
            </h2>
            <div class="grid md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <div class="bg-gray-700/50 rounded-lg p-4">
                        <h3 class="font-medium text-blue-300 mb-2">
                            <i class="fas fa-envelope mr-2"></i>MX Record (Required)
                        </h3>
                        <p class="text-sm text-gray-400 mb-2">Points email to your mail server</p>
                        <code class="block bg-gray-900 p-2 rounded text-xs text-green-300">
                            Type: MX | Host: @ | Value: mail.yourdomain.com | Priority: 10
                        </code>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-4">
                        <h3 class="font-medium text-blue-300 mb-2">
                            <i class="fas fa-shield-alt mr-2"></i>SPF Record (Recommended)
                        </h3>
                        <p class="text-sm text-gray-400 mb-2">Prevents email spoofing</p>
                        <code class="block bg-gray-900 p-2 rounded text-xs text-green-300">
                            Type: TXT | Host: @ | Value: v=spf1 mx -all
                        </code>
                    </div>
                </div>
                <div class="space-y-4">
                    <div class="bg-gray-700/50 rounded-lg p-4">
                        <h3 class="font-medium text-blue-300 mb-2">
                            <i class="fas fa-key mr-2"></i>DKIM Record (Recommended)
                        </h3>
                        <p class="text-sm text-gray-400 mb-2">Signs outgoing emails</p>
                        <code class="block bg-gray-900 p-2 rounded text-xs text-green-300">
                            Type: TXT | Host: default._domainkey | Value: [Your DKIM public key]
                        </code>
                    </div>
                    <div class="bg-gray-700/50 rounded-lg p-4">
                        <h3 class="font-medium text-blue-300 mb-2">
                            <i class="fas fa-clipboard-check mr-2"></i>DMARC Record (Recommended)
                        </h3>
                        <p class="text-sm text-gray-400 mb-2">Email authentication policy</p>
                        <code class="block bg-gray-900 p-2 rounded text-xs text-green-300">
                            Type: TXT | Host: _dmarc | Value: v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com
                        </code>
                    </div>
                </div>
            </div>
        </div>

        <!-- Domains Table -->
        <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-700">
                <h2 class="text-lg font-bold">Configured Domains</h2>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-700">
                        <tr>
                            <th class="px-4 py-3 text-left text-sm font-medium">Domain</th>
                            <th class="px-4 py-3 text-left text-sm font-medium">Display Name</th>
                            <th class="px-4 py-3 text-center text-sm font-medium">Status</th>
                            <th class="px-4 py-3 text-center text-sm font-medium">Type</th>
                            <th class="px-4 py-3 text-center text-sm font-medium">Emails</th>
                            <th class="px-4 py-3 text-center text-sm font-medium">DNS</th>
                            <th class="px-4 py-3 text-center text-sm font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                        <?php foreach ($domains as $domain): ?>
                        <tr class="hover:bg-gray-700/50">
                            <td class="px-4 py-3">
                                <div class="flex items-center space-x-2">
                                    <i class="fas fa-globe text-gray-400"></i>
                                    <span class="font-medium"><?= htmlspecialchars($domain['domain']) ?></span>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-gray-400">
                                <?= htmlspecialchars($domain['display_name'] ?? $domain['domain']) ?>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-1 rounded-full text-xs font-medium
                                    <?= $domain['is_active'] ? 'bg-green-900/50 text-green-300 border border-green-500' : 'bg-red-900/50 text-red-300 border border-red-500' ?>">
                                    <?= $domain['is_active'] ? 'Active' : 'Inactive' ?>
                                </span>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <span class="px-2 py-1 rounded-full text-xs font-medium
                                    <?= $domain['is_premium'] ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-500' : 'bg-gray-700 text-gray-300 border border-gray-500' ?>">
                                    <?= $domain['is_premium'] ? 'Premium' : 'Free' ?>
                                </span>
                            </td>
                            <td class="px-4 py-3 text-center text-gray-300">
                                <?= number_format($domain['email_count']) ?>
                            </td>
                            <td class="px-4 py-3 text-center">
                                <a href="?check_dns=<?= urlencode($domain['domain']) ?>#dns-<?= $domain['id'] ?>" 
                                   class="text-blue-400 hover:text-blue-300 transition">
                                    <i class="fas fa-search mr-1"></i>Check
                                </a>
                            </td>
                            <td class="px-4 py-3">
                                <div class="flex items-center justify-center space-x-2">
                                    <button onclick="openEditModal(<?= $domain['id'] ?>, '<?= htmlspecialchars($domain['domain']) ?>', '<?= htmlspecialchars($domain['display_name'] ?? '') ?>')"
                                            class="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition" title="Edit">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <form method="POST" class="inline">
                                        <input type="hidden" name="action" value="toggle_domain">
                                        <input type="hidden" name="domain_id" value="<?= $domain['id'] ?>">
                                        <input type="hidden" name="current_status" value="<?= $domain['is_active'] ?>">
                                        <button type="submit" class="p-2 <?= $domain['is_active'] ? 'text-orange-400 hover:bg-orange-900/30' : 'text-green-400 hover:bg-green-900/30' ?> rounded-lg transition" 
                                                title="<?= $domain['is_active'] ? 'Deactivate' : 'Activate' ?>">
                                            <i class="fas <?= $domain['is_active'] ? 'fa-toggle-off' : 'fa-toggle-on' ?>"></i>
                                        </button>
                                    </form>
                                    <form method="POST" class="inline">
                                        <input type="hidden" name="action" value="toggle_premium">
                                        <input type="hidden" name="domain_id" value="<?= $domain['id'] ?>">
                                        <input type="hidden" name="current_premium" value="<?= $domain['is_premium'] ?>">
                                        <button type="submit" class="p-2 <?= $domain['is_premium'] ? 'text-yellow-400 hover:bg-yellow-900/30' : 'text-gray-400 hover:bg-gray-600' ?> rounded-lg transition" 
                                                title="<?= $domain['is_premium'] ? 'Make Free' : 'Make Premium' ?>">
                                            <i class="fas fa-crown"></i>
                                        </button>
                                    </form>
                                    <button onclick="confirmDelete(<?= $domain['id'] ?>, '<?= htmlspecialchars($domain['domain']) ?>', <?= $domain['email_count'] ?>)"
                                            class="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition" title="Delete">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        
                        <?php if (isset($dnsResults[$domain['domain']])): ?>
                        <tr id="dns-<?= $domain['id'] ?>" class="bg-gray-750">
                            <td colspan="7" class="px-4 py-4">
                                <div class="bg-gray-900 rounded-lg p-4">
                                    <h4 class="font-medium mb-3">DNS Records for <?= htmlspecialchars($domain['domain']) ?></h4>
                                    <div class="grid md:grid-cols-4 gap-4">
                                        <?php 
                                        $dns = $dnsResults[$domain['domain']];
                                        $statusColors = [
                                            'success' => 'text-green-400',
                                            'warning' => 'text-yellow-400',
                                            'error' => 'text-red-400'
                                        ];
                                        $statusIcons = [
                                            'success' => 'fa-check-circle',
                                            'warning' => 'fa-exclamation-triangle',
                                            'error' => 'fa-times-circle'
                                        ];
                                        ?>
                                        
                                        <div class="bg-gray-800 rounded-lg p-3">
                                            <div class="flex items-center space-x-2 mb-2">
                                                <i class="fas <?= $statusIcons[$dns['mx']['status']] ?> <?= $statusColors[$dns['mx']['status']] ?>"></i>
                                                <span class="font-medium">MX Records</span>
                                            </div>
                                            <?php if (!empty($dns['mx']['records'])): ?>
                                                <ul class="text-xs text-gray-400 space-y-1">
                                                    <?php foreach ($dns['mx']['records'] as $record): ?>
                                                    <li><?= htmlspecialchars($record) ?></li>
                                                    <?php endforeach; ?>
                                                </ul>
                                            <?php else: ?>
                                                <p class="text-xs text-red-400">No MX records found</p>
                                            <?php endif; ?>
                                        </div>
                                        
                                        <div class="bg-gray-800 rounded-lg p-3">
                                            <div class="flex items-center space-x-2 mb-2">
                                                <i class="fas <?= $statusIcons[$dns['spf']['status']] ?> <?= $statusColors[$dns['spf']['status']] ?>"></i>
                                                <span class="font-medium">SPF</span>
                                            </div>
                                            <?php if ($dns['spf']['record']): ?>
                                                <p class="text-xs text-gray-400 break-all"><?= htmlspecialchars($dns['spf']['record']) ?></p>
                                            <?php else: ?>
                                                <p class="text-xs text-red-400">No SPF record found</p>
                                            <?php endif; ?>
                                        </div>
                                        
                                        <div class="bg-gray-800 rounded-lg p-3">
                                            <div class="flex items-center space-x-2 mb-2">
                                                <i class="fas <?= $statusIcons[$dns['dkim']['status']] ?> <?= $statusColors[$dns['dkim']['status']] ?>"></i>
                                                <span class="font-medium">DKIM</span>
                                            </div>
                                            <?php if ($dns['dkim']['record']): ?>
                                                <p class="text-xs text-green-400">DKIM record found</p>
                                            <?php else: ?>
                                                <p class="text-xs text-yellow-400">Not configured (optional)</p>
                                            <?php endif; ?>
                                        </div>
                                        
                                        <div class="bg-gray-800 rounded-lg p-3">
                                            <div class="flex items-center space-x-2 mb-2">
                                                <i class="fas <?= $statusIcons[$dns['dmarc']['status']] ?> <?= $statusColors[$dns['dmarc']['status']] ?>"></i>
                                                <span class="font-medium">DMARC</span>
                                            </div>
                                            <?php if ($dns['dmarc']['record']): ?>
                                                <p class="text-xs text-gray-400 break-all"><?= htmlspecialchars($dns['dmarc']['record']) ?></p>
                                            <?php else: ?>
                                                <p class="text-xs text-yellow-400">Not configured (optional)</p>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                        <?php endif; ?>
                        
                        <?php endforeach; ?>
                        
                        <?php if (empty($domains)): ?>
                        <tr>
                            <td colspan="7" class="px-4 py-8 text-center text-gray-400">
                                <i class="fas fa-globe text-4xl mb-4 block"></i>
                                No domains configured. Add your first domain above.
                            </td>
                        </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Edit Modal -->
    <div id="editModal" class="modal fixed inset-0 bg-black/70 items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 class="text-xl font-bold mb-4">Edit Domain</h3>
            <p class="text-gray-400 mb-4">Domain: <span id="editDomainName" class="text-white"></span></p>
            <form method="POST">
                <input type="hidden" name="action" value="update_domain">
                <input type="hidden" name="domain_id" id="editDomainId">
                <div class="mb-4">
                    <label class="block text-sm text-gray-400 mb-1">Display Name</label>
                    <input type="text" name="display_name" id="editDisplayName"
                           class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none">
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="closeModal('editModal')" class="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition">
                        Update
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Delete Modal -->
    <div id="deleteModal" class="modal fixed inset-0 bg-black/70 items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 class="text-xl font-bold mb-4 text-red-400">Delete Domain</h3>
            <p class="text-gray-300 mb-2">Are you sure you want to delete <span id="deleteDomainName" class="text-white font-bold"></span>?</p>
            <p class="text-sm text-gray-400 mb-4" id="deleteEmailWarning"></p>
            <form method="POST">
                <input type="hidden" name="action" value="delete_domain">
                <input type="hidden" name="domain_id" id="deleteDomainId">
                <div id="forceDeleteOption" class="mb-4 hidden">
                    <label class="flex items-center space-x-2 text-yellow-400">
                        <input type="checkbox" name="force_delete" class="w-4 h-4 rounded bg-gray-700 border-gray-600">
                        <span class="text-sm">Force delete (will NOT delete associated emails)</span>
                    </label>
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="closeModal('deleteModal')" class="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition">
                        Delete Domain
                    </button>
                </div>
            </form>
        </div>
    </div>

    <script>
        function openModal(id) {
            document.getElementById(id).classList.add('active');
        }
        
        function closeModal(id) {
            document.getElementById(id).classList.remove('active');
        }
        
        function openEditModal(domainId, domain, displayName) {
            document.getElementById('editDomainId').value = domainId;
            document.getElementById('editDomainName').textContent = domain;
            document.getElementById('editDisplayName').value = displayName;
            openModal('editModal');
        }
        
        function confirmDelete(domainId, domain, emailCount) {
            document.getElementById('deleteDomainId').value = domainId;
            document.getElementById('deleteDomainName').textContent = domain;
            
            const warningEl = document.getElementById('deleteEmailWarning');
            const forceEl = document.getElementById('forceDeleteOption');
            
            if (emailCount > 0) {
                warningEl.textContent = `This domain has ${emailCount} email(s) associated with it.`;
                forceEl.classList.remove('hidden');
            } else {
                warningEl.textContent = 'This action cannot be undone.';
                forceEl.classList.add('hidden');
            }
            
            openModal('deleteModal');
        }
        
        // Close modal on outside click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
    </script>
</body>
</html>
