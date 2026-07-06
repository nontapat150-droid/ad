import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';

export default function EventMessagesTab() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  
  const [formData, setFormData] = useState({
    event_key: '',
    event_label: '',
    message_template: '',
    target_role: 'all',
    is_active: true
  });

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const res = await api.get('/event-messages');
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleToggleActive = async (evt) => {
    try {
      await api.put(`/event-messages/${evt.id}`, {
        ...evt,
        is_active: !evt.is_active
      });
      fetchEvents();
    } catch (err) {
      console.error(err);
      Swal.fire('ผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้', 'error');
    }
  };

  const handleOpenModal = (evt = null) => {
    if (evt) {
      setEditingEvent(evt);
      setFormData({
        event_key: evt.event_key,
        event_label: evt.event_label,
        message_template: evt.message_template,
        target_role: evt.target_role,
        is_active: evt.is_active
      });
    } else {
      setEditingEvent(null);
      setFormData({
        event_key: '',
        event_label: '',
        message_template: '',
        target_role: 'all',
        is_active: true
      });
    }
    setShowModal(true);
  };

  const handleTestEvent = async (evt) => {
    try {
      // ขออนุญาตแจ้งเตือนจากเบราว์เซอร์ถ้ายังไม่เคยอนุญาต (แบบไม่บล็อคโค้ดส่วนอื่น)
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        Promise.resolve(Notification.requestPermission()).catch(console.error);
      }

      await api.post(`/event-messages/${evt.event_key}/test`);
      window.dispatchEvent(new CustomEvent('new_message_alert', {
        detail: {
          title: 'ข้อความอัตโนมัติ ⚡',
          body: `[ทดสอบ] ระบบจำลองเหตุการณ์: ${evt.event_label}`
        }
      }));
      Swal.fire({
        title: 'ส่งข้อความทดสอบแล้ว',
        text: 'ระบบได้จำลองส่งข้อความให้คุณแล้ว หากไม่เห็นป๊อปอัปแจ้งเตือนจากเบราว์เซอร์ กรุณาตรวจสอบว่าได้ "อนุญาต (Allow)" การแจ้งเตือนที่รูปแม่กุญแจบนแถบ URL แล้วหรือยัง',
        icon: 'success',
        confirmButtonColor: '#84cc16'
      });
    } catch (err) {
      console.error('Error testing event:', err);
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถส่งข้อความทดสอบได้', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await api.put(`/event-messages/${editingEvent.id}`, formData);
        Swal.fire('สำเร็จ', 'บันทึกข้อความแล้ว', 'success');
      } else {
        await api.post('/event-messages', formData);
        Swal.fire('สำเร็จ', 'สร้างข้อความเรียบร้อยแล้ว', 'success');
      }
      setShowModal(false);
      fetchEvents();
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
      Swal.fire('ผิดพลาด', `ไม่สามารถบันทึกได้: ${errorMsg}`, 'error');
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'คุณจะไม่สามารถกู้คืนข้อความนี้ได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      confirmButtonText: 'ใช่, ลบเลย',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/event-messages/${id}`);
        Swal.fire('ลบแล้ว!', 'ข้อมูลถูกลบเรียบร้อย', 'success');
        fetchEvents();
      } catch (err) {
        Swal.fire('ผิดพลาด', err.response?.data?.error || 'ไม่สามารถลบได้', 'error');
      }
    }
  };

  const isStandardEvent = (key) => {
    return ['job_dispatch', 'check_in', 'oil_record', 'inventory_dispatch'].includes(key);
  };

  if (loading) {
    return <div className="flex justify-center py-10"><span className="loading loading-spinner text-brand-500 loading-lg"></span></div>;
  }

  return (
    <div className="glass rounded-3xl p-6 shadow-xl border border-white/40 animate-fade-in-up">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4 border-b border-slate-200/50 pb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          ระบบส่งข้อความอัตโนมัติ
        </h2>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-500 hover:bg-brand-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-brand-500/30 transition-all flex items-center gap-2 active:scale-95 text-sm"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          สร้างข้อความใหม่
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((evt) => (
          <div key={evt.id} className="bg-white/60 p-5 rounded-2xl border border-slate-100 shadow-sm relative group hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{evt.event_label}</h3>
                <p className="text-xs text-slate-500 font-mono mt-1">Key: {evt.event_key}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-sm font-bold ${evt.is_active ? 'text-brand-500' : 'text-slate-400'}`}>
                  {evt.is_active ? 'เปิดใช้งาน' : 'ปิด'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={evt.is_active}
                    onChange={() => handleToggleActive(evt)}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-500 shadow-inner"></div>
                </label>
              </div>
            </div>
            
            <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-200/50 mb-4 whitespace-pre-wrap text-sm text-slate-700">
              {evt.message_template}
            </div>

            <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100">
              <span className="badge badge-outline text-xs">ส่งถึง: {evt.target_role === 'target_user' ? 'ผู้ที่เกี่ยวข้อง' : evt.target_role === 'all' ? 'ทุกคน' : evt.target_role}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleTestEvent(evt)}
                  className="btn btn-sm btn-ghost text-blue-500 hover:bg-blue-50 rounded-lg flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  ทดสอบ
                </button>
                <button 
                  onClick={() => handleOpenModal(evt)}
                  className="btn btn-sm btn-ghost text-brand-600 hover:bg-brand-50 rounded-lg flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                  แก้ไข
                </button>
                {!isStandardEvent(evt.event_key) && (
                  <button 
                    onClick={() => handleDelete(evt.id)}
                    className="btn btn-sm btn-ghost text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    ลบ
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingEvent ? 'แก้ไขข้อความ' : 'สร้างข้อความใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="btn btn-sm btn-circle btn-ghost">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
              <div className="space-y-5">
                
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">หัวข้อการแจ้งเตือน</label>
                  <input 
                    type="text" 
                    required 
                    className="input input-bordered w-full rounded-xl bg-slate-50 focus:bg-white transition-colors"
                    value={formData.event_label}
                    onChange={e => setFormData({...formData, event_label: e.target.value})}
                    placeholder="เช่น แจ้งเตือนเมื่อมีการจ่ายงาน"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">รหัสอ้างอิง (สำหรับนักพัฒนา)</label>
                  <input 
                    type="text" 
                    required 
                    disabled={editingEvent && isStandardEvent(editingEvent.event_key)}
                    className="input input-bordered w-full rounded-xl bg-slate-50 focus:bg-white transition-colors font-mono text-sm"
                    value={formData.event_key}
                    onChange={e => setFormData({...formData, event_key: e.target.value})}
                    placeholder="เช่น custom_event_1"
                  />
                  {editingEvent && isStandardEvent(editingEvent.event_key) && (
                     <p className="text-xs text-orange-500 mt-1">* ไม่สามารถแก้ไขรหัสอ้างอิงของระบบได้</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ส่งถึงใคร (Target Role)</label>
                  <select 
                    className="select select-bordered w-full rounded-xl bg-slate-50 focus:bg-white"
                    value={formData.target_role}
                    onChange={e => setFormData({...formData, target_role: e.target.value})}
                  >
                    <option value="all">ทุกคน (All)</option>
                    <option value="target_user">ผู้ที่เกี่ยวข้องกับรายการนี้</option>
                    <option value="admin">แอดมิน (Admin & Super Admin)</option>
                    <option value="technician">ช่าง (Technician)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">รูปแบบข้อความ (Message Template)</label>
                  <textarea 
                    required 
                    rows={4}
                    className="textarea textarea-bordered w-full rounded-xl bg-slate-50 focus:bg-white transition-colors resize-none"
                    value={formData.message_template}
                    onChange={e => setFormData({...formData, message_template: e.target.value})}
                    placeholder="ระบุข้อความที่ต้องการส่ง..."
                  ></textarea>
                  <div className="text-xs text-slate-500 mt-2 bg-slate-100 p-3 rounded-lg">
                    <strong>ตัวแปรที่ใช้ได้:</strong> 
                    <br/>- จ่ายงาน: {'{job_id}'}, {'{tech_name}'}, {'{description}'}
                    <br/>- เช็คอิน: {'{tech_name}'}, {'{location}'}, {'{appointment_time}'}
                    <br/>- น้ำมัน: {'{tech_name}'}, {'{amount}'}
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <input 
                    type="checkbox" 
                    className="toggle toggle-success"
                    checked={formData.is_active}
                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-700">เปิดใช้งานการส่งข้อความนี้</span>
                    <span className="text-xs text-slate-500">หากปิด ระบบจะไม่ส่งข้อความนี้</span>
                  </div>
                </div>

              </div>

              <div className="mt-8 flex gap-3">
                <button type="submit" disabled={loading} className="btn bg-brand-500 hover:bg-brand-600 text-white rounded-xl shadow-lg shadow-brand-500/30">
                  {editingEvent ? 'บันทึกการแก้ไข' : 'สร้างข้อความ'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="btn btn-ghost flex-1 rounded-xl bg-slate-100 hover:bg-slate-200">
                  ยกเลิก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
