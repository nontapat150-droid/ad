const {test,before,after,beforeEach}=require('node:test');const assert=require('node:assert/strict');
const {fixture,event}=require('./lineFixture');const {createLineService,transaction}=require('../line/service');
const {reuseSn,invalidateEffects,lockJob}=require('../line/inventory');let f,s;
before(async()=>{f=await fixture();s=createLineService({pool:f.pool});});after(async()=>f&&f.close());beforeEach(async()=>f.reset());
test('normal completion reuses LINE usage and its device summary without a new deduction',async()=>{
 await s.receive([event()]);await s.drain();
 const used=await transaction(f.pool,async c=>{await lockJob(c,'office',101);return reuseSn(c,{kind:'office',jobId:101,itemId:11,role:'ONU'});});
 assert.equal(used.sn,'ABC001');assert.equal(used.device_role,'ONU');
 assert.equal((await f.pool.query('SELECT * FROM inventory_logs'))[0].length,1);
 await assert.rejects(transaction(f.pool,c=>reuseSn(c,{kind:'office',jobId:101,itemId:11,role:'PB'})),/บทบาท/);
});
test('explicit legacy return invalidates imports so stale retries never rededuct',async()=>{
 await s.receive([event()]);await s.drain();
 await transaction(f.pool,async c=>{await lockJob(c,'office',101);await c.query("UPDATE inventory_items SET status='dispatched',quantity=1 WHERE id=11");await c.query('DELETE FROM job_used_inventory WHERE job_id=101');await invalidateEffects(c,'office',101,9);});
 assert.equal((await f.pool.query('SELECT status FROM line_records'))[0][0].status,'reversed');
 assert.equal((await f.pool.query('SELECT active_item_id FROM line_effects'))[0][0].active_item_id,null);
 await s.receive([event('RETRY')]);await s.drain();
 assert.equal((await f.pool.query('SELECT status FROM inventory_items WHERE id=11'))[0][0].status,'dispatched');
});
test('return of a superseded effect enqueues its changed audit without reviving that revision',async()=>{
 await s.receive([event()]);await s.drain();await s.receive([event('REV','\nหมายเหตุ : แก้ไข')]);await s.drain();
 const [records]=await f.pool.query('SELECT * FROM line_records ORDER BY id');await s.process(records[1].id,{actorId:9,confirm:true,acceptConflict:true,expectedVersion:records[1].version});
 const old=(await f.pool.query('SELECT * FROM line_records WHERE id=?',[records[0].id]))[0][0];await f.pool.query("UPDATE line_sheet_outbox SET state='done'");
 await transaction(f.pool,async c=>{await lockJob(c,'office',101);await c.query("UPDATE inventory_items SET status='dispatched',quantity=1 WHERE id=11");await c.query('DELETE FROM job_used_inventory WHERE job_id=101');await invalidateEffects(c,'office',101,9);});
 const out=(await f.pool.query('SELECT * FROM line_sheet_outbox WHERE record_id=?',[old.id]))[0][0];assert.equal(out.state,'pending');assert.equal(out.version,old.version+1);
 assert.equal((await f.pool.query('SELECT status FROM line_records WHERE id=?',[old.id]))[0][0].status,'superseded');
});

