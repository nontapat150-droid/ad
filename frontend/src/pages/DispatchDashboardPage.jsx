import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import JobDispatchModal from '../components/JobDispatchModal';
import AutoDispatchModal from '../components/AutoDispatchModal';
import EditJobModal from '../components/EditJobModal';
import SmartImportExcelModal from '../components/SmartImportExcelModal';
import CompleteJobModal from '../components/CompleteJobModal';
import { IncompleteJobModal, PostponeJobModal } from '../components/JobActionModals';
import CompleteMaJobModal from '../components/CompleteMaJobModal';
import ImageWithFallback from '../components/common/ImageWithFallback';
import axios from '../api/axios';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import ManualModal from '../components/ManualModal';
import Swal from 'sweetalert2';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FilterDateField, FilterSelectField, AppDateField, AppTimeField, AppSelectField } from '../components/DispatchFilterFields';
import { getJobStatusLabel, getJobStatusBadgeClass, getJobStatusDotClass } from '../constants/jobStatus';
import { AdminContactButton } from '../components/dashboards/SharedComponents';
import { useBranding } from '../context/BrandingContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

/* ─────────────────────────────────────────────────────────
   STATUS helpers (shared constants)
───────────────────────────────────────────────────────── */
const STATUS_LABEL = (status) => getJobStatusLabel(status);
const STATUS_COLOR = (status) => getJobStatusBadgeClass(status);
const STATUS_DOT = (status) => getJobStatusDotClass(status);

/**
 * ปิดงานล่าช้า = ปิดหลัง 00:00 ของ 2 วันต่อมา
 * เช่น ถ้านัด 15 ก.ค. ต้องปิดภายใน 16 ก.ค. 23:59:59 (เลย 17 ก.ค. 00:00 จะถือว่าล่าช้า)
 */
function isLateCompletion(job) {
  if (job.status !== 'completed' || !job.completed_at) return false;
  const targetDateStr = job.plan_arrival_date || job.assigned_time;
  if (!targetDateStr) return false;
  
  const datePart = targetDateStr.split('T')[0]; // YYYY-MM-DD
  const [y, m, d] = datePart.split('-');
  const deadline = new Date(y, m - 1, d); // 00:00:00 local time of the plan date
  deadline.setDate(deadline.getDate() + 2); // 00:00:00 of 2 days later
  
  const completedAt = new Date(job.completed_at);
  return completedAt >= deadline;
}

/**
 * งานเลื่อนที่ยังไม่ได้รับมอบหมายทีม = postponed + !team_id
 */
function isPostponedUnassigned(job) {
  return job.status === 'postponed' && !job.team_id;
}

/**
 * งาน postponed ที่ถึงวันนัดใหม่แล้ว แต่ยังไม่ได้ assign = active เป็น "urgent unassigned"
 * งาน postponed ที่ถึงวันนัดแล้วและมี team = จะแสดงเป็นงานปกติในวันนั้น
 */
function getEffectiveStatus(job, today) {
  if (!job.status || job.status === 'pending') {
    if (job.plan_arrival_date && job.plan_arrival_date.split('T')[0] < today) return 'overdue';
    return 'pending';
  }
  // งาน postponed ที่ถึงวันนัดใหม่แล้ว → ถือว่ากลับมาเป็น pending/overdue
  if (job.status === 'postponed' && job.plan_arrival_date) {
    const reschedDate = job.plan_arrival_date.split('T')[0];
    if (reschedDate <= today) {
      // ถึงวันนัดแล้ว — re-activate
      return reschedDate < today ? 'overdue' : 'pending';
    }
  }
  return job.status;
}

