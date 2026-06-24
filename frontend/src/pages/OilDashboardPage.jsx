import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts';
import api from '../api/axios';
import Layout from '../components/Layout';
import OilRecordModal from '../components/OilRecordModal';
import OilRecordEditModal from '../components/OilRecordEditModal';
import DateRangeFilter from '../components/DateRangeFilter';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { thaiDateTime, thaiDate, thaiDateShort } from '../utils/thaiDate';

// ── Chart Section ─────────────────────────────────────────────────────────
// Tooltip shared between line and bar charts
function ChartTooltip({ active, payload, label, period }) {
  if (!active || !payload || !payload.length) return null;
  const sorted = [...payload].filter(p => p.value != null && p.value !== 0).sort((a, b) => b.value - a.value);
  let dateStr = label || '';
  try {
    if (period === 'daily') {
      dateStr = new Date(label).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
    } else if (period === 'monthly') {
      const [y, m] = label.split('-');
      const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      dateStr = `${months[parseInt(m, 10) - 1]} ${parseInt(y) + 543}`;
    } else {
      dateStr = `ปี ${parseInt(label) + 543}`;
    }
  } catch {}
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-2xl shadow-xl p-3 min-w-[160px]" style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}>
      <p className="text-[11px] font-bold text-[#6B7280] mb-2 pb-1.5 border-b border-[#F3F4F6]">{dateStr}</p>
      {sorted.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-3 py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-[11px] font-semibold text-[#374151] truncate max-w-[90px]">{entry.name}</span>
          </div>
          <span className="text-[12px] font-black text-[#1F2937]">{(entry.value || 0).toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// Aggregate daily trend → monthly or yearly
function aggregateTrend(dailyTrend, period, vehicles, dataKey, totalKey) {
  if (period === 'daily') return dailyTrend;
  const map = {};
  dailyTrend.forEach(row => {
    const d = row.date;
    const key = period === 'monthly' ? d.slice(0, 7) : d.slice(0, 4); // YYYY-MM or YYYY
    if (!map[key]) {
      map[key] = { date: key, [totalKey]: 0 };
      vehicles.forEach(v => { map[key][`${v.license_plate}_${dataKey}`] = 0; });
    }
    map[key][totalKey] = (map[key][totalKey] || 0) + (row[totalKey] || 0);
    vehicles.forEach(v => {
      const k = `${v.license_plate}_${dataKey}`;
      map[key][k] = (map[key][k] || 0) + (row[k] || 0);
    });
  });
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

function ChartSection({ dailyTrend, vehicles, vehicleCompareData, tabs, COLORS, CustomTooltip, efficiency }) {
  const [activeTab, setActiveTab] = useState('cost');
  const [period, setPeriod]       = useState('daily'); // 'daily' | 'monthly' | 'yearly'

  const tab      = tabs.find(t => t.key === activeTab);
  const dataKey  = activeTab;
  const totalKey = `total_${activeTab === 'cost' ? 'cost' : activeTab === 'liters' ? 'liters' : 'distance'}`;
  const vehicleCount = vehicles.length;

  // Aggregate data based on period
  const trendData = aggregateTrend(dailyTrend, period, vehicles, dataKey, totalKey);

  // X-axis tick formatter
  const xFmt = (s) => {
    try {
      if (period === 'daily') return new Date(s).getDate().toString();
      if (period === 'monthly') {
        const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
        const m = parseInt(s.split('-')[1], 10);
        return months[m - 1];
      }
      return `'${s.slice(-2)}`;
    } catch { return s; }
  };

  const yFmt = (v) => {
    if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
    if (v >= 1000)    return `${(v / 1000).toFixed(0)}K`;
    return v;
  };

  // Render bar series per vehicle (or single)
  const renderSeries = () => {
    if (vehicleCount <= 1) {
      return (
        <Bar name={vehicles[0]?.license_plate || tab.label} dataKey={totalKey}
          fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
      );
    }
    return vehicles.map((v, i) => (
      <Bar key={v.license_plate} name={v.license_plate}
        dataKey={`${v.license_plate}_${dataKey}`}
        fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={28} />
    ));
  };

  const ChartWrapper = BarChart;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Main Trend Chart ── */}
      <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">

        {/* ── Header row ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-4 border-b border-[#F3F4F6]">

          {/* Title */}
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${tab.iconBg}`}>{tab.icon}</div>
            <div>
              <h3 className="font-black text-[#1F2937] text-base leading-tight">
                {tab.label}
                <span className="ml-2 text-xs font-semibold text-[#9CA3AF] normal-case">
                  {{ daily: 'รายวัน', monthly: 'รายเดือน', yearly: 'รายปี' }[period]}
                </span>
              </h3>
              <p className="text-[11px] text-[#9CA3AF] font-medium mt-0.5">
                {vehicleCount === 0 ? 'ไม่มีข้อมูล' : vehicleCount === 1 ? vehicles[0]?.license_plate : `เปรียบเทียบ ${vehicleCount} คัน`}
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">

            {/* Metric tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
              {tabs.map(t => (
                <button key={t.key} onClick={() => setActiveTab(t.key)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                    activeTab === t.key ? 'bg-white text-[#1F2937] shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#374151]'
                  }`}>
                  <span>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {/* Period toggle */}
            <div className="flex items-center gap-0.5 p-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
              {[
                { key: 'daily',   label: 'วัน'   },
                { key: 'monthly', label: 'เดือน' },
                { key: 'yearly',  label: 'ปี'    },
              ].map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all ${
                    period === p.key ? 'bg-white text-[#1F2937] shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#374151]'
                  }`}>{p.label}</button>
              ))}
            </div>



          </div>
        </div>

        {/* Vehicle chips legend */}
        {vehicleCount > 0 && (
          <div className="flex flex-wrap gap-2 px-6 py-3 border-b border-[#F9FAFB]">
            {vehicleCompareData.map((v) => (
              <div key={v.name} className="flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl px-3 py-1.5">
                <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: v.color }} />
                <span className="text-[11px] font-bold text-[#374151]">{v.name}</span>
                <span className="text-[11px] font-black text-[#1F2937] ml-1">{(v[dataKey] || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}

        {/* Chart canvas */}
        <div className="h-80 px-3 pt-3 pb-2">
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ChartWrapper data={trendData} margin={{ top: 10, right: 16, left: -4, bottom: 0 }} barCategoryGap={vehicleCount > 3 ? '20%' : '30%'}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                <XAxis dataKey="date" tickFormatter={xFmt}
                  tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 700 }}
                  axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={yFmt}
                  tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }}
                  axisLine={false} tickLine={false} dx={-4} width={44} />
                <Tooltip cursor={{ fill: '#F9FAFB' }}
                  content={<ChartTooltip period={period} />} />
                {renderSeries()}
              </ChartWrapper>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#9CA3AF]">
              <span className="text-5xl mb-3 opacity-40">📈</span>
              <p className="font-bold text-sm">ไม่มีข้อมูลในช่วงนี้</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Vehicle Comparison horizontal bar */}
        <div className="bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${tab.iconBg}`}>{tab.icon}</div>
            <div>
              <h3 className="font-black text-[#1F2937] text-base leading-tight">เปรียบเทียบรถ — {tab.label}</h3>
              <p className="text-xs text-[#9CA3AF] font-medium">รวมทั้งช่วงเวลาที่เลือก เรียงมากสุด→น้อยสุด</p>
            </div>
          </div>
          {vehicleCompareData.length > 0 ? (
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height={Math.max(240, vehicleCompareData.length * 46)}>
                <BarChart data={[...vehicleCompareData].sort((a, b) => b[dataKey] - a[dataKey])} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis type="number" tickFormatter={yFmt} tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#374151', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip cursor={{ fill: '#F9FAFB' }} content={<CustomTooltip />} />
                  <Bar name={tab.label} dataKey={dataKey} radius={[0, 8, 8, 0]}>
                    {[...vehicleCompareData].sort((a, b) => b[dataKey] - a[dataKey]).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#9CA3AF] font-bold text-sm">ไม่มีข้อมูล</div>
          )}
        </div>

        {/* Efficiency */}
        <div className="bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm hover:shadow-md transition-all flex flex-col">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">🎯</div>
            <div>
              <h3 className="font-black text-[#1F2937] text-base leading-tight">ต้นทุนต่อรอบ (บาท/งาน)</h3>
              <p className="text-xs text-[#9CA3AF] font-medium">เรียงจากสูงสุด → ต่ำสุด</p>
            </div>
          </div>
          {efficiency.length > 0 ? (
            <div className="flex-1 min-h-[240px]">
              <ResponsiveContainer width="100%" height={Math.max(240, efficiency.length * 46)}>
                <BarChart data={[...efficiency].sort((a, b) => b.cost_per_job - a.cost_per_job)} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barSize={22}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                  <XAxis type="number" tickFormatter={yFmt} tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="team_name" tick={{ fill: '#374151', fontSize: 12, fontWeight: 700 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip cursor={{ fill: '#F9FAFB' }} content={<CustomTooltip />} />
                  <Bar name="บาท/งาน" dataKey="cost_per_job" radius={[0, 8, 8, 0]}>
                    {[...efficiency].sort((a, b) => b.cost_per_job - a.cost_per_job).map((_, i, arr) => {
                      const ratio = i / (arr.length - 1 || 1);
                      return <Cell key={i} fill={`rgb(${Math.round(20 + ratio * 235)},${Math.round(184 - ratio * 100)},${Math.round(166 - ratio * 100)})`} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-[#9CA3AF] font-bold text-sm">ไม่มีข้อมูลประสิทธิภาพ</div>
          )}
        </div>
      </div>
    </div>
  );
}


export default function OilDashboardPage() {
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10);
  });
  const [analytics, setAnalytics] = useState({ byVehicle: [], dailyTrend: [], summary: {} });
  const [efficiency, setEfficiency] = useState([]);
  const [records, setRecords] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [showTeamDropdown, setShowTeamDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [viewingImages, setViewingImages] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  useEffect(() => {
    api.get('/users/teams').then(res => setTeams(res.data)).catch(console.error);
  }, []);

  const { hasRole } = useAuth();
  const isAdmin = hasRole(['super_admin', 'admin']);
  const isDataEntryOnly = hasRole(['technician', 'office_technician', 'ma_technician', 'sales']);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (startDate) queryParams.append('start_date', startDate);
      if (endDate) queryParams.append('end_date', endDate);
      if (selectedTeams.length > 0) queryParams.append('team_ids', selectedTeams.join(','));

      const results = await Promise.allSettled([
        api.get(`/oil/analytics?${queryParams.toString()}`),
        api.get(`/oil/records?${queryParams.toString()}&limit=30`),
        api.get(`/oil/efficiency?${queryParams.toString()}`)
      ]);

      if (results[0].status === 'fulfilled') setAnalytics(results[0].value.data);
      if (results[1].status === 'fulfilled') setRecords(results[1].value.data);
      if (results[2].status === 'fulfilled') setEfficiency(results[2].value.data);

      const failedAPIs = results.filter(r => r.status === 'rejected');
      if (failedAPIs.length > 0) {
        console.warn('Some oil APIs failed:', failedAPIs.map(f => f.reason?.message));
      }
    } catch (err) {
      console.error('Oil fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, selectedTeams]);

  const handleRecalculate = async () => {
    try {
      const result = await Swal.fire({
        title: 'ยืนยันการคำนวณใหม่?',
        text: 'ระบบจะทำการคำนวณระยะทางและต้นทุนต่อกิโลเมตรใหม่ทั้งหมดสำหรับรถทุกคัน การดำเนินการนี้ไม่สามารถย้อนกลับได้',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#185FA5',
        cancelButtonColor: '#ef4444',
        confirmButtonText: 'ยืนยันการคำนวณ',
        cancelButtonText: 'ยกเลิก'
      });

      if (result.isConfirmed) {
        Swal.fire({ title: 'กำลังคำนวณ...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        await api.post('/oil/recalculate');
        await fetchData(); // Refresh data
        Swal.fire('สำเร็จ', 'คำนวณข้อมูลใหม่เรียบร้อยแล้ว', 'success');
      }
    } catch (err) {
      console.error('Recalculate error:', err);
      Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถคำนวณใหม่ได้', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteRecord = async (id) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ?',
      html: `คุณแน่ใจหรือไม่ที่จะลบ <b>ประวัติการเติมน้ำมัน</b> รายการนี้?<br/><span class="text-xs text-rose-500 mt-2 block">*ข้อมูลนี้จะไม่สามารถกู้คืนได้</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#e2e8f0',
      cancelButtonText: '<span class="text-slate-600 font-bold">ยกเลิก</span>',
      confirmButtonText: '<span class="font-bold">ใช่, ลบทิ้งเลย</span>',
      customClass: {
        popup: 'rounded-3xl border border-slate-100 shadow-2xl',
        confirmButton: 'rounded-xl shadow-md hover:scale-105 transition-all',
        cancelButton: 'rounded-xl hover:scale-105 transition-all'
      }
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/oil/records/${id}`);
        Swal.fire({
          title: 'ลบสำเร็จ!',
          text: 'ลบประวัติการเติมน้ำมันเรียบร้อยแล้ว',
          icon: 'success',
          customClass: {
            popup: 'rounded-3xl',
            confirmButton: 'rounded-xl bg-emerald-500'
          }
        });
        fetchData();
      } catch (err) {
        Swal.fire({
          title: 'เกิดข้อผิดพลาด',
          text: err.response?.data?.error || 'ไม่สามารถลบรายการได้',
          icon: 'error',
          customClass: {
            popup: 'rounded-3xl',
            confirmButton: 'rounded-xl bg-rose-500'
          }
        });
      }
    }
  };

  const toggleTeam = (teamId) => {
    setSelectedTeams(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId]
    );
  };

  const summary = analytics.summary || {};
  const totalCost = parseFloat(summary.total_cost || 0);
  const totalLiters = parseFloat(summary.total_liters || 0);
  const totalBills = parseInt(summary.total_bills || 0, 10);
  const avgPrice = parseFloat(summary.avg_price_per_liter || 0);
  const avgFreq = parseFloat(summary.avg_refuel_days || 0);

  // Calculate average cost per job across all teams
  const totalEfficiencyJobs = efficiency.reduce((sum, item) => sum + parseInt(item.case_count || 0), 0);
  const avgCostPerJob = totalEfficiencyJobs > 0 ? (totalCost / totalEfficiencyJobs) : 0;

  // Custom Tooltip component for Recharts
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#E5E7EB] backdrop-blur-xl">
          <p className="text-[#1F2937] font-bold text-sm mb-2 pb-2 border-b border-[#F3F4F6]">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-3 text-sm py-1">
              <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
              <span className="text-[#6B7280] font-medium">{entry.name}:</span>
              <span className="font-bold text-[#1F2937]">{entry.value.toLocaleString()}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout activeKey="oil" pageTitle="ระบบน้ำมัน">
      <div className="flex flex-col gap-6 pb-12 w-full max-w-7xl mx-auto reveal">

        {/* Header & Controls */}
        {!isDataEntryOnly && (
          <div className="relative z-50 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-[#E5E7EB] animate-fade-in-up">
            <div>
              <h1 className="text-2xl font-extrabold text-[#1F2937] flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center text-[#1F2937] shadow-sm">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                </div>
                แดชบอร์ดสรุปน้ำมัน
              </h1>
              <p className="text-[#6B7280] mt-2 font-medium">สถิติและประวัติการเบิกจ่ายน้ำมันของรถทุกคัน</p>
            </div>

            <div className="flex flex-wrap items-center gap-3 relative">

              {!isDataEntryOnly && (
                <>
                  {/* Custom Multi-select Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                      className="input-field max-w-[200px] flex items-center justify-between text-sm shadow-sm bg-[#F9FAFB] border-[#E5E7EB] text-[#1F2937] font-bold"
                    >
                      <span className="truncate mr-2">
                        {selectedTeams.length === 0 ? 'ทุกทีม' : `เลือกแล้ว ${selectedTeams.length} ทีม`}
                      </span>
                      <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </button>

                    {showTeamDropdown && (
                      <div className="absolute z-50 top-full mt-2 w-56 bg-white border border-[#E5E7EB] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] p-2 max-h-64 overflow-y-auto">
                        <div className="p-1">
                          <label className="flex items-center gap-3 p-2 hover:bg-[#F3F4F6] rounded-lg cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedTeams.length === 0}
                              onChange={() => setSelectedTeams([])}
                              className="w-4 h-4 rounded text-[#A3E635] focus:ring-[#A3E635] border-[#D1D5DB]"
                            />
                            <span className="text-sm font-bold text-[#1F2937]">เลือกทุกทีม</span>
                          </label>
                          <div className="h-px bg-[#E5E7EB] my-1"></div>
                          {teams.map(t => (
                            <label key={t.id} className="flex items-center gap-3 p-2 hover:bg-[#F3F4F6] rounded-lg cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedTeams.includes(t.id)}
                                onChange={() => toggleTeam(t.id)}
                                className="w-4 h-4 rounded text-[#A3E635] focus:ring-[#A3E635] border-[#D1D5DB]"
                              />
                              <span className="text-sm font-medium text-[#4B5563]">{t.team_name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <DateRangeFilter
                    startDate={startDate}
                    endDate={endDate}
                    setStartDate={setStartDate}
                    setEndDate={setEndDate}
                  />
                  <button
                    onClick={() => setShowCompare(!showCompare)}
                    className="bg-white border border-[#E5E7EB] hover:border-[#A3E635] text-[#374151] hover:text-[#65a30d] px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm transition-all active:scale-95">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    เปรียบเทียบรถ
                  </button>
                  {isAdmin && (
                    <button
                      onClick={handleRecalculate}
                      className="bg-white border border-orange-200 text-orange-600 hover:bg-orange-50 px-4 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm transition-all active:scale-95">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      คำนวณใหม่
                    </button>
                  )}
                </>
              )}

              {!isDataEntryOnly && (
                <button
                  onClick={() => setShowModal(true)}
                  className="bg-[#1F2937] hover:bg-[#374151] text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-md transition-all active:scale-95">
                  <svg className="w-5 h-5 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                  เพิ่มข้อมูล
                </button>
              )}
            </div>
          </div>
        )}

        {isDataEntryOnly ? (
          <div className="flex justify-center w-full px-4 mb-12">
            <OilRecordModal
              inline={true}
              onClose={() => { }}
              onSuccess={() => {
                fetchData();
                Swal.fire({
                  icon: 'success',
                  title: 'สำเร็จ',
                  text: 'บันทึกข้อมูลการเติมน้ำมันเรียบร้อยแล้ว'
                });
              }}
            />
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="skeleton h-64 rounded-3xl" />
            <div className="skeleton h-64 rounded-3xl" />
          </div>
        ) : (
          <div className="flex flex-col gap-6 stagger-children">

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              <StatCard
                title="ยอดเงินรวม (เดือนนี้)"
                value={`฿${totalCost.toLocaleString()}`}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                colorClass="text-emerald-600"
                bgClass="bg-emerald-100/50 text-emerald-600"
              />
              <StatCard
                title="จำนวนลิตรรวม"
                value={`${totalLiters.toFixed(2)} ลิตร`}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
                colorClass="text-amber-500"
                bgClass="bg-amber-100/50 text-amber-500"
              />
              <StatCard
                title="รายการทั้งหมด"
                value={`${totalBills} บิล`}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                colorClass="text-indigo-500"
                bgClass="bg-indigo-100/50 text-indigo-500"
              />
              <StatCard
                title="ต้นทุนเฉลี่ย (Cost/Job)"
                value={`฿${avgCostPerJob.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / รอบ`}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                colorClass="text-[#185FA5]"
                bgClass="bg-blue-100/50 text-[#185FA5]"
              />
              <StatCard
                title="ค่าน้ำมันเฉลี่ย"
                value={`฿${parseFloat(avgPrice).toFixed(2)} / L`}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>}
                colorClass="text-orange-500"
                bgClass="bg-orange-100/50 text-orange-500"
              />
              <StatCard
                title="ความถี่เติมน้ำมันเฉลี่ย"
                value={`ทุกๆ ${parseFloat(avgFreq).toFixed(1)} วัน`}
                icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                colorClass="text-teal-600"
                bgClass="bg-teal-100/50 text-teal-600"
              />
            </div>

            {/* Smart Charts Area */}
            {(() => {
              const COLORS = ['#F59E0B','#3B82F6','#10B981','#8B5CF6','#EC4899','#14B8A6','#F43F5E','#84CC16','#F97316','#06B6D4'];
              const vehicles = analytics.byVehicle || [];
              const isSingleVehicle = vehicles.length <= 1;
              const isFewVehicles = vehicles.length <= 4;
              
              // Prepare comparison data (totals per vehicle) for bar chart
              const vehicleCompareData = vehicles.map((v, i) => ({
                name: v.license_plate,
                cost: Math.round(parseFloat(v.total_cost || 0)),
                liters: parseFloat(parseFloat(v.total_liters || 0).toFixed(1)),
                distance: Math.round(parseFloat(v.total_distance || 0)),
                color: COLORS[i % COLORS.length],
              }));

              // Tabs for daily trend
              const tabs = [
                { key: 'cost',     label: 'ค่าใช้จ่าย (บาท)', suffix: 'บาท', icon: '💰', iconBg: 'bg-orange-100 text-orange-600' },
                { key: 'liters',   label: 'น้ำมัน (ลิตร)', suffix: 'ลิตร', icon: '⛽', iconBg: 'bg-lime-100 text-lime-600' },
                { key: 'distance', label: 'ระยะทาง (กม.)', suffix: 'กม.', icon: '🛣️', iconBg: 'bg-sky-100 text-sky-600' },
              ];

              return (
                <ChartSection
                  dailyTrend={analytics.dailyTrend}
                  vehicles={vehicles}
                  vehicleCompareData={vehicleCompareData}
                  tabs={tabs}
                  COLORS={COLORS}
                  isSingleVehicle={isSingleVehicle}
                  isFewVehicles={isFewVehicles}
                  CustomTooltip={CustomTooltip}
                  efficiency={efficiency}
                />
              );
            })()}

            {/* Compare Vehicles Grid */}
            {showCompare && analytics.byVehicle.length > 0 && (
              <div className="bg-[#F9FAFB] p-6 md:p-8 rounded-3xl border border-[#E5E7EB] shadow-sm animate-fade-in-up">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-extrabold text-[#1F2937] text-xl flex items-center gap-2">
                    <span className="bg-white p-2 rounded-xl shadow-sm border border-[#E5E7EB]">⚖️</span> ตารางเปรียบเทียบรถ
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {analytics.byVehicle.map((v) => {
                    const teamEff = efficiency.find(e => e.team_id === v.main_team_id);
                    const caseCount = teamEff ? parseInt(teamEff.case_count || 0) : 0;

                    const tCost = parseFloat(v.total_cost || 0);
                    const tLiters = parseFloat(v.total_liters || 0);
                    const tDistance = parseFloat(v.total_distance || 0);

                    const literPerBaht = tLiters > 0 ? (tCost / tLiters).toFixed(2) : '0.00';
                    const kmPerLiter = tLiters > 0 ? (tDistance / tLiters).toFixed(2) : '0.00';
                    const costPerKm = tDistance > 0 ? (tCost / tDistance).toFixed(2) : '0.00';
                    const costPerJob = caseCount > 0 ? (tCost / caseCount).toFixed(2) : '0.00';

                    return (
                      <div key={v.license_plate} className="bg-white p-5 rounded-2xl hover:-translate-y-1 hover:shadow-md transition-all shadow-sm border border-[#E5E7EB]">
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">ทะเบียนรถ</div>
                          <div className="w-8 h-8 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] flex items-center justify-center text-[#1F2937]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                          </div>
                        </div>
                        <div className="text-2xl font-black text-[#1F2937] mb-4">{v.license_plate}</div>

                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280] font-medium">ยอดรวม</span>
                            <span className="font-bold text-emerald-600">฿{tCost.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280] font-medium">จำนวนลิตร</span>
                            <span className="font-bold text-amber-500">{tLiters.toFixed(2)} L</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280] font-medium">เฉลี่ยลิตร/บาท</span>
                            <span className="font-bold text-[#1F2937]">{literPerBaht}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280] font-medium">ระยะทาง</span>
                            <span className="font-bold text-[#1F2937]">{tDistance.toLocaleString()} กม.</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280] font-medium">ลิตร/กม.</span>
                            <span className="font-bold text-[#1F2937]">{kmPerLiter}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                            <span className="text-[#6B7280] font-medium">ต้นทุน/กม.</span>
                            <span className="font-bold text-[#1F2937]">฿{costPerKm}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-[#6B7280] font-medium">ต้นทุน/งาน</span>
                            <span className="font-bold text-[#1F2937]">฿{costPerJob}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* History Table */}
            <div className="bg-white p-6 rounded-3xl overflow-hidden shadow-sm border border-[#E5E7EB]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-[#1F2937] text-lg flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">📋</div>
                  ประวัติการเติมน้ำมันล่าสุด
                </h3>
                <button
                  onClick={() => setShowSummaryModal(true)}
                  className="bg-[#185FA5] hover:bg-[#124b82] text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all flex items-center gap-2 active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  สรุปข้อมูล
                </button>
              </div>
              <div className="overflow-x-auto w-full pb-2">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">วันที่/เวลา</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">ชื่อผู้เติม / ทีม / ตำแหน่ง</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">เลขไมล์</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">ระยะทาง (กม.)</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">กม./ลิตร</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">เคสปิดสำเร็จ (เดือน)</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">ต้นทุน/กม.</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">ต้นทุน/งาน</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">ยอดรวม (บาท)</th>
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-center">หลักฐาน รูปภาพ</th>
                      {isAdmin && <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-center">จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {records.map((r) => {
                      const teamEff = efficiency.find(e => e.team_id === r.team_id);
                      const caseCount = teamEff ? parseInt(teamEff.case_count || 0) : 0;
                      const kmPerLiter = parseFloat(r.liters) > 0 ? (parseFloat(r.distance || 0) / parseFloat(r.liters)).toFixed(2) : '0.00';
                      const costPerKm = parseFloat(r.distance || 0) > 0 ? (parseFloat(r.total_price) / parseFloat(r.distance)).toFixed(2) : '0.00';
                      const costPerJob = caseCount > 0 ? (parseFloat(r.total_price) / caseCount).toFixed(2) : '0.00';

                      return (
                        <tr key={r.id} className="hover:bg-[#F9FAFB] transition-colors group">
                          <td className="p-4 text-sm text-[#4B5563] font-medium whitespace-nowrap">
                            {thaiDateTime(r.date_recorded)}
                          </td>
                          <td className="p-4 text-sm text-[#1F2937] whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-bold text-[#1F2937]">{r.tech_name || 'N/A'}</span>
                              {r.filler_name && r.tech_name && r.filler_name !== r.tech_name && (
                                <span className="text-[10px] text-[#9CA3AF] font-medium flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                                  </svg>
                                  เติมแทนโดย: {r.filler_name}
                                </span>
                              )}
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black bg-[#A3E635]/20 text-[#65a30d] border border-[#A3E635]/30 px-2.5 py-0.5 rounded-md">{r.team_name || 'ไม่มีทีม'}</span>
                                <span className="text-xs font-medium text-[#6B7280] bg-[#F3F4F6] px-2.5 py-0.5 rounded-md border border-[#E5E7EB]">
                                  {{
                                    sales: 'เซล',
                                    technician: 'ช่าง Office',
                                    ma_technician: 'ช่าง MA',
                                    office_technician: 'ช่าง Office',
                                    admin: 'แอดมิน',
                                    super_admin: 'แอดมินสูงสุด'
                                  }[r.tech_role] || r.tech_role || 'พนักงาน'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm font-black tracking-wide text-[#6B7280] whitespace-nowrap text-right">{r.mileage.toLocaleString()}</td>
                          <td className="p-4 text-sm font-black tracking-wide text-[#374151] whitespace-nowrap text-right">{r.distance || 0}</td>
                          <td className="p-4 text-sm font-black tracking-wide text-[#374151] whitespace-nowrap text-right">{kmPerLiter}</td>
                          <td className="p-4 text-sm font-black tracking-wide text-indigo-600 font-bold whitespace-nowrap text-right">{caseCount}</td>
                          <td className="p-4 text-sm font-black tracking-wide text-[#374151] whitespace-nowrap text-right">฿{costPerKm}</td>
                          <td className="p-4 text-sm font-black tracking-wide text-[#374151] whitespace-nowrap text-right">฿{costPerJob}</td>
                          <td className="p-4 text-sm font-bold text-emerald-600 whitespace-nowrap text-right">฿{parseFloat(r.total_price).toLocaleString()}</td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center gap-2">
                              {r.images && r.images.length > 0 ? (
                                <button
                                  onClick={() => setViewingImages(r.images)}
                                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#F9FAFB] text-[#1F2937] font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm border border-[#E5E7EB] hover:border-[#A3E635] hover:shadow-md active:scale-95 group/btn"
                                >
                                  <span className="text-sm group-hover/btn:scale-110 transition-transform">📸</span> ดูภาพ ({r.images.length})
                                </button>
                              ) : (
                                <span className="text-xs text-[#9CA3AF] font-bold bg-[#F9FAFB] px-2 py-1.5 rounded-lg border border-[#E5E7EB]">-</span>
                              )}
                            </div>
                          </td>
                          {isAdmin && (
                            <td className="p-4 text-center">
                              <div className="flex justify-center items-center gap-2">
                                <button
                                  onClick={() => setEditingRecord(r)}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#1F2937] transition-all shadow-sm border border-[#E5E7EB] hover:border-[#A3E635] hover:shadow-md active:scale-95 flex-shrink-0"
                                  title="แก้ไขรายการนี้"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(r.id)}
                                  className="w-8 h-8 flex items-center justify-center rounded-xl bg-white hover:bg-rose-50 text-[#6B7280] hover:text-rose-600 transition-all shadow-sm border border-[#E5E7EB] hover:border-rose-200 hover:shadow-md active:scale-95 flex-shrink-0"
                                  title="ลบรายการนี้"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan="11" className="text-center p-8 text-[#9CA3AF] font-bold">
                          ไม่มีข้อมูลในช่วงเวลาที่เลือก
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>

      {showModal && <OilRecordModal onClose={() => setShowModal(false)} onSuccess={fetchData} />}

      {/* Summary Modal */}
      {showSummaryModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#1F2937]/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-up">
            <div className="p-6 border-b border-[#E5E7EB] flex justify-between items-center bg-[#F9FAFB] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#185FA5] text-white flex items-center justify-center font-bold text-xl shadow-sm">📄</div>
                <div>
                  <h2 className="text-xl font-black text-[#1F2937]">สรุปข้อมูลการเติมน้ำมัน</h2>
                  <p className="text-sm font-medium text-[#6B7280]">สรุปรายการประวัติการเติมน้ำมันที่แสดงอยู่ปัจจุบัน</p>
                </div>
              </div>
              <button onClick={() => setShowSummaryModal(false)} className="p-2 hover:bg-[#E5E7EB] text-[#6B7280] rounded-xl transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto bg-white flex-1">
              <div className="mb-6">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl flex items-center justify-between shadow-sm">
                  <div>
                    <div className="text-sm font-bold text-blue-700 mb-1">ความถี่ในการเติมน้ำมันโดยเฉลี่ย</div>
                    <div className="text-xs font-medium text-blue-600">ระยะห่างเฉลี่ยของการเติมน้ำมันแต่ละครั้งจากข้อมูลในตารางนี้</div>
                  </div>
                  <div className="text-2xl font-black text-blue-700">
                    {(() => {
                      if (!records || records.length < 2) return '-';
                      const recordsByPlate = {};
                      records.forEach(r => {
                        const plate = r.license_plate || r.team_name || 'unknown';
                        if (!recordsByPlate[plate]) recordsByPlate[plate] = [];
                        recordsByPlate[plate].push(new Date(r.date_recorded).getTime());
                      });
                      let totalDays = 0, totalIntervals = 0;
                      Object.values(recordsByPlate).forEach(dates => {
                        if (dates.length < 2) return;
                        dates.sort((a, b) => a - b);
                        for (let i = 1; i < dates.length; i++) {
                          totalDays += (dates[i] - dates[i-1]) / (1000 * 60 * 60 * 24);
                          totalIntervals++;
                        }
                      });
                      const freq = totalIntervals > 0 ? (totalDays / totalIntervals) : 0;
                      return freq > 0 ? `${freq.toFixed(1)} วัน/ครั้ง` : '-';
                    })()}
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto border border-[#E5E7EB] rounded-2xl shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="p-3 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">วันที่เติม</th>
                      <th className="p-3 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">ชื่อผู้เติม</th>
                      <th className="p-3 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider">ป้ายทะเบียน</th>
                      <th className="p-3 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider text-right">เลขไมล์</th>
                      <th className="p-3 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider text-right">ระยะทาง (กม.)</th>
                      <th className="p-3 text-[12px] font-bold text-[#6B7280] uppercase tracking-wider text-right">ยอดรวม (บาท)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {records.map(r => (
                      <tr key={r.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="p-3 text-sm text-[#4B5563] font-medium whitespace-nowrap">
                          {thaiDate(r.date_recorded)}
                        </td>
                        <td className="p-3 text-sm text-[#1F2937] whitespace-nowrap">
                          <div className="font-bold">{r.tech_name || '-'}</div>
                          {r.filler_name && r.tech_name && r.filler_name !== r.tech_name && (
                            <div className="text-[10px] text-[#9CA3AF] font-medium mt-0.5 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                              </svg>
                              เติมแทนโดย: {r.filler_name}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-sm text-[#1F2937] font-bold whitespace-nowrap">{r.license_plate || r.team_name || '-'}</td>
                        <td className="p-3 text-sm font-black tracking-wide text-[#6B7280] text-right">{r.mileage.toLocaleString()}</td>
                        <td className="p-3 text-sm font-black tracking-wide text-[#374151] font-bold text-right">{r.distance || 0}</td>
                        <td className="p-3 text-sm font-bold text-emerald-600 text-right">฿{parseFloat(r.total_price).toLocaleString()}</td>
                      </tr>
                    ))}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-6 text-center text-[#9CA3AF] font-bold">ไม่มีข้อมูลประวัติ</td>
                      </tr>
                    )}
                  </tbody>
                  {records.length > 0 && (
                    <tfoot className="bg-[#F9FAFB] border-t border-[#E5E7EB]">
                      <tr>
                        <td colSpan="4" className="p-4 text-right font-bold text-[#374151]">รวมทั้งหมด:</td>
                        <td className="p-4 text-right font-black tracking-wide text-[#1F2937] text-lg">{records.reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0).toLocaleString()}</td>
                        <td className="p-4 text-right font-black text-emerald-600 text-lg">฿{records.reduce((sum, r) => sum + parseFloat(r.total_price), 0).toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
            
            <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex justify-end shrink-0">
              <button 
                onClick={() => setShowSummaryModal(false)}
                className="px-6 py-2.5 rounded-xl bg-[#1F2937] text-white font-bold hover:bg-[#374151] transition-all shadow-sm active:scale-95"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence Images Modal */}
      {viewingImages && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.3s_ease-out]">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setViewingImages(null)}></div>
          <div className="relative w-full max-w-5xl flex flex-col bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white overflow-hidden max-h-[90vh]">

            <div className="p-6 border-b border-slate-200/50 bg-white/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-100 to-blue-100 border border-white shadow-sm flex items-center justify-center text-2xl font-bold text-indigo-600">
                  📸
                </div>
                <div>
                  <h2 className="text-2xl font-black text-[#042C53]">หลักฐานการเติมน้ำมัน</h2>
                  <p className="text-sm font-bold text-slate-400 mt-0.5">มีรูปภาพทั้งหมด {viewingImages.length} รูป</p>
                </div>
              </div>
              <button onClick={() => setViewingImages(null)} className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {viewingImages.map((img, idx) => (
                  <div key={idx} className="group relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm hover:shadow-lg transition-all flex flex-col">
                    <div className="flex-1 overflow-hidden bg-slate-100 relative">
                      <img
                        src={`${api.defaults.baseURL.replace('/api', '')}/uploads/oil_receipts/${img}`}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-full object-cover min-h-[300px] max-h-[600px] hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                        onClick={() => window.open(`${api.defaults.baseURL.replace('/api', '')}/uploads/oil_receipts/${img}`, '_blank')}
                      />
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-black text-[#042C53] shadow-sm border border-white">
                        รูปที่ {idx + 1}
                      </div>
                      <button
                        onClick={() => window.open(`${api.defaults.baseURL.replace('/api', '')}/uploads/oil_receipts/${img}`, '_blank')}
                        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md text-[#185FA5] shadow-sm border border-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#185FA5] hover:text-white"
                        title="เปิดรูปในแท็บใหม่"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {editingRecord && (
        <OilRecordEditModal
          record={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSuccess={() => {
            setEditingRecord(null);
            fetchData();
          }}
        />
      )}
    </Layout>
  );
}

function StatCard({ title, value, icon, bgClass, colorClass }) {
  return (
    <div className="bg-white p-5 rounded-3xl flex flex-col shadow-sm border border-[#E5E7EB] hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shadow-sm ${bgClass}`}>
          {icon}
        </div>
      </div>
      <p className="text-sm font-bold text-[#6B7280] mb-1">{title}</p>
      <p className={`text-2xl lg:text-3xl font-black tracking-tight ${colorClass}`}>{value}</p>
    </div>
  );
}
