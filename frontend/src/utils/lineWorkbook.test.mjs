import {test} from 'node:test';import assert from 'node:assert/strict';import {createLineWorkbook} from './lineWorkbook.js';
test('Excel read-back keeps category sheets, exact duplicate labels, blank cells and text IDs',async()=>{
 const fields=[{label:'วันที่ติดตั้ง',value:'18-10-69',occurrence:1},{label:'Sn ONU',value:'000012345678901234',occurrence:1},{label:'Sn ONU',value:'=1+1',occurrence:2},{label:'หมายเหตุ',value:'',occurrence:1}];
 const wb=await createLineWorkbook({records:[{id:1,type:'install_ais',status:'applied',parsed:{fields}}],raw:[{id:1,type:'install_ais',status:'applied',raw_text:'ต้นฉบับ'}],effects:[]});
 const ExcelJS=(await import('exceljs')).default;const read=new ExcelJS.Workbook();await read.xlsx.load(await wb.xlsx.writeBuffer());
 assert.equal(read.worksheets.length,7);const sheet=read.getWorksheet('ติดตั้ง AIS');
 assert.deepEqual(sheet.getRow(1).values.slice(1),['วันที่ติดตั้ง','Sn ONU','Sn ONU','หมายเหตุ']);
 assert.equal(sheet.getCell('B2').value,'000012345678901234');assert.equal(sheet.getCell('C2').value,'=1+1');assert.equal(sheet.getCell('C2').type,3);assert.equal(sheet.getCell('D2').value,'');
});
test('raw text longer than Excel cell limit survives in ordered chunks',async()=>{
 const text='ข้อความ '.repeat(9000);
 const wb=await createLineWorkbook({records:[],effects:[],raw:[{id:7,type:'ma',status:'review',raw_text:text}]});
 const rows=wb.getWorksheet('ข้อความต้นฉบับ');let joined='';rows.eachRow((r,n)=>{if(n>1)joined+=r.getCell(5).value;});assert.equal(joined,text);
});

