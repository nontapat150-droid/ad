import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AOS from 'aos';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const { login } = useAuth();
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
        confirmButtonColor: '#F59E0B',
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
      const loggedInUser = await login(form.username, form.password);
      setSuccess(true);

      Swal.fire({
        title: 'สำเร็จ!',
        text: 'เข้าสู่ระบบเรียบร้อยแล้ว',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
      });

      const userRoles = loggedInUser.roles || [loggedInUser.role];
      let redirectUrl = '/office-tech';
      if (userRoles.includes('super_admin')) redirectUrl = '/super-admin';
      else if (userRoles.includes('admin')) redirectUrl = '/admin';
      else if (userRoles.includes('ma_technician') && !userRoles.includes('office_technician') && !userRoles.includes('technician')) redirectUrl = '/ma-tech';

      setTimeout(() => {
        navigate(redirectUrl, { replace: true });
      }, 1500);
    } catch (err) {
      setIsFailed(true);
      const errorMsg = err.response?.data?.error || 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่';
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
    <div className="min-h-dvh w-full flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans bg-[#03132A]">

      {/* Ambient premium glow background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#042C53] via-[#0C447C] to-[#03132A]" />
      <div className="absolute top-[-15%] left-[-10%] w-[40rem] h-[40rem] rounded-full bg-[#378ADD]/25 blur-[120px] animate-[blobDrift_16s_ease-in-out_infinite_alternate]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[44rem] h-[44rem] rounded-full bg-[#185FA5]/30 blur-[130px] animate-[blobDrift_20s_ease-in-out_infinite_alternate_reverse]" />
      <div className="absolute top-1/3 right-1/3 w-72 h-72 rounded-full bg-[#1D9E75]/15 blur-[100px] animate-[blobDrift_24s_ease-in-out_infinite_alternate]" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.04] mix-blend-overlay" />

      <div
        className="w-full max-w-5xl flex flex-col md:flex-row rounded-[28px] overflow-hidden reveal relative z-10 backdrop-blur-2xl bg-white/[0.06] border border-white/15 shadow-[0_30px_90px_-20px_rgba(0,0,0,0.6)]"
        data-aos="fade-up"
        data-aos-duration="1000"
      >
        {/* Left Side - Branding & Illustration */}
        <div className="hidden md:flex flex-col justify-center items-center p-12 bg-gradient-to-br from-[#185FA5] via-[#0C447C] to-[#042C53] relative w-1/2 overflow-hidden">

          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>

          {/* Decorative rings & shapes */}
          <div className="absolute w-64 h-64 rounded-full border border-white/15 -top-20 -right-20" />
          <div className="absolute w-40 h-40 rounded-full border border-white/10 bottom-10 -left-16" />
          <div className="absolute top-12 right-12 w-20 h-20 rounded-3xl bg-white/10 rotate-12 backdrop-blur-sm animate-[blobDrift_12s_ease-in-out_infinite_alternate]" />
          <div className="absolute bottom-20 left-10 w-14 h-14 rounded-2xl bg-white/10 -rotate-6 backdrop-blur-sm animate-[blobDrift_15s_ease-in-out_infinite_alternate_reverse]" />

          <div className="z-10 text-center text-white space-y-6">
            <div className="mx-auto flex items-center justify-center w-24 h-24 rounded-[2rem] bg-white/15 border border-white/25 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-md relative group">
              <svg className="w-12 h-12 text-white drop-shadow-md group-hover:scale-110 transition-transform duration-500 ease-spring" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
              </svg>
            </div>

            <div>
              <h1 className="text-5xl font-extrabold text-white tracking-tight mb-2 drop-shadow-[0_4px_20px_rgba(0,0,0,0.35)]">
                Bouns
              </h1>
              <p className="text-[#E6F1FB] font-medium tracking-[0.2em] text-sm uppercase opacity-80">
                ระบบจัดการงาน
              </p>
            </div>

            <div className="w-full h-48 relative flex items-center justify-center mt-8">
              {/* Illustration placeholder image */}
              <img
                src="/login-illustration.png"
                alt="3D Dashboard Illustration"
                className="absolute w-full h-full object-contain filter drop-shadow-[0_20px_40px_rgba(0,0,0,0.4)] animate-[blobDrift_10s_ease-in-out_infinite_alternate]"
              />
            </div>

            {/* Feature pills */}
            <div className="flex flex-col gap-2.5 px-2">
              <div className="flex items-center gap-2.5 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 backdrop-blur-md">
                <svg className="w-4 h-4 text-[#9FE1CB] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <span className="text-xs text-white/85">ความปลอดภัยระดับองค์กร</span>
              </div>
              <div className="flex items-center gap-2.5 bg-white/10 border border-white/10 rounded-xl px-4 py-2.5 backdrop-blur-md">
                <svg className="w-4 h-4 text-[#FAC775] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="text-xs text-white/85">รวดเร็ว ทุกที่ทุกเวลา</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-14 flex flex-col justify-center bg-white/[0.04] backdrop-blur-xl">

          <div className="mb-10 md:hidden text-center">
            <h1 className="text-3xl font-extrabold text-white mb-1">Bouns</h1>
            <p className="text-[#85B7EB] font-medium tracking-[0.2em] text-xs uppercase">ระบบจัดการงาน</p>
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">เข้าสู่ระบบ 👋</h2>
          <p className="text-[#B5D4F4] text-sm mb-10 font-medium">กรุณากรอกข้อมูลเพื่อดำเนินการต่อ</p>

          <form id="login-form" onSubmit={handleSubmit} className="space-y-6">

            <div className="group">
              <label className="text-[#E6F1FB] text-sm font-medium mb-1.5 block">ชื่อผู้ใช้งาน</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#85B7EB] group-focus-within:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#378ADD]/60 focus:border-[#378ADD]/60 backdrop-blur-md transition-all duration-300"
                  placeholder="กรอกชื่อผู้ใช้งานของคุณ"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="group">
              <label className="text-[#E6F1FB] text-sm font-medium mb-1.5 block">รหัสผ่าน</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#85B7EB] group-focus-within:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 1.105-.895 2-2 2s-2-.895-2-2 .895-2 2-2 2 .895 2 2zm0 0v3m-6-3a6 6 0 1112 0v3a2 2 0 01-2 2H8a2 2 0 01-2-2v-3z" /></svg>
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full h-12 pl-11 pr-12 rounded-xl bg-white/10 border border-white/15 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#378ADD]/60 focus:border-[#378ADD]/60 backdrop-blur-md transition-all duration-300"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#85B7EB] hover:text-white transition-colors rounded-xl hover:bg-white/10">
                  {showPass
                    ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm pt-1">
              <label className="flex items-center gap-2 text-[#B5D4F4] cursor-pointer select-none">
                <input type="checkbox" className="w-4 h-4 rounded border-white/30 bg-white/10 text-[#378ADD] focus:ring-[#378ADD]/40" />
                <span>จดจำฉัน</span>
              </label>
              <a href="#" className="text-[#85B7EB] font-medium hover:text-white hover:underline transition-colors">
                ลืมรหัสผ่าน?
              </a>
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className={`w-full h-14 mt-4 text-lg font-bold rounded-[14px] transition-all duration-500 overflow-hidden relative flex items-center justify-center gap-2
                ${success ? 'bg-emerald-500 text-white shadow-[0_8px_30px_-8px_rgba(16,185,129,0.6)]'
                  : isFailed ? 'btn-danger shadow-[0_8px_30px_-8px_rgba(163,45,45,0.6)]'
                    : 'bg-gradient-to-r from-[#378ADD] via-[#185FA5] to-[#0C447C] text-white shadow-[0_8px_35px_-8px_rgba(55,138,221,0.7)] hover:shadow-[0_10px_40px_-6px_rgba(55,138,221,0.85)] hover:-translate-y-0.5'
                } disabled:opacity-90 disabled:cursor-not-allowed disabled:transform-none`}
            >
              {!success && !isFailed && <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent hover:animate-[shimmer_1.5s_infinite]" />}

              {success
                ? <div className="flex items-center gap-2 animate-[fadeInUp_0.3s_ease-out]">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  <span>เข้าสู่ระบบสำเร็จ!</span>
                </div>
                : isFailed
                  ? <div className="flex items-center gap-2 animate-[fadeInUp_0.2s_ease-out]">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    <span>ข้อมูลไม่ถูกต้อง</span>
                  </div>
                  : loading
                    ? <><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" /> <span>กำลังตรวจสอบ...</span></>
                    : <>
                      <span>เข้าสู่ระบบ</span>
                      <svg className="w-5 h-5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
              }
            </button>
          </form>

          <p className="text-center text-xs text-[#85B7EB]/60 mt-8 flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            เข้าสู่ระบบอย่างปลอดภัยด้วย Bouns
          </p>

        </div>
      </div>
    </div>
  );
}
