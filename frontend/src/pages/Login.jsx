import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import Swal from 'sweetalert2';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/imageUtils';
import ManualModal from '../components/ManualModal';

const SAVED_LOGIN_KEY = 'bou_saved_login';

const REGISTER_ROLES = [
  { value: 'technician', label: 'ช่าง Office' },
  { value: 'ma_technician', label: 'ช่าง MA' },
  { value: 'contractor_office', label: 'รับเหมาติดตั้ง' },
  { value: 'contractor_ma', label: 'รับเหมา MA' },
  { value: 'sales', label: 'เซล' },
];

function loadSavedLogin() {
  try {
    const raw = localStorage.getItem(SAVED_LOGIN_KEY);
    if (!raw) return null;
    const json = new TextDecoder().decode(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function saveLogin(username, password) {
  const json = JSON.stringify({ username, password });
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  localStorage.setItem(SAVED_LOGIN_KEY, b64);
}

function clearSavedLogin() {
  localStorage.removeItem(SAVED_LOGIN_KEY);
}

const inputCls =
  'w-full h-12 pl-11 pr-4 rounded-xl text-[#1F2937] placeholder-[#9CA3AF] text-base outline-none bg-white border-[1.5px] border-[#E5E7EB] shadow-sm focus:border-[#A3E635] focus:ring-[3px] focus:ring-[#A3E635]/20 transition-all';

function FieldIcon({ children }) {
  return (
    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B7280]">
      {children}
    </span>
  );
}

export default function Login() {
  const [mode, setMode] = useState('login'); // login | register
  const [form, setForm] = useState({ username: '', password: '' });
  const [reg, setReg] = useState({
    full_name: '',
    username: '',
    password: '',
    confirm: '',
    role: 'technician',
  });
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showRegPass, setShowRegPass] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const { login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  useEffect(() => {
    AOS.refresh();
    const saved = loadSavedLogin();
    if (saved?.username && saved?.password) {
      setForm({ username: saved.username, password: saved.password });
      setRemember(true);
    }
  }, []);

  const brandName = branding?.website_name || 'Bonus';

  const shakeForm = (id) => {
    const formEl = document.getElementById(id);
    if (!formEl) return;
    formEl.classList.remove('animate-[shake_0.4s_ease-in-out]');
    void formEl.offsetWidth;
    formEl.classList.add('animate-[shake_0.4s_ease-in-out]');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password) {
      Swal.fire({
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน',
        icon: 'warning',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#A3E635',
      });
      setIsFailed(true);
      shakeForm('login-form');
      setTimeout(() => setIsFailed(false), 1500);
      return;
    }

    setLoading(true);
    try {
      await login(form.username.trim(), form.password, true);
      if (remember) {
        saveLogin(form.username.trim(), form.password);
      } else {
        clearSavedLogin();
      }
      setSuccess(true);
      Swal.fire({
        title: 'สำเร็จ!',
        text: 'เข้าสู่ระบบเรียบร้อยแล้ว',
        icon: 'success',
        timer: 1200,
        showConfirmButton: false,
      });
      setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    } catch (err) {
      setIsFailed(true);
      let errorMsg = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่';
      if (err.response?.data?.error) errorMsg = err.response.data.error;
      else if (err.response?.status === 503) errorMsg = 'ระบบหลังบ้านกำลังอัปเดต กรุณารอสักครู่แล้วลองใหม่';
      else if (err.message === 'Network Error') errorMsg = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้';

      Swal.fire({
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: errorMsg,
        icon: 'error',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#A32D2D',
      });
      shakeForm('login-form');
      setTimeout(() => setIsFailed(false), 1500);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!reg.full_name.trim() || !reg.username.trim() || !reg.password) {
      Swal.fire({
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณากรอกชื่อ-นามสกุล ชื่อผู้ใช้ และรหัสผ่าน',
        icon: 'warning',
        confirmButtonColor: '#A3E635',
      });
      return;
    }
    if (reg.password !== reg.confirm) {
      Swal.fire({
        title: 'รหัสผ่านไม่ตรงกัน',
        text: 'กรุณายืนยันรหัสผ่านให้ตรงกัน',
        icon: 'warning',
        confirmButtonColor: '#A3E635',
      });
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        full_name: reg.full_name.trim(),
        username: reg.username.trim(),
        password: reg.password,
        role: reg.role,
      });
      await Swal.fire({
        title: 'ลงทะเบียนสำเร็จ',
        text: 'บัญชีของคุณรอผู้ดูแลระบบอนุมัติก่อนเข้าใช้งาน',
        icon: 'success',
        confirmButtonText: 'ไปหน้าเข้าสู่ระบบ',
        confirmButtonColor: '#A3E635',
      });
      setForm({ username: reg.username.trim(), password: '' });
      setMode('login');
      setReg({ full_name: '', username: '', password: '', confirm: '', role: 'technician' });
    } catch (err) {
      Swal.fire({
        title: 'ลงทะเบียนไม่สำเร็จ',
        text: err.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่',
        icon: 'error',
        confirmButtonColor: '#A32D2D',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full flex flex-col md:items-center md:justify-center relative overflow-hidden font-sans bg-[#1F2937]">
      <style>{`
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-box-shadow: 0 0 0 30px #fff inset !important;
          -webkit-text-fill-color: #1F2937 !important;
          transition: background-color 5000s ease-in-out 0s;
        }
        @keyframes floatBlob {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-16px) scale(1.03); }
        }
        @keyframes fadeRise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmerSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .blob-float { animation: floatBlob 8s ease-in-out infinite; }
        .rise-in { animation: fadeRise 0.55s ease-out both; }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: translateX(-100%);
          animation: shimmerSlide 2.2s ease-in-out infinite;
        }
      `}</style>

      {/* Atmosphere */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#0f172a]" />
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-[#A3E635]/15 blur-[90px] blob-float" />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-[#65a30d]/15 blur-[110px] blob-float" style={{ animationDelay: '1.5s' }} />
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{ backgroundImage: 'radial-gradient(circle, #A3E635 1px, transparent 1px)', backgroundSize: '28px 28px' }}
      />

      {/* ── Mobile brand hero (full-bleed) ── */}
      <div className="relative z-10 md:hidden px-6 pt-[max(1.5rem,env(safe-area-inset-top))] pb-8 text-center rise-in">
        <div className="mx-auto w-16 h-16 rounded-2xl overflow-hidden shadow-[0_8px_28px_rgba(163,230,53,0.35)] flex items-center justify-center"
          style={branding?.website_logo ? { background: '#fff' } : { background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
          {branding?.website_logo ? (
            <img src={getImageUrl(branding.website_logo, 'branding')} alt="" className="w-full h-full object-contain p-1.5" />
          ) : (
            <svg className="w-8 h-8 text-[#1F2937]" viewBox="0 0 48 48" fill="none">
              <path d="M24 36a2 2 0 100-4 2 2 0 000 4z" fill="currentColor" />
              <path d="M17.1 29.1a9.9 9.9 0 0113.8 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <path d="M11.3 23.3a17.9 17.9 0 0125.4 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <h1 className="mt-4 text-3xl font-black text-white tracking-tight">{brandName}</h1>
        <p className="mt-1 text-[#A3E635] text-xs font-bold tracking-[0.2em] uppercase">ระบบจัดการงาน</p>
      </div>

      {/* ── Card ── */}
      <div
        className="relative z-10 w-full md:max-w-[920px] md:mx-4 flex-1 md:flex-none flex flex-col md:flex-row md:rounded-3xl overflow-hidden md:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)] rise-in"
        style={{ animationDelay: '0.08s', border: '1px solid rgba(163,230,53,0.1)' }}
        data-aos="fade-up"
        data-aos-duration="700"
      >
        {/* Desktop brand panel */}
        <div
          className="relative hidden md:flex md:w-[40%] flex-col items-center justify-center p-10 overflow-hidden"
          style={{ background: 'linear-gradient(145deg, #111827 0%, #1a2535 55%, #0f1e2e 100%)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#A3E635] to-transparent opacity-80" />
          <div className="absolute w-72 h-72 rounded-full border border-[#A3E635]/10" />
          <div className="relative z-10 flex flex-col items-center text-center space-y-7">
            <div className="w-24 h-24 rounded-[24px] overflow-hidden flex items-center justify-center shadow-[0_8px_32px_rgba(163,230,53,0.35)]"
              style={branding?.website_logo ? { background: '#fff' } : { background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
              {branding?.website_logo ? (
                <img src={getImageUrl(branding.website_logo, 'branding')} alt="" className="w-full h-full object-contain p-2" />
              ) : (
                <svg className="w-12 h-12 text-[#1F2937]" viewBox="0 0 48 48" fill="none">
                  <path d="M24 36a2 2 0 100-4 2 2 0 000 4z" fill="currentColor" />
                  <path d="M17.1 29.1a9.9 9.9 0 0113.8 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                  <path d="M11.3 23.3a17.9 17.9 0 0125.4 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
            </div>
            <div>
              <h1 className="text-4xl font-black text-[#F3F4F6] tracking-tight leading-none">{brandName}</h1>
              <p className="mt-2 text-[#A3E635] text-xs font-bold tracking-[0.22em] uppercase">ระบบจัดการงาน</p>
            </div>
            <div className="w-full space-y-2">
              {['เข้างานได้ทุกที่บนมือถือ', 'จ่ายงานและติดตามผลแบบเรียลไทม์', 'ลงทะเบียนแล้วรออนุมัติได้เลย'].map((label) => (
                <div
                  key={label}
                  className="px-4 py-2.5 rounded-xl text-sm text-[#D1D5DB] text-left"
                  style={{ background: 'rgba(163,230,53,0.06)', border: '1px solid rgba(163,230,53,0.12)' }}
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex-1 flex flex-col bg-[#F3F4F6] rounded-t-[1.75rem] md:rounded-none px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-8 md:p-10">
          {/* Mode tabs */}
          <div className="flex p-1 rounded-2xl bg-[#E5E7EB]/80 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all ${
                mode === 'login' ? 'bg-white text-[#1F2937] shadow-sm' : 'text-[#6B7280]'
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 h-11 rounded-xl text-sm font-bold transition-all ${
                mode === 'register' ? 'bg-white text-[#1F2937] shadow-sm' : 'text-[#6B7280]'
              }`}
            >
              ลงทะเบียนพนักงาน
            </button>
          </div>

          {mode === 'login' ? (
            <>
              <div className="mb-5">
                <h2 className="text-xl sm:text-2xl font-black text-[#1F2937]">ยินดีต้อนรับ</h2>
                <p className="text-[#6B7280] text-sm mt-1">กรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าใช้งาน</p>
              </div>

              <form id="login-form" onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="text-[#374151] text-sm font-semibold mb-1.5 block">ชื่อผู้ใช้งาน</label>
                  <div className="relative">
                    <FieldIcon>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </FieldIcon>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value })}
                      className={inputCls}
                      placeholder="ชื่อผู้ใช้งาน"
                      autoComplete="username"
                      inputMode="text"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#374151] text-sm font-semibold mb-1.5 block">รหัสผ่าน</label>
                  <div className="relative">
                    <FieldIcon>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </FieldIcon>
                    <input
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={`${inputCls} pr-12`}
                      placeholder="••••••••"
                      autoComplete={remember ? 'current-password' : 'off'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 text-[#9CA3AF] hover:text-[#1F2937] rounded-lg"
                      aria-label={showPass ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    >
                      {showPass ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember credentials */}
                <label className="flex items-start gap-3 cursor-pointer select-none py-1">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setRemember(on);
                      if (!on) clearSavedLogin();
                    }}
                    className="mt-0.5 w-5 h-5 rounded border-[#D1D5DB] text-[#65a30d] focus:ring-[#A3E635] accent-[#65a30d]"
                  />
                  <span className="text-sm text-[#374151] leading-snug">
                    <span className="font-bold">จดจำรหัสผ่าน</span>
                    <span className="block text-[#6B7280] text-xs mt-0.5">
                      ครั้งหน้าเปิดเว็บ ระบบจะกรอกชื่อผู้ใช้และรหัสผ่านให้อัตโนมัติ
                    </span>
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={loading || success}
                  className={`relative w-full h-12 mt-1 text-base font-bold rounded-xl overflow-hidden flex items-center justify-center gap-2 transition-all duration-300 select-none
                    ${success
                      ? 'bg-emerald-500 text-white'
                      : isFailed
                        ? 'bg-red-500 text-white'
                        : 'text-[#1F2937] hover:-translate-y-0.5 active:translate-y-0 btn-shimmer'
                    } disabled:opacity-90 disabled:cursor-not-allowed`}
                  style={
                    !success && !isFailed
                      ? { background: 'linear-gradient(135deg, #A3E635 0%, #84cc16 50%, #65a30d 100%)', boxShadow: '0 4px 18px rgba(163,230,53,0.35)' }
                      : {}
                  }
                >
                  {success ? 'เข้าสู่ระบบสำเร็จ!' : isFailed ? 'ข้อมูลไม่ถูกต้อง' : loading ? (
                    <>
                      <div className="w-5 h-5 border-[2.5px] border-[#1F2937]/25 border-t-[#1F2937] rounded-full animate-spin" />
                      กำลังตรวจสอบ...
                    </>
                  ) : (
                    <>
                      เข้าสู่ระบบ
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-[#6B7280]">
                ยังไม่มีบัญชี?{' '}
                <button type="button" onClick={() => setMode('register')} className="font-bold text-[#65a30d] hover:underline">
                  ลงทะเบียนพนักงาน
                </button>
              </p>
            </>
          ) : (
            <>
              <div className="mb-5">
                <h2 className="text-xl sm:text-2xl font-black text-[#1F2937]">ลงทะเบียนพนักงาน</h2>
                <p className="text-[#6B7280] text-sm mt-1">สร้างบัญชีแล้วรอผู้ดูแลระบบอนุมัติ</p>
              </div>

              <form id="register-form" onSubmit={handleRegister} className="space-y-3.5">
                <div>
                  <label className="text-[#374151] text-sm font-semibold mb-1.5 block">ชื่อ-นามสกุล</label>
                  <div className="relative">
                    <FieldIcon>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </FieldIcon>
                    <input
                      type="text"
                      value={reg.full_name}
                      onChange={(e) => setReg({ ...reg, full_name: e.target.value })}
                      className={inputCls}
                      placeholder="ชื่อจริงที่ใช้ในระบบ"
                      autoComplete="name"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#374151] text-sm font-semibold mb-1.5 block">ชื่อผู้ใช้งาน</label>
                  <div className="relative">
                    <FieldIcon>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </FieldIcon>
                    <input
                      type="text"
                      value={reg.username}
                      onChange={(e) => setReg({ ...reg, username: e.target.value })}
                      className={inputCls}
                      placeholder="อย่างน้อย 3 ตัวอักษร"
                      autoComplete="username"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[#374151] text-sm font-semibold mb-1.5 block">ตำแหน่งที่สมัคร</label>
                  <select
                    value={reg.role}
                    onChange={(e) => setReg({ ...reg, role: e.target.value })}
                    className="w-full h-12 px-4 rounded-xl text-[#1F2937] text-base bg-white border-[1.5px] border-[#E5E7EB] shadow-sm focus:border-[#A3E635] focus:ring-[3px] focus:ring-[#A3E635]/20 outline-none"
                  >
                    {REGISTER_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[#374151] text-sm font-semibold mb-1.5 block">รหัสผ่าน</label>
                  <div className="relative">
                    <FieldIcon>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                    </FieldIcon>
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      value={reg.password}
                      onChange={(e) => setReg({ ...reg, password: e.target.value })}
                      className={`${inputCls} pr-12`}
                      placeholder="อย่างน้อย 4 ตัวอักษร"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass(!showRegPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-2.5 text-[#9CA3AF] hover:text-[#1F2937] rounded-lg"
                    >
                      {showRegPass ? 'ซ่อน' : 'แสดง'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[#374151] text-sm font-semibold mb-1.5 block">ยืนยันรหัสผ่าน</label>
                  <div className="relative">
                    <FieldIcon>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    </FieldIcon>
                    <input
                      type={showRegPass ? 'text' : 'password'}
                      value={reg.confirm}
                      onChange={(e) => setReg({ ...reg, confirm: e.target.value })}
                      className={inputCls}
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="relative w-full h-12 mt-1 text-base font-bold rounded-xl overflow-hidden flex items-center justify-center gap-2 text-[#1F2937] btn-shimmer disabled:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #A3E635 0%, #84cc16 50%, #65a30d 100%)', boxShadow: '0 4px 18px rgba(163,230,53,0.35)' }}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-[2.5px] border-[#1F2937]/25 border-t-[#1F2937] rounded-full animate-spin" />
                      กำลังส่งคำขอ...
                    </>
                  ) : (
                    'ส่งคำขอลงทะเบียน'
                  )}
                </button>
              </form>

              <p className="mt-5 text-center text-sm text-[#6B7280]">
                มีบัญชีแล้ว?{' '}
                <button type="button" onClick={() => setMode('login')} className="font-bold text-[#65a30d] hover:underline">
                  เข้าสู่ระบบ
                </button>
              </p>
            </>
          )}

          <div className="mt-auto pt-6 flex flex-col items-center gap-3 text-[#9CA3AF] text-xs">
            <button
              type="button"
              onClick={() => setShowManualModal(true)}
              className="text-sm font-semibold text-[#65a30d] hover:text-[#1F2937] hover:underline"
            >
              วิธีเข้าสู่ระบบ / ลงทะเบียน
            </button>
            <div className="flex items-center justify-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635]" />
              <span>{brandName} · เข้าสู่ระบบอย่างปลอดภัย</span>
            </div>
          </div>
        </div>
      </div>

      <ManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        userRoles={[]}
        pageName="login"
      />
    </div>
  );
}
