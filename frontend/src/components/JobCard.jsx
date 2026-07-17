import { useState } from 'react';
import Swal from 'sweetalert2';

const STATUS_MAP = {
  pending:    { label: 'รอดำเนินการ', color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
  in_progress:{ label: 'กำลังดำเนินการ', color: 'text-[#185FA5]', bg: 'bg-[#B5D4F4]', border: 'border-[#185FA5]/20' },
  completed:  { label: 'เสร็จสิ้น',     color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
};

export default function JobCard({ job, index, onComplete, onIncomplete, onPostpone, onCancelCompletion, isSelected, onToggleSelect, onEdit, onDelete, onSetOff, onArrive, onCardClick }) {
  const [expanded, setExpanded] = useState(false);
  const st = STATUS_MAP[job.status] || STATUS_MAP.pending;
  const isCompleted = job.status === 'completed';

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    } catch (err) {
      return '-';
    }
  };

  const handleStatusClick = (e) => {
    if (job.status === 'failed') {
      e.stopPropagation();
      Swal.fire({
        title: 'สาเหตุที่ล้มเหลว',
        text: job.fail_reason || job.remark || 'ไม่มีรายละเอียดระบุไว้',
        icon: 'info',
        confirmButtonText: 'ปิด',
        confirmButtonColor: '#185FA5',
        customClass: { popup: 'rounded-3xl' }
      });
    }
  };

  return (
    <div
      className={`rounded-2xl transition-colors transition-shadow duration-300 overflow-hidden border ${
        isCompleted ? ' border-white/50 opacity-80' : 'glass border-white/50 shadow-sm hover:border-brand-300 hover:shadow-md'
      }`}>
      
      {/* ── Header Area ─────────────────────────── */}
      <div 
        className="p-4 cursor-pointer flex gap-4"
        onClick={() => onCardClick ? onCardClick(job) : setExpanded(!expanded)}>
        
        {/* Status Icon Indicator */}
        <div className="shrink-0 mt-0.5 flex flex-col items-center gap-2">
          {onToggleSelect && (
            <input 
              type="checkbox" 
              checked={isSelected || false}
              onChange={(e) => { e.stopPropagation(); onToggleSelect(job.id); }}
              className="w-4 h-4 cursor-pointer text-brand-600 rounded border-slate-300 focus:ring-brand-500"
            />
          )}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${st.bg} ${st.border}`}>
            {isCompleted ? '✅' : '📋'}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className={`font-bold text-base truncate ${isCompleted ? 'text-[#378ADD] line-through' : 'text-[#042C53]'}`}>
              {job.access_no || 'ไม่ระบุ Access No.'}
            </h3>
            <div className="flex items-center gap-2">
              {onEdit && (
                <button onClick={(e) => { e.stopPropagation(); onEdit(job); }} className="p-1 rounded-md text-[#378ADD] hover:bg-white/50 hover:text-[#0C447C] transition-colors" title="แก้ไข">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                </button>
              )}
              {onDelete && (
                <button onClick={(e) => { e.stopPropagation(); onDelete(job); }} className="p-1 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="ลบ">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
              <span 
                onClick={job.status === 'failed' ? handleStatusClick : undefined}
                className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-md border ${st.color} ${st.bg} ${st.border} ${job.status === 'failed' ? 'cursor-pointer hover:opacity-80' : ''}`}
                title={job.status === 'failed' ? 'คลิกเพื่อดูสาเหตุ' : ''}>
                {st.label}
              </span>
            </div>
          </div>
          
          <div className="flex flex-col gap-1 mb-2">
            <p className="text-sm text-[#185FA5] truncate">{job.customer || 'ไม่ระบุชื่อลูกค้า'}</p>
            {job.team_name && (
              <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 self-start px-2 py-0.5 rounded-md border border-emerald-100">
                👨‍🔧 {job.team_name}
              </p>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#378ADD]">
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#378ADD] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <span className="truncate max-w-[150px]">{job.address || job.site || 'ไม่ระบุสถานที่'}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-[#378ADD] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
              {formatTime(job.plan_arrival_time || job.plan_arrival_date || job.assigned_time) || '-'}
            </span>
          </div>

          {job.remark && job.remark.includes('[เลื่อนจาก') && (() => {
            const matches = [...job.remark.matchAll(/\[(เลื่อนจาก[^\]]+)\]/g)];
            if (matches.length > 0) {
              const latestNotice = matches[matches.length - 1][1];
              return (
                <div className="flex items-center gap-1.5 mt-2.5 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg text-xs font-bold shadow-sm animate-pulse-slow">
                  <span className="text-sm">⚠️</span> 
                  <span className="truncate">{latestNotice}</span>
                </div>
              );
            }
            return null;
          })()}

          {/* Action Buttons always visible */}
          <div className="flex gap-2 flex-wrap sm:flex-nowrap w-full mt-3 pt-3 border-t border-white/30">
            <button
              onClick={(e) => { e.stopPropagation(); window.open(`https://maps.google.com/?q=${job.lat},${job.lng}`, '_blank'); }}
              disabled={!job.lat}
              className="flex-1 h-10 rounded-xl glass border border-white/50 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#185FA5] hover:bg-white/50 transition-colors disabled:opacity-50">
              <svg className="w-4 h-4 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/></svg>
              นำทาง
            </button>
            
            {!isCompleted && onComplete && (
              <div className="flex-[2] flex gap-1.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onComplete(job); }}
                  className="flex-1 h-10 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 border border-emerald-500/20 flex items-center justify-center gap-1 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/40 transition-all active:scale-[0.98]">
                  ✅ จบงาน
                </button>
                {onIncomplete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onIncomplete(job); }}
                    className="flex-1 h-10 rounded-xl bg-gradient-to-r from-red-400 to-red-600 border border-red-500/20 flex items-center justify-center gap-1 text-xs font-bold text-white shadow-md shadow-red-500/20 hover:shadow-red-500/40 transition-all active:scale-[0.98]" title="ไม่จบงาน">
                    ✕ ไม่จบ
                  </button>
                )}
                {onPostpone && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onPostpone(job); }}
                    className="flex-1 h-10 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 border border-amber-500/20 flex items-center justify-center gap-1 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:shadow-amber-500/40 transition-all active:scale-[0.98]" title="เลื่อนงาน">
                    📅 เลื่อน
                  </button>
                )}
              </div>
            )}
            
            {isCompleted && onCancelCompletion && (
              <button
                onClick={(e) => { e.stopPropagation(); onCancelCompletion(job); }}
                className="flex-[1.5] h-10 rounded-xl bg-gradient-to-r from-red-400 to-red-600 border border-red-500/20 flex items-center justify-center gap-1.5 text-xs font-bold text-white shadow-md shadow-red-500/20 hover:shadow-red-500/40 transition-all active:scale-[0.98]">
                ❌ ยกเลิกการจบงาน
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Expanded Detail Area ─────────────────── */}
      <div className={`transition-all duration-300 ease-in-out ${expanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pb-4 border-t border-white/30 pt-4 ">
          <p className="text-xs font-semibold text-[#378ADD] mb-1.5 uppercase tracking-wider">รายละเอียดงาน (แตะเพื่อย่อ)</p>
          <p className="text-sm text-[#042C53] leading-relaxed">
            {job.package || job.service_note || job.remark || job.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
          </p>
        </div>
      </div>
    </div>
  );
}
