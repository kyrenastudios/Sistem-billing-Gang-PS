<?php
//======== History API ========
declare(strict_types=1);
require_once __DIR__ . '/config.php';
date_default_timezone_set('Asia/Jakarta');
$user = requireAuth();

//======== Input ========
function historyInput(): array { $raw=file_get_contents('php://input'); $data=json_decode($raw?:'{}',true); return is_array($data)?$data:[]; }
function historyTime(?string $time): string { $time=trim((string)($time??'00:00:00')); $time=str_replace('.',':',$time); return $time!==''?$time:'00:00:00'; }
function historyDateTime(?string $date,?string $time): string { $date=trim((string)($date??date('Y-m-d'))); $ts=strtotime($date.' '.historyTime($time)); return $ts===false?date('Y-m-d H:i:s'):date('Y-m-d H:i:s',$ts); }
function historyMemberName(array $item): ?string { $billing=(string)($item['billingInfo']??''); if(strpos($billing,'Member Pass: ')===0)return trim(substr($billing,13)); if(strpos($billing,'Play Pass - ')===0)return trim(substr($billing,12)); if(strpos($billing,'Perpanjangan Pass - ')===0)return trim(substr($billing,20)); return null; }
function historyType(array $item): string { $name=strtolower(trim((string)($item['consoleName']??''))); if($name==='penjualan langsung')return'direct_sale'; if($name==='pendaftaran member')return'member_registration'; if($name==='perpanjangan member')return'member_renewal'; return'rental'; }
function historySignature(array $item): string { $orders=[]; foreach(($item['orders']??[]) as $order){$orders[]=['id'=>(string)($order['id']??''),'name'=>(string)($order['name']??''),'price'=>(float)($order['price']??0),'quantity'=>(int)($order['quantity']??1)];} return hash('sha256',json_encode(['date'=>(string)($item['date']??''),'consoleName'=>(string)($item['consoleName']??''),'startTime'=>historyTime($item['startTime']??null),'endTime'=>historyTime($item['endTime']??null),'durationMinutes'=>(int)($item['durationMinutes']??0),'rentalCost'=>(float)($item['rentalCost']??0),'orderCost'=>(float)($item['orderCost']??0),'totalCost'=>(float)($item['totalCost']??0),'billingInfo'=>(string)($item['billingInfo']??''),'notes'=>(string)($item['notes']??''),'orders'=>$orders],JSON_UNESCAPED_UNICODE)); }

//======== Read History ========
function fetchHistory(PDO $pdo): array {
    $itemsByTx=[];
    foreach($pdo->query("SELECT transaction_id,menu_item_id,item_name,unit_price,quantity FROM transaction_items ORDER BY id ASC")->fetchAll() as $row){$itemsByTx[(int)$row['transaction_id']][]=['id'=>$row['menu_item_id']?'item-'.(int)$row['menu_item_id']:null,'name'=>$row['item_name'],'price'=>(float)$row['unit_price'],'quantity'=>(int)$row['quantity']];}
    $sql="SELECT t.*,s.start_time AS session_start,s.end_time AS session_end,s.duration_minutes AS session_duration,c.name AS console_name,m.name AS member_name FROM transactions t LEFT JOIN sessions s ON s.id=t.session_id LEFT JOIN consoles c ON c.id=s.console_id LEFT JOIN members m ON m.id=t.member_id ORDER BY t.transaction_date ASC,t.id ASC";
    $history=[];
    foreach($pdo->query($sql)->fetchAll() as $row){$type=$row['transaction_type']; if($type==='direct_sale'){$consoleName='Penjualan Langsung';$billingInfo='Penjualan Langsung';}elseif($type==='member_registration'){$consoleName='Pendaftaran Member';$billingInfo='Play Pass - '.($row['member_name']??'');}elseif($type==='member_renewal'){$consoleName='Perpanjangan Member';$billingInfo='Perpanjangan Pass - '.($row['member_name']??'');}else{$consoleName=$row['console_name']??'Konsol';$billingInfo=!empty($row['member_name'])?'Member Pass: '.$row['member_name']:'OPEN';}$startSource=$row['session_start']?:$row['transaction_date'];$endSource=$row['session_end']?:$row['transaction_date'];$history[]=['date'=>date('Y-m-d',strtotime($row['transaction_date'])),'consoleName'=>$consoleName,'startTime'=>date('H:i:s',strtotime($startSource)),'endTime'=>date('H:i:s',strtotime($endSource)),'durationMinutes'=>$row['session_duration']!==null?(int)$row['session_duration']:0,'durationSeconds'=>$row['session_duration']!==null?(int)$row['session_duration']*60:0,'rentalCost'=>(float)$row['rental_cost'],'orderCost'=>(float)$row['order_cost'],'totalCost'=>(float)$row['total_cost'],'orders'=>$itemsByTx[(int)$row['id']]??[],'billingInfo'=>$billingInfo,'notes'=>$row['notes']??'','paidAmount'=>(float)$row['paid_amount'],'changeAmount'=>(float)$row['change_amount']];}
    return $history;
}

