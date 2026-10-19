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

