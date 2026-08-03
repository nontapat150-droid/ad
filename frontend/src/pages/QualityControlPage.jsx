import { useRef, useState } from 'react';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import axios from '../api/axios';
import Swal from 'sweetalert2';

const MONTHS = [
  { value: '01', label: 'January', labelTh: 'ม.ค.' },
  { value: '02', label: 'February', labelTh: 'ก.พ.' },
  { value: '03', label: 'March', labelTh: 'มี.ค.' },
  { value: '04', label: 'April', labelTh: 'เม.ย.' },
  { value: '05', label: 'May', labelTh: 'พ.ค.' },
  { value: '06', label: 'June', labelTh: 'มิ.ย.' },
  { value: '07', label: 'July', labelTh: 'ก.ค.' },
  { value: '08', label: 'August', labelTh: 'ส.ค.' },
  { value: '09', label: 'September', labelTh: 'ก.ย.' },
  { value: '10', label: 'October', labelTh: 'ต.ค.' },
  { value: '11', label: 'November', labelTh: 'พ.ย.' },
  { value: '12', label: 'December', labelTh: 'ธ.ค.' },
];

function CustomMonthPicker({ value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(() =>
    value ? parseInt(value.split('-')[0], 10) : new Date().getFullYear()
  );
  const pickerRef = useRef(null);

  const getDisplayLabel = () => {
    if (!value) return 'เลือกเดือน';
    const [y, m] = value.split('-');
    const monthObj = MONTHS.find((x) => x.value === m);
    return monthObj ? `${monthObj.label} ${y}` : value;
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full sm:w-[220px] px-4 py-2.5 bg-[#F9FAFB] border ${
          isOpen ? 'border-[#A3E635] ring-4 ring-[#A3E635]/20' : 'border-[#E5E7EB] hover:border-[#A3E635]'
        } rounded-xl outline-none text-[#1F2937] font-bold transition-all shadow-sm`}
      >
        <span>{getDisplayLabel()}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180 text-[#65a30d]' : 'text-[#9CA3AF]'}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 p-4 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#E5E7EB] w-[300px] z-50">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={() => setCurrentYear((p) => p - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6] text-[#6B7280]"
            >
              ‹
            </button>
            <span className="font-bold text-[#1F2937]">{currentYear}</span>
            <button
              type="button"
              onClick={() => setCurrentYear((p) => p + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6] text-[#6B7280]"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((m) => {
              const isSelected = value === `${currentYear}-${m.value}`;
              return (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => {
                    onChange(`${currentYear}-${m.value}`);
                    setIsOpen(false);
                  }}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-[#A3E635] to-[#84cc16] text-[#1F2937] shadow-md'
                      : 'text-[#4B5563] hover:bg-[#F3F4F6]'
                  }`}
                >
                  <span>{m.label.substring(0, 3)}</span>
                  <span className={`block text-[10px] ${isSelected ? 'text-[#1F2937]/70' : 'text-[#9CA3AF]'}`}>
                    {m.labelTh}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDate(d) {
  if (!d) return '-';
  const s = String(d).slice(0, 10);
  const [y, m, day] = s.split('-');
  if (!y || !m || !day) return s;
  return `${day}/${m}/${y}`;
}

function formatMonthLabel(ym) {
  if (!ym) return '-';
  const [y, m] = ym.split('-');
  const monthObj = MONTHS.find((x) => x.value === m);
  return monthObj ? `${monthObj.labelTh} ${y}` : ym;
}

function currentYm() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function QualityControlPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [qcType, setQcType] = useState('fraud');
  const [month, setMonth] = useState(currentYm);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const runCalculate = async () => {
    if (!month) {
      return Swal.fire('แจ้งเตือน', 'กรุณาเลือกเดือนอ้างอิง', 'warning');
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await axios.get('/installed-customers/qc', {
        params: { type: qcType, month },
      });
      setResult(res.data);
    } catch (err) {
      Swal.fire('ผิดพลาด', err.response?.data?.error || 'คำนวณไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="quality_control" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out">
        <header
          className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB] shrink-0"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6]"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}
              >
                <svg className="w-4 h-4 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h1 className="font-bold text-[#1F2937] text-lg tracking-tight">ควบคุมคุณภาพ (Fraud / Churn)</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-5xl mx-auto w-full space-y-4">
            {/* Controls */}
            <div
              className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-[#A3E635] to-[#65a30d]" />
                <h2 className="text-sm font-bold text-[#374151] uppercase tracking-wider">เงื่อนไขคำนวณ</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setQcType('fraud')}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    qcType === 'fraud'
                      ? 'bg-amber-50 border-amber-300 text-amber-900'
                      : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
                  }`}
                >
                  Fraud (ย้อน 4 เดือน)
                </button>
                <button
                  type="button"
                  onClick={() => setQcType('churn')}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    qcType === 'churn'
                      ? 'bg-rose-50 border-rose-300 text-rose-900'
                      : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB]'
                  }`}
                >
                  Churn (ย้อน 8 เดือน)
                </button>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6B7280] mb-1.5">เดือนอ้างอิง</label>
                  <CustomMonthPicker value={month} onChange={setMonth} />
                </div>
                <button
                  type="button"
                  onClick={runCalculate}
                  disabled={loading}
                  className="px-8 py-2.5 rounded-xl text-sm font-bold text-[#1F2937] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)' }}
                >
                  {loading ? 'กำลังคำนวณ...' : 'คำนวณ'}
                </button>
              </div>

              <p className="text-xs text-[#9CA3AF] leading-relaxed">
                เลือกเดือนอ้างอิงแล้วระบบจะดู cohort ติดตั้งของเดือนย้อนหลัง {qcType === 'fraud' ? '4' : '8'} เดือน
                และนับลูกค้าที่ยกเลิกภายใน {qcType === 'fraud' ? '4' : '8'} เดือนหลังวันติดตั้ง
              </p>
            </div>

            {/* Results */}
            {result && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard label="ประเภท" value={result.type === 'fraud' ? 'Fraud' : 'Churn'} />
                  <StatCard label="เดือนอ้างอิง" value={formatMonthLabel(result.ref_month)} />
                  <StatCard label="เดือน cohort (ติดตั้ง)" value={formatMonthLabel(result.cohort_month)} />
                  <StatCard
                    label="อัตรา"
                    value={`${result.rate}%`}
                    accent={result.type === 'fraud' ? 'amber' : 'rose'}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="จำนวนติดตั้งใน cohort" value={String(result.total_installs)} />
                  <StatCard
                    label={result.type === 'fraud' ? 'เคส Fraud' : 'เคส Churn'}
                    value={String(result.cases)}
                    accent={result.type === 'fraud' ? 'amber' : 'rose'}
                  />
                </div>

                <div
                  className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                  style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
                >
                  <div className="px-4 py-3 border-b border-[#E5E7EB] flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#1F2937]">
                      รายชื่อที่ถูกนับเป็น {result.type === 'fraud' ? 'Fraud' : 'Churn'}
                    </h3>
                    <span className="text-xs text-[#9CA3AF]">{(result.detail || []).length} รายการ</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#F9FAFB] text-[#6B7280] text-left">
                        <tr>
                          <th className="px-3 py-3 font-semibold">ชื่อ</th>
                          <th className="px-3 py-3 font-semibold">NON</th>
                          <th className="px-3 py-3 font-semibold">แพ็กเกจ</th>
                          <th className="px-3 py-3 font-semibold">วันติดตั้ง</th>
                          <th className="px-3 py-3 font-semibold">วันยกเลิก</th>
                          <th className="px-3 py-3 font-semibold">เหตุผล</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.detail || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-3 py-10 text-center text-[#9CA3AF]">
                              ไม่พบเคสในเงื่อนไขนี้
                            </td>
                          </tr>
                        ) : (
                          result.detail.map((row) => (
                            <tr key={row.id} className="border-t border-[#F3F4F6]">
                              <td className="px-3 py-2.5 font-semibold text-[#1F2937]">{row.customer_name}</td>
                              <td className="px-3 py-2.5 font-mono">{row.non_number}</td>
                              <td className="px-3 py-2.5 text-[#4B5563]">{row.package_name}</td>
                              <td className="px-3 py-2.5">{formatDate(row.install_date)}</td>
                              <td className="px-3 py-2.5">{formatDate(row.cancelled_at)}</td>
                              <td className="px-3 py-2.5 text-[#6B7280] max-w-[180px] truncate" title={row.cancel_reason || ''}>
                                {row.cancel_reason || '-'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!result && !loading && (
              <div className="text-center py-16 text-[#9CA3AF]">
                <p className="text-sm">เลือกประเภทและเดือน แล้วกดคำนวณ</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }) {
  const accentClass =
    accent === 'amber'
      ? 'text-amber-700'
      : accent === 'rose'
        ? 'text-rose-700'
        : 'text-[#1F2937]';
  return (
    <div
      className="bg-white rounded-xl border border-[#E5E7EB] p-4"
      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
    >
      <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-xl font-bold ${accentClass}`}>{value}</p>
    </div>
  );
}
