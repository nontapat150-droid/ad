import ExcelJS from 'exceljs';

export const lineTypes={install_ais:'ติดตั้ง AIS',install_3bb:'ติดตั้ง 3BB',device_3bb:'เปลี่ยนอุปกรณ์ 3BB',ma:'งาน MA'};
export const lineStatuses={review:'รอตรวจสอบ',applied:'ตัด/ตรวจอุปกรณ์แล้ว',conflict:'ข้อมูลขัดแย้ง',report_only:'เก็บเฉพาะรายงาน',reversed:'คืนผ่านระบบเดิม',withdrawn:'ถอนข้อความแล้ว',superseded:'รุ่นก่อนหน้า',rejected:'ไม่รับข้อมูล'};
function chunks(text,size=30000){
 const str=String(text??'');const out=[];
 for(let start=0;start<str.length;){let end=Math.min(start+size,str.length);if(end<str.length&&/[\uD800-\uDBFF]/.test(str[end-1]))end--;out.push(str.slice(start,end));start=end;}
 return out.length?out:[''];
}
function style(sheet){
 sheet.views=[{state:'frozen',ySplit:1}];sheet.getRow(1).height=32;
 sheet.getRow(1).eachCell(cell=>{cell.font={bold:true,color:{argb:'FFFFFFFF'}};cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF185FA5'}};cell.alignment={vertical:'middle',wrapText:true};});
 if(sheet.columnCount){sheet.autoFilter={from:{row:1,column:1},to:{row:Math.max(1,sheet.rowCount),column:sheet.columnCount}};sheet.columns.forEach(col=>{col.width=26;col.numFmt='@';});}
 sheet.eachRow((row,n)=>{if(n>1)row.eachCell(cell=>{cell.alignment={vertical:'top',wrapText:true};});});
}
export async function createLineWorkbook({records=[],effects=[],raw=[]}={}){
 const wb=new ExcelJS.Workbook();wb.creator='BO ad';wb.created=new Date();
 for(const [type,name]of Object.entries(lineTypes)){
  const sheet=wb.addWorksheet(name),rows=records.filter(r=>r.type===type),headers=[],keys=new Set();
  for(const record of rows)for(const f of record.parsed?.fields||[]){
   const key=JSON.stringify([f.label,f.occurrence]);if(keys.has(key))continue;keys.add(key);headers.push({key,label:f.label});
  }
  if(headers.length>16384)throw new Error('หัวข้อเกินขนาด Excel กรุณาลดช่วงวันที่');
  sheet.addRow(headers.length?headers.map(h=>h.label):['ยังไม่มีข้อมูลประเภทนี้']);
  for(const record of rows){
   const values=new Map((record.parsed?.fields||[]).map(f=>[JSON.stringify([f.label,f.occurrence]),String(f.value??'')]));
   const row=sheet.addRow(headers.map(h=>chunks(values.get(h.key)||'')[0]));
   headers.forEach((h,i)=>{if((values.get(h.key)||'').length>30000)row.getCell(i+1).note='ข้อมูลยาว ดูข้อความทั้งหมดในแผ่นข้อความต้นฉบับ รหัส '+record.id;});
  }style(sheet);
 }
 const summary=wb.addWorksheet('สรุป');
 summary.addRow(['รหัสนำเข้า','ประเภทงาน','วันที่มาตรฐาน','เลขเคส','Order no','SRT','ช่าง','ทีม','สถานะ','เลขงานใน BO','รับข้อมูล','เหตุผล']);
 for(const r of records)summary.addRow([String(r.id),lineTypes[r.type]||r.type,String(r.job_date||r.parsed?.date||'').slice(0,10),r.case_no||'',r.order_no||'',r.srt||'',r.technician||String(r.tech_id||''),String(r.team_id||''),lineStatuses[r.status]||r.status,String(r.job_id||''),String(r.received_at||''),r.reason||'']);style(summary);
 const history=wb.addWorksheet('ประวัติอุปกรณ์');
 history.addRow(['รหัสนำเข้า','รายการคลัง','เลขเคส','ช่างผู้ใช้','เจ้าของกระเป๋า','ทีม','จำนวนก่อน','จำนวนหลัง','อ้างอิงประวัติคลัง','อ้างอิงการใช้งาน','มีผลอยู่','เวลา']);
 for(const e of effects)history.addRow([String(e.record_id),String(e.item_id),e.case_no||'',String(e.tech_id),String(e.owner_id||''),String(e.team_id||''),String(e.quantity_before),String(e.quantity_after),String(e.log_id),String(e.usage_id),e.active_item_id?'ใช่':'คืนแล้ว',String(e.created_at||'')]);style(history);
 const original=wb.addWorksheet('ข้อความต้นฉบับ');original.addRow(['รหัสนำเข้า','ประเภทงาน','สถานะ','ส่วนที่','ข้อความต้นฉบับ','เหตุผล']);
 for(const r of raw)chunks(r.raw_text||r.raw||'').forEach((part,i)=>original.addRow([String(r.id),lineTypes[r.type]||r.type,lineStatuses[r.status]||r.status,String(i+1),part,chunks(r.reason||'')[0]]));
 style(original);original.getColumn(5).width=90;return wb;
}
export async function downloadLineWorkbook(report){
 const wb=await createLineWorkbook(report);const buffer=await wb.xlsx.writeBuffer();
 const blob=new Blob([buffer],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='ข้อมูลปิดงาน-LINE.xlsx';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}

