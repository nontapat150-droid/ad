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
      .then((res) => setCheckinData(res.data))
      .catch(() => setCheckinData(null));
  }, []);

  const handleCheckoutClick = () => {
    if (!checkinData?.checkin_time) {
      Swal.fire({
        icon: 'warning',
        title: 'ยังไม่ได้เข้างาน',
        text: 'ระบบต้องมีการเข้างานก่อนถึงจะออกงานได้',
        confirmButtonColor: '#1F2937',
      });
      return;
    }
    navigate('/checkin');
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center gap-2.5 min-w-0 mb-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-md shrink-0">
            <span className="text-white text-xs">📝</span>
          </div>
          <div className="min-w-0">
            <h3 className="text-[#1F2937] font-bold text-base truncate">สร้างงานขายใหม่</h3>
            <p className="text-[11px] text-[#6B7280] font-medium">ฟอร์มแบบลำดับขั้นตอน ลดข้อผิดพลาดตอนกรอกข้อมูล</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/ais-expansion')}
          className="w-full py-3 rounded-xl text-sm font-black text-[#1F2937]"
          style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
        >
          + เปิดหน้าสร้างงานขาย
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ShortcutBtn icon="📍" label="เช็คอิน"
          onClick={() => navigate('/checkin')} gradient="from-[#A3E635] to-[#65a30d]" shadow="shadow-lime-500/25" />
        <ShortcutBtn icon="🏁" label="เช็คเอาท์"
          onClick={handleCheckoutClick} gradient="from-[#1F2937] to-[#374151]" shadow="shadow-slate-500/25" />
        <ShortcutBtn icon="⛽" label="น้ำมัน"
          onClick={() => navigate('/oil')} gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => navigate('/oil-history')}
          className="min-h-[44px] rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
        >
          ประวัติเติมน้ำมันทีม
        </button>
        <button
          type="button"
          onClick={() => navigate('/report')}
          className="min-h-[44px] rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]"
        >
          แจ้งปัญหาให้ผู้ดูแล
        </button>
      </div>
    </div>
  );
}
