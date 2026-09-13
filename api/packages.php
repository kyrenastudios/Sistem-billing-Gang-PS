<?php
//======== Packages API ========
declare(strict_types=1);
require_once __DIR__ . '/config.php';

function readJson(): array { $data = json_decode(file_get_contents('php://input') ?: '{}', true); return is_array($data) ? $data : []; }
function response(array $data, int $status = 200): never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data, JSON_UNESCAPED_UNICODE); exit; }

function fetchPackages(PDO $pdo): array {
    $rows = $pdo->query("SELECT id,name,console_type,duration_minutes,price,notes FROM packages ORDER BY console_type ASC,duration_minutes ASC,id ASC")->fetchAll();
    return array_map(fn($r) => [
        'id' => 'pkg_' . (int)$r['id'],
        'name' => $r['name'],
        'durationMinutes' => (int)$r['duration_minutes'],
        'price' => (int)$r['price'],
        'consoleType' => $r['console_type'],
        'notes' => $r['notes']
    ], $rows);
}

try {
    $pdo = db();
    if ($_SERVER['REQUEST_METHOD'] === 'GET') response(['success'=>true,'data'=>fetchPackages($pdo)]);
    if (!in_array($_SERVER['REQUEST_METHOD'], ['POST','PUT','DELETE'], true)) response(['success'=>false,'message'=>'Method tidak didukung.'],405);

    $data = readJson();
    if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
        $id = preg_replace('/^pkg_/', '', (string)($data['id'] ?? $_GET['id'] ?? ''));
        if (!ctype_digit($id)) response(['success'=>false,'message'=>'ID paket tidak valid.'],400);
        $stmt=$pdo->prepare('DELETE FROM packages WHERE id=?'); $stmt->execute([(int)$id]);
        response(['success'=>true]);
    }

    $name=trim((string)($data['name'] ?? ''));
    $type=strtoupper(trim((string)($data['consoleType'] ?? '')));
    $duration=(int)($data['durationMinutes'] ?? 0);
    $price=(int)($data['price'] ?? 0);
    $notes=$data['notes'] ?? null;
    if ($name==='' || !in_array($type,['PS3','PS4','PS5'],true) || $duration<=0 || $price<0) response(['success'=>false,'message'=>'Data paket tidak valid.'],400);

    $id=preg_replace('/^pkg_/','',(string)($data['id'] ?? ''));
    if ($id !== '' && !ctype_digit($id)) response(['success'=>false,'message'=>'ID paket tidak valid.'],400);

    if ($id !== '') {
        $stmt=$pdo->prepare('UPDATE packages SET name=?,console_type=?,duration_minutes=?,price=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?');
        $stmt->execute([$name,$type,$duration,$price,$notes,(int)$id]);
    } else {
        $stmt=$pdo->prepare('INSERT INTO packages (name,console_type,duration_minutes,price,notes) VALUES (?,?,?,?,?)');
        $stmt->execute([$name,$type,$duration,$price,$notes]);
    }
    response(['success'=>true,'data'=>fetchPackages($pdo)]);
} catch (PDOException $e) {
    if ((int)$e->errorInfo[1] === 1062) response(['success'=>false,'message'=>'Nama paket untuk tipe PS tersebut sudah ada.'],409);
    response(['success'=>false,'message'=>'Database paket gagal diproses.','error'=>$e->getMessage()],500);
} catch (Throwable $e) {
    response(['success'=>false,'message'=>$e->getMessage()],500);
}
