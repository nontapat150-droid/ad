import { useState, useEffect, useCallback } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import api from '../api/axios';
import Layout from '../components/Layout';
import OilRecordModal from '../components/OilRecordModal';
import OilRecordEditModal from '../components/OilRecordEditModal';
import DateRangeFilter from '../components/DateRangeFilter';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

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

      const [anRes, recRes, effRes] = await Promise.all([
        api.get(`/oil/analytics?${queryParams.toString()}`),
        api.get(`/oil/records?${queryParams.toString()}&limit=50`),
        api.get(`/oil/efficiency?${queryParams.toString()}`)
      ]);
      setAnalytics(anRes.data);
      setRecords(recRes.data);
      setEfficiency(effRes.data);
    } catch (err) {
      window.debugOilError = err.response?.data?.error || err.message || JSON.stringify(err);
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
      window.debugOilError = err.response?.data?.error || err.message || JSON.stringify(err);
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
            {window.debugOilError && (
              <div className="bg-red-100 text-red-600 p-4 rounded-xl">
                Debug Error: {window.debugOilError}
              </div>
            )}

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

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* 1. Daily Cost */}
              <div className="bg-white p-6 rounded-3xl flex flex-col shadow-sm border border-[#E5E7EB] hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-[#1F2937] text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">📈</div>
                    ค่าใช้จ่ายรายวัน (บาท)
                  </h3>
                </div>
                <div className="h-64 w-full">
                  {analytics.dailyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.dailyTrend} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="date" tickFormatter={(str) => str.split('-')[2]} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" name="ยอดเงิน (บาท)" dataKey="total_cost" stroke="#F59E0B" strokeWidth={4} dot={{ fill: '#FFF', stroke: '#F59E0B', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#F59E0B' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#9CA3AF] font-bold text-sm">ไม่มีข้อมูลในเดือนนี้</div>
                  )}
                </div>
              </div>

              {/* 2. Daily Liters */}
              <div className="bg-white p-6 rounded-3xl flex flex-col shadow-sm border border-[#E5E7EB] hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-[#1F2937] text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#A3E635]/20 text-[#65a30d] flex items-center justify-center">⛽</div>
                    ปริมาณน้ำมันรายวัน (ลิตร)
                  </h3>
                </div>
                <div className="h-64 w-full">
                  {analytics.dailyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics.dailyTrend} margin={{ top: 5, right: 20, left: -20, bottom: 5 }} barSize={16}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="date" tickFormatter={(str) => str.split('-')[2]} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip cursor={{ fill: '#F3F4F6' }} content={<CustomTooltip />} />
                        <Bar name="จำนวน (ลิตร)" dataKey="total_liters" fill="#A3E635" radius={[4, 4, 4, 4]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#9CA3AF] font-bold text-sm">ไม่มีข้อมูลในเดือนนี้</div>
                  )}
                </div>
              </div>

              {/* 3. Daily Distance */}
              <div className="bg-white p-6 rounded-3xl flex flex-col shadow-sm border border-[#E5E7EB] hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-[#1F2937] text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] text-[#374151] flex items-center justify-center">🛣️</div>
                    ระยะทางวิ่งรายวัน (กม.) รวมทุกคัน
                  </h3>
                </div>
                <div className="h-64 w-full">
                  {analytics.dailyTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics.dailyTrend} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                        <XAxis dataKey="date" tickFormatter={(str) => str.split('-')[2]} tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dx={-10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" name="ระยะทาง (กม.)" dataKey="total_distance" stroke="#374151" strokeWidth={4} dot={{ fill: '#FFF', stroke: '#374151', strokeWidth: 2, r: 4 }} activeDot={{ r: 6, strokeWidth: 0, fill: '#374151' }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#9CA3AF] font-bold text-sm">ไม่มีข้อมูลในเดือนนี้</div>
                  )}
                </div>
              </div>

              {/* 4. Efficiency per Job */}
              <div className="bg-white p-6 rounded-3xl flex flex-col shadow-sm border border-[#E5E7EB] hover:shadow-md transition-all">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-bold text-[#1F2937] text-lg flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-600 flex items-center justify-center">🎯</div>
                    ประสิทธิภาพต้นทุนต่อรอบ (บาท/งาน)
                  </h3>
                </div>
                <div className="h-64 w-full">
                  {efficiency.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={efficiency} margin={{ top: 5, right: 20, left: -20, bottom: 5 }} barSize={24} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F3F4F6" />
                        <XAxis type="number" tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} dy={10} />
                        <YAxis type="category" dataKey="team_name" tick={{ fill: '#6B7280', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} width={80} />
                        <Tooltip cursor={{ fill: '#F3F4F6' }} content={<CustomTooltip />} />
                        <Bar name="ต้นทุนต่อรอบ (บาท)" dataKey="cost_per_job" fill="#14b8a6" radius={[0, 8, 8, 0]}>
                          {efficiency.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#14b8a6' : '#2dd4bf'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-[#9CA3AF] font-bold text-sm">ไม่มีข้อมูลประสิทธิภาพในเดือนนี้</div>
                  )}
                </div>
              </div>
            </div>

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
                            {new Date(r.date_recorded).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })} {new Date(r.date_recorded).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                          </td>
                          <td className="p-4 text-sm text-[#1F2937] whitespace-nowrap">
                            <div className="flex flex-col gap-1.5">
                              <span className="font-bold text-[#1F2937]">{r.tech_name || 'N/A'}</span>
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
                          <td className="p-4 text-sm font-mono font-bold text-[#6B7280] whitespace-nowrap text-right">{r.mileage.toLocaleString()}</td>
                          <td className="p-4 text-sm font-mono font-bold text-[#374151] whitespace-nowrap text-right">{r.distance || 0}</td>
                          <td className="p-4 text-sm font-mono font-bold text-[#374151] whitespace-nowrap text-right">{kmPerLiter}</td>
                          <td className="p-4 text-sm font-mono text-indigo-600 font-bold whitespace-nowrap text-right">{caseCount}</td>
                          <td className="p-4 text-sm font-mono font-bold text-[#374151] whitespace-nowrap text-right">฿{costPerKm}</td>
                          <td className="p-4 text-sm font-mono font-bold text-[#374151] whitespace-nowrap text-right">฿{costPerJob}</td>
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
                          ไม่มีข้อมูลในเดือนนี้ (Debug: records={records.length}, isAdmin={isAdmin.toString()})
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
                    <div className="text-xs font-medium text-blue-600">ระยะห่างเฉลี่ยของการเติมน้ำมันแต่ละครั้งสำหรับข้อมูลชุดนี้</div>
                  </div>
                  <div className="text-2xl font-black text-blue-700">{avgFreq > 0 ? `${avgFreq.toFixed(1)} วัน/ครั้ง` : '-'}</div>
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
                          {new Date(r.date_recorded).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                        </td>
                        <td className="p-3 text-sm text-[#1F2937] font-bold whitespace-nowrap">{r.tech_name || '-'}</td>
                        <td className="p-3 text-sm text-[#1F2937] font-bold whitespace-nowrap">{r.license_plate || r.team_name || '-'}</td>
                        <td className="p-3 text-sm font-mono text-[#6B7280] text-right">{r.mileage.toLocaleString()}</td>
                        <td className="p-3 text-sm font-mono text-[#374151] font-bold text-right">{r.distance || 0}</td>
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
                        <td className="p-4 text-right font-mono font-black text-[#1F2937] text-lg">{records.reduce((sum, r) => sum + (parseFloat(r.distance) || 0), 0).toLocaleString()}</td>
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
