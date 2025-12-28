<?php
/**
 * User Management Dashboard
 * Manage users, roles, password resets, and account actions
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
            case 'create_user':
                $email = filter_var($_POST['email'] ?? '', FILTER_VALIDATE_EMAIL);
                $username = trim($_POST['username'] ?? '');
                $password = $_POST['password'] ?? '';
                $role = $_POST['role'] ?? 'user';
                
                if (!$email || !$username || strlen($password) < 8) {
                    throw new Exception('Invalid input. Email, username required, password must be 8+ characters.');
                }
                
                $hashedPassword = password_hash($password, PASSWORD_DEFAULT);
                
                Database::execute(
                    "INSERT INTO users (email, username, password_hash, role, email_verified, created_at) 
                     VALUES (?, ?, ?, ?, 1, NOW())",
                    [$email, $username, $hashedPassword, $role]
                );
                
                $message = "User '$username' created successfully.";
                $messageType = 'success';
                break;
                
            case 'update_role':
                $userId = (int)($_POST['user_id'] ?? 0);
                $newRole = $_POST['new_role'] ?? 'user';
                
                if (!in_array($newRole, ['user', 'premium', 'admin'])) {
                    throw new Exception('Invalid role.');
                }
                
                Database::execute(
                    "UPDATE users SET role = ?, updated_at = NOW() WHERE id = ?",
                    [$newRole, $userId]
                );
                
                $message = "User role updated to '$newRole'.";
                $messageType = 'success';
                break;
                
            case 'reset_password':
                $userId = (int)($_POST['user_id'] ?? 0);
                $newPassword = $_POST['new_password'] ?? '';
                
                if (strlen($newPassword) < 8) {
                    throw new Exception('Password must be at least 8 characters.');
                }
                
                $hashedPassword = password_hash($newPassword, PASSWORD_DEFAULT);
                
                Database::execute(
                    "UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?",
                    [$hashedPassword, $userId]
                );
                
                $message = "Password reset successfully.";
                $messageType = 'success';
                break;
                
            case 'toggle_status':
                $userId = (int)($_POST['user_id'] ?? 0);
                $currentStatus = (int)($_POST['current_status'] ?? 1);
                $newStatus = $currentStatus ? 0 : 1;
                
                Database::execute(
                    "UPDATE users SET is_active = ?, updated_at = NOW() WHERE id = ?",
                    [$newStatus, $userId]
                );
                
                $message = $newStatus ? "User activated." : "User deactivated.";
                $messageType = 'success';
                break;
                
            case 'delete_user':
                $userId = (int)($_POST['user_id'] ?? 0);
                
                // Delete user's emails first
                Database::execute("DELETE FROM emails WHERE user_id = ?", [$userId]);
                Database::execute("DELETE FROM users WHERE id = ?", [$userId]);
                
                $message = "User deleted successfully.";
                $messageType = 'success';
                break;
                
            case 'verify_email':
                $userId = (int)($_POST['user_id'] ?? 0);
                
                Database::execute(
                    "UPDATE users SET email_verified = 1, updated_at = NOW() WHERE id = ?",
                    [$userId]
                );
                
                $message = "Email marked as verified.";
                $messageType = 'success';
                break;
        }
    } catch (Exception $e) {
        $message = "Error: " . $e->getMessage();
        $messageType = 'error';
    }
}

// Fetch users with pagination
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = 20;
$offset = ($page - 1) * $perPage;
$search = trim($_GET['search'] ?? '');
$roleFilter = $_GET['role'] ?? '';

$whereClause = "1=1";
$params = [];

if ($search) {
    $whereClause .= " AND (email LIKE ? OR username LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

if ($roleFilter) {
    $whereClause .= " AND role = ?";
    $params[] = $roleFilter;
}

$totalUsers = Database::fetchOne(
    "SELECT COUNT(*) as count FROM users WHERE $whereClause",
    $params
)['count'] ?? 0;

$totalPages = ceil($totalUsers / $perPage);

$users = Database::fetchAll(
    "SELECT id, email, username, role, is_active, email_verified, 
            created_at, last_login_at, login_count
     FROM users 
     WHERE $whereClause 
     ORDER BY created_at DESC 
     LIMIT $perPage OFFSET $offset",
    $params
);

// Get user statistics
$stats = [
    'total' => Database::fetchOne("SELECT COUNT(*) as c FROM users")['c'] ?? 0,
    'active' => Database::fetchOne("SELECT COUNT(*) as c FROM users WHERE is_active = 1")['c'] ?? 0,
    'admins' => Database::fetchOne("SELECT COUNT(*) as c FROM users WHERE role = 'admin'")['c'] ?? 0,
    'premium' => Database::fetchOne("SELECT COUNT(*) as c FROM users WHERE role = 'premium'")['c'] ?? 0,
    'unverified' => Database::fetchOne("SELECT COUNT(*) as c FROM users WHERE email_verified = 0")['c'] ?? 0,
    'today' => Database::fetchOne("SELECT COUNT(*) as c FROM users WHERE DATE(created_at) = CURDATE()")['c'] ?? 0,
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>User Management - Admin</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        .modal { display: none; }
        .modal.active { display: flex; }
    </style>
</head>
<body class="bg-gray-900 text-gray-100 min-h-screen">
    <!-- Navigation -->
    <nav class="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
                <i class="fas fa-users-cog text-2xl text-blue-400"></i>
                <h1 class="text-xl font-bold">User Management</h1>
            </div>
            <div class="flex items-center space-x-4">
                <a href="health-dashboard.php" class="text-gray-400 hover:text-white">
                    <i class="fas fa-heartbeat mr-2"></i>Health
                </a>
                <a href="analytics.php" class="text-gray-400 hover:text-white">
                    <i class="fas fa-chart-bar mr-2"></i>Analytics
                </a>
                <a href="admin-domains.php" class="text-gray-400 hover:text-white">
                    <i class="fas fa-globe mr-2"></i>Domains
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

        <!-- Statistics Cards -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div class="text-3xl font-bold text-blue-400"><?= number_format($stats['total']) ?></div>
                <div class="text-gray-400 text-sm">Total Users</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div class="text-3xl font-bold text-green-400"><?= number_format($stats['active']) ?></div>
                <div class="text-gray-400 text-sm">Active</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div class="text-3xl font-bold text-purple-400"><?= number_format($stats['admins']) ?></div>
                <div class="text-gray-400 text-sm">Admins</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div class="text-3xl font-bold text-yellow-400"><?= number_format($stats['premium']) ?></div>
                <div class="text-gray-400 text-sm">Premium</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div class="text-3xl font-bold text-red-400"><?= number_format($stats['unverified']) ?></div>
                <div class="text-gray-400 text-sm">Unverified</div>
            </div>
            <div class="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <div class="text-3xl font-bold text-cyan-400"><?= number_format($stats['today']) ?></div>
                <div class="text-gray-400 text-sm">New Today</div>
            </div>
        </div>

        <!-- Actions Bar -->
        <div class="flex flex-wrap gap-4 mb-6">
            <button onclick="openModal('createUserModal')" class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition">
                <i class="fas fa-user-plus mr-2"></i>Create User
            </button>
            
            <form method="GET" class="flex-1 flex gap-2">
                <input type="text" name="search" value="<?= htmlspecialchars($search) ?>" 
                       placeholder="Search by email or username..."
                       class="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none">
                <select name="role" class="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2">
                    <option value="">All Roles</option>
                    <option value="user" <?= $roleFilter === 'user' ? 'selected' : '' ?>>User</option>
                    <option value="premium" <?= $roleFilter === 'premium' ? 'selected' : '' ?>>Premium</option>
                    <option value="admin" <?= $roleFilter === 'admin' ? 'selected' : '' ?>>Admin</option>
                </select>
                <button type="submit" class="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg">
                    <i class="fas fa-search"></i>
                </button>
            </form>
        </div>

        <!-- Users Table -->
        <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-700">
                        <tr>
                            <th class="px-4 py-3 text-left text-sm font-medium">User</th>
                            <th class="px-4 py-3 text-left text-sm font-medium">Role</th>
                            <th class="px-4 py-3 text-left text-sm font-medium">Status</th>
                            <th class="px-4 py-3 text-left text-sm font-medium">Logins</th>
                            <th class="px-4 py-3 text-left text-sm font-medium">Created</th>
                            <th class="px-4 py-3 text-left text-sm font-medium">Last Login</th>
                            <th class="px-4 py-3 text-center text-sm font-medium">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-700">
                        <?php foreach ($users as $user): ?>
                        <tr class="hover:bg-gray-700/50">
                            <td class="px-4 py-3">
                                <div class="flex items-center space-x-3">
                                    <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                        <?= strtoupper(substr($user['username'] ?? $user['email'], 0, 1)) ?>
                                    </div>
                                    <div>
                                        <div class="font-medium"><?= htmlspecialchars($user['username'] ?? 'N/A') ?></div>
                                        <div class="text-sm text-gray-400"><?= htmlspecialchars($user['email']) ?></div>
                                    </div>
                                </div>
                            </td>
                            <td class="px-4 py-3">
                                <span class="px-2 py-1 rounded-full text-xs font-medium
                                    <?php
                                    switch ($user['role']) {
                                        case 'admin': echo 'bg-purple-900/50 text-purple-300 border border-purple-500'; break;
                                        case 'premium': echo 'bg-yellow-900/50 text-yellow-300 border border-yellow-500'; break;
                                        default: echo 'bg-gray-700 text-gray-300 border border-gray-500';
                                    }
                                    ?>">
                                    <?= ucfirst($user['role']) ?>
                                </span>
                            </td>
                            <td class="px-4 py-3">
                                <div class="flex flex-col space-y-1">
                                    <span class="flex items-center text-sm <?= $user['is_active'] ? 'text-green-400' : 'text-red-400' ?>">
                                        <i class="fas fa-circle text-xs mr-2"></i>
                                        <?= $user['is_active'] ? 'Active' : 'Inactive' ?>
                                    </span>
                                    <?php if (!$user['email_verified']): ?>
                                    <span class="flex items-center text-xs text-yellow-400">
                                        <i class="fas fa-exclamation-triangle mr-1"></i>Unverified
                                    </span>
                                    <?php endif; ?>
                                </div>
                            </td>
                            <td class="px-4 py-3 text-gray-300">
                                <?= number_format($user['login_count'] ?? 0) ?>
                            </td>
                            <td class="px-4 py-3 text-gray-400 text-sm">
                                <?= date('M j, Y', strtotime($user['created_at'])) ?>
                            </td>
                            <td class="px-4 py-3 text-gray-400 text-sm">
                                <?= $user['last_login_at'] ? date('M j, Y H:i', strtotime($user['last_login_at'])) : 'Never' ?>
                            </td>
                            <td class="px-4 py-3">
                                <div class="flex items-center justify-center space-x-2">
                                    <button onclick="openRoleModal(<?= $user['id'] ?>, '<?= $user['role'] ?>', '<?= htmlspecialchars($user['email']) ?>')"
                                            class="p-2 text-blue-400 hover:bg-blue-900/30 rounded-lg transition" title="Change Role">
                                        <i class="fas fa-user-tag"></i>
                                    </button>
                                    <button onclick="openPasswordModal(<?= $user['id'] ?>, '<?= htmlspecialchars($user['email']) ?>')"
                                            class="p-2 text-yellow-400 hover:bg-yellow-900/30 rounded-lg transition" title="Reset Password">
                                        <i class="fas fa-key"></i>
                                    </button>
                                    <?php if (!$user['email_verified']): ?>
                                    <form method="POST" class="inline">
                                        <input type="hidden" name="action" value="verify_email">
                                        <input type="hidden" name="user_id" value="<?= $user['id'] ?>">
                                        <button type="submit" class="p-2 text-green-400 hover:bg-green-900/30 rounded-lg transition" title="Verify Email">
                                            <i class="fas fa-check-circle"></i>
                                        </button>
                                    </form>
                                    <?php endif; ?>
                                    <form method="POST" class="inline">
                                        <input type="hidden" name="action" value="toggle_status">
                                        <input type="hidden" name="user_id" value="<?= $user['id'] ?>">
                                        <input type="hidden" name="current_status" value="<?= $user['is_active'] ?>">
                                        <button type="submit" class="p-2 <?= $user['is_active'] ? 'text-orange-400 hover:bg-orange-900/30' : 'text-green-400 hover:bg-green-900/30' ?> rounded-lg transition" 
                                                title="<?= $user['is_active'] ? 'Deactivate' : 'Activate' ?>">
                                            <i class="fas <?= $user['is_active'] ? 'fa-user-slash' : 'fa-user-check' ?>"></i>
                                        </button>
                                    </form>
                                    <button onclick="confirmDelete(<?= $user['id'] ?>, '<?= htmlspecialchars($user['email']) ?>')"
                                            class="p-2 text-red-400 hover:bg-red-900/30 rounded-lg transition" title="Delete User">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>
                        <?php endforeach; ?>
                        <?php if (empty($users)): ?>
                        <tr>
                            <td colspan="7" class="px-4 py-8 text-center text-gray-400">
                                <i class="fas fa-users text-4xl mb-4 block"></i>
                                No users found.
                            </td>
                        </tr>
                        <?php endif; ?>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Pagination -->
        <?php if ($totalPages > 1): ?>
        <div class="flex justify-center mt-6 space-x-2">
            <?php for ($i = 1; $i <= $totalPages; $i++): ?>
            <a href="?page=<?= $i ?>&search=<?= urlencode($search) ?>&role=<?= urlencode($roleFilter) ?>"
               class="px-4 py-2 rounded-lg <?= $i === $page ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600' ?> transition">
                <?= $i ?>
            </a>
            <?php endfor; ?>
        </div>
        <?php endif; ?>
    </div>

    <!-- Create User Modal -->
    <div id="createUserModal" class="modal fixed inset-0 bg-black/70 items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 class="text-xl font-bold mb-4">Create New User</h3>
            <form method="POST">
                <input type="hidden" name="action" value="create_user">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Email</label>
                        <input type="email" name="email" required
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Username</label>
                        <input type="text" name="username" required
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Password</label>
                        <input type="password" name="password" required minlength="8"
                               class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none">
                    </div>
                    <div>
                        <label class="block text-sm text-gray-400 mb-1">Role</label>
                        <select name="role" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                            <option value="user">User</option>
                            <option value="premium">Premium</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                </div>
                <div class="flex justify-end space-x-3 mt-6">
                    <button type="button" onclick="closeModal('createUserModal')" class="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition">
                        Create User
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Role Modal -->
    <div id="roleModal" class="modal fixed inset-0 bg-black/70 items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 class="text-xl font-bold mb-4">Change User Role</h3>
            <p class="text-gray-400 mb-4">User: <span id="roleUserEmail" class="text-white"></span></p>
            <form method="POST">
                <input type="hidden" name="action" value="update_role">
                <input type="hidden" name="user_id" id="roleUserId">
                <div class="mb-4">
                    <label class="block text-sm text-gray-400 mb-1">New Role</label>
                    <select name="new_role" id="roleSelect" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2">
                        <option value="user">User</option>
                        <option value="premium">Premium</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="closeModal('roleModal')" class="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition">
                        Update Role
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Password Modal -->
    <div id="passwordModal" class="modal fixed inset-0 bg-black/70 items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 class="text-xl font-bold mb-4">Reset Password</h3>
            <p class="text-gray-400 mb-4">User: <span id="passwordUserEmail" class="text-white"></span></p>
            <form method="POST">
                <input type="hidden" name="action" value="reset_password">
                <input type="hidden" name="user_id" id="passwordUserId">
                <div class="mb-4">
                    <label class="block text-sm text-gray-400 mb-1">New Password</label>
                    <input type="password" name="new_password" required minlength="8"
                           class="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:border-blue-500 focus:outline-none">
                </div>
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="closeModal('passwordModal')" class="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-yellow-600 rounded-lg hover:bg-yellow-700 transition">
                        Reset Password
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div id="deleteModal" class="modal fixed inset-0 bg-black/70 items-center justify-center z-50">
        <div class="bg-gray-800 rounded-lg p-6 w-full max-w-md border border-gray-700">
            <h3 class="text-xl font-bold mb-4 text-red-400">Delete User</h3>
            <p class="text-gray-300 mb-4">Are you sure you want to delete <span id="deleteUserEmail" class="text-white font-bold"></span>?</p>
            <p class="text-sm text-gray-400 mb-4">This will also delete all their emails. This action cannot be undone.</p>
            <form method="POST">
                <input type="hidden" name="action" value="delete_user">
                <input type="hidden" name="user_id" id="deleteUserId">
                <div class="flex justify-end space-x-3">
                    <button type="button" onclick="closeModal('deleteModal')" class="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600 transition">
                        Cancel
                    </button>
                    <button type="submit" class="px-4 py-2 bg-red-600 rounded-lg hover:bg-red-700 transition">
                        Delete User
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
        
        function openRoleModal(userId, currentRole, email) {
            document.getElementById('roleUserId').value = userId;
            document.getElementById('roleUserEmail').textContent = email;
            document.getElementById('roleSelect').value = currentRole;
            openModal('roleModal');
        }
        
        function openPasswordModal(userId, email) {
            document.getElementById('passwordUserId').value = userId;
            document.getElementById('passwordUserEmail').textContent = email;
            openModal('passwordModal');
        }
        
        function confirmDelete(userId, email) {
            document.getElementById('deleteUserId').value = userId;
            document.getElementById('deleteUserEmail').textContent = email;
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
