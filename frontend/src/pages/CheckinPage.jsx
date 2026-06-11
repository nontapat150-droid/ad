import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';
import Layout from '../components/Layout';
import ManualCheckinModal from '../components/ManualCheckinModal';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { DateTimePicker } from '../components/DateTimePicker';

// ── Helpers ──────────────────────────────────────────────────
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
  const isAdmin = user && (user.roles?.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(user.role));
  const isMATech = user?.role === 'ma_technician' || user?.roles?.includes('ma_technician');

  // Camera state
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [preloadedCoords, setPreloadedCoords] = useState(null); // GPS prefetch when camera opens
  const [facingMode, setFacingMode] = useState('user');
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Photo lightbox viewer
  const [viewerPhoto, setViewerPhoto] = useState(null); // { url, name, time }

  // UI state
  const [loading, setLoading] = useState(false);
  const [checkinType, setCheckinType] = useState(isMATech ? 'ma' : 'general');
  const [maThreshold, setMaThreshold] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false); // user editing their own photo
  const [adminEditRecord, setAdminEditRecord] = useState(null); // admin editing time fields
  const [adminEditPhotoRecord, setAdminEditPhotoRecord] = useState(null); // admin editing photo
  const [showManualCheckin, setShowManualCheckin] = useState(false); // admin adding past checkin

  // History state
  const [history, setHistory] = useState([]);
  const [historyTab, setHistoryTab] = useState('checkin');
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [stats, setStats] = useState({ late: 0, ontime: 0 });
  const [filterUserId, setFilterUserId] = useState('ALL');
  const [usersList, setUsersList] = useState([]);

  // ── Data Fetch ───────────────────────────────────────────────
  const fetchHistory = useCallback(() => {
    setLoadingHistory(true);
    const q = isAdmin ? `?limit=50&userId=${filterUserId}` : `?limit=30`;
    api.get(`/checkin/history${q}`)
      .then(res => setHistory(res.data))
      .catch(console.error)
      .finally(() => setLoadingHistory(false));
    const sq = isAdmin ? `?userId=${filterUserId}` : '';
    api.get(`/checkin/stats${sq}`).then(res => setStats(res.data)).catch(console.error);
  }, [isAdmin, filterUserId]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
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

  // Draw GPS + timestamp watermark on canvas
  const drawWatermark = (ctx, w, h, lat, lng) => {
    const now = new Date();
    const dateStr = now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const latStr  = lat ? lat.toFixed(6) : '0.000000';
    const lngStr  = lng ? lng.toFixed(6) : '0.000000';

    const barH = Math.round(h * 0.12); // ~12% of height
    const pad  = Math.round(h * 0.014);
    const fontSize = Math.round(h * 0.028);
    const smallFont = Math.round(h * 0.022);

    ctx.save();
    
    // If facing user, the main context was scaled(-1, 1) to un-mirror the photo.
    // We MUST revert that scale/translate just for the watermark text, 
    // otherwise the text will be drawn backwards!
    if (facingMode === 'user') {
      ctx.scale(-1, 1);
      ctx.translate(-w, 0);
    }

    // Semi-transparent dark bar at bottom
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillRect(0, h - barH, w, barH);

    // GPS icon + coords
    ctx.font = `bold ${fontSize}px 'Courier New', monospace`;
    ctx.fillStyle = '#4ADE80'; // green
    ctx.fillText(`📍 ${latStr}, ${lngStr}`, pad, h - barH + pad + fontSize);

    // Date + time
    ctx.font = `${smallFont}px 'Courier New', monospace`;
    ctx.fillStyle = '#93C5FD'; // light blue
    ctx.fillText(`${dateStr}  ${timeStr}`, pad, h - barH + pad + fontSize + smallFont + 4);

    // App name watermark (bottom right)
    ctx.font = `bold ${smallFont}px sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const brand = 'Bount';
    const bw = ctx.measureText(brand).width;
    ctx.fillText(brand, w - bw - pad, h - pad);

    ctx.restore();
  };

  const handleCapture = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setLoading(true); // Show loading UI while fetching GPS

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

    // 2. Draw image to canvas
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

    // 3. Draw watermark WITH coords
    drawWatermark(ctx, w, h, finalCoords?.lat, finalCoords?.lng);

    // 4. Save and cleanup
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
  };
  const cancelAll = () => {
    setPhoto(null);
    setCoords(null);
    setIsEditMode(false);
    setAdminEditPhotoRecord(null);
    if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); }
    setIsCameraOn(false);
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
      fd.append('type', checkinType);
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
      await api.put(`/checkin/admin/edit/${adminEditRecord.id}`, adminEditRecord);
      
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

  return (
    <Layout activeKey="checkin" pageTitle="บันทึกเวลาเข้า-ออกงาน">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12">

        {/* ── Left: Camera Panel ─────────────────────────── */}
        <div className="lg:col-span-7 flex flex-col gap-5">

          {/* Type Tabs */}
          {!isMATech && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex p-1 glass border border-white/50 rounded-2xl shadow-sm flex-1">
                {[
                  { id: 'general', label: 'ทั่วไป', icon: '📝' },
                  { id: 'ma', label: 'ทีม MA', icon: '🛠️' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCheckinType(tab.id)}
                    className={`flex-1 py-2.5 px-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                      checkinType === tab.id
                        ? 'bg-[#185FA5] text-white shadow-md'
                        : 'text-slate-500 hover:bg-white/60'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>
              {isAdmin && checkinType === 'ma' && (
                <button
                  onClick={() => navigate('/ma-performance')}
                  className="bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold py-2.5 px-5 rounded-2xl shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5 active:scale-95 flex items-center gap-2">
                  📊 ดูสรุปผล MA
                </button>
              )}
            </div>
          )}

          {/* MA threshold notice */}
          {checkinType === 'ma' && (
            <div className={`p-4 rounded-2xl border flex gap-3 items-start shadow-sm ${
              maThreshold ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <span className="text-xl shrink-0">{maThreshold ? '⏰' : '💤'}</span>
              <div>
                <p className={`font-bold text-sm ${maThreshold ? 'text-amber-800' : 'text-slate-700'}`}>
                  {maThreshold ? `เวลาเข้างาน MA: ${maThreshold} น.` : 'ยังไม่มีงาน MA วันนี้'}
                </p>
                <p className={`text-xs mt-0.5 ${maThreshold ? 'text-amber-700' : 'text-slate-500'}`}>
                  {maThreshold
                    ? `หากเช็คอินหลัง ${maThreshold} น. จะถือว่ามาสาย`
                    : 'คุณไม่สามารถเช็คอินได้จนกว่าจะได้รับมอบหมายงาน'}
                </p>
              </div>
            </div>
          )}

          {/* Camera Card */}
          <div className="glass rounded-3xl border border-white/50 shadow-sm overflow-hidden">
            {/* Card header */}
            <div className="px-5 py-4 border-b border-white/30 flex items-center justify-between">
              <h2 className="font-bold text-[#042C53] flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] flex items-center justify-center shadow-md">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                </div>
                {isEditMode ? 'แก้ไขรูปเช็คอิน' : adminEditPhotoRecord ? 'แอดมิน: แก้ไขรูป' : 'ถ่ายรูปบันทึกเวลา'}
              </h2>
              {isEditMode && (
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  ✏️ โหมดแก้ไขรูป
                </span>
              )}
            </div>

            <div className="p-5">
              {/* Viewfinder */}
              <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 shadow-inner mb-5">
                {!isCameraOn && !photo ? (
                  /* Idle state */
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
                    <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                      <svg className="w-9 h-9 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z"/></svg>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold text-base mb-1">กล้องยังไม่เปิด</p>
                      <p className="text-slate-400 text-sm">กดปุ่มด้านล่างเพื่อเปิดกล้อง</p>
                    </div>
                    <button
                      onClick={() => startCamera()}
                      className="bg-[#185FA5] hover:bg-[#0C447C] text-white font-bold py-3 px-8 rounded-2xl shadow-lg shadow-[#185FA5]/30 transition-all active:scale-95 text-sm">
                      📷 เปิดกล้อง
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
                        className={`w-16 h-16 rounded-full border-4 border-white ${loading ? 'bg-slate-300' : 'bg-gradient-to-tr from-[#185FA5] to-[#378ADD] hover:scale-105'} shadow-xl transition-all flex items-center justify-center`}>
                        {loading && <span className="text-xl animate-spin">⏳</span>}
                      </button>
                      <div className="w-11 h-11" /> {/* spacer */}
                    </div>
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
                      <div className="absolute top-3 left-3 right-3 bg-slate-900/75 backdrop-blur-md rounded-xl p-2.5 border border-white/20">
                        <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider mb-0.5">📍 พิกัด GPS</p>
                        <p className="text-xs font-mono text-blue-300 font-bold">
                          {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                        </p>
                      </div>
                    )}
                    {!coords && (
                      <div className="absolute top-3 left-3 right-3 bg-amber-900/70 backdrop-blur-md rounded-xl p-2.5 border border-amber-400/30 flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin shrink-0" />
                        <p className="text-xs text-amber-200 font-medium">กำลังดึงข้อมูล GPS...</p>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-md">
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
                <div className="space-y-3 animate-[fadeIn_0.3s_ease-out]">
                  {/* Retake */}
                  <button
                    onClick={retakePhoto}
                    className="w-full h-11 rounded-xl border-2 border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm">
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
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleSubmit('checkin')}
                        disabled={loading || !coords}
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold shadow-md shadow-emerald-500/20 active:scale-[0.98] transition-all py-3.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? '⏳' : '✅'} เข้างาน
                      </button>
                      <button
                        onClick={() => handleSubmit('checkout')}
                        disabled={loading || !coords}
                        className="rounded-xl bg-gradient-to-r from-slate-600 to-slate-800 text-white font-bold shadow-md shadow-slate-700/20 active:scale-[0.98] transition-all py-3.5 text-sm disabled:opacity-50 flex items-center justify-center gap-2">
                        {loading ? '⏳' : '🏁'} เลิกงาน
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: History Panel ────────────────────────── */}
        <div className="lg:col-span-5 flex flex-col gap-4">

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-2xl border border-white/50 p-4 flex items-center gap-3 hover:shadow-md transition-shadow overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-transparent pointer-events-none" />
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20 shrink-0">✅</div>
              <div>
                <p className="text-xs text-slate-500 font-medium">มาตรงเวลา</p>
                <p className="text-2xl font-black text-[#042C53]">{stats.ontime} <span className="text-sm font-normal text-slate-400">รอบ</span></p>
              </div>
            </div>
            <div className="glass rounded-2xl border border-white/50 p-4 flex items-center gap-3 hover:shadow-md transition-shadow overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-50/50 to-transparent pointer-events-none" />
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-xl shadow-lg shadow-orange-500/20 shrink-0">⚠️</div>
              <div>
                <p className="text-xs text-slate-500 font-medium">มาสาย</p>
                <p className="text-2xl font-black text-[#042C53]">{stats.late} <span className="text-sm font-normal text-slate-400">รอบ</span></p>
              </div>
            </div>
          </div>

          {/* History Card */}
          <div className="glass rounded-3xl border border-white/50 shadow-sm overflow-hidden flex flex-col" style={{ minHeight: '520px', maxHeight: '680px' }}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-white/30 flex flex-col sm:flex-row justify-between sm:items-center gap-3 shrink-0">
              <h3 className="font-bold text-[#042C53] flex items-center gap-2 text-sm">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                ประวัติการลงเวลา
              </h3>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowManualCheckin(true)}
                    className="text-xs font-bold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                    เพิ่มย้อนหลัง
                  </button>
                  <button
                    onClick={() => navigate('/attendance-summary')}
                    className="text-xs font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 px-3 py-1.5 rounded-lg shadow-sm transition-all active:scale-95">
                    📊 ภาพรวม
                  </button>
                  <FilterDropdown value={filterUserId} onChange={setFilterUserId} usersList={usersList} />
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="px-4 pt-3 shrink-0">
              <div className="flex p-1 glass rounded-xl relative">
                <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-out ${historyTab === 'checkout' ? 'left-[50%]' : 'left-1'}`} />
                {[
                  { id: 'checkin', label: '📍 เข้างาน', col: 'text-[#185FA5]' },
                  { id: 'checkout', label: '🏁 เลิกงาน', col: 'text-indigo-600' },
                ].map(tab => (
                  <button key={tab.id}
                    onClick={() => setHistoryTab(tab.id)}
                    className={`flex-1 py-2 text-xs font-bold z-10 transition-colors relative ${historyTab === tab.id ? tab.col : 'text-slate-400 hover:text-slate-600'}`}>
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
              {loadingHistory ? (
                [...Array(4)].map((_, i) => <div key={i} className="skeleton h-16 rounded-2xl" />)
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
                  const imgUrl = isCheckoutTab
                    ? (record.checkout_image ? `/uploads/checkouts/${record.checkout_image}` : null)
                    : (record.image_path ? `/uploads/checkins/${record.image_path}` : null);
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
                      className="p-3 rounded-2xl border border-white/40 glass hover:shadow-sm transition-all flex items-center gap-3">
                      {/* Photo thumbnail — clickable */}
                      {imgUrl ? (
                        <button
                          onClick={() => setViewerPhoto({ url: imgUrl, name: personName, time })}
                          className="w-12 h-12 rounded-xl overflow-hidden border-2 border-white/60 shrink-0 shadow-sm hover:ring-2 hover:ring-[#185FA5]/40 transition-all group relative">
                          <img src={imgUrl} alt="selfie" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                            <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" /></svg>
                          </div>
                        </button>
                      ) : (
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 shadow-sm ${isCheckoutTab ? 'bg-slate-100 text-slate-500' : 'bg-[#E6F1FB] text-[#378ADD]'}`}>
                          {isCheckoutTab ? '🏁' : '✅'}
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {isAdmin && record.full_name && (
                          <p className="font-bold text-[#185FA5] text-xs truncate mb-0.5">{record.full_name}</p>
                        )}
                        <p className="font-black text-[#042C53] text-base leading-tight">{fmtTime(time)}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-[11px] text-slate-400">{fmtDate(time)}</span>
                          {/* Map link */}
                          {mapUrl && (
                            <a
                              href={mapUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md hover:bg-emerald-100 transition-colors">
                              🗺️ แผนที่
                            </a>
                          )}
                        </div>
                        {!isCheckoutTab && record.is_edited === 1 && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md mt-0.5">
                            ✏️ มีการแก้ไขรูป
                          </span>
                        )}
                      </div>

                      {/* Right actions */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {!isCheckoutTab && record.is_late === 1 && (
                          <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-full">
                            มาสาย
                          </span>
                        )}
                        {/* User self-edit button (only for today's latest record) */}
                        {isUserOwn && !isEditMode && (
                          <button
                            onClick={() => { setIsEditMode(true); startCamera(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                            className="text-[11px] font-bold text-[#185FA5] bg-[#E6F1FB] hover:bg-[#185FA5] hover:text-white px-2 py-1 rounded-lg border border-[#185FA5]/20 transition-colors">
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
