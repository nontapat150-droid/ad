import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { thaiDate, thaiDateTime, thaiTimeAgo, thaiMonthYear } from '../utils/thaiDate';
import { getImageUrl } from '../utils/imageUtils';
import ImageWithFallback from '../components/common/ImageWithFallback';

const THAI_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

export default function TechOilHistoryPage() {
  const { user, hasRole } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewingImages, setViewingImages] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(null);

  const [errorMsg, setErrorMsg] = useState(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams();
      if (selectedMonth) params.append('month', selectedMonth);
      
      const res = await api.get(`/oil/team-records?${params.toString()}`);
      setRecords(res.data);
    } catch (err) {
      console.error('Failed to fetch team oil records:', err);
      const errMsg = err.response?.data?.error || err.message || JSON.stringify(err);
      setErrorMsg(`เกิดข้อผิดพลาดในการโหลดข้อมูล: ${errMsg}`);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Month navigation helpers
  const goMonth = (delta) => {
    if (!selectedMonth) {
      const now = new Date();
      setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      return;
    }
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const getMonthLabel = () => {
    if (!selectedMonth) return 'ทั้งหมด';
    const [y, m] = selectedMonth.split('-').map(Number);
    return `${THAI_MONTHS[m - 1]} ${y + 543}`;
  };

  const isCurrentMonth = () => {
    if (!selectedMonth) return false;
    const now = new Date();
    return selectedMonth === `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  };

  // Group records by date for timeline view
  const groupedByDate = records.reduce((acc, record) => {
    const dateKey = new Date(record.date_recorded).toISOString().slice(0, 10);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(record);
    return acc;
  }, {});

  const dateKeys = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  // Summary stats
  const totalLiters = records.reduce((sum, r) => sum + parseFloat(r.liters || 0), 0);
  const totalCost = records.reduce((sum, r) => sum + parseFloat(r.total_price || 0), 0);
  const totalRecords = records.length;

  return (
    <Layout activeKey="oil_history" pageTitle="ประวัติเติมน้ำมันทีม">
      <div className="flex flex-col gap-6 pb-12 w-full max-w-4xl mx-auto">

        {/* ── Hero Header ──────────────────────────────────── */}
        <div className="relative overflow-hidden bg-white rounded-3xl border border-[#E5E7EB] p-6 md:p-8"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.04)' }}>

          {/* Decorative background */}
          <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full bg-gradient-to-br from-amber-400/10 to-orange-500/5 blur-3xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 rounded-full bg-gradient-to-br from-[#A3E635]/10 to-[#65a30d]/5 blur-2xl pointer-events-none" />

          <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-lg"
                style={{ boxShadow: '0 4px 16px rgba(245,158,11,0.35)' }}>
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-extrabold text-[#1F2937] leading-tight">
                  ประวัติเติมน้ำมัน
                </h1>
                <p className="text-sm text-[#6B7280] font-medium mt-0.5 flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 bg-[#A3E635]/15 text-[#65a30d] text-xs font-bold px-2.5 py-1 rounded-lg border border-[#A3E635]/25">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                    </svg>
                    {user?.team_name || 'ทีมของฉัน'}
                  </span>
                </p>
              </div>
            </div>

            <button
              onClick={fetchRecords}
              className="flex items-center gap-2 bg-[#F9FAFB] hover:bg-[#F3F4F6] border border-[#E5E7EB] hover:border-[#A3E635]/40 text-[#374151] px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 shadow-sm"
            >
              <svg className="w-4 h-4 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              โหลดข้อมูลใหม่
            </button>
          </div>

          {/* ── Filters ── */}
          <div className="relative mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">

            {/* Month Filter */}
            <div className="flex items-center gap-1 p-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex-shrink-0">
              {/* Prev month */}
              <button
                onClick={() => goMonth(-1)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:bg-white transition-all active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
              </button>

              {/* Month label */}
              <div className="px-4 py-1.5 min-w-[120px] text-center">
                <p className="text-sm font-black text-[#1F2937]">{getMonthLabel()}</p>
              </div>

              {/* Next month */}
              <button
                onClick={() => goMonth(1)}
                disabled={isCurrentMonth()}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B7280] hover:text-[#1F2937] hover:bg-white transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>

            {/* Quick buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  const now = new Date();
                  setSelectedMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  isCurrentMonth()
                    ? 'bg-[#1F2937] text-white shadow-sm'
                    : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#A3E635]/40 hover:text-[#374151]'
                }`}
              >
                เดือนนี้
              </button>
              <button
                onClick={() => setSelectedMonth(null)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                  !selectedMonth
                    ? 'bg-[#1F2937] text-white shadow-sm'
                    : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-[#A3E635]/40 hover:text-[#374151]'
                }`}
              >
                ทั้งหมด
              </button>
            </div>
          </div>

          {/* ── Quick Stats ── */}
          {!loading && records.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mt-5 relative">
              <div className="bg-[#F9FAFB] rounded-2xl p-4 border border-[#E5E7EB] text-center hover:shadow-sm transition-shadow">
                <p className="text-2xl md:text-3xl font-black text-[#1F2937] tracking-tight">{totalRecords}</p>
                <p className="text-[11px] md:text-xs text-[#9CA3AF] font-bold mt-1">รายการทั้งหมด</p>
              </div>
              <div className="bg-[#F9FAFB] rounded-2xl p-4 border border-[#E5E7EB] text-center hover:shadow-sm transition-shadow">
                <p className="text-2xl md:text-3xl font-black text-amber-500 tracking-tight">{totalLiters.toFixed(1)}</p>
                <p className="text-[11px] md:text-xs text-[#9CA3AF] font-bold mt-1">ลิตรรวม</p>
              </div>
              <div className="bg-[#F9FAFB] rounded-2xl p-4 border border-[#E5E7EB] text-center hover:shadow-sm transition-shadow">
                <p className="text-2xl md:text-3xl font-black text-emerald-600 tracking-tight">฿{totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <p className="text-[11px] md:text-xs text-[#9CA3AF] font-bold mt-1">ยอดเงินรวม</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Error State ───────────────────────────────────── */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-6 text-center text-red-600 font-bold mb-4">
            <div className="text-3xl mb-2">⚠️</div>
            {errorMsg}
          </div>
        )}

        {/* ── Loading Skeleton ──────────────────────────────── */}
        {loading && !errorMsg ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-[#E5E7EB] p-5 animate-pulse">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#F3F4F6]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-[#F3F4F6] rounded-lg" />
                    <div className="h-3 w-24 bg-[#F3F4F6] rounded-lg" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-16 bg-[#F9FAFB] rounded-xl" />
                  <div className="h-16 bg-[#F9FAFB] rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        ) : records.length === 0 && !errorMsg ? (
          /* ── Empty State ── */
          <div className="bg-white rounded-3xl border border-[#E5E7EB] p-12 text-center"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            <div className="w-20 h-20 rounded-3xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center mx-auto mb-5 text-4xl">
              ⛽
            </div>
            <h3 className="text-[#1F2937] font-bold text-xl mb-2">ยังไม่มีประวัติการเติมน้ำมัน</h3>
            <p className="text-[#9CA3AF] text-sm max-w-md mx-auto">
              ทีมของคุณยังไม่มีข้อมูลการเติมน้ำมัน เมื่อมีการบันทึกข้อมูลจะแสดงที่นี่
            </p>
          </div>
        ) : !errorMsg ? (
          /* ── Timeline View ─────────────────────────────── */
          <div className="space-y-6">
            {dateKeys.map((dateKey) => (
              <div key={dateKey}>
                {/* Date separator */}
                <div className="flex items-center gap-3 mb-3 px-1">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1F2937] to-[#374151] flex items-center justify-center text-white text-xs font-black shadow-sm">
                    {new Date(dateKey).getDate()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1F2937]">{thaiDate(dateKey)}</p>
                    <p className="text-[11px] text-[#9CA3AF] font-medium">{groupedByDate[dateKey].length} รายการ</p>
                  </div>
                  <div className="flex-1 h-px bg-gradient-to-r from-[#E5E7EB] to-transparent" />
                </div>

                {/* Cards for this date */}
                <div className="space-y-3">
                  {groupedByDate[dateKey].map((record) => (
                    <RecordCard
                      key={record.id}
                      record={record}
                      onViewImages={setViewingImages}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Evidence Images Modal ─────────────────────────── */}
      {viewingImages && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="absolute inset-0 bg-[#1F2937]/70 backdrop-blur-md" onClick={() => { setViewingImages(null); setSelectedImage(null); }} />
          <div className="relative w-full max-w-4xl flex flex-col bg-white rounded-3xl shadow-2xl border border-[#E5E7EB] overflow-hidden max-h-[90vh]">

            <div className="p-5 border-b border-[#E5E7EB] bg-[#F9FAFB] flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-lg shadow-sm">📸</div>
                <div>
                  <h2 className="text-lg font-black text-[#1F2937]">หลักฐานการเติมน้ำมัน</h2>
                  <p className="text-xs font-medium text-[#9CA3AF]">{viewingImages.length} รูปภาพ</p>
                </div>
              </div>
              <button onClick={() => { setViewingImages(null); setSelectedImage(null); }} className="p-2 hover:bg-[#E5E7EB] text-[#6B7280] rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 p-5 overflow-y-auto">
              {/* Full-size selected image */}
              {selectedImage && (
                <div className="mb-4">
                  <ImageWithFallback
                    img={selectedImage}
                    defaultFolder="oil_receipts"
                    alt="Evidence"
                    className="w-full rounded-2xl border border-[#E5E7EB] shadow-sm cursor-zoom-in"
                    onClick={(workingUrl) => window.open(workingUrl, '_blank')}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {viewingImages.map((img, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`relative rounded-xl overflow-hidden border-2 cursor-pointer transition-all hover:shadow-md group ${selectedImage === img ? 'border-amber-400 shadow-md' : 'border-[#E5E7EB] hover:border-amber-300'}`}
                  >
                    <ImageWithFallback
                      img={img}
                      defaultFolder="oil_receipts"
                      alt={`Evidence ${idx + 1}`}
                      className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] font-black text-[#374151] shadow-sm">
                      #{idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

// ── Record Card Component ───────────────────────────────────
function RecordCard({ record, onViewImages }) {
  const r = record;
  const dateObj = new Date(r.date_recorded);
  const timeStr = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;

  // Display name: use filler_name if available, otherwise tech_name
  const displayName = r.filler_name || r.tech_name || 'ไม่ระบุ';
  const initials = displayName.substring(0, 2);
  const roleLabel = r.tech_role === 'ma_technician' ? 'ช่าง MA'
    : r.tech_role === 'technician' ? 'ช่าง Office'
    : r.tech_role === 'contractor_office' ? 'รับเหมา Office'
    : r.tech_role === 'contractor_ma' ? 'รับเหมา MA'
    : r.tech_role === 'sales' ? 'เซล'
    : r.tech_role === 'admin' ? 'แอดมิน'
    : r.tech_role === 'super_admin' ? 'Super Admin'
    : r.tech_role || '-';

  return (
    <div className="bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#A3E635]/30 transition-all hover:shadow-md group"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>

      {/* ── Filler Info Header ── */}
      <div className="flex items-center gap-3 p-4 pb-3">
        {/* Profile Image */}
        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border-2 border-[#A3E635]/30 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
          {r.tech_profile_image ? (
            <img
              src={`/uploads/profiles/${r.tech_profile_image}`}
              alt={displayName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#1F2937] font-bold text-sm">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-[#1F2937] truncate">{displayName}</p>
            <span className="text-[9px] font-bold text-[#1F2937] bg-[#A3E635]/20 rounded px-1.5 py-0.5 leading-none border border-[#A3E635]/30 shrink-0">
              {roleLabel}
            </span>
          </div>
          <p className="text-[11px] text-[#9CA3AF] font-medium mt-0.5 flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            บันทึกเมื่อ {thaiTimeAgo(r.date_recorded)} · {timeStr} น.
          </p>
          {/* Show account owner if filler_name is different */}
          {r.filler_name && r.tech_name && r.filler_name !== r.tech_name && (
            <p className="text-[10px] text-[#9CA3AF] font-medium mt-0.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              บัญชี: {r.tech_name}
            </p>
          )}
        </div>
      </div>

      {/* ── Data Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 border-t border-[#F3F4F6]">
        {/* Date */}
        <DataCell
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>}
          label="วัน/เดือน/ปี"
          value={thaiDate(r.date_recorded)}
          colorClass="text-[#1F2937]"
          borderRight
          borderBottom
        />
        {/* License Plate */}
        <DataCell
          icon={<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0H21M3.375 14.25h-.375a3 3 0 013-3h.008a3 3 0 013 3v.375m-6-.375h6m5.25-3V6.375a1.125 1.125 0 00-1.125-1.125H6.375A1.125 1.125 0 005.25 6.375v8.25" /></svg>}
          label="ทะเบียนรถ"
          value={r.license_plate || '-'}
          colorClass="text-[#1F2937] font-black"
          borderBottom
        />
        {/* Liters */}
        <DataCell
          icon="⛽"
          label="จำนวนลิตร"
          value={`${parseFloat(r.liters || 0).toFixed(2)} ลิตร`}
          colorClass="text-amber-600"
          borderRight
          borderBottom
        />
        {/* Price per Liter */}
        <DataCell
          icon="💰"
          label="ลิตร/บาท"
          value={`฿${parseFloat(r.price_per_liter || 0).toFixed(2)}`}
          colorClass="text-[#1F2937]"
          borderBottom
        />
      </div>

      {/* ── Bottom Row: Total + Evidence ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#F9FAFB]/50">
        <div className="flex items-center gap-4">
          {/* Total Price */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600 text-xs">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">จำนวนเงิน</p>
              <p className="text-base font-black text-emerald-600 tracking-tight">฿{parseFloat(r.total_price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* Evidence Images Button */}
        {r.images && r.images.length > 0 ? (
          <button
            onClick={() => onViewImages(r.images)}
            className="flex items-center gap-2 bg-white hover:bg-amber-50 border border-[#E5E7EB] hover:border-amber-300 px-3 py-2 rounded-xl text-sm font-bold text-[#374151] hover:text-amber-700 transition-all active:scale-95 shadow-sm group"
          >
            <div className="relative">
              <ImageWithFallback
                img={r.images[0]}
                defaultFolder="oil_receipts"
                alt="Evidence"
                className="w-8 h-8 rounded-lg object-cover border border-[#E5E7EB] group-hover:border-amber-300 transition-colors"
              />
              {r.images.length > 1 && (
                <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center shadow-sm">
                  {r.images.length}
                </div>
              )}
            </div>
            <span className="hidden sm:inline text-xs">ดูหลักฐาน</span>
          </button>
        ) : (
          <span className="text-[11px] text-[#D1D5DB] font-bold bg-[#F9FAFB] px-3 py-2 rounded-xl border border-[#E5E7EB]">
            ไม่มีภาพ
          </span>
        )}
      </div>
    </div>
  );
}

// ── Data Cell Sub-component ─────────────────────────────────
function DataCell({ icon, label, value, colorClass = '', borderRight, borderBottom }) {
  return (
    <div className={`px-4 py-3 ${borderRight ? 'border-r border-[#F3F4F6]' : ''} ${borderBottom ? '' : ''}`}>
      <div className="flex items-center gap-1 mb-1">
        {typeof icon === 'string' ? (
          <span className="text-xs">{icon}</span>
        ) : (
          <span className="text-[#9CA3AF]">{icon}</span>
        )}
        <span className="text-[10px] text-[#9CA3AF] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-sm font-bold ${colorClass} truncate`}>{value}</p>
    </div>
  );
}
