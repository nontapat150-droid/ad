const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../line/sheets-report.gs'),'utf8'),context);
test('Sheets maps repeated source fields to distinct exact-label columns and escapes formulas',()=>{
 const f=[{label:'Sn ONU',occurrence:1,value:'001'},{label:'Sn ONU',occurrence:2,value:'002'},{label:'หมายเหตุ',occurrence:1,value:'=1+1'}];
 const result=context.reportFieldColumns(['Sn ONU'],f);assert.equal(JSON.stringify(result.headers),JSON.stringify(['Sn ONU','Sn ONU','หมายเหตุ']));assert.equal(JSON.stringify(result.values),JSON.stringify(['001','002',"'=1+1"]));
});

