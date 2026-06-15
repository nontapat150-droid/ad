import { useNavigate } from 'react-router-dom';
import { ShortcutBtn } from './SharedComponents';

export default function SalesSection() {
  const navigate = useNavigate();

  return (
    <div className="glass rounded-3xl p-6 border border-white/50 shadow-sm animate-fade-in-up">
      <h3 className="text-[#042C53] font-bold text-base flex items-center gap-2 mb-5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shadow-purple-500/20">
          <span className="text-white text-xs">🚀</span>
        </div>
        เมนูทางลัด (เซล)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <ShortcutBtn icon="📍" label="เช็คอินเข้างาน" onClick={() => navigate('/checkin')}
          gradient="from-indigo-500 to-violet-600" shadow="shadow-indigo-500/25" />
        <ShortcutBtn icon="📋" label="ระบบงานขยาย AIS" onClick={() => navigate('/ais-expansion')}
          gradient="from-[#185FA5] to-[#378ADD]" shadow="shadow-blue-500/25" />
        <ShortcutBtn icon="⛽" label="กรอกบิลน้ำมัน" onClick={() => navigate('/oil')}
          gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
      </div>
    </div>
  );
}
