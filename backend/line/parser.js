'use strict';
const types={install_ais:'ติดตั้ง AIS',install_3bb:'ติดตั้ง 3BB',device_3bb:'เปลี่ยนอุปกรณ์ 3BB',ma:'งาน MA'};
const tags={'ปิดงานติดตั้งais':'install_ais','ปิดงานติดตั้ง3bb':'install_3bb','ปิดงานเปลี่ยนอุปกรณ์3bb':'device_3bb','งานma':'ma'};
const definitions=[
 ['date','วันที่ติดตั้ง|วันที่แก้ไข'],['caseNo','ปิดเคสงาน|non'],['orderNo','order\\s*no'],['orderType','order\\s*type'],
 ['srt','srt'],['customer','ชื่อ\\s*[-–]\\s*สกุล|ชื่อสกุล|ชื่อลูกค้า'],['package','แพ[็กค]*เกจ(?:หลัก)?'],
 ['soa','(?:อุปกรณ[์ร]*\\s*)?ปิด\\s*soa'],['network','โครงข่าย'],['splitter','splitter|spt'],['port','ใช้\\s*port'],
 ['l3','ใช้\\s*#?l3(?:\\s*\\(ชื่อ\\))?'],['maCable','ระยะสายที่ใช้ในงาน\\s*MA(?:\\s*New/MA\\s*Splice)?'],
 ['cableMeters','ระยะสายจริง'],['ref3bb','ref\\s*id\\s*3bb'],['sc','ตัวต่อ\\s*sc(?:สีฟ้า)?'],['fee','ค่าแรกเข้า'],
 ['notes','หมายเหตุ'],['cause','สาเหตุ'],['solution','วิธีแก้ไข'],['usedEquipment','อุปกรณ์ที่ใช้'],
 ['oldSn','sn\\s*เก่า'],['newSn','sn\\s*ใหม่'],
 ['sn:Mesh','sn\\s*mesh\\s*เช่า'],['sn:Cam','sn\\s*ip\\s*camera'],['sn:PB','sn\\s*playbox'],
 ['sn:ONU','sn\\s*onu'],['sn:Mesh','sn\\s*mesh'],['sn:SIM','sn\\s*sim'],
].map(([key,p])=>({key,re:new RegExp('^('+p+')(?=\\s|[:：]|$)\\s*[:：]*\\s*(.*)$','i')}));
function dateISO(value){
 const m=String(value||'').trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);if(!m)return '';
 const d=+m[1],mo=+m[2],y=m[3].length===2?2500+(+m[3])-543:+m[3]>2400?+m[3]-543:+m[3];
 const t=new Date(Date.UTC(y,mo-1,d));return y>=1900&&y<=2200&&t.getUTCFullYear()===y&&t.getUTCMonth()===mo-1&&t.getUTCDate()===d?t.toISOString().slice(0,10):'';
}
function messages(text){
 const lines=String(text).replace(/\r\n?/g,'\n').replace(/^\uFEFF/,'').split('\n');const result=[];let current=null,quoted=false;
 for(const line of lines){
  const m=line.match(/^(?:\d{1,4}[./-]\d{1,2}[./-]\d{1,4}[, ]+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?\t([^\t]*)\t(.*)$/i);
  if(m&&!quoted){if(current)result.push(current);current={sender:m[1],text:m[2]};quoted=m[2].startsWith('"')&&(m[2].match(/"/g)||[]).length%2===1;}
  else {if(!current)current={sender:'',text:''};else current.text+='\n';current.text+=line;if(quoted&&(line.match(/"/g)||[]).length%2===1)quoted=false;}
 }
 if(current)result.push(current);
 return result.map(m=>({...m,text:m.text.startsWith('"')&&m.text.trimEnd().endsWith('"')?m.text.trimEnd().slice(1,-1).replace(/""/g,'"'):m.text}));
}
function parseText(text){
 if(typeof text!=='string')throw new Error('กรุณาระบุข้อความ');
 if(Buffer.byteLength(text,'utf8')>1000000)throw new Error('ข้อความเกิน 1 MB กรุณาแบ่งไฟล์');
 const result=[];
 for(const message of messages(text)){
  const matches=[...message.text.matchAll(/^#(ปิดงานเปลี่ยนอุปกรณ์3bb|ปิดงานติดตั้งais|ปิดงานติดตั้ง3bb|งานma)(?=\s|$)/gim)];
  for(let n=0;n<matches.length;n++){
   const match=matches[n], raw=message.text.slice(match.index,matches[n+1]?.index).trimEnd();
   const r={type:tags[match[1].toLowerCase()],tag:match[0],raw,sender:message.sender,fields:[],sns:[],warnings:[],date:'',caseNo:'',orderNo:'',srt:''};
   const counts={},semantic={},snRoles=new Map();let last=null;
   raw.split('\n').slice(1).forEach((original,index)=>{
    const line=original.trim();if(!line)return;let field=null;
    for(const def of definitions){const m=line.match(def.re);if(m){field={key:def.key,label:m[1].trim(),value:m[2].replace(/^[:：\s]+/,'').trim()};break;}}
    if(!field){const m=line.match(/^([^:：]{1,100})[:：]+\s*(.*)$/);if(m)field={key:'',label:m[1].trim(),value:m[2].trim()};}
    if(!field){if(last)last.value+='\n'+original;else r.warnings.push('มีบรรทัดที่อ่านหัวข้อไม่ได้');return;}
    field.line=index+2;field.occurrence=counts[field.label]=(counts[field.label]||0)+1;r.fields.push(field);last=field;
   });
   for(const f of r.fields){
    if(f.key.startsWith('sn:')||f.key==='newSn'){
     const role=f.key==='newSn'?'SN':f.key.slice(3),sn=f.value.trim();if(!sn||sn==='-')continue;
     if(!/^[a-z0-9][a-z0-9._:/-]*$/i.test(sn)){r.warnings.push('SN ไม่ชัดเจน: '+f.label);continue;}
     const canonical=sn.toUpperCase(),other=snRoles.get(canonical);
     if(other&&other!==role)r.warnings.push('SN เดียวกันใช้หลายบทบาท: '+sn);
     if(r.sns.some(s=>s.role===role&&s.sn.toUpperCase()!==canonical))r.warnings.push('มี '+f.label+' หลายค่า กรุณาตรวจสอบ');
     if(!other){r.sns.push({role,sn,field:f.label,occurrence:f.occurrence});snRoles.set(canonical,role);}
    } else if(f.key){
     const v=f.key==='date'?dateISO(f.value):f.value;
     if(semantic[f.key]&&semantic[f.key]!==v)r.warnings.push('ข้อมูลซ้ำและค่าต่างกัน: '+f.label);
     if(f.key==='date'&&!v)r.warnings.push('อ่านวันที่ไม่ได้: '+f.value);
     if(!semantic[f.key]){semantic[f.key]=v;r[f.key]=v;}
    }
   }
   if(!r.date)r.warnings.push('วันที่งานไม่ถูกต้องหรือไม่ได้ระบุ');
   if(!r.caseNo&&!r.orderNo&&!r.srt)r.warnings.push('ไม่มีเลขเคส Order หรือ SRT');
   r.warnings=[...new Set(r.warnings)];result.push(r);
  }
 }
 return result;
}
module.exports={parseText,dateISO,types};

