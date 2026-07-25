import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import api from '../../api/axios';
import { ShortcutBtn } from './SharedComponents';

const OPEN_STATUSES = new Set(['draft', 'survey', 'quoted', 'won']);

const STATUS_LABEL = {
  draft: 'ยังไม่ไป',
  survey: 'กำลังทำ',
  quoted: 'คุยแล้ว',
  won: 'ปิดได้ — รอส่งต่อ',
  lost: 'ไม่ได้',
  handed_off: 'ส่งต่อแล้ว',
};

function callPhone(phone) {
  if (!phone) return;
  const first = String(phone).split(/[,/|]/)[0].replace(/[^\d+]/g, '');
  if (first) window.location.href = `tel:${first}`;
}

function openMaps(job) {
  const lat = parseFloat(job.lat);
  const lng = parseFloat(job.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
    return;
  }
  if (job.address) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank');
  }
}

export default function SalesSection() {
  const navigate = useNavigate();
  const [checkinData, setCheckinData] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const todayISO = new Date().toLocaleDateString('en-CA');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get('/checkin/today').catch(() => ({ data: null })),
      api.get('/expansion').catch(() => ({ data: [] })),
    ])
      .then(([checkinRes, expansionRes]) => {
        setCheckinData(checkinRes.data);
        setJobs(Array.isArray(expansionRes.data) ? expansionRes.data : []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openJobs = jobs.filter((j) => OPEN_STATUSES.has(j.status));
  const todayJobs = openJobs.filter(
    (j) => j.follow_up_at && String(j.follow_up_at).slice(0, 10) === todayISO
  );
  const checklist = (todayJobs.length ? todayJobs : openJobs).slice(0, 8);

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
      {/* Expansion check panel — primary for sales */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5"
        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md shrink-0">
              <span className="text-white text-xs">📋</span>
            </div>
            <div className="min-w-0">
              <h3 className="text-[#1F2937] font-bold text-base truncate">งานขยายของฉัน</h3>
              <p className="text-[11px] text-[#6B7280] font-medium">
                {todayJobs.length
                  ? `นัดวันนี้ ${todayJobs.length} · เปิดอยู่ ${openJobs.length}`
                  : `เปิดอยู่ ${openJobs.length} งาน`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/ais-expansion')}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-[#A3E635]/40 bg-[#A3E635]/15 text-[#1F2937] shrink-0"
          >
            ดูทั้งหมด
          </button>
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2].map((i) => <div key={i} className="h-20 rounded-xl bg-[#F3F4F6]" />)}
          </div>
        ) : checklist.length === 0 ? (
          <div className="text-center py-8 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB]">
            <p className="text-sm font-bold text-[#9CA3AF] mb-3">ยังไม่มีงานขยายที่ต้องทำ</p>
            <button
              type="button"
              onClick={() => navigate('/ais-expansion')}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#1F2937]"
              style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
            >
              + สร้างงานขยาย
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {checklist.map((job) => (
              <div
                key={job.id}
                className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3"
              >
                <button
                  type="button"
                  onClick={() => navigate('/ais-expansion')}
                  className="w-full text-left"
                >
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 border border-violet-200">
                      {STATUS_LABEL[job.status] || job.status}
                    </span>
                    {job.follow_up_at && String(job.follow_up_at).slice(0, 10) === todayISO && (
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                        นัดวันนี้
                      </span>
                    )}
                  </div>
                  <p className="font-black text-[#1F2937] text-sm truncate">
                    {job.customer_name || 'ไม่ระบุชื่อ'}
                  </p>
                  <p className="text-xs text-[#6B7280] truncate">
                    {job.phone || 'ไม่มีเบอร์'}
                    {job.address ? ` · ${job.address}` : ''}
                  </p>
                </button>
                <div className="grid grid-cols-3 gap-2 mt-2.5">
                  <button
                    type="button"
                    disabled={!job.phone}
                    onClick={() => callPhone(job.phone)}
                    className="min-h-[44px] rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white disabled:opacity-35"
                  >
                    📞 โทร
                  </button>
                  <button
                    type="button"
                    disabled={!(job.lat || job.address)}
                    onClick={() => openMaps(job)}
                    className="min-h-[44px] rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white disabled:opacity-35"
                  >
                    🗺️ นำทาง
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/ais-expansion')}
                    className="min-h-[44px] rounded-xl text-xs font-black text-[#1F2937]"
                    style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
                  >
                    เปิดงาน
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compact shortcuts */}
      <div className="grid grid-cols-3 gap-2">
        <ShortcutBtn icon="📍" label="เช็คอิน"
          onClick={() => navigate('/checkin')} gradient="from-[#A3E635] to-[#65a30d]" shadow="shadow-lime-500/25" />
        <ShortcutBtn icon="🏁" label="เช็คเอาท์"
          onClick={handleCheckoutClick} gradient="from-[#1F2937] to-[#374151]" shadow="shadow-slate-500/25" />
        <ShortcutBtn icon="⛽" label="น้ำมัน"
          onClick={() => navigate('/oil')} gradient="from-amber-500 to-orange-500" shadow="shadow-amber-500/25" />
      </div>
    </div>
  );
}
