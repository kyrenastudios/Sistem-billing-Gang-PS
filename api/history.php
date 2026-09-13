<?php
//======== History Sync API ========
declare(strict_types=1);
require_once __DIR__ . '/config.php';
date_default_timezone_set('Asia/Jakarta');
$user = requireAuth();

function inputHistory(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '{}', true);
    return is_array($data) ? $data : [];
}

function normalizeTime2(?string $time): ?string
{
    if (!$time) return null;
    return str_replace('.', ':', trim($time));
}

function dtFromHistory2(?string $date, ?string $time): ?string
{
    if (!$date) return null;
    $time = normalizeTime2($time) ?: '00:00:00';
    $ts = strtotime($date . ' ' . $time);
    return $ts === false ? null : date('Y-m-d H:i:s', $ts);
}

function memberNameFromHistory2(array $item): ?string
{
    $billing = (string) ($item['billingInfo'] ?? '');
    if (strpos($billing, 'Member Pass: ') === 0) return trim(substr($billing, 13));
    if (strpos($billing, 'Play Pass - ') === 0) return trim(substr($billing, 12));
    if (strpos($billing, 'Perpanjangan Pass - ') === 0) return trim(substr($billing, 20));
    return null;
}

function transactionType2(array $item): string
{
    $name = strtolower((string) ($item['consoleName'] ?? ''));
    if ($name === 'penjualan langsung') return 'direct_sale';
    if ($name === 'pendaftaran member') return 'member_registration';
    if ($name === 'perpanjangan member') return 'member_renewal';
    return 'rental';
}

try {
    $pdo = db();
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        jsonResponse(['success' => false, 'message' => 'Method tidak didukung.'], 405);
    }

    $data = inputHistory();
    if (!isset($data['history']) || !is_array($data['history'])) {
        jsonResponse(['success' => false, 'message' => 'Data history tidak valid.'], 400);
    }

    //======== Kasir Tidak Boleh Menghapus Riwayat ========
    // Sinkronisasi dengan jumlah transaksi lebih sedikit dianggap sebagai penghapusan.
    if ($user['role'] !== 'admin') {
        $serverCount = (int) $pdo->query("SELECT COUNT(*) FROM transactions")->fetchColumn();
        $clientCount = count($data['history']);
        if ($clientCount < $serverCount) {
            jsonResponse(['success' => false, 'message' => 'Kasir tidak memiliki izin menghapus riwayat penjualan.'], 403);
        }
    }

    $pdo->beginTransaction();
    try {
        $consoleIds = [];
        foreach ($pdo->query("SELECT id, name FROM consoles")->fetchAll() as $row) $consoleIds[$row['name']] = (int) $row['id'];
        $memberIds = [];
        foreach ($pdo->query("SELECT id, name FROM members")->fetchAll() as $row) $memberIds[$row['name']] = (int) $row['id'];
        $packageIds = [];
        foreach ($pdo->query("SELECT id, name FROM packages")->fetchAll() as $row) $packageIds[$row['name']] = (int) $row['id'];
        $menuIds = [];
        foreach ($pdo->query("SELECT id, name FROM menu_items")->fetchAll() as $row) $menuIds[$row['name']] = (int) $row['id'];

        //======== Rebuild Transactions Only ========
        // Session aktif, paused, dan completed TIDAK dihapus.
        $pdo->exec("DELETE FROM transaction_items");
        $pdo->exec("DELETE FROM transactions");

        $findSession = $pdo->prepare("SELECT id FROM sessions WHERE console_id=? AND status='completed' AND start_time=? AND end_time=? AND duration_minutes=? AND rental_cost=? ORDER BY id DESC LIMIT 1");
        $insertSession = $pdo->prepare("INSERT INTO sessions (console_id, member_id, package_id, billing_type, status, start_time, end_time, duration_minutes, paused_minutes, rental_cost, notes, orders_json) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)");
        $updateSession = $pdo->prepare("UPDATE sessions SET member_id=?, package_id=?, billing_type=?, notes=?, orders_json=?, updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $insertTx = $pdo->prepare("INSERT INTO transactions (transaction_date, transaction_type, session_id, member_id, rental_cost, order_cost, total_cost, paid_amount, change_amount, payment_method, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'cash', ?)");
        $insertItem = $pdo->prepare("INSERT INTO transaction_items (transaction_id, menu_item_id, item_name, unit_price, quantity, subtotal) VALUES (?, ?, ?, ?, ?, ?)");

        foreach ($data['history'] as $item) {
            $type = transactionType2($item);
            $memberName = memberNameFromHistory2($item);
            $memberId = $memberName && isset($memberIds[$memberName]) ? $memberIds[$memberName] : null;
            $billing = (string) ($item['billingInfo'] ?? '');
            $date = (string) ($item['date'] ?? date('Y-m-d'));
            $start = dtFromHistory2($date, $item['startTime'] ?? null) ?? date('Y-m-d H:i:s');
            $end = dtFromHistory2($date, $item['endTime'] ?? null) ?? $start;
            $duration = max(0, (int) ($item['durationMinutes'] ?? 0));
            $rental = (float) ($item['rentalCost'] ?? 0);
            $orderCost = (float) ($item['orderCost'] ?? 0);
            $total = (float) ($item['totalCost'] ?? ($rental + $orderCost));
            $paid = (float) ($item['paidAmount'] ?? $total);
            $change = (float) ($item['changeAmount'] ?? max(0, $paid - $total));
            $notes = (string) ($item['notes'] ?? '');
            $sessionId = null;

            if ($type === 'rental' && isset($consoleIds[$item['consoleName']])) {
                $consoleId = $consoleIds[$item['consoleName']];
                $billingType = $memberId ? 'member' : (strtoupper($billing) === 'OPEN' ? 'hourly' : 'package');
                $packageId = isset($packageIds[$billing]) ? $packageIds[$billing] : null;
                $ordersJson = json_encode($item['orders'] ?? [], JSON_UNESCAPED_UNICODE);
                $findSession->execute([$consoleId, $start, $end, $duration, $rental]);
                $sessionId = (int) ($findSession->fetchColumn() ?: 0);
                if ($sessionId) {
                    $updateSession->execute([$memberId, $packageId, $billingType, $notes, $ordersJson, $sessionId]);
                } else {
                    $insertSession->execute([$consoleId, $memberId, $packageId, $billingType, $start, $end, $duration, 0, $rental, $notes, $ordersJson]);
                    $sessionId = (int) $pdo->lastInsertId();
                }
            }

            $transactionDate = dtFromHistory2($date, $item['endTime'] ?? $item['startTime'] ?? null) ?? date('Y-m-d H:i:s');
            $insertTx->execute([$transactionDate, $type, $sessionId, $memberId, $rental, $orderCost, $total, $paid, $change, $notes]);
            $transactionId = (int) $pdo->lastInsertId();

            foreach (($item['orders'] ?? []) as $order) {
                $name = (string) ($order['name'] ?? 'Item');
                $unit = (float) ($order['price'] ?? 0);
                $qty = max(1, (int) ($order['quantity'] ?? 1));
                $menuId = null;
                if (isset($order['id']) && preg_match('/^item-(\d+)$/', (string) $order['id'], $m)) $menuId = (int) $m[1];
                elseif (isset($menuIds[$name])) $menuId = $menuIds[$name];
                $insertItem->execute([$transactionId, $menuId, $name, $unit, $qty, $unit * $qty]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    jsonResponse(['success' => true]);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'message' => 'History gagal disimpan ke MySQL.', 'error' => $e->getMessage()], 500);
}
