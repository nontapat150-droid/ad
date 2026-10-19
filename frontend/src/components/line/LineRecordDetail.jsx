import {useEffect,useRef,useState} from 'react';
import {lineTypes,lineStatuses} from '../../utils/lineWorkbook';
export default function LineRecordDetail({record,settings,busy,error,onClose,onAction,onRevise}){
 const dialog=useRef(null),[action,setAction]=useState(''),[editing,setEditing]=useState(false),[text,setText]=useState(record.raw_text),[userId,setUserId]=useState(record.tech_id||'');
 useEffect(()=>{const el=dialog.current;if(!el.open)el.showModal();return()=>el.close();},[]);
 const mutable=['review','conflict'].includes(record.status),blocked=!!record.errors?.length;
 return <dialog ref={dialog} className="li-dialog" onCancel={onClose}>
  <div className="li-dialog-head"><div><p className="li-muted">รายการ #{record.id} · รุ่น {record.version}</p><h2>{lineTypes[record.type]} <span className={'li-badge li-'+record.status}>{lineStatuses[record.status]}</span></h2></div><button className="li-secondary" aria-label="ปิดรายละเอียด" onClick={onClose}>ปิด</button></div>
  {error&&<p className="li-error" role="alert">{error}</p>}
  <div className="li-detail-grid">
   <section><h3>ข้อความต้นฉบับ</h3>{editing?<><label>แก้ข้อความ<textarea rows={15} value={text} onChange={e=>setText(e.target.value)}/></label><label>ช่างเจ้าของงาน<select value={userId} onChange={e=>setUserId(e.target.value)}><option value="">เลือกช่าง</option>{settings.users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}</select></label><div className="li-actions"><button disabled={busy||!userId||!text} className="li-primary" onClick={()=>onRevise({text,userId,version:record.version})}>บันทึกเป็นรุ่นแก้ไข</button><button className="li-secondary" onClick={()=>setEditing(false)}>กลับไปดู</button></div></>:<pre className="li-raw">{record.raw_text}</pre>}</section>
   <section><h3>ผลตรวจข้อมูล</h3><dl className="li-facts"><div><dt>เลขเคส / NON</dt><dd>{record.case_no||'—'}</dd></div><div><dt>Order / SRT</dt><dd>{record.order_no||record.srt||'—'}</dd></div><div><dt>งานใน BO</dt><dd>{record.job_id||'ยังไม่จับคู่'}</dd></div><div><dt>ช่างที่ผูก</dt><dd>{settings.users.find(u=>Number(u.id)===Number(record.tech_id))?.full_name||'ยังไม่ผูก'}</dd></div></dl>
    {record.errors?.length>0&&<div className="li-warning" role="status"><strong>ยังไม่ตัดอุปกรณ์</strong><ul>{record.errors.map((e,i)=><li key={i}>{e}</li>)}</ul></div>}
    {record.reason&&<p className="li-muted">{record.reason}</p>}
    <h3>SN ที่ต้องใช้</h3>{record.checks?.length?<ul className="li-sn-list">{record.checks.map((s,i)=><li key={i}><div><strong>{s.field} · {s.sn}</strong><p>{s.product||s.reason||'ยังไม่พบสินค้า'}</p><small>เจ้าของกระเป๋า #{s.ownerId||'—'} · {s.result==='deducted'?'ตัดแล้ว':s.result==='already_used'?'ใช้กับงานนี้แล้ว':s.result==='ready'?'พร้อมใช้':'รอตรวจ'}</small></div></li>)}</ul>:<p className="li-muted">ไม่มี SN ใหม่ที่ต้องตัด</p>}
    <h3>ช่องข้อมูลที่อ่านได้</h3><div className="li-fields">{record.parsed?.fields.map((f,i)=><div key={i}><dt>{f.label}</dt><dd>{f.value||'—'}</dd></div>)}</div>
   </section>
  </div>
  <section className="li-history"><h3>ประวัติรายการ</h3>{record.history?.map(h=><div key={h.id}><time>{String(h.created_at)}</time><span>{h.action} {h.actor_id?'· ผู้ใช้ #'+h.actor_id:'· ระบบอัตโนมัติ'}</span></div>)}</section>
  {mutable&&<footer className="li-dialog-footer">
   {action?<div className="li-confirm"><p>{action==='report_only'?'ยืนยันเก็บข้อมูลสำหรับรายงาน โดยไม่ตัดอุปกรณ์หรือไม่?':action==='accept_revision'?'รับข้อมูลรุ่นนี้แทนรุ่นก่อนและใช้ผลตรวจอุปกรณ์นี้หรือไม่?':'ยืนยันใช้อุปกรณ์ของงานนี้จากกระเป๋าช่าง/ทีมหรือไม่?'}</p><div className="li-actions"><button className="li-primary" disabled={busy} onClick={()=>{onAction(action,record.version);setAction('');}}>ยืนยันรายการ</button><button className="li-secondary" disabled={busy} onClick={()=>setAction('')}>กลับไปตรวจ</button></div></div>:
    <div className="li-actions"><button className="li-secondary" disabled={busy} onClick={()=>setEditing(true)}>แก้ข้อความ / เลือกช่าง</button>{record.status!=='conflict'&&<button className="li-secondary" disabled={busy} onClick={()=>setAction('report_only')}>เก็บเฉพาะรายงาน</button>}<button className="li-primary" disabled={busy||blocked} onClick={()=>setAction(record.status==='conflict'?'accept_revision':'confirm')}>{record.status==='conflict'?'รับข้อมูลรุ่นนี้':'ยืนยันใช้ SN'}</button></div>}
  </footer>}
 </dialog>;
}

