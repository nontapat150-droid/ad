const mysql=require('mysql2/promise');
const fs=require('node:fs/promises'); const path=require('node:path');
async function fixture(options={}){
 const port=Number(process.env.LINE_TEST_DB_PORT||3318);
 if(port!==3318)throw new Error('Test fixture requires isolated port 3318');
 const admin=await mysql.createConnection({host:'127.0.0.1',port,user:'root'});
 const database='bo_line_test_'+process.pid; if(!/^bo_line_test_\d+$/.test(database))throw new Error('Unsafe DB name');
 await admin.query('CREATE DATABASE IF NOT EXISTS '+database+' CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');await admin.end();
 const pool=mysql.createPool({host:'127.0.0.1',port,user:'root',database,connectionLimit:8,multipleStatements:true,dateStrings:true,timezone:'Z',...options});
 await pool.query(`
 CREATE TABLE IF NOT EXISTS users(id INT PRIMARY KEY,full_name VARCHAR(100),username VARCHAR(100),role VARCHAR(50),status VARCHAR(20) DEFAULT 'active',team_id INT);
 CREATE TABLE IF NOT EXISTS jobs(id INT PRIMARY KEY,access_no VARCHAR(100),order_no VARCHAR(100),customer_order_no VARCHAR(100),field_engineer_id INT,team_id INT,status VARCHAR(30));
 CREATE TABLE IF NOT EXISTS ma_jobs(id INT PRIMARY KEY,access_no VARCHAR(100),non_number VARCHAR(100),srt VARCHAR(100),assigned_user_id INT,team_id INT,status VARCHAR(30));
 CREATE TABLE IF NOT EXISTS inventory_products(id INT PRIMARY KEY,name VARCHAR(100),has_sn INT,category VARCHAR(100),unit VARCHAR(30));
 CREATE TABLE IF NOT EXISTS inventory_models(id INT PRIMARY KEY,product_id INT,model_name VARCHAR(100));
 CREATE TABLE IF NOT EXISTS inventory_items(id INT PRIMARY KEY,model_id INT,sn VARCHAR(100),quantity DECIMAL(12,2),status VARCHAR(30),owner_id INT,team_id INT,expires_at DATETIME NULL);
 CREATE TABLE IF NOT EXISTS inventory_logs(id INT AUTO_INCREMENT PRIMARY KEY,item_id INT,from_user_id INT,to_user_id INT,action VARCHAR(30),quantity DECIMAL(12,2),note TEXT,created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS job_used_inventory(id INT AUTO_INCREMENT PRIMARY KEY,job_id INT,inventory_item_id INT,device_role VARCHAR(50),sn VARCHAR(100),product_name VARCHAR(100),model_name VARCHAR(100),quantity DECIMAL(12,2),used_by INT,used_at DATETIME DEFAULT CURRENT_TIMESTAMP);
 CREATE TABLE IF NOT EXISTS ma_job_used_inventory LIKE job_used_inventory;
 `);
 const [cols]=await pool.query("SHOW COLUMNS FROM ma_job_used_inventory LIKE 'job_id'");
 if(cols.length)await pool.query('ALTER TABLE ma_job_used_inventory CHANGE job_id ma_job_id INT');
 await pool.query(await fs.readFile(path.join(__dirname,'../line/migration.sql'),'utf8'));
 async function reset(){
  for(const t of ['line_product_roles','line_sheet_outbox','line_audit','line_effects','line_records','line_events','line_bindings','line_groups','inventory_logs','job_used_inventory','ma_job_used_inventory','inventory_items','inventory_models','inventory_products','jobs','ma_jobs','users'])await pool.query('DELETE FROM '+t);
  await pool.query("UPDATE line_settings SET auto_enabled=1 WHERE id=1");
  await pool.query("INSERT INTO users VALUES (1,'ช่างทดสอบ','tech','technician','active',10),(2,'ช่างคนอื่น','other','technician','active',20),(9,'ผู้ดูแล','admin','admin','active',NULL)");
  await pool.query("INSERT INTO jobs(id,access_no,order_no,customer_order_no,field_engineer_id,team_id,status) VALUES (101,'008801','P0001',NULL,1,10,'assigned'),(102,'008802','P0002',NULL,2,20,'assigned')");
  await pool.query("INSERT INTO ma_jobs(id,access_no,non_number,srt,assigned_user_id,team_id,status) VALUES(201,'008803','008803','S0001',1,10,'assigned')");
  await pool.query("INSERT INTO inventory_products VALUES (1,'ONU',1,'ONU','ชิ้น'),(2,'Playbox',1,'Playbox','ชิ้น')");
  await pool.query("INSERT INTO line_product_roles VALUES(1,'ONU'),(2,'PB')");
  await pool.query("INSERT INTO inventory_models VALUES(1,1,'FiberHome'),(2,2,'Playbox')");
  await pool.query("INSERT INTO inventory_items VALUES (11,1,'ABC001',1,'dispatched',1,10,NULL),(12,2,'PB001',1,'dispatched',1,10,NULL),(13,1,'OTHER001',1,'dispatched',2,20,NULL)");
  await pool.query("INSERT INTO line_groups(source_id,team_id,enabled) VALUES('G1',10,1)");
  await pool.query("INSERT INTO line_bindings(line_user_id,user_id,updated_by) VALUES('U1',1,9)");
 }
 return {pool,reset,close:()=>pool.end()};
}
const text=(extra='')=>'#ปิดงานติดตั้งais\nวันที่ติดตั้ง : 18/10/69\nปิดเคสงาน : 008801\nOrder no : P0001\nชื่อ-สกุล : ลูกค้าทดสอบ\nSn ONU : ABC001'+extra;
const event=(id='E1',extra='',userId='U1')=>({type:'message',webhookEventId:id,timestamp:1792300000000,source:{type:'group',groupId:'G1',userId},message:{id:id+'-M',type:'text',text:text(extra)},replyToken:'MUST_NOT_STORE'});
module.exports={fixture,text,event};


