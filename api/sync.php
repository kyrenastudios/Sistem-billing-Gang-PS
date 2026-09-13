<?php
//======== Database Sync API ========
declare(strict_types=1);

require_once __DIR__ . '/config.php';

date_default_timezone_set('Asia/Jakarta');

function inputData(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }

    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function dtFromMs($ms): ?string
{
    if (!is_numeric($ms)) {
        return null;
    }
    return date('Y-m-d H:i:s', (int) floor(((float) $ms) / 1000));
}

function normalizeTime(?string $time): ?string
{
    if (!$time) {
        return null;
    }
    return str_replace('.', ':', trim($time));
}

function dtFromHistory(?string $date, ?string $time): ?string
{
    if (!$date) {
        return null;
    }
    $time = normalizeTime($time) ?: '00:00:00';
    $ts = strtotime($date . ' ' . $time);
    return $ts === false ? null : date('Y-m-d H:i:s', $ts);
}

function consoleDbStatus(string $status): string
{
    return match ($status) {
        'in-use' => 'playing',
        'paused' => 'paused',
        'maintenance' => 'maintenance',
        'offline' => 'offline',
        default => 'available',
    };
}

function consoleWebStatus(string $status): string
{
    return match ($status) {
        'playing' => 'in-use',
        'paused' => 'paused',
        default => $status === 'offline' ? 'available' : 'available',
    };
}

function transactionType(array $item): string
{
    $name = strtolower((string) ($item['consoleName'] ?? ''));
    if ($name === 'penjualan langsung') return 'direct_sale';
    if ($name === 'pendaftaran member') return 'member_registration';
    if ($name === 'perpanjangan member') return 'member_renewal';
    return 'rental';
}

function memberNameFromHistory(array $item): ?string
{
    $billing = (string) ($item['billingInfo'] ?? '');
    if (str_starts_with($billing, 'Member Pass: ')) {
        return trim(substr($billing, 13));
    }
    if (str_starts_with($billing, 'Play Pass - ')) {
        return trim(substr($billing, 12));
    }
    if (str_starts_with($billing, 'Perpanjangan Pass - ')) {
        return trim(substr($billing, 20));
    }
    return null;
}

