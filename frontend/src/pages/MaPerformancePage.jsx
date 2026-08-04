import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import Swal from 'sweetalert2';
import UserProfileModal from '../components/UserProfileModal';
import TargetSettingsModal from '../components/TargetSettingsModal';

const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', bg: 'bg-[#1F2937]', text: 'text-white' },
  admin: { label: 'Admin', bg: 'bg-[#A3E635]', text: 'text-[#1F2937]' },
  ma_technician: { label: 'ช่าง MA', bg: 'bg-violet-100', text: 'text-violet-700' },
  technician: { label: 'ช่าง Office', bg: 'bg-sky-100', text: 'text-sky-700' },
  contractor_office: { label: 'รับเหมาติดตั้ง', bg: 'bg-sky-100', text: 'text-sky-700' },
  contractor_ma: { label: 'รับเหมา MA', bg: 'bg-violet-100', text: 'text-violet-700' },
  user: { label: 'พนักงาน', bg: 'bg-slate-100', text: 'text-slate-600' },
};

function RoleBadge({ role }) {
  const s = ROLE_CONFIG[role] || { label: role, bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <span className={`inline-flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md ${s.bg} ${s.text} border border-black/5`}>
      {s.label}
    </span>
  );
}

function StatPill({ label, value, target, pass, compare }) {
  const ok = compare === 'lte' ? value <= target : value >= target;
  const symbol = compare === 'lte' ? '≤' : '≥';
  return (
    <div className={`flex-1 min-w-0 rounded-2xl border p-3 ${ok ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100'}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
        {label} {symbol} {target}
      </p>
      <p className={`text-xl font-black ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>
        {value}
        <span className="text-xs font-bold opacity-60 ml-1">/ {target}</span>
      </p>
      <p className="text-[10px] font-bold mt-0.5">{ok ? '✔️ ผ่าน' : '⚠️ ไม่ถึง'}</p>
    </div>
  );
}

function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
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
  const [targets, setTargets] = useState({
    ma_target_days: 26,
    ma_target_jobs: 130,
    allowed_late_days: 0,
  });

  useEffect(() => {
    api.get('/settings/targets').then((res) => setTargets(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, targets.allowed_late_days, targets.ma_target_days, targets.ma_target_jobs]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get(
        `/checkin/ma-performance?month=${selectedMonth}&allowed_late=${targets.allowed_late_days}`
      );
      setData(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถโหลดข้อมูลได้', confirmButtonColor: '#1F2937' });
    } finally {
      setLoading(false);
    }
  };

  const totalMa = data.length;
  const passedMa = data.filter((d) => d.is_passed).length;
  const failedMa = totalMa - passedMa;

  return (
    <Layout activeKey="ma_performance" pageTitle="ประเมินทีม MA">
      <div className="flex flex-col gap-4 sm:gap-6 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="h-1 bg-[#A3E635]" />
          <div className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-black text-[#1F2937] flex items-center gap-2">
                  <span className="w-9 h-9 rounded-xl bg-[#1F2937] text-[#A3E635] flex items-center justify-center text-lg">📊</span>
                  ผลประเมินทีม MA
                </h2>
                <p className="text-xs sm:text-sm text-[#6B7280] mt-2 font-medium leading-relaxed">
                  เช็คอินก่อนหรือตรงเวลาเข้างานแรกของวัน = <span className="text-[#1F2937] font-bold">ไม่สาย</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                className="self-start flex items-center gap-2 px-4 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-[#A3E635] font-bold rounded-2xl text-sm active:scale-95"
              >
                ⚙️ ตั้งค่าเงื่อนไข
              </button>
            </div>

            {/* Condition chips */}
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] p-3 text-center">
                <p className="text-[10px] font-bold text-[#6B7280]">ทำงาน</p>
                <p className="text-base sm:text-lg font-black text-[#1F2937]">≥ {targets.ma_target_days}</p>
                <p className="text-[10px] text-[#9CA3AF]">วัน</p>
              </div>
              <div className="rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] p-3 text-center">
                <p className="text-[10px] font-bold text-[#6B7280]">มาสาย</p>
                <p className="text-base sm:text-lg font-black text-[#1F2937]">≤ {targets.allowed_late_days}</p>
                <p className="text-[10px] text-[#9CA3AF]">วัน</p>
              </div>
              <div className="rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] p-3 text-center">
                <p className="text-[10px] font-bold text-[#6B7280]">จบงาน</p>
                <p className="text-base sm:text-lg font-black text-[#1F2937]">≥ {targets.ma_target_jobs}</p>
                <p className="text-[10px] text-[#9CA3AF]">งาน</p>
              </div>
            </div>

            {/* Month nav */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="w-10 h-11 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] font-bold text-[#4B5563]"
              >
                ‹
              </button>
              <div className="flex-1 h-11 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center text-sm font-black text-[#1F2937]">
                {monthLabel(selectedMonth)}
              </div>
              <button
                type="button"
                onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                className="w-10 h-11 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] font-bold text-[#4B5563]"
              >
                ›
              </button>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {[
            { label: 'ทั้งหมด', value: totalMa, tone: 'text-[#1F2937]', bg: 'bg-white border-[#E5E7EB]' },
            { label: 'ผ่าน', value: passedMa, tone: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100' },
            { label: 'ไม่ผ่าน', value: failedMa, tone: 'text-rose-700', bg: 'bg-rose-50 border-rose-100' },
          ].map((m) => (
            <div key={m.label} className={`rounded-2xl sm:rounded-3xl border p-3 sm:p-5 ${m.bg}`}>
              <p className="text-[10px] sm:text-xs font-bold text-[#6B7280]">{m.label}</p>
              <p className={`text-2xl sm:text-3xl font-black mt-0.5 ${m.tone}`}>{loading ? '—' : m.value}</p>
            </div>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between">
            <h3 className="font-black text-[#1F2937] text-sm sm:text-base">รายชื่อพนักงาน</h3>
            <span className="text-[10px] font-bold text-[#9CA3AF]">{data.length} คน</span>
          </div>

          {loading ? (
            <div className="p-8 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 rounded-2xl bg-[#F3F4F6] animate-pulse" />
              ))}
            </div>
          ) : data.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-violet-50 flex items-center justify-center text-2xl">👥</div>
              <p className="font-black text-[#6B7280]">ไม่มีพนักงาน MA</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {data.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => setSelectedUser(user)}
                  className="w-full text-left p-4 sm:p-5 hover:bg-[#F9FAFB] transition-colors"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-11 h-11 rounded-2xl bg-[#1F2937] text-[#A3E635] flex items-center justify-center font-black shrink-0">
                      {(user.full_name || '?').charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-[#1F2937] truncate">{user.full_name}</p>
                        {user.is_passed ? (
                          <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-lg">ผ่าน</span>
                        ) : (
                          <span className="text-[10px] font-black text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-lg">ไม่ผ่าน</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {(user.roles || [user.role]).map((r) => (
                          <RoleBadge key={r} role={r} />
                        ))}
                        {user.team_name && (
                          <span className="text-[10px] font-bold text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded-md">
                            {user.team_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <StatPill label="ทำงาน" value={user.total_days} target={targets.ma_target_days} compare="gte" />
                    <StatPill label="มาสาย" value={user.total_late} target={targets.allowed_late_days} compare="lte" />
                    <StatPill label="จบงาน" value={user.total_completed} target={targets.ma_target_jobs} compare="gte" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

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
          setTargets((prev) => ({ ...prev, ...newTargets }));
        }}
      />
    </Layout>
  );
}
