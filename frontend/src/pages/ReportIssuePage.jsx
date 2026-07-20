import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import ManualModal from '../components/ManualModal';
import ManualHelpButton from '../components/ManualHelpButton';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

export default function ReportIssuePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.roles?.includes('super_admin') || user?.roles?.includes('admin') || user?.role === 'admin' || user?.role === 'super_admin';
  const userRoles = user?.roles || [user?.role];

  const [message, setMessage] = useState('');
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState([]);
  const [fetching, setFetching] = useState(true);

  const fetchReports = async () => {
    try {
      const res = await api.get('/reports');
      setReports(res.data);
    } catch (err) {
      console.error('Fetch reports error:', err);
    } finally {
      setFetching(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.put(`/reports/${id}/status`, { status });
      fetchReports();
      Swal.fire({ icon: 'success', title: 'อัปเดตสถานะสำเร็จ', showConfirmButton: false, timer: 1500 });
    } catch (err) {
      console.error('Update status error:', err);
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' });
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() && !image) {
      Swal.fire({ icon: 'warning', text: 'กรุณากรอกข้อความหรือแนบรูปภาพ' });
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      if (message) formData.append('message', message);
      if (image) formData.append('image', image);

      await api.post('/reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Swal.fire({ icon: 'success', title: 'ส่งรายงานสำเร็จ', showConfirmButton: false, timer: 1500 });
      setMessage('');
      setImage(null);
      fetchReports();
    } catch (err) {
      console.error('Submit report error:', err);
      const errMsg = err.response?.data?.error || err.message || 'ไม่สามารถส่งรายงานได้';
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: errMsg });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': 
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-xl shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="text-xs font-bold">รอดำเนินการ</span>
          </div>
        );
      case 'reviewed': 
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 text-sky-600 border border-sky-200 rounded-xl shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            <span className="text-xs font-bold">รับเรื่องแล้ว</span>
          </div>
        );
      case 'resolved': 
        return (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-xl shadow-sm">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            <span className="text-xs font-bold">แก้ไขแล้ว</span>
          </div>
        );
      default: 
        return <span className="px-3 py-1.5 text-xs font-bold bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB] rounded-xl shadow-sm">{status}</span>;
    }
  };

  return (
    <div className="flex h-screen bg-[#F9FAFB] text-[#1F2937] font-sans overflow-hidden selection:bg-[#A3E635] selection:text-[#1F2937]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="report" />

      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-[#E5E7EB] flex-shrink-0 z-10">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden w-11 h-11 flex items-center justify-center rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] text-[#1F2937] hover:bg-[#F3F4F6] transition-colors active:scale-95">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-black text-[#1F2937] tracking-tight">แจ้งปัญหาการใช้งาน</h1>
                <p className="text-sm font-medium text-[#9CA3AF] hidden sm:block">พบปัญหาหรือมีข้อเสนอแนะ แจ้งเราได้เลย</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ManualHelpButton onClick={() => setShowManualModal(true)} />
              <button onClick={() => navigate(-1)} className="px-5 py-2.5 text-sm font-bold text-[#4B5563] bg-white border-2 border-[#E5E7EB] rounded-2xl hover:bg-[#F9FAFB] transition-all active:scale-95 shadow-sm">
                ย้อนกลับ
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6 lg:space-y-8">
            
            {/* New Report Form */}
            <div className="bg-white rounded-3xl shadow-sm border border-[#E5E7EB] overflow-hidden" data-aos="fade-up">
              <div className="bg-[#1F2937] px-6 py-5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#374151] flex items-center justify-center shadow-inner">
                  <svg className="w-5 h-5 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 className="text-lg font-black text-white">ฟอร์มแจ้งปัญหา / เสนอแนะ</h2>
              </div>
              
              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
                <div>
                  <label className="block text-sm font-bold text-[#1F2937] mb-2">รายละเอียดปัญหา <span className="text-red-500">*</span></label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="อธิบายปัญหาที่พบ หรือข้อเสนอแนะอย่างละเอียด..."
                    className="w-full rounded-2xl border border-[#E5E7EB] px-5 py-4 focus:outline-none focus:ring-2 focus:ring-[#A3E635]/50 focus:border-[#A3E635] bg-[#F9FAFB] hover:bg-white transition-all text-sm font-medium min-h-[140px] shadow-sm resize-y"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-[#1F2937] mb-2">แนบรูปภาพ (ถ้ามี)</label>
                  <div className="relative group">
                    <div className="flex items-center justify-center w-full h-32 px-4 transition-all bg-[#F9FAFB] border-2 border-[#E5E7EB] border-dashed rounded-2xl group-hover:bg-white group-hover:border-[#1F2937]/30">
                      <div className="flex flex-col items-center space-y-2 text-center">
                        <svg className="w-8 h-8 text-[#9CA3AF] group-hover:text-[#1F2937] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-sm font-bold text-[#4B5563]">คลิกหรือลากไฟล์มาวางที่นี่</span>
                        <span className="text-xs font-medium text-[#9CA3AF]">รองรับ PNG, JPG, GIF</span>
                      </div>
                      <input 
                        type="file" 
                        accept="image/*"
                        onChange={e => setImage(e.target.files[0])}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                    </div>
                  </div>
                  {image && (
                    <div className="flex items-center gap-3 mt-4 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl">
                      <div className="w-10 h-10 rounded-lg bg-white border border-[#E5E7EB] overflow-hidden flex items-center justify-center shrink-0">
                        <img src={URL.createObjectURL(image)} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-[#1F2937] truncate">{image.name}</p>
                        <p className="text-xs font-medium text-[#A3E635]">แนบไฟล์แล้ว</p>
                      </div>
                      <button type="button" onClick={() => setImage(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(163,230,53,0.3)] active:scale-[0.98] ${loading ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-[#A3E635] text-[#1F2937] hover:bg-[#84CC16]'}`}
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-[#1F2937]/50" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                      กำลังส่งข้อมูล...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      ส่งรายงานแจ้งปัญหา
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Past Reports List */}
            <div className="bg-white rounded-3xl shadow-sm border border-[#E5E7EB] p-6 sm:p-8" data-aos="fade-up" data-aos-delay="100">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-black text-[#1F2937]">ประวัติการแจ้งปัญหา</h2>
                <div className="px-3 py-1 bg-[#F9FAFB] rounded-full text-xs font-bold text-[#4B5563] border border-[#E5E7EB]">
                  ทั้งหมด {reports.length} รายการ
                </div>
              </div>

              {fetching ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <svg className="animate-spin h-8 w-8 text-[#A3E635]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span className="text-sm font-bold text-[#9CA3AF]">กำลังโหลดประวัติ...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12 bg-[#F9FAFB] border-2 border-dashed border-[#E5E7EB] rounded-2xl">
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-[#E5E7EB]">
                    <svg className="w-8 h-8 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                  </div>
                  <p className="text-[#4B5563] font-bold">ยังไม่มีประวัติการแจ้งปัญหา</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {reports.map(report => (
                    <div key={report.id} className="p-5 sm:p-6 rounded-2xl border border-[#E5E7EB] bg-white hover:shadow-md hover:border-[#A3E635]/50 transition-all group flex flex-col">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          {isAdmin && (
                            <div className="mb-2 flex items-center gap-2">
                              <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg border border-slate-200">
                                ผู้แจ้ง: {report.reporter_name || 'ไม่ทราบชื่อ'} {report.team_name ? `(${report.team_name})` : ''}
                              </span>
                            </div>
                          )}
                          <p className="text-sm font-bold text-[#1F2937] whitespace-pre-wrap leading-relaxed">{report.message || <span className="text-slate-400 italic">ไม่มีข้อความ</span>}</p>
                        </div>
                        <div className="shrink-0 flex flex-col items-end gap-2">
                          {getStatusBadge(report.status)}
                          {isAdmin && report.status !== 'resolved' && (
                            <div className="flex items-center gap-1.5 mt-2">
                              {report.status === 'pending' && (
                                <button onClick={() => handleStatusChange(report.id, 'reviewed')} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg text-xs font-bold transition-colors">
                                  รับเรื่อง
                                </button>
                              )}
                              <button onClick={() => handleStatusChange(report.id, 'resolved')} className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded-lg text-xs font-bold transition-colors">
                                แก้ไขเสร็จสิ้น
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {report.image_url && (
                        <div className="mb-4">
                          <a href={`/uploads/issues/${report.image_url}`} target="_blank" rel="noopener noreferrer" className="inline-block relative rounded-xl overflow-hidden border border-[#E5E7EB] shadow-sm group-hover:ring-2 ring-[#A3E635]/50 transition-all">
                            <img src={`/uploads/issues/${report.image_url}`} alt="issue" className="h-32 w-auto object-cover" />
                            <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                              <svg className="w-6 h-6 text-white opacity-0 hover:opacity-100 drop-shadow-md transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                            </div>
                          </a>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2 pt-4 border-t border-[#F3F4F6]">
                        <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="text-xs font-bold text-[#9CA3AF]">
                          {new Date(report.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })} น.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>

      <ManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        userRoles={userRoles}
        pageName="report"
      />
    </div>
  );
}
