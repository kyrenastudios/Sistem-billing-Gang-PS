<?php
//======== Packages API ========
declare(strict_types=1);

require_once __DIR__ . '/config.php';

date_default_timezone_set('Asia/Jakarta');

function packageInput(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        $rows = $pdo->query("SELECT id, name, console_type, duration_minutes, price FROM packages WHERE is_active=1 ORDER BY console_type ASC, duration_minutes ASC, id ASC")->fetchAll();
        jsonResponse(['success' => true, 'data' => $rows]);
    }

    requireMaster();

    if ($method === 'POST') {
        $data = packageInput();
        $name = trim((string) ($data['name'] ?? ''));
        $type = strtoupper(trim((string) ($data['console_type'] ?? '')));
        $duration = (int) ($data['duration_minutes'] ?? 0);
        $price = (int) ($data['price'] ?? 0);

        if ($name === '' || !in_array($type, ['PS3', 'PS4', 'PS5'], true) || $duration <= 0 || $price < 0) {
            jsonResponse(['success' => false, 'message' => 'Data paket tidak valid.'], 422);
        }

        $stmt = $pdo->prepare("INSERT INTO packages (name, console_type, duration_minutes, price, is_active) VALUES (?, ?, ?, ?, 1)");
        try {
            $stmt->execute([$name, $type, $duration, $price]);
        } catch (PDOException $e) {
            if ((int) ($e->errorInfo[1] ?? 0) === 1062) jsonResponse(['success' => false, 'message' => 'Paket dengan nama dan tipe konsol tersebut sudah ada.'], 409);
            throw $e;
        }
        jsonResponse(['success' => true, 'message' => 'Paket berhasil ditambahkan.', 'data' => ['id' => (int) $pdo->lastInsertId()]], 201);
    }

    if ($method === 'PUT') {
        $id = (int) ($_GET['id'] ?? 0);
        $data = packageInput();
        if ($id <= 0) jsonResponse(['success' => false, 'message' => 'ID paket tidak valid.'], 400);

        $sets = [];
        $params = [];
        if (array_key_exists('name', $data)) { $sets[] = 'name=?'; $params[] = trim((string) $data['name']); }
        if (array_key_exists('console_type', $data)) { $sets[] = 'console_type=?'; $params[] = strtoupper(trim((string) $data['console_type'])); }
        if (array_key_exists('duration_minutes', $data)) { $sets[] = 'duration_minutes=?'; $params[] = (int) $data['duration_minutes']; }
        if (array_key_exists('price', $data)) { $sets[] = 'price=?'; $params[] = (int) $data['price']; }
        if (array_key_exists('is_active', $data)) { $sets[] = 'is_active=?'; $params[] = $data['is_active'] ? 1 : 0; }
        if (!$sets) jsonResponse(['success' => false, 'message' => 'Tidak ada perubahan.'], 400);

        $params[] = $id;
        $stmt = $pdo->prepare("UPDATE packages SET " . implode(', ', $sets) . ", updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $stmt->execute($params);
        jsonResponse(['success' => true, 'message' => 'Paket berhasil diperbarui.']);
    }

    if ($method === 'DELETE') {
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) jsonResponse(['success' => false, 'message' => 'ID paket tidak valid.'], 400);
        $stmt = $pdo->prepare("UPDATE packages SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $stmt->execute([$id]);
        jsonResponse(['success' => true, 'message' => 'Paket berhasil dihapus.']);
    }

    jsonResponse(['success' => false, 'message' => 'Method tidak didukung.'], 405);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'Pengelolaan paket gagal.', 'error' => $e->getMessage()], 500);
}
