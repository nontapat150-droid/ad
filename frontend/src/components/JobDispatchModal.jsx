import { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';

export default function JobDispatchModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  // Form State (13 fields as requested)
  const initialForm = {
    access_no: '',
    customer: '',
    phone: '',
    plan_arrival_date: '',
    plan_arrival_time: '',
    address: '',
    lat: '',
    lng: '',
    package: '',
    product: '',
    order_no: '',
    customer_order_no: '',
    task_order: '',
    task_type: '',
    product_owner: '',
    province: '',
    area_code: '',
    area_name: '',
    service_note: '',
    team_id: '',
    field_engineer_id: '',
    remark: ''
  };

  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm);
      fetchDropdownData();
    }
  }, [isOpen]);

  const fetchDropdownData = async () => {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        axios.get('/users').catch(() => ({ data: [] })),
        axios.get('/users/teams').catch(() => ({ data: [] }))
      ]);
      const techs = (usersRes.data || []).filter(u => u.roles?.includes('technician') || u.role === 'technician');
      setUsers(techs);
      setTeams(teamsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch dropdowns', err);
    }
  };

  const handleTeamChange = (e) => {
    const newTeamId = e.target.value;
    const updates = { team_id: newTeamId };

    if (newTeamId) {
      const teamTechs = users.filter(t => String(t.team_id) === String(newTeamId));
      if (teamTechs.length > 0) {
        const randomTech = teamTechs[Math.floor(Math.random() * teamTechs.length)];
        updates.field_engineer_id = randomTech.id;
      } else {
        updates.field_engineer_id = '';
      }
    } else {
      updates.field_engineer_id = '';
    }

    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleTechChange = (e) => {
    const techId = e.target.value;
    const updates = { field_engineer_id: techId };
    if (techId) {
      const selectedTech = users.find(u => String(u.id) === String(techId));
      if (selectedTech && selectedTech.team_id) {
        updates.team_id = selectedTech.team_id;
      }
    }
    setForm(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.access_no) {
      Swal.fire({ icon: 'warning', title: 'กรุณากรอก Access Number', confirmButtonColor: '#10b981' });
      return;
    }

    setLoading(true);
    try {
      await axios.post('/dispatch/jobs', form);
      Swal.fire({
        icon: 'success',
        title: 'บันทึกข้อมูลสำเร็จ!',
        text: 'เพิ่มงานเข้าสู่ระบบเรียบร้อยแล้ว',
        timer: 2000,
        showConfirmButton: false
      });
      onSuccess();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      Swal.fire({
        icon: 'error',
        title: 'ไม่สามารถบันทึกได้',
        text: msg,
        confirmButtonColor: '#10b981'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-4 md:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative glass w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-8 py-5 border-b border-white/30 flex justify-between items-center glass shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#E6F1FB] text-[#185FA5] rounded-2xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#042C53]">เพิ่มข้อมูลด้วยตัวเอง (Manual Entry)</h2>
              <p className="text-sm text-[#378ADD] font-medium">กรอกข้อมูลที่จำเป็นเพื่อเพิ่มงานใหม่เข้าสู่ระบบ</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-[#378ADD] opacity-80 hover:glass hover:text-[#185FA5] rounded-xl transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form Body */}
        <form id="dispatchForm" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-8 ">
          <div className="glass rounded-2xl border border-white/50 p-4 md:p-6 shadow-sm">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
              
              <Field label="Access No" name="access_no" value={form.access_no} onChange={handleChange} required placeholder="เช่น 880xxxxxxx" />
              <Field label="ชื่อลูกค้า" name="customer" value={form.customer} onChange={handleChange} placeholder="ระบุชื่อลูกค้า" />
              <Field label="เบอร์โทรศัพท์" name="phone" value={form.phone} onChange={handleChange} placeholder="ระบุเบอร์ติดต่อ" />
              <Field label="วันที่เข้าทำ (Plan Date)" name="plan_arrival_date" value={form.plan_arrival_date} onChange={handleChange} type="date" />
              <Field label="เวลานัด (Plan Time)" name="plan_arrival_time" value={form.plan_arrival_time} onChange={handleChange} type="time" />
              
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-[#042C53] mb-2">สถานที่ติดตั้ง/ที่อยู่</label>
                <textarea 
                  name="address" 
                  value={form.address} 
                  onChange={handleChange} 
                  rows="2" 
                  placeholder="ระบุที่อยู่ครบถ้วน"
                  className="w-full px-4 py-3 border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500  hover:glass/50 focus:glass/50 transition-all outline-none"
                ></textarea>
              </div>

              <Field label="ละติจูด (Latitude)" name="lat" value={form.lat} onChange={handleChange} type="number" step="any" placeholder="เช่น 13.7563" />
              <Field label="ลองติจูด (Longitude)" name="lng" value={form.lng} onChange={handleChange} type="number" step="any" placeholder="เช่น 100.5018" />
              <Field label="แพ็กเกจ (Package)" name="package" value={form.package} onChange={handleChange} />
              <Field label="สินค้า (Product)" name="product" value={form.product} onChange={handleChange} />
              <Field label="Order No" name="order_no" value={form.order_no} onChange={handleChange} />
              <Field label="Customer Order No" name="customer_order_no" value={form.customer_order_no} onChange={handleChange} />
              <Field label="Task Order" name="task_order" value={form.task_order} onChange={handleChange} />
              <Field label="ประเภทงาน (Task Type)" name="task_type" value={form.task_type} onChange={handleChange} />
              <Field label="Product Owner" name="product_owner" value={form.product_owner} onChange={handleChange} />
              <Field label="จังหวัด (Province)" name="province" value={form.province} onChange={handleChange} />
              <Field label="Area Code" name="area_code" value={form.area_code} onChange={handleChange} />
              <Field label="Area Name" name="area_name" value={form.area_name} onChange={handleChange} />

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-[#042C53] mb-2">Service Note</label>
                <textarea
                  name="service_note"
                  value={form.service_note}
                  onChange={handleChange}
                  rows="2"
                  placeholder="หมายเหตุบริการ / ISP"
                  className="w-full px-4 py-3 border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 hover:glass/50 focus:glass/50 transition-all outline-none"
                />
              </div>

              <div className="col-span-1 md:col-span-2 border-t border-white/30 pt-6 mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#042C53] mb-2">ทีมที่รับผิดชอบ</label>
                  <div className="relative">
                    <select 
                      name="team_id" 
                      value={form.team_id || ''} 
                      onChange={handleTeamChange} 
                      className="w-full px-4 py-3 border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500  hover:glass/50 focus:glass/50 transition-all outline-none appearance-none font-medium text-[#042C53]"
                    >
                      <option value="">-- ยังไม่ระบุทีม --</option>
                      {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#378ADD] opacity-80">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-[#042C53] mb-2">ช่างติดตั้ง (เฉพาะช่างติดตั้ง)</label>
                  <div className="relative">
                    <select 
                      name="field_engineer_id" 
                      value={form.field_engineer_id} 
                      onChange={handleTechChange} 
                      className="w-full px-4 py-3 border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500  hover:glass/50 focus:glass/50 transition-all outline-none appearance-none font-medium text-[#042C53]"
                    >
                      <option value="">-- เลือกช่างติดตั้ง --</option>
                      {users
                        .filter(u => !form.team_id || String(u.team_id) === String(form.team_id))
                        .map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-[#378ADD] opacity-80">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-bold text-[#042C53] mb-2">หมายเหตุ (Remark)</label>
                <textarea 
                  name="remark" 
                  value={form.remark} 
                  onChange={handleChange} 
                  rows="2" 
                  placeholder="ระบุข้อมูลเพิ่มเติม (ถ้ามี)"
                  className="w-full px-4 py-3 border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500  hover:glass/50 focus:glass/50 transition-all outline-none"
                ></textarea>
              </div>

            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-white/30 glass flex justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="px-6 py-3 text-sm font-bold text-[#185FA5] glass rounded-xl hover:bg-[#E6F1FB] transition-colors"
          >
            ยกเลิก
          </button>
          <button 
            type="submit" 
            form="dispatchForm"
            disabled={loading}
            className="px-8 py-3 text-sm font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#185FA5]/20 transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                กำลังบันทึก...
              </>
            ) : 'บันทึกข้อมูล'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Helper Sub-component ──
function Field({ label, name, value, onChange, type = 'text', step, required, placeholder }) {
  return (
    <div className="col-span-1">
      <label className="block text-sm font-bold text-[#042C53] mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input 
        type={type} 
        step={step}
        name={name} 
        value={value} 
        onChange={onChange} 
        required={required}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500  hover:glass/50 focus:glass/50 transition-all outline-none"
      />
    </div>
  );
}
