import {useState,useEffect,useCallback} from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import LineSettings from '../components/line/LineSettings';
import LineRecordDetail from '../components/line/LineRecordDetail';
import {downloadLineWorkbook,lineTypes,lineStatuses,lineActions} from '../utils/lineWorkbook';
import './LineImportPage.css';
const initial={from:'',to:'',type:'',status:'',userId:'',teamId:'',search:'',receivedFrom:'',receivedTo:'',needsReview:false};
const emptySettings={users:[],groups:[],bindings:[],products:[],roles:[],discovered:[],pending:[]};
export default function LineImportPage(){
 const [tab,setTab]=useState('records'),[filters,setFilters]=useState(initial),[page,setPage]=useState(1);
 const [list,setList]=useState({records:[],summary:[],total:0}),[settings,setSettings]=useState(emptySettings),[history,setHistory]=useState([]);
 const [loadedKey,setLoadedKey]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [text,setText]=useState(''),[userId,setUserId]=useState(''),[preview,setPreview]=useState(null),[detail,setDetail]=useState(null),[includeReview,setIncludeReview]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const requestKey=JSON.stringify({filters,page,refresh}),loading=loadedKey!==requestKey;
 const loadSettings=useCallback(async()=>{const {data}=await api.get('/line-import/settings');setSettings(data);},[]);
 const fail=e=>e.response?.data?.error||e.message||'โหลดข้อมูลไม่สำเร็จ';
 const run=async(fn)=>{setBusy(true);setError('');setMessage('');try{const result=await fn();if(typeof result==='string')setMessage(result);}catch(e){setError(fail(e));}finally{setBusy(false);}};
 useEffect(()=>{let cancelled=false;
  api.get('/line-import/records',{params:{...filters,page}}).then(({data})=>{if(!cancelled){setList(data);setError('');}}).catch(e=>{if(!cancelled){setList({records:[],summary:[],total:0});setError(e.response?.data?.error||'โหลดข้อมูลไม่สำเร็จ');}}).finally(()=>{if(!cancelled)setLoadedKey(requestKey);});
  return()=>{cancelled=true;};
 },[filters,page,refresh,requestKey]);
 useEffect(()=>{let cancelled=false;
  Promise.all([api.get('/line-import/settings'),api.get('/line-import/history')]).then(([s,h])=>{if(!cancelled){setSettings(s.data);setHistory(h.data);}}).catch(e=>{if(!cancelled)setError(e.response?.data?.error||'โหลดการตั้งค่าไม่สำเร็จ');});
  return()=>{cancelled=true;};
 },[refresh]);
 const change=(key,value)=>{setFilters(prev=>({...prev,[key]:value}));setPage(1);};
 const open=async id=>{const {data}=await api.get('/line-import/records/'+id);setDetail(data);};
 const action=async(action,version)=>run(async()=>{
  const {data}=await api.post('/line-import/records/'+detail.id+'/process',{action,version});setDetail(null);setRefresh(v=>v+1);
  return data.status==='review'||data.status==='conflict'?'ยังไม่ตัดอุปกรณ์ กรุณาตรวจข้อมูลอีกครั้ง':'บันทึกผลแล้ว';
 });
 const revise=async body=>run(async()=>{await api.patch('/line-import/records/'+detail.id,body);setDetail(null);setRefresh(v=>v+1);return 'บันทึกรุ่นแก้ไขแล้ว กรุณาเปิดตรวจและยืนยัน';});
 return <Layout activeKey="line_import" pageTitle="นำเข้าข้อมูล LINE"><div className="line-import">
  <header className="li-heading"><div><h1>ข้อมูลปิดงานจาก LINE</h1><p>ตรวจเลขงานและ SN ก่อนบันทึกการใช้จากกระเป๋าช่าง</p></div><div className="li-heading-actions"><button className="li-secondary" disabled={loading||busy} onClick={()=>setRefresh(v=>v+1)}>โหลดใหม่</button><button className="li-primary" disabled={busy} onClick={()=>run(async()=>{const {data}=await api.get('/line-import/report',{params:{...filters,includeReview}});await downloadLineWorkbook(data);return 'ดาวน์โหลด Excel แล้ว';})}>ดาวน์โหลด Excel</button></div></header>
  <div className="li-notice"><strong>{settings.channelReady?'ตั้งค่าช่องทางรับข้อความแล้ว':'ยังไม่ได้เชื่อมบอท LINE'} · {settings.autoEnabled?'โหมดตัดอัตโนมัติ':'โหมดตรวจอย่างเดียว'}</strong><span>โน้ตและประวัติเก่าให้คัดลอกข้อความหรืออัปโหลด TXT ในเมนูนำเข้า</span></div>
  <nav className="li-tabs" aria-label="ส่วนข้อมูล LINE">{[['records','รายการนำเข้า'],['import','นำเข้าข้อความ'],['review','รอตรวจสอบ'],['settings','ตั้งค่าและประวัติ']].map(([id,label])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>{setTab(id);if(['review','records'].includes(id)){setFilters(prev=>({...prev,status:'',needsReview:id==='review'}));setPage(1);}}}>{label}</button>)}</nav>
  {error&&<div role="alert" className="li-error">{error}<button aria-label="ปิดข้อความผิดพลาด" onClick={()=>setError('')}>×</button></div>}
  {message&&<p className="li-success" role="status">{message}</p>}
  {(tab==='records'||tab==='review')&&<>
   <dl className="li-counts"><div><dt>พบทั้งหมด</dt><dd>{list.total.toLocaleString()} <small>รายการ</small></dd></div>{['review','conflict','applied','report_only'].map(status=><div key={status}><dt>{lineStatuses[status]}</dt><dd>{Number(list.summary.find(s=>s.status===status)?.total||0).toLocaleString()}</dd></div>)}</dl>
   <section className="li-filter" aria-label="ค้นหาและกรองรายการ">
    <label className="li-search">ค้นหา<input value={filters.search} onChange={e=>change('search',e.target.value)} placeholder="เลขงาน, Order, SN หรือชื่อลูกค้า"/></label>
    <label>วันที่งาน ตั้งแต่<input type="date" value={filters.from} onChange={e=>change('from',e.target.value)}/></label><label>ถึง<input type="date" min={filters.from} value={filters.to} onChange={e=>change('to',e.target.value)}/></label>
    <label>ประเภทงาน<select value={filters.type} onChange={e=>change('type',e.target.value)}><option value="">ทุกประเภท</option>{Object.entries(lineTypes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>สถานะ<select value={filters.status} onChange={e=>change('status',e.target.value)}><option value="">ทุกสถานะ</option>{Object.entries(lineStatuses).filter(([k])=>tab!=='review'||['review','conflict'].includes(k)).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    <label>ช่าง<select value={filters.userId} onChange={e=>change('userId',e.target.value)}><option value="">ทุกคน</option>{settings.users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label>
    <details className="li-extra-filter"><summary>ตัวกรองเพิ่มเติม</summary><div><label>ทีม<select value={filters.teamId} onChange={e=>change('teamId',e.target.value)}><option value="">ทุกทีม</option>{[...new Set(settings.users.map(u=>u.team_id).filter(Boolean))].map(id=><option key={id} value={id}>ทีม {id}</option>)}</select></label><label>วันที่รับ ตั้งแต่<input type="date" value={filters.receivedFrom} onChange={e=>change('receivedFrom',e.target.value)}/></label><label>ถึง<input type="date" value={filters.receivedTo} onChange={e=>change('receivedTo',e.target.value)}/></label></div></details>
    <div className="li-filter-bottom"><label className="li-check"><input type="checkbox" checked={includeReview} onChange={e=>setIncludeReview(e.target.checked)}/>รวมรายการรอตรวจใน Excel</label><button className="li-link" onClick={()=>{setFilters({...initial,needsReview:tab==='review'});setPage(1);}}>ล้างตัวกรอง</button></div>
   </section>
   <div className="li-table-wrap" aria-busy={loading}><table><thead><tr><th>วันที่งาน / ประเภท</th><th>เลขงาน / ลูกค้า</th><th>ช่าง</th><th>อุปกรณ์ SN</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody>{list.records.map(r=><tr key={r.id}><td><strong>{String(r.job_date||r.parsed.date||'—').slice(0,10)}</strong><small>{lineTypes[r.type]}</small></td><td><strong>{r.case_no||r.order_no||r.srt||'ยังไม่มีเลขงาน'}</strong><small>{r.customer||'ยังไม่มีชื่อ'}{r.order_no?' · '+r.order_no:''}</small></td><td>{r.technician||'ยังไม่ผูกช่าง'}<small>{r.team_id?'ทีม '+r.team_id:''}</small></td><td>{r.parsed.sns.length?r.parsed.sns.map((s,i)=><small key={i}>{s.field}: {s.sn}</small>):'ไม่มี SN ใหม่'}</td><td><span className={'li-badge li-'+r.status}>{lineStatuses[r.status]}</span>{r.reason&&<small className="li-reason">{r.reason}</small>}</td><td><button className="li-secondary" disabled={busy} onClick={()=>run(()=>open(r.id))}>ดู / ตรวจ</button></td></tr>)}</tbody></table>
    {!list.records.length&&!loading&&<div className="li-empty"><h3>ยังไม่มีข้อมูลในช่วงที่เลือก</h3><p>ให้ช่างส่งข้อความปิดงานผ่านบอท หรือนำเข้าข้อความเก่า</p><button className="li-primary" onClick={()=>setTab('import')}>นำเข้าข้อความ</button></div>}
    {loading&&<p className="li-loading" role="status">กำลังโหลดข้อมูล…</p>}
   </div>
   <div className="li-pagination"><span>หน้า {page} จาก {Math.max(1,Math.ceil(list.total/50))}</span><div className="li-actions"><button className="li-secondary" disabled={page===1||loading} onClick={()=>setPage(p=>p-1)}>ก่อนหน้า</button><button className="li-secondary" disabled={page*50>=list.total||loading} onClick={()=>setPage(p=>p+1)}>ถัดไป</button></div></div>
  </>}
  {tab==='import'&&<section className="li-panel li-import-form"><h2>นำเข้าโน้ตหรือข้อความเก่า</h2><p className="li-muted">เลือกช่างเจ้าของงาน วางข้อความตามรูปแบบปิดงาน หรือเลือกไฟล์ TXT ระบบจะแยกตาม #ประเภทงาน และยังไม่หักกระเป๋าจนกว่าจะตรวจยืนยัน</p>
   <div className="li-import-controls"><label>ช่างเจ้าของงาน<select value={userId} onChange={e=>setUserId(e.target.value)}><option value="">เลือกช่าง</option>{settings.users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label><label>ไฟล์ข้อความ TXT<input type="file" accept=".txt,text/plain" onChange={e=>{const file=e.target.files[0];if(!file)return;run(async()=>{if(file.size>1000000)throw new Error('ไฟล์เกิน 1 MB กรุณาแบ่งไฟล์');setText(await file.text());setPreview(null);return 'อ่านไฟล์แล้ว กรุณาตรวจตัวอย่าง';});}}/></label></div>
   <label>ข้อความจาก LINE<textarea rows={13} value={text} onChange={e=>{setText(e.target.value);setPreview(null);}} placeholder={'#ปิดงานติดตั้งais\nวันที่ติดตั้ง : 18/10/69\nปิดเคสงาน : …\nSn ONU : …'}/></label>
   <div className="li-actions"><button className="li-primary" disabled={busy||!text.trim()} onClick={()=>run(async()=>{const {data}=await api.post('/line-import/preview',{text});setPreview(data.records);return data.records.length?'อ่านข้อมูลแล้ว ยังไม่ได้บันทึก':'ไม่พบ #ประเภทงานที่รองรับ';})}>ดูตัวอย่างข้อมูล</button>
    {preview?.length>0&&<button className="li-secondary" disabled={busy||!userId} onClick={()=>run(async()=>{const {data}=await api.post('/line-import/import',{text,userId});setPreview(null);setText('');setTab('review');setFilters({...initial,needsReview:true});setPage(1);setRefresh(v=>v+1);return 'บันทึก '+data.records.length+' รายการแล้ว เปิดแต่ละงานเพื่อตรวจและยืนยัน';})}>บันทึกเข้ารายการรอตรวจ</button>}
   </div>
   {preview&&<div className="li-preview"><h3>พบ {preview.length} งาน</h3>{preview.map((r,i)=><article key={i}><strong>{lineTypes[r.type]} · {r.date||'วันที่ไม่ถูกต้อง'} · {r.caseNo||r.orderNo||r.srt||'ไม่มีเลขงาน'}</strong><p>{r.customer||'ไม่มีชื่อลูกค้า'} · SN ใหม่ {r.sns.length} ตัว</p>{r.warnings.length>0&&<ul className="li-warning">{r.warnings.map((w,n)=><li key={n}>{w}</li>)}</ul>}<details><summary>ช่องข้อมูล {r.fields.length} ช่อง</summary><dl className="li-fields">{r.fields.map((f,n)=><div key={n}><dt>{f.label}</dt><dd>{f.value||'—'}</dd></div>)}</dl></details></article>)}</div>}
  </section>}
  {tab==='settings'&&<><LineSettings settings={settings} onChange={loadSettings} run={run} busy={busy}/><section className="li-panel li-history"><h3>ประวัติการทำรายการล่าสุด</h3>{history.map(h=><details key={h.id}><summary>{String(h.created_at)} · {h.actor||'ระบบอัตโนมัติ'} · {lineActions[h.action]||h.action}{h.record_id?' · #'+h.record_id:''}</summary><pre>{JSON.stringify(h.detail,null,2)}</pre></details>)}{!history.length&&<p>ยังไม่มีประวัติ</p>}</section></>}
  {detail&&<LineRecordDetail key={detail.id+':'+detail.version} record={detail} settings={settings} busy={busy} error={error} onClose={()=>setDetail(null)} onAction={action} onRevise={revise}/>}
 </div></Layout>;
}

