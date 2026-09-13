<?php
//======== Authentication API ========
declare(strict_types=1);
require_once __DIR__ . '/config.php';

startAppSession();
$action = $_GET['action'] ?? '';

try {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET' && $action === 'me') {
        $user = currentUser();
        jsonResponse(['success' => true, 'authenticated' => (bool) $user, 'user' => $user]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $raw = file_get_contents('php://input');
        $data = json_decode($raw ?: '{}', true);
        if (!is_array($data)) $data = [];

        if ($action === 'login') {
            $username = trim((string) ($data['username'] ?? ''));
            $password = (string) ($data['password'] ?? '');
            if ($username === '' || $password === '') {
                jsonResponse(['success' => false, 'message' => 'Username dan password wajib diisi.'], 400);
            }

            $stmt = $pdo->prepare("SELECT id, username, password_hash, role, is_active FROM users WHERE username=? LIMIT 1");
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if (!$user || !(int) $user['is_active'] || !password_verify($password, $user['password_hash'])) {
                jsonResponse(['success' => false, 'message' => 'Username atau password salah.'], 401);
            }

            session_regenerate_id(true);
            $_SESSION['user_id'] = (int) $user['id'];
            jsonResponse(['success' => true, 'user' => [
                'id' => (int) $user['id'],
                'username' => $user['username'],
                'role' => $user['role']
            ]]);
        }

        if ($action === 'logout') {
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $params = session_get_cookie_params();
                setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'] ?? '', (bool) $params['secure'], (bool) $params['httponly']);
            }
            session_destroy();
            jsonResponse(['success' => true]);
        }
    }

    jsonResponse(['success' => false, 'message' => 'Aksi autentikasi tidak valid.'], 400);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'Autentikasi gagal.', 'error' => $e->getMessage()], 500);
}
