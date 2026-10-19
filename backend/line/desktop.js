'use strict';
const crypto=require('node:crypto');const {fault,parse}=require('./service');
const guid=v=>typeof v==='string'&&/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
function key(b){if(!b||!guid(b.batchId)||!guid(b.itemId)||!Number.isSafeInteger(Number(b.revision))||Number(b.revision)<1||Number(b.revision)>2147483647)throw fault('รหัสชุด รายการ หรือรุ่นไม่ถูกต้อง');return{batchId:b.batchId.toLowerCase(),itemId:b.itemId.toLowerCase(),revision:Number(b.revision)};}
function bounded(v,max,name,required=false){if(typeof v!=='string'||Buffer.byteLength(v,'utf8')>max||(required&&!v.trim()))throw fault(name+' ไม่ถูกต้องหรือยาวเกินกำหนด');return v;}
function payload(b,service){
 const ids=key(b);if(!Number.isSafeInteger(b.technicianId)||b.technicianId<1)throw fault('เลือกช่างที่ใช้งานอยู่');
 const text=bounded(b.text,200000,'ข้อความ',true),s=b.source;if(!s||typeof s!=='object')throw fault('ไม่มีแหล่งที่มา');
 const source={group:bounded(s.group,1000,'ชื่อกลุ่ม',true),author:bounded(s.author,1000,'ชื่อผู้เขียน'),postedText:bounded(s.postedText,1000,'วันที่โพสต์'),capturedAt:bounded(s.capturedAt,64,'เวลาเก็บภาพ',true)};
 if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,7})?(?:Z|[+-]\d\d:\d\d)$/.test(source.capturedAt)||!Number.isFinite(Date.parse(source.capturedAt)))throw fault('เวลาเก็บภาพไม่ถูกต้อง');
 if(!Array.isArray(s.evidenceHashes)||!s.evidenceHashes.length||s.evidenceHashes.length>500||s.evidenceHashes.some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/i.test(h)))throw fault('หลักฐานภาพไม่ครบหรือมากเกินกำหนด');
 source.evidenceHashes=[...new Set(s.evidenceHashes.map(h=>h.toLowerCase()))].sort();source.originalOcr=bounded(s.originalOcr,200000,'OCR เดิม');
 const parsed=service.preview(text);if(parsed.length!==1||parsed[0].raw.trim()!==text.trim())throw fault('นำเข้าได้เฉพาะข้อความงานเดียวครบทั้งโพสต์');
 if(parsed[0].warnings.length)throw fault('กรุณาแก้ข้อความก่อนนำเข้า: '+parsed[0].warnings.join('; '));
 return{...ids,technicianId:b.technicianId,text,source};
}
function mountDesktop(admin,{pool,service,handle}){
 admin.post('/desktop/items',handle(async(req,res)=>{
  const p=payload(req.body,service),hash=crypto.createHash('sha256').update(JSON.stringify(p)).digest('hex');
  const result=await service.transaction(async c=>{
   await c.query('INSERT INTO line_desktop_items(batch_id,item_id,revision,actor_id,payload_hash,metadata_json) VALUES(?,?,?,?,?,?) ON DUPLICATE KEY UPDATE batch_id=batch_id',[p.batchId,p.itemId,p.revision,req.user.id,hash,JSON.stringify(p.source)]);
   const [[old]]=await c.query('SELECT payload_hash,receipt_json FROM line_desktop_items WHERE batch_id=? AND item_id=? AND revision=? FOR UPDATE',[p.batchId,p.itemId,p.revision]);
   if(old.payload_hash!==hash)throw fault('รหัสรายการและรุ่นนี้ถูกใช้กับข้อมูลอื่นแล้ว กรุณาสร้างรุ่นใหม่และส่งออก Excel อีกครั้ง',409);
   if(old.receipt_json)return{...parse(old.receipt_json),duplicate:true};
   const [[u]]=await c.query("SELECT id FROM users WHERE id=? AND status='approved' AND role IN ('technician','ma_technician','contractor_office','contractor_ma') FOR UPDATE",[p.technicianId]);if(!u)throw fault('ไม่พบช่างที่ใช้งานอยู่');
   // This API only creates records. It never invokes process/confirm or inventory writes.
   const records=await service.createRecords(c,{text:p.text,source:'notes_desktop',userId:p.technicianId,actorId:req.user.id});
   const receipt={batchId:p.batchId,itemId:p.itemId,revision:p.revision,records};
   for(const r of records)await service.audit(c,r.id,req.user.id,'desktop_received',{...p,actorId:req.user.id,payloadHash:hash});
   await c.query('UPDATE line_desktop_items SET receipt_json=? WHERE batch_id=? AND item_id=? AND revision=?',[JSON.stringify(receipt),p.batchId,p.itemId,p.revision]);return{...receipt,duplicate:false};
  });res.json(result);
 }));
 admin.get('/desktop/items/:batchId/:itemId/:revision',handle(async(req,res)=>{const p=key(req.params);const [[r]]=await pool.query('SELECT receipt_json FROM line_desktop_items WHERE batch_id=? AND item_id=? AND revision=?',[p.batchId,p.itemId,p.revision]);if(!r?.receipt_json)throw fault('ไม่พบใบรับรายการ',404);res.json({...parse(r.receipt_json),duplicate:true});}));
}
module.exports={mountDesktop};
