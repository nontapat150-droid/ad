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
      else if (userRoles.includes('sales')) redirectUrl = '/checkin';
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
    <div className="min-h-dvh w-full flex items-center justify-center p-4 md:p-8 relative overflow-hidden font-sans">

      <div
        className="w-full max-w-5xl glass-deep flex flex-col md:flex-row rounded-[24px] overflow-hidden reveal shadow-2xl"
        data-aos="fade-up"
        data-aos-duration="1000"
      >
        {/* Left Side - Branding & Illustration */}
        <div className="hidden md:flex flex-col justify-center items-center p-12 bg-gradient-to-br from-[#185FA5]/90 to-[#0C447C]/95 relative w-1/2 overflow-hidden">

          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay"></div>

          <div className="z-10 text-center text-white space-y-6">
            <div className="mx-auto flex items-center justify-center w-24 h-24 rounded-[2rem] glass bg-white/10 border-white/20 shadow-lg relative group">
              <svg className="w-12 h-12 text-white drop-shadow-md group-hover:scale-110 transition-transform duration-500 ease-spring" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
              </svg>
            </div>

            <div>
              <h1 className="text-4xl font-extrabold text-white tracking-tight mb-2 drop-shadow-md">
                Bount
              </h1>
              <p className="text-[#B5D4F4] font-medium tracking-wide text-lg">
                ระบบจัดการงาน
              </p>
            </div>

            <div className="w-full h-48 relative flex items-center justify-center mt-8">
              {/* Illustration placeholder image */}
              <img
                src="/login-illustration.png"
                alt="3D Dashboard Illustration"
                className="absolute w-full h-full object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)] animate-[blobDrift_10s_ease-in-out_infinite_alternate]"
              />
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-14 glass flex flex-col justify-center rounded-none border-none shadow-none bg-white/70">

          <div className="mb-10 md:hidden text-center">
            <h1 className="text-3xl font-extrabold text-[#042C53] mb-1">Bount</h1>
            <p className="text-[#378ADD] font-medium">ระบบจัดการงาน</p>
          </div>

          <h2 className="text-3xl font-bold text-[#042C53] mb-2">เข้าสู่ระบบ 👋</h2>
          <p className="text-[#185FA5] text-sm mb-10 font-medium">กรุณากรอกข้อมูลเพื่อดำเนินการต่อ</p>

          <form id="login-form" onSubmit={handleSubmit} className="space-y-6">

            <div className="group">
              <label>ชื่อผู้ใช้งาน</label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="input-field py-3.5"
                placeholder="กรอกชื่อผู้ใช้งานของคุณ"
                autoComplete="username"
              />
            </div>

            <div className="group">
              <label>รหัสผ่าน</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-field py-3.5 pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-[#378ADD] hover:text-[#185FA5] transition-colors rounded-xl hover:bg-[#E6F1FB]">
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
              className={`w-full h-14 mt-4 text-lg font-bold rounded-[14px] shadow-lg transition-all overflow-hidden relative flex items-center justify-center gap-2
                ${success ? 'bg-emerald-500 text-white shadow-emerald-500/30'
                  : isFailed ? 'btn-danger shadow-red-500/30'
                    : 'btn-primary'
                } disabled:opacity-90 disabled:cursor-not-allowed disabled:transform-none`}
            >
              {!success && !isFailed && <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent hover:animate-[shimmer_1.5s_infinite]" />}

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

        </div>
      </div>
    </div>
  );
}
