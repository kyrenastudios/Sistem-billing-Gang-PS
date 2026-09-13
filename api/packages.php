<?php
//======== Packages API ========
declare(strict_types=1);
require_once __DIR__ . '/config.php';

function packagesJsonResponse(array $data, int $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function packagesReadJson(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function packagesFetch(PDO $pdo): array {
    $stmt = $pdo->query('SELECT id, name, console_type, duration_minutes, price, notes FROM packages ORDER BY console_type ASC, duration_minutes ASC, id ASC');
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $result = [];
    foreach ($rows as $row) {
        $result[] = [
            'id' => 'pkg_' . (int)$row['id'],
            'name' => (string)$row['name'],
            'durationMinutes' => (int)$row['duration_minutes'],
            'price' => (int)$row['price'],
            'consoleType' => (string)$row['console_type'],
            'notes' => $row['notes']
        ];
    }
    return $result;
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'OPTIONS') {
        packagesJsonResponse(['success' => true]);
    }

    if ($method === 'GET') {
        packagesJsonResponse(['success' => true, 'data' => packagesFetch($pdo)]);
    }

    $data = packagesReadJson();

    if ($method === 'DELETE') {
        $rawId = (string)($data['id'] ?? $_GET['id'] ?? '');
        $id = preg_replace('/^pkg_/', '', $rawId);
        if (!ctype_digit($id)) packagesJsonResponse(['success'=>false,'message'=>'ID paket tidak valid.'],400);
        $stmt = $pdo->prepare('DELETE FROM packages WHERE id = ?');
        $stmt->execute([(int)$id]);
        packagesJsonResponse(['success'=>true,'data'=>packagesFetch($pdo)]);
    }

    if ($method !== 'POST' && $method !== 'PUT') {
        packagesJsonResponse(['success'=>false,'message'=>'Method tidak didukung.'],405);
    }

    $name = trim((string)($data['name'] ?? ''));
    $type = strtoupper(trim((string)($data['consoleType'] ?? '')));
    $duration = (int)($data['durationMinutes'] ?? 0);
    $price = (int)($data['price'] ?? 0);
    $notes = array_key_exists('notes', $data) ? $data['notes'] : null;

    if ($name === '' || !in_array($type, ['PS3','PS4','PS5'], true) || $duration <= 0 || $price < 0) {
        packagesJsonResponse(['success'=>false,'message'=>'Data paket tidak valid.'],400);
    }

    $rawId = (string)($data['id'] ?? '');
    $id = preg_replace('/^pkg_/', '', $rawId);
    if ($id !== '' && !ctype_digit($id)) packagesJsonResponse(['success'=>false,'message'=>'ID paket tidak valid.'],400);

    if ($id !== '') {
        $stmt = $pdo->prepare('UPDATE packages SET name = ?, console_type = ?, duration_minutes = ?, price = ?, notes = ? WHERE id = ?');
        $stmt->execute([$name, $type, $duration, $price, $notes, (int)$id]);
    } else {
        $stmt = $pdo->prepare('INSERT INTO packages (name, console_type, duration_minutes, price, notes) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$name, $type, $duration, $price, $notes]);
    }

    packagesJsonResponse(['success'=>true,'data'=>packagesFetch($pdo)]);
} catch (PDOException $e) {
    $mysqlCode = isset($e->errorInfo[1]) ? (int)$e->errorInfo[1] : 0;
    if ($mysqlCode === 1062) {
        packagesJsonResponse(['success'=>false,'message'=>'Nama paket untuk tipe PS tersebut sudah ada.'],409);
    }
    packagesJsonResponse(['success'=>false,'message'=>'Database paket gagal diproses.','error'=>$e->getMessage()],500);
} catch (Throwable $e) {
    packagesJsonResponse(['success'=>false,'message'=>'Paket gagal diproses.','error'=>$e->getMessage()],500);
}
