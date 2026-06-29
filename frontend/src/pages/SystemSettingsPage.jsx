import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';

export default function SystemSettingsPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({
    message: '',
    target_role: 'all',
    target_users: [],
    schedule_type: 'daily', // minutes, hourly, daily, weekly, custom
    time_value: '09:00', // HH:MM for daily/weekly
    day_value: '1', // 1=Mon...7=Sun for weekly
    interval_value: '30', // every X minutes/hours
    cron_expression: '0 9 * * *',
    is_active: true
  });

  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const res = await api.get('/scheduled-messages');
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };



  const handleOpenModal = (msg = null) => {
    if (msg) {
      setEditingId(msg.id);
      
      // Determine schedule_type from cron_expression (simplified parsing)
      let stype = 'custom';
      let tval = '09:00';
      let dval = '1';
      let ival = '30';
      
      const parts = msg.cron_expression.split(' ');
      if (parts.length === 5) {
        if (parts[0].startsWith('*/') && parts[1] === '*' && parts[2] === '*') {
          stype = 'minutes';
          ival = parts[0].replace('*/', '');
        } else if (parts[0] === '0' && parts[1].startsWith('*/')) {
          stype = 'hourly';
          ival = parts[1].replace('*/', '');
        } else if (parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
          stype = 'daily';
          tval = `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`;
        } else if (parts[2] === '*' && parts[3] === '*' && parts[4] !== '*') {
          stype = 'weekly';
          tval = `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`;
          dval = parts[4];
        }
      }

      setFormData({
        message: msg.message,
        target_role: msg.target_role,
        target_users: msg.target_users ? JSON.parse(msg.target_users) : [],
        schedule_type: stype,
        time_value: tval,
        day_value: dval,
        interval_value: ival,
        cron_expression: msg.cron_expression,
        is_active: msg.is_active
      });
    } else {
      setEditingId(null);
      setFormData({
        message: '',
        target_role: 'all',
        target_users: [],
        schedule_type: 'daily',
        time_value: '09:00',
        day_value: '1',
        interval_value: '30',
        cron_expression: '0 9 * * *',
        is_active: true
      });
    }
    setShowModal(true);
  };

  const generateCron = () => {
    const { schedule_type, time_value, day_value, interval_value } = formData;
    let cron = '0 9 * * *';
    
    if (schedule_type === 'minutes') {
      cron = `*/${interval_value || 30} * * * *`;
    } else if (schedule_type === 'hourly') {
      cron = `0 */${interval_value || 1} * * *`;
    } else if (schedule_type === 'daily') {
      const [h, m] = (time_value || '09:00').split(':');
      cron = `${Number(m)} ${Number(h)} * * *`;
    } else if (schedule_type === 'weekly') {
      const [h, m] = (time_value || '09:00').split(':');
      cron = `${Number(m)} ${Number(h)} * * ${day_value}`;
    } else {
      cron = formData.cron_expression; // custom
    }
    return cron;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const cronExp = generateCron();
      const payload = {
        ...formData,
        cron_expression: cronExp,
      };

      if (editingId) {
        await api.put(`/scheduled-messages/${editingId}`, payload);
        Swal.fire('สำเร็จ', 'แก้ไขข้อความอัตโนมัติแล้ว', 'success');
      } else {
        await api.post('/scheduled-messages', payload);
        Swal.fire('สำเร็จ', 'สร้างข้อความอัตโนมัติแล้ว', 'success');
      }
      setShowModal(false);
      fetchMessages();
    } catch (err) {
      Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกข้อมูลได้', 'error');
    }
  };

  const handleToggleActive = async (msg) => {
    try {
      await api.put(`/scheduled-messages/${msg.id}`, {
        ...msg,
        is_active: !msg.is_active
      });
      fetchMessages();
    } catch (err) {
      console.error(err);
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
        await api.delete(`/scheduled-messages/${id}`);
        Swal.fire('ลบแล้ว!', 'ข้อมูลถูกลบเรียบร้อย', 'success');
        fetchMessages();
      } catch (err) {
        Swal.fire('ผิดพลาด', 'ไม่สามารถลบได้', 'error');
      }
    }
  };



  const translateCron = (cron) => {
    // Very basic translation for UI display
    if (cron.startsWith('*/') && cron.endsWith('* * * *')) return `ทุกๆ ${cron.split(' ')[0].replace('*/','')} นาที`;
    if (cron.startsWith('0 */') && cron.endsWith('* * *')) return `ทุกๆ ${cron.split(' ')[1].replace('*/','')} ชั่วโมง`;
    
    const parts = cron.split(' ');
    if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] === '*') {
      return `ทุกวัน เวลา ${parts[1].padStart(2,'0')}:${parts[0].padStart(2,'0')} น.`;
    }
    if (parts.length === 5 && parts[2] === '*' && parts[3] === '*' && parts[4] !== '*') {
      const days = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
      return `ทุกวัน${days[parts[4]]} เวลา ${parts[1].padStart(2,'0')}:${parts[0].padStart(2,'0')} น.`;
    }
    return cron;
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto min-h-screen pt-24 animate-fade-in-up">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 drop-shadow-sm">ตั้งค่าระบบ</h1>
          <p className="text-slate-500 mt-2 font-medium">จัดการข้อความอัตโนมัติและการตั้งค่าอื่นๆ</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="bg-brand-500 hover:bg-brand-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-brand-500/30 transition-all flex items-center gap-2 active:scale-95"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
          สร้างข้อความอัตโนมัติ
        </button>
      </div>

      <div className="glass rounded-3xl p-6 shadow-xl border border-white/40">
        <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <svg className="w-6 h-6 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
          รายการข้อความอัตโนมัติ
        </h2>

        {loading ? (
          <div className="flex justify-center py-10"><span className="loading loading-spinner text-brand-500 loading-lg"></span></div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 bg-white/30 rounded-2xl border border-white/50">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-slate-600 font-medium">ยังไม่มีข้อความอัตโนมัติ</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {messages.map(msg => (
              <div key={msg.id} className="bg-white/60 p-5 rounded-2xl border border-white hover:shadow-lg transition-all relative overflow-hidden group">
                <div className={`absolute top-0 left-0 w-1.5 h-full ${msg.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                
                <div className="flex justify-between items-start mb-3 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-md bg-brand-100 text-brand-700">
                      {msg.target_role === 'all' ? 'ทุกคน' : msg.target_role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : msg.target_role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggleActive(msg)} className="text-xs font-bold flex items-center gap-1 hover:opacity-80">
                      {msg.is_active ? (
                        <span className="text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">เปิดใช้งาน</span>
                      ) : (
                        <span className="text-slate-500 bg-slate-200 px-2 py-1 rounded-md">ปิดใช้งาน</span>
                      )}
                    </button>
                  </div>
                </div>

                <p className="text-slate-700 text-sm mb-4 line-clamp-3 pl-2 whitespace-pre-wrap font-medium">
                  "{msg.message}"
                </p>

                <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-200/60 pl-2">
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    {translateCron(msg.cron_expression)}
                  </span>
                  
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenModal(msg)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                    </button>
                    <button onClick={() => handleDelete(msg.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
              <h3 className="text-xl font-bold text-slate-800">
                {editingId ? 'แก้ไขข้อความอัตโนมัติ' : 'สร้างข้อความอัตโนมัติ'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-xl border shadow-sm">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              <form id="scheduleForm" onSubmit={handleSubmit} className="space-y-5">
                
                {/* Target */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">กลุ่มเป้าหมาย</label>
                  <select 
                    value={formData.target_role}
                    onChange={(e) => setFormData({...formData, target_role: e.target.value})}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-slate-700 bg-slate-50"
                  >
                    <option value="all">ส่งให้ทุกคน</option>
                    <option value="technician">ช่าง Office</option>
                    <option value="ma_technician">ทีม MA</option>
                    <option value="sales">เซลส์</option>
                    <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                  </select>
                </div>

                {/* Schedule Options */}
                <div className="p-5 bg-brand-50 rounded-2xl border border-brand-100">
                  <label className="block text-sm font-bold text-brand-900 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    ตั้งเวลาส่ง
                  </label>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                    {['minutes', 'hourly', 'daily', 'weekly'].map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setFormData({...formData, schedule_type: type})}
                        className={`py-2 px-3 text-xs font-bold rounded-lg transition-all ${
                          formData.schedule_type === type 
                            ? 'bg-brand-500 text-white shadow-md' 
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {type === 'minutes' ? 'รายนาที' : type === 'hourly' ? 'รายชั่วโมง' : type === 'daily' ? 'ทุกวัน' : 'ทุกสัปดาห์'}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setFormData({...formData, schedule_type: 'custom'})}
                      className={`py-2 px-3 text-xs font-bold rounded-lg transition-all col-span-2 sm:col-span-4 ${
                        formData.schedule_type === 'custom' 
                          ? 'bg-slate-700 text-white shadow-md' 
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      กำหนด Cron เอง
                    </button>
                  </div>

                  {formData.schedule_type === 'minutes' && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">ส่งทุกๆ</span>
                      <input type="number" min="1" max="59" value={formData.interval_value} onChange={(e) => setFormData({...formData, interval_value: e.target.value})} className="w-20 px-3 py-2 rounded-lg border text-center font-bold" />
                      <span className="text-sm font-medium">นาที</span>
                    </div>
                  )}

                  {formData.schedule_type === 'hourly' && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">ส่งทุกๆ</span>
                      <input type="number" min="1" max="23" value={formData.interval_value} onChange={(e) => setFormData({...formData, interval_value: e.target.value})} className="w-20 px-3 py-2 rounded-lg border text-center font-bold" />
                      <span className="text-sm font-medium">ชั่วโมง</span>
                    </div>
                  )}

                  {formData.schedule_type === 'daily' && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">เวลา</span>
                      <input type="time" value={formData.time_value} onChange={(e) => setFormData({...formData, time_value: e.target.value})} className="px-4 py-2 rounded-lg border font-bold text-brand-700" />
                    </div>
                  )}

                  {formData.schedule_type === 'weekly' && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-medium">วัน</span>
                      <select value={formData.day_value} onChange={(e) => setFormData({...formData, day_value: e.target.value})} className="px-3 py-2 rounded-lg border font-bold">
                        <option value="1">จันทร์</option>
                        <option value="2">อังคาร</option>
                        <option value="3">พุธ</option>
                        <option value="4">พฤหัส</option>
                        <option value="5">ศุกร์</option>
                        <option value="6">เสาร์</option>
                        <option value="0">อาทิตย์</option>
                      </select>
                      <span className="text-sm font-medium ml-2">เวลา</span>
                      <input type="time" value={formData.time_value} onChange={(e) => setFormData({...formData, time_value: e.target.value})} className="px-4 py-2 rounded-lg border font-bold text-brand-700" />
                    </div>
                  )}

                  {formData.schedule_type === 'custom' && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">Cron Exp:</span>
                      <input type="text" value={formData.cron_expression} onChange={(e) => setFormData({...formData, cron_expression: e.target.value})} className="flex-1 px-4 py-2 rounded-lg border font-mono font-bold text-sm" placeholder="* * * * *" />
                    </div>
                  )}
                  
                  <p className="text-xs text-brand-600 mt-3 font-semibold bg-white/50 inline-block px-3 py-1 rounded-full border border-brand-200">
                    สรุป: ระบบจะทำงานรูปแบบ "{translateCron(generateCron())}"
                  </p>
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">ข้อความที่ต้องการส่ง</label>
                  <textarea 
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    required
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 outline-none text-slate-700 bg-slate-50 resize-none"
                    placeholder="พิมพ์ข้อความแจ้งเตือนที่นี่..."
                  ></textarea>
                </div>

              </form>
            </div>
            
            <div className="p-6 border-t bg-slate-50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowModal(false)} className="px-6 py-2.5 rounded-xl font-bold text-slate-500 hover:bg-slate-200 transition-colors">
                ยกเลิก
              </button>
              <button type="submit" form="scheduleForm" className="px-6 py-2.5 rounded-xl font-bold text-white bg-brand-500 hover:bg-brand-600 shadow-lg shadow-brand-500/30 transition-all active:scale-95">
                บันทึกข้อความอัตโนมัติ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
