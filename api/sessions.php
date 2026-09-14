<?php
//======== Active Sessions API ========
declare(strict_types=1);
require_once __DIR__ . '/config.php';
date_default_timezone_set('Asia/Jakarta');

function readJson(): array { $data=json_decode(file_get_contents('php://input') ?: '{}',true); return is_array($data)?$data:[]; }
function response(array $data,int $status=200):never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data,JSON_UNESCAPED_UNICODE); exit; }
function dtMs($value): ?string { return is_numeric($value) ? date('Y-m-d H:i:s',(int)floor((float)$value/1000)) : null; }
function dbMs($value): ?int { if($value===null||$value==='') return null; $ts=strtotime((string)$value); return $ts===false?null:$ts*1000; }
function calculateOpenCost(float $hourlyPrice,int $startMs,int $pausedMs): float { $elapsed=max(0,time()*1000-$startMs-$pausedMs); return round(($hourlyPrice/60)*ceil($elapsed/60000)); }
function formatDurationMs(int $ms): string { $ms=max(0,$ms); $seconds=(int)floor($ms/1000); $hours=(int)floor($seconds/3600); $minutes=(int)floor(($seconds%3600)/60); $secs=$seconds%60; return sprintf('%02d:%02d:%02d',$hours,$minutes,$secs); }
function sessionForClient(array $row): array {
    $orders=[];
    if(!empty($row['orders_json'])) { $decoded=json_decode((string)$row['orders_json'],true); if(is_array($decoded)) $orders=$decoded; }
    $billing=(string)($row['billing_type']??'hourly');
    $memberName=trim((string)($row['member_name']??''));
    $packageName=trim((string)($row['package_name']??''));
    $billingInfo=$billing==='member'&&$memberName!==''?'Member Pass: '.$memberName:($billing==='hourly'?'OPEN':$packageName);
    $startMs=(int)dbMs($row['start_time']);
    $endMs=dbMs($row['end_time']);
    $pauseMs=dbMs($row['pause_time']);
    $pausedTotal=max(0,(int)$row['paused_minutes'])*60000;
    $frozenElapsed=max(0,($pauseMs??$startMs)-$startMs-$pausedTotal);
    $frozenDisplay=$billing==='hourly'?formatDurationMs($frozenElapsed):formatDurationMs(max(0,($endMs??0)-($pauseMs??0)));
    return [
        'type'=>$billing==='hourly'?'open':'paket',
        'startTime'=>$startMs,
        'endTime'=>$endMs,
        'pauseTime'=>$pauseMs,
        'totalPausedDuration'=>$pausedTotal,
        'frozenTimeDisplay'=>$frozenDisplay,
        'frozenElapsedTime'=>$frozenElapsed,
        'totalPaketMinutes'=>(int)($row['duration_minutes']??0),
        'totalPaketCost'=>(float)($row['rental_cost']??0),
        'soundPlayed'=>false,
        'notes'=>(string)($row['notes']??''),
        'orders'=>$orders,
        'billingInfo'=>$billingInfo
    ];
}

