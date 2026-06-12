import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      setTimeout(() => setIsFailed(false), 1500);
      return;
    }

    setLoading(true);
    try {
      const loggedInUser = await login(form.username, form.password);
      setSuccess(true);

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
        title: 'เข้าสู่ระบบไม่สำเร็จ',
        text: errorMsg,
        icon: 'error',
        confirmButtonText: 'ลองอีกครั้ง',
        confirmButtonColor: '#EF4444',
      });
      setTimeout(() => setIsFailed(false), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] w-full flex items-center justify-center p-4 overflow-hidden bg-slate-900 font-sans selection:bg-indigo-500/30">
      
      {/* ── Animated Background ── */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute top-0 -left-1/4 w-full h-full bg-gradient-to-br from-indigo-600/30 via-purple-600/20 to-transparent blur-3xl animate-[spin_20s_linear_infinite] origin-center opacity-70" />
        <div className="absolute -bottom-1/4 -right-1/4 w-full h-full bg-gradient-to-tl from-cyan-500/30 via-blue-600/20 to-transparent blur-3xl animate-[spin_25s_linear_infinite_reverse] origin-center opacity-70" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0.5)_100%)]" />
      </div>

      {/* Floating Elements (Mobile & Desktop) */}
      <div className="absolute top-10 left-4 md:left-20 w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full blur-xl opacity-60 animate-[bounce_8s_infinite]" />
      <div className="absolute bottom-10 right-4 md:right-20 w-20 h-20 md:w-32 md:h-32 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full blur-xl opacity-60 animate-[bounce_10s_infinite_reverse]" />

      {/* ── Glass Card ── */}
      <div className={`relative z-10 w-full max-w-[400px] p-8 md:p-10 rounded-[32px] backdrop-blur-xl bg-white/10 border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-500 ${isFailed ? 'animate-[shake_0.5s_ease-in-out]' : ''}`}>
        
        {/* Logo / Brand */}
        <div className="text-center mb-10 animate-[slideDown_0.6s_ease-out]">
          <div className="mx-auto w-20 h-20 md:w-24 md:h-24 rounded-3xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-cyan-500 p-1 mb-5 shadow-2xl shadow-indigo-500/40">
            <div className="w-full h-full bg-slate-900/80 rounded-[22px] flex items-center justify-center backdrop-blur-sm">
              <svg className="w-10 h-10 md:w-12 md:h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 via-purple-200 to-cyan-300 tracking-tight mb-2">
            Bouns
          </h1>
          <p className="text-slate-300 font-medium text-sm md:text-base tracking-wide opacity-90">
            Work Management System
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 relative z-20 animate-[slideUp_0.6s_ease-out_0.2s_both]">
          
          <div className="space-y-1.5 group">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-widest ml-1 group-focus-within:text-indigo-300 transition-colors">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-white/5 border border-white/10 text-white px-4 py-3.5 pl-11 rounded-2xl outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all placeholder:text-slate-500 shadow-inner"
                placeholder="กรอกชื่อผู้ใช้งาน"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-1.5 group">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-widest ml-1 group-focus-within:text-indigo-300 transition-colors">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-white/5 border border-white/10 text-white px-4 py-3.5 pl-11 pr-12 rounded-2xl outline-none focus:border-indigo-400/50 focus:bg-white/10 transition-all placeholder:text-slate-500 shadow-inner"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white transition-colors rounded-xl">
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
            className={`w-full h-14 mt-8 text-[15px] font-bold rounded-2xl transition-all duration-300 flex items-center justify-center gap-2 overflow-hidden relative group
              ${success 
                ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-[0.98]'
                : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 text-white shadow-[0_10px_20px_-10px_rgba(99,102,241,0.8)] hover:shadow-[0_15px_25px_-10px_rgba(99,102,241,1)] hover:-translate-y-1 active:scale-[0.98]'
              } disabled:opacity-80 disabled:cursor-not-allowed`}
          >
            {/* Glow effect on hover */}
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
            
            <div className="relative z-10 flex items-center justify-center gap-2">
              {success
                ? <>
                    <svg className="w-6 h-6 animate-[scaleIn_0.3s_ease-out]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    <span className="animate-[slideRight_0.3s_ease-out]">Welcome!</span>
                  </>
                : loading
                  ? <><div className="w-5 h-5 border-[3px] border-white/30 border-t-white rounded-full animate-spin" /> <span>Authenticating...</span></>
                  : <>
                      <span>Sign In</span>
                      <svg className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                    </>
              }
            </div>
          </button>
        </form>

        <div className="mt-8 text-center animate-[fadeIn_1s_ease-out_0.6s_both]">
          <p className="text-[11px] font-medium text-slate-500">
            &copy; {new Date().getFullYear()} Bouns System. All rights reserved.
          </p>
        </div>

      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-10px); }
          40%, 80% { transform: translateX(10px); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.5); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideRight {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
