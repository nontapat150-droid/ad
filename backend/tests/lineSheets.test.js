const {test,before,after,beforeEach}=require('node:test');const assert=require('node:assert/strict');const crypto=require('node:crypto');
const {fixture,text}=require('./lineFixture');const {createLineService}=require('../line/service');const {createSheetsSync}=require('../line/sheets');
let f,s;before(async()=>{f=await fixture();s=createLineService({pool:f.pool});});after(async()=>f&&f.close());beforeEach(async()=>f.reset());
test('Sheets failure retries outbox without consuming stock; success sends signed latest version',async()=>{
 const [r]=await s.importText({text:text(),userId:1,actorId:9});await s.process(r.id,{actorId:9,reportOnly:true,expectedVersion:1});
 const config={sheetsUrl:'https://script.google.com/macros/s/fixture/exec',sheetsSecret:'test-only',spreadsheetId:'fixture-sheet'};
 const fail=createSheetsSync({pool:f.pool,config,fetchImpl:async()=>({ok:false,status:503})});await fail.drain();
 let out=(await f.pool.query('SELECT * FROM line_sheet_outbox'))[0][0];assert.equal(out.state,'pending');assert.equal(out.attempts,1);
 assert.equal((await f.pool.query('SELECT status FROM inventory_items WHERE id=11'))[0][0].status,'dispatched');
 await f.pool.query('UPDATE line_sheet_outbox SET next_attempt_at=NULL');
 let body;const ok=createSheetsSync({pool:f.pool,config,fetchImpl:async(url,opts)=>{body=JSON.parse(opts.body);assert.equal(url,config.sheetsUrl);const sig=crypto.createHmac('sha256',config.sheetsSecret).update(body.timestamp+'\n'+body.nonce+'\n'+body.payload).digest('base64');assert.equal(body.signature,sig);return {ok:true,json:async()=>({ok:true})};}});
 await ok.drain();out=(await f.pool.query('SELECT * FROM line_sheet_outbox'))[0][0];assert.equal(out.state,'done');
 const report=JSON.parse(body.payload);assert.equal(report.record.version,2);assert.equal(report.record.parsed.fields[0].label,'วันที่ติดตั้ง');assert.equal(report.spreadsheetId,'fixture-sheet');
});
test('missing configuration does not discard pending reports',async()=>{const [r]=await s.importText({text:text(),userId:1,actorId:9});await s.process(r.id,{actorId:9,reportOnly:true,expectedVersion:1});await createSheetsSync({pool:f.pool,config:{}}).drain();assert.equal((await f.pool.query('SELECT state FROM line_sheet_outbox'))[0][0].state,'pending');});

