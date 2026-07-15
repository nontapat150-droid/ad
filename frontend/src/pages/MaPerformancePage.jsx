import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import Swal from 'sweetalert2';
import UserProfileModal from '../components/UserProfileModal';
import TargetSettingsModal from '../components/TargetSettingsModal';

// ── Role badge config ─────────────────────────────────────────────────────────
const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', bg: 'bg-[#1F2937]',     text: 'text-white'        },
  admin:       { label: 'Admin',       bg: 'bg-[#A3E635]',     text: 'text-[#1F2937]'    },
  ma_technician: { label: 'ช่าง MA',    bg: 'bg-violet-100',    text: 'text-violet-700'   },
  technician:  { label: 'ช่างติดตั้ง',   bg: 'bg-sky-100',       text: 'text-sky-700'       },
  contractor_office: { label: 'รับเหมาติดตั้ง', bg: 'bg-sky-100', text: 'text-sky-700' },
  contractor_ma: { label: 'รับเหมา MA', bg: 'bg-violet-100', text: 'text-violet-700' },
  user:        { label: 'พนักงาน',     bg: 'bg-slate-100',     text: 'text-slate-600'     },
};

const TEAM_COLORS = [
  { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500'    },
  { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500'  },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500'   },
  { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500'    },
  { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500'    },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500'  },
  { bg: 'bg-pink-100',    text: 'text-pink-700',    dot: 'bg-pink-500'    },
];

function getRoleStyle(role) {
  return ROLE_CONFIG[role] || { label: role, bg: 'bg-gray-100', text: 'text-gray-600' };
}

// Badge for a single role
function RoleBadge({ role }) {
  const s = getRoleStyle(role);
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md ${s.bg} ${s.text} shadow-sm border border-black/5`}>
      {s.label}
    </span>
  );
}

// Stat cell component
function StatCell({ value, passed, icon }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm transition-all
      ${passed
        ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
        : 'bg-amber-50 text-amber-600 border border-amber-100'}`}>
      <span className="text-base leading-none">{passed ? '✔️' : '⚠️'}</span>
      {value}
    </div>
  );
}

