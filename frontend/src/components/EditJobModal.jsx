import { useState, useEffect } from 'react';
import api from '../api/axios';
import { AppDateField, AppTimeField, AppSelectField } from './DispatchFilterFields';

// Roles allowed as individual assignee per job type
const OFFICE_ASSIGNEE_ROLES = ['technician', 'office_technician', 'contractor_office'];
const MA_ASSIGNEE_ROLES = ['ma_technician', 'contractor_ma'];

function getUserRoles(u) {
  if (Array.isArray(u.roles)) return u.roles;
  if (u.roles_csv) return String(u.roles_csv).split(',');
  return u.role ? [u.role] : [];
}

export default function EditJobModal({ isOpen, onClose, job, onSuccess, type = 'office' }) {
  const jobType = job?.job_type === 'ma' || type === 'ma' ? 'ma' : 'office';
  const isMa = jobType === 'ma';

  const [formData, setFormData] = useState({
    customer: '',
    phone: '',
    address: '',
    lat: '',
    lng: '',
    team_id: '',
    field_engineer_id: '',
    plan_arrival_date: '',
    plan_arrival_time: '',
    package: '',
    product: '',
    task_type: '',
    service_note: '',
    symptoms: '',
    area_name: '',
    remark: ''
  });
  const [assignMode, setAssignMode] = useState('unassigned'); // 'team' | 'individual' | 'unassigned'
  const [teams, setTeams] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && job) {
      // GET /dispatch/jobs aliases ma_jobs.assigned_user_id → field_engineer_id
      // and ma_jobs.job_time → plan_arrival_time, so both types read the same keys.
      const assigneeId = job.field_engineer_id || job.assigned_user_id || '';
      setFormData({
        customer: job.customer || '',
        phone: job.phone || '',
        address: job.address || '',
        lat: job.lat || '',
        lng: job.lng || '',
        team_id: job.team_id || '',
        field_engineer_id: assigneeId,
        plan_arrival_date: job.plan_arrival_date ? job.plan_arrival_date.split('T')[0] : '',
        plan_arrival_time: job.plan_arrival_time 
          ? (job.plan_arrival_time.includes('T') ? job.plan_arrival_time.split('T')[1].substring(0, 5) : 
             job.plan_arrival_time.includes(' ') ? job.plan_arrival_time.split(' ')[1].substring(0, 5) : 
             job.plan_arrival_time.substring(0, 5))
          : '',
        package: job.package || '',
        product: job.product || '',
        task_type: job.task_type || '',
        service_note: job.service_note || '',
        symptoms: job.symptoms || '',
        area_name: job.area_name || '',
        remark: job.remark || ''
      });
      setAssignMode(assigneeId ? 'individual' : (job.team_id ? 'team' : 'unassigned'));
      fetchData();
    }
  }, [isOpen, job]);

  const fetchData = async () => {
    try {
      const [teamRes, usersRes] = await Promise.all([
        api.get('/users/teams').catch(() => ({ data: [] })),
        api.get('/users').catch(() => ({ data: [] }))
      ]);
      setTeams(teamRes.data);
      const assigneeRoles = isMa ? MA_ASSIGNEE_ROLES : OFFICE_ASSIGNEE_ROLES;
      setTechs((usersRes.data || []).filter(u => getUserRoles(u).some(r => assigneeRoles.includes(r))));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignModeChange = (mode) => {
    setAssignMode(mode);
    setFormData(prev => ({ ...prev, team_id: '', field_engineer_id: '' }));
  };

  // Team mode: set team only. No auto/random tech assignment — the admin must
  // pick a person explicitly via the individual mode.
  const handleTeamChange = (newTeamId) => {
    setFormData(prev => ({ ...prev, team_id: newTeamId, field_engineer_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      // Resolve assignment from the selected mode
      let teamId = assignMode === 'team' ? formData.team_id || null : null;
      const assigneeId = assignMode === 'individual' ? formData.field_engineer_id || null : null;
      if (assigneeId) {
        const assignee = techs.find(t => String(t.id) === String(assigneeId));
        const isContractor = assignee && getUserRoles(assignee).some(r => ['contractor_office', 'contractor_ma'].includes(r));
        teamId = !isContractor && assignee?.team_id ? assignee.team_id : null;
      }

      const payload = { ...formData, type: jobType, team_id: teamId, field_engineer_id: assigneeId };
      if (isMa) {
        // ma_jobs uses assigned_user_id + job_time instead of the office column names
        payload.assigned_user_id = assigneeId;
        payload.job_time = formData.plan_arrival_time || null;
      }
      await api.put(`/dispatch/jobs/${job.id}`, payload);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const serverError = err.response?.data?.details || err.response?.data?.error || 'ไม่สามารถบันทึกข้อมูลได้';
      setError(serverError);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass border border-white/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 bg-white/40">
          <h2 className="text-[#042C53] font-bold text-lg">
            แก้ไขข้อมูลงาน{isMa ? ' MA' : ''} {isMa ? (job.non_number || job.display_non || job.access_no) : job.access_no}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass border border-white/50 flex items-center justify-center text-[#042C53] hover:bg-white/50 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
          {error && <div className="p-3 bg-red-100 text-red-600 rounded-xl text-sm font-medium">{error}</div>}
          
          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">ชื่อลูกค้า</label>
            <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
              value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AppDateField
              label="วันที่นัดหมาย"
              value={formData.plan_arrival_date}
              onChange={(v) => setFormData({ ...formData, plan_arrival_date: v })}
            />
            <AppTimeField
              label="เวลานัดหมาย"
              value={formData.plan_arrival_time}
              onChange={(v) => setFormData({ ...formData, plan_arrival_time: v })}
            />
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">เบอร์โทร</label>
            <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
              value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">พื้นที่ / ที่อยู่</label>
            <textarea className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50 resize-none h-24"
              value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})}></textarea>
          </div>

          {isMa ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">อาการ / ปัญหา (Symptoms)</label>
                <textarea className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50 resize-none h-20"
                  value={formData.symptoms} onChange={e => setFormData({...formData, symptoms: e.target.value})} placeholder="อาการเสีย / ปัญหาที่ลูกค้าแจ้ง"></textarea>
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">พื้นที่ (Area Name)</label>
                <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                  value={formData.area_name} onChange={e => setFormData({...formData, area_name: e.target.value})} />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#042C53] mb-1">แพ็กเกจ (Package)</label>
                  <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                    value={formData.package} onChange={e => setFormData({...formData, package: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#042C53] mb-1">สินค้า (Product)</label>
                  <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                    value={formData.product} onChange={e => setFormData({...formData, product: e.target.value})} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">ประเภทงาน (Task Type)</label>
                <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                  value={formData.task_type} onChange={e => setFormData({...formData, task_type: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">รายละเอียดงาน (Service Note)</label>
                <textarea className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50 resize-none h-20"
                  value={formData.service_note} onChange={e => setFormData({...formData, service_note: e.target.value})} placeholder="รายละเอียดของงาน/ISP"></textarea>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">หมายเหตุ (Remark)</label>
            <textarea className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50 resize-none h-20"
              value={formData.remark} onChange={e => setFormData({...formData, remark: e.target.value})} placeholder="หมายเหตุเพิ่มเติม"></textarea>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#042C53] mb-1">ละติจูด (Lat)</label>
              <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                value={formData.lat} onChange={e => setFormData({...formData, lat: e.target.value})} placeholder="เช่น 9.12345" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#042C53] mb-1">ลองจิจูด (Lng)</label>
              <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                value={formData.lng} onChange={e => setFormData({...formData, lng: e.target.value})} placeholder="เช่น 99.12345" />
            </div>
          </div>
          
          <button 
            type="button" 
            onClick={() => {
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (position) => {
                    setFormData(prev => ({
                      ...prev,
                      lat: position.coords.latitude.toFixed(6),
                      lng: position.coords.longitude.toFixed(6)
                    }));
                  },
                  (err) => {
                    console.error(err);
                    setError('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง');
                  }
                );
              } else {
                setError('เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่ง');
              }
            }}
            className="w-full py-2.5 rounded-xl border border-brand-500 text-brand-600 font-semibold hover:bg-brand-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            จับตำแหน่งปัจจุบัน
          </button>

          <div className="pt-2 border-t border-white/30">
            <label className="block text-sm font-semibold text-[#042C53] mb-2">การมอบหมายงาน</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { key: 'team', label: '👥 ทีม' },
                { key: 'individual', label: '👤 รายบุคคล' },
                { key: 'unassigned', label: '⏳ ยังไม่มอบหมาย' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleAssignModeChange(opt.key)}
                  className={`px-2 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    assignMode === opt.key
                      ? 'border-[#378ADD] bg-[#378ADD]/10 text-[#042C53]'
                      : 'border-white/60 bg-white/40 text-[#6B7280] hover:border-[#378ADD]/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {assignMode === 'team' && (
              <AppSelectField
                label="ทีมที่รับผิดชอบ"
                value={String(formData.team_id || '')}
                onChange={handleTeamChange}
                options={teams.map((t) => ({ value: String(t.id), label: t.team_name }))}
                placeholder="เลือกทีม"
                searchable
              />
            )}

            {assignMode === 'individual' && (
              <AppSelectField
                label={isMa ? 'ช่าง MA / รับเหมา MA' : 'ช่างติดตั้ง / รับเหมาติดตั้ง'}
                value={String(formData.field_engineer_id || '')}
                onChange={(techId) => setFormData((prev) => ({ ...prev, field_engineer_id: techId, team_id: '' }))}
                options={techs.map((t) => ({ value: String(t.id), label: t.full_name }))}
                placeholder="เลือกผู้รับผิดชอบ"
                searchable
              />
            )}

            {assignMode === 'unassigned' && (
              <p className="text-xs text-[#6B7280] font-medium px-1">งานจะถูกล้างทีม/ผู้รับผิดชอบออก สามารถมอบหมายใหม่ภายหลังได้</p>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-white/30 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#378ADD]/30 text-[#042C53] font-semibold hover:bg-white/50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#185FA5] to-[#378ADD] text-white font-bold shadow-lg shadow-[#378ADD]/30 hover:shadow-[#378ADD]/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