/* ─────────────────────────────────────────────────────────
   JOB CARD COMPONENT
───────────────────────────────────────────────────────── */
function JobCard({ job, today, isAdmin, onCardClick, onSelect, isSelected }) {
  const status = getEffectiveStatus(job, today);
  const isLate = isLateCompletion(job);
  // งาน postponed ที่ยังไม่ได้รับมอบหมายทีม = แสดงการ์ดแดง
  const isPostponeNoTeam = isPostponedUnassigned(job);
  // งาน postponed ที่ถึงวันแล้ว (re-activated)
  const isReactivated = job.status === 'postponed' && job.plan_arrival_date && job.plan_arrival_date.split('T')[0] <= today;

  // card border / bg
  let cardBorder = 'border-[#E5E7EB] hover:border-[#A3E635]/50';
  let cardBg = 'bg-white';
  if (isSelected) {
    cardBorder = 'border-[#A3E635] shadow-[0_0_0_3px_rgba(163,230,53,0.2)]';
  } else if (isPostponeNoTeam) {
    // postponed แต่ยังไม่ได้ assign ทีม → แดง เพื่อแจ้งเตือน admin
    cardBorder = 'border-red-400 shadow-[0_0_0_2px_rgba(239,68,68,0.15)]';
    cardBg = 'bg-red-50';
  }

  return (
    <div
      onClick={() => onCardClick(job)}
      className={`relative rounded-2xl border-2 shadow-sm cursor-pointer active:scale-[0.98] transition-all duration-150 select-none overflow-hidden hover:shadow-md ${cardBg} ${cardBorder}`}
    >
      {/* Left accent bar based on status */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${isPostponeNoTeam ? 'bg-red-500' : STATUS_DOT(status)}`} />

      <div className="pl-3 pr-4 py-3.5">
        {/* Top row: Access No + Status + Checkbox (admin) */}
        <div className="flex items-start gap-2">
          {isAdmin && (
            <div
              onClick={e => { e.stopPropagation(); onSelect(job.id); }}
              className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-[#A3E635] border-[#A3E635]' : 'border-[#D1D5DB] hover:border-[#A3E635]'}`}
            >
              {isSelected && <svg className="w-2.5 h-2.5 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-sm font-black text-[#1F2937] tracking-wide">{job.access_no || '-'}</span>
              {job.seq && <span className="text-[10px] font-bold bg-[#1F2937] text-white px-1.5 py-0.5 rounded-md">#{job.seq}</span>}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR(status)}`}>
                {isReactivated && !isPostponeNoTeam ? 'รอดำเนินการ (เลื่อน)' : STATUS_LABEL(status)}
              </span>
              {isLate && <span className="text-[10px] font-bold bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">⚠️ ล่าช้า</span>}
              {isPostponeNoTeam && isAdmin && (
                <span className="text-[10px] font-bold bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">🚨 ยังไม่มอบหมาย</span>
              )}
            </div>

            {/* Customer name */}
            <p className="text-sm font-semibold text-[#374151] truncate">{job.customer || 'ไม่ระบุชื่อ'}</p>

            {/* Address */}
            {job.address && (
              <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-2 leading-snug">{job.address}</p>
            )}

            {/* Bottom row: team + date */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {job.team_name && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4F46E5] bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  {job.team_name}
                </span>
              )}
              {!job.team_name && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                  isAdmin ? 'text-red-600 bg-red-50 border-red-200 font-bold' : 'text-[#9CA3AF] bg-[#F9FAFB] border-[#E5E7EB]'
                }`}>{isAdmin ? '⚠️ ยังไม่ระบุทีม' : 'ยังไม่ระบุทีม'}</span>
              )}
              {job.plan_arrival_date && (
                <span className="text-[11px] text-[#9CA3AF] font-medium flex items-center gap-1">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  {new Date(job.plan_arrival_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                  {job.plan_arrival_time && ` ${typeof job.plan_arrival_time === 'string' ? job.plan_arrival_time.substring(0,5) : ''}`}
                </span>
              )}
              {job.phone && (
                <a href={`tel:${job.phone}`} onClick={e => e.stopPropagation()} className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 hover:underline">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  {job.phone}
                </a>
              )}
            </div>

            {/* Postpone labels */}
            {job.status === 'postponed' && job.plan_arrival_date && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {isReactivated ? (
                  <div className="text-[11px] font-bold text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2 py-1 inline-flex items-center gap-1">
                    ⏰ ถึงวันนัดแล้ว — {new Date(job.plan_arrival_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                    {isPostponeNoTeam && isAdmin && <span className="ml-1 text-red-600">(รอมอบหมาย!)</span>}
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 rounded-lg px-2 py-1 inline-block">
                    📅 นัดใหม่: {new Date(job.plan_arrival_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chevron indicator */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D1D5DB]">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   PHONE SELECTOR — supports multiple phone numbers
───────────────────────────────────────────────────────── */
function PhoneSelector({ phone }) {
  if (!phone) return null;
  // Split by comma, slash, or space-separated multiple numbers
  const numbers = phone
    .split(/[,\/\s]+/)
    .map(n => n.trim())
    .filter(n => /[0-9]/.test(n));

  if (numbers.length <= 1) {
    return (
      <a
        href={`tel:${phone}`}
        onClick={e => e.stopPropagation()}
        className="text-[11px] font-medium text-emerald-600 flex items-center gap-1 hover:underline"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
        {phone}
      </a>
    );
  }

  return (
    <div className="flex flex-wrap gap-1" onClick={e => e.stopPropagation()}>
      {numbers.map((n, i) => (
        <a
          key={i}
          href={`tel:${n}`}
          className="text-[11px] font-semibold text-white bg-emerald-500 hover:bg-emerald-600 px-2 py-0.5 rounded-lg flex items-center gap-1 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          {n}
        </a>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────
   JOB DETAIL BOTTOM SHEET / MODAL
───────────────────────────────────────────────────────── */
const AUDIT_ACTION_LABEL = {
  create: { label: 'สร้างงาน', icon: '🆕', color: 'text-blue-600 bg-blue-50 border-blue-200' },
  assign: { label: 'มอบหมายงาน', icon: '👥', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  update: { label: 'แก้ไขงาน', icon: '✏️', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  complete: { label: 'จบงาน', icon: '✅', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  incomplete: { label: 'งานไม่จบ', icon: '❌', color: 'text-red-600 bg-red-50 border-red-200' },
  postpone: { label: 'เลื่อนนัด', icon: '📅', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  cancel_completion: { label: 'ยกเลิกการจบงาน', icon: '↩️', color: 'text-orange-600 bg-orange-50 border-orange-200' },
  change_team: { label: 'เปลี่ยนทีม', icon: '🔄', color: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
};

function AuditTimeline({ logs }) {
  if (!logs?.length) return null;
  return (
    <div className="bg-[#F9FAFB] rounded-xl p-3 border border-[#E5E7EB]">
      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-2">🕓 ประวัติการเปลี่ยนแปลง</p>
      <div className="space-y-2.5">
        {logs.map((log) => {
          const meta = AUDIT_ACTION_LABEL[log.action] || { label: log.action, icon: '•', color: 'text-gray-600 bg-gray-50 border-gray-200' };
          const statusChanged = log.new_status && log.new_status !== log.old_status;
          const teamChanged = String(log.old_team_id ?? '') !== String(log.new_team_id ?? '');
          const assigneeChanged = String(log.old_assignee_id ?? '') !== String(log.new_assignee_id ?? '');
          return (
            <div key={log.id} className="flex gap-2.5 items-start">
              <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${meta.color}`}>{meta.icon} {meta.label}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[#374151] leading-snug">
                  {log.actor_name && <span className="font-semibold">{log.actor_name}</span>}
                  {statusChanged && (
                    <span> · สถานะ: {log.old_status ? `${STATUS_LABEL(log.old_status)} → ` : ''}{STATUS_LABEL(log.new_status)}</span>
                  )}
                  {teamChanged && (
                    <span> · ทีม: {log.old_team_id ? (log.old_team_name || `#${log.old_team_id}`) : 'ไม่มี'} → {log.new_team_id ? (log.new_team_name || `#${log.new_team_id}`) : 'ไม่มี'}</span>
                  )}
                  {assigneeChanged && (
                    <span> · ช่าง: {log.old_assignee_id ? (log.old_assignee_name || `#${log.old_assignee_id}`) : 'ไม่มี'} → {log.new_assignee_id ? (log.new_assignee_name || `#${log.new_assignee_id}`) : 'ไม่มี'}</span>
                  )}
                </p>
                {log.remark && <p className="text-[11px] text-[#6B7280] leading-snug break-words">{log.remark}</p>}
                <p className="text-[10px] text-[#9CA3AF]">{log.created_at ? new Date(log.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JobDetailSheet({ job, today, isAdmin, mainTab, onClose, onEdit, onComplete, onIncomplete, onPostpone, onDelete, onCancelCompletion, onChangeTeam }) {
  const navigate = useNavigate();
  const [details, setDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [auditLogs, setAuditLogs] = useState([]);

  const status = job ? getEffectiveStatus(job, today) : 'pending';
  const isLate = isLateCompletion(job || {});
  const assigneeId = job?.field_engineer_id || job?.assigned_user_id;

  useEffect(() => {
    if (!job) return;
    setDetails(null);
    setLoadingDetails(true);
    axios.get(`/dispatch/jobs/${job.id}/details?type=${mainTab}`)
      .then(r => setDetails(r.data))
      .catch(() => {})
      .finally(() => setLoadingDetails(false));

    setAuditLogs([]);
    if (isAdmin) {
      axios.get(`/dispatch/jobs/${job.id}/audit?type=${mainTab}`)
        .then(r => setAuditLogs(Array.isArray(r.data) ? r.data : []))
        .catch(() => {});
    }
  }, [job?.id]);

  if (!job) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Sheet — full screen on mobile, centered modal on desktop */}
      <div className="fixed inset-x-0 bottom-0 z-[90] md:inset-0 md:flex md:items-center md:justify-center md:p-4">
        <div className="bg-white md:rounded-2xl md:max-w-lg md:w-full md:max-h-[90vh] rounded-t-3xl max-h-[90vh] flex flex-col shadow-2xl animate-[slideUp_0.25s_ease-out]">
          {/* Handle bar (mobile) */}
          <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-[#D1D5DB]" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-5 py-3 border-b border-[#E5E7EB] shrink-0">
            <div className="flex-1 min-w-0 pr-4">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-base font-black text-[#1F2937]">
                  {mainTab === 'ma' ? (job.non_number || job.display_non || job.access_no) : job.access_no}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_COLOR(status)}`}>{STATUS_LABEL(status)}</span>
                {isLate && <span className="text-xs font-bold bg-red-100 text-red-600 border border-red-200 px-2 py-0.5 rounded-full">⚠️ ปิดงานล่าช้า</span>}
              </div>
              <p className="text-sm font-semibold text-[#374151] truncate">{job.customer || '-'}</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] hover:bg-[#E5E7EB] transition-colors shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ scrollbarWidth: 'thin' }}>
            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Phone — special multi-phone selector */}
              <div className="bg-[#F9FAFB] rounded-xl p-3 border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-1">เบอร์โทร</p>
                <PhoneSelector phone={job.phone} />
              </div>
              {/* Team name + tech list */}
              <div className="bg-[#F9FAFB] rounded-xl p-3 border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-1">ทีมช่าง</p>
                <p className="text-sm font-semibold text-[#1F2937]">{job.team_name || (isAdmin ? '⚠️ ยังไม่ระบุ' : '-')}</p>
                {job.tech_names && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {job.tech_names.split(',').map((n, i) => (
                      <span key={i} className="text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-md">{n.trim()}</span>
                    ))}
                  </div>
                )}
              </div>
              {[
                { 
                  label: 'วันที่นัด', 
                  value: job.plan_arrival_date 
                    ? new Date(job.plan_arrival_date).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }) 
                    : (job.assigned_time ? new Date(job.assigned_time).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit' }) : '-') 
                },
                { 
                  label: 'เวลาเข้างาน', 
                  value: job.plan_arrival_time 
                    ? (typeof job.plan_arrival_time === 'string' 
                        ? job.plan_arrival_time.substring(0,5) 
                        : new Date(job.plan_arrival_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })) 
                    : (job.assigned_time ? new Date(job.assigned_time).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '-') 
                },
                { label: 'แพ็กเกจ', value: job.package || '-' },
                { label: 'สินค้า', value: job.product || '-' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[#F9FAFB] rounded-xl p-3 border border-[#E5E7EB]">
                  <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-sm font-semibold text-[#1F2937] break-words">{value === 'Invalid Date' ? '-' : value}</p>
                </div>
              ))}
            </div>

            {/* Address */}
            {job.address && (
              <div className="bg-[#F9FAFB] rounded-xl p-3 border border-[#E5E7EB]">
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-1">ที่อยู่ / พื้นที่</p>
                <p className="text-sm text-[#374151] leading-relaxed">{job.address}</p>
                {job.lat && job.lng && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${job.lat},${job.lng}`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-xs font-bold text-emerald-600 hover:underline">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    นำทาง Google Maps
                  </a>
                )}
              </div>
            )}

            {/* Notes */}
            {(job.service_note || job.remark) && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mb-1">หมายเหตุ / รายละเอียด</p>
                <p className="text-sm text-[#374151] leading-relaxed">{job.service_note || job.remark}</p>
              </div>
            )}

            {/* Fail reason */}
            {status === 'failed' && (job.fail_reason || job.remark) && (
              <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                <p className="text-[10px] font-bold text-red-600 uppercase tracking-wide mb-1">สาเหตุที่ไม่สำเร็จ</p>
                <p className="text-sm text-[#374151]">{job.fail_reason || job.remark}</p>
              </div>
            )}

            {/* Completion info */}
            {status === 'completed' && details && (
              <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-1.5">📋 ข้อมูลการปิดงาน</p>
                {details.completed_by_name && <p className="text-sm"><span className="font-semibold">ปิดโดย:</span> {details.completed_by_name}</p>}
                {details.completed_at && <p className="text-sm"><span className="font-semibold">เวลา:</span> {new Date(details.completed_at).toLocaleString('th-TH')}</p>}
                {details.completion_note && <p className="text-sm mt-1"><span className="font-semibold">หมายเหตุ:</span> {details.completion_note}</p>}
                {isLate && <p className="text-sm font-bold text-red-600 mt-1">⚠️ ปิดงานล่าช้ากว่ากำหนด</p>}
              </div>
            )}

            {/* Used equipment */}
            {details?.used_devices?.length > 0 && (
              <div className="bg-[#F0FDF4] rounded-xl p-3 border border-[#BBF7D0]">
                <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-2">🔧 อุปกรณ์ที่ใช้ ({details.used_devices.length})</p>
                <div className="space-y-1.5">
                  {details.used_devices.map((d, i) => (
                    <div key={i} className="text-xs text-[#374151] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      <span>{d.product_name} {d.model_name || ''} {d.sn && d.sn !== '-' ? `(SN: ${d.sn})` : ''} ×{d.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Loading details indicator */}
            {loadingDetails && (
              <div className="text-center text-sm text-[#9CA3AF] py-2">กำลังโหลดรายละเอียด...</div>
            )}

            {/* Photos */}
            {details?.images?.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide mb-2">📷 รูปภาพหลักฐาน</p>
                <div className="grid grid-cols-3 gap-2">
                  {details.images.map((img, i) => (
                    <ImageWithFallback 
                      key={i} 
                      img={img.image_path} 
                      defaultFolder="job_evidence"
                      className="w-full aspect-square object-cover rounded-xl border border-[#E5E7EB] hover:opacity-80 transition-opacity cursor-pointer" 
                      onClick={(workingUrl) => window.open(workingUrl, '_blank')}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Tech names + admin bag deep-link */}
            {(job.tech_names || (isAdmin && assigneeId)) && (
              <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide mb-1.5">👤 ช่างที่รับผิดชอบ</p>
                {job.tech_names && (
                  <div className="flex flex-wrap gap-1.5">
                    {job.tech_names.split(',').map((n, i) => <span key={i} className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-lg">{n.trim()}</span>)}
                  </div>
                )}
                {isAdmin && assigneeId && (
                  <button
                    type="button"
                    onClick={() => navigate(`/bag?user_id=${assigneeId}`)}
                    className="mt-2.5 w-full py-2 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100 transition-colors flex items-center justify-center gap-1.5"
                  >
                    🎒 ดูกระเป๋าช่างผู้รับงาน
                  </button>
                )}
              </div>
            )}

            {/* Audit trail (admin only) */}
            {isAdmin && <AuditTimeline logs={auditLogs} />}
          </div>

          {/* Action buttons — sticky bottom */}
          <div className="px-4 pb-5 pt-3 border-t border-[#E5E7EB] shrink-0 space-y-2">
            {/* Technician actions */}
            {!isAdmin && status !== 'completed' && (
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => { onClose(); onComplete(job); }} className="py-3 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-colors flex flex-col items-center gap-0.5">
                  <span className="text-lg">✅</span>จบงาน
                </button>
                <button onClick={() => { onClose(); onIncomplete(job); }} className="py-3 bg-red-500 hover:bg-red-600 active:bg-red-700 text-white rounded-xl text-sm font-bold transition-colors flex flex-col items-center gap-0.5">
                  <span className="text-lg">✕</span>ไม่จบ
                </button>
                <button onClick={() => { onClose(); onPostpone(job); }} className="py-3 bg-purple-500 hover:bg-purple-600 active:bg-purple-700 text-white rounded-xl text-sm font-bold transition-colors flex flex-col items-center gap-0.5">
                  <span className="text-lg">📅</span>เลื่อน
                </button>
              </div>
            )}

            {/* Admin actions */}
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { onEdit(job); }} className="flex-1 min-w-[100px] py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                  แก้ไขงาน
                </button>
                {status === 'completed' && <>
                  <button onClick={() => { onClose(); onCancelCompletion(job); }} className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-sm font-bold transition-colors border border-red-200">❌ ยกเลิกจบ</button>
                  <button onClick={() => { onChangeTeam(job); }} className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-sm font-bold transition-colors border border-blue-200">🔄 ทีม</button>
                </>}
                {status === 'failed' && <>
                  <button onClick={() => { onClose(); onIncomplete(job); }} className="py-2.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold transition-colors">✕ ไม่จบ</button>
                  <button onClick={() => { onClose(); onPostpone(job); }} className="py-2.5 px-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl text-sm font-bold transition-colors">📅 เลื่อน</button>
                  <button onClick={() => { onChangeTeam(job); }} className="py-2.5 px-3 bg-blue-50 text-blue-600 rounded-xl text-sm font-bold border border-blue-200">🔄 ทีม</button>
                </>}
                {(status === 'pending' || status === 'overdue') && (
                  <button onClick={() => { onClose(); onComplete(job); }} className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-colors">✅ จบงาน</button>
                )}
                <button onClick={() => { onClose(); onDelete(job.id); }} className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-sm font-bold border border-red-100 transition-colors">🗑️</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @media (min-width: 768px) {
          @keyframes slideUp {
            from { transform: scale(0.95); opacity: 0; }
            to   { transform: scale(1);    opacity: 1; }
          }
        }
      `}</style>
    </>
  );
}

/* ─────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────── */
export default function DispatchDashboardPage() {
  const { user } = useAuth();
  const { branding } = useBranding();
  const isAdmin = user && (user.roles?.some(r => ['super_admin', 'admin'].includes(r)) || ['super_admin', 'admin'].includes(user.role));
  const isMATech = user?.role === 'ma_technician' || user?.roles?.includes('ma_technician') || user?.role === 'contractor_ma' || user?.roles?.includes('contractor_ma');
  const isOfficeTech = user?.role === 'technician' || user?.roles?.includes('technician')
    || user?.role === 'office_technician' || user?.roles?.includes('office_technician')
    || user?.role === 'contractor_office' || user?.roles?.includes('contractor_office');

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  let initialMainTab = searchParams.get('tab') || 'office';
  if (!isAdmin && !isOfficeTech && isMATech && initialMainTab === 'office') initialMainTab = 'ma';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAutoModalOpen, setIsAutoModalOpen] = useState(false);
  const [isSmartImportOpen, setIsSmartImportOpen] = useState(false);
  const [smartImportJobType, setSmartImportJobType] = useState(null);
  const [showManualModal, setShowManualModal] = useState(false);

  const [actionJob, setActionJob] = useState(null);
  const [actionType, setActionType] = useState(null);
  const [detailJob, setDetailJob] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null); // for EditJobModal

  const [mainTab, setMainTab] = useState(initialMainTab);
  const [subTab, setSubTab] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [filterTeamId, setFilterTeamId] = useState('');
  const [filterUserId, setFilterUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [bulkAssignTeam, setBulkAssignTeam] = useState('');
  const [bulkAssignMode, setBulkAssignMode] = useState('team'); // team | user
  const [bulkAssignUser, setBulkAssignUser] = useState('');
  const [isReordering, setIsReordering] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, isDanger: true });
  const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!showFilters) return;
    const handleClickOutside = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilters(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setShowFilters(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showFilters]);

  const showNotification = useCallback((message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: 'success' }), 3000);
  }, []);

  useEffect(() => { fetchJobs(); fetchTeams(); fetchUsers(); }, []);
  useEffect(() => { const tab = searchParams.get('tab'); if (tab && ['office', 'ma'].includes(tab)) setMainTab(tab); }, [location.search]);
  useEffect(() => { fetchJobs(); setSelectedJobIds([]); }, [mainTab, filterDate, filterTeamId, filterUserId, searchQuery]);

  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Auto-open job from URL param ?openJob=<id>
  useEffect(() => {
    const openJobId = searchParams.get('openJob');
    if (openJobId && jobs.length > 0) {
      const found = jobs.find(j => String(j.id) === String(openJobId));
      if (found) setDetailJob(found);
    }
  }, [location.search, jobs]);

  const fetchTeams = async () => { try { const r = await axios.get('/users/teams'); setTeams(Array.isArray(r.data) ? r.data : []); } catch(e) {} };
  const fetchUsers = async () => { try { const r = await axios.get('/users'); setAllUsers(Array.isArray(r.data) ? r.data : []); } catch(e) {} };
  const fetchJobs = async () => {
    try {
      setLoading(true);
      let url = `/dispatch/jobs?type=${mainTab}`;
      if (filterDate) url += `&date=${filterDate}`;
      if (filterTeamId) url += `&team_id=${filterTeamId}`;
      if (filterUserId) url += `&user_id=${filterUserId}`;
      if (searchQuery) url += `&q=${encodeURIComponent(searchQuery)}`;
      const r = await axios.get(url);
      setJobs(Array.isArray(r.data) ? r.data : []);
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };
  const handleActionComplete = () => { fetchJobs(); setSelectedJobIds([]); };

  const filteredJobs = useMemo(() => {
    // งาน postponed ที่ "re-activated" (ถึงวันนัดใหม่แล้ว) — ถือเป็น active job ไม่ใช่เลื่อนอีกต่อไป
    const trulyPostponed  = (j) => j.status === 'postponed' && (!j.plan_arrival_date || j.plan_arrival_date.split('T')[0] > today);
    const isOverdue       = (j) => {
      if (['completed','failed'].includes(j.status)) return false;
      if (!j.plan_arrival_date) return false;
      return j.plan_arrival_date.split('T')[0] < today;
    };
    const isActive = (j) => !['completed','failed'].includes(j.status) && !trulyPostponed(j);

    switch (subTab) {
      case 'assigned':  return jobs.filter(j => (j.team_id || j.field_engineer_id || j.assigned_user_id) && isActive(j) && !isOverdue(j));
      case 'unassigned': return jobs.filter(j => !j.team_id && !j.field_engineer_id && !j.assigned_user_id && isActive(j));
      case 'incomplete_data': return jobs.filter(j => {
        if (!isActive(j)) return false;
        if (mainTab === 'ma') return !j.customer || !j.phone || !(j.non_number || j.access_no) || !j.address;
        return !j.customer || !j.phone || !j.access_no || !j.address;
      });
      case 'postponed_unassigned': return jobs.filter(j => trulyPostponed(j) && !j.team_id && !j.field_engineer_id && !j.assigned_user_id);
      case 'completed': return jobs.filter(j => j.status === 'completed');
      case 'failed':    return jobs.filter(j => j.status === 'failed');
      // postponed tab: แสดงเฉพาะงานที่ยังยังอยู่ในสถานะเลื่อน (ยังไม่ถึงวันนัด)
      case 'postponed': return jobs.filter(j => trulyPostponed(j));
      // overdue: งานที่เลยกำหนด (รวม re-activated postponed)
      case 'overdue':   return jobs.filter(j => isOverdue(j));
      case 'map':       return jobs;
      default:          return jobs;
    }
  }, [jobs, subTab, today, mainTab]);

  const stats = useMemo(() => {
    const trulyPostponed = (j) => j.status === 'postponed' && (!j.plan_arrival_date || j.plan_arrival_date.split('T')[0] > today);
    const isOverdue = (j) => {
      if (['completed','failed'].includes(j.status)) return false;
      if (!j.plan_arrival_date) return false;
      return j.plan_arrival_date.split('T')[0] < today;
    };
    const isActive = (j) => !['completed','failed'].includes(j.status) && !trulyPostponed(j);
    return {
      total:     jobs.length,
      assigned:  jobs.filter(j => (j.team_id || j.field_engineer_id || j.assigned_user_id) && isActive(j) && !isOverdue(j)).length,
      unassigned: jobs.filter(j => !j.team_id && !j.field_engineer_id && !j.assigned_user_id && isActive(j)).length,
      incomplete_data: jobs.filter(j => {
        if (!isActive(j)) return false;
        if (mainTab === 'ma') return !j.customer || !j.phone || !(j.non_number || j.access_no) || !j.address;
        return !j.customer || !j.phone || !j.access_no || !j.address;
      }).length,
      postponed_unassigned: jobs.filter(j => trulyPostponed(j) && !j.team_id && !j.field_engineer_id && !j.assigned_user_id).length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed:    jobs.filter(j => j.status === 'failed').length,
      postponed: jobs.filter(j => trulyPostponed(j)).length,
      overdue:   jobs.filter(j => isOverdue(j)).length,
      withMap:   jobs.filter(j => j.lat && j.lng).length,
    };
  }, [jobs, today, mainTab]);

  const techsForFilter = useMemo(() => {
    let t = allUsers.filter(u => ['technician','ma_technician','contractor_office','contractor_ma'].some(r => u.role === r || u.roles?.includes(r)));
    if (filterTeamId) t = t.filter(u => String(u.team_id) === String(filterTeamId));
    return t;
  }, [allUsers, filterTeamId]);

  const requestConfirm = (title, message, onConfirm, isDanger = true) => setConfirmDialog({ isOpen: true, title, message, onConfirm, isDanger });
  const handleDelete = (id) => requestConfirm('ยืนยันลบงาน', 'ลบงานนี้?', async () => { try { await axios.delete(`/dispatch/jobs/${id}`, { params: { type: mainTab } }); handleActionComplete(); showNotification('ลบสำเร็จ'); } catch(e) { showNotification('ไม่สามารถลบได้', 'error'); } });
  const handleDeleteBulk = () => requestConfirm('ลบหลายรายการ', `ลบ ${selectedJobIds.length} งาน?`, async () => { try { await axios.delete('/dispatch/jobs/bulk', { data: { ids: selectedJobIds, type: mainTab } }); handleActionComplete(); showNotification('ลบสำเร็จ'); } catch(e) { showNotification('ผิดพลาด', 'error'); } });
  const handleBulkAssign = async () => {
    if (bulkAssignMode === 'team' && !bulkAssignTeam) return showNotification('เลือกทีม', 'error');
    if (bulkAssignMode === 'user' && !bulkAssignUser) return showNotification('เลือกช่าง', 'error');
    requestConfirm('มอบหมายงาน', `มอบหมาย ${selectedJobIds.length} งาน?`, async () => {
      try {
        const payload = {
          ids: selectedJobIds,
          type: mainTab,
          target_type: bulkAssignMode,
          target_id: bulkAssignMode === 'team' ? bulkAssignTeam : bulkAssignUser,
        };
        const r = await axios.put('/dispatch/jobs/bulk-assign', payload);
        const failed = r.data?.failed?.length || 0;
        showNotification(failed ? `มอบหมาย ${r.data.updatedCount} สำเร็จ, ล้มเหลว ${failed}` : 'มอบหมายสำเร็จ');
        setBulkAssignTeam('');
        setBulkAssignUser('');
        handleActionComplete();
      } catch (e) {
        showNotification(e.response?.data?.error || 'ผิดพลาด', 'error');
      }
    });
  };
  const handleDeleteAll = () => requestConfirm('ลบทั้งหมด', 'ลบงานที่รอดำเนินการทั้งหมด?', async () => { try { await axios.delete('/dispatch/jobs/all', { params: { type: mainTab } }); handleActionComplete(); showNotification('ลบสำเร็จ'); } catch(e) { showNotification('ผิดพลาด', 'error'); } });
  const handleClearDispatch = () => requestConfirm('ล้างจ่ายงาน', 'ยืนยัน?', async () => { try { await axios.put('/dispatch/jobs/clear-dispatch', {}); fetchJobs(); showNotification('ล้างสำเร็จ'); } catch(e) { showNotification('ผิดพลาด', 'error'); } }, false);
  const handleClearQueue = () => requestConfirm('ล้างคิว', 'ยืนยัน?', async () => { try { await axios.put('/dispatch/jobs/clear-queue', {}); fetchJobs(); showNotification('ล้างสำเร็จ'); } catch(e) { showNotification('ผิดพลาด', 'error'); } }, false);
  const handleCancelCompletion = (job) => requestConfirm('ยกเลิกจบงาน', `ยกเลิก ${job.access_no}?`, async () => { try { await axios.put(`/dispatch/jobs/${job.id}/cancel-completion`); fetchJobs(); showNotification('ยกเลิกสำเร็จ'); } catch(e) { showNotification(e.response?.data?.error || 'ผิดพลาด', 'error'); } }, true);
  const handleChangeCompletedTeam = async (job) => { try { const r = await axios.get('/users/teams'); const opts = {}; r.data.forEach(t => { opts[t.id] = t.team_name; }); const { value: nid } = await Swal.fire({ title: 'เปลี่ยนทีม', text: `ปัจจุบัน: ${job.team_name || '-'}`, input: 'select', inputOptions: opts, showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', confirmButtonColor: '#185FA5', inputValidator: v => { if (!v) return 'เลือกทีม'; if (v == job.team_id) return 'เหมือนเดิม'; } }); if (nid) { await axios.put(`/dispatch/jobs/${job.id}/change-completed-team`, { new_team_id: nid }); fetchJobs(); showNotification('เปลี่ยนทีมสำเร็จ'); } } catch(e) {} };
  const handleReorderByLocation = () => { if (!navigator.geolocation) return showNotification('ไม่รองรับ GPS', 'error'); setIsReordering(true); navigator.geolocation.getCurrentPosition(async (pos) => { try { const r = await axios.put('/dispatch/jobs/reorder-by-location', { lat: pos.coords.latitude, lng: pos.coords.longitude, type: mainTab }); showNotification(`เรียงสำเร็จ ${r.data.updated} งาน`); fetchJobs(); } catch(e) { showNotification('ผิดพลาด', 'error'); } finally { setIsReordering(false); } }, () => { setIsReordering(false); showNotification('ไม่สามารถระบุตำแหน่ง', 'error'); }, { enableHighAccuracy: true, timeout: 10000 }); };

  // Map
  const teamColors = ['#A3E635','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4'];
  const teamsWithJobs = useMemo(() => { const t = {}; jobs.forEach(j => { if (j.team_id && j.lat && j.lng) { if (!t[j.team_id]) t[j.team_id] = []; t[j.team_id].push(j); } }); return t; }, [jobs]);
  const mapCenter = jobs.find(j => j.lat && j.lng) ? [parseFloat(jobs.find(j => j.lat && j.lng).lat), parseFloat(jobs.find(j => j.lat && j.lng).lng)] : [13.7563, 100.5018];
  const createNumberedIcon = (n, color) => L.divIcon({ className: '', html: `<div style="background:${color};width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:900;font-size:11px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${n}</div>`, iconSize: [28,28], iconAnchor: [14,14] });
  const polylines = Object.keys(teamsWithJobs).map((tid, i) => { const tj = teamsWithJobs[tid].sort((a,b)=>(a.seq||0)-(b.seq||0)); return <Polyline key={tid} positions={tj.map(j=>[parseFloat(j.lat),parseFloat(j.lng)])} pathOptions={{color:teamColors[i%teamColors.length],weight:3,opacity:0.7,dashArray:'6,10'}} />; });

  const summaryCards = [
    { key:'all', label:'ทั้งหมด', value: stats.total, icon:'📋', activeClass:'bg-slate-700 text-white' },
    { key:'assigned', label:'มอบหมาย', value: stats.assigned, icon:'👥', activeClass:'bg-indigo-600 text-white' },
    { key:'unassigned', label:'ยังไม่มอบหมาย', value: stats.unassigned, icon:'📭', activeClass:'bg-slate-600 text-white' },
    { key:'incomplete_data', label:'ข้อมูลไม่ครบ', value: stats.incomplete_data, icon:'📝', activeClass:'bg-amber-600 text-white' },
    { key:'completed', label:'สำเร็จ', value: stats.completed, icon:'✅', activeClass:'bg-emerald-600 text-white' },
    { key:'failed', label:'ไม่สำเร็จ', value: stats.failed, icon:'❌', activeClass:'bg-red-600 text-white' },
    { key:'postponed', label:'เลื่อน', value: stats.postponed, icon:'📅', activeClass:'bg-purple-600 text-white' },
    { key:'postponed_unassigned', label:'เลื่อนรอมอบหมาย', value: stats.postponed_unassigned, icon:'📆', activeClass:'bg-fuchsia-700 text-white' },
    { key:'overdue', label:'เลยกำหนด', value: stats.overdue, icon:'⏰', activeClass:'bg-orange-600 text-white' },
    { key:'map', label:'แผนที่', value: stats.withMap, icon:'🗺️', activeClass:'bg-teal-600 text-white' },
  ];

  const activeFilters = [filterDate, filterTeamId, filterUserId].filter(Boolean).length;

  const teamFilterOptions = useMemo(
    () => teams.map((t) => ({ value: t.id, label: t.team_name })),
    [teams]
  );

  const techFilterOptions = useMemo(
    () => techsForFilter.map((u) => ({ value: u.id, label: u.full_name })),
    [techsForFilter]
  );

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onOpenRequest={() => setSidebarOpen(true)} activeKey="jobs" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out pb-[env(safe-area-inset-bottom)]">
        {/* ── HEADER ── */}
        <header className="bg-white border-b border-[#E5E7EB] shrink-0" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] border border-[#E5E7EB] shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#A3E635,#65a30d)' }}>
                <svg className="w-4 h-4 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
              </div>
              <h1 className="font-black text-[#1F2937] text-base md:text-lg truncate hidden sm:block">ระบบแจกจ่ายงาน</h1>
              <div className="relative flex-1 max-w-xs ml-1 min-w-0">
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder={mainTab === 'ma' ? 'ค้นหา NON / ลูกค้า / เบอร์' : 'ค้นหา Access / ลูกค้า / เบอร์'}
                  className="w-full min-h-[36px] pl-8 pr-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-xs font-medium text-[#1F2937] outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20"
                />
                <svg className="w-3.5 h-3.5 text-[#9CA3AF] absolute left-2.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" /></svg>
              </div>
            </div>
            {/* Action buttons — collapsed on mobile */}
            <div className="flex items-center gap-1.5">
              {!isAdmin && (
                <AdminContactButton
                  phone={branding?.admin_phone}
                  lineId={branding?.admin_line}
                  compact
                />
              )}
              <div className="relative" ref={filterRef}>
                <button
                  onClick={() => setShowFilters(f => !f)}
                  className={`relative w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200 ${showFilters ? 'bg-[#1F2937] text-white border-[#1F2937] shadow-md' : 'bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB] hover:bg-[#E5E7EB]'}`}
                  title="ตัวกรอง"
                  aria-expanded={showFilters}
                  aria-haspopup="true"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                  {activeFilters > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{activeFilters}</span>}
                </button>

                {showFilters && (
                  <div
                    className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(100vw-2rem,22rem)] origin-top-right animate-filterDropIn"
                    role="dialog"
                    aria-label="ตัวกรองงาน"
                  >
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.12)] overflow-hidden">
                      <div className="h-1" style={{ background: 'linear-gradient(90deg,#A3E635,#65a30d)' }} />
                      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F3F4F6]">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}>
                            <svg className="w-3.5 h-3.5 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" /></svg>
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#1F2937] leading-tight">ตัวกรอง</p>
                            {activeFilters > 0 && <p className="text-[10px] font-semibold text-[#65a30d]">ใช้งาน {activeFilters} รายการ</p>}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowFilters(false)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
                          aria-label="ปิดตัวกรอง"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>

                      <div className="p-4 space-y-4">
                        <FilterDateField
                          value={filterDate}
                          onChange={setFilterDate}
                        />

                        {isAdmin && (
                          <>
                            <FilterSelectField
                              label="ทีม"
                              placeholder="ทีมทั้งหมด"
                              value={filterTeamId}
                              onChange={(v) => { setFilterTeamId(v); setFilterUserId(''); }}
                              options={teamFilterOptions}
                              icon={
                                <svg className="w-3.5 h-3.5 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              }
                            />

                            <FilterSelectField
                              label="ช่าง"
                              placeholder="ช่างทุกคน"
                              value={filterUserId}
                              onChange={setFilterUserId}
                              options={techFilterOptions}
                              searchable
                              icon={
                                <svg className="w-3.5 h-3.5 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                              }
                            />
                          </>
                        )}
                      </div>

                      <div className="px-4 pb-4 flex items-center gap-2">
                        {activeFilters > 0 ? (
                          <button
                            onClick={() => { setFilterDate(''); setFilterTeamId(''); setFilterUserId(''); }}
                            className="flex-1 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition-colors"
                          >
                            ล้างตัวกรอง
                          </button>
                        ) : (
                          <p className="flex-1 text-[11px] text-[#9CA3AF] font-medium px-1">เลือกเงื่อนไขเพื่อกรองรายการงาน</p>
                        )}
                        <button
                          onClick={() => setShowFilters(false)}
                          className="px-4 py-2 text-xs font-bold text-[#1F2937] rounded-xl transition-all"
                          style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.25)' }}
                        >
                          เสร็จ
                        </button>
                      </div>

                      {isAdmin && (
                        <div className="border-t border-[#F3F4F6] bg-[#FAFAFA] px-4 py-3 space-y-2">
                          <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider">เครื่องมือแอดมิน</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            <button onClick={handleClearDispatch} className="px-2.5 py-2 bg-orange-50 text-orange-700 text-[11px] font-bold hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors">ล้างจ่ายงาน</button>
                            <button onClick={handleClearQueue} className="px-2.5 py-2 bg-amber-50 text-amber-700 text-[11px] font-bold hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors">ล้างคิว</button>
                            <button onClick={handleReorderByLocation} disabled={isReordering} className="px-2.5 py-2 bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 rounded-lg border border-emerald-200 disabled:opacity-50 transition-colors">{isReordering ? '⏳...' : '📍 เรียง GPS'}</button>
                            <button onClick={handleDeleteAll} className="px-2.5 py-2 bg-red-50 text-red-600 text-[11px] font-bold hover:bg-red-100 rounded-lg border border-red-200 transition-colors">🗑️ ลบทั้งหมด</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {isAdmin && <>
                <button
                  onClick={() => {
                    // Show job type picker then open smart wizard
                    setSmartImportJobType(mainTab);
                    setIsSmartImportOpen(true);
                  }}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#374151] border border-[#E5E7EB] rounded-xl text-xs font-semibold transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Excel
                </button>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all" style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)', color: '#1F2937', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' }}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                  <span className="hidden sm:inline">เพิ่มงาน</span>
                </button>
              </>}
            </div>
          </div>

          {/* Main tabs */}
          <div className="flex px-4 gap-1.5 pb-0 border-t border-[#F3F4F6]">
            {[
              { key:'office', label:'🏢 งานติดตั้ง' },
              { key:'ma', label:'🔧 งาน MA' },
            ].filter(t => isAdmin || (t.key==='office'&&isOfficeTech) || (t.key==='ma'&&isMATech)).map(tab => (
              <button key={tab.key} onClick={() => { setMainTab(tab.key); setSubTab('all'); }}
                className={`px-5 py-2.5 text-sm font-bold border-b-2 transition-all ${mainTab===tab.key ? 'border-[#A3E635] text-[#1F2937]' : 'border-transparent text-[#9CA3AF] hover:text-[#374151]'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        </header>

        {/* ── BODY ── */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl animate-pulse flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#A3E635,#65a30d)' }}>
                  <svg className="w-6 h-6 text-[#1F2937] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <span className="text-sm text-[#9CA3AF] font-medium">กำลังโหลด...</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
              {/* Summary cards — horizontal scroll on mobile */}
              <div className="px-4 pt-4 pb-2">
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                  {summaryCards.map(card => (
                    <button key={card.key} onClick={() => setSubTab(card.key)}
                      className={`flex-none flex flex-col items-center justify-center rounded-2xl px-4 py-3 min-w-[80px] border-2 transition-all active:scale-95 ${
                        subTab===card.key ? `${card.activeClass} border-transparent shadow-lg` : 'bg-white border-[#E5E7EB] text-[#374151] hover:border-[#A3E635]/50'
                      }`}>
                      <span className="text-xl mb-0.5">{card.icon}</span>
                      <span className={`text-xl font-black leading-none ${subTab===card.key ? '' : 'text-[#1F2937]'}`}>{card.value}</span>
                      <span className={`text-[10px] font-semibold mt-0.5 ${subTab===card.key ? 'opacity-90' : 'text-[#9CA3AF]'}`}>{card.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Sub-tab pills */}
              <div className="px-4 pb-3">
                <div className="flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                  {summaryCards.map(c => (
                    <button key={c.key} onClick={() => setSubTab(c.key)}
                      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${subTab===c.key ? 'bg-[#1F2937] text-white' : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F9FAFB]'}`}>
                      {c.label} {c.key!=='map' && <span className={`ml-0.5 ${subTab===c.key ? 'text-[#A3E635]' : 'text-[#9CA3AF]'}`}>{c.value}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Map View */}
              {subTab === 'map' ? (
                <div className="px-4 pb-4">
                  <div className="rounded-2xl overflow-hidden border border-[#E5E7EB] shadow-sm" style={{ height: 'calc(100dvh - 280px)', minHeight: '400px' }}>
                    <MapContainer center={mapCenter} zoom={11} className="w-full h-full">
                      <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                      {polylines}
                      {jobs.filter(j => j.lat && j.lng).map(job => (
                        <Marker key={job.id} position={[parseFloat(job.lat), parseFloat(job.lng)]}
                          icon={createNumberedIcon(job.seq||'?', job.status==='completed'?'#10b981':job.status==='failed'?'#ef4444':'#1F2937')}>
                          <Popup>
                            <div className="text-sm">
                              <strong>{job.access_no}</strong><br/>
                              {job.customer}<br/>
                              <button onClick={() => setDetailJob(job)} className="mt-1 text-xs text-blue-600 underline">ดูรายละเอียด</button>
                            </div>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                  </div>
                </div>
              ) : (
                /* Job Cards Grid */
                <div className="px-4 pb-24 md:pb-6">
                  {filteredJobs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      </div>
                      <h3 className="text-base font-bold text-[#1F2937] mb-1">ไม่มีงานในหมวดนี้</h3>
                      <p className="text-sm text-[#9CA3AF]">ลองเปลี่ยนตัวกรองหรือแท็บอื่น</p>
                      {isAdmin && (
                        <button onClick={() => setIsModalOpen(true)} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-bold transition-all" style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)', color: '#1F2937' }}>+ เพิ่มงานใหม่</button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                      {filteredJobs.map(job => (
                        <JobCard
                          key={job.id}
                          job={job}
                          today={today}
                          isAdmin={isAdmin}
                          onCardClick={setDetailJob}
                          onSelect={(id) => setSelectedJobIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])}
                          isSelected={selectedJobIds.includes(job.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bulk action bar */}
          {selectedJobIds.length > 0 && (
            <div className="shrink-0 px-4 py-3 bg-[#1F2937] flex flex-wrap items-center gap-3" style={{ borderTop: '1px solid rgba(163,230,53,0.2)' }}>
              <span className="font-bold text-sm text-white">เลือก <span className="text-[#A3E635] font-black">{selectedJobIds.length}</span> งาน</span>
              <button
                type="button"
                onClick={() => setSelectedJobIds(filteredJobs.map((j) => j.id))}
                className="px-3 py-2 text-xs font-bold rounded-xl border border-white/20 text-white/80 hover:text-white"
              >
                เลือกทั้งหมดที่มองเห็น
              </button>
              <div className="flex rounded-xl overflow-hidden border border-white/20">
                <button type="button" onClick={() => setBulkAssignMode('team')} className={`px-3 py-2 text-xs font-bold ${bulkAssignMode === 'team' ? 'bg-[#A3E635] text-[#1F2937]' : 'text-white/70'}`}>ทีม</button>
                <button type="button" onClick={() => setBulkAssignMode('user')} className={`px-3 py-2 text-xs font-bold ${bulkAssignMode === 'user' ? 'bg-[#A3E635] text-[#1F2937]' : 'text-white/70'}`}>ช่าง</button>
              </div>
              <div className="flex-1 min-w-[180px]">
                {bulkAssignMode === 'team' ? (
                  <AppSelectField
                    label=""
                    value={bulkAssignTeam}
                    onChange={setBulkAssignTeam}
                    options={teams.map((t) => ({ value: String(t.id), label: t.team_name }))}
                    placeholder="เลือกทีม"
                    searchable
                  />
                ) : (
                  <AppSelectField
                    label=""
                    value={bulkAssignUser}
                    onChange={setBulkAssignUser}
                    options={techsForFilter
                      .filter((u) => {
                        const roles = u.roles || [u.role];
                        return mainTab === 'ma'
                          ? roles.some((r) => ['ma_technician', 'contractor_ma'].includes(r))
                          : roles.some((r) => ['technician', 'office_technician', 'contractor_office'].includes(r));
                      })
                      .map((u) => ({ value: String(u.id), label: u.full_name }))}
                    placeholder="เลือกช่าง"
                    searchable
                  />
                )}
              </div>
              <button onClick={handleBulkAssign} className="px-4 py-2 text-sm font-bold bg-[#A3E635] text-[#1F2937] hover:bg-[#84cc16] rounded-xl transition-colors">✅ มอบหมาย</button>
              <button onClick={() => setSelectedJobIds([])} className="px-4 py-2 text-sm font-semibold text-white/60 hover:text-white rounded-xl transition-colors">ยกเลิก</button>
              <button onClick={handleDeleteBulk} className="px-4 py-2 text-sm font-bold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors">🗑️ ลบ</button>
            </div>
          )}
        </div>
      </div>

      {/* ── JOB DETAIL BOTTOM SHEET ── */}
      {detailJob && (
        <JobDetailSheet
          job={detailJob}
          today={today}
          isAdmin={isAdmin}
          mainTab={mainTab}
          onClose={() => setDetailJob(null)}
          onEdit={(job) => { setDetailJob(null); setSelectedJob(job); }}
          onComplete={(job) => { setActionJob(job); setActionType('complete'); }}
          onIncomplete={(job) => { setActionJob(job); setActionType('incomplete'); }}
          onPostpone={(job) => { setActionJob(job); setActionType('postpone'); }}
          onDelete={(id) => { setDetailJob(null); handleDelete(id); }}
          onCancelCompletion={(job) => { setDetailJob(null); handleCancelCompletion(job); }}
          onChangeTeam={(job) => handleChangeCompletedTeam(job)}
        />
      )}

      {/* ── MODALS ── */}
      <JobDispatchModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={handleActionComplete} defaultJobType={mainTab} />
      <AutoDispatchModal isOpen={isAutoModalOpen} onClose={() => setIsAutoModalOpen(false)} onSuccess={handleActionComplete} />
      <SmartImportExcelModal
        isOpen={isSmartImportOpen}
        onClose={() => setIsSmartImportOpen(false)}
        onSuccess={handleActionComplete}
        defaultJobType={smartImportJobType}
      />
      {selectedJob && <EditJobModal job={selectedJob} isOpen={!!selectedJob} onClose={() => setSelectedJob(null)} onSuccess={handleActionComplete} type={mainTab} />}
      {mainTab === 'ma' ? (
        <CompleteMaJobModal job={actionJob} isOpen={actionType==='complete'} onClose={() => { setActionJob(null); setActionType(null); }} onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }} />
      ) : (
        <CompleteJobModal job={actionJob} isOpen={actionType==='complete'} onClose={() => { setActionJob(null); setActionType(null); }} onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }} />
      )}
      <IncompleteJobModal job={actionJob} isOpen={actionType==='incomplete'} jobType={mainTab} onClose={() => { setActionJob(null); setActionType(null); }} onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }} />
      <PostponeJobModal job={actionJob} isOpen={actionType==='postpone'} jobType={mainTab} onClose={() => { setActionJob(null); setActionType(null); }} onSuccess={() => { handleActionComplete(); setActionJob(null); setActionType(null); }} />

      {/* Confirm Dialog */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#1F2937]/60 backdrop-blur-sm" onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} />
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 relative z-10 shadow-2xl">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${confirmDialog.isDanger ? 'bg-red-50' : 'bg-orange-50'}`}>
              <svg className={`w-6 h-6 ${confirmDialog.isDanger ? 'text-red-500' : 'text-orange-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <h3 className="text-lg font-bold text-[#1F2937] mb-2">{confirmDialog.title}</h3>
            <p className="text-[#6B7280] text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} className="flex-1 py-2.5 rounded-xl font-bold text-[#6B7280] bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#E5E7EB]">ยกเลิก</button>
              <button onClick={() => { confirmDialog.onConfirm?.(); setConfirmDialog(p => ({ ...p, isOpen: false })); }}
                className={`flex-1 py-2.5 rounded-xl font-bold text-white ${confirmDialog.isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-orange-500 hover:bg-orange-600'}`}>ยืนยัน</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {notification.show && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-[200] px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 ${notification.type==='success' ? 'bg-[#1F2937] text-white' : 'bg-red-500 text-white'}`}>
          {notification.type==='success' ? <div className="w-5 h-5 rounded-full bg-[#A3E635] flex items-center justify-center"><svg className="w-3 h-3 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg></div> : '⚠️'}
          <span className="font-bold text-sm">{notification.message}</span>
        </div>
      )}

      <ManualModal isOpen={showManualModal} onClose={() => setShowManualModal(false)} userRoles={user?.roles || [user?.role]} pageName="dispatch" />
    </div>
  );
}
