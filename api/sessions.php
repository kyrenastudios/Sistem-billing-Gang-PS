<?php
//======== Active Sessions API ========
declare(strict_types=1);
require_once __DIR__ . '/config.php';
date_default_timezone_set('Asia/Jakarta');

function readJson(): array { $data=json_decode(file_get_contents('php://input') ?: '{}',true); return is_array($data)?$data:[]; }
function response(array $data,int $status=200):never { http_response_code($status); header('Content-Type: application/json; charset=utf-8'); echo json_encode($data,JSON_UNESCAPED_UNICODE); exit; }
function dtMs($value): ?string { return is_numeric($value) ? date('Y-m-d H:i:s',(int)floor((float)$value/1000)) : null; }
function calculateOpenCost(float $hourlyPrice,int $startMs,int $pausedMs): float { $elapsed=max(0,time()*1000-$startMs-$pausedMs); return round(($hourlyPrice/60)*ceil($elapsed/60000)); }

try {
    $pdo=db();
    if($_SERVER['REQUEST_METHOD']!=='POST') response(['success'=>false,'message'=>'Method tidak didukung.'],405);
    $data=readJson();
    if(!isset($data['consoles']) || !is_array($data['consoles'])) response(['success'=>false,'message'=>'Data consoles tidak valid.'],400);

    $pdo->beginTransaction();
    try {
        $findConsole=$pdo->prepare("SELECT id,console_type,hourly_price FROM consoles WHERE name=? LIMIT 1");
        $findMember=$pdo->prepare("SELECT id FROM members WHERE name=? AND is_active=1 LIMIT 1");
        $findPackage=$pdo->prepare("SELECT id FROM packages WHERE name=? LIMIT 1");
        $findActive=$pdo->prepare("SELECT id FROM sessions WHERE console_id=? AND status IN ('active','paused') ORDER BY id DESC LIMIT 1");
        $insert=$pdo->prepare("INSERT INTO sessions (console_id,member_id,package_id,billing_type,status,start_time,end_time,duration_minutes,paused_minutes,rental_cost,notes,orders_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");
        $update=$pdo->prepare("UPDATE sessions SET member_id=?,package_id=?,billing_type=?,status=?,start_time=?,end_time=?,duration_minutes=?,paused_minutes=?,rental_cost=?,notes=?,orders_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=?");
        $complete=$pdo->prepare("UPDATE sessions SET status='completed',end_time=COALESCE(end_time,CURRENT_TIMESTAMP),updated_at=CURRENT_TIMESTAMP WHERE console_id=? AND status IN ('active','paused')");

        $seen=[];
        foreach($data['consoles'] as $console){
            $name=trim((string)($console['name']??''));
            if($name==='') continue;
            $findConsole->execute([$name]); $dbConsole=$findConsole->fetch(); if(!$dbConsole) continue;
            $consoleId=(int)$dbConsole['id']; $status=(string)($console['status']??'available');
            if(!in_array($status,['in-use','paused'],true)) { $complete->execute([$consoleId]); continue; }
            $s=$console['session']??null; if(!is_array($s)) continue;

            $billing=(string)($s['billingInfo']??'OPEN');
            $memberId=null;
            if(str_starts_with($billing,'Member Pass: ')){ $findMember->execute([trim(substr($billing,13))]); $memberId=(int)($findMember->fetchColumn()?:0) ?: null; }
            $packageId=null;
            if($billing!=='OPEN'){ $findPackage->execute([$billing]); $packageId=(int)($findPackage->fetchColumn()?:0) ?: null; }
            $billingType=$memberId?'member':($billing==='OPEN'?'hourly':'package');
            $startMs=(int)($s['startTime']??0); $start=dtMs($startMs) ?: date('Y-m-d H:i:s');
            $end=dtMs($s['endTime']??null);
            $pausedMs=max(0,(int)($s['totalPausedDuration']??0));
            $pausedMinutes=(int)round($pausedMs/60000);
            $duration=(int)($s['totalPaketMinutes']??0);
            $cost=(float)($s['totalPaketCost']??0);
            if($billingType==='hourly') { $duration=max(0,(int)ceil((time()*1000-$startMs-$pausedMs)/60000)); $cost=calculateOpenCost((float)$dbConsole['hourly_price'],$startMs,$pausedMs); }
            $orders=json_encode($s['orders']??[],JSON_UNESCAPED_UNICODE);
            $notes=(string)($s['notes']??'');
            $findActive->execute([$consoleId]); $existingId=(int)($findActive->fetchColumn()?:0);
            if($existingId){ $update->execute([$memberId,$packageId,$billingType,$status==='paused'?'paused':'active',$start,$end,$duration,$pausedMinutes,$cost,$notes,$orders,$existingId]); }
            else { $insert->execute([$consoleId,$memberId,$packageId,$billingType,$status==='paused'?'paused':'active',$start,$end,$duration,$pausedMinutes,$cost,$notes,$orders]); }
            $seen[$consoleId]=true;
        }
        $pdo->commit();
    } catch(Throwable $e){ if($pdo->inTransaction())$pdo->rollBack(); throw $e; }
    response(['success'=>true]);
} catch(Throwable $e) { response(['success'=>false,'message'=>'Sesi gagal disimpan ke MySQL.','error'=>$e->getMessage()],500); }
