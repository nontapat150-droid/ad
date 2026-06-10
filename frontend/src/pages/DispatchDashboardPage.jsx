import { useState, useEffect } from 'react';
import AOS from 'aos';
import Sidebar from '../components/Sidebar';
import JobDispatchModal from '../components/JobDispatchModal';
import AutoDispatchModal from '../components/AutoDispatchModal';
import EditJobModal from '../components/EditJobModal';
import ImportExcelModal from '../components/ImportExcelModal';
import axios from '../api/axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Fix leaflet marker icon issue in Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function DispatchDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user && (user.roles?.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(user.role));
  const isMATech = user?.role === 'ma_technician' || user?.roles?.includes('ma_technician');
  const isOfficeTech = user?.role === 'technician' || user?.roles?.includes('technician') || user?.role === 'office_technician';

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  let initialTab = searchParams.get('tab') || 'office';
  if (isMATech && initialTab === 'office') initialTab = 'ma';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab); // 'office' | 'ma' | 'map' | 'postponed'
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    isDanger: true,
  });
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    AOS.refresh();
    fetchJobs();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['office', 'ma', 'map', 'postponed'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    fetchJobs();
  }, [activeTab]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/dispatch/jobs?type=${activeTab === 'map' ? 'office' : activeTab}`);
      setJobs(res.data);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActionComplete = () => {
    fetchJobs();
    setSelectedJobIds([]);
  };

  const handleToggleSelect = (jobId) => {
    setSelectedJobIds(prev => 
      prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]
    );
  };

  const requestConfirm = (title, message, onConfirm, isDanger = true) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, isDanger });
  };

  const handleDelete = (jobId) => {
    requestConfirm('ยืนยันการลบงาน', 'คุณแน่ใจหรือไม่ว่าต้องการลบงานนี้? การกระทำนี้ไม่สามารถย้อนกลับได้', async () => {
      try {
        await axios.delete(`/dispatch/jobs/${jobId}`);
        handleActionComplete();
        showNotification('ลบข้อมูลสำเร็จ', 'success');
      } catch (err) {
        showNotification('ไม่สามารถลบงานได้', 'error');
      }
    });
  };

  const handleDeleteBulk = () => {
    requestConfirm('ยืนยันลบหลายรายการ', `คุณแน่ใจหรือไม่ว่าต้องการลบงานที่เลือกจำนวน ${selectedJobIds.length} รายการ?`, async () => {
      try {
        await axios.delete('/dispatch/jobs/bulk', { data: { ids: selectedJobIds } });
        handleActionComplete();
        showNotification('ลบข้อมูลที่เลือกสำเร็จ', 'success');
      } catch (err) {
        showNotification('ไม่สามารถลบข้อมูลหลายรายการได้', 'error');
      }
    });
  };

  const handleDeleteAll = () => {
    requestConfirm('ยืนยันลบงานทั้งหมด', 'คุณแน่ใจหรือไม่ว่าต้องการลบงานที่ยังรอดำเนินการ (Pending) ทั้งหมดในระบบ?', async () => {
      try {
        await axios.delete('/dispatch/jobs/all');
        handleActionComplete();
        showNotification('ลบข้อมูลที่รอดำเนินการทั้งหมดสำเร็จ', 'success');
      } catch (err) {
        showNotification('ไม่สามารถลบข้อมูลทั้งหมดได้', 'error');
      }
    });
  };

  const handleClearDispatch = () => {
    requestConfirm('ยืนยันล้างการจ่ายงาน', 'ยืนยันล้างการจ่ายงานที่ยังรอดำเนินการทั้งหมด?', async () => {
      try {
        await axios.put('/dispatch/jobs/clear-dispatch', {});
        fetchJobs();
        showNotification('ล้างการจ่ายงานสำเร็จ', 'success');
      } catch (err) {
        showNotification('เกิดข้อผิดพลาดในการล้างการจ่ายงาน', 'error');
      }
    }, false);
  };

  const handleClearQueue = () => {
    requestConfirm('ยืนยันล้างคิวงาน', 'ยืนยันล้างคิวงานที่รอดำเนินการทั้งหมด?', async () => {
      try {
        await axios.put('/dispatch/jobs/clear-queue', {});
        fetchJobs();
        showNotification('ล้างคิวงานสำเร็จ', 'success');
      } catch (err) {
        showNotification('เกิดข้อผิดพลาดในการล้างคิวงาน', 'error');
      }
    }, false);
  };

  // Center map based on first valid job location, or default to Thailand
  const mapCenter = jobs.find(j => j.lat && j.lng) 
    ? [parseFloat(jobs.find(j => j.lat && j.lng).lat), parseFloat(jobs.find(j => j.lat && j.lng).lng)] 
    : [13.7563, 100.5018]; // Default Bangkok

  // Group jobs by team to draw polylines
  const teamsWithJobs = {};
  const teamColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  
  jobs.forEach(job => {
    if (job.team_id && job.lat && job.lng) {
      if (!teamsWithJobs[job.team_id]) {
        teamsWithJobs[job.team_id] = [];
      }
      teamsWithJobs[job.team_id].push(job);
    }
  });

  const createNumberedIcon = (number, color = '#185FA5') => {
    return L.divIcon({
      className: 'custom-div-icon',
      html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${number}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    });
  };

  // Create polylines
  const polylines = Object.keys(teamsWithJobs).map((teamId, index) => {
    // Sort jobs by seq to draw path correctly
    const teamJobs = teamsWithJobs[teamId].sort((a, b) => parseInt(a.seq || 0) - parseInt(b.seq || 0));
    const positions = teamJobs.map(job => [parseFloat(job.lat), parseFloat(job.lng)]);
    const color = teamColors[index % teamColors.length];
    
    return (
      <Polyline key={`team-path-${teamId}`} positions={positions} pathOptions={{ color, weight: 3, opacity: 0.7, dashArray: '5, 10' }} />
    );
  });

  // Calculate stats
  const stats = {
    total: jobs.length,
    hasLocation: jobs.filter(j => j.lat && j.lng).length,
    assigned: jobs.filter(j => j.team_id).length,
    unassigned: jobs.filter(j => !j.team_id).length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
  };

  return (
    <div className="flex h-dvh font-sans overflow-hidden">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeKey="jobs" 
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 glass border-b border-white/50 shrink-0 gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-[#185FA5] border border-white/50 hover:glass transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-bold text-[#042C53] text-lg md:text-xl tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              หน้าแจกจ่ายงาน
            </h1>
          </div>
          
          {isAdmin && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="bg-[#E6F1FB] hover:bg-[#B5D4F4] text-[#0C447C] border border-[#185FA5]/20 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              นำเข้า Excel
            </button>
            <button 
              onClick={() => setIsAutoModalOpen(true)}
              className="bg-[#E6F1FB] hover:bg-[#B5D4F4] text-[#0C447C] border border-[#185FA5]/20 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              แจกจ่ายอัตโนมัติ
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">เพิ่มข้อมูลด้วยตัวเอง</span>
              <span className="sm:hidden">เพิ่ม</span>
            </button>
          </div>
          )}
        </header>

        {/* View Toggle / Tabs */}
        <div className="glass border-b border-white/50 flex shrink-0 overflow-x-auto custom-scrollbar w-full">
          {['office', 'ma', 'map', 'postponed']
            .filter(tab => {
              if (isAdmin) return true;
              if (isMATech) return tab === 'ma' || tab === 'map';
              if (isOfficeTech) return tab === 'office' || tab === 'map';
              return false;
            })
            .map(tab => {
            const labels = { office: 'งาน Office', ma: 'งาน MA', map: 'แผนที่', postponed: 'ประวัติเลื่อนนัด' };
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm md:text-base font-semibold border-b-2 transition-colors whitespace-nowrap text-center ${activeTab === tab ? 'border-brand-500 text-[#185FA5] bg-white/40' : 'border-transparent text-[#378ADD] hover:text-[#042C53] hover:bg-white/20'}`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        {/* Action Controls Toolbar */}
        {isAdmin && activeTab !== 'map' && activeTab !== 'postponed' && (
          <div className="bg-white/30 border-b border-white/50 px-4 py-4 flex flex-wrap gap-3 overflow-x-auto custom-scrollbar">
             <button onClick={handleClearDispatch} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-100 text-orange-700 text-sm font-bold hover:bg-orange-200 transition shadow-sm border border-orange-300">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               ล้างการจ่ายงาน
             </button>
             <button onClick={handleClearQueue} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-100 text-amber-700 text-sm font-bold hover:bg-amber-200 transition shadow-sm border border-amber-300">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
               ล้างคิว
             </button>
             {/* Note: Sort queue logic would likely need a backend endpoint or frontend drag-and-drop. For now, it's just a button */}
             <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-100 text-emerald-700 text-sm font-bold hover:bg-emerald-200 transition shadow-sm border border-emerald-300">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
               เรียงคิว
             </button>
             <button onClick={handleDeleteAll} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-100 text-red-700 text-sm font-bold hover:bg-red-200 transition shadow-sm border border-red-300 ml-auto">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
               ลบข้อมูลทั้งหมด
             </button>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col  relative">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
            </div>
          ) : activeTab === 'map' ? (
            // MAP VIEW
            <div className="flex-1 flex flex-col md:flex-row w-full relative z-0 overflow-hidden">
              <div className="h-[50vh] md:h-full md:flex-1 relative z-0 shrink-0 md:shrink">
                <MapContainer center={mapCenter} zoom={11} className="w-full h-full">
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* Render Routes */}
                  {polylines}

                  {/* Render Job Markers */}
                  {jobs.map(job => {
                    if (!job.lat || !job.lng) return null;
                    
                    return (
                      <Marker 
                        key={job.id} 
                        position={[parseFloat(job.lat), parseFloat(job.lng)]}
                        icon={createNumberedIcon(job.seq || '?', job.status === 'completed' ? '#10b981' : job.status === 'failed' ? '#ef4444' : '#185FA5')}
                      >
                        <Popup>
                          <div className="font-sans min-w-[200px]">
                            <div className="flex justify-between items-start mb-2 border-b pb-2">
                              <strong className="block text-[#185FA5] text-sm">{job.access_no}</strong>
                              {job.seq && (
                                <span className="bg-[#B5D4F4] text-[#0C447C] text-xs font-bold px-2 py-1 rounded-md">
                                  ลำดับ: {job.seq}
                                </span>
                              )}
                            </div>
                            <span className="block text-xs text-[#185FA5] mb-1"><span className="font-semibold">ลูกค้า:</span> {job.customer || '-'}</span>
                            <span className="block text-xs text-[#185FA5] mb-1"><span className="font-semibold">สถานะ:</span> {job.status}</span>
                            <span className="block text-xs text-[#185FA5]"><span className="font-semibold">ทีม:</span> {job.team_name || 'ยังไม่ระบุ'}</span>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              {/* Right Sidebar for Assigned Jobs */}
              <div className="w-full md:w-80 lg:w-96 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col h-[50vh] md:h-full z-10 shrink-0 shadow-[-4px_0_15px_rgba(0,0,0,0.05)] overflow-hidden">
                 <div className="p-4 border-b border-slate-200 bg-white shrink-0">
                   <h3 className="font-bold text-[#042C53] flex items-center gap-2">
                     <svg className="w-5 h-5 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                     งานที่ได้รับมอบหมาย ({jobs.filter(j => j.lat && j.lng).length})
                   </h3>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                   {jobs.filter(j => j.lat && j.lng)
                     .sort((a,b) => parseInt(a.seq || 999) - parseInt(b.seq || 999))
                     .map(job => (
                     <div key={job.id} className={`p-4 border rounded-xl transition-all shadow-sm bg-white ${job.status === 'completed' ? 'border-emerald-200 hover:border-emerald-400' : job.status === 'failed' ? 'border-red-200 hover:border-red-400' : 'border-slate-200 hover:border-[#378ADD] hover:shadow-md'}`}>
                        <div className="flex justify-between items-start mb-3">
                           <div className="flex items-center gap-2">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white shadow-sm ${job.status === 'completed' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-[#185FA5]'}`}>
                                {job.seq || '?'}
                              </span>
                              <div>
                                <strong className="block text-sm text-[#042C53] leading-tight">{job.access_no}</strong>
                                {isAdmin && job.team_name && <span className="text-[10px] text-slate-500">{job.team_name}</span>}
                              </div>
                           </div>
                           <span className={`text-[10px] px-2 py-1 rounded-md font-bold whitespace-nowrap ${job.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : job.status === 'failed' ? 'bg-red-100 text-red-700' : job.status === 'postponed' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                             {job.status === 'completed' ? 'เสร็จสิ้น' : job.status === 'failed' ? 'ล้มเหลว' : job.status === 'postponed' ? 'เลื่อนนัด' : 'รอดำเนินการ'}
                           </span>
                        </div>
                        <p className="text-xs text-slate-600 mb-1 line-clamp-1"><span className="font-semibold text-slate-800">ลูกค้า:</span> {job.customer || '-'}</p>
                        <p className="text-xs text-slate-600 mb-4 line-clamp-2" title={job.address}><span className="font-semibold text-slate-800">พิกัด:</span> {job.address || '-'}</p>
                        <div className="flex gap-2">
                           <button onClick={() => setSelectedJob(job)} className="flex-1 py-2 bg-[#E6F1FB] text-[#185FA5] hover:bg-[#185FA5] hover:text-white rounded-lg text-xs font-bold transition-colors">
                             รายละเอียด / อัปเดต
                           </button>
                           <a href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center w-9 h-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors shadow-sm border border-emerald-100" title="นำทางด้วย Google Maps">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                           </a>
                        </div>
                     </div>
                   ))}
                   {jobs.filter(j => j.lat && j.lng).length === 0 && (
                     <div className="text-center p-6 text-slate-400 text-sm font-semibold">
                       ไม่พบงานที่มีพิกัดบนแผนที่
                     </div>
                   )}
                 </div>
              </div>
            </div>
          ) : (
            // LIST VIEW
            <div className="flex-1 overflow-y-auto p-4 md:p-6 reveal animate-fade-in">
              <div className="w-full flex flex-col gap-6">
                
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                  <div className="glass rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-3xl font-black text-[#185FA5]">{stats.total}</p>
                    <p className="text-xs font-semibold text-[#378ADD] mt-1">งานทั้งหมด</p>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-3xl font-black text-purple-500">{stats.hasLocation}</p>
                    <p className="text-xs font-semibold text-purple-400 mt-1">มีพิกัด</p>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col items-center justify-center">
                    <p className="text-3xl font-black text-emerald-500">{stats.assigned}</p>
                    <p className="text-xs font-semibold text-emerald-600 mt-1">จ่ายแล้ว</p>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col items-center justify-center bg-amber-50/50">
                    <p className="text-3xl font-black text-amber-500">{stats.unassigned}</p>
                    <p className="text-xs font-semibold text-amber-600 mt-1">รอจ่าย</p>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col items-center justify-center bg-emerald-50/50">
                    <p className="text-3xl font-black text-emerald-600">{stats.completed}</p>
                    <p className="text-xs font-semibold text-emerald-700 mt-1">จบงานแล้ว</p>
                  </div>
                  <div className="glass rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col items-center justify-center bg-red-50/50">
                    <p className="text-3xl font-black text-red-500">{stats.failed}</p>
                    <p className="text-xs font-semibold text-red-600 mt-1">ไม่จบงาน</p>
                  </div>
                </div>

                {jobs.length === 0 ? (
                  <div className="glass rounded-2xl p-12 text-center border border-white/50 mt-4">
                    <div className="w-20 h-20 bg-[#E6F1FB] text-[#378ADD] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#042C53] mb-1">ยังไม่มีงานในระบบ</h3>
                    <p className="text-[#378ADD] text-sm">คลิก "เพิ่มข้อมูลด้วยตัวเอง" เพื่อสร้างงานใหม่</p>
                  </div>
                ) : (
                  <div className="glass rounded-2xl shadow-sm border border-white/50 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className=" border-b border-white/50 text-[#185FA5] text-xs uppercase tracking-wider bg-white/40">
                            {isAdmin && <th className="p-4 font-bold whitespace-nowrap text-center">
                              <input 
                                type="checkbox" 
                                onChange={(e) => setSelectedJobIds(e.target.checked ? jobs.map(j => j.id) : [])}
                                checked={jobs.length > 0 && selectedJobIds.length === jobs.length}
                                className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                              />
                            </th>}
                            <th className="p-4 font-bold whitespace-nowrap">Access No.</th>
                            <th className="p-4 font-bold whitespace-nowrap">ลูกค้า</th>
                            <th className="p-4 font-bold whitespace-nowrap">เบอร์โทร</th>
                            <th className="p-4 font-bold w-1/3">พื้นที่</th>
                            <th className="p-4 font-bold whitespace-nowrap">ทีมช่าง</th>
                            <th className="p-4 font-bold whitespace-nowrap text-center">สถานะ</th>
                            <th className="p-4 font-bold whitespace-nowrap text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {jobs.map(job => (
                            <tr key={job.id} className={`transition-colors ${selectedJobIds.includes(job.id) ? 'bg-brand-50/50' : 'hover:bg-white/40'}`}>
                                {isAdmin && <td className="p-4 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedJobIds.includes(job.id)}
                                    onChange={() => handleToggleSelect(job.id)}
                                    className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                                  />
                                </td>}
                                <td className="p-4 text-sm font-semibold text-[#042C53]">{job.access_no}</td>
                                <td className="p-4 text-sm font-medium text-[#185FA5]">{job.customer || '-'}</td>
                                <td className="p-4 text-sm text-[#185FA5]">{job.phone || '-'}</td>
                                <td className="p-4 text-sm text-[#378ADD] leading-relaxed max-w-[300px] break-words">{job.address || '-'}</td>
                                <td className="p-4 text-sm text-[#185FA5]">
                                  {job.team_name ? (
                                    <span className="inline-flex items-center px-3 py-1 rounded-lg bg-[#E6F1FB] border border-[#185FA5]/10 text-[#0C447C] font-semibold text-xs whitespace-nowrap shadow-sm">
                                      {job.team_name}
                                    </span>
                                  ) : (
                                    <span className="text-red-400 font-medium text-xs bg-red-50 px-3 py-1 rounded-lg border border-red-100 whitespace-nowrap">ยังไม่ระบุ</span>
                                  )}
                                </td>
                                <td className="p-4 text-sm text-center">
                                  <span className={`inline-flex items-center justify-center min-w-[100px] px-3 py-1.5 rounded-lg text-xs font-bold border shadow-sm ${
                                    job.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                    job.status === 'in_progress' ? 'bg-[#B5D4F4] text-[#185FA5] border-[#185FA5]/20' :
                                    job.status === 'failed' ? 'bg-red-100 text-red-700 border-red-200' :
                                    job.status === 'postponed' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                    'bg-amber-100 text-amber-600 border-amber-200'
                                  }`}>
                                    {job.status === 'completed' ? 'เสร็จสิ้น' :
                                     job.status === 'in_progress' ? 'กำลังดำเนินการ' :
                                     job.status === 'failed' ? 'ล้มเหลว' : 
                                     job.status === 'postponed' ? 'เลื่อนนัด' : 'รอดำเนินการ'}
                                  </span>
                                </td>
                                <td className="p-4 text-center whitespace-nowrap">
                                  <div className="flex gap-2 justify-center">
                                    <button onClick={() => setSelectedJob(job)} className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="รายละเอียด/ระบุสถานะ">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                    </button>
                                    {isAdmin && <button onClick={() => handleDelete(job.id)} className="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors" title="ลบ">
                                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                    </button>}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedJobIds.length > 0 && activeTab !== 'map' && activeTab !== 'postponed' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#042C53]/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl flex justify-between items-center shadow-2xl animate-fade-in-up z-20 gap-6 border border-white/20">
              <span className="font-bold text-sm tracking-wide">เลือกแล้ว <span className="text-brand-300 text-lg">{selectedJobIds.length}</span> รายการ</span>
              <div className="flex gap-2">
                <button onClick={() => setSelectedJobIds([])} className="px-4 py-2 text-sm font-semibold hover:bg-white/10 rounded-xl transition-colors">ยกเลิก</button>
                <button onClick={handleDeleteBulk} className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-md shadow-red-500/20 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  ลบที่เลือก
                </button>
              </div>
            </div>
          )}
        </main>
      </div>

      <JobDispatchModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={handleActionComplete} 
      />

      <AutoDispatchModal 
        isOpen={isAutoModalOpen} 
        onClose={() => setIsAutoModalOpen(false)} 
        onSuccess={handleActionComplete} 
      />

      <ImportExcelModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleActionComplete}
      />

      {selectedJob && (
        <EditJobModal
          job={selectedJob}
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
          onSuccess={handleActionComplete}
        />
      )}

      {/* Confirmation Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}></div>
          <div className="bg-white/90 backdrop-blur-md rounded-3xl w-full max-w-sm p-6 relative z-10 shadow-2xl border border-white/50 animate-fade-in-up">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmDialog.isDanger ? 'bg-red-100 text-red-500' : 'bg-orange-100 text-orange-500'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#042C53] mb-2">{confirmDialog.title}</h3>
            <p className="text-[#185FA5] text-sm mb-6 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 rounded-xl font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                ยกเลิก
              </button>
              <button 
                onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-white shadow-md transition-colors ${confirmDialog.isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/30'}`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
