import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import ManualCheckinModal from '../components/ManualCheckinModal';
import LeaveRequestModal from '../components/LeaveRequestModal';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { DateTimePicker } from '../components/DateTimePicker';
import { format } from 'date-fns';
import { generateCheckinExcel } from '../utils/exportCheckins';
import { getImageUrl } from '../utils/imageUtils';
import { drawCheckinWatermark, loadImageForCanvas } from '../utils/checkinWatermark';
import { AppDateField, AppSelectField, toThaiDateLabel } from '../components/DispatchFilterFields';

// ── Helpers ──────────────────────────────────────────────────
const THAI_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
function dataURItoBlob(dataURI) {
  const byteString = atob(dataURI.split(',')[1]);
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
  return new Blob([ab], { type: mimeString });
}
function fmtTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
}
function fmtDateFull(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Main Component ────────────────────────────────────────────
export default function CheckinPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { branding } = useBranding();
  const isAdmin = user && (user.roles?.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(user.role));
  const isMATech = user?.role === 'ma_technician' || user?.roles?.includes('ma_technician') || user?.role === 'contractor_ma' || user?.roles?.includes('contractor_ma');
  const isSales = user?.role === 'sales' || user?.roles?.includes('sales');

  const userRolesList = user?.roles || (user?.role ? [user.role] : []);
  const hasGeneral = userRolesList.includes('technician') || userRolesList.includes('office_technician') || userRolesList.includes('contractor_office');
  const hasMA = userRolesList.includes('ma_technician') || userRolesList.includes('contractor_ma');
  const hasSales = userRolesList.includes('sales');
  
  const availableTabs = [];
  if (hasGeneral || isAdmin) availableTabs.push({ id: 'general', label: 'ช่างติดตั้ง', icon: '📝' });
  if (hasMA || isAdmin) availableTabs.push({ id: 'ma', label: 'ทีม MA', icon: '🛠️' });
  if (hasSales || isAdmin) availableTabs.push({ id: 'sales', label: 'เซลส์', icon: '💼' });
  // Camera state
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [preloadedCoords, setPreloadedCoords] = useState(null); // GPS prefetch when camera opens
  const [facingMode, setFacingMode] = useState('user');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Photo lightbox viewer
  const [viewerPhoto, setViewerPhoto] = useState(null); // { url, name, time }

  // UI state
  const [loading, setLoading] = useState(false);
  const initialTab = availableTabs.length > 0 ? availableTabs[0].id : 'general';
  const [checkinType, setCheckinType] = useState(initialTab);
  const [maThreshold, setMaThreshold] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false); // user editing their own photo
  const [adminEditRecord, setAdminEditRecord] = useState(null); // admin editing time fields
  const [adminEditPhotoRecord, setAdminEditPhotoRecord] = useState(null); // admin editing photo
  const [showManualCheckin, setShowManualCheckin] = useState(false); // admin adding past checkin
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // History state
  const [history, setHistory] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [historyTab, setHistoryTab] = useState('checkin');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [stats, setStats] = useState({ late: 0, ontime: 0 });
  const [filterUserId, setFilterUserId] = useState('ALL');
  const [usersList, setUsersList] = useState([]);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'leave' || tab === 'checkout' || tab === 'checkin') {
      setHistoryTab(tab);
    }
    const uid = searchParams.get('userId');
    if (isAdmin && uid) {
      setFilterUserId(uid);
    }
  }, [searchParams, isAdmin]);

  // Admin date/month filter (default: today)
  const [filterMode, setFilterMode] = useState('day'); // 'day' | 'month' | 'all'
  const [filterDate, setFilterDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const monthOptions = useMemo(() => {
    const opts = [];
    const d = new Date();
    for (let i = 0; i < 24; i++) {
      const y = d.getFullYear();
      const m = d.getMonth();
      opts.push({ value: `${y}-${String(m + 1).padStart(2, '0')}`, label: `${THAI_MONTHS[m]} ${y + 543}` });
      d.setMonth(m - 1);
    }
    return opts;
  }, []);

  // ── Data Fetch ───────────────────────────────────────────────
  const fetchHistory = useCallback(() => {
    setLoadingHistory(true);
    let timeQ = '';
    if (isAdmin) {
      if (filterMode === 'day' && filterDate) timeQ = `&date=${filterDate}`;
      else if (filterMode === 'month' && filterMonth) timeQ = `&month=${filterMonth}`;
    }
    // Separate KPI / history by check-in role so multi-role users don't mix office + MA
    const typeQ = checkinType ? `&checkin_type=${checkinType}` : '';
    const q = isAdmin ? `?limit=50&userId=${filterUserId}${timeQ}${typeQ}` : `?limit=30${typeQ}`;
    Promise.all([
      api.get(`/checkin/history${q}`),
      api.get(`/checkin/leaves${isAdmin ? `?limit=50&userId=${filterUserId}${timeQ}` : '?limit=30'}`),
    ])
      .then(([histRes, leaveRes]) => {
        setHistory(histRes.data);
        setLeaves(leaveRes.data);
      })
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
    const sq = isAdmin ? `?userId=${filterUserId}${timeQ}${typeQ}` : `?${typeQ.slice(1)}`;
    api.get(`/checkin/stats${sq}`).then(res => setStats(res.data)).catch(console.error);
  }, [isAdmin, filterUserId, filterMode, filterDate, filterMonth, checkinType]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleExportMonthly = async () => {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    let viewYear = curYear;
    let selYear = curYear;
    let selMonth = curMonth;

    const { value: monthValue } = await Swal.fire({
      title: 'Export รายงานเช็คอิน',
      html: `
        <div style="text-align:left;">
          <p style="margin:0 0 14px;font-size:13px;color:#6B7280;">เลือกเดือนที่ต้องการดาวน์โหลดเป็นไฟล์ Excel</p>
          <div class="month-picker">
            <div class="month-picker-head">
              <button type="button" id="mpPrev" class="month-picker-nav" aria-label="ปีก่อนหน้า">‹</button>
              <span id="mpYear" class="month-picker-year"></span>
              <button type="button" id="mpNext" class="month-picker-nav" aria-label="ปีถัดไป">›</button>
            </div>
            <div id="mpGrid" class="month-picker-grid"></div>
            <div id="mpSelected" class="month-picker-selected"></div>
          </div>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: '📥 Export (Excel)',
      confirmButtonColor: '#A3E635',
      cancelButtonText: 'ยกเลิก',
      customClass: { confirmButton: 'swal2-confirm-brand' },
      didOpen: () => {
        const yearEl = document.getElementById('mpYear');
        const gridEl = document.getElementById('mpGrid');
        const selectedEl = document.getElementById('mpSelected');
        const prevBtn = document.getElementById('mpPrev');
        const nextBtn = document.getElementById('mpNext');

        const render = () => {
          yearEl.textContent = `พ.ศ. ${viewYear + 543}`;
          nextBtn.disabled = viewYear >= curYear;
          gridEl.innerHTML = THAI_MONTHS_SHORT.map((m, i) => {
            const disabled = viewYear === curYear && i > curMonth;
            const selected = viewYear === selYear && i === selMonth;
            return `<button type="button" class="month-picker-cell${selected ? ' selected' : ''}" data-month="${i}" ${disabled ? 'disabled' : ''}>${m}</button>`;
          }).join('');
          selectedEl.textContent = `เดือนที่เลือก: ${THAI_MONTHS[selMonth]} ${selYear + 543}`;
          gridEl.querySelectorAll('.month-picker-cell').forEach((btn) => {
            btn.addEventListener('click', () => {
              selMonth = Number(btn.dataset.month);
              selYear = viewYear;
              render();
            });
          });
        };

        prevBtn.addEventListener('click', () => { viewYear -= 1; render(); });
        nextBtn.addEventListener('click', () => { if (viewYear < curYear) { viewYear += 1; render(); } });
        render();
      },
      preConfirm: () => `${selYear}-${String(selMonth + 1).padStart(2, '0')}`
    });

    if (monthValue) {
      try {
        Swal.fire({ title: 'กำลังโหลดข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const res = await api.get(`/checkin/export-monthly?month=${monthValue}`);
        await generateCheckinExcel(res.data, monthValue);
        Swal.close();
      } catch (err) {
        Swal.fire('ผิดพลาด', 'ไม่สามารถดาวน์โหลดข้อมูลได้', 'error');
      }
    }
  };
  useEffect(() => {
    if (checkinType === 'ma') {
      api.get('/checkin/ma-threshold')
        .then(res => setMaThreshold(res.data.threshold ? res.data.threshold.slice(0, 5) : null))
        .catch(console.error);
    }
  }, [checkinType]);
  useEffect(() => {
    if (isAdmin) {
      api.get('/users').then(res => setUsersList(res.data)).catch(console.error);
    }
  }, [isAdmin]);
  useEffect(() => () => { if (stream) stream.getTracks().forEach(t => t.stop()); }, [stream]);
  useEffect(() => {
    if (isCameraOn && videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [isCameraOn, stream]);

  // ── Camera ───────────────────────────────────────────────────
  const prefetchGPS = useCallback(() => {
    setPreloadedCoords(null);
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setPreloadedCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPreloadedCoords({ lat: 0, lng: 0 }),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  const startCamera = useCallback(async (facing = facingMode) => {
    if (stream) stream.getTracks().forEach(t => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 960 } }
      });
      setStream(s);
      setIsCameraOn(true);
      prefetchGPS(); // start GPS fetch in parallel
    } catch (err) {
      console.error('Camera error:', err);
      Swal.fire({ icon: 'error', title: 'ไม่สามารถเข้าถึงกล้องได้', text: 'กรุณาอนุญาตให้สิทธิ์การใช้งานกล้อง', confirmButtonColor: '#185FA5' });
    }
  }, [stream, facingMode, prefetchGPS]);

  const flipCamera = async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newFacing);
    await startCamera(newFacing);
  };

  const resolveAddress = async (lat, lng) => {
    if (!lat && !lng) return '';
    try {
      const res = await api.get('/checkin/reverse-geocode', { params: { lat, lng } });
      return res.data?.detail || res.data?.display || '';
    } catch (err) {
      console.warn('Reverse geocode failed:', err);
      return '';
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true);

    // 1. Get coords (use prefetch, or fetch now if null)
    let finalCoords = preloadedCoords;
    if (!finalCoords) {
      try {
        finalCoords = await new Promise((resolve, reject) => {
          if (!navigator.geolocation) return reject('No geolocation available');
          navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            err => reject(err),
            { enableHighAccuracy: true, timeout: 8000 }
          );
        });
        setPreloadedCoords(finalCoords);
      } catch (err) {
        console.warn('GPS fetch failed during capture:', err);
        finalCoords = { lat: 0, lng: 0 };
      }
    }

    // 2. Reverse geocode + load logo in parallel
    const siteName = branding?.website_name || 'Bount';
    const logoUrl = branding?.website_logo ? getImageUrl(branding.website_logo, 'branding') : null;
    const [addressText, logoImg] = await Promise.all([
      resolveAddress(finalCoords?.lat, finalCoords?.lng),
      loadImageForCanvas(logoUrl),
    ]);
    setLocationLabel(addressText);

    // 3. Draw image to canvas
    const video = videoRef.current;
    const w = video.videoWidth;
    const h = video.videoHeight;
    canvasRef.current.width = w;
    canvasRef.current.height = h;
    const ctx = canvasRef.current.getContext('2d');

    // Flip horizontally for front camera so saved image is NOT mirrored
    if (facingMode === 'user') {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, w, h);

    // 4. Draw watermark WITH logo, site name, coords, address
    drawCheckinWatermark(ctx, {
      width: w,
      height: h,
      lat: finalCoords?.lat,
      lng: finalCoords?.lng,
      address: addressText,
      siteName,
      logoImg,
      mirrorFix: facingMode === 'user',
    });

    // 5. Save and cleanup
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.88);
    setPhoto(dataUrl);
    setCoords(finalCoords);
    setLoading(false);

    // Stop camera after capture
    if (stream) stream.getTracks().forEach(t => t.stop());
    setStream(null);
    setIsCameraOn(false);
  };

  const retakePhoto = () => {
    setPhoto(null);
    setCoords(null);
    setLocationLabel('');
  };
  const cancelAll = () => {
    setPhoto(null);
    setCoords(null);
    setLocationLabel('');
    setIsEditMode(false);
    setAdminEditPhotoRecord(null);
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setIsCameraOn(false);
  };

  const handleImageFallback = (e) => {
    if (!e.target.dataset.retried) {
      e.target.dataset.retried = 'true';
      if (e.target.src.includes('/api/uploads/')) {
        e.target.src = e.target.src.replace('/api/uploads/', '/uploads/');
      } else if (e.target.src.includes('/uploads/')) {
        e.target.src = e.target.src.replace('/uploads/', '/api/uploads/');
      }
    }
  };

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async (type) => {
    if (!photo) return Swal.fire({ icon: 'warning', title: 'กรุณาถ่ายรูปก่อน' });
    if (!coords) return Swal.fire({ icon: 'info', title: 'กำลังดึง GPS กรุณารอสักครู่...' });
    setLoading(true);
    try {
      const blob = dataURItoBlob(photo);
      const fd = new FormData();
      fd.append('image', blob, `photo_${Date.now()}.jpg`);
      fd.append('lat', coords.lat);
      fd.append('lng', coords.lng);
      fd.append('type', adminEditPhotoRecord?.isCheckout ? 'checkout' : checkinType);
      const opts = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (adminEditPhotoRecord) {
        // Admin editing someone's photo
        await api.put(`/checkin/admin/edit-photo/${adminEditPhotoRecord.id}`, fd, opts);
        Swal.fire({ icon: 'success', title: 'อัปเดตรูปภาพสำเร็จ', showConfirmButton: false, timer: 1800 });
        setAdminEditPhotoRecord(null);
      } else if (isEditMode) {
        // User editing own photo — lock original time
        await api.put('/checkin/edit', fd, opts);
        Swal.fire({ icon: 'success', title: 'แก้ไขรูปสำเร็จ', text: 'เวลาเช็คอินเดิมถูกยึดไว้แล้ว', showConfirmButton: false, timer: 1800 });
        setIsEditMode(false);
      } else if (type === 'checkin') {
        await api.post('/checkin', fd, opts);
        Swal.fire({ icon: 'success', title: '✅ เข้างานสำเร็จ', showConfirmButton: false, timer: 1500 });
      } else {
        await api.put('/checkin/checkout', fd, opts);
        Swal.fire({ icon: 'success', title: '🏁 เลิกงานสำเร็จ', showConfirmButton: false, timer: 1500 });
      }
      cancelAll();
      fetchHistory();
    } catch (err) {
      if (err.response?.status === 409 && type === 'checkin') {
        Swal.fire({ icon: 'info', title: 'เช็คอินแล้วในวันนี้', text: 'ไม่สามารถเช็คอินซ้ำได้ต่อ 1 วัน', confirmButtonColor: '#185FA5' });
      } else {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ลองใหม่อีกครั้ง', confirmButtonColor: '#185FA5' });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Admin Photo Upload ───────────────────────────────────────
  const handleAdminPhotoUpload = async (e, record, tab) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('type', tab); // 'checkin' or 'checkout'

      await api.put(`/checkin/admin/edit-photo/${record.id}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      Swal.fire({ icon: 'success', title: 'อัปเดตรูปภาพสำเร็จ', showConfirmButton: false, timer: 1500 });
      fetchHistory();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'อัปเดตไม่สำเร็จ', text: err.response?.data?.error });
    }
  };

  // ── Admin Actions ─────────────────────────────────────────────
  const handleAdminDelete = async (id) => {
    const result = await Swal.fire({
      title: 'ยืนยันการลบ?',
      text: 'การกระทำนี้ไม่สามารถย้อนกลับได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'ลบเลย',
      cancelButtonText: 'ยกเลิก'
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/checkin/${id}`);
      Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', showConfirmButton: false, timer: 1500 });
      fetchHistory();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err.response?.data?.error });
    }
  };

  const handleAdminEditSave = async (e) => {
    e.preventDefault();
    try {
      // แปลงรูปแบบวันที่แบบเงียบๆ ก่อนส่งหลังบ้าน
      const payload = { ...adminEditRecord };
      const formatToMySQL = (val) => {
        if (!val) return null;
        const safeStr = typeof val === 'string' ? val.replace(' ', 'T') : val;
        const d = new Date(safeStr);
        return isNaN(d.getTime()) ? null : format(d, 'yyyy-MM-dd HH:mm:ss');
      };
      
      payload.checkin_time = formatToMySQL(payload.checkin_time);
      payload.checkout_time = formatToMySQL(payload.checkout_time);

      await api.put(`/checkin/admin/edit/${adminEditRecord.id}`, payload);
      
      // Upload new checkin image if provided
      if (adminEditRecord.newCheckinImg) {
        const fd = new FormData();
        fd.append('image', adminEditRecord.newCheckinImg);
        fd.append('type', 'checkin');
        await api.put(`/checkin/admin/edit-photo/${adminEditRecord.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }
      
      // Upload new checkout image if provided
      if (adminEditRecord.newCheckoutImg) {
        const fd = new FormData();
        fd.append('image', adminEditRecord.newCheckoutImg);
        fd.append('type', 'checkout');
        await api.put(`/checkin/admin/edit-photo/${adminEditRecord.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      }

      Swal.fire({ icon: 'success', title: 'บันทึกสำเร็จ', showConfirmButton: false, timer: 1500 });
      setAdminEditRecord(null);
      fetchHistory();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถบันทึกข้อมูลได้' });
    }
  };

  // Today's checkin check
  const todayCheckin = history.find(r => new Date(r.checkin_time).toDateString() === new Date().toDateString());
  const alreadyCheckedInToday = !!todayCheckin;
  const canEditToday = !isAdmin && alreadyCheckedInToday && !isEditMode;
  
  const checkedInRole = todayCheckin?.checkin_type;
  const showRoleAlert = alreadyCheckedInToday && checkedInRole && checkedInRole !== checkinType && !isAdmin;
  const roleNameMap = { general: 'ช่างติดตั้ง', ma: 'ทีม MA', sales: 'เซลส์' };

  const todayStr = new Date().toISOString().slice(0, 10);
  const myTodayLeave = leaves.find(l => {
    const d = (l.leave_date || '').slice(0, 10);
    if (d !== todayStr) return false;
    if (l.user_id != null) return Number(l.user_id) === Number(user?.id);
    return true;
  });
  const showLeaveAlert = !!myTodayLeave && !isEditMode && !adminEditPhotoRecord;

  const getLeaveImgUrl = (filename) => {
    if (!filename || filename === 'null') return null;
    let cleanName = filename;
    if (cleanName.includes('/')) cleanName = cleanName.split('/').pop();
    if (cleanName.includes('\\')) cleanName = cleanName.split('\\').pop();
    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '/api';
    return `${baseUrl}/uploads/leaves/${cleanName}`;
  };

  return (
    <Layout activeKey="checkin" pageTitle="บันทึกเวลาเข้า-ออกงาน">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">

        {/* ── Left: Camera Panel ─────────────────────────── */}
        <div className="lg:col-span-7 flex flex-col gap-5">

          {/* Type Tabs */}
          {availableTabs.length > 1 && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex p-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl shadow-sm flex-1">
                {availableTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setCheckinType(tab.id);
                      cancelAll(); // Reset camera when switching tabs
                    }}
                    className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                      checkinType === tab.id
                        ? 'bg-[#1F2937] text-[#A3E635] shadow-md'
                        : 'text-[#6B7280] hover:bg-white hover:text-[#1F2937]'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
              {isAdmin && checkinType === 'ma' && (
                <button
                  onClick={() => navigate('/ma-performance')}
                  className="bg-[#1F2937] hover:bg-[#374151] text-[#A3E635] text-sm font-bold py-2.5 px-5 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center gap-2">
                  📊 ดูสรุปผล MA
                </button>
              )}
            </div>
          )}

          {/* Leave request button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowLeaveModal(true)}
              className="text-sm font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 border border-orange-200 px-5 py-2.5 rounded-2xl shadow-sm transition-all active:scale-95 flex items-center gap-2"
            >
              📝 แจ้งลางาน
            </button>
          </div>

          {/* MA threshold notice */}
          {checkinType === 'ma' && (
            <div className={`p-4 rounded-2xl border flex gap-3 items-start shadow-sm ${
              maThreshold ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-xl shrink-0">{maThreshold ? '⏰' : '💤'}</span>
              <div>
                <p className={`font-bold text-sm ${maThreshold ? 'text-amber-800' : 'text-slate-700'}`}>
                  {maThreshold ? `งานแรกวันนี้: ${String(maThreshold).slice(0, 5)} น.` : 'ยังไม่มีงาน MA วันนี้'}
                </p>
                <p className={`text-xs mt-0.5 ${maThreshold ? 'text-amber-700' : 'text-slate-500'}`}>
                  {maThreshold
                    ? `เช็คอินก่อนหรือตรง ${String(maThreshold).slice(0, 5)} น. = ไม่สาย · หลังเวลานี้ = มาสาย`
                    : 'คุณไม่สามารถเช็คอินได้จนกว่าจะได้รับมอบหมายงาน'}
                </p>
              </div>
            </div>
          )}

          {/* Camera Card */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-all">
            {/* Card header */}
            <div className="px-6 py-5 border-b border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between">
              <h2 className="font-black text-[#1F2937] flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#1F2937] flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                </div>
                {isEditMode ? 'แก้ไขรูปเช็คอิน' : adminEditPhotoRecord ? 'แอดมิน: แก้ไขรูป' : 'ถ่ายรูปบันทึกเวลา'}
              </h2>
              {isEditMode && (
                <span className="text-xs font-bold text-[#D97706] bg-[#FEF3C7] border border-[#FDE68A] px-3 py-1 rounded-full shadow-sm">
                  ✏️ โหมดแก้ไขรูป
                </span>
              )}
            </div>

            <div className="p-6">
              {showLeaveAlert ? (
                <div className="flex flex-col items-center justify-center p-10 text-center bg-orange-50 rounded-3xl border border-orange-200">
                  <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-3xl mb-4">
                    🏖️
                  </div>
                  <h3 className="text-xl font-bold text-orange-900 mb-2">
                    วันนี้คุณได้แจ้งลาแล้ว
                  </h3>
                  <p className="text-orange-800 mb-2 text-sm">
                    {myTodayLeave?.reason || 'ไม่ได้ระบุสาเหตุ'}
                  </p>
                  <p className="text-orange-700/80 text-xs">
                    ไม่สามารถเช็คอินหรือเช็คเอาท์ในวันที่ลาได้
                  </p>
                </div>
              ) : showRoleAlert ? (
                <div className="flex flex-col items-center justify-center p-10 text-center bg-slate-50 rounded-3xl border border-slate-200">
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-3xl mb-4">
                    ℹ️
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">
                    เช็คอินในบทบาทอื่นแล้ว
                  </h3>
                  <p className="text-slate-600 mb-6">
                    วันนี้คุณได้ทำการบันทึกเวลาเข้างานในบทบาท <strong className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded">{roleNameMap[checkedInRole] || checkedInRole}</strong> ไปเรียบร้อยแล้ว<br/>คุณไม่จำเป็นต้องเช็คอินซ้ำอีก
                  </p>
                  <button 
                    onClick={() => setCheckinType(checkedInRole)}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-6 rounded-xl transition-colors shadow-md shadow-blue-500/20 active:scale-95">
                    กลับไปหน้าเช็คอิน {roleNameMap[checkedInRole] || checkedInRole}
                  </button>
                </div>
              ) : (
                <>
                  {/* Viewfinder */}
                  <div className="relative w-full aspect-[3/4] sm:aspect-[4/3] md:aspect-[4/3] rounded-3xl overflow-hidden bg-[#1F2937] shadow-inner mb-6 transition-all duration-300">
                    {!isCameraOn && !photo ? (
                      /* Idle state */
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 p-6 animate-fade-in">
                        <div className="w-24 h-24 rounded-full bg-[#374151] border-4 border-[#4B5563] flex items-center justify-center shadow-inner">
                          <svg className="w-10 h-10 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                        </div>
                        <div className="text-center">
                          <p className="text-white font-bold text-lg mb-1">กล้องยังไม่เปิด</p>
                          <p className="text-[#9CA3AF] text-sm">กดปุ่มด้านล่างเพื่ออนุญาตการใช้งานกล้อง</p>
                        </div>
                        <button
                          onClick={() => startCamera()}
                          className="bg-[#A3E635] hover:bg-[#84CC16] text-[#1F2937] font-black py-3.5 px-8 rounded-2xl shadow-[0_4px_20px_rgba(163,230,53,0.3)] transition-all active:scale-95 text-base flex items-center gap-2">
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                          เปิดกล้องเลย
                        </button>
                      </div>
                    ) : isCameraOn && !photo ? (
                      /* Live camera — mirror preview for front camera only in the display */
                      <>
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                        />
                        {/* Overlay controls */}
                        <div className="absolute inset-0 pointer-events-none">
                          <div className="absolute inset-0 border-2 border-white/10 rounded-2xl" />
                          {/* Corner guides */}
                          <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-white/60 rounded-tl-lg" />
                          <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-white/60 rounded-tr-lg" />
                          <div className="absolute bottom-20 left-4 w-8 h-8 border-b-2 border-l-2 border-white/60 rounded-bl-lg" />
                          <div className="absolute bottom-20 right-4 w-8 h-8 border-b-2 border-r-2 border-white/60 rounded-br-lg" />
                        </div>
                        {/* Flip + Capture */}
                        <div className="absolute bottom-5 left-0 right-0 flex justify-center items-center gap-6 pointer-events-auto">
                          <button
                            onClick={flipCamera}
                            className="w-11 h-11 rounded-full bg-white/20 border border-white/30 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors active:scale-95">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                          </button>
                          <button
                            onClick={handleCapture}
                            disabled={loading}
                            className={`w-16 h-16 rounded-full border-4 border-white ${loading ? 'bg-slate-300' : 'bg-[#A3E635] hover:bg-[#84CC16] hover:scale-105'} shadow-[0_4px_20px_rgba(163,230,53,0.4)] transition-all flex items-center justify-center`}>
                            {loading && <span className="text-xl animate-spin">⏳</span>}
                          </button>
                          <div className="w-11 h-11" /> {/* spacer */}
                        </div>
                        {loading && (
                          <div className="absolute inset-0 bg-[#1F2937]/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 pointer-events-none">
                            <div className="w-10 h-10 border-[3px] border-[#A3E635]/30 border-t-[#A3E635] rounded-full animate-spin" />
                            <p className="text-white text-sm font-bold">กำลังบันทึกตำแหน่งและที่อยู่...</p>
                          </div>
                        )}
                        {/* Label */}
                        <div className="absolute top-4 left-0 right-0 flex justify-center">
                          <span className="text-white/80 text-xs font-medium bg-black/30 px-3 py-1 rounded-full backdrop-blur-sm">
                            {facingMode === 'user' ? '📷 กล้องหน้า' : '📷 กล้องหลัง'}
                          </span>
                        </div>
                      </>
                    ) : (
                      /* Photo preview */
                      <>
                        <img src={photo} alt="ถ่ายแล้ว" className="w-full h-full object-cover" />
                        {coords && (
                          <div className="absolute top-3 left-3 right-3 overflow-hidden rounded-2xl border border-[#374151] shadow-lg">
                            <div className="h-1 bg-[#A3E635]" />
                            <div className="bg-[#1F2937]/92 backdrop-blur-md p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                {branding?.website_logo ? (
                                  <img
                                    src={getImageUrl(branding.website_logo, 'branding')}
                                    alt=""
                                    className="w-7 h-7 rounded-lg bg-white object-contain p-0.5 border border-[#E5E7EB]"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-lg bg-[#374151] flex items-center justify-center text-[#A3E635] text-xs font-black">
                                    {(branding?.website_name || 'B').charAt(0)}
                                  </div>
                                )}
                                <p className="text-xs font-black text-white truncate flex-1">
                                  {branding?.website_name || 'Bount'}
                                </p>
                                <span className="text-[9px] font-bold text-[#1F2937] bg-[#A3E635] px-2 py-0.5 rounded-full shrink-0">
                                  GPS
                                </span>
                              </div>
                              <p className="text-[11px] font-mono text-[#A3E635] font-bold leading-tight">
                                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
                              </p>
                              {locationLabel ? (
                                <p className="text-[11px] text-[#F9FAFB] font-medium leading-snug line-clamp-3 border-t border-[#374151] pt-2">
                                  📍 {locationLabel}
                                </p>
                              ) : (
                                <p className="text-[11px] text-[#9CA3AF] border-t border-[#374151] pt-2">กำลังค้นหาที่อยู่...</p>
                              )}
                            </div>
                          </div>
                        )}
                        {!coords && (
                          <div className="absolute top-3 left-3 right-3 overflow-hidden rounded-2xl border border-[#374151] shadow-lg">
                            <div className="h-1 bg-[#A3E635]" />
                            <div className="bg-[#1F2937]/92 backdrop-blur-md p-3 flex items-center gap-3">
                              <div className="w-5 h-5 border-2 border-[#A3E635]/30 border-t-[#A3E635] rounded-full animate-spin shrink-0" />
                              <p className="text-xs text-[#F9FAFB] font-bold">กำลังดึงข้อมูล GPS...</p>
                            </div>
                          </div>
                        )}
                        <div className="absolute top-2 right-2 bg-[#A3E635] text-[#1F2937] text-[10px] font-black px-2.5 py-1 rounded-full shadow-[0_4px_12px_rgba(163,230,53,0.35)]">
                          ✅ พร้อมส่ง
                        </div>
                      </>
                    )}
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                  </div>

                  {/* Action Buttons */}
                  {!photo && !isCameraOn && (
                    <p className="text-center text-sm text-slate-400 pb-2">เปิดกล้องเพื่อเริ่มบันทึกเวลา</p>
                  )}

                  {photo && (
                    <div className="space-y-4 mt-6 animate-[fadeInUp_0.3s_ease-out]">
                      {/* Retake */}
                      <button
                        onClick={retakePhoto}
                        className="w-full h-12 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-[#4B5563] font-bold hover:bg-[#F3F4F6] hover:text-[#1F2937] hover:border-[#A3E635] transition-all flex items-center justify-center gap-2 text-sm shadow-sm active:scale-95">
                        🔄 ถ่ายรูปใหม่
                      </button>

                      {/* Main action buttons */}
                      {adminEditPhotoRecord ? (
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={cancelAll} className="h-13 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm py-3">
                            ยกเลิก
                          </button>
                          <button
                            onClick={() => handleSubmit('admin-photo')}
                            disabled={loading || !coords}
                            className="h-13 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all text-sm py-3 disabled:opacity-50">
                            {loading ? '⏳ กำลังอัปเดต...' : '💾 บันทึกรูปใหม่'}
                          </button>
                        </div>
                      ) : isEditMode ? (
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={cancelAll} className="h-13 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors text-sm py-3">
                            ยกเลิก
                          </button>
                          <button
                            onClick={() => handleSubmit('edit')}
                            disabled={loading || !coords}
                            className="h-13 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white font-bold shadow-md shadow-amber-500/20 active:scale-[0.98] transition-all text-sm py-3 disabled:opacity-50">
                            {loading ? '⏳ กำลังบันทึก...' : '✏️ ยืนยันแก้ไขรูป'}
                          </button>
                        </div>
                      ) : (
                        <div className="grid gap-3 grid-cols-2">
                          <button
                            onClick={() => handleSubmit('checkin')}
                            disabled={loading || !coords}
                            className="rounded-xl bg-[#A3E635] hover:bg-[#84CC16] text-[#1F2937] font-black shadow-[0_4px_15px_rgba(163,230,53,0.3)] active:scale-95 transition-all py-3.5 text-base disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? '⏳' : '✅'} เข้างาน
                          </button>
                          <button
                            onClick={() => handleSubmit('checkout')}
                            disabled={loading || !coords}
                            className="rounded-xl bg-[#1F2937] hover:bg-[#374151] text-white font-bold shadow-[0_4px_15px_rgba(0,0,0,0.1)] active:scale-95 transition-all py-3.5 text-base disabled:opacity-50 flex items-center justify-center gap-2">
                            {loading ? '⏳' : '🏁'} เลิกงาน
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: History Panel ────────────────────────── */}
        <div className="lg:col-span-5 flex flex-col gap-4">

          {/* Admin period filter */}
          {isAdmin && (
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-4 shadow-[0_4px_20px_rgb(0,0,0,0.02)]">
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#1F2937] flex items-center justify-center shadow-sm shrink-0">
                    <svg className="w-3.5 h-3.5 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                    </svg>
                  </div>
                  <span className="text-sm font-black text-[#1F2937]">ช่วงเวลาที่แสดง</span>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#A3E635]/15 border border-[#A3E635]/40 text-[11px] font-black text-[#4D7C0F]">
                  📅 {filterMode === 'day'
                    ? toThaiDateLabel(filterDate)
                    : filterMode === 'month'
                      ? (monthOptions.find((o) => o.value === filterMonth)?.label || filterMonth)
                      : 'ทุกช่วงเวลา'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex p-1 bg-[#F3F4F6] rounded-xl shrink-0">
                  {[
                    { id: 'day', label: 'รายวัน' },
                    { id: 'month', label: 'รายเดือน' },
                    { id: 'all', label: 'ทั้งหมด' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setFilterMode(m.id)}
                      className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        filterMode === m.id ? 'bg-white shadow-sm text-[#1F2937]' : 'text-[#6B7280] hover:text-[#4B5563]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  {filterMode === 'day' && (
                    <AppDateField
                      label=""
                      value={filterDate}
                      onChange={(v) => setFilterDate(v || new Date().toISOString().slice(0, 10))}
                      max={new Date().toISOString().slice(0, 10)}
                      allowClear={false}
                    />
                  )}
                  {filterMode === 'month' && (
                    <AppSelectField
                      label=""
                      value={filterMonth}
                      onChange={(v) => setFilterMonth(v || new Date().toISOString().slice(0, 7))}
                      options={monthOptions}
                      placeholder="เลือกเดือน"
                      allowClear={false}
                    />
                  )}
                  {filterMode === 'all' && (
                    <div className="h-full min-h-[42px] flex items-center px-4 rounded-xl bg-[#F9FAFB] border border-dashed border-[#E5E7EB] text-xs font-bold text-[#9CA3AF]">
                      แสดงข้อมูลทุกช่วงเวลา
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 flex items-center gap-4 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all">
              <div className="w-14 h-14 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center text-2xl shadow-sm shrink-0">✅</div>
              <div>
                <p className="text-xs text-[#6B7280] font-bold uppercase tracking-wider mb-1">มาตรงเวลา</p>
                <p className="text-3xl font-black text-[#1F2937]">{stats.ontime} <span className="text-sm font-bold text-[#9CA3AF]">รอบ</span></p>
              </div>
            </div>
            <div className="bg-white rounded-3xl border border-[#E5E7EB] p-5 flex items-center gap-4 shadow-[0_4px_20px_rgb(0,0,0,0.02)] transition-all">
              <div className="w-14 h-14 rounded-2xl bg-[#FFF7ED] border border-[#FFEDD5] flex items-center justify-center text-2xl shadow-sm shrink-0">⚠️</div>
              <div>
                <p className="text-xs text-[#EA580C] font-bold uppercase tracking-wider mb-1">มาสาย</p>
                <p className="text-3xl font-black text-[#1F2937]">{stats.late} <span className="text-sm font-bold text-[#9CA3AF]">รอบ</span></p>
              </div>
            </div>
          </div>

          {/* History Card */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col transition-all" style={{ minHeight: '520px', maxHeight: '680px' }}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#F3F4F6] bg-[#F9FAFB] flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0">
              <h3 className="font-black text-[#1F2937] flex items-center gap-3 text-base">
                <div className="w-8 h-8 rounded-lg bg-[#1F2937] flex items-center justify-center shadow-sm">
                  <svg className="w-4 h-4 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                ประวัติการลงเวลา
              </h3>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManualCheckin(true)}
                    className="text-xs font-bold text-[#4B5563] bg-white hover:bg-[#F3F4F6] border border-[#E5E7EB] hover:text-[#1F2937] px-3 py-2 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    เพิ่มย้อนหลัง
                  </button>
                  <button
                    onClick={handleExportMonthly}
                    className="text-xs font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-2 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5">
                    📥 Export
                  </button>
                  <button
                    onClick={() => navigate('/attendance-summary')}
                    className="text-xs font-bold text-[#A3E635] bg-[#1F2937] hover:bg-[#374151] px-3 py-2 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5">
                    📊 ภาพรวม
                  </button>
                  <FilterDropdown value={filterUserId} onChange={setFilterUserId} usersList={usersList} />
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="px-5 pt-4 shrink-0">
              <div className="flex p-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl relative shadow-inner">
                <div
                  className="absolute top-1 bottom-1 w-[calc(33.333%-4px)] bg-white border border-[#E5E7EB] rounded-xl shadow-sm transition-all duration-300 ease-out"
                  style={{ left: historyTab === 'checkout' ? 'calc(33.333% + 2px)' : historyTab === 'leave' ? 'calc(66.666% + 2px)' : '4px' }}
                />
                {[
                  { id: 'checkin', label: '📍 เข้างาน', col: 'text-[#1F2937]' },
                  { id: 'checkout', label: '🏁 เลิกงาน', col: 'text-[#1F2937]' },
                  { id: 'leave', label: '📝 ลางาน', col: 'text-orange-600' },
                ].map(tab => (
                  <button key={tab.id}
                    onClick={() => setHistoryTab(tab.id)}
                    className={`flex-1 py-2.5 text-xs font-bold z-10 transition-colors relative ${historyTab === tab.id ? tab.col : 'text-[#9CA3AF] hover:text-[#4B5563]'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
              {loadingHistory ? (
                [...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)
              ) : historyTab === 'leave' ? (
                leaves.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center text-2xl mb-3">📝</div>
                    <p className="text-slate-500 text-sm font-medium">ยังไม่มีประวัติการลา</p>
                  </div>
                ) : (
                  leaves.map(record => {
                    const leaveImg = getLeaveImgUrl(record.image_path);
                    const leaveDate = (record.leave_date || '').slice(0, 10);
                    return (
                      <div key={`leave-${record.id}`}
                        className="p-4 rounded-2xl border border-orange-100 bg-orange-50/30 hover:border-orange-300 hover:shadow-md transition-all flex items-center gap-4 group">
                        {leaveImg ? (
                          <button
                            onClick={() => setViewerPhoto({ url: leaveImg, name: record.full_name || user?.full_name, time: record.created_at })}
                            className="w-14 h-14 rounded-xl overflow-hidden border-2 border-orange-200 shrink-0 shadow-sm group-hover:border-orange-400 transition-all relative">
                            <img src={leaveImg} onError={handleImageFallback} alt="leave proof" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 bg-orange-100 border border-orange-200">
                            🏖️
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          {isAdmin && record.full_name && (
                            <p className="font-bold text-[#4B5563] text-xs truncate mb-1">{record.full_name}</p>
                          )}
                          <p className="font-black text-[#1F2937] text-base leading-none">
                            {fmtDateFull(leaveDate)}
                          </p>
                          {record.reason && (
                            <p className="text-xs text-[#6B7280] mt-1.5 line-clamp-2">{record.reason}</p>
                          )}
                          <span className="inline-flex items-center gap-1 text-[10px] text-orange-700 font-bold bg-orange-100 border border-orange-200 px-2 py-0.5 rounded-lg mt-1.5">
                            ลางาน
                          </span>
                        </div>
                      </div>
                    );
                  })
                )
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl mb-3">🕒</div>
                  <p className="text-slate-500 text-sm font-medium">ยังไม่มีประวัติการลงเวลา</p>
                </div>
              ) : (
                history.map(record => {
                  const isCheckoutTab = historyTab === 'checkout';
                  if (isCheckoutTab && !record.checkout_time) return null;
                  const time = isCheckoutTab ? record.checkout_time : record.checkin_time;
                  
                  const getImgUrl = (filename) => {
                    if (!filename || filename === 'null' || filename === 'undefined') return null;
                    if (filename.startsWith('http')) return filename;

                    // Extract actual filename in case DB contains absolute/relative paths
                    let cleanName = filename;
                    if (cleanName.includes('/')) cleanName = cleanName.split('/').pop();
                    if (cleanName.includes('\\')) cleanName = cleanName.split('\\').pop();

                    const baseUrl = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') : '/api';
                    
                    if (cleanName.startsWith('checkouts_')) return `${baseUrl}/uploads/checkouts/${cleanName}`;
                    if (cleanName.startsWith('checkins_')) return `${baseUrl}/uploads/checkins/${cleanName}`;
                    return isCheckoutTab ? `${baseUrl}/uploads/checkouts/${cleanName}` : `${baseUrl}/uploads/checkins/${cleanName}`;
                  };
                  const imgUrl = isCheckoutTab ? getImgUrl(record.checkout_image) : getImgUrl(record.image_path);

                  const isToday = new Date(record.checkin_time).toDateString() === new Date().toDateString();
                  const isUserOwn = !isAdmin && record.id === history[0]?.id && isToday && !isCheckoutTab;

                  // Map URL
                  const latField = isCheckoutTab ? record.checkout_lat : record.checkin_lat;
                  const lngField = isCheckoutTab ? record.checkout_lng : record.checkin_lng;
                  const mapUrl = (latField && lngField && (latField !== 0 || lngField !== 0))
                    ? `https://www.google.com/maps?q=${latField},${lngField}`
                    : null;

                  const personName = record.full_name || user?.full_name || '';

                  return (
                    <div key={`${record.id}-${historyTab}`}
                      className="p-4 rounded-2xl border border-[#E5E7EB] bg-white hover:border-[#A3E635] hover:shadow-md transition-all flex items-center gap-4 group">
                      {/* Photo thumbnail — clickable */}
                      {imgUrl ? (
                        <button
                          onClick={() => setViewerPhoto({ url: imgUrl, name: personName, time })}
                          className="w-14 h-14 rounded-xl overflow-hidden border-2 border-[#E5E7EB] shrink-0 shadow-sm group-hover:border-[#A3E635] transition-all relative">
                          <img src={imgUrl} onError={handleImageFallback} alt="selfie" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <svg className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                          </div>
                        </button>
                      ) : (
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0 shadow-sm ${isCheckoutTab ? 'bg-[#F9FAFB] border border-[#E5E7EB] text-[#4B5563]' : 'bg-[#1F2937] text-[#A3E635]'}`}>
                          {isCheckoutTab ? '🏁' : '✅'}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {isAdmin && record.full_name && (
                          <p className="font-bold text-[#4B5563] text-xs truncate mb-1">{record.full_name}</p>
                        )}
                        <p className="font-black text-[#1F2937] text-lg leading-none">{fmtTime(time)}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[11px] font-bold text-[#9CA3AF]">{fmtDate(time)}</span>
                          {/* Map link */}
                          {mapUrl && (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-[#1F2937] bg-[#F3F4F6] hover:bg-[#A3E635] border border-[#E5E7EB] hover:border-[#A3E635] px-2 py-0.5 rounded-lg transition-colors">
                              📍 แผนที่
                            </a>
                          )}
                        </div>
                        {!isCheckoutTab && record.is_edited === 1 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-[#D97706] font-bold bg-[#FEF3C7] border border-[#FDE68A] px-2 py-0.5 rounded-lg mt-1">
                            ✏️ แก้ไขรูป
                          </span>
                        )}
                      </div>

                      {/* Right actions */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {!isCheckoutTab && record.is_late === 1 && (
                          <span className="text-[10px] font-bold text-[#EA580C] bg-[#FFF7ED] border border-[#FFEDD5] px-2 py-1 rounded-full shadow-sm">
                            มาสาย
                          </span>
                        )}
                        {/* User self-edit button (only for today's latest record) */}
                        {isUserOwn && !isEditMode && (
                          <button
                            onClick={() => { setIsEditMode(true); startCamera(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="text-[11px] font-bold text-[#4B5563] bg-[#F9FAFB] hover:bg-[#A3E635] hover:text-[#1F2937] px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:border-[#A3E635] transition-all shadow-sm active:scale-95">
                            ✏️ แก้ไขรูป
                          </button>
                        )}
                        {/* Admin actions */}
                        {isAdmin && (
                          <div className="flex gap-1.5">
                            <label
                              title="อัปโหลดรูปภาพใหม่"
                              className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors flex items-center justify-center text-sm cursor-pointer">
                              📸
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={(e) => handleAdminPhotoUpload(e, record, historyTab)} 
                              />
                            </label>
                            <button
                              onClick={() => setAdminEditRecord({ ...record })}
                              title="แก้ไขเวลา"
                              className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-500 hover:text-white transition-colors flex items-center justify-center text-sm">
                              ✏️
                            </button>
                            <button
                              onClick={() => handleAdminDelete(record.id)}
                              title="ลบ"
                              className="w-8 h-8 rounded-lg bg-red-50 border border-red-200 text-red-500 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center text-sm">
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Photo Viewer Lightbox ────────────────────────── */}
      {viewerPhoto && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4"
          onClick={() => setViewerPhoto(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div>
                {viewerPhoto.name && <p className="text-white font-bold text-sm">{viewerPhoto.name}</p>}
                <p className="text-slate-400 text-xs">{fmtDateFull(viewerPhoto.time)} · {fmtTime(viewerPhoto.time)}</p>
              </div>
              <button
                onClick={() => setViewerPhoto(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors text-lg font-bold">
                ✕
              </button>
            </div>
            {/* Photo */}
            <div className="rounded-2xl overflow-hidden shadow-2xl border border-white/10">
              <img
                src={viewerPhoto.url}
                onError={handleImageFallback}
                alt="Check-in photo"
                className="w-full object-contain max-h-[70vh]"
              />
            </div>
            {/* Hint */}
            <p className="text-center text-slate-500 text-xs mt-3">คลิกด้านนอกหรือ ✕ เพื่อปิด</p>
          </div>
        </div>
      )}

      {/* ── Admin Edit Time Modal ─────────────────────────── */}
      {adminEditRecord && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAdminEditRecord(null)}>
          <div className="modal-sheet relative max-w-sm w-full animate-[slideUp_0.3s_ease-out]">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[#042C53] flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-sm shadow-md">✏️</span>
                แก้ไขข้อมูลเวลา
              </h2>
              <button onClick={() => setAdminEditRecord(null)} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">✕</button>
            </div>

            {/* Person info */}
            <div className="bg-[#E6F1FB] rounded-xl px-4 py-2.5 mb-5 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#185FA5] flex items-center justify-center text-white font-bold text-sm shrink-0">
                {adminEditRecord.full_name?.charAt(0) || '?'}
              </div>
              <div>
                <p className="font-bold text-[#185FA5] text-sm">{adminEditRecord.full_name}</p>
                <p className="text-xs text-[#378ADD]">{fmtDateFull(adminEditRecord.checkin_time)}</p>
              </div>
            </div>

            <form onSubmit={handleAdminEditSave} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">⏰ เวลาเข้างาน</label>
                <DateTimePicker 
                  value={adminEditRecord.checkin_time}
                  onChange={date => setAdminEditRecord({ ...adminEditRecord, checkin_time: date ? date.toISOString() : null })}
                  placeholder="เลือกเวลาเข้างาน"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-[#042C53] mb-1.5">🏁 เวลาเลิกงาน</label>
                <DateTimePicker 
                  value={adminEditRecord.checkout_time}
                  onChange={date => setAdminEditRecord({ ...adminEditRecord, checkout_time: date ? date.toISOString() : null })}
                  placeholder="เลือกเวลาเลิกงาน"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors mt-2">
                <input type="checkbox" id="is_late"
                  checked={adminEditRecord.is_late === 1}
                  onChange={e => setAdminEditRecord({ ...adminEditRecord, is_late: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 accent-orange-500" />
                <span className="text-sm font-bold text-orange-700">บันทึกสถานะ "มาสาย"</span>
              </label>

              {/* New Photo Uploads inside Modal */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div>
                  <label className="block text-xs font-bold text-[#042C53] mb-1">📸 รูปเข้างานใหม่ (ถ้ามี)</label>
                  <label className="flex items-center justify-center w-full h-10 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    <span className="text-xs font-bold text-slate-500 truncate px-3">
                      {adminEditRecord.newCheckinImg ? adminEditRecord.newCheckinImg.name : 'เลือกรูปภาพ...'}
                    </span>
                    <input type="file" className="hidden" accept="image/*"
                      onChange={e => setAdminEditRecord({ ...adminEditRecord, newCheckinImg: e.target.files[0] })} />
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#042C53] mb-1">📸 รูปออกงานใหม่ (ถ้ามี)</label>
                  <label className="flex items-center justify-center w-full h-10 border border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    <span className="text-xs font-bold text-slate-500 truncate px-3">
                      {adminEditRecord.newCheckoutImg ? adminEditRecord.newCheckoutImg.name : 'เลือกรูปภาพ...'}
                    </span>
                    <input type="file" className="hidden" accept="image/*"
                      onChange={e => setAdminEditRecord({ ...adminEditRecord, newCheckoutImg: e.target.files[0] })} />
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setAdminEditRecord(null)} className="flex-1 h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors text-sm">
                  ยกเลิก
                </button>
                <button type="submit" className="flex-1 h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-bold shadow-md active:scale-95 transition-all text-sm">
                  💾 บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Admin Manual Checkin Modal ────────────────────── */}
      {showManualCheckin && (
        <ManualCheckinModal 
          onClose={() => setShowManualCheckin(false)} 
          onSuccess={() => { setShowManualCheckin(false); fetchHistory(); }}
        />
      )}

      <LeaveRequestModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        onSuccess={fetchHistory}
        leaveType={checkinType}
        isAdmin={!!isAdmin}
        usersList={usersList}
      />
    </Layout>
  );
}

// ── Filter Dropdown ───────────────────────────────────────────
function FilterDropdown({ value, onChange, usersList }) {
  const [isOpen, setIsOpen] = useState(false);
  const getLabel = () => {
    if (value === 'ALL') return '👥 ทุกคน';
    if (value === 'ME') return '👤 ของฉัน';
    const u = usersList.find(x => x.id.toString() === value.toString());
    return u ? u.full_name : 'เลือก...';
  };
  return (
    <div className="relative">
      <button type="button" onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-white border rounded-xl text-xs font-bold text-[#185FA5] shadow-sm transition-all ${isOpen ? 'border-[#185FA5] ring-2 ring-[#185FA5]/10' : 'border-slate-200 hover:border-[#185FA5]/40'}`}>
        <span className="max-w-[100px] truncate">{getLabel()}</span>
        <svg className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" /></svg>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-52 bg-white/95 backdrop-blur-xl border border-white/80 rounded-2xl shadow-xl overflow-hidden">
            <div className="p-2 space-y-0.5">
              {[{ id: 'ALL', label: '👥 ทุกคน' }, { id: 'ME', label: '👤 ของฉัน' }].map(opt => (
                <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${value === opt.id ? 'bg-[#E6F1FB] text-[#185FA5]' : 'text-slate-700 hover:bg-slate-50'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
            {usersList.length > 0 && (
              <>
                <div className="px-3 py-1.5 bg-slate-50 border-y border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-widest">รายบุคคล</div>
                <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                  {usersList.map(u => (
                    <button key={u.id} onClick={() => { onChange(u.id); setIsOpen(false); }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors truncate ${value.toString() === u.id.toString() ? 'bg-[#E6F1FB] text-[#185FA5]' : 'text-slate-700 hover:bg-slate-50'}`}>
                      {u.full_name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
