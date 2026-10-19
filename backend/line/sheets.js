'use strict';
const crypto=require('node:crypto');const {transaction,parse}=require('./service');
function createSheetsSync({pool,config={},fetchImpl=fetch}){
 async function drain(){
  if(!config.sheetsUrl||!config.sheetsSecret)return;
  const url=new URL(config.sheetsUrl);if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!url.pathname.endsWith('/exec'))throw new Error('Sheets endpoint must be a deployed Google Apps Script /exec URL');
  const [rows]=await pool.query("SELECT record_id FROM line_sheet_outbox WHERE state='pending' AND (next_attempt_at IS NULL OR next_attempt_at<=NOW()) ORDER BY record_id LIMIT 20");
  for(const row of rows)await transaction(pool,async c=>{
   const [[out]]=await c.query("SELECT * FROM line_sheet_outbox WHERE record_id=? AND state='pending' FOR UPDATE",[row.record_id]);if(!out)return;
   const [[record]]=await c.query('SELECT * FROM line_records WHERE id=?',[row.record_id]);if(!record)return;
   const [effects]=await c.query('SELECT * FROM line_effects WHERE record_id=? ORDER BY id',[record.id]);
   const payload=JSON.stringify({spreadsheetId:config.spreadsheetId,record:{...record,parsed:parse(record.parsed_json),parsed_json:undefined,checks_json:undefined,dedupe_key:undefined,business_key:undefined,line_user_id:undefined,event_id:undefined},effects});
   const timestamp=Date.now(),nonce=crypto.randomUUID(),signature=crypto.createHmac('sha256',config.sheetsSecret).update(timestamp+'\n'+nonce+'\n'+payload).digest('base64');
   try{
    const response=await fetchImpl(url.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timestamp,nonce,payload,signature}),signal:AbortSignal.timeout(8000),redirect:'follow'});
    if(!response.ok)throw new Error('HTTP_'+response.status);
    const ack=await response.json();if(ack.ok!==true)throw new Error('SYNC_REJECTED');
    await c.query("UPDATE line_sheet_outbox SET state='done',version=?,last_error=NULL WHERE record_id=?",[record.version,record.id]);
   }catch(e){
    const code=/^HTTP_\d+$|^SYNC_REJECTED$/.test(e.message)?e.message:'SYNC_UNAVAILABLE';
    await c.query("UPDATE line_sheet_outbox SET attempts=attempts+1,last_error=?,next_attempt_at=DATE_ADD(NOW(),INTERVAL 60 SECOND) WHERE record_id=?",[code,record.id]);
   }
  });
 }
 return {drain};
}
module.exports={createSheetsSync};

