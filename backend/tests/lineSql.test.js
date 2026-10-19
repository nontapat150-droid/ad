const {test,before,after,beforeEach}=require('node:test');const assert=require('node:assert/strict');
const {fixture,text,event}=require('./lineFixture');const {createLineService}=require('../line/service');
test('rejecting a conflicting correction keeps accepted stock and records the decision',async()=>{
 await s.receive([event()]);await s.drain();await s.receive([event('CORRECTION','\nหมายเหตุ : ผิด')]);await s.drain();
 const [records]=await f.pool.query('SELECT * FROM line_records ORDER BY id');await s.process(records[1].id,{actorId:9,reject:true,expectedVersion:records[1].version});
 assert.equal((await stock()).status,'used');assert.equal((await f.pool.query('SELECT status FROM line_records WHERE id=?',[records[0].id]))[0][0].status,'applied');
 assert.equal((await f.pool.query('SELECT status FROM line_records WHERE id=?',[records[1].id]))[0][0].status,'rejected');
 assert.equal((await f.pool.query("SELECT * FROM line_audit WHERE action='rejected'"))[0].length,1);
});
test('turning automatic mode off stops already queued events',async()=>{
 await s.receive([event()]);await f.pool.query('UPDATE line_settings SET auto_enabled=0');await s.drain();assert.equal((await stock()).status,'dispatched');
});
test('inspect shows resolved job and technician without changing revision',async()=>{
 const [r]=await s.importText({text:text(),userId:1,actorId:9});const view=await s.process(r.id,{inspect:true});assert.equal(view.job_id,101);assert.equal(view.tech_id,1);assert.equal(view.version,1);
});
test('conflict chains always compare against the accepted version, not another conflict',async()=>{
 await f.pool.query("INSERT INTO inventory_items VALUES(15,1,'ABC002',1,'dispatched',1,10,NULL)");
 await s.receive([event()]);await s.drain();await s.receive([event('B','\nหมายเหตุ : B')]);await s.drain();
 const e=event('C');e.message.text=e.message.text.replace('ABC001','ABC002');await s.receive([e]);await s.drain();
 const r=(await f.pool.query('SELECT * FROM line_records ORDER BY id DESC LIMIT 1'))[0][0];
 await assert.rejects(s.process(r.id,{actorId:9,confirm:true,acceptConflict:true,expectedVersion:r.version}),/คืน.*ระบบเดิม|อุปกรณ์เดิม/);
 assert.equal((await stock(15)).status,'dispatched');assert.equal((await f.pool.query("SELECT * FROM line_records WHERE status='applied'"))[0].length,1);
});
test('another-job usage rejects even if a stale inventory status says dispatched',async()=>{
 await f.pool.query("INSERT INTO job_used_inventory(job_id,inventory_item_id,device_role,sn,quantity,used_by) VALUES(102,11,'ONU','ABC001',1,2)");
 await s.receive([event()]);await s.drain();assert.equal((await stock()).status,'dispatched');assert.equal((await row()).status,'review');
});
test('concurrent historical revisions serialize identity and quarantine the changed one',async()=>{
 await Promise.all([s.importText({text:text(),userId:1,actorId:9}),s.importText({text:text('\nSn Playbox : PB001'),userId:1,actorId:9})]);
 const [rows]=await f.pool.query('SELECT status FROM line_records ORDER BY id');
 assert.equal(rows.filter(r=>r.status==='review').length,1);assert.equal(rows.filter(r=>r.status==='conflict').length,1);
 assert.equal((await stock(12)).status,'dispatched');
});
let f,s;before(async()=>{f=await fixture();s=createLineService({pool:f.pool,config:{}});});after(async()=>f&&f.close());beforeEach(async()=>f.reset());
async function stock(id=11){return (await f.pool.query('SELECT * FROM inventory_items WHERE id=?',[id]))[0][0];}
async function row(){return (await f.pool.query('SELECT * FROM line_records ORDER BY id LIMIT 1'))[0][0];}
test('inbox drops tokens, deduplicates delivery and commits usage/audit without closing job',async()=>{
 await s.receive([event()]);await s.receive([event()]);await s.drain();const r=await row();
 assert.equal(r.status,'applied');assert.equal((await stock()).status,'used');
 assert.equal((await f.pool.query('SELECT * FROM inventory_logs'))[0].length,1);
 assert.equal((await f.pool.query('SELECT status FROM jobs WHERE id=101'))[0][0].status,'assigned');
 assert.ok(!(await f.pool.query('SELECT payload FROM line_events'))[0][0].payload.includes('MUST_NOT_STORE'));
 await s.receive([event('E2')]);await s.drain();assert.equal((await f.pool.query('SELECT * FROM line_records'))[0].length,1);
});
test('unknown sender, disallowed group and different team never deduct',async()=>{
 await s.receive([event('E1','','UNKNOWN')]);await s.drain();assert.equal((await row()).status,'review');assert.equal((await stock()).status,'dispatched');
 await f.reset();await f.pool.query("UPDATE line_groups SET enabled=0");await s.receive([event()]);await s.drain();assert.equal((await stock()).status,'dispatched');
 await f.reset();await f.pool.query("UPDATE line_bindings SET user_id=2");await s.receive([event()]);await s.drain();assert.equal((await stock()).status,'dispatched');
});
test('one bad SN rolls back all items; repeated role or wrong product stays review',async()=>{
 await s.receive([event('E1','\nSn Playbox : MISSING')]);await s.drain();assert.equal((await stock()).status,'dispatched');assert.equal((await row()).status,'review');
 await f.reset();await s.receive([event('E2','\nSn ONU : OTHER001')]);await s.drain();assert.equal((await stock()).status,'dispatched');
 await f.reset();await s.receive([event('E3','\nSn Playbox : ABC001')]);await s.drain();assert.equal((await stock()).status,'dispatched');
});
test('historical imports require confirmation and concurrent confirmations consume once',async()=>{
 const [r]=await s.importText({text:text(),userId:1,actorId:9});assert.equal((await stock()).status,'dispatched');
 const outcomes=await Promise.allSettled([s.process(r.id,{actorId:9,confirm:true,expectedVersion:r.version}),s.process(r.id,{actorId:9,confirm:true,expectedVersion:r.version})]);
 assert.equal(outcomes.filter(o=>o.status==='fulfilled').length,1);assert.equal((await f.pool.query('SELECT * FROM inventory_logs'))[0].length,1);
});
test('already used by same job links existing history; duplicate inventory SN rejects',async()=>{
 await f.pool.query("UPDATE inventory_items SET status='used',quantity=0 WHERE id=11");
 await f.pool.query("INSERT INTO job_used_inventory(job_id,inventory_item_id,device_role,sn,quantity,used_by) VALUES(101,11,'ONU','ABC001',1,1)");
 await s.receive([event()]);await s.drain();assert.equal((await row()).status,'applied');assert.equal((await f.pool.query('SELECT * FROM inventory_logs'))[0].length,0);
 await f.reset();await f.pool.query("INSERT INTO inventory_items SELECT 14,model_id,sn,quantity,status,owner_id,team_id,expires_at FROM inventory_items WHERE id=11");
 await s.receive([event()]);await s.drain();assert.equal((await stock()).status,'dispatched');assert.equal((await row()).status,'review');
});
test('changed message is quarantined; late binding never automatically cuts old inbox',async()=>{
 await s.receive([event()]);await s.drain();await s.receive([event('E2','\nหมายเหตุ : แก้ไข')]);await s.drain();
 const [rs]=await f.pool.query('SELECT * FROM line_records ORDER BY id');assert.equal(rs[1].status,'conflict');assert.equal((await f.pool.query('SELECT * FROM inventory_logs'))[0].length,1);
 await f.reset();await f.pool.query('DELETE FROM line_bindings');await s.receive([event()]);await f.pool.query("INSERT INTO line_bindings(line_user_id,user_id,updated_by) VALUES('U1',1,9)");
 await s.drain();assert.equal((await stock()).status,'dispatched');
});
test('MA deducts new only; unsend does not return stock',async()=>{
 const e=event();e.message.text='#งานMA\nวันที่แก้ไข :18-10-69\nNon :008803\nSRT :S0001\nชื่อลูกค้า ทดสอบ\nSN เก่า : NOT_IN_STOCK\nSN ใหม่ : ABC001';
 await s.receive([e]);await s.drain();assert.equal((await row()).status,'applied');assert.equal((await f.pool.query('SELECT * FROM ma_job_used_inventory'))[0].length,1);
 await s.receive([{type:'unsend',webhookEventId:'E-UN',source:e.source,unsend:{messageId:e.message.id}}]);await s.drain();assert.equal((await row()).status,'withdrawn');assert.equal((await stock()).status,'used');
});
test('explicit revision acceptance keeps existing stock and rejects SN changes until return',async()=>{
 await s.receive([event()]);await s.drain();await s.receive([event('E2','\nหมายเหตุ : แก้ชื่อ')]);await s.drain();
 let r=(await f.pool.query('SELECT * FROM line_records ORDER BY id DESC LIMIT 1'))[0][0];
 const result=await s.process(r.id,{actorId:9,confirm:true,acceptConflict:true,expectedVersion:r.version});assert.equal(result.status,'applied');
 assert.equal((await f.pool.query('SELECT * FROM inventory_logs'))[0].length,1);
 await s.receive([event('E3','\nSn Playbox : PB001')]);await s.drain();r=(await f.pool.query('SELECT * FROM line_records ORDER BY id DESC LIMIT 1'))[0][0];
 await assert.rejects(s.process(r.id,{actorId:9,confirm:true,acceptConflict:true,expectedVersion:r.version}),/คืน.*ระบบเดิม/);
});

