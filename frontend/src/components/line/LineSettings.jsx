import {useState} from 'react';
import api from '../../api/axios';
export default function LineSettings({settings,onChange,run,busy}){
 const [group,setGroup]=useState({sourceId:'',teamId:'',enabled:true});
 const [binding,setBinding]=useState({lineUserId:'',userId:''});
 const [productId,setProductId]=useState('');
 const [roles,setRoles]=useState([]);
 const teams=[...new Set(settings.users.map(u=>u.team_id).filter(Boolean))];
 const save=async(path,data)=>run(async()=>{await api.put('/line-import/'+path,data);await onChange();return 'บันทึกการตั้งค่าแล้ว';});
 return <div className="li-settings">
  <section className="li-panel"><h3>การเชื่อมต่อและโหมดทำงาน</h3>
   <p>LINE: {settings.channelReady?'ตั้งค่ารับข้อความแล้ว':'ยังไม่ได้ตั้งค่า Channel secret บนเซิร์ฟเวอร์'}</p>
   <p>Google Sheets: {settings.sheetsReady?'ตั้งค่าปลายทางแล้ว':'ยังไม่ได้เชื่อมปลายทางรายงาน'}</p>
   <p className="li-muted">เริ่มด้วยตรวจอย่างเดียว ผูกกลุ่ม ช่าง และประเภทสินค้าให้ครบก่อนเปิดตัดอัตโนมัติ</p>
   <button className={settings.autoEnabled?'li-secondary':'li-primary'} disabled={busy} onClick={()=>save('settings',{autoEnabled:!settings.autoEnabled})}>{settings.autoEnabled?'หยุดตัดอัตโนมัติ':'เปิดตัดอัตโนมัติ'}</button>
   <p role="status">โหมดปัจจุบัน: <strong>{settings.autoEnabled?'ตัดอัตโนมัติเมื่อผ่านทุกเงื่อนไข':'ตรวจอย่างเดียว'}</strong></p>
  </section>
  <section className="li-panel"><h3>กลุ่มที่อนุญาต</h3>
   <form onSubmit={e=>{e.preventDefault();save('groups',group);}}>
    <label>รหัสกลุ่ม LINE<input required value={group.sourceId} onChange={e=>setGroup({...group,sourceId:e.target.value})} list="line-group-ids"/></label>
    <datalist id="line-group-ids">{[...new Set(settings.discovered.map(d=>d.source_id))].map(id=><option key={id} value={id}/>)}</datalist>
    <label>ทีมเจ้าของกลุ่ม<select required value={group.teamId} onChange={e=>setGroup({...group,teamId:e.target.value})}><option value="">เลือกทีม</option>{teams.map(id=><option key={id} value={id}>ทีม {id}</option>)}</select></label>
    <label className="li-check"><input type="checkbox" checked={group.enabled} onChange={e=>setGroup({...group,enabled:e.target.checked})}/>อนุญาตรับงานจากกลุ่มนี้</label>
    <button disabled={busy} className="li-primary">บันทึกกลุ่ม</button>
   </form>
   <ul className="li-settings-list">{settings.groups.map(g=><li key={g.source_id}><button className="li-link" onClick={()=>setGroup({sourceId:g.source_id,teamId:g.team_id,enabled:!!g.enabled})}>{g.source_id}</button><span>ทีม {g.team_id} · {g.enabled?'อนุญาต':'ปิด'}</span></li>)}</ul>
  </section>
  <section className="li-panel"><h3>ผูก LINE กับช่าง</h3><p className="li-muted">ช่างเจ้าของงานต้องส่งเอง ตรวจตัวตนก่อนผูก ไม่ใช้ชื่อแสดงผลแทนบัญชี</p>
   <form onSubmit={e=>{e.preventDefault();save('bindings',binding);}}>
    <label>รหัสผู้ส่ง LINE<input required list="line-user-ids" value={binding.lineUserId} onChange={e=>setBinding({...binding,lineUserId:e.target.value})}/></label>
    <datalist id="line-user-ids">{[...new Set(settings.discovered.map(d=>d.line_user_id))].map(id=><option key={id} value={id}/>)}</datalist>
    <label>ช่างเจ้าของงาน<select required value={binding.userId} onChange={e=>setBinding({...binding,userId:e.target.value})}><option value="">เลือกช่าง</option>{settings.users.map(u=><option key={u.id} value={u.id}>{u.full_name} · ทีม {u.team_id||'ยังไม่ระบุ'}</option>)}</select></label>
    <button disabled={busy} className="li-primary">บันทึกการผูกบัญชี</button>
   </form>
   <ul className="li-settings-list">{settings.bindings.map(b=><li key={b.line_user_id}><div><button className="li-link" onClick={()=>setBinding({lineUserId:b.line_user_id,userId:b.user_id})}>{b.full_name}</button><small>{b.line_user_id}</small></div><button className="li-secondary" disabled={busy} onClick={()=>run(async()=>{await api.delete('/line-import/bindings/'+encodeURIComponent(b.line_user_id));await onChange();return 'ยกเลิกการผูกบัญชีแล้ว';})}>ยกเลิกผูก</button></li>)}</ul>
  </section>
  <section className="li-panel"><h3>ประเภทสินค้าในข้อความ</h3><p className="li-muted">เลือกว่าสินค้าในคลังใช้กับช่อง SN ใด ป้องกัน ONU ถูกอ่านเป็น Playbox</p>
   <form onSubmit={e=>{e.preventDefault();save('product-roles',{productId,roles});}}>
    <label>สินค้า<select required value={productId} onChange={e=>{setProductId(e.target.value);setRoles(settings.roles.filter(r=>String(r.product_id)===e.target.value).map(r=>r.role));}}><option value="">เลือกสินค้า</option>{settings.products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <div className="li-role-checks">{[['ONU','ONU'],['PB','Playbox'],['Mesh','Mesh / Mesh เช่า'],['SIM','SIM'],['Cam','IP Camera'],['SOA','SOA']].map(([role,name])=><label key={role} className="li-check"><input type="checkbox" checked={roles.includes(role)} onChange={e=>setRoles(e.target.checked?[...roles,role]:roles.filter(r=>r!==role))}/>{name}</label>)}</div>
    <button disabled={busy} className="li-primary">บันทึกประเภทสินค้า</button>
   </form>
  </section>
  <section className="li-panel li-wide"><h3>รหัสกลุ่มและผู้ส่งที่พบ</h3><p className="li-muted">ให้ช่างส่งข้อความปิดงานตัวอย่างในกลุ่มที่มีบอท แล้วใช้รหัสที่พบตั้งค่าด้านบน รายการก่อนผูกบัญชียังคงรอตรวจ</p>
   {!settings.discovered.length?<p>ยังไม่พบข้อความจาก LINE</p>:<div className="li-table-wrap"><table><thead><tr><th>รหัสกลุ่ม</th><th>รหัสผู้ส่ง</th></tr></thead><tbody>{settings.discovered.map((d,i)=><tr key={i}><td>{d.source_id}</td><td>{d.line_user_id}</td></tr>)}</tbody></table></div>}
  </section>
 </div>;
}

