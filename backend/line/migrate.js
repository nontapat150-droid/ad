// Explicit administrative command. Loading server.js would also start unrelated jobs.
require('../config/env');
const fs=require('node:fs/promises');const path=require('node:path');const pool=require('../config/db');
async function main(){
 const conn=await pool.getConnection();
 try{
  for(const table of ['inventory_logs','job_used_inventory','ma_job_used_inventory']){
   const [columns]=await conn.query('SHOW COLUMNS FROM '+table);
   if(!columns.some(c=>c.Field==='id'&&/auto_increment/i.test(c.Extra)))throw new Error(table+'.id must be AUTO_INCREMENT before LINE import can safely write history');
  }
  for(const file of ['migration.sql','desktop-migration.sql']){
   const sql=await fs.readFile(path.join(__dirname,file),'utf8');
   for(const statement of sql.split(/;\s*(?:\r?\n|$)/).filter(s=>s.trim()))await conn.query(statement);
  }
  console.log('LINE import and desktop schemas ready; existing auto mode preserved.');
 }finally{conn.release();await pool.end();}
}
main().catch(e=>{console.error('LINE migration failed:',e.code||e.message);process.exitCode=1;});

