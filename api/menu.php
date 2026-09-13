<?php
//======== Menu Items API ========

declare(strict_types=1);

require_once __DIR__ . '/config.php';

header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

try {
    $pdo = db();
    $method = $_SERVER['REQUEST_METHOD'];

    //======== GET: Ambil semua menu ========
    if ($method === 'GET') {
        $stmt = $pdo->query(
            'SELECT id, name, price FROM menu_items WHERE is_active = 1 ORDER BY id ASC'
        );

        $items = [];
        foreach ($stmt->fetchAll() as $row) {
            $items[] = [
                'id' => 'item-' . $row['id'],
                'name' => $row['name'],
                'price' => (int) $row['price'],
            ];
        }

        jsonResponse([
            'success' => true,
            'data' => $items,
        ]);
    }

    //======== POST: Tambah menu ========
    if ($method === 'POST') {
        $raw = file_get_contents('php://input');
        $input = json_decode($raw, true);

        if (!is_array($input)) {
            jsonResponse(['success' => false, 'message' => 'Data JSON tidak valid.'], 400);
        }

        $name = trim((string) ($input['name'] ?? ''));
        $price = filter_var($input['price'] ?? null, FILTER_VALIDATE_INT);

        if ($name === '') {
            jsonResponse(['success' => false, 'message' => 'Nama menu wajib diisi.'], 422);
        }

        if ($price === false || $price < 0) {
            jsonResponse(['success' => false, 'message' => 'Harga menu tidak valid.'], 422);
        }

        $check = $pdo->prepare(
            'SELECT id FROM menu_items WHERE name = :name LIMIT 1'
        );
        $check->execute(['name' => $name]);

        if ($check->fetch()) {
            jsonResponse(['success' => false, 'message' => 'Menu dengan nama tersebut sudah ada.'], 409);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO menu_items (name, price, is_active) VALUES (:name, :price, 1)'
        );
        $stmt->execute([
            'name' => $name,
            'price' => $price,
        ]);

        $id = (int) $pdo->lastInsertId();

        jsonResponse([
            'success' => true,
            'message' => 'Menu berhasil ditambahkan.',
            'data' => [
                'id' => 'item-' . $id,
                'name' => $name,
                'price' => $price,
            ],
        ], 201);
    }

    //======== DELETE: Hapus menu ========
    if ($method === 'DELETE') {
        $id = trim((string) ($_GET['id'] ?? ''));
        $id = preg_replace('/^item-/', '', $id);

        if (!ctype_digit($id) || (int) $id <= 0) {
            jsonResponse(['success' => false, 'message' => 'ID menu tidak valid.'], 400);
        }

        $stmt = $pdo->prepare(
            'UPDATE menu_items SET is_active = 0 WHERE id = :id AND is_active = 1'
        );
        $stmt->execute(['id' => (int) $id]);

        if ($stmt->rowCount() === 0) {
            jsonResponse(['success' => false, 'message' => 'Menu tidak ditemukan.'], 404);
        }

        jsonResponse([
            'success' => true,
            'message' => 'Menu berhasil dihapus.',
        ]);
    }

    jsonResponse(['success' => false, 'message' => 'Method tidak didukung.'], 405);
} catch (PDOException $e) {
    error_log('Gang PS API menu error: ' . $e->getMessage());
    jsonResponse([
        'success' => false,
        'message' => 'Database tidak dapat diakses. Periksa MySQL/XAMPP dan konfigurasi API.',
    ], 500);
} catch (Throwable $e) {
    error_log('Gang PS API error: ' . $e->getMessage());
    jsonResponse([
        'success' => false,
        'message' => 'Terjadi kesalahan pada server.',
    ], 500);
}
