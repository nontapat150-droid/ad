import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/imageUtils';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
  const { branding } = useBranding();
  const navigate = useNavigate();

  useEffect(() => {
    AOS.refresh();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.username.trim() || !form.password) {
      Swal.fire({
        title: 'ข้อมูลไม่ครบถ้วน',
        text: 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน',
        icon: 'warning',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#A3E635',
        background: '#fff'
      });
      setIsFailed(true);
      const formEl = document.getElementById('login-form');
      if (formEl) {
        formEl.classList.remove('animate-[shake_0.4s_ease-in-out]');
        void formEl.offsetWidth;
        formEl.classList.add('animate-[shake_0.4s_ease-in-out]');
      }
      setTimeout(() => setIsFailed(false), 1500);
      return;
    }

    setLoading(true);
    try {
      // Force rememberMe to true to always remember login sessions (localStorage)
      const loggedInUser = await login(form.username, form.password, true);
      setSuccess(true);

      Swal.fire({
        title: 'สำเร็จ!',
        text: 'เข้าสู่ระบบเรียบร้อยแล้ว',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 1500);
    } catch (err) {
      setIsFailed(true);
      let errorMsg = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่';
      if (err.response) {
        if (err.response.data?.error) {
          errorMsg = err.response.data.error;
        } else if (err.response.status === 503) {
          errorMsg = 'ระบบหลังบ้านกำลังอัปเดต หรือขัดข้อง (503 Service Unavailable) กรุณารอสักครู่แล้วลองใหม่';
        } else if (err.response.status === 500) {
          errorMsg = 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์ (500 Internal Server Error)';
        }
      } else if (err.message === 'Network Error') {
        errorMsg = 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (Network Error)';
      }
      setError(errorMsg);

      Swal.fire({
        title: 'ข้อผิดพลาด',
        text: errorMsg,
        icon: 'error',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#A32D2D',
        background: '#fff'
      });

      const formEl = document.getElementById('login-form');
      if (formEl) {
        formEl.classList.remove('animate-[shake_0.4s_ease-in-out]');
        void formEl.offsetWidth;
        formEl.classList.add('animate-[shake_0.4s_ease-in-out]');
      }
      setTimeout(() => setIsFailed(false), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh w-full flex items-center justify-center relative overflow-hidden font-sans bg-[#1F2937]">
      <style>{`
        /* Chrome Autofill fix */
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus,
        input:-webkit-autofill:active {
          -webkit-box-shadow: 0 0 0 30px #374151 inset !important;
          -webkit-text-fill-color: #F3F4F6 !important;
          transition: background-color 5000s ease-in-out 0s;
          border-radius: 0.75rem;
        }

        @keyframes floatUp {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-18px) rotate(3deg); }
        }
        @keyframes floatDown {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(14px) rotate(-2deg); }
        }
        @keyframes pulseRing {
          0%, 100% { opacity: 0.12; transform: scale(1); }
          50% { opacity: 0.22; transform: scale(1.04); }
        }
        @keyframes shimmerSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .float-up { animation: floatUp 7s ease-in-out infinite; }
        .float-down { animation: floatDown 9s ease-in-out infinite; }
        .pulse-ring { animation: pulseRing 4s ease-in-out infinite; }
        .spin-slow { animation: spinSlow 20s linear infinite; }
        .btn-shimmer::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          transform: translateX(-100%);
          animation: shimmerSlide 2s ease-in-out infinite;
        }
      `}</style>

      {/* ── Background ── */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#111827] via-[#1F2937] to-[#1a2535]" />

      {/* Decorative lime blobs */}
      <div className="absolute top-[-8%] left-[-5%] w-[32rem] h-[32rem] rounded-full bg-[#A3E635]/8 blur-[100px] float-up" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[36rem] h-[36rem] rounded-full bg-[#84cc16]/10 blur-[120px] float-down" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[50rem] h-[50rem] rounded-full bg-[#A3E635]/4 blur-[160px]" />

      {/* Spinning ring */}
      <div className="absolute top-16 right-20 w-32 h-32 rounded-full border-2 border-dashed border-[#A3E635]/15 spin-slow hidden lg:block" />
      <div className="absolute bottom-24 left-16 w-20 h-20 rounded-full border border-[#A3E635]/12 spin-slow hidden lg:block" style={{animationDuration:'14s', animationDirection:'reverse'}} />

      {/* Grid dots */}
      <div className="absolute inset-0 opacity-[0.025]"
        style={{backgroundImage:'radial-gradient(circle, #A3E635 1px, transparent 1px)', backgroundSize:'36px 36px'}} />

      {/* ── Main Card ── */}
      <div
        className="relative z-10 w-full max-w-[920px] mx-4 flex flex-col md:flex-row rounded-3xl overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.7)]"
        style={{border:'1px solid rgba(163,230,53,0.12)'}}
        data-aos="fade-up"
        data-aos-duration="900"
      >

        {/* ── Left Panel — Branding ── */}
        <div className="relative hidden md:flex md:w-[42%] flex-col items-center justify-center p-10 overflow-hidden"
          style={{background:'linear-gradient(145deg, #111827 0%, #1a2535 50%, #0f1e2e 100%)'}}>

          {/* Lime accent strip */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#A3E635] to-transparent opacity-80" />

          {/* Large decorative circle */}
          <div className="absolute w-80 h-80 rounded-full border border-[#A3E635]/8 pulse-ring" />
          <div className="absolute w-56 h-56 rounded-full border border-[#A3E635]/12 pulse-ring" style={{animationDelay:'1s'}} />

          {/* Corner glow */}
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-[#A3E635]/6 rounded-full blur-3xl" />
          <div className="absolute top-0 left-0 w-32 h-32 bg-[#A3E635]/5 rounded-full blur-2xl" />

          <div className="relative z-10 flex flex-col items-center text-center space-y-8">

            {/* Logo Mark */}
            <div className="relative">
              {/* Outer glow ring */}
              <div className="absolute -inset-3 rounded-[28px] bg-[#A3E635]/15 blur-md" />
              <div className="relative w-24 h-24 rounded-[24px] flex items-center justify-center overflow-hidden shadow-[0_8px_32px_rgba(163,230,53,0.35),inset_0_1px_0_rgba(255,255,255,0.3)]"
                style={branding?.website_logo ? {} : {background:'linear-gradient(135deg, #A3E635 0%, #65a30d 100%)'}}>
                {branding?.website_logo ? (
                  <img src={getImageUrl(branding.website_logo, 'branding')} alt="Logo" className="w-full h-full object-contain p-2" />
                ) : (
                  <svg className="w-12 h-12 text-[#1F2937]" viewBox="0 0 48 48" fill="none">
                    <path d="M24 36a2 2 0 100-4 2 2 0 000 4z" fill="currentColor"/>
                    <path d="M17.1 29.1a9.9 9.9 0 0113.8 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    <path d="M11.3 23.3a17.9 17.9 0 0125.4 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                    <path d="M5.5 17.5a26 26 0 0137 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                )}
              </div>
            </div>

            {/* Brand name */}
            <div>
              <h1 className="text-5xl font-black text-[#F3F4F6] tracking-tight leading-none">
                {branding?.website_name || 'Bonus'}
              </h1>
              <div className="mt-2 flex items-center justify-center gap-2">
                <div className="h-px w-8 bg-[#A3E635]/50" />
                <p className="text-[#A3E635] text-xs font-bold tracking-[0.25em] uppercase">AIS Platform</p>
                <div className="h-px w-8 bg-[#A3E635]/50" />
              </div>
              <p className="mt-2 text-[#9CA3AF] text-sm">ระบบจัดการงาน</p>
            </div>

            {/* Feature badges */}
            <div className="w-full space-y-2.5">
              {[
                { icon: '🛡️', label: 'ความปลอดภัยระดับองค์กร' },
                { icon: '⚡', label: 'รวดเร็ว ทุกที่ทุกเวลา' },
                { icon: '📊', label: 'รายงานแบบเรียลไทม์' },
              ].map((item) => (
                <div key={item.label}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-[#D1D5DB]"
                  style={{background:'rgba(163,230,53,0.06)', border:'1px solid rgba(163,230,53,0.12)'}}>
                  <span className="text-base">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>

            {/* Version tag */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#A3E635] animate-pulse" />
              <span className="text-[#6B7280] text-xs">v2.0 · Online</span>
            </div>
          </div>
        </div>

        {/* ── Right Panel — Form ── */}
        <div className="flex-1 flex flex-col justify-center p-7 sm:p-10 md:p-12 bg-[#F3F4F6]">

          {/* Mobile header */}
          <div className="flex md:hidden items-center gap-3 mb-7">
            {branding?.website_logo ? (
              <img src={getImageUrl(branding.website_logo, 'branding')} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
            ) : (
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{background:'linear-gradient(135deg, #A3E635, #65a30d)'}}>
                <svg className="w-5 h-5 text-[#1F2937]" viewBox="0 0 24 24" fill="none">
                  <path d="M12 18a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                  <path d="M8.5 14.5a5 5 0 017 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M5.5 11.5a9 9 0 0113 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M2.5 8.5a13 13 0 0119 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <div>
              <p className="text-lg font-black text-[#1F2937]">{branding?.website_name || 'Bonus'}</p>
              <p className="text-xs text-[#6B7280]">AIS Platform</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-black text-[#1F2937] leading-tight">
              ยินดีต้อนรับ 👋
            </h2>
            <p className="text-[#6B7280] text-sm mt-1.5">กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ</p>
          </div>

          <form id="login-form" onSubmit={handleSubmit} className="space-y-5">

            {/* Username */}
            <div>
              <label className="text-[#374151] text-sm font-semibold mb-1.5 block">
                ชื่อผู้ใช้งาน
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B7280]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full h-12 pl-11 pr-4 rounded-xl text-[#1F2937] placeholder-[#9CA3AF] text-base outline-none transition-all duration-200"
                  style={{
                    background: '#fff',
                    border: '1.5px solid #E5E7EB',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#A3E635'; e.target.style.boxShadow = '0 0 0 3px rgba(163,230,53,0.18)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
                  placeholder="กรอกชื่อผู้ใช้งานของคุณ"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-[#374151] text-sm font-semibold mb-1.5 block">
                รหัสผ่าน
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B7280]">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full h-12 pl-11 pr-12 rounded-xl text-[#1F2937] placeholder-[#9CA3AF] text-base outline-none transition-all duration-200"
                  style={{
                    background: '#fff',
                    border: '1.5px solid #E5E7EB',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#A3E635'; e.target.style.boxShadow = '0 0 0 3px rgba(163,230,53,0.18)'; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'; }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#9CA3AF] hover:text-[#1F2937] transition-colors rounded-lg hover:bg-[#F3F4F6]"
                >
                  {showPass
                    ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {/* Forgot Password */}
            <div className="flex items-center justify-end text-sm pt-0.5">
              <a href="#" className="text-[#65a30d] font-semibold hover:text-[#1F2937] hover:underline transition-colors">
                ลืมรหัสผ่าน?
              </a>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className={`relative w-full h-12 mt-2 text-base font-bold rounded-xl overflow-hidden flex items-center justify-center gap-2 transition-all duration-300 select-none
                ${success
                  ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                  : isFailed
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
                    : 'text-[#1F2937] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(163,230,53,0.45)] active:translate-y-0 btn-shimmer'
                } disabled:opacity-90 disabled:cursor-not-allowed disabled:transform-none`}
              style={
                !success && !isFailed
                  ? { background: 'linear-gradient(135deg, #A3E635 0%, #84cc16 50%, #65a30d 100%)', boxShadow: '0 4px 18px rgba(163,230,53,0.35)' }
                  : {}
              }
            >
              {success ? (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <span>เข้าสู่ระบบสำเร็จ!</span>
                </div>
              ) : isFailed ? (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  <span>ข้อมูลไม่ถูกต้อง</span>
                </div>
              ) : loading ? (
                <>
                  <div className="w-5 h-5 border-[2.5px] border-[#1F2937]/25 border-t-[#1F2937] rounded-full animate-spin" />
                  <span>กำลังตรวจสอบ...</span>
                </>
              ) : (
                <>
                  <span>เข้าสู่ระบบ</span>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
            <div className="flex items-center justify-center gap-2 text-[#9CA3AF] text-xs">
              <svg className="w-3.5 h-3.5 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>เข้าสู่ระบบอย่างปลอดภัย · Bonus AIS Platform</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
