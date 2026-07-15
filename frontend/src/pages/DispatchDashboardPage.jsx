import { useState, useEffect } from 'react';
import AOS from 'aos';
import Sidebar from '../components/Sidebar';
import JobDispatchModal from '../components/JobDispatchModal';
import AutoDispatchModal from '../components/AutoDispatchModal';
import EditJobModal from '../components/EditJobModal';
import ImportExcelModal from '../components/ImportExcelModal';
import CustomImportExcelModal from '../components/CustomImportExcelModal';
import { CompleteJobModal, IncompleteJobModal, PostponeJobModal } from '../components/JobActionModals';
import axios from '../api/axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import ManualModal from '../components/ManualModal';

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
  const isMATech = user?.role === 'ma_technician' || user?.roles?.includes('ma_technician') || user?.role === 'contractor_ma' || user?.roles?.includes('contractor_ma');
  const isOfficeTech = user?.role === 'technician' || user?.roles?.includes('technician') || user?.role === 'office_technician' || user?.role === 'contractor_office' || user?.roles?.includes('contractor_office');

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  let initialTab = searchParams.get('tab') || 'office';
  if (!isAdmin && !isOfficeTech && isMATech && initialTab === 'office') {
    initialTab = 'ma';
  }

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCustomImportModalOpen, setIsCustomImportModalOpen] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  
  // States for technician action modals
  const [actionJob, setActionJob] = useState(null);
  const [actionType, setActionType] = useState(null);

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
  const [teams, setTeams] = useState([]);
  const [bulkAssignTeam, setBulkAssignTeam] = useState('');
  const [isReordering, setIsReordering] = useState(false);

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => {
    AOS.refresh();
    fetchJobs();
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      const res = await axios.get('/users/teams');
      setTeams(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch teams', err);
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['office', 'ma', 'map', 'postponed'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location.search]);

  useEffect(() => {
    fetchJobs();
    setSelectedJobIds([]); // Clear selection when tab changes
  }, [activeTab]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`/dispatch/jobs?type=${activeTab === 'map' ? 'office' : activeTab}`);
      setJobs(Array.isArray(res.data) ? res.data : []);
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


  const handleReorderByLocation = () => {
    if (!navigator.geolocation) {
      showNotification('เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง GPS', 'error');
      return;
    }
    setIsReordering(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const type = activeTab === 'map' ? 'office' : activeTab;
          const res = await axios.put('/dispatch/jobs/reorder-by-location', {
            lat: latitude,
            lng: longitude,
            type,
          });
          showNotification(`เรียงคิวสำเร็จ ${res.data.updated} งาน จากตำแหน่งปัจจุบัน`, 'success');
          fetchJobs();
        } catch (err) {
          showNotification('เกิดข้อผิดพลาดในการเรียงคิว', 'error');
        } finally {
          setIsReordering(false);
        }
      },
      (err) => {
        setIsReordering(false);
        if (err.code === 1) showNotification('กรุณาอนุญาตการเข้าถึงตำแหน่ง GPS', 'error');
        else showNotification('ไม่สามารถระบุตำแหน่งได้', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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
        const type = activeTab === 'map' || activeTab === 'postponed' ? 'office' : activeTab;
        await axios.delete(`/dispatch/jobs/${jobId}`, { params: { type } });
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
        const type = activeTab === 'map' || activeTab === 'postponed' ? 'office' : activeTab;
        await axios.delete('/dispatch/jobs/bulk', { data: { ids: selectedJobIds, type } });
        handleActionComplete();
        showNotification('ลบข้อมูลที่เลือกสำเร็จ', 'success');
      } catch (err) {
        showNotification('ไม่สามารถลบข้อมูลหลายรายการได้', 'error');
      }
    });
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignTeam) return showNotification('กรุณาเลือกทีมที่ต้องการมอบหมาย', 'error');
    requestConfirm('ยืนยันมอบหมายทีม', `คุณต้องการมอบหมาย ${selectedJobIds.length} งาน ให้กับทีมนี้ใช่หรือไม่?`, async () => {
      try {
        const type = activeTab === 'map' || activeTab === 'postponed' ? 'office' : activeTab;
        await axios.put('/dispatch/jobs/bulk-assign', { ids: selectedJobIds, team_id: bulkAssignTeam, type });
        showNotification('มอบหมายทีมสำเร็จ', 'success');
        setBulkAssignTeam('');
        handleActionComplete();
      } catch (err) {
        showNotification('เกิดข้อผิดพลาดในการมอบหมายทีม', 'error');
      }
    });
  };

  const handleDeleteAll = () => {
    requestConfirm('ยืนยันลบงานทั้งหมด', 'คุณแน่ใจหรือไม่ว่าต้องการลบงานที่ยังรอดำเนินการ (Pending) ทั้งหมดในระบบ?', async () => {
      try {
        const type = activeTab === 'map' || activeTab === 'postponed' ? 'office' : activeTab;
        await axios.delete('/dispatch/jobs/all', { params: { type } });
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
  const teamColors = ['#A3E635', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  
  jobs.forEach(job => {
    if (job.team_id && job.lat && job.lng) {
      if (!teamsWithJobs[job.team_id]) {
        teamsWithJobs[job.team_id] = [];
      }
      teamsWithJobs[job.team_id].push(job);
    }
  });

  const createNumberedIcon = (number, color = '#1F2937') => {
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

  // Tab icon map
  const tabIcons = {
    office: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    ma: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    map: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>,
    failed: <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
    postponed: <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  };

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6]">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeKey="jobs" 
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB] shrink-0 gap-3"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                <svg className="w-4 h-4 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <h1 className="font-bold text-[#1F2937] text-lg tracking-tight">หน้าแจกจ่ายงาน</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <>
                <button 
                  onClick={() => setIsImportModalOpen(true)}
                  className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border border-[#E5E7EB] px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <span className="hidden sm:inline">นำเข้า Excel</span>
                </button>
                <button 
                  onClick={() => setIsCustomImportModalOpen(true)}
                  className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border border-[#E5E7EB] px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">นำเข้า Custom</span>
                </button>
                <button 
                  onClick={() => setIsAutoModalOpen(true)}
                  className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border border-[#E5E7EB] px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">แจกจ่ายอัตโนมัติ</span>
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="text-[#1F2937] px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="hidden sm:inline">เพิ่มข้อมูลด้วยตัวเอง</span>
                  <span className="sm:hidden">เพิ่ม</span>
                </button>
              </>
            )}
            
            <button
              onClick={() => setShowManualModal(true)}
              className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-slate-800 font-semibold bg-brand-50 hover:bg-brand-100 px-3 py-2 rounded-xl border border-brand-200 transition-all ml-auto"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold">คู่มือ</span>
            </button>
          </div>
        </header>

        {/* ── Tab Navigation ──────────────────────────────── */}
        <div className="bg-white border-b border-[#E5E7EB] flex shrink-0 overflow-x-auto px-2 gap-1 py-1.5"
          style={{ scrollbarWidth: 'none' }}>
          {['office', 'ma', 'map', 'failed', 'postponed']
            .filter(tab => {
              if (isAdmin) return true;
              let allowed = ['map']; // everyone gets map? Actually map might only be needed. Let's build allowed tabs dynamically.
              if (isMATech) allowed.push('ma');
              if (isOfficeTech) allowed.push('office');
              allowed.push('failed');
              return allowed.includes(tab);
            })
            .map(tab => {
            const labels = { office: 'งานติดตั้ง', ma: 'งาน MA', map: 'แผนที่', failed: 'งานไม่จบ', postponed: 'ประวัติเลื่อนนัด' };
            const isActive = activeTab === tab;
            return (
              <button 
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? 'text-[#1F2937] shadow-sm'
                    : 'text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F9FAFB]'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, rgba(163,230,53,0.15), rgba(101,163,13,0.08))',
                  border: '1px solid rgba(163,230,53,0.35)',
                } : { border: '1px solid transparent' }}
              >
                <span className={isActive ? 'text-[#65a30d]' : ''}>{tabIcons[tab]}</span>
                {labels[tab]}
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635]" />}
              </button>
            )
          })}
        </div>

        {/* ── Action Controls Toolbar (Admin) ─────────────── */}
        {isAdmin && activeTab !== 'map' && activeTab !== 'postponed' && (
          <div className="bg-white border-b border-[#E5E7EB] px-4 py-3 flex flex-wrap gap-2 overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}>
             <button onClick={handleClearDispatch}
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-50 text-orange-700 text-sm font-bold hover:bg-orange-100 transition border border-orange-200">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
               ล้างการจ่ายงาน
             </button>
             <button onClick={handleClearQueue}
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 text-amber-700 text-sm font-bold hover:bg-amber-100 transition border border-amber-200">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
               ล้างคิว
             </button>
             <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition border border-emerald-200"
               onClick={handleReorderByLocation}
               disabled={isReordering}
             >
               {isReordering ? (
                 <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
               ) : (
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
               )}
               {isReordering ? 'กำลังระบุตำแหน่ง...' : 'เรียงคิว (GPS)'}
             </button>
             <button onClick={handleDeleteAll}
               className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition border border-red-200 ml-auto">
               <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
               ลบข้อมูลทั้งหมด
             </button>
          </div>
        )}

        {/* ── Reorder Button for Technician (non-admin) ──── */}
        {!isAdmin && activeTab !== 'map' && activeTab !== 'postponed' && (
          <div className="bg-white border-b border-[#E5E7EB] px-4 py-2.5 flex items-center gap-3">
            <button
              onClick={handleReorderByLocation}
              disabled={isReordering}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-sm font-bold hover:bg-emerald-100 transition border border-emerald-200 disabled:opacity-60"
            >
              {isReordering ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4}/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              )}
              {isReordering ? 'กำลังระบุตำแหน่ง...' : '📍 เรียงคิวจากตำแหน่งปัจจุบัน'}
            </button>
            <span className="text-xs text-slate-400">ระบบจะเรียงงานจากที่ใกล้ที่สุดโดยอัตโนมัติ</span>
          </div>
        )}

        {/* ── Main Content ────────────────────────────────── */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse"
                  style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                  <svg className="w-5 h-5 text-[#1F2937] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <span className="text-sm text-[#9CA3AF] font-medium">กำลังโหลดข้อมูล...</span>
              </div>
            </div>
          ) : activeTab === 'map' ? (
            // ── MAP VIEW ──
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
                        icon={createNumberedIcon(job.seq || '?', job.status === 'completed' ? '#10b981' : job.status === 'failed' ? '#ef4444' : '#1F2937')}
                      >
                        <Popup>
                          <div className="font-sans min-w-[200px]">
                            <div className="flex justify-between items-start mb-2 border-b border-[#E5E7EB] pb-2">
                              <strong className="block text-[#1F2937] text-sm">{job.access_no}</strong>
                              {job.seq && (
                                <span className="bg-[#A3E635]/20 text-[#374151] text-xs font-bold px-2 py-1 rounded-md">
                                  ลำดับ: {job.seq}
                                </span>
                              )}
                            </div>
                            <span className="block text-xs text-[#374151] mb-1"><span className="font-semibold">ลูกค้า:</span> {job.customer || '-'}</span>
                            <span className="block text-xs text-[#374151] mb-1"><span className="font-semibold">สถานะ:</span> {job.status}</span>
                            <span className="block text-xs text-[#374151]"><span className="font-semibold">ทีม:</span> {job.team_name || 'ยังไม่ระบุ'}</span>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              {/* Right Sidebar for Assigned Jobs */}
              <div className="w-full md:w-80 lg:w-96 bg-white border-t md:border-t-0 md:border-l border-[#E5E7EB] flex flex-col h-[50vh] md:h-full z-10 shrink-0 overflow-hidden"
                style={{ boxShadow: '-4px 0 15px rgba(0,0,0,0.04)' }}>
                 <div className="px-4 py-3.5 border-b border-[#E5E7EB] bg-[#F9FAFB] shrink-0">
                   <h3 className="font-bold text-[#1F2937] flex items-center gap-2 text-sm">
                     <svg className="w-5 h-5 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
                     งานที่ได้รับมอบหมาย
                     <span className="ml-auto text-xs font-bold text-[#65a30d] bg-[#A3E635]/15 px-2 py-0.5 rounded-md">
                       {jobs.filter(j => j.lat && j.lng).length}
                     </span>
                   </h3>
                 </div>
                 <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
                   {jobs.filter(j => j.lat && j.lng)
                     .sort((a,b) => parseInt(a.seq || 999) - parseInt(b.seq || 999))
                     .map(job => (
                     <div key={job.id} className={`p-3.5 border rounded-xl transition-all bg-white hover:shadow-md ${
                       job.status === 'completed' ? 'border-emerald-200' :
                       job.status === 'failed' ? 'border-red-200' :
                       'border-[#E5E7EB] hover:border-[#A3E635]/40'
                     }`}>
                        <div className="flex justify-between items-start mb-2.5">
                           <div className="flex items-center gap-2">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 text-white ${
                                job.status === 'completed' ? 'bg-emerald-500' :
                                job.status === 'failed' ? 'bg-red-500' :
                                'bg-[#1F2937]'
                              }`}>
                                {job.seq || '?'}
                              </span>
                              <div>
                                <strong className="block text-sm text-[#1F2937] leading-tight">{job.access_no}</strong>
                                {isAdmin && job.team_name && <span className="text-[10px] text-[#9CA3AF]">{job.team_name}</span>}
                              </div>
                           </div>
                           <span className={`text-[10px] px-2 py-1 rounded-md font-bold whitespace-nowrap ${
                             job.status === 'completed' ? 'bg-emerald-50 text-emerald-700' :
                             job.status === 'failed' ? 'bg-red-50 text-red-700' :
                             job.status === 'postponed' ? 'bg-purple-50 text-purple-700' :
                             'bg-amber-50 text-amber-700'
                           }`}>
                             {job.status === 'completed' ? 'เสร็จสิ้น' : job.status === 'failed' ? 'ล้มเหลว' : job.status === 'postponed' ? 'เลื่อนนัด' : 'รอดำเนินการ'}
                           </span>
                        </div>
                        <p className="text-xs text-[#6B7280] mb-1 line-clamp-1"><span className="font-semibold text-[#374151]">ลูกค้า:</span> {job.customer || '-'}</p>
                        <p className="text-xs text-[#6B7280] mb-3 line-clamp-2" title={job.address}><span className="font-semibold text-[#374151]">พิกัด:</span> {job.address || '-'}</p>
                        <div className="flex gap-2">
                           {(!isAdmin && job.status !== 'completed') ? (
                             <div className="flex w-full gap-1 mt-2">
                               <button onClick={() => { setActionJob(job); setActionType('complete'); }} className="flex-1 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg text-xs font-bold transition-colors shadow-sm">✅ จบงาน</button>
                               <button onClick={() => { setActionJob(job); setActionType('incomplete'); }} className="py-2 px-3 bg-red-500 text-white hover:bg-red-600 rounded-lg text-xs font-bold transition-colors shadow-sm whitespace-nowrap" title="ไม่จบงาน">✕ ไม่จบ</button>
                             </div>
                           ) : (
                             <button onClick={() => setSelectedJob(job)}
                               className="flex-1 py-2 bg-[#F3F4F6] text-[#374151] hover:bg-[#A3E635]/15 hover:text-[#1F2937] rounded-lg text-xs font-bold transition-colors border border-[#E5E7EB] hover:border-[#A3E635]/30">
                               รายละเอียด / อัปเดต
                             </button>
                           )}
                           <a href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`} target="_blank" rel="noopener noreferrer"
                             className="flex items-center justify-center w-9 h-9 bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-lg transition-colors border border-emerald-100" title="นำทางด้วย Google Maps">
                             <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                           </a>
                        </div>
                     </div>
                   ))}
                   {jobs.filter(j => j.lat && j.lng).length === 0 && (
                     <div className="text-center p-8 text-[#9CA3AF] text-sm font-medium">
                       ไม่พบงานที่มีพิกัดบนแผนที่
                     </div>
                   )}
                 </div>
              </div>
            </div>
          ) : (
            // ── LIST VIEW ──
            <div className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
              <div className="w-full flex flex-col gap-5">
                
                {/* Stats Row */}
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {[
                    { value: stats.total, label: 'งานทั้งหมด', color: 'text-[#1F2937]', accent: 'bg-[#1F2937]' },
                    { value: stats.hasLocation, label: 'มีพิกัด', color: 'text-violet-600', accent: 'bg-violet-500' },
                    { value: stats.assigned, label: 'จ่ายแล้ว', color: 'text-[#65a30d]', accent: 'bg-[#A3E635]' },
                    { value: stats.unassigned, label: 'รอจ่าย', color: 'text-amber-600', accent: 'bg-amber-400' },
                    { value: stats.completed, label: 'จบงานแล้ว', color: 'text-emerald-600', accent: 'bg-emerald-500' },
                    { value: stats.failed, label: 'ไม่จบงาน', color: 'text-red-600', accent: 'bg-red-500' },
                  ].map((s, i) => (
                    <div key={i} className="bg-white rounded-xl p-4 border border-[#E5E7EB] flex flex-col items-center justify-center hover:shadow-md hover:-translate-y-0.5 transition-all"
                      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div className={`w-1.5 h-1.5 rounded-full ${s.accent} mb-2`} />
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] font-semibold text-[#9CA3AF] mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {jobs.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-[#E5E7EB] mt-2"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                    <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mx-auto mb-5">
                      <svg className="w-8 h-8 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-[#1F2937] mb-1">ยังไม่มีงานในระบบ</h3>
                    <p className="text-[#9CA3AF] text-sm">คลิก "เพิ่มข้อมูลด้วยตัวเอง" เพื่อสร้างงานใหม่</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wider bg-[#F9FAFB]">
                            {isAdmin && <th className="p-3.5 font-bold text-[#9CA3AF] text-center w-12">
                              <input 
                                type="checkbox" 
                                onChange={(e) => setSelectedJobIds(e.target.checked ? jobs.map(j => j.id) : [])}
                                checked={jobs.length > 0 && selectedJobIds.length === jobs.length}
                                className="w-4 h-4 rounded border-[#D1D5DB] text-[#65a30d] focus:ring-[#A3E635] cursor-pointer"
                              />
                            </th>}
                            <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">Access No.</th>
                            <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">ลูกค้า</th>
                            <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">เบอร์โทร</th>
                            <th className="p-3.5 font-bold text-[#9CA3AF] w-1/3">พื้นที่</th>
                            <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">ทีมช่าง</th>
                            <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap text-center">สถานะ</th>
                            <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F3F4F6]">
                          {jobs.map(job => (
                            <tr key={job.id} className={`transition-colors ${selectedJobIds.includes(job.id) ? 'bg-[#A3E635]/5' : 'hover:bg-[#F9FAFB]'}`}>
                                {isAdmin && <td className="p-3.5 text-center">
                                  <input 
                                    type="checkbox" 
                                    checked={selectedJobIds.includes(job.id)}
                                    onChange={() => handleToggleSelect(job.id)}
                                    className="w-4 h-4 rounded border-[#D1D5DB] text-[#65a30d] focus:ring-[#A3E635] cursor-pointer"
                                  />
                                </td>}
                                <td className="p-3.5 text-sm font-bold text-[#1F2937]">{job.access_no}</td>
                                <td className="p-3.5 text-sm font-medium text-[#374151]">{job.customer || '-'}</td>
                                <td className="p-3.5 text-sm text-[#6B7280]">{job.phone || '-'}</td>
                                <td className="p-3.5 text-sm text-[#6B7280] leading-relaxed max-w-[300px] break-words">{job.address || '-'}</td>
                                <td className="p-3.5 text-sm">
                                  {job.team_name ? (
                                    <div className="flex flex-col gap-1.5">
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#A3E635]/10 border border-[#A3E635]/25 text-[#374151] font-semibold text-xs whitespace-nowrap w-fit">
                                        {job.team_name}
                                      </span>
                                      {job.tech_names && (
                                        <div className="flex flex-wrap items-center gap-1">
                                          {job.tech_names.split(',').map((name, i) => (
                                            <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-semibold border border-blue-100 whitespace-nowrap">
                                              {name.trim()}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-red-500 font-medium text-xs bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 whitespace-nowrap">ยังไม่ระบุ</span>
                                  )}
                                </td>
                                <td className="p-3.5 text-sm text-center">
                                  <span className={`inline-flex items-center justify-center min-w-[100px] px-3 py-1.5 rounded-lg text-xs font-bold border ${
                                    job.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    job.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                    job.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                                    job.status === 'postponed' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                    'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {job.status === 'completed' ? 'เสร็จสิ้น' :
                                     job.status === 'in_progress' ? 'กำลังดำเนินการ' :
                                     job.status === 'failed' ? 'ล้มเหลว' : 
                                     job.status === 'postponed' ? 'เลื่อนนัด' : 'รอดำเนินการ'}
                                  </span>
                                </td>
                                <td className="p-3.5 text-center whitespace-nowrap">
                                  <div className="flex gap-1.5 justify-center">
                                    {(!isAdmin && job.status !== 'completed') ? (
                                      <>
                                        <button onClick={() => { setActionJob(job); setActionType('complete'); }} className="px-3 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg transition-colors shadow-sm" title="จบงาน"><span className="text-xs font-bold">✅ จบงาน</span></button>
                                        <button onClick={() => { setActionJob(job); setActionType('incomplete'); }} className="px-3 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors shadow-sm" title="ไม่จบงาน"><span className="text-xs font-bold">✕ ไม่จบ</span></button>
                                      </>
                                    ) : (
                                      <button onClick={() => setSelectedJob(job)}
                                        className="p-2 bg-[#F3F4F6] text-[#374151] hover:bg-[#A3E635]/15 hover:text-[#1F2937] rounded-lg transition-colors border border-[#E5E7EB] hover:border-[#A3E635]/30" title="รายละเอียด/ระบุสถานะ">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                      </button>
                                    )}
                                    {isAdmin && <button onClick={() => handleDelete(job.id)}
                                      className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors border border-red-100" title="ลบ">
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
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 backdrop-blur-md text-white px-6 py-3 rounded-2xl flex justify-between items-center shadow-2xl animate-fade-in-up z-20 gap-6"
              style={{ background: 'rgba(31,41,55,0.92)', border: '1px solid rgba(163,230,53,0.25)' }}>
              <span className="font-bold text-sm tracking-wide">
                เลือกแล้ว <span className="text-[#A3E635] text-lg">{selectedJobIds.length}</span> รายการ
              </span>
              <div className="flex gap-2">
                <select 
                  value={bulkAssignTeam} 
                  onChange={(e) => setBulkAssignTeam(e.target.value)}
                  className="px-3 py-2 text-sm font-semibold rounded-xl bg-white text-[#1F2937] border-0 outline-none"
                >
                  <option value="">-- เลือกทีม --</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.team_name}</option>
                  ))}
                </select>
                <button onClick={handleBulkAssign} className="px-4 py-2 text-sm font-bold bg-[#A3E635] text-[#1F2937] hover:bg-[#84cc16] rounded-xl transition-colors shadow-md flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  มอบหมายทีม
                </button>
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
          type={activeTab === 'map' || activeTab === 'postponed' ? 'office' : activeTab}
        />
      )}

      {/* Technician Action Modals */}
      <CompleteJobModal
        job={actionJob}
        isOpen={actionType === 'complete'}
        onClose={() => { setActionJob(null); setActionType(null); }}
        onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }}
      />
      <IncompleteJobModal
        job={actionJob}
        isOpen={actionType === 'incomplete'}
        onClose={() => { setActionJob(null); setActionType(null); }}
        onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }}
      />
      <PostponeJobModal
        job={actionJob}
        isOpen={actionType === 'postpone'}
        onClose={() => { setActionJob(null); setActionType(null); }}
        onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }}
      />

      <ImportExcelModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onSuccess={handleActionComplete} 
      />

      <CustomImportExcelModal 
        isOpen={isCustomImportModalOpen} 
        onClose={() => setIsCustomImportModalOpen(false)} 
        onSuccess={handleActionComplete} 
      />

      {/* ── Confirmation Modal ────────────────────────────── */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1F2937]/50 backdrop-blur-sm" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}></div>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative z-10 border border-[#E5E7EB] animate-fade-in-up"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${confirmDialog.isDanger ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-[#1F2937] mb-2">{confirmDialog.title}</h3>
            <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 rounded-xl font-bold text-[#6B7280] bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors border border-[#E5E7EB]"
              >
                ยกเลิก
              </button>
              <button 
                onClick={() => {
                  if (confirmDialog.onConfirm) confirmDialog.onConfirm();
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-white shadow-md transition-colors ${confirmDialog.isDanger ? 'bg-red-500 hover:bg-red-600 shadow-red-500/25' : 'bg-orange-500 hover:bg-orange-600 shadow-orange-500/25'}`}
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification ────────────────────────────── */}
      {notification.show && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in-down border ${
          notification.type === 'success' 
            ? 'bg-[#1F2937] border-[#A3E635]/30 text-white' 
            : 'bg-red-500 border-red-400 text-white'
        }`} style={{ backdropFilter: 'blur(12px)' }}>
          {notification.type === 'success' ? (
            <div className="w-6 h-6 rounded-full bg-[#A3E635] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            </div>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          )}
          <span className="font-bold tracking-wide text-sm">{notification.message}</span>
        </div>
      )}

      <ManualModal 
        isOpen={showManualModal} 
        onClose={() => setShowManualModal(false)} 
        userRoles={user?.roles || [user?.role]} 
        pageName="dispatch" 
      />
    </div>
  );
}

