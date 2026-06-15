import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function ReportIssuePage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

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

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim() && !image) {
      alert('กรุณากรอกข้อความหรือแนบรูปภาพ');
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
      alert('ส่งรายงานแจ้งปัญหาสำเร็จ');
      setMessage('');
      setImage(null);
      fetchReports();
    } catch (err) {
      console.error('Submit report error:', err);
      alert('เกิดข้อผิดพลาดในการส่งรายงาน');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return <span className="px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-700 rounded">รอดำเนินการ</span>;
      case 'reviewed': return <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-700 rounded">รับเรื่องแล้ว</span>;
      case 'resolved': return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-700 rounded">แก้ไขแล้ว</span>;
      default: return <span className="px-2 py-1 text-xs font-semibold bg-slate-100 text-slate-700 rounded">{status}</span>;
    }
  };

  return (
    <div className="flex h-screen bg-[#F0F4F8] text-[#042C53] font-sans overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="report" />

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="glass shadow-sm border-b border-white/40 flex-shrink-0 z-10">
          <div className="max-w-6xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => setSidebarOpen(true)} className="md:hidden w-10 h-10 flex items-center justify-center rounded-xl glass text-[#378ADD] hover:bg-[#E6F1FB] transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h1 className="text-xl md:text-2xl font-black bg-gradient-to-r from-[#042C53] to-[#185FA5] bg-clip-text text-transparent">แจ้งปัญหาการใช้งาน</h1>
            </div>
            <button onClick={() => navigate(-1)} className="px-4 py-2 text-sm font-semibold text-[#185FA5] bg-[#E6F1FB] rounded-full hover:bg-[#D0E3F5] transition-colors">ย้อนกลับ</button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-3xl mx-auto space-y-6">
            
            {/* New Report Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6" data-aos="fade-up">
              <h2 className="text-lg font-bold text-[#042C53] mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                ฟอร์มแจ้งปัญหา / เสนอแนะ
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#185FA5] mb-1">รายละเอียดปัญหา</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder="อธิบายปัญหาที่พบ หรือข้อเสนอแนะ..."
                    className="w-full rounded-xl border border-slate-300 px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/50 bg-slate-50 transition-all text-sm min-h-[120px]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#185FA5] mb-1">แนบรูปภาพ (ถ้ามี)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => setImage(e.target.files[0])}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#E6F1FB] file:text-[#185FA5] hover:file:bg-[#D0E3F5] transition-all cursor-pointer"
                  />
                  {image && <p className="text-xs text-green-600 mt-2 font-medium">แนบไฟล์: {image.name}</p>}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3 rounded-xl font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 ${loading ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-brand-500 to-brand-600 hover:shadow-lg hover:-translate-y-0.5'}`}
                >
                  {loading ? 'กำลังส่งข้อมูล...' : 'ส่งรายงานแจ้งปัญหา'}
                </button>
              </form>
            </div>

            {/* Past Reports List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6" data-aos="fade-up" data-aos-delay="100">
              <h2 className="text-lg font-bold text-[#042C53] mb-4">ประวัติการแจ้งปัญหาของคุณ</h2>
              {fetching ? (
                <div className="text-center py-6 text-slate-500 text-sm">กำลังโหลด...</div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-sm bg-slate-50 rounded-xl">ยังไม่มีประวัติการแจ้งปัญหา</div>
              ) : (
                <div className="space-y-4">
                  {reports.map(report => (
                    <div key={report.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start gap-4 mb-2">
                        <p className="text-sm text-[#042C53] whitespace-pre-wrap flex-1">{report.message}</p>
                        <div className="shrink-0">{getStatusBadge(report.status)}</div>
                      </div>
                      {report.image_url && (
                        <div className="mb-3">
                          <img src={`/uploads/issues/${report.image_url}`} alt="issue" className="max-h-32 rounded-lg border border-slate-200 shadow-sm" />
                        </div>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        {new Date(report.created_at).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
