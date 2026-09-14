<?php
//======== Members API ========
declare(strict_types=1);

require_once __DIR__ . '/config.php';
date_default_timezone_set('Asia/Jakarta');

function inputJson(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function normalizeMember(array $row): array
{
    return [
        'id' => 'member_' . (int) $row['id'],
        'name' => $row['name'],
        'timesUsed' => (int) $row['times_used'],
        'totalPasses' => (int) $row['total_passes'],
        'creationDate' => $row['creation_date'],
    ];
}

function getMembers(PDO $pdo): array
{
    $rows = $pdo->query("SELECT id, name, times_used, total_passes, creation_date FROM members WHERE is_active=1 ORDER BY id ASC")->fetchAll();
    return array_map('normalizeMember', $rows);
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    if ($method === 'GET') {
        respond(['success' => true, 'data' => getMembers($pdo)]);
    }

    requireMaster();

    if ($method === 'POST') {
        $data = inputJson();

        // Bulk migration dari localStorage lama.
        if (isset($data['members']) && is_array($data['members'])) {
            $upsert = $pdo->prepare("INSERT INTO members (name, total_passes, times_used, creation_date, is_active) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE total_passes=VALUES(total_passes), times_used=VALUES(times_used), is_active=1, updated_at=CURRENT_TIMESTAMP");
            foreach ($data['members'] as $member) {
                $name = trim((string) ($member['name'] ?? ''));
                if ($name === '') continue;
                $creation = $member['creationDate'] ?? null;
                $ts = is_string($creation) && trim($creation) !== '' ? strtotime($creation) : false;
                $creationDate = $ts !== false ? date('Y-m-d H:i:s', $ts) : date('Y-m-d H:i:s');
                $upsert->execute([
                    $name,
                    max(0, (int) ($member['totalPasses'] ?? 21)),
                    max(0, (int) ($member['timesUsed'] ?? 0)),
                    $creationDate
                ]);
            }
            respond(['success' => true, 'data' => getMembers($pdo)]);
        }

        $name = trim((string) ($data['name'] ?? ''));
        if ($name === '') respond(['success' => false, 'message' => 'Nama member wajib diisi.'], 422);

        $creation = $data['creationDate'] ?? null;
        $ts = is_string($creation) && trim($creation) !== '' ? strtotime($creation) : false;
        $creationDate = $ts !== false ? date('Y-m-d H:i:s', $ts) : date('Y-m-d H:i:s');

        $stmt = $pdo->prepare("INSERT INTO members (name, total_passes, times_used, creation_date, is_active) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE total_passes=VALUES(total_passes), times_used=VALUES(times_used), is_active=1, updated_at=CURRENT_TIMESTAMP");
        $stmt->execute([
            $name,
            max(0, (int) ($data['totalPasses'] ?? 21)),
            max(0, (int) ($data['timesUsed'] ?? 0)),
            $creationDate
        ]);

        respond(['success' => true, 'data' => getMembers($pdo)]);
    }

    if ($method === 'DELETE') {
        $name = trim((string) ($_GET['name'] ?? ''));
        if ($name === '') respond(['success' => false, 'message' => 'Nama member wajib diisi.'], 422);

        $stmt = $pdo->prepare("UPDATE members SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE name=?");
        $stmt->execute([$name]);
        respond(['success' => true, 'data' => getMembers($pdo)]);
    }

    respond(['success' => false, 'message' => 'Method tidak didukung.'], 405);
} catch (Throwable $e) {
    respond(['success' => false, 'message' => 'Gagal menyimpan member.', 'error' => $e->getMessage()], 500);
}
