const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const express=require('express');const crypto=require('node:crypto');
const {fixture,event,text}=require('./lineFixture');const {createLineRouter}=require('../line/router');
let f,server,base;const secret='fixture-only-channel-secret';
before(async()=>{f=await fixture({dateStrings:false,timezone:'+07:00'});await f.reset();const app=express();const routers=createLineRouter({pool:f.pool,config:{channelSecret:secret},auth:(req,res,next)=>{req.user={id:9,role:req.headers['x-role']||'admin'};next();}});
app.use('/line/webhook',routers.webhook);app.use(express.json());app.use('/line-import',routers.admin);server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(f)await f.close();});
const sig=b=>crypto.createHmac('sha256',secret).update(b).digest('base64');
test('raw HMAC protects webhook, persists whole batch, empty verification succeeds',async()=>{
 const b=JSON.stringify({events:[event('HTTP1'),event('HTTP2')]},null,2);
 assert.equal((await fetch(base+'/line/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-line-signature':sig(b)},body:b})).status,200);
 assert.equal((await f.pool.query('SELECT * FROM line_events'))[0].length,2);
 assert.equal((await fetch(base+'/line/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-line-signature':sig(b)},body:b+' '})).status,401);
 const empty='{"events":[]}';assert.equal((await fetch(base+'/line/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-line-signature':sig(empty)},body:empty})).status,200);
});
test('admin API denies technicians and validates date range, versions and config',async()=>{
 assert.equal((await fetch(base+'/line-import/settings',{headers:{'x-role':'technician'}})).status,403);
 assert.equal((await fetch(base+'/line-import/records?from=2026-10-19&to=2026-10-18')).status,400);
 const req=(p,b)=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
 assert.equal((await req('/line-import/import',{text:text(),userId:1})).status,200);
 const list=await (await fetch(base+'/line-import/records?from=2026-10-18&to=2026-10-18')).json();assert.equal(list.total,1);
 assert.equal(list.records[0].job_date,'2026-10-18');
 assert.equal((await req('/line-import/records/'+list.records[0].id+'/process',{action:'confirm'})).status,400);
 assert.equal((await req('/line-import/records/'+list.records[0].id+'/process',{action:'confirm',version:1})).status,200);
 assert.equal((await(await fetch(base+'/line-import/records?needsReview=true')).json()).total,0);
 assert.equal((await fetch(base+'/line-import/records/'+list.records[0].id)).status,200);
 const settings=await(await fetch(base+'/line-import/settings')).json();assert.equal(settings.channelReady,true);assert.ok(!JSON.stringify(settings).includes(secret));
 const collision=await fetch(base+'/line-import/bindings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({lineUserId:'U2',userId:1})});assert.equal(collision.status,409);
});

