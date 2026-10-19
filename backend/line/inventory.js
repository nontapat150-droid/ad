'use strict';
function tableFor(kind){if(kind==='ma')return {table:'ma_job_used_inventory',fk:'ma_job_id',job:'ma_jobs'};if(kind==='office')return {table:'job_used_inventory',fk:'job_id',job:'jobs'};throw new Error('ประเภทงานไม่ถูกต้อง');}
async function lockJob(conn,kind,id){const t=tableFor(kind);const [[job]]=await conn.query('SELECT * FROM '+t.job+' WHERE id=? FOR UPDATE',[id]);return job;}
async function existingUsage(conn,{kind,jobId,itemId,role}){
 const t=tableFor(kind);const [rows]=await conn.query('SELECT * FROM '+t.table+' WHERE '+t.fk+'=? AND inventory_item_id=?',[jobId,itemId]);
 if(rows.length>1)throw new Error('มีประวัติใช้อุปกรณ์ซ้ำ กรุณาตรวจสอบก่อน');
 const use=rows[0];if(!use)return null;
 if(role&&kind==='office'&&use.device_role!==role)throw new Error('อุปกรณ์เคยใช้กับงานนี้ในบทบาทอื่น');
 const [[item]]=await conn.query("SELECT id,status,quantity FROM inventory_items WHERE id=? FOR UPDATE",[itemId]);
 if(!item||item.status!=='used'||Number(item.quantity)!==0)throw new Error('ประวัติใช้สินค้าไม่ตรงกับยอดในกระเป๋า กรุณาตรวจสอบ');
 return use;
}
async function invalidateEffects(conn,kind,jobId,actorId){
 try{
  const [rows]=await conn.query("SELECT id,version FROM line_records WHERE job_kind=? AND job_id=? AND status IN ('applied','withdrawn') FOR UPDATE",[kind,jobId]);
  await conn.query('UPDATE line_effects SET active_item_id=NULL WHERE job_kind=? AND job_id=?',[kind,jobId]);
  for(const r of rows){
   await conn.query("UPDATE line_records SET status='reversed',version=version+1,reason='คืนอุปกรณ์ผ่านการแก้จบงานเดิม',updated_at=NOW(6) WHERE id=?",[r.id]);
   await conn.query("INSERT INTO line_audit(record_id,actor_id,action,detail_json) VALUES(?,?,'legacy_return',?)",[r.id,actorId,JSON.stringify({kind,jobId})]);
   await conn.query("INSERT INTO line_sheet_outbox(record_id,version) VALUES(?,?) ON DUPLICATE KEY UPDATE version=VALUES(version),state='pending',attempts=0",[r.id,r.version+1]);
  }
 }catch(err){if(err.code!=='ER_NO_SUCH_TABLE')throw err;}
}
async function reuseSn(conn,options){
 const [[item]]=await conn.query('SELECT p.has_sn FROM inventory_items i JOIN inventory_models m ON m.id=i.model_id JOIN inventory_products p ON p.id=m.product_id WHERE i.id=?',[options.itemId]);
 if(!Number(item?.has_sn))return null;
 return existingUsage(conn,options);
}
module.exports={tableFor,lockJob,existingUsage,reuseSn,invalidateEffects};

