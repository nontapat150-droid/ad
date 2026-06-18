import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function EditJobModal({ isOpen, onClose, job, onSuccess, type = 'office' }) {
  const [formData, setFormData] = useState({
    customer: '',
    phone: '',
    address: '',
    lat: '',
    lng: '',
    team_id: '',
    field_engineer_id: '',
    plan_arrival_date: '',
    plan_arrival_time: ''
  });
  const [teams, setTeams] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && job) {
      setFormData({
        customer: job.customer || '',
        phone: job.phone || '',
        address: job.address || '',
        lat: job.lat || '',
        lng: job.lng || '',
        team_id: job.team_id || '',
        field_engineer_id: job.field_engineer_id || '',
        plan_arrival_date: job.plan_arrival_date ? job.plan_arrival_date.split('T')[0] : '',
        plan_arrival_time: job.plan_arrival_time || ''
      });
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
      setTechs(usersRes.data.filter(u => u.roles && u.roles.includes('technician')));
    } catch (err) {
      console.error(err);
    }
  };

  const handleTeamChange = (e) => {
    const newTeamId = e.target.value;
    const updates = { team_id: newTeamId };

    if (newTeamId) {
      // Find all technicians belonging to the selected team
      const teamTechs = techs.filter(t => String(t.team_id) === String(newTeamId));
      if (teamTechs.length > 0) {
        // Pick one randomly
        const randomTech = teamTechs[Math.floor(Math.random() * teamTechs.length)];
        updates.field_engineer_id = randomTech.id;
      } else {
        updates.field_engineer_id = ''; // Clear if no techs in team
      }
    } else {
      // Clear both if team is deselected
      updates.field_engineer_id = '';
    }

    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await api.put(`/dispatch/jobs/${job.id}`, { ...formData, type });
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
      <div className="relative w-full max-w-md glass border border-white/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 bg-white/40">
          <h2 className="text-[#042C53] font-bold text-lg">แก้ไขข้อมูลงาน {job.access_no}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass border border-white/50 flex items-center justify-center text-[#042C53] hover:bg-white/50 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {error && <div className="p-3 bg-red-100 text-red-600 rounded-xl text-sm font-medium">{error}</div>}
          
          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">ชื่อลูกค้า</label>
            <input type="text" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
              value={formData.customer} onChange={e => setFormData({...formData, customer: e.target.value})} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#042C53] mb-1">วันที่นัดหมาย</label>
              <input type="date" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                value={formData.plan_arrival_date} onChange={e => setFormData({...formData, plan_arrival_date: e.target.value})} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#042C53] mb-1">เวลานัดหมาย</label>
              <input type="time" className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                value={formData.plan_arrival_time} onChange={e => setFormData({...formData, plan_arrival_time: e.target.value})} />
            </div>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-[#042C53] mb-1">ทีมที่รับผิดชอบ</label>
              <select className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                value={formData.team_id} onChange={handleTeamChange}>
                <option value="">-- ยังไม่ระบุทีม --</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.team_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#042C53] mb-1">ช่างเทคนิค</label>
              <select className="w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50"
                value={formData.field_engineer_id} onChange={(e) => {
                  const techId = e.target.value;
                  const updates = { field_engineer_id: techId };
                  if (techId) {
                    const selectedTech = techs.find(t => String(t.id) === String(techId));
                    if (selectedTech && selectedTech.team_id) {
                      updates.team_id = selectedTech.team_id;
                    }
                  }
                  setFormData(prev => ({ ...prev, ...updates }));
                }}>
                <option value="">-- ยังไม่ระบุช่าง --</option>
                {techs
                  .filter(t => !formData.team_id || String(t.team_id) === String(formData.team_id))
                  .map(t => (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
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
