<?php
//======== Consoles API ========
declare(strict_types=1);

require_once __DIR__ . '/config.php';

date_default_timezone_set('Asia/Jakarta');

function readJson(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function response(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function fetchConsoles(PDO $pdo): array
{
    $rows = $pdo->query("SELECT id, name, console_type, status, hourly_price, tv_size, sort_order FROM consoles WHERE status <> 'offline' ORDER BY sort_order ASC, id ASC")->fetchAll();
    $result = [];
    foreach ($rows as $row) {
        $result[] = [
            'id' => strtolower($row['console_type']) . '-' . (int) $row['id'],
            'name' => $row['name'],
            'type' => $row['console_type'],
            'status' => $row['status'] === 'playing' ? 'in-use' : ($row['status'] === 'paused' ? 'paused' : 'available'),
        ];
    }
    return $result;
}

try {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        response(['success' => true, 'data' => fetchConsoles($pdo)]);
    }

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        response(['success' => false, 'message' => 'Method tidak didukung.'], 405);
    }

    $data = readJson();
    $counts = $data['counts'] ?? null;
    if (!is_array($counts)) response(['success' => false, 'message' => 'Data jumlah konsol tidak valid.'], 400);

    $pdo->beginTransaction();
    try {
        foreach (['PS3', 'PS4', 'PS5'] as $type) {
            $wanted = max(0, (int) ($counts[$type] ?? 0));
            $rows = $pdo->prepare("SELECT id, name, status FROM consoles WHERE console_type=? ORDER BY sort_order ASC, id ASC");
            $rows->execute([$type]);
            $existing = $rows->fetchAll();

            $activeCount = 0;
            foreach ($existing as $row) {
                if (in_array($row['status'], ['playing', 'paused'], true)) $activeCount++;
            }
            if ($wanted < $activeCount) {
                throw new RuntimeException("Tidak bisa mengurangi jumlah $type karena masih ada $activeCount unit yang sedang digunakan/dijeda.");
            }

            $price = $type === 'PS3' ? 5000 : ($type === 'PS4' ? 8000 : 13000);
            $tv = $type === 'PS3' ? '32"' : ($type === 'PS4' ? '43"' : null);

            while (count($existing) < $wanted) {
                $nextNumber = count($existing) + 1;
                $name = "$type - $nextNumber";
                $insert = $pdo->prepare("INSERT INTO consoles (name, console_type, status, hourly_price, tv_size, sort_order) VALUES (?, ?, 'available', ?, ?, ?)");
                $insert->execute([$name, $type, $price, $tv, $nextNumber]);
                $existing[] = ['id' => (int) $pdo->lastInsertId(), 'name' => $name, 'status' => 'available'];
            }

            $number = 0;
            $rename = $pdo->prepare("UPDATE consoles SET name=?, hourly_price=?, tv_size=?, sort_order=?, status=CASE WHEN status='offline' THEN 'available' ELSE status END, updated_at=CURRENT_TIMESTAMP WHERE id=?");
            foreach ($existing as $row) {
                $number++;
                $rename->execute(["$type - $number", $price, $tv, $number, (int) $row['id']]);
            }

            if (count($existing) > $wanted) {
                for ($i = $wanted; $i < count($existing); $i++) {
                    if (in_array($existing[$i]['status'], ['playing', 'paused'], true)) continue;
                    $off = $pdo->prepare("UPDATE consoles SET status='offline', updated_at=CURRENT_TIMESTAMP WHERE id=?");
                    $off->execute([(int) $existing[$i]['id']]);
                }
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    response(['success' => true, 'data' => fetchConsoles($pdo)]);
} catch (Throwable $e) {
    response(['success' => false, 'message' => 'Pengaturan konsol gagal.', 'error' => $e->getMessage()], 500);
}