export default function MaPerformancePage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
  );
  const [allowedLateDays, setAllowedLateDays] = useState(0);
  const [targets, setTargets] = useState({ ma_target_days: 26, ma_target_jobs: 130, allowed_late_days: 0 });

  // Team color map
  const teamColorMap = {};
  let colorIdx = 0;
  data.forEach(u => {
    const key = u.team_name || '__none__';
    if (!teamColorMap[key]) { teamColorMap[key] = TEAM_COLORS[colorIdx % TEAM_COLORS.length]; colorIdx++; }
  });

  useEffect(() => {
    api.get('/settings/targets').then(res => {
      setTargets(res.data);
      setAllowedLateDays(res.data.allowed_late_days);
    }).catch(console.error);
  }, []);

  useEffect(() => { fetchData(); }, [selectedMonth, allowedLateDays]);

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

  const totalMa  = data.length;
  const passedMa = data.filter(d => d.is_passed).length;
  const failedMa = totalMa - passedMa;

  return (
    <Layout activeKey="checkin" pageTitle="แดชบอร์ดประเมินเงื่อนไขทีม MA">
      <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">

        {/* ── Header + Filter ── */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5">
            <div>
              <h2 className="text-2xl font-black text-[#1F2937] flex items-center gap-3">
                <span className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center text-xl shrink-0">📊</span>
                ผลประเมินการทำงานทีม MA
              </h2>
              <p className="text-sm font-bold text-[#6B7280] mt-2 ml-13">
                เงื่อนไข: ทำงาน ≥ <span className="text-[#1F2937]">{targets.ma_target_days}</span> วัน
                &nbsp;|&nbsp; มาสาย ≤ <span className="text-[#1F2937]">{allowedLateDays}</span> วัน
                &nbsp;|&nbsp; จบงาน ≥ <span className="text-[#1F2937]">{targets.ma_target_jobs}</span> งาน
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* อนุโลมสาย */}
              <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl px-4 py-2.5">
                <label className="text-xs font-black text-[#6B7280] whitespace-nowrap">อนุโลมสาย (วัน)</label>
                <input
                  type="number"
                  min="0"
                  value={allowedLateDays}
                  onChange={(e) => setAllowedLateDays(e.target.value)}
                  className="w-14 text-center bg-transparent border-b-2 border-[#A3E635] outline-none text-sm font-black text-[#1F2937] focus:border-[#84CC16]"
                />
              </div>

              {/* เลือกเดือน */}
              <div className="flex items-center gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl px-4 py-2.5">
                <svg className="w-4 h-4 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="bg-transparent outline-none text-sm font-bold text-[#1F2937] cursor-pointer"
                />
              </div>

              {/* ตั้งค่าเป้าหมาย */}
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white font-bold rounded-2xl transition-all text-sm shadow-[0_4px_15px_rgba(31,41,55,0.2)] active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                ตั้งค่าเป้าหมาย
              </button>
            </div>
          </div>
        </div>

        {/* ── Metric Cards ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 flex items-center gap-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-28 h-28 bg-blue-50 rounded-bl-full opacity-60" />
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center text-2xl shrink-0 shadow-sm">👥</div>
            <div>
              <p className="text-sm font-bold text-[#6B7280]">พนักงาน MA ทั้งหมด</p>
              <p className="text-3xl font-black text-[#1F2937] mt-0.5">
                {loading ? <span className="animate-pulse">—</span> : totalMa}
                <span className="text-base font-bold text-[#6B7280] ml-1">คน</span>
              </p>
            </div>
          </div>

          {/* Passed */}
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-sm p-6 flex items-center gap-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-28 h-28 bg-emerald-50 rounded-bl-full opacity-60" />
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center text-2xl shrink-0 shadow-sm">✅</div>
            <div>
              <p className="text-sm font-bold text-emerald-600">ผ่านเงื่อนไข</p>
              <p className="text-3xl font-black text-emerald-700 mt-0.5">
                {loading ? <span className="animate-pulse">—</span> : passedMa}
                <span className="text-base font-bold text-emerald-500 ml-1">คน</span>
              </p>
            </div>
          </div>

          {/* Failed */}
          <div className="bg-white rounded-3xl border border-rose-100 shadow-sm p-6 flex items-center gap-5 relative overflow-hidden">
            <div className="absolute right-0 top-0 w-28 h-28 bg-rose-50 rounded-bl-full opacity-60" />
            <div className="w-14 h-14 rounded-2xl bg-rose-100 flex items-center justify-center text-2xl shrink-0 shadow-sm">❌</div>
            <div>
              <p className="text-sm font-bold text-rose-600">ผิดเงื่อนไข</p>
              <p className="text-3xl font-black text-rose-700 mt-0.5">
                {loading ? <span className="animate-pulse">—</span> : failedMa}
                <span className="text-base font-bold text-rose-400 ml-1">คน</span>
              </p>
            </div>
          </div>
        </div>

        {/* ── Data Table ── */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="px-6 py-4 text-xs font-black text-[#6B7280] uppercase tracking-wider">พนักงาน</th>
                  <th className="px-6 py-4 text-xs font-black text-[#6B7280] uppercase tracking-wider text-center">
                    วันทำงาน <span className="normal-case font-bold text-[#9CA3AF]">(≥ {targets.ma_target_days})</span>
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-[#6B7280] uppercase tracking-wider text-center">
                    มาสาย <span className="normal-case font-bold text-[#9CA3AF]">(≤ {allowedLateDays})</span>
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-[#6B7280] uppercase tracking-wider text-center">
                    จบงาน <span className="normal-case font-bold text-[#9CA3AF]">(≥ {targets.ma_target_jobs})</span>
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-[#6B7280] uppercase tracking-wider text-center">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {loading ? (
                  // ── Skeleton ──
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-[#F3F4F6]" />
                          <div className="space-y-2">
                            <div className="h-3 w-28 bg-[#F3F4F6] rounded-full" />
                            <div className="h-2.5 w-20 bg-[#F3F4F6] rounded-full" />
                          </div>
                        </div>
                      </td>
                      {[...Array(4)].map((_, j) => (
                        <td key={j} className="px-6 py-4 text-center">
                          <div className="h-7 w-16 bg-[#F3F4F6] rounded-xl mx-auto" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-16 text-center">
                      <div className="w-16 h-16 bg-violet-50 rounded-full flex items-center justify-center text-3xl mx-auto mb-3">👥</div>
                      <p className="font-black text-[#6B7280] text-lg">ไม่มีพนักงาน MA ในระบบ</p>
                      <p className="text-sm text-[#9CA3AF] mt-1">กรุณาตั้งค่า role = MA ให้กับผู้ใช้ในหน้าจัดการผู้ใช้</p>
                    </td>
                  </tr>
                ) : (
                  data.map((user, idx) => {
                    const tc = teamColorMap[user.team_name || '__none__'];
                    const roles = user.roles || [user.role];
                    return (
                      <tr
                        key={idx}
                        onClick={() => setSelectedUser(user)}
                        className="hover:bg-[#F9FAFB] transition-all cursor-pointer group"
                        style={{ animation: `fadeInRow 0.3s ease-out ${idx * 30}ms both` }}
                      >
                        {/* ── Employee cell ── */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm transition-transform group-hover:scale-110 ${tc?.bg || 'bg-violet-100'} ${tc?.text || 'text-violet-700'}`}>
                              {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black text-[#1F2937] truncate">{user.full_name}</p>
                              {/* Role badges — show ALL roles */}
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                                {roles.map(r => <RoleBadge key={r} role={r} />)}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Team */}
                        <td className="px-6 py-4">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${tc?.bg || 'bg-gray-100'} ${tc?.text || 'text-gray-600'} border ${tc?.border || 'border-transparent'}`}>
                            <span className={`w-2 h-2 rounded-full ${tc?.dot || 'bg-gray-400'}`} />
                            <span className="text-[11px] font-black uppercase tracking-wider">{user.team_name || 'ไม่มีทีม'}</span>
                          </div>
                        </td>

                        {/* Work Days */}
                        <td className="px-6 py-4 text-center">
                          <StatCell value={`${user.total_days} / ${targets.ma_target_days}`} passed={user.total_days >= targets.ma_target_days} />
                        </td>

                        {/* Late Days */}
                        <td className="px-6 py-4 text-center">
                          <StatCell value={`${user.total_late} / ${allowedLateDays}`} passed={user.total_late <= allowedLateDays} />
                        </td>

                        {/* Jobs Done */}
                        <td className="px-6 py-4 text-center">
                          <StatCell value={`${user.total_completed} / ${targets.ma_target_jobs}`} passed={user.total_completed >= targets.ma_target_jobs} />
                        </td>

                        {/* Result */}
                        <td className="px-6 py-4 text-center font-bold">
                          {user.is_passed ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 shadow-sm text-sm">
                              <span className="text-base leading-none">✅</span> ผ่าน
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-100 shadow-sm text-sm">
                              <span className="text-base leading-none">❌</span> ไม่ผ่าน
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── Modals ── */}
      {selectedUser && (
        <UserProfileModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          getRoleBadge={(role) => <RoleBadge role={role} />}
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

      <style>{`
        @keyframes fadeInRow {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </Layout>
  );
}
