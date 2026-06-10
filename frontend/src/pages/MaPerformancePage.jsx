import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/axios';
import Swal from 'sweetalert2';
import UserProfileModal from '../components/UserProfileModal';
import TargetSettingsModal from '../components/TargetSettingsModal';

export default function MaPerformancePage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  const getRoleBadge = (role) => {
    switch(role) {
      case 'super_admin': return <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-bold">ผู้ดูแลระบบสูงสุด</span>;
      case 'admin': return <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">ผู้ดูแลระบบ</span>;
      case 'technician': return <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold">ช่างเทคนิค</span>;
      case 'user': return <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold">พนักงานทั่วไป</span>;
      default: return <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold">{role}</span>;
    }
  };

  // Month selection
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );
  const [allowedLateDays, setAllowedLateDays] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [targets, setTargets] = useState({
    ma_target_days: 26,
    ma_target_jobs: 130,
    allowed_late_days: 0
  });

  useEffect(() => {
    // Load initial targets
    api.get('/settings/targets').then(res => {
      setTargets(res.data);
      setAllowedLateDays(res.data.allowed_late_days);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, allowedLateDays]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/checkin/ma-performance?month=${selectedMonth}&allowed_late=${allowedLateDays}`);
      setData(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถโหลดข้อมูลได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  // Metrics
  const totalMa = data.length;
  const passedMa = data.filter(d => d.is_passed).length;
  const failedMa = totalMa - passedMa;

  return (
    <Layout activeKey="checkin" pageTitle="แดชบอร์ดประเมินเงื่อนไขทีม MA">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
        
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white/80 backdrop-blur-xl p-5 rounded-2xl border border-white/50 shadow-sm">
          <div>
            <h2 className="text-xl font-bold text-[#042C53] flex items-center gap-2">
              <span className="text-2xl">📊</span> ผลประเมินการทำงานทีม MA
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              เงื่อนไข: ทำงาน ≥ {targets.ma_target_days} วัน | สาย ≤ {allowedLateDays} วัน | จบงาน ≥ {targets.ma_target_jobs} งาน
            </p>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-700">อนุโลมสาย (วัน):</label>
              <input 
                type="number" 
                min="0"
                value={allowedLateDays}
                onChange={(e) => setAllowedLateDays(e.target.value)}
                className="w-16 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all text-sm font-medium text-center"
              />
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <label className="text-sm font-bold text-slate-700">ประจำเดือน:</label>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={handleMonthChange}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all text-sm font-medium"
              />
            </div>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
              >
                ⚙️ ตั้งค่าเป้าหมาย
              </button>
            </div>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 text-2xl">
              👥
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-500">พนักงาน MA ทั้งหมด</p>
              <p className="text-2xl font-bold text-slate-800">{loading ? '-' : totalMa} <span className="text-base font-normal text-slate-400">คน</span></p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-100 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full -mr-4 -mt-4"></div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500 text-2xl">
              ✅
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-600">ผ่านเงื่อนไข</p>
              <p className="text-2xl font-bold text-emerald-700">{loading ? '-' : passedMa} <span className="text-base font-normal opacity-70">คน</span></p>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-rose-100 flex items-center gap-4 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full -mr-4 -mt-4"></div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 text-2xl">
              ❌
            </div>
            <div>
              <p className="text-sm font-semibold text-rose-600">ผิดเงื่อนไข</p>
              <p className="text-2xl font-bold text-rose-700">{loading ? '-' : failedMa} <span className="text-base font-normal opacity-70">คน</span></p>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="glass rounded-3xl border border-white/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-bold">พนักงาน</th>
                  <th className="px-6 py-4 font-bold text-center">วันทำงาน (≥ {targets.ma_target_days})</th>
                  <th className="px-6 py-4 font-bold text-center">มาสาย (≤ {allowedLateDays})</th>
                  <th className="px-6 py-4 font-bold text-center">จบงาน (≥ {targets.ma_target_jobs})</th>
                  <th className="px-6 py-4 font-bold text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">
                      <div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-slate-400">ไม่มีข้อมูลพนักงาน MA</td>
                  </tr>
                ) : (
                  data.map((user, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => setSelectedUser(user)}
                      className="bg-white/40 hover:bg-white/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center font-bold shadow-inner">
                            {user.full_name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{user.full_name}</div>
                            <div className="text-xs text-slate-500 mt-0.5 opacity-80">{user.role}</div>
                          </div>
                        </div>
                      </td>
                      
                      {/* Condition 1: Check-in days */}
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-sm ${user.total_days >= targets.ma_target_days ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {user.total_days >= targets.ma_target_days ? '✔️' : '⚠️'} {user.total_days}
                        </div>
                      </td>

                      {/* Condition 2: Late days */}
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-sm ${user.total_late <= allowedLateDays ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {user.total_late <= allowedLateDays ? '✔️' : '⚠️'} {user.total_late}
                        </div>
                      </td>

                      {/* Condition 3: Completed jobs */}
                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-sm ${user.total_completed >= targets.ma_target_jobs ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                          {user.total_completed >= targets.ma_target_jobs ? '✔️' : '⚠️'} {user.total_completed}
                        </div>
                      </td>

                      {/* Final Status */}
                      <td className="px-6 py-4 text-center">
                        {user.is_passed ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-100 text-emerald-700 shadow-sm border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            ผ่านเงื่อนไข
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 text-rose-700 shadow-sm border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            ผิดเงื่อนไข
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      
      {selectedUser && (
        <UserProfileModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          getRoleBadge={getRoleBadge}
        />
      )}

      <TargetSettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={(newTargets) => {
          setTargets(newTargets);
          setAllowedLateDays(newTargets.allowed_late_days);
          fetchData();
        }}
      />
    </Layout>
  );
}