//======== Save New Transactions Only ========
function saveHistorySnapshot(PDO $pdo,array $history): int {
    $existingSignatures=[]; foreach(fetchHistory($pdo) as $item)$existingSignatures[historySignature($item)]=true;
    $consoleIds=[];foreach($pdo->query("SELECT id,name FROM consoles")->fetchAll() as $row)$consoleIds[$row['name']]=(int)$row['id'];
    $memberIds=[];foreach($pdo->query("SELECT id,name FROM members")->fetchAll() as $row)$memberIds[$row['name']]=(int)$row['id'];
    $packageIds=[];foreach($pdo->query("SELECT id,name FROM packages")->fetchAll() as $row)$packageIds[$row['name']]=(int)$row['id'];
    $menuIds=[];foreach($pdo->query("SELECT id,name FROM menu_items")->fetchAll() as $row)$menuIds[$row['name']]=(int)$row['id'];
    $findSession=$pdo->prepare("SELECT id FROM sessions WHERE console_id=? AND status='completed' AND start_time=? AND end_time=? AND duration_minutes=? AND rental_cost=? ORDER BY id DESC LIMIT 1");
    $insertSession=$pdo->prepare("INSERT INTO sessions (console_id,member_id,package_id,billing_type,status,start_time,end_time,duration_minutes,paused_minutes,rental_cost,notes,orders_json) VALUES (?,?,?,?, 'completed',?,?,?,?,?,?,?)");
    $insertTx=$pdo->prepare("INSERT INTO transactions (transaction_date,transaction_type,session_id,member_id,rental_cost,order_cost,total_cost,paid_amount,change_amount,payment_method,notes) VALUES (?,?,?,?,?,?,?,?,?,'cash',?)");
    $insertItem=$pdo->prepare("INSERT INTO transaction_items (transaction_id,menu_item_id,item_name,unit_price,quantity,subtotal) VALUES (?,?,?,?,?,?)");
    $inserted=0;
    foreach($history as $item){if(!is_array($item))continue;$signature=historySignature($item);if(isset($existingSignatures[$signature]))continue;$type=historyType($item);$memberName=historyMemberName($item);$memberId=$memberName&&isset($memberIds[$memberName])?$memberIds[$memberName]:null;$billing=(string)($item['billingInfo']??'');$date=(string)($item['date']??date('Y-m-d'));$start=historyDateTime($date,$item['startTime']??null);$end=historyDateTime($date,$item['endTime']??null);$duration=max(0,(int)($item['durationMinutes']??0));$rental=(float)($item['rentalCost']??0);$orderCost=(float)($item['orderCost']??0);$total=(float)($item['totalCost']??($rental+$orderCost));$paid=(float)($item['paidAmount']??$total);$change=(float)($item['changeAmount']??max(0,$paid-$total));$notes=(string)($item['notes']??'');$sessionId=null;
        if($type==='rental'&&isset($consoleIds[$item['consoleName']])){$consoleId=$consoleIds[$item['consoleName']];$billingType=$memberId?'member':(strtoupper($billing)==='OPEN'?'hourly':'package');$packageId=isset($packageIds[$billing])?$packageIds[$billing]:null;$ordersJson=json_encode($item['orders']??[],JSON_UNESCAPED_UNICODE);$findSession->execute([$consoleId,$start,$end,$duration,$rental]);$sessionId=(int)($findSession->fetchColumn()?:0);if(!$sessionId){$insertSession->execute([$consoleId,$memberId,$packageId,$billingType,$start,$end,$duration,0,$rental,$notes,$ordersJson]);$sessionId=(int)$pdo->lastInsertId();}}
        $transactionDate=historyDateTime($date,$item['endTime']??$item['startTime']??null);$insertTx->execute([$transactionDate,$type,$sessionId,$memberId,$rental,$orderCost,$total,$paid,$change,$notes]);$transactionId=(int)$pdo->lastInsertId();
        foreach(($item['orders']??[]) as $order){if(!is_array($order))continue;$name=(string)($order['name']??'Item');$unit=(float)($order['price']??0);$qty=max(1,(int)($order['quantity']??1));$menuId=null;if(isset($order['id'])&&preg_match('/^item-(\d+)$/',(string)$order['id'],$m))$menuId=(int)$m[1];elseif(isset($menuIds[$name]))$menuId=$menuIds[$name];$insertItem->execute([$transactionId,$menuId,$name,$unit,$qty,$unit*$qty]);}
        $existingSignatures[$signature]=true;$inserted++;
    }
    return $inserted;
}

