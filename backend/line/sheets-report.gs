// Deploy as a separate Apps Script Web App; set Script Properties first.
// SPREADSHEET_ID: the user's approved destination; SYNC_SECRET: server-only HMAC key.
function safeReportCell(value) {
 var text=String(value==null?'':value);
 return /^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text)?"'"+text:text;
}
function reportFieldColumns(headers,fields){
 var result=headers.slice(),counts={},keys={};
 result.forEach(function(label,index){counts[label]=(counts[label]||0)+1;keys[JSON.stringify([label,counts[label]])]=index;});
 fields.forEach(function(f){var key=JSON.stringify([f.label,f.occurrence]);if(keys[key]==null){keys[key]=result.length;result.push(f.label);}});
 var values=result.map(function(){return '';});
 fields.forEach(function(f){values[keys[JSON.stringify([f.label,f.occurrence])]]=safeReportCell(String(f.value||'').slice(0,40000));});
 return {headers:result,values:values};
}
function reportChunks(text){
 var s=String(text||''),parts=[];for(var i=0;i<s.length;){var end=Math.min(i+40000,s.length);if(end<s.length&&/[\uD800-\uDBFF]/.test(s[end-1]))end--;parts.push(s.slice(i,end));i=end;}return parts.length?parts:[''];
}
function reportSheet(book,name,headers){
 var sheet=book.getSheetByName(name)||book.insertSheet(name);
 if(sheet.getLastRow()===0&&headers.length)sheet.getRange(1,1,1,headers.length).setNumberFormat('@').setValues([headers.map(safeReportCell)]);
 sheet.setFrozenRows(1);return sheet;
}
function reportWriteRow(sheet,row,values){if(values.length)sheet.getRange(row,1,1,values.length).setNumberFormat('@').setValues([values.map(safeReportCell)]);}
function reportKeyedRow(sheet,key,values){
 var last=sheet.getLastRow(),found=last>1?sheet.getRange(2,1,last-1,1).getDisplayValues().findIndex(function(r){return r[0]===String(key);}):-1;
 reportWriteRow(sheet,found<0?last+1:found+2,values);
}
function doPost(e){
 var reply=function(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);};
 try{
  var envelope=JSON.parse(e.postData.contents),properties=PropertiesService.getScriptProperties(),secret=properties.getProperty('SYNC_SECRET'),id=properties.getProperty('SPREADSHEET_ID');
  if(!secret||!id)throw new Error('NOT_CONFIGURED');
  if(!Number.isFinite(Number(envelope.timestamp))||Math.abs(Date.now()-Number(envelope.timestamp))>300000||typeof envelope.nonce!=='string')throw new Error('EXPIRED');
  var signature=Utilities.base64Encode(Utilities.computeHmacSha256Signature(envelope.timestamp+'\n'+envelope.nonce+'\n'+envelope.payload,secret));
  var supplied=String(envelope.signature||''),different=signature.length^supplied.length;
  for(var k=0;k<signature.length;k++)different|=signature.charCodeAt(k)^(supplied.charCodeAt(k)||0);
  if(different)throw new Error('BAD_SIGNATURE');
  var payload=JSON.parse(envelope.payload);if(payload.spreadsheetId!==id)throw new Error('WRONG_DESTINATION');
  var r=payload.record;if(!r||!Number.isSafeInteger(Number(r.id))||!Number.isSafeInteger(Number(r.version)))throw new Error('BAD_RECORD');
  var lock=LockService.getScriptLock();if(!lock.tryLock(10000))throw new Error('BUSY');
  try{
   var book=SpreadsheetApp.openById(id),registry=reportSheet(book,'LINE_ดัชนี',['รหัส','ประเภท','รุ่น','สถานะ','แถว']);
   var data=registry.getLastRow()>1?registry.getRange(2,1,registry.getLastRow()-1,5).getDisplayValues():[];
   var index=data.findIndex(function(row){return row[0]===String(r.id);}),old=index>=0?data[index]:null;
   if(old&&Number(old[2])>=Number(r.version))return reply({ok:true,duplicate:true});
   var names={install_ais:'LINE ติดตั้ง AIS',install_3bb:'LINE ติดตั้ง 3BB',device_3bb:'LINE เปลี่ยนอุปกรณ์ 3BB',ma:'LINE งาน MA'};
   var name=names[r.type];if(!name)throw new Error('BAD_TYPE');
   var sheet=reportSheet(book,name,[]),row=old&&old[1]===r.type?Number(old[4]):Math.max(1,sheet.getLastRow(),data.filter(function(d){return d[1]===r.type;}).reduce(function(max,d){return Math.max(max,Number(d[4])||0);},1))+1;
   if(!old){reportWriteRow(registry,index<0?registry.getLastRow()+1:index+2,[String(r.id),r.type,'-1','pending',String(row)]);}
   if(old&&old[1]!==r.type&&names[old[1]]){var previous=book.getSheetByName(names[old[1]]);if(previous&&Number(old[4])>1)previous.getRange(Number(old[4]),1,1,Math.max(1,previous.getLastColumn())).clearContent();}
   var headers=sheet.getLastColumn()?sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0]:[];
   var columns=reportFieldColumns(headers,r.parsed.fields);
   if(columns.headers.length){reportWriteRow(sheet,1,columns.headers);sheet.getRange(1,1,1,columns.headers.length).setFontWeight('bold').setBackground('#e6f1fb');}
   if(['applied','report_only'].includes(r.status))reportWriteRow(sheet,row,columns.values);
   else if(columns.headers.length)sheet.getRange(row,1,1,columns.headers.length).clearContent();
   var originals=reportSheet(book,'LINE_ข้อความต้นฉบับ',['คีย์','รหัส','รุ่น','ประเภท','สถานะ','ส่วน','ข้อความ']);
   reportChunks(r.raw_text).forEach(function(part,i){var key=r.id+':'+r.version+':'+i;reportKeyedRow(originals,key,[key,String(r.id),String(r.version),r.type,r.status,String(i+1),part]);});
   var summary=reportSheet(book,'LINE_สรุป',['รหัส','ประเภท','วันที่งาน','เลขเคส','Order','SRT','ช่าง','ทีม','สถานะ','รุ่น']);
   reportKeyedRow(summary,String(r.id),[String(r.id),r.type,r.parsed.date||'',r.case_no||'',r.order_no||'',r.srt||'',String(r.tech_id||''),String(r.team_id||''),r.status,String(r.version)]);
   var history=reportSheet(book,'LINE_ประวัติอุปกรณ์',['คีย์','รหัสนำเข้า','รายการคลัง','ช่าง','เจ้าของกระเป๋า','ทีม','ก่อน','หลัง','อ้างอิงคลัง','มีผลอยู่']);
   (payload.effects||[]).forEach(function(effect){reportKeyedRow(history,String(effect.id),[String(effect.id),String(effect.record_id),String(effect.item_id),String(effect.tech_id),String(effect.owner_id||''),String(effect.team_id||''),String(effect.quantity_before),String(effect.quantity_after),String(effect.log_id),effect.active_item_id?'ใช่':'คืนแล้ว']);});
   reportKeyedRow(registry,String(r.id),[String(r.id),r.type,String(r.version),r.status,String(row)]);
   SpreadsheetApp.flush();return reply({ok:true,version:r.version});
  }finally{lock.releaseLock();}
 }catch(err){return reply({ok:false,code:['NOT_CONFIGURED','EXPIRED','BAD_SIGNATURE','WRONG_DESTINATION','BAD_RECORD','BAD_TYPE','BUSY'].includes(err.message)?err.message:'SYNC_FAILED'});}
}

