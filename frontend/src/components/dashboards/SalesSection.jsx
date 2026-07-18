import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../../api/axios';
import { ShortcutBtn } from './SharedComponents';

export default function SalesSection() {
  const navigate = useNavigate();
  const [checkinData, setCheckinData] = useState(null);

  useEffect(() => {
    api.get('/checkin/today')
      .then(res => setCheckinData(res.data))
      .catch(err => console.error(err));
  }, []);

  const handleCheckoutClick = () => {
    if (!checkinData?.checkin_time) {
      Swal.fire({
        icon: 'warning',
        title: 'ยังไม่ได้เข้างาน',
        text: 'ระบบต้องมีการเข้างานก่อนถึงจะออกงานได้',
        confirmButtonColor: '#1F2937'
      });
      return;
    }
    navigate('/checkin');
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-[#E5E7EB] animate-fade-in-up"
      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#A3E635] to-[#65a30d] flex items-center justify-center shadow-md shadow-lime-500/20">
          <span className="text-[#1F2937] text-xs">🚀</span>
        </div>
        <h3 className="text-[#1F2937] font-bold text-base">เมนูทางลัด (เซล)</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <ShortcutBtn icon="📍" label="เช็คอินเข้างาน"
          onClick={() => navigate('/checkin')} gradient="from-[#A3E635] to-[#65a30d]" shadow="shadow-lime-500/25" />
        <ShortcutBtn icon="🏁" label="เช็คเอาท์ออกงาน"
          onClick={handleCheckoutClick} gradient="from-[#1F2937] to-[#374151]" shadow="shadow-slate-500/25" />
        <ShortcutBtn icon="📋" label="ระบบงานขยาย AIS"
          onClick={() => navigate('/ais-expansion')} gradient="from-violet-500 to-purple-600" shadow="shadow-violet-500/25" />
        <ShortcutBtn icon="⛽" label="กรอกบิลน้ำมัน"
          onClick={() => navigate('/oil')} gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
      </div>
    </div>
  );
}
