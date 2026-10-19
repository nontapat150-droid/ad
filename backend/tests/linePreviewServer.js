// Local, disposable integration preview. Never required by production server.js.
const express=require('express'),cors=require('cors');
const {fixture,text}=require('./lineFixture');const {createLineRouter}=require('../line/router');
async function main(){
 if(process.env.LINE_PREVIEW!=='true')throw new Error('Set LINE_PREVIEW=true for this isolated fixture server');
 const f=await fixture();await f.reset();await f.pool.query('UPDATE line_settings SET auto_enabled=0');
 await f.pool.query("INSERT INTO jobs VALUES(103,'008805','P0005',NULL,1,10,'assigned')");
 await f.pool.query("INSERT INTO inventory_items VALUES(18,1,'DEMO006',1,'dispatched',1,10,NULL)");
 const app=express();app.use(cors({origin:['http://127.0.0.1:5190','http://localhost:5190']}));
 const user={id:9,full_name:'ผู้ดูแลทดสอบ',username:'line-demo',role:'admin',roles:['admin']};
 const routers=createLineRouter({pool:f.pool,config:{channelSecret:'local-fixture-only'},auth:(req,res,next)=>{if(req.get('authorization')!=='Bearer local-line-preview')return res.sendStatus(401);req.user=user;next();}});
 app.use('/api/line/webhook',routers.webhook);app.use(express.json());
 app.post('/api/auth/login',(req,res)=>{if(req.body.username!=='line-demo'||req.body.password!=='line-demo')return res.status(401).json({error:'ใช้บัญชีทดสอบ line-demo'});res.json({user,token:'local-line-preview'});});
 app.get('/api/settings/global',(_req,res)=>res.json({website_name:'BO ad — ฐานทดสอบ LINE',website_logo:null}));
 app.get(['/api/messages/unread-count','/api/notifications/unread-count'],(_req,res)=>res.json({count:0}));
 app.use('/api/line-import',routers.admin);
 app.use((_req,res)=>res.status(404).json({error:'เฉพาะเมนู LINE ในฐานทดสอบ'}));
 const records=await routers.service.importText({text:[text(),text().replace('#ปิดงานติดตั้งais','#ปิดงานติดตั้ง3bb').replace('ABC001','MISSING-DEMO'),text().replace('#ปิดงานติดตั้งais','#ปิดงานเปลี่ยนอุปกรณ์3bb'),'#งานMA\nวันที่แก้ไข :18/10/69\nNon :008803\nSRT :S0001\nชื่อลูกค้า ลูกค้าทดสอบ MA\nSN เก่า : OLD-DEMO\nSN ใหม่ : PB001'].join('\n\n'),userId:1,actorId:9});
 await routers.service.process(records[2].id,{actorId:9,reportOnly:true,expectedVersion:1});
 const server=app.listen(4319,'127.0.0.1',()=>console.log('Isolated LINE preview API http://127.0.0.1:4319; login line-demo / line-demo; fixture data only.'));
 const stop=()=>server.close(async()=>{await f.close();process.exit(0);});process.on('SIGINT',stop);process.on('SIGTERM',stop);
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});

