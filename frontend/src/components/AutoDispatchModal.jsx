import { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';

export default function AutoDispatchModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState({ unassignedJobsCount: 0, totalTeams: 0, teams: [] });
  
  // State for team selection and quotas: { [team_id]: { selected: boolean, count: number } }
  const [teamConfig, setTeamConfig] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchSummary();
    }
  }, [isOpen]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/dispatch/summary');
      setSummary(res.data);
      
      // Initialize team config
      const initialConfig = {};
      if (res.data.teams) {
        res.data.teams.forEach(team => {
          initialConfig[team.id] = { selected: false, count: 5 }; // Default 5 jobs
        });
      }
      setTeamConfig(initialConfig);
    } catch (err) {
      console.error('Failed to fetch summary', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTeam = (teamId) => {
    setTeamConfig(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], selected: !prev[teamId].selected }
    }));
  };

  const handleQuotaChange = (teamId, value) => {
    setTeamConfig(prev => ({
      ...prev,
      [teamId]: { ...prev[teamId], count: parseInt(value, 10) || 0 }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (summary.unassignedJobsCount === 0) {
      Swal.fire({ icon: 'info', title: 'ไม่มีงานที่ต้องแจกจ่าย', confirmButtonColor: '#10b981' });
      return;
    }

    // Build the payload
    const teamQuotas = [];
    let totalRequested = 0;

    Object.keys(teamConfig).forEach(teamId => {
      const config = teamConfig[teamId];
      if (config.selected && config.count > 0) {
        teamQuotas.push({ team_id: parseInt(teamId, 10), count: config.count });
        totalRequested += config.count;
      }
    });

    if (teamQuotas.length === 0) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกทีมและจำนวนงาน', confirmButtonColor: '#10b981' });
      return;
    }

    if (totalRequested > summary.unassignedJobsCount) {
      Swal.fire({ 
        icon: 'error', 
        title: 'จำนวนงานเกินโควต้า', 
        text: `คุณของานรวม ${totalRequested} งาน แต่งานในระบบมีเพียง ${summary.unassignedJobsCount} งาน`,
        confirmButtonColor: '#10b981' 
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/dispatch/auto-assign', { teamQuotas });
      Swal.fire({
        icon: 'success',
        title: 'แจกจ่ายงานอัจฉริยะสำเร็จ!',
        text: `แจกจ่ายไปแล้ว ${res.data.assignedCount} งาน (เหลือ ${res.data.remainingJobs} งาน)`,
        confirmButtonColor: '#10b981'
      });
      if (typeof onSuccess === 'function') onSuccess();
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'เกิดข้อผิดพลาดในการแจกจ่ายงาน';
      Swal.fire({
        icon: 'error',
        title: 'ล้มเหลว',
        text: msg,
        confirmButtonColor: '#10b981'
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  // Calculate totals for UI
  let totalRequested = 0;
  let selectedTeamsCount = 0;
  Object.values(teamConfig).forEach(c => {
    if (c.selected) {
      selectedTeamsCount++;
      totalRequested += c.count;
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative glass w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/50 flex justify-between items-center  shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#B5D4F4] text-[#185FA5] rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#042C53]">แจกจ่ายงานอัจฉริยะ</h2>
              <p className="text-xs text-[#378ADD]">จัดกลุ่มพื้นที่และสร้างเส้นทางให้ทีม</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#378ADD] opacity-80 hover:text-[#185FA5] transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 glass/20">
          {loading ? (
            <div className="flex justify-center items-center h-24">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-center">
                  <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">งานที่รอจ่าย</p>
                  <p className="text-3xl font-extrabold text-amber-700">{summary.unassignedJobsCount}</p>
                </div>
                <div className={`rounded-xl p-4 text-center border ${totalRequested > summary.unassignedJobsCount ? 'bg-red-50 border-red-200' : 'bg-[#E6F1FB] border-brand-100'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-1 ${totalRequested > summary.unassignedJobsCount ? 'text-red-600' : 'text-[#185FA5]'}`}>
                    จำนวนงานที่เลือก
                  </p>
                  <p className={`text-3xl font-extrabold ${totalRequested > summary.unassignedJobsCount ? 'text-red-700' : 'text-[#0C447C]'}`}>
                    {totalRequested}
                  </p>
                </div>
              </div>

              <div className="glass border border-white/50 rounded-xl overflow-hidden shadow-sm">
                <div className="glass px-4 py-3 border-b border-white/50 flex justify-between items-center">
                  <h3 className="font-bold text-[#042C53] text-sm">เลือกทีมและจำนวนงาน</h3>
                  <span className="text-xs text-[#378ADD] font-medium glass px-2 py-1 rounded-md border border-white/50">
                    เลือกแล้ว {selectedTeamsCount} ทีม
                  </span>
                </div>
                <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {summary.teams?.length > 0 ? (
                    summary.teams.map(team => (
                      <label key={team.id} className={`flex items-center justify-between p-3 cursor-pointer hover: transition-colors ${teamConfig[team.id]?.selected ? 'bg-[#E6F1FB]/30' : ''}`}>
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox" 
                            checked={teamConfig[team.id]?.selected || false}
                            onChange={() => handleToggleTeam(team.id)}
                            className="w-5 h-5 text-[#185FA5] rounded border-slate-300 focus:ring-brand-500"
                          />
                          <span className="font-semibold text-[#042C53] text-sm">{team.team_name}</span>
                        </div>
                        {teamConfig[team.id]?.selected && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-[#378ADD]">จำนวน:</span>
                            <input 
                              type="number"
                              min="1"
                              value={teamConfig[team.id]?.count || ''}
                              onChange={(e) => handleQuotaChange(team.id, e.target.value)}
                              className="w-16 px-2 py-1 text-center border border-slate-300 rounded-lg text-sm font-bold text-[#0C447C] focus:ring-2 focus:ring-brand-500 outline-none"
                              onClick={e => e.stopPropagation()}
                            />
                          </div>
                        )}
                      </label>
                    ))
                  ) : (
                    <div className="p-4 text-center text-sm text-[#378ADD]">ไม่พบทีมในระบบ</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/50 glass flex justify-end gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-[#185FA5] glass border border-slate-300 rounded-xl hover: transition-colors"
          >
            ยกเลิก
          </button>
          <button 
            type="button" 
            onClick={handleSubmit}
            disabled={submitting || loading || totalRequested === 0 || totalRequested > summary.unassignedJobsCount}
            className="px-6 py-2.5 text-sm font-bold text-white bg-brand-600 rounded-xl hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#185FA5]/20 transition-all flex items-center gap-2"
          >
            {submitting ? 'กำลังดำเนินการ...' : 'แจกจ่ายอัจฉริยะ'}
          </button>
        </div>
      </div>
    </div>
  );
}
