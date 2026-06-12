import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import AOS from 'aos';

export default function ReportPage() {
  const { user } = useAuth();
  const isAdmin = user && (user.roles?.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(user.role));
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image: null
  });
  
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [viewerPhoto, setViewerPhoto] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    AOS.refresh();
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/report');
      setReports(res.data);
    } catch (err) {
      console.error('Failed to fetch reports', err);
      showNotification('ไม่สามารถดึงข้อมูลการแจ้งปัญหาได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        showNotification('ขนาดไฟล์เกิน 10MB', 'error');
        return;
      }
      setFormData({ ...formData, image: file });
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.description) {
      showNotification('กรุณากรอกหัวข้อและรายละเอียด', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const submitData = new FormData();
      submitData.append('title', formData.title);
      submitData.append('description', formData.description);
      if (formData.image) {
        submitData.append('image', formData.image);
      }

      await axios.post('/report', submitData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showNotification('ส่งแจ้งปัญหาเรียบร้อยแล้ว');
      setFormData({ title: '', description: '', image: null });
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchReports();
    } catch (err) {
      console.error(err);
      showNotification('เกิดข้อผิดพลาดในการส่งแจ้งปัญหา', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await axios.put(`/report/${id}/status`, { status: newStatus });
      fetchReports();
      showNotification('อัปเดตสถานะเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      showNotification('ไม่สามารถอัปเดตสถานะได้', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?')) return;
    try {
      await axios.delete(`/report/${id}`);
      fetchReports();
      showNotification('ลบข้อมูลเรียบร้อยแล้ว');
    } catch (err) {
      console.error(err);
      showNotification('ไม่สามารถลบข้อมูลได้', 'error');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'resolved':
        return <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-200">✅ แก้ไขเสร็จสิ้น</span>;
      case 'in_progress':
        return <span className="px-2 py-1 bg-[#B5D4F4] text-[#185FA5] rounded-lg text-xs font-bold border border-[#185FA5]/20">⏳ กำลังแก้ไข</span>;
      case 'pending':
      default:
        return <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">⚠️ รอดำเนินการ</span>;
    }
  };

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-slate-50">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeKey="report" 
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="flex items-center justify-between p-4 glass border-b border-white/50 shrink-0 z-10 sticky top-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-[#185FA5] border border-white/50 hover:glass transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-bold text-[#042C53] text-xl tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              ระบบแจ้งปัญหา
            </h1>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Form Section */}
            {!isAdmin && (
              <div className="glass p-6 rounded-3xl border border-white/50 shadow-sm animate-fade-in-up">
                <h2 className="text-lg font-bold text-[#042C53] mb-4 flex items-center gap-2">
                  ✍️ เขียนแจ้งปัญหาใหม่
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#185FA5] mb-1">หัวข้อปัญหา <span className="text-red-500">*</span></label>
                    <input 
                      type="text" 
                      required
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      placeholder="เช่น แอพค้าง, อุปกรณ์หน้างานชำรุด..."
                      className="w-full rounded-xl border-slate-200 focus:border-brand-500 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#185FA5] mb-1">รายละเอียด <span className="text-red-500">*</span></label>
                    <textarea 
                      required
                      rows="3"
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="อธิบายปัญหาที่พบ เพื่อให้แอดมินเข้าใจและช่วยเหลือได้ตรงจุด"
                      className="w-full rounded-xl border-slate-200 focus:border-brand-500 focus:ring-brand-500"
                    ></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#185FA5] mb-1">รูปภาพประกอบ (ถ้ามี)</label>
                    <input 
                      type="file" 
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
                    />
                    {previewUrl && (
                      <div className="mt-3 relative inline-block">
                        <img src={previewUrl} alt="Preview" className="h-32 object-contain rounded-lg border border-slate-200" />
                        <button 
                          type="button" 
                          onClick={() => { setFormData({ ...formData, image: null }); setPreviewUrl(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold hover:bg-red-600 shadow-md"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="pt-2">
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-brand-500 to-brand-600 text-white font-bold rounded-xl shadow-md shadow-brand-500/20 hover:shadow-lg active:scale-95 transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span> กำลังส่ง...</>
                      ) : (
                        <>📤 ส่งแจ้งปัญหา</>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* History Section */}
            <div className="glass p-6 rounded-3xl border border-white/50 shadow-sm animate-fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold text-[#042C53] flex items-center gap-2">
                  📋 {isAdmin ? 'รายการแจ้งปัญหาทั้งหมด' : 'ประวัติการแจ้งปัญหาของคุณ'}
                </h2>
                <div className="text-xs font-semibold text-slate-500 bg-white/60 px-3 py-1.5 rounded-lg border border-slate-200">
                  รวม {reports.length} รายการ
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                </div>
              ) : reports.length === 0 ? (
                <div className="text-center py-12 bg-white/40 rounded-2xl border border-white/60 border-dashed">
                  <div className="w-16 h-16 bg-[#E6F1FB] text-[#378ADD] rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-lg font-bold text-[#042C53] mb-1">ยังไม่มีรายการแจ้งปัญหา</h3>
                  <p className="text-[#378ADD] text-sm font-medium">ปัญหาทั้งหมดถูกแก้ไขเรียบร้อยแล้ว หรือยังไม่มีการแจ้งเข้ามา</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {reports.map((report) => (
                    <div key={report.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Image Thumbnail */}
                        {report.image_path && (
                          <div className="shrink-0 w-full sm:w-32 h-32 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 relative group cursor-pointer" onClick={() => setViewerPhoto(`/uploads/${report.image_path}`)}>
                            <img src={`/uploads/${report.image_path}`} alt="Report" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                              <svg className="w-6 h-6 text-white opacity-0 group-hover:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                            </div>
                          </div>
                        )}
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0 flex flex-col">
                          <div className="flex justify-between items-start gap-4 mb-2">
                            <div>
                              <h3 className="font-bold text-[#042C53] text-base leading-tight break-words">{report.title}</h3>
                              {isAdmin && report.full_name && (
                                <p className="text-xs font-semibold text-[#378ADD] mt-1">ผู้แจ้ง: {report.full_name} {report.team_name && `(${report.team_name})`}</p>
                              )}
                            </div>
                            <div className="shrink-0">
                              {getStatusBadge(report.status)}
                            </div>
                          </div>
                          
                          <p className="text-sm text-slate-600 whitespace-pre-line bg-slate-50 p-3 rounded-xl border border-slate-100 mb-3 flex-1 break-words">
                            {report.description}
                          </p>
                          
                          <div className="flex flex-wrap items-center justify-between gap-3 mt-auto pt-2 border-t border-slate-100">
                            <span className="text-[11px] font-medium text-slate-400">
                              📅 {new Date(report.created_at).toLocaleString('th-TH')}
                            </span>
                            
                            {/* Admin Controls */}
                            {isAdmin && (
                              <div className="flex items-center gap-2">
                                <select
                                  value={report.status}
                                  onChange={(e) => handleStatusChange(report.id, e.target.value)}
                                  className="text-xs font-bold rounded-lg border-slate-200 text-slate-600 focus:border-brand-500 focus:ring-brand-500 py-1.5"
                                >
                                  <option value="pending">รอดำเนินการ</option>
                                  <option value="in_progress">กำลังแก้ไข</option>
                                  <option value="resolved">แก้ไขเสร็จสิ้น</option>
                                </select>
                                <button
                                  onClick={() => handleDelete(report.id)}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                  title="ลบรายการ"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {notification.show && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-fade-in-down border ${notification.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white backdrop-blur-md' : 'bg-red-500/90 border-red-400 text-white backdrop-blur-md'}`}>
          {notification.type === 'success' ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          )}
          <span className="font-bold tracking-wide">{notification.message}</span>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewerPhoto && (
        <div className="fixed inset-0 z-[150] flex flex-col bg-black/95 backdrop-blur-md animate-fade-in">
          <div className="p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent absolute top-0 w-full z-10">
            <span className="text-white/80 font-bold text-sm">ดูรูปภาพประกอบปัญหา</span>
            <button 
              onClick={() => setViewerPhoto(null)} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={viewerPhoto} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
