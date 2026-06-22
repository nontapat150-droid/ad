import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { thaiDateTime } from '../utils/thaiDate';

const CustomMonthPicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentYear, setCurrentYear] = useState(() => {
    return value ? parseInt(value.split('-')[0], 10) : new Date().getFullYear();
  });
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = [
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
    { value: '12', label: 'December', labelTh: 'ธ.ค.' }
  ];

  const handleMonthSelect = (monthVal) => {
    onChange(`${currentYear}-${monthVal}`);
    setIsOpen(false);
  };

  const getDisplayLabel = () => {
    if (!value) return 'เลือกเดือน';
    const [y, m] = value.split('-');
    const monthObj = months.find(x => x.value === m);
    return monthObj ? `${monthObj.label} ${y}` : value;
  };

  return (
    <div className="relative" ref={pickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between w-full sm:w-[200px] px-4 py-2 bg-[#F9FAFB] border ${isOpen ? 'border-[#A3E635] ring-4 ring-[#A3E635]/20' : 'border-[#E5E7EB] hover:border-[#A3E635]'} rounded-xl outline-none text-[#1F2937] font-bold transition-all shadow-sm group`}
      >
        <span className="flex items-center gap-2">
          {getDisplayLabel()}
        </span>
        <svg className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#65a30d]' : 'text-[#9CA3AF] group-hover:text-[#65a30d]'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>

      <div 
        className={`absolute right-0 mt-2 p-4 bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#E5E7EB] w-[280px] z-50 transition-all duration-300 origin-top-right ${
          isOpen ? 'opacity-100 transform scale-100 translate-y-0' : 'opacity-0 transform scale-95 -translate-y-2 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between mb-4 px-1">
          <button 
            type="button" 
            onClick={() => setCurrentYear(prev => prev - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#1F2937] transition-colors border border-transparent hover:border-[#E5E7EB]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-bold text-[#1F2937] text-base">{currentYear}</span>
          <button 
            type="button" 
            onClick={() => setCurrentYear(prev => prev + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#1F2937] transition-colors border border-transparent hover:border-[#E5E7EB]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {months.map(m => {
            const isSelected = value === `${currentYear}-${m.value}`;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => handleMonthSelect(m.value)}
                className={`py-2.5 rounded-xl text-sm font-bold transition-all flex flex-col items-center justify-center ${
                  isSelected 
                    ? 'bg-gradient-to-br from-[#A3E635] to-[#84cc16] text-[#1F2937] shadow-md shadow-lime-500/20 scale-105' 
                    : 'text-[#4B5563] bg-transparent hover:bg-[#F3F4F6] hover:text-[#1F2937] border border-transparent hover:border-[#E5E7EB]'
                }`}
              >
                <span>{m.label.substring(0, 3)}</span>
                <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-[#1F2937]/70' : 'text-[#9CA3AF]'}`}>{m.labelTh}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const FEE_TYPE_LABELS = {
  slip: { icon: '💳', label: 'แนบสลิป', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  cash: { icon: '💵', label: 'รับหน้างาน', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  backdate: { icon: '📅', label: 'ย้อนหลัง', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

export default function EntryFeePage() {
  const { user } = useAuth();
  const isOfficeTech = user?.role === 'technician' || user?.roles?.includes('technician') || user?.role === 'office_technician';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'history'

  // --- RECORD STATE ---
  const [accessNo, setAccessNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [feeType, setFeeType] = useState('slip'); // 'slip' | 'cash' | 'backdate'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [backdateValue, setBackdateValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // --- HISTORY STATE ---
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [filterCreatedBy, setFilterCreatedBy] = useState('');
  const [usersList, setUsersList] = useState([]);

  // Fetch user list for filter
  useEffect(() => {
    axios.get('/users/teams').then(res => {
      // Flatten teams' users for a simple select
      const allUsers = [];
      const seen = new Set();
      (res.data || []).forEach(team => {
        (team.users || []).forEach(u => {
          if (!seen.has(u.id)) {
            seen.add(u.id);
            allUsers.push({ id: u.id, name: u.full_name || u.username });
          }
        });
      });
      setUsersList(allUsers);
    }).catch(() => {});
  }, []);

  // Fetch History when tab changes to 'history' or filters change
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, selectedMonth, filterCreatedBy]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      let url = `/dispatch/entry-fee/history?month=${selectedMonth}`;
      if (filterCreatedBy) url += `&created_by=${filterCreatedBy}`;
      const res = await axios.get(url);
      setHistoryData(res.data);
    } catch (err) {
      console.error('Failed to load entry fee history', err);
      Swal.fire({ icon: 'error', title: 'ข้อผิดพลาด', text: 'ไม่สามารถดึงข้อมูลประวัติได้' });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        Swal.fire({ icon: 'error', title: 'ไฟล์ไม่ถูกต้อง', text: 'กรุณาอัปโหลดไฟล์รูปภาพเท่านั้น' });
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!accessNo.trim() || !customerName.trim()) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณากรอกรหัส NON และชื่อลูกค้าให้ครบถ้วน' });
      return;
    }
    if ((feeType === 'slip' || feeType === 'backdate') && !selectedFile) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาอัปโหลดรูปสลิปค่าแรกเข้า' });
      return;
    }
    if (feeType === 'backdate' && !backdateValue) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาเลือกวันที่ย้อนหลัง' });
      return;
    }

    const formData = new FormData();
    formData.append('access_no', accessNo.trim());
    formData.append('customer_name', customerName.trim());
    formData.append('fee_type', feeType);
    if (selectedFile) formData.append('image', selectedFile);
    if (feeType === 'backdate') formData.append('backdate', backdateValue);

    setIsSubmitting(true);
    try {
      await axios.post('/dispatch/entry-fee', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ',
        text: `บันทึกค่าแรกเข้าเรียบร้อยแล้ว (${FEE_TYPE_LABELS[feeType]?.label || feeType})`
      });
      
      // Reset form
      setAccessNo('');
      setCustomerName('');
      setSelectedFile(null);
      setPreviewUrl(null);
      setBackdateValue('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => thaiDateTime(dateString);

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6]">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeKey="entry_fee" 
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[272px]">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB] shrink-0 z-10"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-xl text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                <svg className="w-4 h-4 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="font-bold text-[#1F2937] text-lg tracking-tight">ระบบบันทึกค่าแรกเข้า</h1>
            </div>
          </div>
        </header>

        {/* ── Tabs ───────────────────────────────────────── */}
        {!isOfficeTech && (
          <div className="px-4 py-3 bg-white border-b border-[#E5E7EB] z-0 shadow-sm flex gap-2 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
            <button 
              type="button"
              onClick={() => setActiveTab('record')}
              className={`px-5 py-2 rounded-full font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === 'record' 
                  ? 'bg-gradient-to-r from-[#A3E635] to-[#84cc16] text-[#1F2937] shadow-sm border border-[#65a30d]/20' 
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#1F2937]'
              }`}
            >
              บันทึกค่าแรกเข้า
            </button>
            <button 
              type="button"
              onClick={() => setActiveTab('history')}
              className={`px-5 py-2 rounded-full font-bold text-sm transition-all whitespace-nowrap ${
                activeTab === 'history' 
                  ? 'bg-gradient-to-r from-[#A3E635] to-[#84cc16] text-[#1F2937] shadow-sm border border-[#65a30d]/20' 
                  : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB] hover:text-[#1F2937]'
              }`}
            >
              ประวัติการบันทึก
            </button>
          </div>
        )}

        {/* ── Main Content ───────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative z-0">
          <div className="max-w-4xl mx-auto w-full">
            
            {activeTab === 'record' ? (
              <div 
                className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-sm border border-[#E5E7EB]"
                style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}
              >
                <form onSubmit={handleSubmit}>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-[#F3F4F6] pb-8">
                    <div>
                      <label className="block text-sm font-bold text-[#374151] mb-2 uppercase tracking-wide">รหัส NON <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={accessNo}
                        onChange={(e) => setAccessNo(e.target.value)}
                        placeholder="เช่น 880xxxxxxx"
                        className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:ring-4 focus:ring-[#A3E635]/20 focus:border-[#A3E635] outline-none text-[#1F2937] font-bold transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#374151] mb-2 uppercase tracking-wide">ชื่อลูกค้า <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="ระบุชื่อลูกค้า"
                        className="w-full px-4 py-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:ring-4 focus:ring-[#A3E635]/20 focus:border-[#A3E635] outline-none text-[#1F2937] font-bold transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* ── Fee Type Selection ─────────────────── */}
                  <div className="mb-8">
                    <label className="block text-sm font-bold text-[#374151] mb-3 uppercase tracking-wide">ประเภทค่าแรกเข้า</label>
                    <div className="grid grid-cols-3 gap-3">
                      {/* Slip */}
                      <button 
                        type="button"
                        onClick={() => setFeeType('slip')}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                          feeType === 'slip'
                            ? 'border-[#A3E635] bg-[#A3E635]/10 shadow-md scale-[1.02] text-[#4D7C0F]'
                            : 'border-[#E5E7EB] bg-white hover:border-[#A3E635]/50 text-[#6B7280] hover:text-[#374151]'
                        }`}
                      >
                        <span className="text-3xl">💳</span>
                        <span className="text-sm font-bold">แนบสลิป</span>
                        <span className="text-[10px] text-[#9CA3AF]">ต้องแนบสลิปทุกครั้ง</span>
                      </button>

                      {/* Cash */}
                      <button 
                        type="button"
                        onClick={() => setFeeType('cash')}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                          feeType === 'cash'
                            ? 'border-emerald-400 bg-emerald-50 shadow-md scale-[1.02] text-emerald-700'
                            : 'border-[#E5E7EB] bg-white hover:border-emerald-300 text-[#6B7280] hover:text-[#374151]'
                        }`}
                      >
                        <span className="text-3xl">💵</span>
                        <span className="text-sm font-bold">รับหน้างาน</span>
                        <span className="text-[10px] text-[#9CA3AF]">รับเงินสดหน้างาน</span>
                      </button>

                      {/* Backdate */}
                      <button 
                        type="button"
                        onClick={() => setFeeType('backdate')}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 transition-all ${
                          feeType === 'backdate'
                            ? 'border-purple-400 bg-purple-50 shadow-md scale-[1.02] text-purple-700'
                            : 'border-[#E5E7EB] bg-white hover:border-purple-300 text-[#6B7280] hover:text-[#374151]'
                        }`}
                      >
                        <span className="text-3xl">📅</span>
                        <span className="text-sm font-bold">ย้อนหลัง</span>
                        <span className="text-[10px] text-[#9CA3AF]">กรอกข้อมูลย้อนหลัง</span>
                      </button>
                    </div>
                  </div>

                  {/* ── Backdate Date Picker ────────────────── */}
                  {feeType === 'backdate' && (
                    <div className="mb-8 p-4 bg-purple-50 rounded-2xl border border-purple-200" style={{ animation: 'fadeInUp 0.2s ease-out forwards' }}>
                      <label className="block text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                        📅 เลือกวันที่ย้อนหลัง <span className="text-red-500">*</span>
                      </label>
                      <input 
                        type="date" 
                        value={backdateValue}
                        onChange={(e) => setBackdateValue(e.target.value)}
                        max={new Date().toLocaleDateString('en-CA')}
                        className="w-full px-4 py-3 bg-white border border-purple-300 rounded-xl focus:ring-4 focus:ring-purple-200 focus:border-purple-400 outline-none text-[#1F2937] font-bold transition-all"
                        required
                      />
                      <p className="text-xs text-purple-500 mt-2 font-medium">⚠️ รายการนี้จะแสดงเป็น "ย้อนหลัง" ในประวัติ</p>
                    </div>
                  )}

                  {/* ── Image Upload (for slip and backdate) ── */}
                  {(feeType === 'slip' || feeType === 'backdate') && (
                    <div className="mb-8" style={{ animation: 'fadeInUp 0.2s ease-out forwards' }}>
                      <label className="block text-sm font-bold text-[#374151] mb-3 uppercase tracking-wide">อัปโหลดรูปสลิป <span className="text-red-500">*</span></label>
                      <div className="relative group">
                        <input
                          type="file"
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          id="entry-fee-upload"
                        />
                        <label 
                          htmlFor="entry-fee-upload"
                          className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all ${
                            previewUrl 
                              ? 'border-[#A3E635] bg-[#A3E635]/5 shadow-inner' 
                              : 'border-[#D1D5DB] bg-[#F9FAFB] hover:border-[#A3E635]/60 hover:bg-[#F3F4F6]'
                          }`}
                        >
                          {previewUrl ? (
                            <div className="relative w-full h-full p-3 group">
                              <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-xl shadow-sm" />
                              <div className="absolute inset-0 bg-[#1F2937]/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl backdrop-blur-sm m-3">
                                <span className="text-[#1F2937] font-bold bg-[#A3E635] px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 transform scale-95 group-hover:scale-100 transition-transform duration-200">
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                                  เปลี่ยนรูปภาพ
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-[#6B7280]">
                              <div className="w-16 h-16 rounded-full bg-white shadow-sm border border-[#E5E7EB] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                                <svg className="w-8 h-8 text-[#A3E635]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                              </div>
                              <p className="mb-2 text-sm font-bold text-[#374151]">คลิกเพื่ออัปโหลดรูปสลิป</p>
                              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">รองรับไฟล์ JPG, PNG</p>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Cash mode info */}
                  {feeType === 'cash' && (
                    <div className="mb-8 p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center" style={{ animation: 'fadeInUp 0.2s ease-out forwards' }}>
                      <span className="text-4xl block mb-3">💵</span>
                      <p className="text-emerald-800 font-bold text-sm">รับเงินสดหน้างาน</p>
                      <p className="text-emerald-600 text-xs mt-1">ระบบจะบันทึกว่ารับค่าแรกเข้าเป็นเงินสดหน้างาน</p>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <button 
                      type="submit" 
                      disabled={isSubmitting || !accessNo || !customerName || ((feeType === 'slip' || feeType === 'backdate') && !selectedFile) || (feeType === 'backdate' && !backdateValue)}
                      className="bg-[#1F2937] hover:bg-[#374151] text-white font-bold px-8 py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg w-full sm:w-auto flex justify-center items-center gap-2 active:scale-95"
                    >
                      {isSubmitting ? (
                        <div className="w-5 h-5 border-2 border-[#A3E635] border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <svg className="w-5 h-5 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          ยืนยันบันทึกข้อมูล
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // --- HISTORY TAB ---
              <div 
                className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 shadow-sm border border-[#E5E7EB]"
                style={{ animation: 'fadeInUp 0.3s ease-out forwards' }}
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-[#F3F4F6]">
                  <h2 className="text-lg font-bold text-[#1F2937]">ประวัติค่าแรกเข้า</h2>
                  <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    {/* Filter by creator */}
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap">ผู้บันทึก</label>
                      <select
                        value={filterCreatedBy}
                        onChange={(e) => setFilterCreatedBy(e.target.value)}
                        className="px-3 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl outline-none text-[#1F2937] font-bold text-sm hover:border-[#A3E635] transition-all min-w-[140px]"
                      >
                        <option value="">ทั้งหมด</option>
                        {usersList.map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    {/* Month picker */}
                    <div className="flex items-center gap-2">
                      <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap">เดือน</label>
                      <CustomMonthPicker 
                        value={selectedMonth}
                        onChange={setSelectedMonth}
                      />
                    </div>
                  </div>
                </div>

                {isLoadingHistory ? (
                  <div className="flex justify-center py-16">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#E5E7EB] border-t-[#A3E635]"></div>
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-16 bg-[#F9FAFB] rounded-2xl border border-dashed border-[#D1D5DB]">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-[#E5E7EB] text-[#9CA3AF]">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#374151] mb-1">ไม่พบประวัติการบันทึก</h3>
                    <p className="text-[#6B7280] text-sm">ไม่มีข้อมูลการเก็บค่าแรกเข้าในเดือนที่เลือก</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">รหัส NON</th>
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">ชื่อลูกค้า</th>
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">ประเภท</th>
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">วันที่บันทึก</th>
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">ผู้บันทึก</th>
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">หลักฐาน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((item, idx) => {
                          const typeInfo = FEE_TYPE_LABELS[item.fee_type] || FEE_TYPE_LABELS.slip;
                          const isBackdate = item.fee_type === 'backdate';
                          return (
                            <tr key={item.id} className={`transition-colors hover:bg-[#F9FAFB] ${idx !== historyData.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}>
                              <td className="py-4 px-5">
                                <span className="font-bold text-[#65a30d] bg-[#A3E635]/10 border border-[#A3E635]/20 px-2.5 py-1 rounded-md text-sm">{item.access_no}</span>
                              </td>
                              <td className="py-4 px-5 font-bold text-[#1F2937] text-sm">{item.customer_name}</td>
                              <td className="py-4 px-5">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${typeInfo.color}`}>
                                  {typeInfo.icon} {typeInfo.label}
                                </span>
                                {isBackdate && item.backdate && (
                                  <div className="text-[10px] text-purple-500 mt-1 font-medium">
                                    ⏮️ วันที่: {new Date(item.backdate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  </div>
                                )}
                              </td>
                              <td className="py-4 px-5 text-sm text-[#4B5563] font-medium">{formatDate(item.created_at)}</td>
                              <td className="py-4 px-5 text-sm text-[#374151] font-bold">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-full bg-[#1F2937] flex items-center justify-center text-xs font-bold text-[#A3E635] shrink-0 shadow-sm">
                                    {item.creator_name ? item.creator_name.charAt(0) : '?'}
                                  </div>
                                  {item.creator_name || '-'}
                                </div>
                              </td>
                              <td className="py-4 px-5 text-right">
                                {item.image_path && item.image_path !== 'รับหน้างาน' ? (
                                  <a 
                                    href={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace('/api', '') : ''}${item.image_path}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center p-2.5 bg-white border border-[#E5E7EB] hover:border-[#A3E635] hover:text-[#65a30d] text-[#6B7280] rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 group"
                                    title="ดูรูปภาพ"
                                  >
                                    <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </a>
                                ) : (
                                  <span className="text-xs text-[#9CA3AF] italic">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            
          </div>
        </main>
      </div>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
