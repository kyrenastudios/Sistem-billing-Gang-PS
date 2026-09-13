<?php
//======== User Management API ========
declare(strict_types=1);
require_once __DIR__ . '/config.php';

$admin = requireAdmin();
$method = $_SERVER['REQUEST_METHOD'];

try {
    $pdo = db();

    if ($method === 'GET') {
        $rows = $pdo->query("SELECT id, username, role, is_active, created_at, updated_at FROM users ORDER BY role ASC, username ASC")->fetchAll();
        jsonResponse(['success' => true, 'users' => $rows]);
    }

    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) $data = [];

    if ($method === 'POST') {
        $username = trim((string) ($data['username'] ?? ''));
        $password = (string) ($data['password'] ?? '');
        $role = (string) ($data['role'] ?? 'kasir');
        if ($username === '' || strlen($username) < 3) jsonResponse(['success' => false, 'message' => 'Username minimal 3 karakter.'], 400);
        if (strlen($password) < 6) jsonResponse(['success' => false, 'message' => 'Password minimal 6 karakter.'], 400);
        if (!in_array($role, ['admin', 'kasir'], true)) jsonResponse(['success' => false, 'message' => 'Role tidak valid.'], 400);

        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)");
        try {
            $stmt->execute([$username, password_hash($password, PASSWORD_DEFAULT), $role]);
        } catch (PDOException $e) {
            if ((int) $e->errorInfo[1] === 1062) jsonResponse(['success' => false, 'message' => 'Username sudah digunakan.'], 409);
            throw $e;
        }
        jsonResponse(['success' => true, 'message' => 'Pengguna berhasil dibuat.']);
    }

    if ($method === 'PUT') {
        $id = (int) ($data['id'] ?? 0);
        if ($id <= 0) jsonResponse(['success' => false, 'message' => 'ID pengguna tidak valid.'], 400);

        $sets = [];
        $params = [];
        if (isset($data['role']) && in_array($data['role'], ['admin', 'kasir'], true)) { $sets[] = 'role=?'; $params[] = $data['role']; }
        if (array_key_exists('is_active', $data)) { $sets[] = 'is_active=?'; $params[] = $data['is_active'] ? 1 : 0; }
        if ((string) ($data['password'] ?? '') !== '') {
            if (strlen((string) $data['password']) < 6) jsonResponse(['success' => false, 'message' => 'Password minimal 6 karakter.'], 400);
            $sets[] = 'password_hash=?'; $params[] = password_hash((string) $data['password'], PASSWORD_DEFAULT);
        }
        if (!$sets) jsonResponse(['success' => false, 'message' => 'Tidak ada perubahan.'], 400);

        if ($id === (int) $admin['id'] && isset($data['is_active']) && !$data['is_active']) {
            jsonResponse(['success' => false, 'message' => 'Admin yang sedang login tidak boleh dinonaktifkan.'], 400);
        }
        $params[] = $id;
        $stmt = $pdo->prepare("UPDATE users SET " . implode(', ', $sets) . " WHERE id=?");
        $stmt->execute($params);
        jsonResponse(['success' => true, 'message' => 'Pengguna berhasil diperbarui.']);
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0 || $id === (int) $admin['id']) jsonResponse(['success' => false, 'message' => 'Pengguna tidak dapat dihapus.'], 400);
        $stmt = $pdo->prepare("DELETE FROM users WHERE id=?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'message' => 'Pengguna berhasil dihapus.']);
    }

    jsonResponse(['success' => false, 'message' => 'Method tidak didukung.'], 405);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'Pengelolaan pengguna gagal.', 'error' => $e->getMessage()], 500);
}
