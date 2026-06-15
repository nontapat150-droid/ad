import { useState, useRef, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

export default function EntryFeePage() {
  const { user } = useAuth();
  const isOfficeTech = user?.role === 'technician' || user?.roles?.includes('technician') || user?.role === 'office_technician';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('record'); // 'record' | 'history'

  // --- RECORD STATE ---
  const [accessNo, setAccessNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  // --- HISTORY STATE ---
  const [historyData, setHistoryData] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Fetch History when tab changes to 'history' or month changes
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, selectedMonth]);

  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await axios.get(`/dispatch/entry-fee/history?month=${selectedMonth}`);
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
    if (!selectedFile) {
      Swal.fire({ icon: 'warning', title: 'แจ้งเตือน', text: 'กรุณาอัปโหลดรูปภาพค่าแรกเข้า' });
      return;
    }

    const formData = new FormData();
    formData.append('access_no', accessNo.trim());
    formData.append('customer_name', customerName.trim());
    formData.append('image', selectedFile);

    setIsSubmitting(true);
    try {
      await axios.post('/dispatch/entry-fee', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      Swal.fire({
        icon: 'success',
        title: 'สำเร็จ',
        text: 'บันทึกค่าแรกเข้าเรียบร้อยแล้ว'
      });
      
      // Reset form
      setAccessNo('');
      setCustomerName('');
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'ผิดพลาด', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

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

                  <div className="mb-8">
                    <label className="block text-sm font-bold text-[#374151] mb-3 uppercase tracking-wide">อัปโหลดรูปภาพหลักฐาน <span className="text-red-500">*</span></label>
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
                            <p className="mb-2 text-sm font-bold text-[#374151]">คลิกเพื่ออัปโหลดรูปภาพ</p>
                            <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider">รองรับไฟล์ JPG, PNG</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button 
                      type="submit" 
                      disabled={isSubmitting || !selectedFile || !accessNo || !customerName}
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
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="text-[11px] font-bold text-[#9CA3AF] uppercase tracking-wider whitespace-nowrap">เดือนที่บันทึก</label>
                    <input 
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-4 py-2 border border-[#E5E7EB] bg-[#F9FAFB] rounded-xl outline-none focus:border-[#A3E635] focus:ring-4 focus:ring-[#A3E635]/20 text-[#1F2937] font-bold w-full sm:w-auto transition-all"
                    />
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
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">วันที่บันทึก</th>
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider">ผู้บันทึก</th>
                          <th className="py-4 px-5 font-bold text-[11px] text-[#6B7280] uppercase tracking-wider text-right">รูปหลักฐาน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((item, idx) => (
                          <tr key={item.id} className={`transition-colors hover:bg-[#F9FAFB] ${idx !== historyData.length - 1 ? 'border-b border-[#F3F4F6]' : ''}`}>
                            <td className="py-4 px-5">
                              <span className="font-bold text-[#65a30d] bg-[#A3E635]/10 border border-[#A3E635]/20 px-2.5 py-1 rounded-md text-sm">{item.access_no}</span>
                            </td>
                            <td className="py-4 px-5 font-bold text-[#1F2937] text-sm">{item.customer_name}</td>
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
                              <a 
                                href={`http://localhost:3001${item.image_path}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center justify-center p-2.5 bg-white border border-[#E5E7EB] hover:border-[#A3E635] hover:text-[#65a30d] text-[#6B7280] rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95 group"
                                title="ดูรูปภาพ"
                              >
                                <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </a>
                            </td>
                          </tr>
                        ))}
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
