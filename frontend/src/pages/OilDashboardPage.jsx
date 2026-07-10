import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts';
import api from '../api/axios';
import Layout from '../components/Layout';
import OilRecordModal from '../components/OilRecordModal';
import OilRecordEditModal from '../components/OilRecordEditModal';
import DateRangeFilter from '../components/DateRangeFilter';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { thaiDate, thaiDateTime, thaiTimeAgo, thaiMonthYear, thaiDateShort } from '../utils/thaiDate';
import { getImageUrl } from '../utils/imageUtils';
import ImageWithFallback from '../components/common/ImageWithFallback';

// ── Chart Section ─────────────────────────────────────────────────────────
export function TeamNameBadge({ defaultName, teamRoles }) {
  let rawName = defaultName || '';
  let role = null;
  let roleColor = '';
  let displayName = rawName;

  if (displayName) {
    const lowerName = displayName.toLowerCase();
    if (lowerName.includes('ช่างoffice') || lowerName.includes('ช่าง office')) {
      role = 'ช่าง Office';
      roleColor = 'bg-purple-100 text-purple-700 border-purple-200';
      displayName = displayName.replace(/ช่าง\s*office/i, '').trim();
    } else if (lowerName.includes('ช่างma') || lowerName.includes('ช่าง ma') || lowerName.includes(' ma')) {
      role = 'ช่าง MA';
      roleColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
      displayName = displayName.replace(/ช่าง\s*ma/i, '').replace(/\bma\b/i, '').trim();
    } else if (lowerName.includes('ช่าง')) {
      role = 'ช่างติดตั้ง';
      roleColor = 'bg-blue-100 text-blue-700 border-blue-200';
      displayName = displayName.replace(/ช่าง(ติดตั้ง)?/i, '').trim();
    } else if (lowerName.includes('sale') || lowerName.includes('เซล')) {
      role = 'Sales';
      roleColor = 'bg-pink-100 text-pink-700 border-pink-200';
      displayName = displayName.replace(/sale|เซลล์?|ฝ่ายขาย/i, '').trim();
    }
    displayName = displayName.replace(/[\(\)\[\]\-]/g, '').trim();
  }
  
  if (!role && teamRoles) {
    const rolesLower = teamRoles.toLowerCase();
    if (rolesLower.includes('office_technician')) {
      role = 'ช่าง Office';
      roleColor = 'bg-purple-100 text-purple-700 border-purple-200';
    } else if (rolesLower.includes('ma_technician')) {
      role = 'ช่าง MA';
      roleColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
    } else if (rolesLower.includes('technician')) {
      role = 'ช่างติดตั้ง';
      roleColor = 'bg-blue-100 text-blue-700 border-blue-200';
    } else if (rolesLower.includes('sale')) {
      role = 'Sales';
      roleColor = 'bg-pink-100 text-pink-700 border-pink-200';
    }
  }

  if (!displayName) displayName = rawName;

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      <span className="font-black text-[#1F2937]">{displayName}</span>
      {role && (
        <span className={`px-2 py-0.5 text-[10.5px] font-bold rounded-md border ${roleColor} whitespace-nowrap shadow-sm`}>
          {role}
        </span>
      )}
    </div>
  );
}

