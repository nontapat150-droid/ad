import { getJobStatusBadgeClass, getJobStatusLabel } from '../../constants/jobStatus';
import { extractHHMM } from '../../utils/thaiDate';
import Swal from 'sweetalert2';

// ─── Shared Dashboard Components ────────────────────────────────────────────
// Palette: Charcoal #1F2937 · Lime #A3E635 · Soft Gray #F3F4F6

export function StatCard({ title, value, suffix, gradient, icon, shadow, urgent, onClick }) {
  const interactive = typeof onClick === 'function';
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl group text-left w-full ${
        interactive ? 'cursor-pointer' : 'cursor-default'
      } ${
        urgent ? 'border-red-300 bg-red-50 dark:bg-red-900/30' : 'border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
      style={urgent ? {} : { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* Lime top accent bar */}
      <div className={`h-1 w-full ${urgent ? 'bg-red-400' : 'bg-gradient-to-r from-[#A3E635] to-[#65a30d]'}`} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl shadow-md ${shadow} mb-4 group-hover:scale-110 transition-transform duration-300`}>
            {icon}
          </div>
          {urgent && (
            <span className="text-[10px] font-bold text-red-600 bg-red-100 border border-red-200 px-2 py-0.5 rounded-lg animate-pulse">
              รอดำเนินการ
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-3xl font-black text-[#1F2937] dark:text-slate-100">{value}</span>
          <span className="text-sm font-medium text-[#6B7280] dark:text-slate-400">{suffix}</span>
        </div>
        <p className="text-xs font-medium text-[#6B7280] dark:text-slate-400 mt-1 truncate">{title}</p>
        {interactive && (
          <p className="text-[10px] font-bold text-[#65a30d] mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            แตะเพื่อเปิดคิว →
          </p>
        )}
      </div>
    </Tag>
  );
}

export function ShortcutBtn({ icon, label, sublabel, onClick, gradient, shadow }) {
  return (
    <button
      onClick={onClick}
      className={`relative overflow-hidden flex items-center gap-3 p-4 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg ${shadow} hover:shadow-xl hover:-translate-y-1 transition-all duration-300 active:scale-[0.97] group text-left w-full`}
    >
      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/8 transition-colors" />
      <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center text-xl backdrop-blur-sm shrink-0 group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-white font-bold text-sm leading-tight">{label}</div>
        {sublabel && <div className="text-white/60 text-xs truncate mt-0.5">{sublabel}</div>}
      </div>
    </button>
  );
}

export function ProgressCard({ title, icon, current, target, suffix, pct, gradient, trackColor, barColor }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-[#E5E7EB] dark:border-slate-700 hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl shadow-md`}>
            {icon}
          </div>
          <p className="text-sm font-bold text-[#1F2937] dark:text-slate-100">{title}</p>
        </div>
        <div className="text-lg font-black text-[#A3E635]">{pct}%</div>
      </div>
      <div className="flex items-baseline gap-1 mb-3">
        <span className="text-3xl font-black text-[#1F2937] dark:text-slate-100">{current}</span>
        <span className="text-sm text-[#6B7280] dark:text-slate-400">/ {target} {suffix}</span>
      </div>
      <div className={`w-full ${trackColor} rounded-full h-2.5 overflow-hidden`}>
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-1000 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function hasJobCoords(job) {
  const lat = parseFloat(job?.lat);
  const lng = parseFloat(job?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function openJobMaps(job) {
  if (hasJobCoords(job)) {
    window.open(
      `https://www.google.com/maps?q=${parseFloat(job.lat)},${parseFloat(job.lng)}`,
      '_blank',
      'noopener,noreferrer'
    );
    return true;
  }
  Swal.fire({
    icon: 'warning',
    title: 'ยังไม่มีตำแหน่ง',
    text: 'แอดมินยังไม่ได้ลงตำแหน่ง (ละติจูด/ลองจิจูด) สำหรับงานนี้',
    confirmButtonText: 'เข้าใจแล้ว',
    confirmButtonColor: '#1F2937',
  });
  return false;
}

function callJobPhone(phone) {
  if (!phone) return;
  const cleaned = String(phone).replace(/[^0-9+]/g, '');
  if (cleaned) window.location.href = `tel:${cleaned}`;
}

/** Quick-tap chips to fill text fields with less typing */
export function PresetChips({ options, value, onPick, className = '' }) {
  if (!options?.length) return null;
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {options.map((opt) => {
        const active = value === opt || (value && String(value).includes(opt));
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onPick(opt)}
            className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all active:scale-[0.97] ${
              active
                ? 'bg-[#A3E635]/25 border-[#A3E635] text-[#1F2937]'
                : 'bg-white border-[#E5E7EB] text-[#374151] hover:border-[#A3E635]'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** One-tap call admin (phone from system settings) */
export function AdminContactButton({ phone, lineId, compact = false, className = '' }) {
  const cleaned = phone ? String(phone).replace(/[^0-9+]/g, '') : '';
  if (!cleaned && !lineId) return null;

  if (compact) {
    return (
      <div className={`flex items-center gap-1.5 ${className}`}>
        {cleaned && (
          <a
            href={`tel:${cleaned}`}
            className="min-h-[40px] min-w-[40px] px-2.5 inline-flex items-center justify-center gap-1 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-[#F9FAFB] text-[#1F2937] hover:border-[#A3E635] active:scale-95"
            title="โทรหาแอดมิน"
          >
            📞<span className="hidden sm:inline">แอดมิน</span>
          </a>
        )}
        {lineId && (
          <a
            href={`https://line.me/ti/p/${encodeURIComponent(lineId.replace(/^@/, ''))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] min-w-[40px] px-2.5 inline-flex items-center justify-center gap-1 rounded-xl text-xs font-bold border border-[#06C755]/40 bg-[#06C755]/10 text-[#06C755] active:scale-95"
            title="Line แอดมิน"
          >
            LINE
          </a>
        )}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 ${lineId && cleaned ? 'sm:grid-cols-2' : ''} gap-2 ${className}`}>
      {cleaned && (
        <a
          href={`tel:${cleaned}`}
          className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl font-bold text-sm text-[#1F2937] active:scale-[0.97]"
          style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
        >
          📞 โทรหาแอดมิน
        </a>
      )}
      {lineId && (
        <a
          href={`https://line.me/ti/p/${encodeURIComponent(String(lineId).replace(/^@/, ''))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="min-h-[48px] flex items-center justify-center gap-2 rounded-2xl font-bold text-sm bg-[#06C755] text-white active:scale-[0.97]"
        >
          LINE แอดมิน
        </a>
      )}
    </div>
  );
}

/** Mobile-first job card with large Call / Map / Open / Reschedule actions */
export function TechJobActionCard({
  job,
  jobType = 'office',
  overdue = false,
  onOpen,
  onReschedule,
}) {
  const code = jobType === 'ma'
    ? (job.display_non || job.non_number || job.access_no || '-')
    : (job.access_no || '-');
  const timeLabel = extractHHMM(job.plan_arrival_time || job.job_time);
  const dateLabel = job.plan_arrival_date
    ? new Date(job.plan_arrival_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
    : null;
  const canCall = Boolean(job.phone);
  const statusKey = overdue ? 'overdue' : (job.status || 'pending');
  const canReschedule = typeof onReschedule === 'function' && !['completed', 'failed'].includes(job.status);

  return (
    <div className={`rounded-2xl border p-4 ${
      overdue
        ? 'border-red-200 bg-red-50/60'
        : 'border-[#E5E7EB] bg-white'
    }`}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${
              jobType === 'ma'
                ? 'bg-violet-50 text-violet-700 border-violet-200'
                : 'bg-sky-50 text-sky-700 border-sky-200'
            }`}>
              {jobType === 'ma' ? 'MA' : 'ติดตั้ง'}
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${getJobStatusBadgeClass(statusKey)}`}>
              {getJobStatusLabel(statusKey)}
            </span>
          </div>
          <p className={`font-black text-base truncate ${overdue ? 'text-red-800' : 'text-[#1F2937]'}`}>{code}</p>
          <p className={`text-sm truncate ${overdue ? 'text-red-600' : 'text-[#6B7280]'}`}>
            {job.customer || 'ไม่ระบุลูกค้า'}
          </p>
          {(dateLabel || timeLabel) && (
            <p className={`text-[11px] font-medium mt-1 ${overdue ? 'text-red-400' : 'text-[#9CA3AF]'}`}>
              📅 {[dateLabel, timeLabel ? `${timeLabel} น.` : null].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className={`grid gap-2 ${canReschedule ? 'grid-cols-2' : 'grid-cols-3'}`}>
        <button
          type="button"
          disabled={!canCall}
          onClick={(e) => { e.stopPropagation(); callJobPhone(job.phone); }}
          className="min-h-[48px] rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all active:scale-[0.97] disabled:opacity-35 disabled:cursor-not-allowed bg-white border-[#E5E7EB] text-[#1F2937] hover:border-[#A3E635]"
        >
          <span className="text-base">📞</span>
          โทร
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); openJobMaps(job); }}
          className="min-h-[48px] rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all active:scale-[0.97] bg-white border-[#E5E7EB] text-[#1F2937] hover:border-[#A3E635]"
        >
          <span className="text-base">🗺️</span>
          นำทาง
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen?.(job); }}
          className="min-h-[48px] rounded-xl font-black text-xs flex flex-col items-center justify-center gap-0.5 transition-all active:scale-[0.97] text-[#1F2937]"
          style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
        >
          <span className="text-base">▶️</span>
          เปิดงาน
        </button>
        {canReschedule && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onReschedule(job); }}
            className="min-h-[48px] rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 border transition-all active:scale-[0.97] bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
          >
            <span className="text-base">📅</span>
            นัดเวลาอีกครั้ง
          </button>
        )}
      </div>
    </div>
  );
}

/** Friendly API error → title / message / tip for techs & admins */
export function friendlyJobError(err, fallback = 'เกิดข้อผิดพลาด กรุณาลองใหม่') {
  const data = err?.response?.data || {};
  const raw = data.error || data.details || data.message || err?.message || '';
  const msg = String(raw).replace(/^DB Error:\s*/i, '').trim();
  const tipFromApi = data.tip ? String(data.tip).trim() : '';
  const status = err?.response?.status;

  const pack = (title, text, tip) => ({
    title,
    text: text || fallback,
    tip: tipFromApi || tip || '',
  });

  if (/ไม่เพียงพอ|สินค้า.*ไม่พอ|อุปกรณ์.*ไม่พอ|insufficient|quantity/i.test(msg)) {
    return pack(
      'สินค้าในกระเป๋าไม่พอ',
      msg || 'จำนวนสินค้าในกระเป๋าไม่พอสำหรับปิดงานนี้',
      'แจ้งแอดมินให้เติมสินค้าเข้ากระเป๋าทีม หรือลดจำนวนที่ใช้ แล้วลองปิดงานอีกครั้ง'
    );
  }
  if (/ไม่พบอุปกรณ์|ไม่พบสินค้า|ไม่พบ.*กระเป๋า|ไม่อยู่ในกระเป๋า/i.test(msg)) {
    return pack(
      'ไม่พบสินค้าในกระเป๋า',
      msg || 'ไม่พบสินค้าที่เลือกในกระเป๋าช่าง',
      'รีเฟรชแล้วเลือกสินค้าใหม่ หากยังไม่มี ให้แจ้งแอดมินเบิก/จ่ายสินค้าเข้ากระเป๋าทีมก่อนปิดงาน'
    );
  }
  if (/เลือกอุปกรณ์ซ้ำ|ซ้ำกันในรายการ/i.test(msg)) {
    return pack(
      'เลือกสินค้าซ้ำ',
      msg || 'มีสินค้าถูกเลือกซ้ำในรายการ',
      'ตรวจสอบรายการอุปกรณ์ที่เลือก เอาชิ้นที่ซ้ำออก แล้วบันทึกอีกครั้ง'
    );
  }
  if (/รูป|image|upload|file too large|payload/i.test(msg) || status === 413) {
    return pack(
      'อัปโหลดรูปไม่สำเร็จ',
      msg || 'ไม่สามารถอัปโหลดรูปหลักฐานได้',
      'ลดขนาดรูปหรือจำนวนรูป แล้วลองใหม่ (สูงสุด 40 รูป) ตรวจสัญญาณอินเทอร์เน็ตด้วย'
    );
  }
  if (/สิทธิ์|403|forbidden|ไม่อยู่ในความรับผิดชอบ|does not belong/i.test(msg) || status === 403) {
    return pack(
      'ไม่มีสิทธิ์ทำรายการนี้',
      msg || 'งานนี้อาจยังไม่ถูกมอบหมายให้คุณ',
      'แจ้งแอดมินตรวจสอบการมอบหมายทีม/ช่าง แล้วลองใหม่'
    );
  }
  if (/ปิดแล้ว|already completed|409/i.test(msg) || status === 409) {
    return pack(
      'งานนี้ปิดไปแล้ว',
      msg || 'สถานะงานถูกปิดไปก่อนหน้านี้',
      'รีเฟรชหน้ารายการงานเพื่อดูสถานะล่าสุด หากต้องแก้ข้อมูลให้แจ้งแอดมิน'
    );
  }
  if (/กรุณาอัปโหลดรูป|อย่างน้อย 1 รูป/i.test(msg)) {
    return pack(
      'ยังไม่มีรูปหลักฐาน',
      msg,
      'แนบรูปปิดงานอย่างน้อย 1 รูป แล้วกดยืนยันอีกครั้ง'
    );
  }
  if (/กรุณาระบุสาเหตุ|กรุณาเลือกวันที่/i.test(msg)) {
    return pack('ข้อมูลไม่ครบ', msg, 'กรอกข้อมูลที่ระบบขอให้ครบ แล้วบันทึกอีกครั้ง');
  }
  if (!err?.response) {
    return pack(
      'เชื่อมต่อไม่สำเร็จ',
      'สัญญาณอาจหลุดหรือเซิร์ฟเวอร์ตอบช้า',
      'ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง — ข้อมูลที่กรอกมักยังอยู่ในฟอร์มเดิม'
    );
  }
  if (/network|timeout|Failed to fetch|ERR_|ECONN|Network Error/i.test(msg)) {
    return pack(
      'เชื่อมต่อไม่สำเร็จ',
      'สัญญาณอาจหลุดหรือเซิร์ฟเวอร์ตอบช้า',
      'ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง — ข้อมูลที่กรอกมักยังอยู่ในฟอร์มเดิม'
    );
  }
  if (/Server error|Internal/i.test(msg) && !msg.includes('ไม่')) {
    return pack(
      'ระบบมีปัญหาชั่วคราว',
      'เซิร์ฟเวอร์บันทึกไม่สำเร็จ',
      'ลองใหม่อีกครั้งในสักครู่ หากยังไม่ได้ ให้แจ้งแอดมินพร้อมบอกเลขงาน/เวลาที่เกิดปัญหา'
    );
  }

  return pack(
    'บันทึกไม่สำเร็จ',
    msg || fallback,
    tipFromApi || 'ลองใหม่อีกครั้ง หากยังไม่ได้ ให้แจ้งแอดมินพร้อมข้อความนี้'
  );
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Show a clear error dialog with problem + how to fix */
export function showFriendlyError(err, fallback) {
  const f = friendlyJobError(err, fallback);
  const tipHtml = f.tip
    ? `<div style="margin-top:12px;padding:12px 14px;border-radius:12px;background:#FFFBEB;border:1px solid #FCD34D;text-align:left">
         <p style="margin:0;font-size:12px;font-weight:800;color:#92400E">💡 วิธีแก้</p>
         <p style="margin:6px 0 0;font-size:13px;line-height:1.45;color:#78350F;white-space:pre-line">${escapeHtml(f.tip)}</p>
       </div>`
    : '';
  return Swal.fire({
    icon: 'error',
    title: f.title,
    html: `<div style="text-align:left">
      <p style="margin:0;font-size:14px;line-height:1.5;color:#374151;white-space:pre-line">${escapeHtml(f.text)}</p>
      ${tipHtml}
    </div>`,
    confirmButtonText: 'เข้าใจแล้ว',
    confirmButtonColor: '#1F2937',
  });
}
