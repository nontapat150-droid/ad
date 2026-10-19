const {test}=require('node:test'); const assert=require('node:assert/strict');
const {parseText,dateISO}=require('../line/parser');
test('overlong references remain complete in source fields and are quarantined',()=>{const v='8'.repeat(101);const [r]=parseText('#ปิดงานติดตั้งais\nวันที่ติดตั้ง :18/10/69\nปิดเคสงาน :'+v);assert.equal(r.caseNo,'');assert.equal(r.fields[1].value,v);assert.ok(r.warnings.some(w=>w.includes('ยาวเกิน')));});
const sample=(tag='#ปิดงานติดตั้งais')=>`${tag}\nวันที่ติดตั้ง : 18/10/69\nปิดเคสงาน : 008801\nOrder no : P0001\nชื่อ-สกุล : ลูกค้าทดสอบ\nSn ONU : : ABC001\nSn Mesh เช่า:\nหมายเหตุ : ทดสอบ\nบรรทัดต่อ\nหัวข้อใหม่ : =1+1`;
test('4 types keep Thai dates, all source labels, blanks, unknowns and continuation',()=>{
 for(const [tag,type] of [['#ปิดงานติดตั้งais','install_ais'],['#ปิดงานติดตั้ง3bb','install_3bb'],['#ปิดงานเปลี่ยนอุปกรณ์3bb','device_3bb'],['#งานMA','ma']]){
 const [r]=parseText(sample(tag));assert.equal(r.type,type);assert.equal(r.date,'2026-10-18');assert.equal(r.caseNo,'008801');
 assert.equal(r.fields.find(f=>f.label==='Sn Mesh เช่า').value,'');assert.equal(r.fields.find(f=>f.label==='หมายเหตุ').value,'ทดสอบ\nบรรทัดต่อ');
 assert.equal(r.fields.at(-1).label,'หัวข้อใหม่');assert.equal(r.fields.at(-1).value,'=1+1');assert.deepEqual(r.sns.map(s=>s.sn),['ABC001']);}
});
test('duplicate labels stay ordered and conflicting roles block automatic usage',()=>{
 const [r]=parseText(sample()+'\nSn ONU : ABC002');assert.deepEqual(r.fields.filter(f=>f.label==='Sn ONU').map(f=>f.occurrence),[1,2]);assert.ok(r.warnings.some(w=>w.includes('หลายค่า')));
});
test('MA old SN is never equipment to deduct',()=>{
 const [r]=parseText('#งานMA\nวันที่แก้ไข :18-10-69\nNon :0088\nSRT :000000001\nชื่อลูกค้า ทดสอบ\nSN เก่า : OLD001\nSN ใหม่ : NEW001\nสาเหตุ ไม่มีสัญญาณ');
 assert.equal(r.oldSn,'OLD001');assert.deepEqual(r.sns.map(s=>s.sn),['NEW001']);assert.equal(r.fields.find(f=>f.label==='ชื่อลูกค้า').value,'ทดสอบ');
});
test('quoted LINE TXT does not split timestamp text in a note',()=>{
 const text='09:10\tช่าง ก\t"'+sample()+'\n10:20\tคำในหมายเหตุ\tยังเป็นหมายเหตุ"\n09:12\tช่าง ข\t"'+sample('#ปิดงานติดตั้ง3bb')+'"';
 const r=parseText(text);assert.equal(r.length,2);assert.equal(r[0].sender,'ช่าง ก');assert.ok(r[0].raw.includes('ยังเป็นหมายเหตุ'));assert.equal(r[1].type,'install_3bb');
});
test('dates validate days; no tag and excessive text fail clearly',()=>{assert.equal(dateISO('31/02/69'),'');assert.equal(dateISO('18-10-2569'),'2026-10-18');assert.deepEqual(parseText('hello'),[]);assert.throws(()=>parseText('x'.repeat(1000001)),/1 MB/);});
test('repeated SN same role deduplicates while cross-role use is flagged',()=>{
 const [r]=parseText(sample()+'\nSn ONU : ABC001');assert.equal(r.sns.length,1);
 assert.ok(parseText(sample()+'\nSn Playbox : ABC001')[0].warnings.some(w=>w.includes('บทบาท')));
});

