const {test,before,after,beforeEach}=require('node:test');const assert=require('node:assert/strict');const express=require('express');const path=require('node:path');
const {fixture,event}=require('./lineFixture');const {createLineService}=require('../line/service');
let f,s,server,base;
function stub(p,exports){const id=require.resolve(path.join(__dirname,'..',p));require.cache[id]={id,filename:id,loaded:true,exports};}
const noop=async()=>{};
before(async()=>{
 f=await fixture();s=createLineService({pool:f.pool});
 for(const [name,type] of Object.entries({finish_time:'DATETIME',completed_at:'DATETIME',completed_by:'INT',remark:'TEXT',plan_arrival_date:'DATE',customer:'VARCHAR(100)',package:'TEXT',install_device:'TEXT',split_no:'TEXT',port_no:'TEXT',l3_name:'TEXT',cable_length:'TEXT',ref_id_3bb:'TEXT',sc_blue:'TEXT'}))await f.pool.query('ALTER TABLE jobs ADD COLUMN IF NOT EXISTS '+name+' '+type);
 await f.pool.query("CREATE TABLE IF NOT EXISTS job_logs(id INT AUTO_INCREMENT PRIMARY KEY,job_id INT,tech_id INT,status VARCHAR(30),remark TEXT); CREATE TABLE IF NOT EXISTS job_completion_images(id INT AUTO_INCREMENT PRIMARY KEY,job_id INT,image_path TEXT,uploaded_by INT)");
 for(const [name,type]of Object.entries({completed_at:'DATETIME',completed_by:'INT',remark:'TEXT'}))await f.pool.query('ALTER TABLE ma_jobs ADD COLUMN IF NOT EXISTS '+name+' '+type);
 await f.pool.query('CREATE TABLE IF NOT EXISTS ma_job_completion_images(id INT AUTO_INCREMENT PRIMARY KEY,ma_job_id INT,image_path TEXT,uploaded_by INT)');
 stub('config/db',f.pool);stub('middleware/auth',{auth:(req,res,next)=>{req.user={id:1,role:req.headers['x-role']||'technician',team_id:10};next();},requireRole:()=> (_q,_s,next)=>next()});
 stub('middleware/upload',{setUpload:()=> (_q,_s,next)=>next(),upload:{fields:()=> (req,res,next)=>{req.files={images:[{filename:'fixture.jpg'}]};next();},single:()=> (_q,_s,next)=>next(),array:()=> (_q,_s,next)=>next()}});
 stub('utils/customerSync',{syncCustomerFromJob:noop,syncMaCustomerFromJob:noop,syncInstalledFromJob:noop});
 stub('config/firebase-admin',{sendToUser:noop});
 stub('utils/notifyEvent',{notifyEvent:noop,getTeamMemberIds:async()=>[],getAdminIds:async()=>[],ensureNotificationsSchema:noop});
 stub('utils/jobNotifications',new Proxy({},{get:()=>noop}));
 stub('utils/teamsSchema',{bumpTeamOilCase:noop,decrementTeamOilCase:noop,loadTeamLeaderIndex:async()=>new Map(),applyLeaderTeamToJob:noop});
 const app=express();app.use(express.json());app.use('/dispatch',require('../routes/dispatch'));server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
});
beforeEach(async()=>{await f.reset();});
after(async()=>{if(server)await new Promise(r=>server.close(r));if(f)await f.close();});
async function complete(body,role='technician'){const response=await fetch(base+'/dispatch/jobs/101/complete',{method:'PUT',headers:{'Content-Type':'application/json','x-role':role},body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;}
test('actual completion route after LINE records one usage and one used log',async()=>{
 await s.receive([event()]);await s.drain();await complete({usedInventory:[{inventory_item_id:11,device_role:'ONU'}]});
 assert.equal((await f.pool.query('SELECT status FROM jobs WHERE id=101'))[0][0].status,'completed');
 assert.equal((await f.pool.query('SELECT * FROM job_used_inventory WHERE job_id=101'))[0].length,1);
 assert.equal((await f.pool.query("SELECT * FROM inventory_logs WHERE action='used'"))[0].length,1);
});
test('completion cannot silently omit an already recorded SN from its device summary',async()=>{
 await s.receive([event()]);await s.drain();await complete({usedInventory:[]});
 assert.ok((await f.pool.query('SELECT install_device FROM jobs WHERE id=101'))[0][0].install_device?.includes('ABC001'));
});
test('actual normal completion before LINE links same inventory without second use',async()=>{
 await complete({usedInventory:[{inventory_item_id:11,device_role:'ONU'}]});
 await s.receive([event()]);await s.drain();assert.equal((await f.pool.query('SELECT status FROM line_records'))[0][0].status,'applied');
 assert.equal((await f.pool.query("SELECT * FROM inventory_logs WHERE action='used'"))[0].length,1);
});
test('actual admin recompletion return invalidates LINE and stale message never rededucts',async()=>{
 await s.receive([event()]);await s.drain();await complete({usedInventory:[{inventory_item_id:11,device_role:'ONU'}]});
 await complete({recomplete:true,usedInventory:[]},'admin');
 assert.equal((await f.pool.query('SELECT status FROM inventory_items WHERE id=11'))[0][0].status,'dispatched');
 assert.equal((await f.pool.query('SELECT status FROM line_records'))[0][0].status,'reversed');
 await s.receive([event('AFTER_RETURN')]);await s.drain();assert.equal((await f.pool.query('SELECT status FROM inventory_items WHERE id=11'))[0][0].status,'dispatched');
});
test('actual MA completion rolls back inventory when the later job update fails',async()=>{
 await f.pool.query("CREATE TRIGGER fixture_ma_failure BEFORE UPDATE ON ma_jobs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='fixture later job update failure'");
 try{
 const response=await fetch(base+'/dispatch/ma-jobs/201/complete',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({usedInventory:[{inventory_item_id:11}],srt:'S0001'})});
 assert.equal(response.status,500);
 assert.equal((await f.pool.query('SELECT status FROM inventory_items WHERE id=11'))[0][0].status,'dispatched');
 assert.equal((await f.pool.query('SELECT * FROM ma_job_used_inventory'))[0].length,0);
 }finally{await f.pool.query('DROP TRIGGER fixture_ma_failure');}
});
test('actual MA completion reuses imported SN and still requires its evidence upload path',async()=>{
 const e=event();e.message.text='#งานMA\nวันที่แก้ไข :18/10/69\nNon :008803\nSRT :S0001\nSN ใหม่ : ABC001';await s.receive([e]);await s.drain();
 const response=await fetch(base+'/dispatch/ma-jobs/201/complete',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({usedInventory:[{inventory_item_id:11}],srt:'S0001',new_sn:'ABC001'})});
 assert.equal(response.status,200,await response.text());assert.equal((await f.pool.query('SELECT * FROM ma_job_used_inventory'))[0].length,1);
 assert.equal((await f.pool.query("SELECT * FROM inventory_logs WHERE action='used'"))[0].length,1);
});

