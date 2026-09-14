<?php
//======== Database Config ========
declare(strict_types=1);

//======== API Output Buffer ========
// Menahan warning PHP agar response API tetap JSON valid.
if (ob_get_level() === 0) {
    ob_start();
}

const DB_HOST = '127.0.0.1';
const DB_NAME = 'gang_ps';
const DB_USER = 'root';
const DB_PASS = '';
const DB_CHARSET = 'utf8mb4';

//======== PHP Compatibility ========
if (!function_exists('str_starts_with')) {
    function str_starts_with(string $haystack, string $needle): bool
    {
        return $needle === '' || strpos($haystack, $needle) === 0;
    }
}

function startAppSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;

    session_name('gang_ps_session');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    ini_set('session.use_strict_mode', '1');
    session_start();
}

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    //======== Database Compatibility ========
    try { $pdo->exec("ALTER TABLE consoles ADD UNIQUE KEY uq_consoles_name (name)"); } catch (PDOException $e) {}
    try { $pdo->exec("ALTER TABLE members ADD UNIQUE KEY uq_members_name (name)"); } catch (PDOException $e) {}
    try { $pdo->exec("ALTER TABLE packages ADD UNIQUE KEY uq_packages_name_type (name, console_type)"); } catch (PDOException $e) {}
    try { $pdo->exec("ALTER TABLE sessions ADD COLUMN orders_json LONGTEXT NULL"); } catch (PDOException $e) {}

    //======== User Table ========
    $pdo->exec("CREATE TABLE IF NOT EXISTS users (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','kasir') NOT NULL DEFAULT 'kasir',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    //======== Default Admin ========
    $count = (int) $pdo->query("SELECT COUNT(*) FROM users")->fetchColumn();
    if ($count === 0) {
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')");
        $stmt->execute(['admin', '$2y$12$6vpXUbyVirKTynwfpMHFh.6kOu6aEO6LSIOFOJRjwy1EMnJ0fKpYy']);
    }

    return $pdo;
}

//======== PC Mode ========
// Browser mengirim mode lokal per-PC. Loopback tetap otomatis Master untuk kompatibilitas.
function gangPsIsMasterRequest(): bool
{
    $mode = strtolower(trim((string) ($_SERVER['HTTP_X_GANG_PS_MODE'] ?? '')));
    if ($mode === 'master') return true;
    if ($mode === 'client') return false;

    $remote = strtolower(trim((string) ($_SERVER['REMOTE_ADDR'] ?? '')));
    return in_array($remote, ['127.0.0.1', '::1', '::ffff:127.0.0.1'], true);
}

function requireMaster(): void
{
    if (!gangPsIsMasterRequest()) {
        jsonResponse(['success' => false, 'message' => 'PC CLIENT hanya memiliki akses baca.'], 403);
    }
}

function currentUser(): ?array
{
    startAppSession();
    $userId = (int) ($_SESSION['user_id'] ?? 0);
    if ($userId <= 0) return null;

    $stmt = db()->prepare("SELECT id, username, role, is_active FROM users WHERE id=? LIMIT 1");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();
    if (!$user || !(int) $user['is_active']) {
        unset($_SESSION['user_id']);
        return null;
    }
    return $user;
}

function requireAuth(): array
{
    $user = currentUser();
    if (!$user) jsonResponse(['success' => false, 'message' => 'Anda belum login.'], 401);
    return $user;
}

function requireAdmin(): array
{
    $user = requireAuth();
    if ($user['role'] !== 'admin') {
        jsonResponse(['success' => false, 'message' => 'Akses khusus Admin.'], 403);
    }
    return $user;
}

function jsonResponse(array $data, int $status = 200): never
{
    //======== Clean API Buffer ========
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
