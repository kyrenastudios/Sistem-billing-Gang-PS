<?php
//======== Database Config ========
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_NAME = 'gang_ps';
const DB_USER = 'root';
const DB_PASS = '';
const DB_CHARSET = 'utf8mb4';

function db(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;

    $pdo = new PDO($dsn, DB_USER, DB_PASS, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    //======== Database Compatibility ========
    // Struktur awal tidak memiliki unique key pada beberapa master data.
    // Key ini diperlukan agar sinkronisasi bersifat UPSERT dan tidak membuat duplikat.
    try { $pdo->exec("ALTER TABLE consoles ADD UNIQUE KEY uq_consoles_name (name)"); } catch (PDOException $e) {}
    try { $pdo->exec("ALTER TABLE members ADD UNIQUE KEY uq_members_name (name)"); } catch (PDOException $e) {}
    try { $pdo->exec("ALTER TABLE packages ADD UNIQUE KEY uq_packages_name_type (name, console_type)"); } catch (PDOException $e) {}
    try { $pdo->exec("ALTER TABLE sessions ADD COLUMN orders_json LONGTEXT NULL"); } catch (PDOException $e) {}

    return $pdo;
}

function jsonResponse(array $data, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
