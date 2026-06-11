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
      else if (userRoles.includes('ma_technician')) redirectUrl = '/ma-tech';

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
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 relative font-sans bouns-bg">
      
      {/* Animated Orbs Background */}
      <div className="bouns-orb w-64 h-64 bg-purple-600/30 top-[-10%] left-[-10%]" style={{ animationDelay: '0s' }} />
      <div className="bouns-orb w-96 h-96 bg-blue-600/30 bottom-[-20%] right-[-10%]" style={{ animationDelay: '-5s' }} />
      <div className="bouns-orb w-48 h-48 bg-pink-600/20 top-[40%] left-[60%]" style={{ animationDelay: '-10s' }} />

      {/* Main Glass Card */}
      <div 
        className="w-full max-w-md bouns-glass-card rounded-[32px] p-8 sm:p-10 z-10 animate-[bounsFadeUp_0.8s_ease-out]"
        style={{ animationFillMode: 'both' }}
      >
        
        {/* Logo / Branding */}
        <div className="text-center mb-10">
          <div className="mx-auto w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(147,51,234,0.3)] border border-white/20 animate-[bounsPulseGlow_4s_infinite]">
            <svg className="w-10 h-10 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
            </svg>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight mb-1 drop-shadow-lg">
            Bouns
          </h1>
          <p className="text-purple-200/80 font-medium tracking-wide text-sm">
            ระบบจัดการงานอัจฉริยะ
          </p>
        </div>

        {/* Form */}
        <form id="login-form" onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider ml-1">
              ชื่อผู้ใช้งาน
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full bouns-input px-4 py-3.5 rounded-2xl outline-none transition-all"
              placeholder="กรอกชื่อผู้ใช้งานของคุณ"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-purple-300 uppercase tracking-wider ml-1">
              รหัสผ่าน
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bouns-input px-4 py-3.5 pr-12 rounded-2xl outline-none transition-all"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-purple-300 hover:text-white transition-colors rounded-xl">
                {showPass
                  ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                }
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className={`w-full h-[56px] mt-8 text-[15px] font-bold rounded-2xl transition-all flex items-center justify-center gap-2
              ${success ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)]'
                : isFailed ? 'bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                  : 'bouns-btn'
              } disabled:opacity-90 disabled:cursor-not-allowed`}
          >
            {success
              ? <div className="flex items-center gap-2 animate-[fadeInUp_0.3s_ease-out]">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>เข้าสู่ระบบสำเร็จ!</span>
              </div>
              : isFailed
                ? <div className="flex items-center gap-2 animate-[fadeInUp_0.2s_ease-out]">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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

        <div className="mt-8 text-center">
          <p className="text-[11px] font-medium text-white/30">
            &copy; {new Date().getFullYear()} Bouns System. All rights reserved.
          </p>
        </div>

      </div>
    </div>
  );
}