try {
    $pdo=db();
    //======== Pause Timestamp Compatibility ========
    try { $pdo->exec("ALTER TABLE sessions ADD COLUMN pause_time DATETIME NULL"); } catch (PDOException $e) {}

    //======== Read Active Sessions ========
    if($_SERVER['REQUEST_METHOD']==='GET') {
        $sql="SELECT c.id,c.name,c.console_type,c.status AS console_status,c.hourly_price,
                     s.id AS session_id,s.billing_type,s.status AS session_status,s.start_time,s.end_time,
                     s.pause_time,s.duration_minutes,s.paused_minutes,s.rental_cost,s.notes,s.orders_json,
                     m.name AS member_name,p.name AS package_name
              FROM consoles c
              LEFT JOIN sessions s ON s.id=(SELECT s2.id FROM sessions s2 WHERE s2.console_id=c.id AND s2.status IN ('active','paused') ORDER BY s2.id DESC LIMIT 1)
              LEFT JOIN members m ON m.id=s.member_id
              LEFT JOIN packages p ON p.id=s.package_id
              WHERE c.status <> 'offline'
              ORDER BY c.sort_order ASC,c.id ASC";
        $rows=$pdo->query($sql)->fetchAll();
        $data=[];
        foreach($rows as $row){
            $active=!empty($row['session_id']);
            $status=$active?((string)$row['session_status']==='paused'?'paused':'in-use'):'available';
            $data[]=[
                'id'=>strtolower($row['console_type']).'-'.(int)$row['id'],
                'name'=>$row['name'],
                'type'=>$row['console_type'],
                'status'=>$status,
                'session'=>$active?sessionForClient($row):null
            ];
        }
        response(['success'=>true,'data'=>$data]);
    }

    if($_SERVER['REQUEST_METHOD']!=='POST') response(['success'=>false,'message'=>'Method tidak didukung.'],405);
    $data=readJson();
    if(!isset($data['consoles']) || !is_array($data['consoles'])) response(['success'=>false,'message'=>'Data consoles tidak valid.'],400);

    $pdo->beginTransaction();
    try {
        $findConsole=$pdo->prepare("SELECT id,name,console_type,hourly_price FROM consoles WHERE name=? LIMIT 1");
        $findMember=$pdo->prepare("SELECT id FROM members WHERE name=? AND is_active=1 LIMIT 1");
        $findPackage=$pdo->prepare("SELECT id FROM packages WHERE name=? LIMIT 1");
        $findActive=$pdo->prepare("SELECT id FROM sessions WHERE console_id=? AND status IN ('active','paused') ORDER BY id DESC LIMIT 1");
        $insert=$pdo->prepare("INSERT INTO sessions (console_id,member_id,package_id,billing_type,status,start_time,end_time,duration_minutes,paused_minutes,rental_cost,notes,orders_json,pause_time) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
        $update=$pdo->prepare("UPDATE sessions SET member_id=?,package_id=?,billing_type=?,status=?,start_time=?,end_time=?,duration_minutes=?,paused_minutes=?,rental_cost=?,notes=?,orders_json=?,pause_time=?,updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $complete=$pdo->prepare("UPDATE sessions SET status='completed',end_time=COALESCE(end_time,CURRENT_TIMESTAMP),pause_time=NULL,updated_at=CURRENT_TIMESTAMP WHERE console_id=? AND status IN ('active','paused')");
        $setConsoleStatus=$pdo->prepare("UPDATE consoles SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?");

        foreach($data['consoles'] as $console){
            $name=trim((string)($console['name']??''));
            if($name==='') continue;
            $findConsole->execute([$name]); $dbConsole=$findConsole->fetch(); if(!$dbConsole) continue;
            $consoleId=(int)$dbConsole['id'];
            $status=(string)($console['status']??'available');
            if(!in_array($status,['in-use','paused'],true)) {
                $complete->execute([$consoleId]);
                $setConsoleStatus->execute(['available',$consoleId]);
                continue;
            }
            $s=$console['session']??null; if(!is_array($s)) continue;
            $billing=(string)($s['billingInfo']??'OPEN');
            $memberId=null;
            if(strpos($billing,'Member Pass: ')===0){ $findMember->execute([trim(substr($billing,13))]); $memberId=(int)($findMember->fetchColumn()?:0) ?: null; }
            $packageId=null;
            if($billing!=='OPEN' && $memberId===null){ $findPackage->execute([$billing]); $packageId=(int)($findPackage->fetchColumn()?:0) ?: null; }
            $billingType=$memberId?'member':($billing==='OPEN'?'hourly':'package');
            $startMs=(int)($s['startTime']??0); $start=dtMs($startMs) ?: date('Y-m-d H:i:s');
            $end=dtMs($s['endTime']??null);
            $pausedMs=max(0,(int)($s['totalPausedDuration']??0));
            $pausedMinutes=(int)round($pausedMs/60000);
            $pauseTime=dtMs($s['pauseTime']??null);
            $duration=(int)($s['totalPaketMinutes']??0);
            $cost=(float)($s['totalPaketCost']??0);
            if($billingType==='hourly') { $duration=max(0,(int)ceil((time()*1000-$startMs-$pausedMs)/60000)); $cost=calculateOpenCost((float)$dbConsole['hourly_price'],$startMs,$pausedMs); }
            $orders=json_encode($s['orders']??[],JSON_UNESCAPED_UNICODE);
            $notes=(string)($s['notes']??'');
            $findActive->execute([$consoleId]); $existingId=(int)($findActive->fetchColumn()?:0);
            $dbStatus=$status==='paused'?'paused':'active';
            if($existingId) $update->execute([$memberId,$packageId,$billingType,$dbStatus,$start,$end,$duration,$pausedMinutes,$cost,$notes,$orders,$pauseTime,$existingId]);
            else $insert->execute([$consoleId,$memberId,$packageId,$billingType,$dbStatus,$start,$end,$duration,$pausedMinutes,$cost,$notes,$orders,$pauseTime]);
            $setConsoleStatus->execute([$status==='paused'?'paused':'playing',$consoleId]);
        }
        $pdo->commit();
    } catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); throw $e; }

    //======== Return Server Truth After Write ========
    $sql="SELECT c.id,c.name,c.console_type,c.status AS console_status,c.hourly_price,
                 s.id AS session_id,s.billing_type,s.status AS session_status,s.start_time,s.end_time,
                 s.pause_time,s.duration_minutes,s.paused_minutes,s.rental_cost,s.notes,s.orders_json,
                 m.name AS member_name,p.name AS package_name
          FROM consoles c
          LEFT JOIN sessions s ON s.id=(SELECT s2.id FROM sessions s2 WHERE s2.console_id=c.id AND s2.status IN ('active','paused') ORDER BY s2.id DESC LIMIT 1)
          LEFT JOIN members m ON m.id=s.member_id
          LEFT JOIN packages p ON p.id=s.package_id
          WHERE c.status <> 'offline'
          ORDER BY c.sort_order ASC,c.id ASC";
    $rows=$pdo->query($sql)->fetchAll(); $result=[];
    foreach($rows as $row){
        $active=!empty($row['session_id']);
        $result[]=['id'=>strtolower($row['console_type']).'-'.(int)$row['id'],'name'=>$row['name'],'type'=>$row['console_type'],'status'=>$active?((string)$row['session_status']==='paused'?'paused':'in-use'):'available','session'=>$active?sessionForClient($row):null];
    }
    response(['success'=>true,'data'=>$result]);
} catch(Throwable $e) { response(['success'=>false,'message'=>'Sesi gagal diproses di MySQL.','error'=>$e->getMessage()],500); }