//======== Delete One Transaction ========
function deleteHistoryItem(PDO $pdo,array $item): void {
    $signature=historySignature($item);$history=fetchHistory($pdo);$target=null;foreach($history as $row){if(historySignature($row)===$signature){$target=$row;break;}}
    if($target===null)jsonResponse(['success'=>false,'message'=>'Transaksi tidak ditemukan di MySQL.'],404);
    $sql="SELECT t.id,t.session_id FROM transactions t LEFT JOIN sessions s ON s.id=t.session_id LEFT JOIN consoles c ON c.id=s.console_id LEFT JOIN members m ON m.id=t.member_id WHERE t.transaction_date=? AND t.total_cost=? AND t.rental_cost=? AND t.order_cost=? ORDER BY t.id ASC";$stmt=$pdo->prepare($sql);$stmt->execute([historyDateTime($target['date'],$target['endTime']),(float)$target['totalCost'],(float)$target['rentalCost'],(float)$target['orderCost']]);$row=$stmt->fetch();if(!$row)jsonResponse(['success'=>false,'message'=>'Transaksi tidak ditemukan.'],404);$transactionId=(int)$row['id'];$sessionId=$row['session_id']!==null?(int)$row['session_id']:null;
    $pdo->beginTransaction();try{$pdo->prepare("DELETE FROM transaction_items WHERE transaction_id=?")->execute([$transactionId]);$pdo->prepare("DELETE FROM transactions WHERE id=?")->execute([$transactionId]);if($sessionId){$check=$pdo->prepare("SELECT COUNT(*) FROM transactions WHERE session_id=?");$check->execute([$sessionId]);if((int)$check->fetchColumn()===0)$pdo->prepare("DELETE FROM sessions WHERE id=? AND status='completed'")->execute([$sessionId]);}$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}

try{$pdo=db();$method=$_SERVER['REQUEST_METHOD']??'GET';
    if($method==='GET')jsonResponse(['success'=>true,'data'=>fetchHistory($pdo)]);
    if($method==='POST'){requireMaster();$data=historyInput();if(!isset($data['history'])||!is_array($data['history']))jsonResponse(['success'=>false,'message'=>'Data history tidak valid.'],400);$pdo->beginTransaction();try{saveHistorySnapshot($pdo,$data['history']);$pdo->commit();}catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}jsonResponse(['success'=>true,'data'=>fetchHistory($pdo)]);}
    if($method==='DELETE'){requireAdmin();requireMaster();$data=historyInput();if(!isset($data['item'])||!is_array($data['item']))jsonResponse(['success'=>false,'message'=>'Data transaksi tidak valid.'],400);deleteHistoryItem($pdo,$data['item']);jsonResponse(['success'=>true,'data'=>fetchHistory($pdo)]);}
    jsonResponse(['success'=>false,'message'=>'Method tidak didukung.'],405);
}catch(Throwable $e){jsonResponse(['success'=>false,'message'=>'History gagal diproses.','error'=>$e->getMessage()],500);}
