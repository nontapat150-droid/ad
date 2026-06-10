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
    <div className="flex h-dvh  font-sans overflow-hidden">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeKey="entry_fee" 
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="flex items-center justify-between p-4 glass border-b border-white/50 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl  text-[#185FA5] border border-white/50 hover:glass transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-bold text-[#042C53] text-lg md:text-xl tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ระบบบันทึกค่าแรกเข้า (Entry Fee)
            </h1>
          </div>
        </header>

        {/* Tabs */}
        {!isOfficeTech && (
          <div className="glass border-b border-white/50 px-4 md:px-8 flex gap-8">
            <button 
              type="button"
              onClick={() => setActiveTab('record')}
            className={`py-4 font-bold text-sm transition-colors border-b-2 ${
              activeTab === 'record' 
                ? 'border-brand-500 text-[#185FA5]' 
                : 'border-transparent text-[#378ADD] hover:text-[#042C53]'
            }`}
          >
            บันทึกค่าแรกเข้า
          </button>
          <button 
            type="button"
            onClick={() => setActiveTab('history')}
            className={`py-4 font-bold text-sm transition-colors border-b-2 ${
              activeTab === 'history' 
                ? 'border-brand-500 text-[#185FA5]' 
                : 'border-transparent text-[#378ADD] hover:text-[#042C53]'
            }`}
          >
            ประวัติการบันทึก
          </button>
        </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-4xl mx-auto w-full">
            
            {activeTab === 'record' ? (
              <div className="glass rounded-3xl p-6 md:p-10 shadow-sm border border-white/50 animate-fade-in-up">
                <form onSubmit={handleSubmit}>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 border-b border-white/30 pb-8">
                    <div>
                      <label className="block text-sm font-bold text-[#042C53] mb-2">รหัส NON (Access Number) <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={accessNo}
                        onChange={(e) => setAccessNo(e.target.value)}
                        placeholder="เช่น 880xxxxxxx"
                        className="w-full px-4 py-3  border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-[#042C53] font-medium transition-all"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-[#042C53] mb-2">ชื่อลูกค้า (Customer Name) <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="ระบุชื่อลูกค้า"
                        className="w-full px-4 py-3  border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-[#042C53] font-medium transition-all"
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-8">
                    <label className="block text-sm font-bold text-[#042C53] mb-4">อัปโหลดรูปภาพหลักฐานค่าแรกเข้า <span className="text-red-500">*</span></label>
                    <div className="relative">
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
                        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${
                          previewUrl ? 'border-brand-300 bg-[#E6F1FB]/30' : 'border-slate-300  hover:glass'
                        }`}
                      >
                        {previewUrl ? (
                          <div className="relative w-full h-full p-2">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain rounded-xl" />
                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                              <span className="text-white font-bold bg-black/50 px-4 py-2 rounded-lg">เปลี่ยนรูปภาพ</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-[#378ADD]">
                            <svg className="w-12 h-12 mb-3 text-[#378ADD] opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                            <p className="mb-2 text-sm font-bold">คลิกเพื่ออัปโหลดรูปภาพ</p>
                            <p className="text-xs">รองรับไฟล์ JPG, PNG</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      disabled={isSubmitting || !selectedFile || !accessNo || !customerName}
                      className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-8 py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg w-full sm:w-auto flex justify-center items-center gap-2"
                    >
                      {isSubmitting ? (
                        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
              <div className="glass rounded-3xl p-6 md:p-8 shadow-sm border border-white/50 animate-fade-in-up">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-white/30">
                  <h2 className="text-lg font-bold text-[#042C53]">ประวัติค่าแรกเข้า</h2>
                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <label className="text-sm font-bold text-[#378ADD] whitespace-nowrap">เดือนที่บันทึก:</label>
                    <input 
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="px-4 py-2 border border-white/50 rounded-xl outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500  text-[#042C53] font-medium w-full sm:w-auto"
                    />
                  </div>
                </div>

                {isLoadingHistory ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-500"></div>
                  </div>
                ) : historyData.length === 0 ? (
                  <div className="text-center py-16  rounded-2xl border border-dashed border-white/50">
                    <div className="w-20 h-20 glass rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm text-slate-300">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#185FA5] mb-1">ไม่พบประวัติการบันทึก</h3>
                    <p className="text-[#378ADD] opacity-80 text-sm">ไม่มีข้อมูลการเก็บค่าแรกเข้าในเดือนที่เลือก</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="glass/20">
                          <th className="py-4 px-4 font-bold text-sm text-[#378ADD] border-b">รหัส NON</th>
                          <th className="py-4 px-4 font-bold text-sm text-[#378ADD] border-b">ชื่อลูกค้า</th>
                          <th className="py-4 px-4 font-bold text-sm text-[#378ADD] border-b">วันที่บันทึก</th>
                          <th className="py-4 px-4 font-bold text-sm text-[#378ADD] border-b">ผู้บันทึก</th>
                          <th className="py-4 px-4 font-bold text-sm text-[#378ADD] border-b text-right">รูปหลักฐาน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((item) => (
                          <tr key={item.id} className="border-b border-white/30 hover: transition-colors">
                            <td className="py-4 px-4">
                              <span className="font-bold text-[#185FA5] bg-[#E6F1FB] px-2 py-1 rounded-md text-xs">{item.access_no}</span>
                            </td>
                            <td className="py-4 px-4 font-semibold text-[#042C53]">{item.customer_name}</td>
                            <td className="py-4 px-4 text-sm text-[#378ADD]">{formatDate(item.created_at)}</td>
                            <td className="py-4 px-4 text-sm text-[#185FA5]">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-[#E6F1FB] flex items-center justify-center text-xs font-bold text-[#185FA5] shrink-0">
                                  {item.creator_name ? item.creator_name.charAt(0) : '?'}
                                </div>
                                {item.creator_name || '-'}
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right">
                              <a 
                                href={`http://localhost:3001${item.image_path}`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center justify-center p-2 glass hover:bg-[#E6F1FB] text-[#185FA5] hover:text-[#185FA5] rounded-lg transition-colors"
                                title="ดูรูปภาพ"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
    </div>
  );
}
