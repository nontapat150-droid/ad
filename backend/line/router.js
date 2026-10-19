'use strict';
const express=require('express');const crypto=require('node:crypto');
const {createLineService,fault,parse}=require('./service');const {types,dateISO}=require('./parser');
const positive=v=>Number.isSafeInteger(Number(v))&&Number(v)>0;
const sourceId=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,191}$/.test(v);
function filters(q){
 const where=[],params=[];const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&dateISO(v.slice(8)+'/'+v.slice(5,7)+'/'+v.slice(0,4))===v;
 for(const k of ['from','to','receivedFrom','receivedTo'])if(q[k]&&!day(q[k]))throw fault('วันที่ไม่ถูกต้อง');
 if(q.from&&q.to&&q.from>q.to||q.receivedFrom&&q.receivedTo&&q.receivedFrom>q.receivedTo)throw fault('วันเริ่มต้นต้องไม่เกินวันสิ้นสุด');
 if(q.from){where.push('r.job_date>=?');params.push(q.from);}if(q.to){where.push('r.job_date<=?');params.push(q.to);}
 if(q.receivedFrom){where.push('DATE(r.received_at)>=?');params.push(q.receivedFrom);}if(q.receivedTo){where.push('DATE(r.received_at)<=?');params.push(q.receivedTo);}
 if(q.type){if(!types[q.type])throw fault('ประเภทงานไม่ถูกต้อง');where.push('r.type=?');params.push(q.type);}
 if(q.status){if(!['review','applied','conflict','report_only','reversed','withdrawn','superseded','rejected'].includes(q.status))throw fault('สถานะไม่ถูกต้อง');where.push('r.status=?');params.push(q.status);}
 for(const [k,col]of [['userId','tech_id'],['teamId','team_id']])if(q[k]){if(!positive(q[k]))throw fault('ตัวกรองไม่ถูกต้อง');where.push('r.'+col+'=?');params.push(Number(q[k]));}
 if(q.search){if(typeof q.search!=='string'||q.search.length>200)throw fault('คำค้นยาวเกินไป');where.push('(r.customer LIKE ? OR r.case_no LIKE ? OR r.order_no LIKE ? OR r.srt LIKE ? OR r.raw_text LIKE ?)');for(let i=0;i<5;i++)params.push('%'+q.search+'%');}
 return {sql:where.length?' WHERE '+where.join(' AND '):'',params};
}
function record(r){return {...r,parsed:parse(r.parsed_json),checks:r.checks_json?parse(r.checks_json):[]};}
function createLineRouter({pool,config={},auth}){
 const service=createLineService({pool,config}),webhook=express.Router(),admin=express.Router();
 const handle=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(err){next(err);}};
 webhook.post('/',express.raw({type:'application/json',limit:'2mb'}),handle(async(req,res)=>{
  if(!config.channelSecret)throw fault('ยังไม่ได้ตั้งค่า LINE Channel secret',503);
  const bytes=req.body;if(!Buffer.isBuffer(bytes))throw fault('ต้องส่ง application/json');
  const provided=Buffer.from(req.get('x-line-signature')||'','base64'),expected=crypto.createHmac('sha256',config.channelSecret).update(bytes).digest();
  if(provided.length!==expected.length||!crypto.timingSafeEqual(provided,expected))throw fault('ลายเซ็น LINE ไม่ถูกต้อง',401);
  let body;try{body=JSON.parse(bytes.toString('utf8'));}catch{throw fault('JSON ไม่ถูกต้อง');}
  await service.receive(body.events);res.json({ok:true});
 }));
 admin.use(auth,(req,res,next)=>{if(!(req.user?.roles||[req.user?.role]).some(r=>['admin','super_admin'].includes(r)))return res.status(403).json({error:'เฉพาะผู้ดูแลระบบ'});next();});
 admin.get('/settings',handle(async(_req,res)=>{
  const [[mode]]=await pool.query('SELECT auto_enabled FROM line_settings WHERE id=1');
  const [groups]=await pool.query('SELECT * FROM line_groups ORDER BY source_id');
  const [bindings]=await pool.query('SELECT b.*,u.full_name,u.team_id FROM line_bindings b LEFT JOIN users u ON u.id=b.user_id ORDER BY b.line_user_id');
  const [users]=await pool.query("SELECT id,full_name,team_id,role FROM users WHERE status='active' AND role IN ('technician','ma_technician','contractor_office','contractor_ma') ORDER BY full_name");
  const [products]=await pool.query('SELECT id,name FROM inventory_products WHERE has_sn=1 ORDER BY name');
  const [roles]=await pool.query('SELECT * FROM line_product_roles ORDER BY product_id,role');
  const [discovered]=await pool.query("SELECT DISTINCT source_id,line_user_id FROM line_records WHERE source='line' ORDER BY source_id LIMIT 500");
  const [pending]=await pool.query("SELECT state,COUNT(*) AS total FROM line_events GROUP BY state");
  res.json({autoEnabled:!!mode?.auto_enabled,groups,bindings,users,products,roles,discovered,pending,channelReady:!!config.channelSecret,sheetsReady:!!(config.sheetsUrl&&config.sheetsSecret)});
 }));
 admin.put('/settings',handle(async(req,res)=>{
  if(typeof req.body.autoEnabled!=='boolean')throw fault('กรุณาระบุโหมดการตัด');
  await service.transaction(async c=>{await c.query('UPDATE line_settings SET auto_enabled=? WHERE id=1',[req.body.autoEnabled?1:0]);await service.audit(c,null,req.user.id,'mode_changed',{autoEnabled:req.body.autoEnabled});});res.json({ok:true});
 }));
 admin.put('/groups',handle(async(req,res)=>{
  const {sourceId:id,teamId,enabled}=req.body;if(!sourceId(id)||!positive(teamId)||typeof enabled!=='boolean')throw fault('ระบุกลุ่ม ทีม และสถานะให้ครบ');
  await service.transaction(async c=>{const [[team]]=await c.query('SELECT id FROM users WHERE team_id=? LIMIT 1',[teamId]);if(!team)throw fault('ไม่พบทีมที่มีผู้ใช้งาน');
   const [[before]]=await c.query('SELECT * FROM line_groups WHERE source_id=? FOR UPDATE',[id]);await c.query('INSERT INTO line_groups(source_id,team_id,enabled) VALUES(?,?,?) ON DUPLICATE KEY UPDATE team_id=VALUES(team_id),enabled=VALUES(enabled),updated_at=NOW(6)',[id,teamId,enabled?1:0]);await service.audit(c,null,req.user.id,'group_changed',{before,sourceId:id,teamId,enabled});});res.json({ok:true});
 }));
 admin.put('/bindings',handle(async(req,res)=>{
  const {lineUserId,userId}=req.body;if(!sourceId(lineUserId)||!positive(userId))throw fault('ระบุผู้ส่ง LINE และช่าง');
  await service.transaction(async c=>{const [[u]]=await c.query("SELECT id FROM users WHERE id=? AND status='active' AND role IN ('technician','ma_technician','contractor_office','contractor_ma')",[userId]);if(!u)throw fault('ไม่พบช่างที่ใช้งานอยู่');
   const [[before]]=await c.query('SELECT * FROM line_bindings WHERE line_user_id=? FOR UPDATE',[lineUserId]);
   await c.query('INSERT INTO line_bindings(line_user_id,user_id,updated_by) VALUES(?,?,?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id),updated_by=VALUES(updated_by),updated_at=NOW(6)',[lineUserId,userId,req.user.id]);await service.audit(c,null,req.user.id,'binding_changed',{before,lineUserId,userId});
  });res.json({ok:true});
 }));
 admin.delete('/bindings/:id',handle(async(req,res)=>{await service.transaction(async c=>{const [[before]]=await c.query('SELECT * FROM line_bindings WHERE line_user_id=? FOR UPDATE',[req.params.id]);await c.query('DELETE FROM line_bindings WHERE line_user_id=?',[req.params.id]);await service.audit(c,null,req.user.id,'binding_removed',{before});});res.json({ok:true});}));
 admin.put('/product-roles',handle(async(req,res)=>{
  const {productId,roles}=req.body;if(!positive(productId)||!Array.isArray(roles)||roles.some(r=>!['SOA','ONU','PB','Mesh','SIM','Cam'].includes(r)))throw fault('ประเภทอุปกรณ์ไม่ถูกต้อง');
  await service.transaction(async c=>{const [[p]]=await c.query('SELECT id FROM inventory_products WHERE id=? AND has_sn=1',[productId]);if(!p)throw fault('ไม่พบสินค้าแบบมี SN');
   await c.query('DELETE FROM line_product_roles WHERE product_id=?',[productId]);for(const role of [...new Set(roles)])await c.query('INSERT INTO line_product_roles VALUES(?,?)',[productId,role]);await service.audit(c,null,req.user.id,'product_roles_changed',{productId,roles});});res.json({ok:true});
 }));
 admin.post('/preview',handle(async(req,res)=>res.json({records:service.preview(req.body.text)})));
 admin.post('/import',handle(async(req,res)=>{
  if(!positive(req.body.userId))throw fault('เลือกช่างเจ้าของงานก่อนนำเข้า');
  const [[u]]=await pool.query("SELECT id FROM users WHERE id=? AND status='active' AND role IN ('technician','ma_technician','contractor_office','contractor_ma')",[req.body.userId]);if(!u)throw fault('ไม่พบช่าง');
  res.json({records:await service.importText({text:req.body.text,userId:Number(req.body.userId),actorId:req.user.id})});
 }));
 admin.get('/records',handle(async(req,res)=>{
  const f=filters(req.query);const page=Math.max(1,Number(req.query.page)||1),limit=50;
  if(!Number.isSafeInteger(page)||page>20000)throw fault('หน้าไม่ถูกต้อง');
  const [[{total}]]=await pool.query('SELECT COUNT(*) AS total FROM line_records r'+f.sql,f.params);
  const [rows]=await pool.query('SELECT r.*,u.full_name AS technician FROM line_records r LEFT JOIN users u ON u.id=r.tech_id'+f.sql+' ORDER BY r.id DESC LIMIT ? OFFSET ?',[...f.params,limit,(page-1)*limit]);
  const [summary]=await pool.query('SELECT r.status,COUNT(*) AS total FROM line_records r'+f.sql+' GROUP BY r.status',f.params);
  res.json({records:rows.map(record),total,page,limit,summary});
 }));
 admin.get('/report',handle(async(req,res)=>{
  const f=filters(req.query),where=f.sql?f.sql+' AND ':' WHERE ';
  const accepted=req.query.includeReview==='true'?"r.status NOT IN ('superseded','rejected')":"r.status IN ('applied','report_only')";
  const [rows]=await pool.query('SELECT r.*,u.full_name AS technician FROM line_records r LEFT JOIN users u ON u.id=r.tech_id'+where+accepted+' ORDER BY r.id LIMIT 10001',f.params);
  if(rows.length>10000)throw fault('มีข้อมูลเกิน 10,000 งาน กรุณาลดช่วงวันที่');
  const [raw]=await pool.query('SELECT r.id,r.type,r.status,r.raw_text,r.reason FROM line_records r'+f.sql+' ORDER BY r.id LIMIT 10001',f.params);
  if(raw.length>10000)throw fault('ข้อมูลต้นฉบับเกิน 10,000 งาน กรุณาลดช่วงวันที่');
  const ids=raw.map(r=>r.id);let effects=[];if(ids.length)[effects]=await pool.query('SELECT e.*,r.case_no FROM line_effects e JOIN line_records r ON r.id=e.record_id WHERE e.record_id IN (?) ORDER BY e.id',[ids]);
  res.json({records:rows.map(record),raw,effects});
 }));
 admin.get('/records/:id',handle(async(req,res)=>{
  if(!positive(req.params.id))throw fault('เลขรายการไม่ถูกต้อง');const result=await service.process(req.params.id,{inspect:true});
  const [history]=await pool.query('SELECT * FROM line_audit WHERE record_id=? ORDER BY id',[req.params.id]);res.json({...record(result),...result,history:history.map(h=>({...h,detail:parse(h.detail_json)}))});
 }));
 admin.post('/records/:id/process',handle(async(req,res)=>{
  const {action,version}=req.body;if(!positive(req.params.id)||!positive(version)||!['check','confirm','report_only','accept_revision'].includes(action))throw fault('ระบุคำสั่งและรุ่นข้อมูล');
  res.json(await service.process(req.params.id,{actorId:req.user.id,expectedVersion:Number(version),inspect:action==='check',confirm:['confirm','accept_revision'].includes(action),reportOnly:action==='report_only',acceptConflict:action==='accept_revision'}));
 }));
 admin.patch('/records/:id',handle(async(req,res)=>{
  if(!positive(req.params.id)||!positive(req.body.userId)||!positive(req.body.version))throw fault('ระบุช่างและรุ่นข้อมูล');
  res.json({records:await service.revise(req.params.id,{text:req.body.text,userId:Number(req.body.userId),actorId:req.user.id,expectedVersion:Number(req.body.version)})});
 }));
 admin.get('/history',handle(async(_req,res)=>{const [rows]=await pool.query('SELECT a.*,u.full_name AS actor FROM line_audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 200');res.json(rows.map(h=>({...h,detail:parse(h.detail_json)})));}));
 const errors=(err,_req,res,_next)=>res.status(err.status||(['ER_NO_SUCH_TABLE','ER_BAD_FIELD_ERROR'].includes(err.code)?503:err.code==='ER_DUP_ENTRY'?409:500)).json({error:err.status?err.message:err.code==='ER_DUP_ENTRY'?'บัญชีนี้ผูกไว้แล้ว กรุณาตรวจรายการเดิม':err.code==='ER_NO_SUCH_TABLE'?'ยังไม่ได้ติดตั้งฐานข้อมูล LINE กรุณารัน migration':'บันทึกไม่สำเร็จ กรุณาลองใหม่',code:err.code||undefined});
 webhook.use(errors);admin.use(errors);
 return {webhook,admin,service};
}
module.exports={createLineRouter,filters};

