<?php
//======== Database Sync API ========
declare(strict_types=1);

require_once __DIR__ . '/config.php';
date_default_timezone_set('Asia/Jakarta');

function syncInput(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function syncDate($value): string
{
    if (is_numeric($value)) {
        return date('Y-m-d H:i:s', (int) floor(((float) $value) / 1000));
    }
    if (is_string($value) && trim($value) !== '') {
        $ts = strtotime($value);
        if ($ts !== false) return date('Y-m-d H:i:s', $ts);
    }
    return date('Y-m-d H:i:s');
}

function syncHistoryDate(?string $date, ?string $time): string
{
    $date = $date ?: date('Y-m-d');
    $time = trim((string) ($time ?: '00:00:00'));
    $time = str_replace('.', ':', $time);
    $ts = strtotime($date . ' ' . $time);
    return $ts === false ? date('Y-m-d H:i:s') : date('Y-m-d H:i:s', $ts);
}

function syncMemberName(array $item): ?string
{
    $billing = (string) ($item['billingInfo'] ?? '');
    if (strpos($billing, 'Member Pass: ') === 0) return trim(substr($billing, 13));
    if (strpos($billing, 'Play Pass - ') === 0) return trim(substr($billing, 12));
    if (strpos($billing, 'Perpanjangan Pass - ') === 0) return trim(substr($billing, 20));
    return null;
}

function syncTransactionType(array $item): string
{
    $name = strtolower(trim((string) ($item['consoleName'] ?? '')));
    if ($name === 'penjualan langsung') return 'direct_sale';
    if ($name === 'pendaftaran member') return 'member_registration';
    if ($name === 'perpanjangan member') return 'member_renewal';
    return 'rental';
}

function syncConsoleDbStatus(string $status): string
{
    if ($status === 'in-use') return 'playing';
    if ($status === 'paused') return 'paused';
    if ($status === 'maintenance') return 'maintenance';
    if ($status === 'offline') return 'offline';
    return 'available';
}

function syncConsoleWebStatus(string $status): string
{
    if ($status === 'playing') return 'in-use';
    if ($status === 'paused') return 'paused';
    return 'available';
}

function fetchSyncState(PDO $pdo): array
{
    //======== Menu ========
    $menu = [];
    foreach ($pdo->query("SELECT id, name, price FROM menu_items WHERE is_active=1 ORDER BY id ASC")->fetchAll() as $row) {
        $menu[] = [
            'id' => 'item-' . (int) $row['id'],
            'name' => $row['name'],
            'price' => (float) $row['price'],
        ];
    }

    //======== Members ========
    $members = [];
    foreach ($pdo->query("SELECT id, name, total_passes, times_used, creation_date FROM members WHERE is_active=1 ORDER BY id ASC")->fetchAll() as $row) {
        $members[] = [
            'id' => 'member_' . (int) $row['id'],
            'name' => $row['name'],
            'totalPasses' => (int) $row['total_passes'],
            'timesUsed' => (int) $row['times_used'],
            'creationDate' => $row['creation_date'],
        ];
    }

    //======== Packages ========
    $packages = [];
    foreach ($pdo->query("SELECT id, name, console_type, duration_minutes, price FROM packages ORDER BY id ASC")->fetchAll() as $row) {
        $packages[] = [
            'id' => 'pkg_' . (int) $row['id'],
            'name' => $row['name'],
            'consoleType' => $row['console_type'],
            'durationMinutes' => (int) $row['duration_minutes'],
            'price' => (float) $row['price'],
        ];
    }

    //======== Active Sessions ========
    $active = [];
    $sql = "SELECT s.*, c.name AS console_name, c.console_type, m.name AS member_name, p.name AS package_name
            FROM sessions s
            INNER JOIN consoles c ON c.id=s.console_id
            LEFT JOIN members m ON m.id=s.member_id
            LEFT JOIN packages p ON p.id=s.package_id
            WHERE s.status IN ('active','paused')
            ORDER BY s.id ASC";
    foreach ($pdo->query($sql)->fetchAll() as $row) {
        $orders = [];
        if (!empty($row['orders_json'])) {
            $decoded = json_decode((string) $row['orders_json'], true);
            if (is_array($decoded)) $orders = $decoded;
        }
        $billing = 'OPEN';
        if ($row['billing_type'] === 'member' && !empty($row['member_name'])) {
            $billing = 'Member Pass: ' . $row['member_name'];
        } elseif (!empty($row['package_name'])) {
            $billing = $row['package_name'];
        }
        $active[(int) $row['console_id']] = [
            'type' => $row['billing_type'] === 'hourly' ? 'open' : 'paket',
            'startTime' => strtotime($row['start_time']) * 1000,
            'endTime' => $row['end_time'] ? strtotime($row['end_time']) * 1000 : null,
            'totalPaketMinutes' => (int) $row['duration_minutes'],
            'totalPaketCost' => (float) $row['rental_cost'],
            'totalPausedDuration' => (int) $row['paused_minutes'] * 60000,
            'notes' => $row['notes'] ?? '',
            'orders' => $orders,
            'billingInfo' => $billing,
            'soundPlayed' => false,
        ];
    }

    //======== Consoles ========
    $consoles = [];
    foreach ($pdo->query("SELECT * FROM consoles WHERE status <> 'offline' ORDER BY sort_order ASC, id ASC")->fetchAll() as $row) {
        $id = (int) $row['id'];
        $consoles[] = [
            'id' => strtolower($row['console_type']) . '-' . $id,
            'name' => $row['name'],
            'type' => $row['console_type'],
            'status' => isset($active[$id]) ? ($row['status'] === 'paused' ? 'paused' : 'in-use') : syncConsoleWebStatus($row['status']),
            'session' => $active[$id] ?? null,
        ];
    }

    //======== History ========
    $itemsByTx = [];
    $itemSql = "SELECT ti.*, ti.transaction_id AS tx_id FROM transaction_items ti ORDER BY ti.id ASC";
    foreach ($pdo->query($itemSql)->fetchAll() as $row) {
        $itemsByTx[(int) $row['tx_id']][] = [
            'id' => $row['menu_item_id'] ? 'item-' . (int) $row['menu_item_id'] : null,
            'name' => $row['item_name'],
            'price' => (float) $row['unit_price'],
            'quantity' => (int) $row['quantity'],
        ];
    }

    $history = [];
    $historySql = "SELECT t.*, s.start_time AS session_start, s.end_time AS session_end, s.duration_minutes AS session_duration,
                          c.name AS console_name, m.name AS member_name
                   FROM transactions t
                   LEFT JOIN sessions s ON s.id=t.session_id
                   LEFT JOIN consoles c ON c.id=s.console_id
                   LEFT JOIN members m ON m.id=t.member_id
                   ORDER BY t.transaction_date ASC, t.id ASC";
    foreach ($pdo->query($historySql)->fetchAll() as $row) {
        $type = $row['transaction_type'];
        if ($type === 'direct_sale') {
            $consoleName = 'Penjualan Langsung';
            $billingInfo = 'Penjualan Langsung';
        } elseif ($type === 'member_registration') {
            $consoleName = 'Pendaftaran Member';
            $billingInfo = 'Play Pass - ' . ($row['member_name'] ?? '');
        } elseif ($type === 'member_renewal') {
            $consoleName = 'Perpanjangan Member';
            $billingInfo = 'Perpanjangan Pass - ' . ($row['member_name'] ?? '');
        } else {
            $consoleName = $row['console_name'] ?? 'Konsol';
            $billingInfo = !empty($row['member_name']) ? 'Member Pass: ' . $row['member_name'] : 'OPEN';
        }

        $startSource = $row['session_start'] ?: $row['transaction_date'];
        $endSource = $row['session_end'] ?: $row['transaction_date'];
        $orders = $itemsByTx[(int) $row['id']] ?? [];
        $history[] = [
            'date' => date('Y-m-d', strtotime($row['transaction_date'])),
            'consoleName' => $consoleName,
            'startTime' => date('H:i:s', strtotime($startSource)),
            'endTime' => date('H:i:s', strtotime($endSource)),
            'durationMinutes' => $row['session_duration'] !== null ? (int) $row['session_duration'] : 0,
            'durationSeconds' => $row['session_duration'] !== null ? (int) $row['session_duration'] * 60 : 0,
            'rentalCost' => (float) $row['rental_cost'],
            'orderCost' => (float) $row['order_cost'],
            'totalCost' => (float) $row['total_cost'],
            'orders' => $orders,
            'billingInfo' => $billingInfo,
            'notes' => $row['notes'] ?? '',
            'paidAmount' => (float) $row['paid_amount'],
            'changeAmount' => (float) $row['change_amount'],
        ];
    }

    return [
        'success' => true,
        'data' => [
            'consoles' => $consoles,
            'members' => $members,
            'customPackages' => $packages,
            'menuItems' => $menu,
            'history' => $history,
        ],
    ];
}

function syncMasters(PDO $pdo, array $data): void
{
    //======== Members ========
    if (array_key_exists('members', $data) && is_array($data['members'])) {
        $upsert = $pdo->prepare("INSERT INTO members (name,total_passes,times_used,creation_date,is_active)
            VALUES (?,?,?,?,1)
            ON DUPLICATE KEY UPDATE total_passes=VALUES(total_passes), times_used=VALUES(times_used), creation_date=VALUES(creation_date), is_active=1, updated_at=CURRENT_TIMESTAMP");
        $incoming = [];
        foreach ($data['members'] as $member) {
            $name = trim((string) ($member['name'] ?? ''));
            if ($name === '') continue;
            $upsert->execute([
                $name,
                max(0, (int) ($member['totalPasses'] ?? 21)),
                max(0, (int) ($member['timesUsed'] ?? 0)),
                syncDate($member['creationDate'] ?? null),
            ]);
            $incoming[$name] = true;
        }
        if (count($incoming) > 0) {
            $rows = $pdo->query("SELECT id,name FROM members WHERE is_active=1")->fetchAll();
            $deactivate = $pdo->prepare("UPDATE members SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?");
            foreach ($rows as $row) {
                if (!isset($incoming[$row['name']])) $deactivate->execute([(int) $row['id']]);
            }
        }
    }

    //======== Packages ========
    if (array_key_exists('customPackages', $data) && is_array($data['customPackages'])) {
        $upsert = $pdo->prepare("INSERT INTO packages (name,console_type,duration_minutes,price)
            VALUES (?,?,?,?)
            ON DUPLICATE KEY UPDATE duration_minutes=VALUES(duration_minutes), price=VALUES(price), updated_at=CURRENT_TIMESTAMP");
        $incoming = [];
        foreach ($data['customPackages'] as $package) {
            $name = trim((string) ($package['name'] ?? ''));
            $type = (string) ($package['consoleType'] ?? 'PS3');
            if ($name === '' || !in_array($type, ['PS3','PS4','PS5'], true)) continue;
            $upsert->execute([
                $name,
                $type,
                max(1, (int) ($package['durationMinutes'] ?? 1)),
                max(0, (float) ($package['price'] ?? 0)),
            ]);
            $incoming[$name . '|' . $type] = true;
        }
        if (count($incoming) > 0) {
            $rows = $pdo->query("SELECT id,name,console_type FROM packages")->fetchAll();
            $delete = $pdo->prepare("DELETE FROM packages WHERE id=?");
            foreach ($rows as $row) {
                if (!isset($incoming[$row['name'] . '|' . $row['console_type']])) $delete->execute([(int) $row['id']]);
            }
        }
    }

    //======== Consoles Master (opsional) ========
    // Tidak dipakai oleh db-sync saat ini agar status billing ditangani session-sync.
    if (array_key_exists('consoles', $data) && is_array($data['consoles'])) {
        $upsert = $pdo->prepare("INSERT INTO consoles (name,console_type,status,hourly_price,tv_size,sort_order)
            VALUES (?,?,?,?,?,?)
            ON DUPLICATE KEY UPDATE console_type=VALUES(console_type), hourly_price=VALUES(hourly_price), tv_size=VALUES(tv_size), sort_order=VALUES(sort_order), updated_at=CURRENT_TIMESTAMP");
        foreach ($data['consoles'] as $index => $console) {
            $name = trim((string) ($console['name'] ?? ''));
            $type = (string) ($console['type'] ?? 'PS3');
            if ($name === '' || !in_array($type, ['PS3','PS4','PS5'], true)) continue;
            $price = $type === 'PS3' ? 5000 : ($type === 'PS4' ? 8000 : 13000);
            $tv = $type === 'PS3' ? '32"' : ($type === 'PS4' ? '43"' : null);
            $upsert->execute([$name, $type, syncConsoleDbStatus((string) ($console['status'] ?? 'available')), $price, $tv, $index + 1]);
        }
    }
}

try {
    $pdo = db();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        jsonResponse(fetchSyncState($pdo));
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = syncInput();
        $pdo->beginTransaction();
        try {
            //======== Master sync only ========
            // History dan transaksi TIDAK diproses di sini.
            // Session juga TIDAK pernah dihapus oleh API ini.
            syncMasters($pdo, $data);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        jsonResponse(fetchSyncState($pdo));
    }

    jsonResponse(['success' => false, 'message' => 'Method tidak didukung.'], 405);
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Sinkronisasi database gagal.',
        'error' => $e->getMessage(),
    ], 500);
}
