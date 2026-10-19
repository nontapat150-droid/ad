'use strict';
const crypto=require('node:crypto');
const {parseText}=require('./parser');
const {tableFor,lockJob,existingUsage}=require('./inventory');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const parse=s=>typeof s==='string'?JSON.parse(s):s;
const fault=(message,status=400)=>Object.assign(new Error(message),{status});
async function transaction(pool,fn){
 for(let attempt=0;;attempt++){
  const conn=await pool.getConnection();
  try{await conn.beginTransaction();const result=await fn(conn);await conn.commit();return result;}
  catch(e){await conn.rollback();if(['ER_LOCK_DEADLOCK','ER_LOCK_WAIT_TIMEOUT'].includes(e.code)&&attempt<2)continue;throw e;}
  finally{conn.release();}
 }
}
async function audit(conn,recordId,actor,action,detail){await conn.query('INSERT INTO line_audit(record_id,actor_id,action,detail_json) VALUES(?,?,?,?)',[recordId||null,actor||null,action,JSON.stringify(detail)]);}
async function enqueue(conn,id,version){await conn.query("INSERT INTO line_sheet_outbox(record_id,version) VALUES(?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),state='pending',attempts=0,next_attempt_at=NULL",[id,version]);}
function createLineService({pool,config={}}){
 async function receive(events){
  if(!Array.isArray(events)||events.length>1000)throw fault('events ไม่ถูกต้อง');
  return transaction(pool,async conn=>{
   const [[mode]]=await conn.query('SELECT auto_enabled FROM line_settings WHERE id=1');
   for(const e of events){
    if(!e||typeof e.webhookEventId!=='string'||e.webhookEventId.length>191)throw fault('event ID ไม่ถูกต้อง');
    // Store only needed event data: never persist reply tokens or credentials.
    const payload={type:e.type,webhookEventId:e.webhookEventId,timestamp:e.timestamp,source:e.source};
    if(e.type==='message'&&e.message?.type==='text')payload.message={id:e.message.id,type:'text',text:e.message.text};
    if(e.type==='unsend')payload.unsend=e.unsend;
    await conn.query("INSERT INTO line_events(event_id,payload,allow_auto) VALUES(?,?,?) ON DUPLICATE KEY UPDATE event_id=event_id",[e.webhookEventId,JSON.stringify(payload),mode?.auto_enabled?1:0]);
   }
  });
 }
 async function createRecords(conn,{text,source='manual',userId=null,actorId=null,event=null,receivedAt=null}){
  const parsed=parseText(text);if(parsed.length>100)throw fault('นำเข้าได้ครั้งละไม่เกิน 100 งาน');
  if(!parsed.length)throw fault('ไม่พบข้อความปิดงาน 4 ประเภทที่รองรับ');
  const out=[];
  for(const p of parsed){
   const group=event?.source?.groupId||event?.source?.roomId||'',lineUser=event?.source?.userId||'';
   if(source==='line'){const [[bind]]=await conn.query('SELECT user_id FROM line_bindings WHERE line_user_id=?',[lineUser]);userId=bind?.user_id||null;}
   const dedupe=hash(JSON.stringify([source,group,lineUser||userId,p.raw]));
   // Identity row is held through commit; locking reads see the newest revision.
   const business=hash(JSON.stringify([group,lineUser||userId,p.type,p.caseNo||p.orderNo||p.srt]));
   await conn.query('INSERT INTO line_identities(business_key) VALUES(?) ON DUPLICATE KEY UPDATE business_key=business_key',[business]);
   const [[old]]=await conn.query('SELECT id,version,status FROM line_records WHERE dedupe_key=? FOR UPDATE',[dedupe]);if(old){out.push({...old,duplicate:true});continue;}
   {
    const [[prior]]=await conn.query("SELECT id FROM line_records WHERE business_key=? AND status NOT IN ('superseded','rejected') ORDER BY id DESC LIMIT 1 FOR UPDATE",[business]);
    const [insert]=await conn.query("INSERT INTO line_records(event_id,message_id,source_id,line_user_id,source,tech_id,type,job_date,case_no,order_no,srt,customer,raw_text,parsed_json,dedupe_key,business_key,status,conflict_with,received_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,COALESCE(?,NOW(6)))",
     [event?.webhookEventId||null,event?.message?.id||null,group,lineUser,source,userId,p.type,p.date||null,p.caseNo,p.orderNo,p.srt,(p.customer||'').slice(0,255),p.raw,JSON.stringify(p),dedupe,business,prior?'conflict':'review',prior?.id||null,receivedAt]);
    await audit(conn,insert.insertId,actorId,'received',{source,techId:userId,conflictWith:prior?.id||null});
    out.push({id:insert.insertId,version:1,status:prior?'conflict':'review'});
   }
  }
  return out;
 }
 async function importText(input){return transaction(pool,c=>createRecords(c,input));}
 async function evaluate(conn,r){
  const p=parse(r.parsed_json),errors=[...p.warnings],checks=[];
  let techId=r.tech_id,group=null;
  if(r.source==='line'){
   const [[binding]]=await conn.query('SELECT user_id FROM line_bindings WHERE line_user_id=?',[r.line_user_id]);techId=binding?.user_id;
   const [[g]]=await conn.query('SELECT * FROM line_groups WHERE source_id=? AND enabled=1',[r.source_id]);group=g;
   if(!g)errors.push('ยังไม่ได้อนุญาตกลุ่มนี้');
  }
  const [[tech]]=await conn.query('SELECT id,team_id,status FROM users WHERE id=?',[techId||0]);
  if(!tech||tech.status!=='active')errors.push('ยังไม่ได้ผูกผู้ส่งกับช่างที่ใช้งานอยู่');
  if(group&&Number(group.team_id)!==Number(tech?.team_id))errors.push('ช่างผู้ส่งไม่อยู่ทีมของกลุ่ม');
  const kind=p.type==='ma'?'ma':'office',t=tableFor(kind);
  const clauses=[],params=[];
  if(p.caseNo){clauses.push(kind==='ma'?'(non_number=? OR access_no=?)':'access_no=?');params.push(p.caseNo);if(kind==='ma')params.push(p.caseNo);}
  if(p.orderNo&&kind==='office'){clauses.push('(order_no=? OR customer_order_no=?)');params.push(p.orderNo,p.orderNo);}
  if(p.srt&&kind==='ma'){clauses.push('srt=?');params.push(p.srt);}
  const [jobs]=clauses.length?await conn.query('SELECT id FROM '+t.job+' WHERE '+clauses.join(' AND ')+' ORDER BY id LIMIT 2',params):[[]];
  let job=null;
  if(jobs.length!==1)errors.push('ไม่พบงานที่ตรงเพียงงานเดียว กรุณาตรวจเลขเคส/Order/SRT');
  else job=await lockJob(conn,kind,jobs[0].id);
  const assignee=kind==='ma'?job?.assigned_user_id:job?.field_engineer_id;
  const teamId=job?.team_id||tech?.team_id||null;
  if(job&&tech&&Number(assignee)!==Number(tech.id)&&(!job.team_id||Number(job.team_id)!==Number(tech.team_id)))errors.push('งานไม่อยู่ในความรับผิดชอบหรือทีมช่าง');
  if(job?.team_id&&tech?.team_id&&Number(job.team_id)!==Number(tech.team_id))errors.push('ทีมของงานไม่ตรงกับทีมช่าง');
  // Lock candidate inventory in deterministic SN order, then validate ALL before writing.
  for(const s of [...p.sns].sort((a,b)=>a.sn.toUpperCase().localeCompare(b.sn.toUpperCase()))){
   const [items]=await conn.query("SELECT ii.*,im.model_name,ip.id AS product_id,ip.name AS product_name,ip.has_sn,u.team_id AS owner_team, (ii.expires_at IS NOT NULL AND ii.expires_at<=NOW()) AS expired FROM inventory_items ii JOIN inventory_models im ON im.id=ii.model_id JOIN inventory_products ip ON ip.id=im.product_id LEFT JOIN users u ON u.id=ii.owner_id WHERE UPPER(TRIM(ii.sn))=? ORDER BY ii.id FOR UPDATE",[s.sn.toUpperCase()]);
   const check={...s,result:'review'};checks.push(check);
   if(items.length!==1){check.reason=items.length?'SN ซ้ำในฐานข้อมูล':'ไม่พบ SN ในระบบ';errors.push(s.sn+': '+check.reason);continue;}
   const item=items[0];check.itemId=item.id;check.ownerId=item.owner_id;check.product=item.product_name;check.model=item.model_name;
   if(!Number(item.has_sn)){check.reason='สินค้าไม่ได้กำหนดเป็นชนิดมี SN';errors.push(check.reason);continue;}
   if(kind==='office'){
    const [roles]=await conn.query('SELECT role FROM line_product_roles WHERE product_id=? AND role=?',[item.product_id,s.role]);
    if(!roles.length){check.reason='ยังไม่ผูกประเภทสินค้ากับช่อง '+s.role;errors.push(s.sn+': '+check.reason);continue;}
   }
   let used=null;
   if(job){try{used=await existingUsage(conn,{kind,jobId:job.id,itemId:item.id,role:s.role});}catch(e){errors.push(e.message);}}
   if(used){check.result='already_used';check.usageId=used.id;continue;}
   const inBag=tech&&(Number(item.owner_id)===Number(tech.id)||(teamId&&(Number(item.team_id)===Number(teamId)||Number(item.owner_team)===Number(teamId))));
   if(item.status!=='dispatched'||Number(item.quantity)!==1||item.expired||!inBag){check.reason='สินค้าไม่พร้อมใช้หรือไม่อยู่กระเป๋าช่าง/ทีมของงาน';errors.push(s.sn+': '+check.reason);continue;}
   check.result='ready';check.item=item;
  }
  return {errors:[...new Set(errors)],checks,techId:tech?.id||null,teamId,kind,job};
 }
 async function finish(conn,r,{actorId=null,confirm=false,reportOnly=false,automatic=false,expectedVersion,inspect=false,acceptConflict=false}={}){
  if(expectedVersion!==undefined&&r.version!==Number(expectedVersion))throw fault('ข้อมูลถูกเปลี่ยนแล้ว กรุณาโหลดใหม่',409);
  if(!inspect&&['applied','report_only','reversed','withdrawn','superseded','rejected'].includes(r.status)){if(automatic)return r;throw fault('รายการนี้ดำเนินการแล้ว',409);}
  let previous=null;
  if(r.status==='conflict'&&!inspect){
   if(!acceptConflict)throw fault('ต้องเลือกรับข้อมูลรุ่นนี้อย่างชัดเจน',409);
   const [[old]]=await conn.query('SELECT * FROM line_records WHERE id=? FOR UPDATE',[r.conflict_with]);previous=old;
   const snKey=x=>parse(x.parsed_json).sns.map(s=>s.role+':'+s.sn.toUpperCase()).sort().join('|');
   if(old&&['applied','withdrawn'].includes(old.status)&&snKey(old)!==snKey(r))throw fault('SN เปลี่ยนหลังตัดแล้ว กรุณาคืนหรือเปลี่ยนอุปกรณ์ผ่านระบบเดิมก่อน',409);
  }
  const v=await evaluate(conn,r);
  const clean=v.checks.map(({item,...check})=>check);
  if(inspect)return {...r,parsed:parse(r.parsed_json),checks:clean,errors:v.errors};
  if(reportOnly){
   await conn.query("UPDATE line_records SET status='report_only',version=version+1,reason='เก็บเฉพาะรายงาน',checks_json=?,updated_at=NOW(6) WHERE id=?",[JSON.stringify(clean),r.id]);
  }else if(v.errors.length||(!confirm&&!automatic)){
   await conn.query("UPDATE line_records SET reason=?,checks_json=?,tech_id=?,team_id=?,job_kind=?,job_id=?,version=version+1,updated_at=NOW(6) WHERE id=?",[v.errors.join('\n')||'รอยืนยันตัดอุปกรณ์',JSON.stringify(clean),v.techId,v.teamId,v.kind,v.job?.id||null,r.id]);
   await audit(conn,r.id,actorId,'review',{errors:v.errors,checks:clean});
   return {...r,status:r.status,version:r.version+1,reason:v.errors.join('\n')||'รอยืนยันตัดอุปกรณ์',checks:clean};
  }else{
   const t=tableFor(v.kind);
   for(const check of v.checks){
    if(check.result==='already_used')continue;
    const item=check.item;
    const [changed]=await conn.query("UPDATE inventory_items SET status='used',quantity=0 WHERE id=? AND status='dispatched' AND quantity=1",[item.id]);if(changed.affectedRows!==1)throw fault('ยอดสินค้าเปลี่ยน กรุณาตรวจใหม่',409);
    const [log]=await conn.query("INSERT INTO inventory_logs(item_id,from_user_id,action,quantity,note) VALUES(?,?,'used',1,?)",[item.id,v.techId,'LINE #'+r.id+' งาน '+(r.case_no||r.order_no||r.srt)]);
    const [usage]=await conn.query('INSERT INTO '+t.table+'('+t.fk+',inventory_item_id,device_role,sn,product_name,model_name,quantity,used_by) VALUES(?,?,?,?,?,?,1,?)',[v.job.id,item.id,v.kind==='ma'?'SN':check.role,item.sn,item.product_name,item.model_name,v.techId]);
    await conn.query('INSERT INTO line_effects(record_id,item_id,job_kind,job_id,usage_id,log_id,owner_id,tech_id,team_id,quantity_before,quantity_after,active_item_id) VALUES(?,?,?,?,?,?,?,?,?,1,0,?)',[r.id,item.id,v.kind,v.job.id,usage.insertId,log.insertId,item.owner_id,v.techId,v.teamId,item.id]);
    check.result='deducted';check.logId=log.insertId;check.usageId=usage.insertId;
   }
   await conn.query("UPDATE line_records SET status='applied',version=version+1,reason=NULL,tech_id=?,team_id=?,job_kind=?,job_id=?,checks_json=?,updated_at=NOW(6) WHERE id=?",[v.techId,v.teamId,v.kind,v.job.id,JSON.stringify(v.checks.map(({item,...check})=>check)),r.id]);
  }
  if(previous){
   await conn.query("UPDATE line_records SET status='superseded',version=version+1,updated_at=NOW(6) WHERE id=?",[previous.id]);
   await audit(conn,previous.id,actorId,'superseded',{accepted:r.id});await enqueue(conn,previous.id,previous.version+1);
  }
  await audit(conn,r.id,actorId,reportOnly?'report_only':automatic?'auto_applied':'confirmed',{techId:v.techId,teamId:v.teamId,jobId:v.job?.id,checks:v.checks.map(({item,...check})=>check)});
  await enqueue(conn,r.id,r.version+1);return {...r,status:reportOnly?'report_only':'applied',version:r.version+1};
 }
 async function process(id,options={}){return transaction(pool,async conn=>{const [[r]]=await conn.query('SELECT * FROM line_records WHERE id=? FOR UPDATE',[id]);if(!r)throw fault('ไม่พบข้อมูล',404);return finish(conn,r,options);});}
 async function processEvent(id){
  return transaction(pool,async conn=>{
   const [[e]]=await conn.query("SELECT * FROM line_events WHERE event_id=? AND state<>'done' FOR UPDATE",[id]);if(!e)return;
   const event=parse(e.payload);
   if(event.type==='message'&&event.message?.type==='text'&&parseText(event.message.text).length){
    const records=await createRecords(conn,{text:event.message.text,source:'line',event,receivedAt:e.received_at});
    for(const rec of records){
     if(rec.duplicate)continue;
     const [[r]]=await conn.query('SELECT * FROM line_records WHERE id=? FOR UPDATE',[rec.id]);
     const [[eligible]]=await conn.query("SELECT b.user_id FROM line_bindings b JOIN line_groups g ON g.source_id=? AND g.enabled=1 WHERE b.line_user_id=? AND b.updated_at<=? AND g.updated_at<=?",[r.source_id,r.line_user_id,e.received_at,e.received_at]);
     if(e.allow_auto&&eligible&&r.status!=='conflict')await finish(conn,r,{automatic:true});
    }
   }else if(event.type==='unsend'){
    const [rows]=await conn.query("SELECT * FROM line_records WHERE message_id=? AND source_id=? FOR UPDATE",[event.unsend?.messageId||'',event.source?.groupId||event.source?.roomId||'']);
    for(const r of rows){
     await conn.query("UPDATE line_records SET status='withdrawn',version=version+1,reason='ผู้ส่งถอนข้อความ LINE',updated_at=NOW(6) WHERE id=?",[r.id]);
     await audit(conn,r.id,null,'unsend',{});await enqueue(conn,r.id,r.version+1);
    }
   }
   await conn.query("UPDATE line_events SET state='done',error_code=NULL WHERE event_id=?",[id]);
  });
 }
 async function drain(){
  const [events]=await pool.query("SELECT event_id FROM line_events WHERE state<>'done' AND (next_attempt_at IS NULL OR next_attempt_at<=NOW(6)) ORDER BY received_at LIMIT 50");
  for(const e of events){try{await processEvent(e.event_id);}catch(err){await pool.query("UPDATE line_events SET state='retry',attempts=attempts+1,next_attempt_at=DATE_ADD(NOW(6),INTERVAL 30 SECOND),error_code=? WHERE event_id=?",[String(err.code||'PROCESSING_FAILED').slice(0,100),e.event_id]);}}
 }
 async function revise(id,{text,userId,actorId,expectedVersion}){
  return transaction(pool,async conn=>{
   const [[r]]=await conn.query('SELECT * FROM line_records WHERE id=? FOR UPDATE',[id]);if(!r)throw fault('ไม่พบข้อมูล',404);
   if(r.version!==Number(expectedVersion))throw fault('ข้อมูลถูกเปลี่ยนแล้ว กรุณาโหลดใหม่',409);
   if(['applied','withdrawn','superseded'].includes(r.status))throw fault('แก้ข้อมูลหลังตัดแล้วโดยส่งรุ่นใหม่และตรวจการคืนผ่านระบบเดิม',409);
   if(parseText(text).length!==1)throw fault('แก้ไขได้ครั้งละหนึ่งงาน');
   if(r.raw_text===text&&Number(r.tech_id)===Number(userId))throw fault('ข้อมูลยังเหมือนเดิม');
   await conn.query("UPDATE line_records SET status='superseded',version=version+1,updated_at=NOW(6) WHERE id=?",[id]);
   const records=await createRecords(conn,{text,userId,actorId});await audit(conn,id,actorId,'revised',{next:records.map(r=>r.id)});await enqueue(conn,id,r.version+1);return records;
  });
 }
 return {receive,importText,process,drain,revise,preview:parseText,transaction:fn=>transaction(pool,fn),audit,enqueue};
}
module.exports={createLineService,transaction,audit,enqueue,fault,parse};

