import { useState, useEffect, useMemo } from 'react';
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
import Swal from 'sweetalert2';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

export default function DispatchDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user && (user.roles?.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(user.role));
  const isMATech = user?.role === 'ma_technician' || user?.roles?.includes('ma_technician') || user?.role === 'contractor_ma' || user?.roles?.includes('contractor_ma');
  const isOfficeTech = user?.role === 'technician' || user?.roles?.includes('technician') || user?.role === 'office_technician' || user?.role === 'contractor_office' || user?.roles?.includes('contractor_office');

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  let initialMainTab = searchParams.get('tab') || 'office';
  if (!isAdmin && !isOfficeTech && isMATech && initialMainTab === 'office') initialMainTab = 'ma';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCustomImportModalOpen, setIsCustomImportModalOpen] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [actionJob, setActionJob] = useState(null);
  const [actionType, setActionType] = useState(null);

  const [mainTab, setMainTab] = useState(initialMainTab);
  const [subTab, setSubTab] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState(null);
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [bulkAssignTeam, setBulkAssignTeam] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: true });
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  };

  useEffect(() => { AOS.refresh(); fetchJobs(); fetchTeams(); fetchUsers(); }, []);
  useEffect(() => { const tab = searchParams.get('tab'); if (tab && ['office', 'ma'].includes(tab)) setMainTab(tab); }, [location.search]);
  useEffect(() => { fetchJobs(); setSelectedJobIds([]); }, [mainTab, filterDate, filterTeamId, filterUserId]);

  const fetchTeams = async () => { try { const r = await axios.get('/users/teams'); setTeams(Array.isArray(r.data) ? r.data : []); } catch(e) { console.error(e); } };
  const fetchUsers = async () => { try { const r = await axios.get('/users'); setAllUsers(Array.isArray(r.data) ? r.data : []); } catch(e) { console.error(e); } };
  const fetchJobs = async () => {
    try {
      setLoading(true);
      let url = `/dispatch/jobs?type=${mainTab}`;
      if (filterDate) url += `&date=${filterDate}`;
      if (filterTeamId) url += `&team_id=${filterTeamId}`;
      if (filterUserId) url += `&user_id=${filterUserId}`;
      const r = await axios.get(url);
      setJobs(Array.isArray(r.data) ? r.data : []);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };
  const handleActionComplete = () => { fetchJobs(); setSelectedJobIds([]); };

  const today = new Date().toISOString().split('T')[0];
  const filteredJobs = useMemo(() => {
    switch (subTab) {
      case 'assigned': return jobs.filter(j => j.team_id && !['completed','failed','postponed'].includes(j.status));
      case 'completed': return jobs.filter(j => j.status === 'completed');
      case 'failed': return jobs.filter(j => j.status === 'failed');
      case 'postponed': return jobs.filter(j => j.status === 'postponed');
      case 'overdue': return jobs.filter(j => !['completed','failed','postponed'].includes(j.status) && j.plan_arrival_date && j.plan_arrival_date.split('T')[0] < today);
      case 'map': return jobs;
      default: return jobs;
    }
  }, [jobs, subTab, today]);

  const stats = useMemo(() => ({
    total: jobs.length,
    assigned: jobs.filter(j => j.team_id && !['completed','failed','postponed'].includes(j.status)).length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    postponed: jobs.filter(j => j.status === 'postponed').length,
    overdue: jobs.filter(j => !['completed','failed','postponed'].includes(j.status) && j.plan_arrival_date && j.plan_arrival_date.split('T')[0] < today).length,
  }), [jobs, today]);

  const techsForFilter = useMemo(() => {
    let t = allUsers.filter(u => u.roles?.includes('technician') || u.role === 'technician' || u.roles?.includes('ma_technician') || u.role === 'ma_technician');
    if (filterTeamId) t = t.filter(u => String(u.team_id) === String(filterTeamId));
    return t;
  }, [allUsers, filterTeamId]);

  const requestConfirm = (title, message, onConfirm, isDanger = true) => setConfirmDialog({ isOpen: true, title, message, onConfirm, isDanger });

  const handleDelete = (jobId) => requestConfirm('ยืนยันลบงาน', 'ลบงานนี้?', async () => { try { await axios.delete(`/dispatch/jobs/${jobId}`, { params: { type: mainTab } }); handleActionComplete(); showNotification('ลบสำเร็จ'); } catch(e) { showNotification('ไม่สามารถลบได้', 'error'); } });
  const handleDeleteBulk = () => requestConfirm('ลบหลายรายการ', `ลบ ${selectedJobIds.length} รายการ?`, async () => { try { await axios.delete('/dispatch/jobs/bulk', { data: { ids: selectedJobIds, type: mainTab } }); handleActionComplete(); showNotification('ลบสำเร็จ'); } catch(e) { showNotification('ไม่สามารถลบได้', 'error'); } });
  const handleBulkAssign = async () => { if (!bulkAssignTeam) return showNotification('เลือกทีม', 'error'); requestConfirm('มอบหมายทีม', `มอบหมาย ${selectedJobIds.length} งาน?`, async () => { try { await axios.put('/dispatch/jobs/bulk-assign', { ids: selectedJobIds, team_id: bulkAssignTeam, type: mainTab }); showNotification('มอบหมายสำเร็จ'); setBulkAssignTeam(''); handleActionComplete(); } catch(e) { showNotification('ผิดพลาด', 'error'); } }); };
  const handleDeleteAll = () => requestConfirm('ลบทั้งหมด', 'ลบงานที่รอดำเนินการทั้งหมด?', async () => { try { await axios.delete('/dispatch/jobs/all', { params: { type: mainTab } }); handleActionComplete(); showNotification('ลบสำเร็จ'); } catch(e) { showNotification('ไม่สามารถลบได้', 'error'); } });
  const handleClearDispatch = () => requestConfirm('ล้างจ่ายงาน', 'ยืนยัน?', async () => { try { await axios.put('/dispatch/jobs/clear-dispatch', {}); fetchJobs(); showNotification('ล้างสำเร็จ'); } catch(e) { showNotification('ผิดพลาด', 'error'); } }, false);
  const handleClearQueue = () => requestConfirm('ล้างคิว', 'ยืนยัน?', async () => { try { await axios.put('/dispatch/jobs/clear-queue', {}); fetchJobs(); showNotification('ล้างสำเร็จ'); } catch(e) { showNotification('ผิดพลาด', 'error'); } }, false);
  const handleCancelCompletion = (job) => requestConfirm('ยกเลิกจบงาน', `ยกเลิก ${job.access_no}?`, async () => { try { await axios.put(`/dispatch/jobs/${job.id}/cancel-completion`); fetchJobs(); showNotification('ยกเลิกสำเร็จ'); } catch(e) { showNotification(e.response?.data?.error || 'ผิดพลาด', 'error'); } }, true);
  const handleChangeCompletedTeam = async (job) => { try { const r = await axios.get('/users/teams'); const opts = {}; r.data.forEach(t => { opts[t.id] = t.team_name; }); const { value: nid } = await Swal.fire({ title: 'เปลี่ยนทีม', text: `ปัจจุบัน: ${job.team_name || '-'}`, input: 'select', inputOptions: opts, showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#185FA5', customClass: { popup: 'rounded-3xl' }, inputValidator: v => { if (!v) return 'เลือกทีม'; if (v == job.team_id) return 'เหมือนเดิม'; } }); if (nid) { await axios.put(`/dispatch/jobs/${job.id}/change-completed-team`, { new_team_id: nid }); fetchJobs(); Swal.fire({ title: 'สำเร็จ!', icon: 'success', confirmButtonColor: '#185FA5', customClass: { popup: 'rounded-3xl' } }); } } catch(e) { Swal.fire({ title: 'ผิดพลาด', text: e.response?.data?.error || '', icon: 'error' }); } };
  const handleStatusClick = (job) => { if (job.status === 'failed') Swal.fire({ title: 'สาเหตุ', text: job.fail_reason || job.remark || 'ไม่ระบุ', icon: 'info', confirmButtonColor: '#185FA5', customClass: { popup: 'rounded-3xl' } }); };
  const handleReorderByLocation = () => { if (!navigator.geolocation) return showNotification('ไม่รองรับ GPS', 'error'); setIsReordering(true); navigator.geolocation.getCurrentPosition(async (pos) => { try { const r = await axios.put('/dispatch/jobs/reorder-by-location', { lat: pos.coords.latitude, lng: pos.coords.longitude, type: mainTab }); showNotification(`เรียงสำเร็จ ${r.data.updated} งาน`); fetchJobs(); } catch(e) { showNotification('ผิดพลาด', 'error'); } finally { setIsReordering(false); } }, () => { setIsReordering(false); showNotification('ไม่สามารถระบุตำแหน่ง', 'error'); }, { enableHighAccuracy: true, timeout: 10000 }); };
  const handleToggleSelect = (jobId) => setSelectedJobIds(prev => prev.includes(jobId) ? prev.filter(id => id !== jobId) : [...prev, jobId]);

  const handleViewDetails = async (job) => {
    try {
      Swal.fire({ title: 'กำลังโหลด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const res = await axios.get(`/dispatch/jobs/${job.id}/details?type=${mainTab}`);
      const d = res.data;
      const isLate = d.status === 'completed' && d.plan_arrival_date && d.completed_at && new Date(d.completed_at).toISOString().split('T')[0] > d.plan_arrival_date.split('T')[0];
      let html = '<div style="text-align:left;font-size:14px;">';
      html += `<div style="margin-bottom:16px;"><div style="font-weight:900;font-size:16px;margin-bottom:4px;">Access No: ${d.access_no || '-'}</div><div style="color:#6B7280;">ลูกค้า: ${d.customer || '-'} | โทร: ${d.phone || '-'}</div><div style="color:#6B7280;">ที่อยู่: ${d.address || '-'}</div>${d.team_name ? `<div style="color:#3B82F6;font-weight:bold;margin-top:4px;">ทีม: ${d.team_name}</div>` : ''}</div>`;
      html += `<div style="padding:8px 12px;border-radius:8px;margin-bottom:12px;font-weight:bold;${d.status === 'completed' ? 'background:#ECFDF5;color:#059669;' : d.status === 'failed' ? 'background:#FEF2F2;color:#DC2626;' : d.status === 'postponed' ? 'background:#F5F3FF;color:#7C3AED;' : 'background:#FFFBEB;color:#D97706;'}">สถานะ: ${d.status === 'completed' ? 'สำเร็จ' : d.status === 'failed' ? 'ไม่สำเร็จ' : d.status === 'postponed' ? 'เลื่อนนัด' : 'รอดำเนินการ'}${isLate ? ' <span style="background:#FEE2E2;color:#DC2626;padding:2px 8px;border-radius:6px;font-size:11px;">⚠️ ปิดงานล่าช้า</span>' : ''}</div>`;
      if (d.status === 'failed' && (d.fail_reason || d.remark)) html += `<div style="background:#FEF2F2;padding:8px 12px;border-radius:8px;margin-bottom:12px;"><strong>สาเหตุ:</strong> ${d.fail_reason || d.remark}</div>`;
      if (d.status === 'completed') { html += `<div style="background:#F9FAFB;padding:10px 12px;border-radius:8px;border:1px solid #E5E7EB;margin-bottom:12px;"><div style="font-weight:bold;margin-bottom:4px;">📋 ข้อมูลการปิดงาน</div>${d.completed_by_name ? `<div>ปิดโดย: ${d.completed_by_name}</div>` : ''}${d.completed_at ? `<div>วันที่ปิด: ${new Date(d.completed_at).toLocaleString('th-TH')}</div>` : ''}${d.completion_note ? `<div>หมายเหตุ: ${d.completion_note}</div>` : ''}</div>`; }
      if (d.used_devices?.length > 0) { html += `<div style="background:#F0FDF4;padding:10px 12px;border-radius:8px;border:1px solid #BBF7D0;margin-bottom:12px;"><div style="font-weight:bold;margin-bottom:8px;">🔧 อุปกรณ์ที่ใช้ (${d.used_devices.length})</div>`; d.used_devices.forEach(dev => { html += `<div style="padding:4px 0;border-bottom:1px dashed #D1FAE5;font-size:13px;">${dev.product_name} ${dev.model_name || ''} ${dev.sn && dev.sn !== '-' ? `(SN: ${dev.sn})` : ''} x${dev.quantity}</div>`; }); html += `</div>`; }
      if (d.logs?.length > 0) { html += `<div style="background:#F5F3FF;padding:10px 12px;border-radius:8px;border:1px solid #DDD6FE;margin-bottom:12px;"><div style="font-weight:bold;margin-bottom:8px;">📅 ประวัติ</div>`; d.logs.forEach(log => { html += `<div style="padding:4px 0;font-size:12px;border-bottom:1px dashed #EDE9FE;">${log.status || '-'} | ${log.action_by_name || '-'} | ${log.reason || '-'} | ${new Date(log.created_at).toLocaleDateString('th-TH')}</div>`; }); html += `</div>`; }
      if (d.images?.length > 0) { html += `<div style="font-weight:bold;margin-bottom:8px;">📷 รูปภาพ</div><div style="display:flex;gap:8px;flex-wrap:wrap;">`; d.images.forEach(img => { html += `<img src="${img.image_path}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid #E5E7EB;cursor:pointer;" onclick="window.open('${img.image_path}','_blank')" />`; }); html += `</div>`; }
      html += '</div>';
      Swal.fire({ title: 'รายละเอียดงาน', html, width: '560px', confirmButtonText: 'ปิด', confirmButtonColor: '#1F2937', customClass: { popup: 'rounded-3xl' } });
    } catch(e) { Swal.fire({ icon: 'error', title: 'โหลดไม่ได้', text: e.response?.data?.error || e.message }); }
  };

  // Map helpers
  const mapCenter = jobs.find(j => j.lat && j.lng) ? [parseFloat(jobs.find(j => j.lat && j.lng).lat), parseFloat(jobs.find(j => j.lat && j.lng).lng)] : [13.7563, 100.5018];
  const teamColors = ['#A3E635', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
  const teamsWithJobs = {};
  jobs.forEach(job => { if (job.team_id && job.lat && job.lng) { if (!teamsWithJobs[job.team_id]) teamsWithJobs[job.team_id] = []; teamsWithJobs[job.team_id].push(job); } });
  const createNumberedIcon = (number, color = '#1F2937') => L.divIcon({ className: 'custom-div-icon', html: `<div style="background-color: ${color}; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">${number}</div>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
  const polylines = Object.keys(teamsWithJobs).map((teamId, index) => { const tj = teamsWithJobs[teamId].sort((a, b) => (a.seq || 0) - (b.seq || 0)); return <Polyline key={`tp-${teamId}`} positions={tj.map(j => [parseFloat(j.lat), parseFloat(j.lng)])} pathOptions={{ color: teamColors[index % teamColors.length], weight: 3, opacity: 0.7, dashArray: '5, 10' }} />; });

  const getPostponeLabel = (job) => { if (job.status !== 'postponed') return null; const from = job.original_date || job.created_at; const to = job.plan_arrival_date; return `เลื่อนจาก ${from ? new Date(from).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '?'} → ${to ? new Date(to).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '?'}`; };
  const isOverdue = (job) => !['completed','failed','postponed'].includes(job.status) && job.plan_arrival_date && job.plan_arrival_date.split('T')[0] < today;
  const isLateClose = (job) => job.status === 'completed' && job.plan_arrival_date && job.completed_at && new Date(job.completed_at).toISOString().split('T')[0] > job.plan_arrival_date.split('T')[0];

  const summaryCards = [
    { key: 'all', label: 'งานทั้งหมด', value: stats.total, icon: '📋', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700' },
    { key: 'assigned', label: 'มอบหมายแล้ว', value: stats.assigned, icon: '👥', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    { key: 'completed', label: 'สำเร็จ', value: stats.completed, icon: '✅', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700' },
    { key: 'failed', label: 'ไม่สำเร็จ', value: stats.failed, icon: '❌', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
    { key: 'postponed', label: 'เลื่อนนัด', value: stats.postponed, icon: '📅', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    { key: 'overdue', label: 'เลยกำหนด', value: stats.overdue, icon: '⏰', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
    { key: 'map', label: 'แผนที่', value: jobs.filter(j => j.lat && j.lng).length, icon: '🗺️', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  ];
  const subTabLabels = { all: 'ทั้งหมด', assigned: 'มอบหมายแล้ว', completed: 'สำเร็จ', failed: 'ไม่สำเร็จ', postponed: 'เลื่อนนัด', overdue: 'เลยกำหนด', map: 'แผนที่' };

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="jobs" />
      <div className="flex-1 flex flex-col min-w-0 md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB] shrink-0 gap-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-xl text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                <svg className="w-4 h-4 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </div>
              <h1 className="font-bold text-[#1F2937] text-lg tracking-tight">ระบบแจกจ่ายงาน</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (<>
              <button onClick={() => setIsImportModalOpen(true)} className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border border-[#E5E7EB] px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                <span className="hidden sm:inline">นำเข้า Excel</span>
              </button>
              <button onClick={() => setIsCustomImportModalOpen(true)} className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border border-[#E5E7EB] px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <span className="hidden sm:inline">นำเข้า Custom</span>
              </button>
              <button onClick={() => setIsAutoModalOpen(true)} className="bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border border-[#E5E7EB] px-3 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="hidden sm:inline">แจกจ่ายอัตโนมัติ</span>
              </button>
              <button onClick={() => setIsModalOpen(true)} className="text-[#1F2937] px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 shadow-sm" style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                <span className="hidden sm:inline">เพิ่มข้อมูลด้วยตัวเอง</span><span className="sm:hidden">เพิ่ม</span>
              </button>
            </>)}
            <button onClick={() => setShowManualModal(true)} className="flex items-center gap-1.5 text-xs text-brand-600 font-semibold bg-brand-50 hover:bg-brand-100 px-3 py-2 rounded-xl border border-brand-200 transition-all ml-auto">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="font-bold">คู่มือ</span>
            </button>
          </div>
        </header>

        {/* Main Tabs */}
        <div className="bg-white border-b border-[#E5E7EB] flex shrink-0 px-4 gap-2 py-2">
          {[{ key: 'office', label: 'งานติดตั้ง', icon: '🏢' }, { key: 'ma', label: 'งาน MA', icon: '🔧' }]
            .filter(t => isAdmin || (t.key === 'office' && isOfficeTech) || (t.key === 'ma' && isMATech))
            .map(tab => (
            <button key={tab.key} onClick={() => { setMainTab(tab.key); setSubTab('all'); }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${mainTab === tab.key ? 'text-[#1F2937] shadow-md' : 'text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F9FAFB]'}`}
              style={mainTab === tab.key ? { background: 'linear-gradient(135deg, rgba(163,230,53,0.2), rgba(101,163,13,0.1))', border: '1px solid rgba(163,230,53,0.4)' } : { border: '1px solid transparent' }}>
              <span className="text-lg">{tab.icon}</span>{tab.label}{mainTab === tab.key && <span className="w-2 h-2 rounded-full bg-[#A3E635]" />}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white border-b border-[#E5E7EB] px-4 py-2.5 flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm text-[#1F2937] outline-none focus:border-[#A3E635] focus:ring-1 focus:ring-[#A3E635] bg-[#F9FAFB] hover:bg-white transition-all" />
          </div>
          {isAdmin && (<>
            <select value={filterTeamId} onChange={e => { setFilterTeamId(e.target.value); setFilterUserId(''); }} className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm text-[#1F2937] outline-none focus:border-[#A3E635] bg-[#F9FAFB]">
              <option value="">ทีมทั้งหมด</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}
            </select>
            <select value={filterUserId} onChange={e => setFilterUserId(e.target.value)} className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm text-[#1F2937] outline-none focus:border-[#A3E635] bg-[#F9FAFB]">
              <option value="">ช่างทุกคน</option>
              {techsForFilter.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </>)}
          {(filterDate || filterTeamId || filterUserId) && (
            <button onClick={() => { setFilterDate(''); setFilterTeamId(''); setFilterUserId(''); }} className="text-xs text-red-600 hover:text-white font-semibold px-3 py-1.5 bg-red-50 hover:bg-red-500 rounded-lg transition-colors shadow-sm">❌ ล้างตัวกรอง</button>
          )}
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-hidden flex flex-col relative">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse" style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                  <svg className="w-5 h-5 text-[#1F2937] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <span className="text-sm text-[#9CA3AF] font-medium">กำลังโหลดข้อมูล...</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-6 animate-fade-in">
              <div className="w-full flex flex-col gap-5">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-3">
                  {summaryCards.map(card => (
                    <button key={card.key} onClick={() => setSubTab(card.key)}
                      className={`rounded-xl p-4 border transition-all text-left hover:shadow-lg hover:-translate-y-1 ${subTab === card.key ? `${card.bg} ${card.border} ring-2 ring-offset-1 ring-[#A3E635]` : 'bg-white border-[#E5E7EB]'}`}
                      style={{ boxShadow: subTab === card.key ? '0 4px 15px rgba(0,0,0,0.08)' : '0 1px 3px rgba(0,0,0,0.04)' }}>
                      <div className="flex items-center justify-between mb-2"><span className="text-xl">{card.icon}</span>{subTab === card.key && <span className="w-2 h-2 rounded-full bg-[#A3E635]" />}</div>
                      <p className={`text-2xl font-black ${card.text}`}>{card.value}</p>
                      <p className="text-[11px] font-semibold text-[#9CA3AF] mt-1">{card.label}</p>
                    </button>
                  ))}
                </div>

                {/* Sub-tab pills */}
                <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {Object.entries(subTabLabels).map(([key, label]) => (
                    <button key={key} onClick={() => setSubTab(key)}
                      className={`px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${subTab === key ? 'bg-[#1F2937] text-white shadow-md' : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'}`}>
                      {label}
                      {key !== 'map' && <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${subTab === key ? 'bg-[#A3E635] text-[#1F2937]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>
                        {key === 'all' ? stats.total : key === 'assigned' ? stats.assigned : key === 'completed' ? stats.completed : key === 'failed' ? stats.failed : key === 'postponed' ? stats.postponed : stats.overdue}
                      </span>}
                    </button>
                  ))}
                </div>

                {/* Admin Toolbar */}
                {isAdmin && subTab !== 'map' && (
                  <div className="flex flex-wrap gap-2" style={{ scrollbarWidth: 'none' }}>
                    <button onClick={handleClearDispatch} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 text-orange-700 text-xs font-bold hover:bg-orange-100 transition border border-orange-200">ล้างจ่ายงาน</button>
                    <button onClick={handleClearQueue} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-bold hover:bg-amber-100 transition border border-amber-200">ล้างคิว</button>
                    <button onClick={handleReorderByLocation} disabled={isReordering} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100 transition border border-emerald-200 disabled:opacity-50">{isReordering ? '⏳ กำลังระบุ...' : '📍 เรียงคิว (GPS)'}</button>
                    <button onClick={handleDeleteAll} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition border border-red-200 ml-auto">🗑️ ลบข้อมูลทั้งหมด</button>
                  </div>
                )}

                {/* Map View */}
                {subTab === 'map' ? (
                  <div className="flex flex-col md:flex-row w-full relative z-0 overflow-hidden rounded-xl border border-[#E5E7EB]" style={{ height: '65vh' }}>
                    <div className="h-full flex-1 relative z-0">
                      <MapContainer center={mapCenter} zoom={11} className="w-full h-full">
                        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {polylines}
                        {jobs.filter(j => j.lat && j.lng).map(job => (
                          <Marker key={job.id} position={[parseFloat(job.lat), parseFloat(job.lng)]}
                            icon={createNumberedIcon(job.seq || '?', job.status === 'completed' ? '#10b981' : job.status === 'failed' ? '#ef4444' : '#1F2937')}>
                            <Popup><div className="font-sans min-w-[200px]"><strong className="block text-sm">{job.access_no}</strong><span className="text-xs text-gray-600">ลูกค้า: {job.customer || '-'}</span><br/><span className="text-xs text-gray-600">ทีม: {job.team_name || 'ยังไม่ระบุ'}</span></div></Popup>
                          </Marker>
                        ))}
                      </MapContainer>
                    </div>
                    <div className="w-full md:w-80 bg-white border-t md:border-t-0 md:border-l border-[#E5E7EB] flex flex-col h-[30vh] md:h-full overflow-hidden">
                      <div className="px-4 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB] shrink-0"><h3 className="font-bold text-sm text-[#1F2937]">📍 งานที่มีพิกัด ({jobs.filter(j => j.lat && j.lng).length})</h3></div>
                      <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ scrollbarWidth: 'thin' }}>
                        {jobs.filter(j => j.lat && j.lng).sort((a, b) => (a.seq || 999) - (b.seq || 999)).map(job => (
                          <div key={job.id} className="p-3 border rounded-lg text-xs hover:shadow transition-all bg-white border-[#E5E7EB]">
                            <div className="flex justify-between items-center mb-1"><strong className="text-[#1F2937]">{job.seq || '?'}. {job.access_no}</strong>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${job.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : job.status === 'failed' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{job.status === 'completed' ? 'สำเร็จ' : job.status === 'failed' ? 'ล้มเหลว' : 'รอ'}</span></div>
                            <div className="text-[#6B7280]">{job.customer || '-'} | {job.team_name || 'ไม่ระบุ'}</div>
                            <div className="flex gap-1 mt-2">
                              <button onClick={() => handleViewDetails(job)} className="flex-1 py-1.5 bg-[#F3F4F6] text-[#374151] rounded text-[10px] font-bold hover:bg-[#A3E635]/15">ดูรายละเอียด</button>
                              <a href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold hover:bg-emerald-100">🗺️</a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Table View */
                  <>
                    {filteredJobs.length === 0 ? (
                      <div className="bg-white rounded-2xl p-12 text-center border border-[#E5E7EB]" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                        <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mx-auto mb-5"><svg className="w-8 h-8 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
                        <h3 className="text-lg font-bold text-[#1F2937] mb-1">ไม่มีข้อมูลในหมวดนี้</h3>
                        <p className="text-[#9CA3AF] text-sm">ไม่มีงานที่ตรงกับตัวกรองที่เลือก</p>
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                              <tr className="border-b border-[#E5E7EB] text-[11px] uppercase tracking-wider bg-[#F9FAFB]">
                                {isAdmin && <th className="p-3.5 font-bold text-[#9CA3AF] text-center w-12"><input type="checkbox" onChange={e => setSelectedJobIds(e.target.checked ? filteredJobs.map(j => j.id) : [])} checked={filteredJobs.length > 0 && selectedJobIds.length === filteredJobs.length} className="w-4 h-4 rounded border-[#D1D5DB] text-[#65a30d] focus:ring-[#A3E635] cursor-pointer" /></th>}
                                <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">Access No.</th>
                                <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">ลูกค้า</th>
                                <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">เบอร์โทร</th>
                                <th className="p-3.5 font-bold text-[#9CA3AF] w-1/4">พื้นที่</th>
                                <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">ทีมช่าง</th>
                                <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap">วันนัด</th>
                                <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap text-center">สถานะ</th>
                                <th className="p-3.5 font-bold text-[#9CA3AF] whitespace-nowrap text-center">จัดการ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                              {filteredJobs.map(job => (
                                <tr key={job.id} className={`transition-colors ${selectedJobIds.includes(job.id) ? 'bg-[#A3E635]/5' : 'hover:bg-[#F9FAFB]'}`}>
                                  {isAdmin && <td className="p-3.5 text-center"><input type="checkbox" checked={selectedJobIds.includes(job.id)} onChange={() => handleToggleSelect(job.id)} className="w-4 h-4 rounded border-[#D1D5DB] text-[#65a30d] focus:ring-[#A3E635] cursor-pointer" /></td>}
                                  <td className="p-3.5 text-sm font-bold text-[#1F2937]">{job.access_no}</td>
                                  <td className="p-3.5 text-sm font-medium text-[#374151]">{job.customer || '-'}</td>
                                  <td className="p-3.5 text-sm text-[#6B7280]">{job.phone || '-'}</td>
                                  <td className="p-3.5 text-sm text-[#6B7280] leading-relaxed max-w-[250px] break-words">{job.address || '-'}</td>
                                  <td className="p-3.5 text-sm">
                                    {job.team_name ? (<div className="flex flex-col gap-1"><span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#A3E635]/10 border border-[#A3E635]/25 text-[#374151] font-semibold text-xs w-fit">{job.team_name}</span>
                                      {job.tech_names && <div className="flex flex-wrap gap-1">{job.tech_names.split(',').map((n, i) => <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold border border-blue-100">{n.trim()}</span>)}</div>}</div>)
                                    : <span className="text-red-500 font-medium text-xs bg-red-50 px-2 py-0.5 rounded-md border border-red-100">ยังไม่ระบุ</span>}
                                  </td>
                                  <td className="p-3.5 text-sm text-[#6B7280] whitespace-nowrap">
                                    {job.plan_arrival_date ? new Date(job.plan_arrival_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                                    {job.plan_arrival_time && <div className="text-[10px] text-[#9CA3AF]">{typeof job.plan_arrival_time === 'string' ? (job.plan_arrival_time.includes(' ') ? job.plan_arrival_time.split(' ')[1]?.substring(0,5) : job.plan_arrival_time.substring(0,5)) : ''}</div>}
                                  </td>
                                  <td className="p-3.5 text-sm text-center">
                                    <div className="flex flex-col items-center gap-1">
                                      <span onClick={job.status === 'failed' ? () => handleStatusClick(job) : undefined}
                                        className={`inline-flex items-center justify-center min-w-[80px] px-2.5 py-1 rounded-lg text-xs font-bold border ${job.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : job.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200 cursor-pointer hover:opacity-80' : job.status === 'postponed' ? 'bg-purple-50 text-purple-700 border-purple-200' : isOverdue(job) ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                        {job.status === 'completed' ? 'สำเร็จ' : job.status === 'failed' ? 'ไม่สำเร็จ' : job.status === 'postponed' ? 'เลื่อนนัด' : isOverdue(job) ? 'เลยกำหนด' : 'รอดำเนินการ'}
                                      </span>
                                      {job.status === 'postponed' && <span className="text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded border border-purple-100">{getPostponeLabel(job)}</span>}
                                      {isOverdue(job) && <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-100">⏰ เลยกำหนด</span>}
                                      {isLateClose(job) && <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-100">⚠️ ปิดงานล่าช้า</span>}
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-center whitespace-nowrap">
                                    <div className="flex gap-1.5 justify-center">
                                      <button onClick={() => handleViewDetails(job)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-100" title="ดูรายละเอียด">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                      </button>
                                      {(!isAdmin && job.status !== 'completed') ? (<>
                                        <button onClick={() => { setActionJob(job); setActionType('complete'); }} className="px-3 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg transition-colors shadow-sm" title="จบงาน"><span className="text-xs font-bold">✅</span></button>
                                        <button onClick={() => { setActionJob(job); setActionType('incomplete'); }} className="px-3 py-2 bg-red-500 text-white hover:bg-red-600 rounded-lg transition-colors shadow-sm" title="ไม่จบ"><span className="text-xs font-bold">✕</span></button>
                                      </>) : (
                                        <button onClick={() => setSelectedJob(job)} className="p-2 bg-[#F3F4F6] text-[#374151] hover:bg-[#A3E635]/15 rounded-lg transition-colors border border-[#E5E7EB]" title="แก้ไข">
                                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                                        </button>
                                      )}
                                      {isAdmin && (<>
                                        {job.status === 'completed' && (<><button onClick={() => handleCancelCompletion(job)} className="p-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-red-200" title="ยกเลิกจบงาน">❌</button><button onClick={() => handleChangeCompletedTeam(job)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white rounded-lg transition-colors border border-blue-200" title="เปลี่ยนทีม">🔄</button></>)}
                                        {job.status === 'failed' && (<><button onClick={() => handleChangeCompletedTeam(job)} className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white rounded-lg transition-colors border border-blue-200" title="เปลี่ยนทีม">🔄</button><button onClick={() => { setActionJob(job); setActionType('postpone'); }} className="p-2 bg-amber-50 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg transition-colors border border-amber-200" title="เลื่อนงาน">📅</button></>)}
                                        <button onClick={() => handleDelete(job.id)} className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors border border-red-100" title="ลบ"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg></button>
                                      </>)}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Bulk Action Bar */}
          {selectedJobIds.length > 0 && subTab !== 'map' && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 backdrop-blur-md text-white px-6 py-3 rounded-2xl flex justify-between items-center shadow-2xl animate-fade-in-up z-20 gap-6" style={{ background: 'rgba(31,41,55,0.92)', border: '1px solid rgba(163,230,53,0.25)' }}>
              <span className="font-bold text-sm">เลือกแล้ว <span className="text-[#A3E635] text-lg">{selectedJobIds.length}</span> รายการ</span>
              <div className="flex gap-2">
                <select value={bulkAssignTeam} onChange={e => setBulkAssignTeam(e.target.value)} className="px-3 py-2 text-sm font-semibold rounded-xl bg-white text-[#1F2937] border-0 outline-none"><option value="">-- เลือกทีม --</option>{teams.map(t => <option key={t.id} value={t.id}>{t.team_name}</option>)}</select>
                <button onClick={handleBulkAssign} className="px-4 py-2 text-sm font-bold bg-[#A3E635] text-[#1F2937] hover:bg-[#84cc16] rounded-xl transition-colors shadow-md">✅ มอบหมาย</button>
                <button onClick={() => setSelectedJobIds([])} className="px-4 py-2 text-sm font-semibold hover:bg-white/10 rounded-xl transition-colors">ยกเลิก</button>
                <button onClick={handleDeleteBulk} className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-md">🗑️ ลบ</button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modals */}
      <JobDispatchModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleActionComplete} />
      <AutoDispatchModal isOpen={isAutoModalOpen} onClose={() => setIsAutoModalOpen(false)} onSuccess={handleActionComplete} />
      <ImportExcelModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} onSuccess={handleActionComplete} />
      <CustomImportExcelModal isOpen={isCustomImportModalOpen} onClose={() => setIsCustomImportModalOpen(false)} onSuccess={handleActionComplete} />
      {selectedJob && <EditJobModal job={selectedJob} isOpen={!!selectedJob} onClose={() => setSelectedJob(null)} onSuccess={handleActionComplete} type={mainTab} />}
      <CompleteJobModal job={actionJob} isOpen={actionType === 'complete'} onClose={() => { setActionJob(null); setActionType(null); }} onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }} />
      <IncompleteJobModal job={actionJob} isOpen={actionType === 'incomplete'} onClose={() => { setActionJob(null); setActionType(null); }} onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }} />
      <PostponeJobModal job={actionJob} isOpen={actionType === 'postpone'} onClose={() => { setActionJob(null); setActionType(null); }} onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }} />

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1F2937]/50 backdrop-blur-sm" onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))}></div>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative z-10 border border-[#E5E7EB] animate-fade-in-up" style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${confirmDialog.isDanger ? 'bg-red-50 text-red-500' : 'bg-orange-50 text-orange-500'}`}><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
            <h3 className="text-lg font-bold text-[#1F2937] mb-2">{confirmDialog.title}</h3>
            <p className="text-[#6B7280] text-sm mb-6 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} className="flex-1 py-2.5 rounded-xl font-bold text-[#6B7280] bg-[#F3F4F6] hover:bg-[#E5E7EB] transition-colors border border-[#E5E7EB]">ยกเลิก</button>
              <button onClick={() => { if (confirmDialog.onConfirm) confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, isOpen: false })); }} className={`flex-1 py-2.5 rounded-xl font-bold text-white shadow-md transition-colors ${confirmDialog.isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {notification.show && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl shadow-xl flex items-center gap-3 animate-fade-in-down border ${notification.type === 'success' ? 'bg-[#1F2937] border-[#A3E635]/30 text-white' : 'bg-red-500 border-red-400 text-white'}`} style={{ backdropFilter: 'blur(12px)' }}>
          {notification.type === 'success' ? <div className="w-6 h-6 rounded-full bg-[#A3E635] flex items-center justify-center"><svg className="w-3.5 h-3.5 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></div> : <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>}
          <span className="font-bold tracking-wide text-sm">{notification.message}</span>
        </div>
      )}

      <ManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} userRoles={user?.roles || [user?.role]} pageName="dispatch" />
    </div>
  );
}