// Tooltip shared between line and bar charts
function OverallPercentageSummary({ vehicles, selectedTeams, teams }) {
  if (!vehicles || vehicles.length === 0) return null;

  const totalCost = vehicles.reduce((sum, v) => sum + (parseFloat(v.total_cost) || 0), 0);
  const totalDistance = vehicles.reduce((sum, v) => sum + (parseFloat(v.total_distance) || 0), 0);
  const totalLiters = vehicles.reduce((sum, v) => sum + (parseFloat(v.total_liters) || 0), 0);

  if (totalCost === 0 && totalDistance === 0 && totalLiters === 0) return null;

  let headerText = 'สรุปภาพรวมทั้งหมด (100%)';
  if (selectedTeams && selectedTeams.length > 0 && teams && teams.length > 0) {
    const selectedTeamNames = selectedTeams.map(id => {
      const t = teams.find(team => String(team.id) === String(id));
      return t ? t.team_name : '';
    }).filter(Boolean).join(', ');
    
    if (selectedTeamNames) {
      headerText = `สรุปภาพรวม - ${selectedTeamNames}`;
    }
  }

  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 mb-6 animate-fade-in-up">
      <div className="mb-5 border-b border-[#F3F4F6] pb-5">
        <h3 className="font-extrabold text-[#1F2937] text-lg mb-4 flex items-center gap-2">
          <span className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
          </span>
          {headerText}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100/50">
            <p className="text-sm font-bold text-emerald-600 mb-1">ยอดเงินที่ใช้เติมทั้งหมด</p>
            <p className="text-2xl font-black text-emerald-700">฿{totalCost.toLocaleString()}</p>
          </div>
          <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100/50">
            <p className="text-sm font-bold text-sky-600 mb-1">ระยะทางวิ่งรวม</p>
            <p className="text-2xl font-black text-sky-700">{totalDistance.toLocaleString()} กม.</p>
          </div>
          <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100/50">
            <p className="text-sm font-bold text-amber-600 mb-1">ลิตรที่เติมทั้งเดือนรวม</p>
            <p className="text-2xl font-black text-amber-700">{totalLiters.toFixed(2)} L</p>
          </div>
        </div>
      </div>

      <div>
        <h4 className="font-bold text-[#4B5563] text-[13px] mb-3 uppercase tracking-wider">สัดส่วนแต่ละคันจากยอดรวมทั้งหมด</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-[#E5E7EB] text-[#6B7280] text-xs uppercase tracking-wider">
                <th className="py-2.5 px-3 font-bold bg-[#F9FAFB] rounded-tl-xl">ทะเบียนรถ</th>
                <th className="py-2.5 px-3 font-bold bg-[#F9FAFB]">ยอดเงิน (%)</th>
                <th className="py-2.5 px-3 font-bold bg-[#F9FAFB]">ระยะทาง (%)</th>
                <th className="py-2.5 px-3 font-bold bg-[#F9FAFB] rounded-tr-xl">ลิตร (%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {vehicles.map((v) => {
                const cost = parseFloat(v.total_cost) || 0;
                const dist = parseFloat(v.total_distance) || 0;
                const liters = parseFloat(v.total_liters) || 0;
                
                const costPct = totalCost > 0 ? ((cost / totalCost) * 100).toFixed(1) : '0.0';
                const distPct = totalDistance > 0 ? ((dist / totalDistance) * 100).toFixed(1) : '0.0';
                const literPct = totalLiters > 0 ? ((liters / totalLiters) * 100).toFixed(1) : '0.0';

                return (
                  <tr key={v.license_plate} className="hover:bg-[#F9FAFB] transition-colors">
                    <td className="py-4 px-3 align-top min-w-[150px]">
                      {(() => {
                        let rawName = v.license_plate;
                        let teamRoles = '';
                        
                        // Find the team from `teams` array to get `team_roles`
                        const fallbackTeam = teams && teams.find(t => 
                          (v.main_team_id && t.id === v.main_team_id) ||
                          (v.main_team_id && t.id === v.main_team_id) || (t.team_name && t.team_name.includes(v.license_plate)) || 
                          (v.team_name && t.team_name === v.team_name)
                        );
                        
                        if (fallbackTeam) {
                          rawName = fallbackTeam.team_name;
                          teamRoles = fallbackTeam.team_roles;
                        } else if (v.team_name && v.team_name !== 'ไม่ระบุทีม') {
                          rawName = v.team_name;
                        }
                        
                        return <TeamNameBadge defaultName={rawName} teamRoles={teamRoles} />;
                      })()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col justify-center w-full max-w-[140px]">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[13px] font-black text-[#374151]">{costPct}%</span>
                          <span className="text-[11px] font-semibold text-[#6B7280]">฿{cost.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 bg-emerald-100 rounded-full">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${costPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col justify-center w-full max-w-[140px]">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[13px] font-black text-[#374151]">{distPct}%</span>
                          <span className="text-[11px] font-semibold text-[#6B7280]">{dist.toLocaleString()} กม.</span>
                        </div>
                        <div className="w-full h-2 bg-sky-100 rounded-full">
                          <div className="h-full bg-sky-500 rounded-full" style={{ width: `${distPct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex flex-col justify-center w-full max-w-[140px]">
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-[13px] font-black text-[#374151]">{literPct}%</span>
                          <span className="text-[11px] font-semibold text-[#6B7280]">{liters.toFixed(2)} L</span>
                        </div>
                        <div className="w-full h-2 bg-amber-100 rounded-full">
                          <div className="h-full bg-amber-500 rounded-full" style={{ width: `${literPct}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

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

function ChartSection({ dailyTrend, vehicles, vehicleCompareData, tabs, COLORS, CustomTooltip, efficiency, teams }) {
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
      let singleName = vehicles[0]?.license_plate || tab.label;
      if (vehicles[0]) {
        const v = vehicles[0];
        if (v.team_name && v.team_name !== 'ไม่ระบุทีม') {
          singleName = v.team_name;
        } else if (teams && teams.length > 0) {
          const fallbackTeam = teams.find(t => t.team_name && t.team_name.includes(v.license_plate));
          if (fallbackTeam) singleName = fallbackTeam.team_name;
        }
      }
      return (
        <Bar name={singleName} dataKey={totalKey}
          fill={COLORS[0]} radius={[4, 4, 0, 0]} maxBarSize={40} />
      );
    }
    return vehicles.map((v, i) => (
      <Bar key={v.license_plate} name={(() => {
        if (v.team_name && v.team_name !== 'ไม่ระบุทีม') return v.team_name;
        const fallbackTeam = teams && teams.find(t => t.team_name && t.team_name.includes(v.license_plate));
        return fallbackTeam ? fallbackTeam.team_name : v.license_plate;
      })()}
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
                {vehicleCount === 0 ? 'ไม่มีข้อมูล' : vehicleCount === 1 ? (
                  (() => {
                    const v = vehicles[0];
                    if (v?.team_name && v.team_name !== 'ไม่ระบุทีม') return v.team_name;
                    const fallbackTeam = teams && teams.find(t => t.team_name && t.team_name.includes(v?.license_plate));
                    return fallbackTeam ? fallbackTeam.team_name : v?.license_plate;
                  })()
                ) : `เปรียบเทียบ ${vehicleCount} คัน`}
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


// ── Vehicle Summary Modal with Anomaly Detection ──────────────────────
function VehicleSummaryModal({ onClose, startDate, endDate, selectedTeams }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState('cards'); // 'cards' | 'anomalies'

  useEffect(() => {
    const fetchSummary = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (startDate) queryParams.append('start_date', startDate);
        if (endDate) queryParams.append('end_date', endDate);
        if (selectedTeams && selectedTeams.length > 0) queryParams.append('team_ids', selectedTeams.join(','));
        const res = await api.get(`/oil/vehicle-summary?${queryParams.toString()}`);
        setData(res.data);
      } catch (err) {
        console.error('Vehicle summary error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, [startDate, endDate, selectedTeams]);

  const vehicles = data?.vehicles || [];
  const anomalies = data?.anomalies || [];
  const fleet = data?.fleetAvg || {};

  // Severity color mapping for anomaly alerts
  const severityConfig = {
    high:   { bg: 'bg-rose-50',  border: 'border-rose-200', icon: '🚨', text: 'text-rose-700', badge: 'bg-rose-100 text-rose-700', label: 'สำคัญ' },
    medium: { bg: 'bg-amber-50', border: 'border-amber-200', icon: '⚠️', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', label: 'ปานกลาง' },
    low:    { bg: 'bg-sky-50',   border: 'border-sky-200',   icon: 'ℹ️', text: 'text-sky-700',   badge: 'bg-sky-100 text-sky-700',   label: 'แจ้งเตือน' },
  };

  // Compute max cost for comparison bar widths
  const maxCost = Math.max(...vehicles.map(v => v.total_cost), 1);
  const maxDistance = Math.max(...vehicles.map(v => v.total_distance), 1);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#1F2937]/80 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-scale-up">

        {/* Header */}
        <div className="p-5 md:p-6 border-b border-[#E5E7EB] flex justify-between items-center bg-gradient-to-r from-[#F9FAFB] to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#185FA5] to-[#1e40af] text-white flex items-center justify-center text-xl shadow-md">
              📊
            </div>
            <div>
              <h2 className="text-xl font-black text-[#1F2937]">สรุปข้อมูลรถ & ตรวจจับความผิดปกติ</h2>
              <p className="text-sm font-medium text-[#6B7280]">
                วิเคราะห์เปรียบเทียบรถแต่ละคัน {vehicles.length > 0 ? `• ${vehicles.length} คัน` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#E5E7EB] text-[#6B7280] rounded-xl transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* View Tabs */}
        <div className="flex items-center gap-2 px-5 md:px-6 pt-4 pb-0 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-[#F3F4F6] rounded-xl">
            <button
              onClick={() => setActiveView('cards')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeView === 'cards' ? 'bg-white text-[#1F2937] shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#374151]'
              }`}>
              📋 สรุปรายคัน
            </button>
            <button
              onClick={() => setActiveView('anomalies')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold transition-all relative ${
                activeView === 'anomalies' ? 'bg-white text-[#1F2937] shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#374151]'
              }`}>
              🔍 ตรวจจับผิดปกติ
              {anomalies.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-500 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-sm">
                  {anomalies.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 md:p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-12 h-12 border-4 border-[#E5E7EB] border-t-[#185FA5] rounded-full animate-spin mb-4" />
              <p className="text-[#6B7280] font-bold">กำลังวิเคราะห์ข้อมูล...</p>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-[#9CA3AF]">
              <span className="text-5xl mb-4 opacity-40">🚗</span>
              <p className="font-bold text-lg">ไม่มีข้อมูลในช่วงเวลานี้</p>
            </div>
          ) : activeView === 'cards' ? (
            <div className="flex flex-col gap-5">

              {/* Fleet Average Overview */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 p-5 rounded-2xl border border-[#E5E7EB] shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-lg">📈</span>
                  <h3 className="font-black text-[#374151] text-sm">ค่าเฉลี่ยของรถทั้งหมด ({fleet.total_vehicles || 0} คัน)</h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-sm">
                    <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">ค่าใช้จ่าย/คัน</div>
                    <div className="text-lg font-black text-emerald-600">฿{(fleet.avg_cost || 0).toLocaleString()}</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-sm">
                    <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">ลิตร/คัน</div>
                    <div className="text-lg font-black text-amber-500">{(fleet.avg_liters || 0).toFixed(1)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-sm">
                    <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">ระยะทาง/คัน</div>
                    <div className="text-lg font-black text-blue-600">{(fleet.avg_distance || 0).toLocaleString()} กม.</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-sm">
                    <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">เติม/คัน</div>
                    <div className="text-lg font-black text-violet-600">{(fleet.avg_refuels || 0).toFixed(1)} ครั้ง</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-sm">
                    <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">กม./ลิตร</div>
                    <div className="text-lg font-black text-teal-600">{(fleet.avg_km_per_liter || 0).toFixed(2)}</div>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-[#E5E7EB] shadow-sm">
                    <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1">บาท/กม.</div>
                    <div className="text-lg font-black text-orange-600">฿{(fleet.avg_cost_per_km || 0).toFixed(2)}</div>
                  </div>
                </div>
              </div>

              {/* Data Source & Calculation Formulas */}
              {data?.formulas && (
                <div className="space-y-3">
                  {/* Data Source */}
                  <div className="bg-gradient-to-r from-sky-50 to-indigo-50 p-4 rounded-2xl border border-sky-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">📂</span>
                      <h3 className="font-black text-sky-800 text-sm">แหล่งที่มาของข้อมูล</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="bg-white/80 px-3 py-2.5 rounded-xl border border-sky-100">
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-0.5">ตารางข้อมูล</div>
                        <p className="text-xs text-[#1F2937] font-bold">
                          <code className="bg-sky-50 text-sky-700 px-1.5 py-0.5 rounded text-[11px] font-mono">oil_records</code> (บันทึกการเติมน้ำมัน)
                        </p>
                      </div>
                      <div className="bg-white/80 px-3 py-2.5 rounded-xl border border-sky-100">
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-0.5">ช่วงเวลาข้อมูล</div>
                        <p className="text-xs text-[#1F2937] font-bold">
                          {fleet.date_range?.start && fleet.date_range?.end
                            ? <>{fleet.date_range.start} <span className="text-[#9CA3AF] font-medium">ถึง</span> {fleet.date_range.end}</>
                            : 'ข้อมูลทั้งหมด'}
                        </p>
                      </div>
                      <div className="bg-white/80 px-3 py-2.5 rounded-xl border border-sky-100">
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-0.5">จำนวนรถ</div>
                        <p className="text-xs text-[#1F2937] font-bold">{fleet.total_vehicles || 0} คัน</p>
                      </div>
                      <div className="bg-white/80 px-3 py-2.5 rounded-xl border border-sky-100">
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-0.5">จำนวนรายการเติม</div>
                        <p className="text-xs text-[#1F2937] font-bold">{fleet.total_refuels || 0} รายการ</p>
                      </div>
                    </div>
                  </div>

                  {/* Fleet Totals */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-2xl border border-emerald-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-base">📊</span>
                      <h3 className="font-black text-emerald-800 text-sm">ข้อมูลรวมทั้งหมด (Fleet Totals)</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white/80 px-3 py-2.5 rounded-xl border border-emerald-100">
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-0.5">💰 ค่าใช้จ่ายรวมทุกคัน</div>
                        <div className="text-base font-black text-emerald-600">฿{(fleet.total_cost || 0).toLocaleString()}</div>
                      </div>
                      <div className="bg-white/80 px-3 py-2.5 rounded-xl border border-emerald-100">
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-0.5">⛽ ลิตรรวมทุกคัน</div>
                        <div className="text-base font-black text-amber-500">{(fleet.total_liters || 0).toFixed(1)} ลิตร</div>
                      </div>
                      <div className="bg-white/80 px-3 py-2.5 rounded-xl border border-emerald-100">
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-0.5">🛣️ ระยะทางรวมทุกคัน</div>
                        <div className="text-base font-black text-blue-600">{(fleet.total_distance || 0).toLocaleString()} กม.</div>
                      </div>
                      <div className="bg-white/80 px-3 py-2.5 rounded-xl border border-emerald-100">
                        <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-0.5">🔄 จำนวนเติมรวม</div>
                        <div className="text-base font-black text-violet-600">{fleet.total_refuels || 0} ครั้ง</div>
                      </div>
                    </div>
                  </div>

                  {/* Calculation Formulas */}
                  <details className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-2xl overflow-hidden shadow-sm group">
                    <summary className="p-4 cursor-pointer flex items-center gap-2 hover:bg-violet-100/50 transition-colors select-none">
                      <span className="text-base">🧮</span>
                      <span className="font-black text-violet-800 text-sm">สูตรคำนวณค่าเฉลี่ย (กดเพื่อดู)</span>
                      <svg className="w-4 h-4 text-violet-400 ml-auto group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                    </summary>
                    <div className="px-4 pb-4 space-y-2">
                      {/* Individual metric formulas */}
                      <div className="bg-white/80 p-3 rounded-xl border border-violet-100">
                        <div className="text-[10px] font-black text-violet-600 uppercase mb-2">📐 สูตรคำนวณรายตัว (ต่อรถ 1 คัน)</div>
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-[#374151] font-medium bg-violet-50/50 px-3 py-2 rounded-lg border border-violet-100">
                            <span className="font-black text-violet-700">กม./ลิตร</span> = ระยะทางรวมของรถคันนั้น (กม.) ÷ ปริมาณน้ำมันรวมของรถคันนั้น (ลิตร)
                          </div>
                          <div className="text-[11px] text-[#374151] font-medium bg-violet-50/50 px-3 py-2 rounded-lg border border-violet-100">
                            <span className="font-black text-violet-700">บาท/กม.</span> = ค่าใช้จ่ายรวมของรถคันนั้น (บาท) ÷ ระยะทางรวมของรถคันนั้น (กม.)
                          </div>
                          <div className="text-[11px] text-[#374151] font-medium bg-violet-50/50 px-3 py-2 rounded-lg border border-violet-100">
                            <span className="font-black text-violet-700">เฉลี่ย/ครั้ง</span> = ค่าใช้จ่ายรวมของรถคันนั้น (บาท) ÷ จำนวนครั้งที่เติมน้ำมัน
                          </div>
                        </div>
                      </div>

                      {/* Fleet average formulas — user-friendly */}
                      <div className="bg-white/80 p-3 rounded-xl border border-violet-100">
                        <div className="text-[10px] font-black text-violet-600 uppercase mb-2">📈 วิธีคำนวณค่าเฉลี่ย (พร้อมตัวเลขจริง)</div>
                        <div className="space-y-1.5">
                          {data.formulas && (Array.isArray(data.formulas) ? data.formulas : Object.entries(data.formulas).map(([k, v]) => ({ label: k, explanation: v }))).map((f, fi) => (
                            <div key={fi} className="text-[11px] text-[#374151] font-medium bg-violet-50/50 px-3 py-2 rounded-lg border border-violet-100">
                              <span className="font-black text-violet-700">{f.label}:</span>{' '}
                              <span className="leading-relaxed">{f.explanation}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Anomaly detection methodology */}
                      <div className="bg-white/80 p-3 rounded-xl border border-violet-100">
                        <div className="text-[10px] font-black text-violet-600 uppercase mb-2">🔍 วิธีการตรวจจับความผิดปกติ</div>
                        <div className="space-y-1.5">
                          <div className="text-[11px] text-[#374151] font-medium bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                            <span className="font-black text-rose-600">🚨 สำคัญ:</span> จ่ายค่าน้ำมันสูงกว่าค่าเฉลี่ย &gt;40% <span className="text-[#6B7280]">และ</span> วิ่งระยะทางน้อยกว่าค่าเฉลี่ย &gt;40% พร้อมกัน
                          </div>
                          <div className="text-[11px] text-[#374151] font-medium bg-amber-50 px-3 py-2 rounded-lg border border-amber-100">
                            <span className="font-black text-amber-600">⚠️ ปานกลาง:</span> กม./ลิตร ต่ำกว่าค่าเฉลี่ย &gt;40% หรือ ต้นทุน/กม. สูงกว่าค่าเฉลี่ย &gt;40%
                          </div>
                          <div className="text-[11px] text-[#374151] font-medium bg-sky-50 px-3 py-2 rounded-lg border border-sky-100">
                            <span className="font-black text-sky-600">ℹ️ แจ้งเตือน:</span> จำนวนครั้งเติมน้ำมันมากกว่าค่าเฉลี่ย &gt;60%
                          </div>
                          <div className="text-[11px] text-[#6B7280] font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                            <span className="font-black text-[#374151]">📌 หมายเหตุ:</span> ค่าเฉลี่ย คำนวณจากผลรวมของรถทุกคันในช่วงเวลาที่เลือก หารด้วยจำนวนรถทั้งหมด — ระบบจะเปรียบเทียบทุกคันกับค่าเฉลี่ยนี้ และนำคันที่ดีที่สุดมาเป็นตัวอ้างอิงเปรียบเทียบ
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}

              {/* Per-Vehicle Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {vehicles.map((v, idx) => {
                  const hasAnomaly = anomalies.some(a => a.license_plate === v.license_plate);
                  const vehicleAnomalies = anomalies.filter(a => a.license_plate === v.license_plate);
                  const costBar = maxCost > 0 ? (v.total_cost / maxCost * 100) : 0;
                  const distBar = maxDistance > 0 ? (v.total_distance / maxDistance * 100) : 0;

                  return (
                    <div
                      key={v.license_plate}
                      className={`bg-white rounded-2xl border shadow-sm p-5 hover:shadow-md transition-all ${
                        hasAnomaly ? 'border-rose-200 ring-1 ring-rose-100' : 'border-[#E5E7EB]'
                      }`}
                    >
                      {/* Card Header */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shadow-sm ${
                            hasAnomaly ? 'bg-gradient-to-br from-rose-400 to-rose-600' : 'bg-gradient-to-br from-slate-600 to-slate-800'
                          }`}>
                            {idx + 1}
                          </div>
                          <div>
                            <div className="text-lg font-black text-[#1F2937]">{v.license_plate}</div>
                            <div className="text-[11px] font-medium text-[#9CA3AF]">
                              เติม {v.refuel_count} ครั้ง
                            </div>
                          </div>
                        </div>
                        {hasAnomaly && (
                          <span className="px-2.5 py-1 bg-rose-100 text-rose-700 text-[10px] font-black rounded-full flex items-center gap-1">
                            🚨 พบ {vehicleAnomalies.length} จุดผิดปกติ
                          </span>
                        )}
                      </div>

                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 mb-4">
                        <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                          <span className="text-[#6B7280] font-medium text-xs">💰 ค่าใช้จ่ายรวม</span>
                          <span className="font-black text-emerald-600">฿{v.total_cost.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                          <span className="text-[#6B7280] font-medium text-xs">⛽ ลิตรรวม</span>
                          <span className="font-black text-amber-500">{v.total_liters.toFixed(1)} L</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                          <span className="text-[#6B7280] font-medium text-xs">🛣️ ระยะทางรวม</span>
                          <span className="font-black text-blue-600">{v.total_distance.toLocaleString()} กม.</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                          <span className="text-[#6B7280] font-medium text-xs">📊 กม./ลิตร</span>
                          <span className="font-black text-teal-600">{v.km_per_liter}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                          <span className="text-[#6B7280] font-medium text-xs">💵 เฉลี่ย/ครั้ง</span>
                          <span className="font-black text-[#374151]">฿{v.avg_cost_per_refuel.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-[#F3F4F6] pb-2">
                          <span className="text-[#6B7280] font-medium text-xs">🔧 บาท/กม.</span>
                          <span className="font-black text-orange-600">฿{v.cost_per_km}</span>
                        </div>
                      </div>

                      {/* Comparison Bars */}
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-[#9CA3AF] mb-1">
                            <span>ค่าใช้จ่าย (เทียบกับคันอื่น)</span>
                            <span>{costBar.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${costBar > 80 ? 'bg-rose-400' : costBar > 50 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                              style={{ width: `${costBar}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-bold text-[#9CA3AF] mb-1">
                            <span>ระยะทาง (เทียบกับคันอื่น)</span>
                            <span>{distBar.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-400 rounded-full transition-all duration-700"
                              style={{ width: `${distBar}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Inline anomaly hints */}
                      {vehicleAnomalies.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {vehicleAnomalies.map((a, ai) => {
                            const sc = severityConfig[a.severity] || severityConfig.low;
                            return (
                              <div key={ai} className={`${sc.bg} ${sc.border} border rounded-xl px-3 py-2 text-[11px] ${sc.text} font-bold flex items-start gap-2`}>
                                <span className="shrink-0 text-sm">{sc.icon}</span>
                                <span className="leading-relaxed">{a.message}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Anomalies Tab — Detailed Analysis */
            <div className="flex flex-col gap-4">
              {anomalies.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#9CA3AF]">
                  <span className="text-5xl mb-4">✅</span>
                  <p className="font-black text-lg text-emerald-600">ไม่พบความผิดปกติ</p>
                  <p className="font-medium text-sm mt-1">รถทุกคันมีพฤติกรรมการใช้น้ำมันอยู่ในเกณฑ์ปกติ</p>
                </div>
              ) : (
                <>
                  {/* Summary Header */}
                  <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🔍</span>
                      <h3 className="font-black text-rose-800 text-sm">พบ {anomalies.length} รายการผิดปกติ</h3>
                    </div>
                    <p className="text-xs text-rose-600 font-medium">ระบบเปรียบเทียบข้อมูลของรถแต่ละคันกับค่าเฉลี่ยของรถทั้งหมด {fleet.total_vehicles || 0} คัน หากพบความแตกต่างมากกว่า 40% จะถูกแจ้งเตือน</p>
                  </div>

                  {/* Data Source & Formulas Section */}
                  {data?.formulas && (
                    <details className="bg-slate-50 border border-[#E5E7EB] rounded-2xl overflow-hidden group">
                      <summary className="p-4 cursor-pointer flex items-center gap-2 hover:bg-slate-100 transition-colors select-none">
                        <span className="text-base">📐</span>
                        <span className="font-black text-[#374151] text-sm">สูตรคำนวณ & แหล่งข้อมูล</span>
                        <svg className="w-4 h-4 text-[#9CA3AF] ml-auto group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                      </summary>
                      <div className="px-4 pb-4 space-y-3">
                        {/* Data Source */}
                        <div className="bg-white p-3 rounded-xl border border-[#E5E7EB]">
                          <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1.5">📂 แหล่งข้อมูล</div>
                          <p className="text-xs text-[#374151] font-medium">
                            ตาราง <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold">oil_records</code> (บันทึกการเติมน้ำมัน)
                            {fleet.date_range?.start && fleet.date_range?.end ? (
                              <> • ช่วงวันที่: <span className="font-bold text-[#1F2937]">{fleet.date_range.start}</span> ถึง <span className="font-bold text-[#1F2937]">{fleet.date_range.end}</span></>
                            ) : ' • ข้อมูลทั้งหมด'}
                            {' '}• รถ <span className="font-bold text-[#1F2937]">{fleet.total_vehicles}</span> คัน
                            {' '}• รวม <span className="font-bold text-[#1F2937]">{fleet.total_refuels}</span> รายการเติม
                          </p>
                        </div>

                        {/* Fleet Totals */}
                        <div className="bg-white p-3 rounded-xl border border-[#E5E7EB]">
                          <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-1.5">📊 ข้อมูลรวมทั้งหมด</div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div><span className="text-[#6B7280]">ค่าใช้จ่ายรวม:</span> <span className="font-bold text-emerald-600">฿{(fleet.total_cost || 0).toLocaleString()}</span></div>
                            <div><span className="text-[#6B7280]">ลิตรรวม:</span> <span className="font-bold text-amber-500">{(fleet.total_liters || 0).toFixed(1)}</span></div>
                            <div><span className="text-[#6B7280]">ระยะทางรวม:</span> <span className="font-bold text-blue-600">{(fleet.total_distance || 0).toLocaleString()} กม.</span></div>
                            <div><span className="text-[#6B7280]">เติมรวม:</span> <span className="font-bold text-violet-600">{fleet.total_refuels || 0} ครั้ง</span></div>
                          </div>
                        </div>

                        {/* Formulas — user-friendly */}
                        <div className="bg-white p-3 rounded-xl border border-[#E5E7EB]">
                          <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-2">🧮 วิธีคำนวณค่าเฉลี่ย</div>
                          <div className="space-y-1.5">
                            {(Array.isArray(data.formulas) ? data.formulas : Object.entries(data.formulas).map(([k, v]) => ({ label: k, explanation: v }))).map((f, fi) => (
                              <div key={fi} className="text-[11px] text-[#4B5563] font-medium bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                                <span className="font-bold text-[#374151]">{f.label}:</span>{' '}{f.explanation}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </details>
                  )}

                  {/* Group anomalies by severity */}
                  {['high', 'medium', 'low'].map(severity => {
                    const filtered = anomalies.filter(a => a.severity === severity);
                    if (filtered.length === 0) return null;
                    const sc = severityConfig[severity];

                    return (
                      <div key={severity}>
                        <div className="flex items-center gap-2 mb-3">
                          <span className={`text-xs font-black px-2.5 py-1 rounded-full ${sc.badge}`}>
                            {sc.icon} {sc.label} ({filtered.length})
                          </span>
                        </div>
                        <div className="space-y-4">
                          {filtered.map((a, i) => (
                            <div key={i} className={`${sc.bg} ${sc.border} border rounded-2xl shadow-sm overflow-hidden`}>
                              {/* Anomaly Main Info */}
                              <div className="p-4">
                                <div className="flex items-start gap-3">
                                  <span className="text-2xl shrink-0">{sc.icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                      <span className="font-black text-[#1F2937] text-sm bg-white px-2.5 py-1 rounded-lg border border-[#E5E7EB] shadow-sm">
                                        🚗 {a.license_plate}
                                      </span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.badge}`}>
                                        {a.type === 'high_cost_low_distance' ? 'ค่าใช้จ่ายสูง-ระยะทางน้อย'
                                          : a.type === 'low_efficiency' ? 'อัตราสิ้นเปลืองสูง'
                                          : a.type === 'high_cost_per_km' ? 'ต้นทุน/กม. สูง'
                                          : 'เติมบ่อย'}
                                      </span>
                                    </div>
                                    <p className={`${sc.text} font-bold text-sm leading-relaxed`}>{a.message}</p>
                                    <p className="text-[12px] text-[#4B5563] font-medium mt-1.5 leading-relaxed">{a.detail}</p>
                                  </div>
                                </div>
                              </div>

                              {/* Vehicle vs Vehicle Comparison */}
                              {a.comparisons && a.comparisons.length > 0 && (
                                <div className="mx-4 mb-3 bg-white rounded-xl border border-[#E5E7EB] p-3">
                                  <div className="text-[10px] font-bold text-[#9CA3AF] uppercase mb-2">⚖️ เปรียบเทียบกับรถคันอื่น</div>
                                  {a.comparisons.map((c, ci) => (
                                    <div key={ci} className="flex items-start gap-2">
                                      <span className="text-sm shrink-0 mt-0.5">🏆</span>
                                      <p className="text-[12px] text-[#374151] font-bold leading-relaxed">{c.narrative}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Formula & Data Source (collapsible) */}
                              {(a.formula || a.data_source) && (
                                <details className="border-t border-[#E5E7EB]/50 group/detail">
                                  <summary className="px-4 py-2.5 cursor-pointer flex items-center gap-1.5 text-[11px] font-bold text-[#9CA3AF] hover:text-[#6B7280] transition-colors select-none">
                                    <span>📐</span> ดูสูตรคำนวณและแหล่งข้อมูล
                                    <svg className="w-3.5 h-3.5 ml-auto group-open/detail:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
                                  </summary>
                                  <div className="px-4 pb-3 space-y-2">
                                    {a.formula && (
                                      <div className="bg-white/80 px-3 py-2 rounded-lg border border-[#E5E7EB]/50">
                                        <div className="text-[10px] font-bold text-[#9CA3AF] mb-0.5">🧮 สูตรคำนวณ</div>
                                        <p className="text-[11px] text-[#4B5563] font-medium leading-relaxed font-mono">{a.formula}</p>
                                      </div>
                                    )}
                                    {a.data_source && (
                                      <div className="bg-white/80 px-3 py-2 rounded-lg border border-[#E5E7EB]/50">
                                        <div className="text-[10px] font-bold text-[#9CA3AF] mb-0.5">📂 แหล่งข้อมูล</div>
                                        <p className="text-[11px] text-[#4B5563] font-medium">{a.data_source}</p>
                                      </div>
                                    )}
                                  </div>
                                </details>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#E5E7EB] bg-[#F9FAFB] flex justify-between items-center shrink-0">
          <div className="text-xs text-[#9CA3AF] font-medium">
            {anomalies.length > 0 && (
              <span className="text-rose-500 font-bold">⚠️ {anomalies.length} รายการต้องตรวจสอบ</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-[#1F2937] text-white font-bold hover:bg-[#374151] transition-all shadow-sm active:scale-95"
          >
            ปิดหน้าต่าง
          </button>
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

              {/* Overall Percentage Summary */}
              <OverallPercentageSummary vehicles={analytics.byVehicle} selectedTeams={selectedTeams} teams={teams} />

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
                name: v.team_name && v.team_name !== 'ไม่ระบุทีม' ? v.team_name : v.license_plate,
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
              </div>
              <div className="overflow-auto max-h-[600px] w-full pb-2 relative scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="sticky top-0 z-10 bg-white shadow-sm">
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="p-4 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-center w-12">ลำดับ</th>
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
                    {records.map((r, index) => {
                      const teamEff = efficiency.find(e => e.team_id === r.team_id);
                      const caseCount = teamEff ? parseInt(teamEff.case_count || 0) : 0;
                      const kmPerLiter = parseFloat(r.liters) > 0 ? (parseFloat(r.distance || 0) / parseFloat(r.liters)).toFixed(2) : '0.00';
                      const costPerKm = parseFloat(r.distance || 0) > 0 ? (parseFloat(r.total_price) / parseFloat(r.distance)).toFixed(2) : '0.00';
                      const costPerJob = caseCount > 0 ? (parseFloat(r.total_price) / caseCount).toFixed(2) : '0.00';

                      return (
                        <tr key={r.id} className="hover:bg-[#F9FAFB] transition-colors group">
                          <td className="p-4 text-sm text-[#9CA3AF] font-bold text-center">
                            {index + 1}
                          </td>
                          <td className="p-4 text-sm text-[#4B5563] font-medium whitespace-nowrap">
                            {thaiDateTime(r.date_recorded)}
                          </td>
                          <td className="p-4 text-sm text-[#1F2937] whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-bold text-[#1F2937]">
                                {r.filler_name ? r.filler_name : (r.tech_name || 'N/A')}
                              </span>
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
                          <td className="p-4 text-sm font-black tracking-wide text-[#6B7280] whitespace-nowrap text-right">
                            <div className="flex flex-col items-end gap-1">
                              <span>{r.mileage.toLocaleString()}</span>
                              {r.is_trip ? (
                                <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200">ไมล์ทริป</span>
                              ) : null}
                            </div>
                          </td>
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

      {/* Summary Modal — Vehicle Analysis with Anomaly Detection */}
      {showSummaryModal && (
        <VehicleSummaryModal
          onClose={() => setShowSummaryModal(false)}
          startDate={startDate}
          endDate={endDate}
          selectedTeams={selectedTeams}
        />
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
                      <ImageWithFallback
                        img={img}
                        defaultFolder="oil_receipts"
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-full object-cover min-h-[300px] max-h-[600px] hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                        onClick={(workingUrl) => window.open(workingUrl, '_blank')}
                      />
                      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-black text-[#042C53] shadow-sm border border-white">
                        รูปที่ {idx + 1}
                      </div>
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