function fetchState(PDO $pdo): array
{
    $menu = $pdo->query("SELECT id, name, price FROM menu_items WHERE is_active = 1 ORDER BY id ASC")->fetchAll();
    foreach ($menu as &$item) {
        $item['id'] = 'item-' . $item['id'];
        $item['price'] = (float) $item['price'];
    }
    unset($item);

    $members = $pdo->query("SELECT id, name, total_passes, times_used, creation_date FROM members WHERE is_active = 1 ORDER BY id ASC")->fetchAll();
    foreach ($members as &$member) {
        $member['id'] = 'member_' . $member['id'];
        $member['totalPasses'] = (int) $member['total_passes'];
        $member['timesUsed'] = (int) $member['times_used'];
        $member['creationDate'] = $member['creation_date'];
        unset($member['total_passes'], $member['times_used'], $member['creation_date']);
    }
    unset($member);

    $packages = $pdo->query("SELECT id, name, console_type, duration_minutes, price FROM packages ORDER BY id ASC")->fetchAll();
    foreach ($packages as &$package) {
        $package['id'] = 'pkg_' . $package['id'];
        $package['consoleType'] = $package['console_type'];
        $package['durationMinutes'] = (int) $package['duration_minutes'];
        $package['price'] = (float) $package['price'];
        unset($package['console_type'], $package['duration_minutes']);
    }
    unset($package);

    $sessionRows = $pdo->query("SELECT s.*, c.name AS console_name, c.console_type, m.name AS member_name, p.name AS package_name FROM sessions s INNER JOIN consoles c ON c.id = s.console_id LEFT JOIN members m ON m.id = s.member_id LEFT JOIN packages p ON p.id = s.package_id WHERE s.status IN ('active','paused') ORDER BY s.id ASC")->fetchAll();
    $activeByConsole = [];
    foreach ($sessionRows as $row) {
        $orders = [];
        if (!empty($row['orders_json'])) {
            $decoded = json_decode((string) $row['orders_json'], true);
            if (is_array($decoded)) $orders = $decoded;
        }
        $billingType = $row['billing_type'];
        $type = $billingType === 'hourly' ? 'open' : 'paket';
        $billingInfo = 'OPEN';
        if ($billingType === 'member' && $row['member_name']) {
            $billingInfo = 'Member Pass: ' . $row['member_name'];
        } elseif ($row['package_name']) {
            $billingInfo = $row['package_name'];
        }
        $session = [
            'type' => $type,
            'startTime' => strtotime($row['start_time']) * 1000,
            'endTime' => $row['end_time'] ? strtotime($row['end_time']) * 1000 : null,
            'totalPaketMinutes' => (int) $row['duration_minutes'],
            'totalPaketCost' => (float) $row['rental_cost'],
            'totalPausedDuration' => (int) $row['paused_minutes'] * 60000,
            'notes' => $row['notes'] ?? '',
            'orders' => $orders,
            'billingInfo' => $billingInfo,
            'soundPlayed' => false,
        ];
        $activeByConsole[(int) $row['console_id']] = $session;
    }

    $consoleRows = $pdo->query("SELECT * FROM consoles WHERE status <> 'offline' ORDER BY sort_order ASC, id ASC")->fetchAll();
    $consoles = [];
    foreach ($consoleRows as $row) {
        $id = (int) $row['id'];
        $consoles[] = [
            'id' => strtolower($row['console_type']) . '-' . $id,
            'name' => $row['name'],
            'type' => $row['console_type'],
            'status' => isset($activeByConsole[$id]) ? ($row['status'] === 'paused' ? 'paused' : 'in-use') : consoleWebStatus($row['status']),
            'session' => $activeByConsole[$id] ?? null,
        ];
    }

    $historyRows = $pdo->query("SELECT t.*, s.start_time, s.end_time, s.duration_minutes, c.name AS console_name, m.name AS member_name FROM transactions t LEFT JOIN sessions s ON s.id = t.session_id LEFT JOIN consoles c ON c.id = s.console_id LEFT JOIN members m ON m.id = t.member_id ORDER BY t.transaction_date ASC, t.id ASC")->fetchAll();
    $itemRows = $pdo->query("SELECT ti.*, t.id AS tx_id FROM transaction_items ti INNER JOIN transactions t ON t.id = ti.transaction_id ORDER BY ti.id ASC")->fetchAll();
    $itemsByTx = [];
    foreach ($itemRows as $row) {
        $itemsByTx[(int) $row['tx_id']][] = [
            'id' => $row['menu_item_id'] ? 'item-' . $row['menu_item_id'] : null,
            'name' => $row['item_name'],
            'price' => (float) $row['unit_price'],
            'quantity' => (int) $row['quantity'],
        ];
    }

    $history = [];
    foreach ($historyRows as $row) {
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
            $billingInfo = $row['member_name'] ? 'Member Pass: ' . $row['member_name'] : '';
        }
        $start = $row['start_time'] ? date('H:i:s', strtotime($row['start_time'])) : date('H:i:s', strtotime($row['transaction_date']));
        $end = $row['end_time'] ? date('H:i:s', strtotime($row['end_time'])) : date('H:i:s', strtotime($row['transaction_date']));
        $orders = $itemsByTx[(int) $row['id']] ?? [];
        $history[] = [
            'date' => date('Y-m-d', strtotime($row['transaction_date'])),
            'consoleName' => $consoleName,
            'startTime' => $start,
            'endTime' => $end,
            'durationMinutes' => $row['duration_minutes'] !== null ? (int) $row['duration_minutes'] : 0,
            'durationSeconds' => $row['duration_minutes'] !== null ? (int) $row['duration_minutes'] * 60 : 0,
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

function syncState(PDO $pdo, array $data): void
{
    //======== Pastikan penyimpanan order aktif tersedia ========
    try {
        $pdo->exec("ALTER TABLE sessions ADD COLUMN orders_json LONGTEXT NULL");
    } catch (PDOException $e) {
        // Kolom sudah ada, lanjutkan.
    }

    $pdo->beginTransaction();
    try {
        //======== Consoles ========
        if (array_key_exists('consoles', $data) && is_array($data['consoles'])) {
            $incomingNames = [];
            $upsert = $pdo->prepare("INSERT INTO consoles (name, console_type, status, hourly_price, tv_size, sort_order) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE console_type=VALUES(console_type), status=VALUES(status), hourly_price=VALUES(hourly_price), tv_size=VALUES(tv_size), sort_order=VALUES(sort_order), updated_at=CURRENT_TIMESTAMP");
            $find = $pdo->prepare("SELECT id FROM consoles WHERE name = ? LIMIT 1");
            foreach ($data['consoles'] as $index => $console) {
                $name = trim((string) ($console['name'] ?? ''));
                $type = (string) ($console['type'] ?? 'PS3');
                if ($name === '' || !in_array($type, ['PS3','PS4','PS5'], true)) continue;
                $price = $type === 'PS3' ? 5000 : ($type === 'PS4' ? 8000 : 13000);
                $tv = $type === 'PS3' ? '32"' : ($type === 'PS4' ? '43"' : null);
                $upsert->execute([$name, $type, consoleDbStatus((string) ($console['status'] ?? 'available')), $price, $tv, $index + 1]);
                $incomingNames[$name] = true;
            }
            $rows = $pdo->query("SELECT id, name, status FROM consoles")->fetchAll();
            $markOffline = $pdo->prepare("UPDATE consoles SET status='offline', updated_at=CURRENT_TIMESTAMP WHERE id=? AND status NOT IN ('playing','paused')");
            foreach ($rows as $row) {
                if (!isset($incomingNames[$row['name']])) $markOffline->execute([(int) $row['id']]);
            }
        }

        //======== Members ========
        if (array_key_exists('members', $data) && is_array($data['members'])) {
            $incoming = [];
            $upsert = $pdo->prepare("INSERT INTO members (name, total_passes, times_used, creation_date, is_active) VALUES (?, ?, ?, ?, 1) ON DUPLICATE KEY UPDATE total_passes=VALUES(total_passes), times_used=VALUES(times_used), creation_date=VALUES(creation_date), is_active=1, updated_at=CURRENT_TIMESTAMP");
            foreach ($data['members'] as $member) {
                $name = trim((string) ($member['name'] ?? ''));
                if ($name === '') continue;
                $creation = $member['creationDate'] ?? date('Y-m-d H:i:s');
                $upsert->execute([$name, max(0, (int) ($member['totalPasses'] ?? 21)), max(0, (int) ($member['timesUsed'] ?? 0)), $creation]);
                $incoming[$name] = true;
            }
            if ($data['members']) {
                $rows = $pdo->query("SELECT id, name FROM members WHERE is_active=1")->fetchAll();
                $deactivate = $pdo->prepare("UPDATE members SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?");
                foreach ($rows as $row) if (!isset($incoming[$row['name']])) $deactivate->execute([(int) $row['id']]);
            }
        }

        //======== Packages ========
        if (array_key_exists('customPackages', $data) && is_array($data['customPackages'])) {
            $incoming = [];
            $upsert = $pdo->prepare("INSERT INTO packages (name, console_type, duration_minutes, price) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE duration_minutes=VALUES(duration_minutes), price=VALUES(price), updated_at=CURRENT_TIMESTAMP");
            foreach ($data['customPackages'] as $package) {
                $name = trim((string) ($package['name'] ?? ''));
                $type = (string) ($package['consoleType'] ?? 'PS3');
                if ($name === '' || !in_array($type, ['PS3','PS4','PS5'], true)) continue;
                $upsert->execute([$name, $type, max(1, (int) ($package['durationMinutes'] ?? 1)), max(0, (float) ($package['price'] ?? 0))]);
                $incoming[$name . '|' . $type] = true;
            }
            if ($data['customPackages']) {
                $rows = $pdo->query("SELECT id, name, console_type FROM packages")->fetchAll();
                $delete = $pdo->prepare("DELETE FROM packages WHERE id=?");
                foreach ($rows as $row) if (!isset($incoming[$row['name'] . '|' . $row['console_type']])) $delete->execute([(int) $row['id']]);
            }
        }

        //======== Riwayat + Sessions + Transactions ========
        if (array_key_exists('history', $data) && is_array($data['history'])) {
            $pdo->exec("DELETE FROM transaction_items");
            $pdo->exec("DELETE FROM transactions");
            $pdo->exec("DELETE FROM sessions");

            $consoleIds = [];
            foreach ($pdo->query("SELECT id, name FROM consoles")->fetchAll() as $row) $consoleIds[$row['name']] = (int) $row['id'];
            $memberIds = [];
            foreach ($pdo->query("SELECT id, name FROM members")->fetchAll() as $row) $memberIds[$row['name']] = (int) $row['id'];
            $packageIds = [];
            foreach ($pdo->query("SELECT id, name FROM packages")->fetchAll() as $row) $packageIds[$row['name']] = (int) $row['id'];
            $menuIds = [];
            foreach ($pdo->query("SELECT id, name FROM menu_items")->fetchAll() as $row) $menuIds[$row['name']] = (int) $row['id'];

            $insertSession = $pdo->prepare("INSERT INTO sessions (console_id, member_id, package_id, billing_type, status, start_time, end_time, duration_minutes, paused_minutes, rental_cost, notes, orders_json) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)");
            $insertTx = $pdo->prepare("INSERT INTO transactions (transaction_date, transaction_type, session_id, member_id, rental_cost, order_cost, total_cost, paid_amount, change_amount, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?)");
            $insertItem = $pdo->prepare("INSERT INTO transaction_items (transaction_id, menu_item_id, item_name, unit_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)");

            foreach ($data['history'] as $item) {
                $type = transactionType($item);
                $memberName = memberNameFromHistory($item);
                $memberId = $memberName && isset($memberIds[$memberName]) ? $memberIds[$memberName] : null;
                $consoleId = null;
                $sessionId = null;
                $billing = (string) ($item['billingInfo'] ?? '');
                $date = (string) ($item['date'] ?? date('Y-m-d'));
                $start = dtFromHistory($date, $item['startTime'] ?? null) ?? date('Y-m-d H:i:s');
                $end = dtFromHistory($date, $item['endTime'] ?? null) ?? $start;
                $duration = max(0, (int) ($item['durationMinutes'] ?? 0));
                $rental = (float) ($item['rentalCost'] ?? 0);
                $orderCost = (float) ($item['orderCost'] ?? 0);
                $total = (float) ($item['totalCost'] ?? ($rental + $orderCost));
                $paid = (float) ($item['paidAmount'] ?? $total);
                $change = (float) ($item['changeAmount'] ?? max(0, $paid - $total));
                $notes = (string) ($item['notes'] ?? '');

                if ($type === 'rental' && isset($consoleIds[$item['consoleName']])) {
                    $consoleId = $consoleIds[$item['consoleName']];
                    $billingType = $memberId ? 'member' : (strtoupper($billing) === 'OPEN' ? 'hourly' : 'package');
                    $packageId = isset($packageIds[$billing]) ? $packageIds[$billing] : null;
                    $insertSession->execute([$consoleId, $memberId, $packageId, $billingType, $start, $end, $duration, 0, $rental, $notes, json_encode($item['orders'] ?? [], JSON_UNESCAPED_UNICODE)]);
                    $sessionId = (int) $pdo->lastInsertId();
                }

                $transactionDate = dtFromHistory($date, $item['endTime'] ?? $item['startTime'] ?? null) ?? date('Y-m-d H:i:s');
                $insertTx->execute([$transactionDate, $type, $sessionId, $memberId, $rental, $orderCost, $total, $paid, $change, $notes]);
                $transactionId = (int) $pdo->lastInsertId();

                foreach (($item['orders'] ?? []) as $order) {
                    $name = (string) ($order['name'] ?? 'Item');
                    $unit = (float) ($order['price'] ?? 0);
                    $qty = max(1, (int) ($order['quantity'] ?? 1));
                    $menuId = isset($order['id']) && preg_match('/^item-(\d+)$/', (string) $order['id'], $m) ? (int) $m[1] : ($menuIds[$name] ?? null);
                    $insertItem->execute([$transactionId, $menuId, $name, $unit, $qty, $unit * $qty]);
                }
            }
        }

        //======== Sesi aktif dari consoles ========
        if (array_key_exists('consoles', $data) && is_array($data['consoles'])) {
            $consoleIds = [];
            foreach ($pdo->query("SELECT id, name FROM consoles")->fetchAll() as $row) $consoleIds[$row['name']] = (int) $row['id'];
            $memberIds = [];
            foreach ($pdo->query("SELECT id, name FROM members")->fetchAll() as $row) $memberIds[$row['name']] = (int) $row['id'];
            $packageIds = [];
            foreach ($pdo->query("SELECT id, name FROM packages")->fetchAll() as $row) $packageIds[$row['name']] = (int) $row['id'];
            $insertActive = $pdo->prepare("INSERT INTO sessions (console_id, member_id, package_id, billing_type, status, start_time, end_time, duration_minutes, paused_minutes, rental_cost, notes, orders_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
            foreach ($data['consoles'] as $console) {
                $status = (string) ($console['status'] ?? 'available');
                if (!in_array($status, ['in-use','paused'], true) || empty($console['session']) || !isset($consoleIds[$console['name']])) continue;
                $s = $console['session'];
                $billing = (string) ($s['billingInfo'] ?? 'OPEN');
                $memberName = str_starts_with($billing, 'Member Pass: ') ? trim(substr($billing, 13)) : null;
                $memberId = $memberName && isset($memberIds[$memberName]) ? $memberIds[$memberName] : null;
                $packageId = isset($packageIds[$billing]) ? $packageIds[$billing] : null;
                $billingType = $memberId ? 'member' : ($billing === 'OPEN' ? 'hourly' : 'package');
                $start = dtFromMs($s['startTime'] ?? null) ?? date('Y-m-d H:i:s');
                $end = dtFromMs($s['endTime'] ?? null);
                $duration = max(0, (int) ($s['totalPaketMinutes'] ?? 0));
                $paused = max(0, (int) round(((int) ($s['totalPausedDuration'] ?? 0)) / 60000));
                $cost = (float) ($s['totalPaketCost'] ?? 0);
                $orders = json_encode($s['orders'] ?? [], JSON_UNESCAPED_UNICODE);
                $insertActive->execute([$consoleIds[$console['name']], $memberId, $packageId, $billingType, $status === 'paused' ? 'paused' : 'active', $start, $end, $duration, $paused, $cost, (string) ($s['notes'] ?? ''), $orders]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

try {
    $pdo = db();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        jsonResponse(fetchState($pdo));
    }
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = inputData();
        syncState($pdo, $data);
        jsonResponse(fetchState($pdo));
    }
    jsonResponse(['success' => false, 'message' => 'Method tidak didukung.'], 405);
} catch (Throwable $e) {
    jsonResponse([
        'success' => false,
        'message' => 'Sinkronisasi database gagal.',
        'error' => $e->getMessage(),
    ], 500);
}
