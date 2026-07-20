import { useState, useEffect, useRef, useMemo } from 'react';
import { format, parseISO, isBefore, isAfter, startOfDay } from 'date-fns';
import { th } from 'date-fns/locale';
import { Calendar } from './ui/calendar';
import { cn } from '../lib/utils';

const THAI_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

/** "2026-07-19" → "19 กรกฎาคม 2569" (Buddhist Era) */
export function toThaiDateLabel(isoDate) {
  if (!isoDate) return '';
  const d = parseISO(isoDate);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${d.getDate()} ${THAI_MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
}

/** Calendar caption in Thai with Buddhist year, e.g. "กรกฎาคม 2569" */
const thaiCaptionFormatters = {
  formatCaption: (month) => `${THAI_MONTHS_FULL[month.getMonth()]} ${month.getFullYear() + 543}`,
};

const triggerClass = (active, hasValue) =>
  cn(
    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left',
    active
      ? 'border-[#A3E635] ring-2 ring-[#A3E635]/20 bg-white shadow-sm'
      : hasValue
        ? 'border-[#A3E635]/40 bg-[#A3E635]/5 text-[#1F2937] hover:border-[#A3E635]'
        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#9CA3AF] hover:border-[#A3E635]/50 hover:bg-white'
  );

const calendarIcon = (
  <svg className="w-3.5 h-3.5 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const clockIcon = (
  <svg className="w-3.5 h-3.5 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

function FieldLabel({ icon, children }) {
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
      {icon}
      {children}
    </span>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={cn('w-4 h-4 shrink-0 text-[#9CA3AF] transition-transform', open && 'rotate-180 text-[#65a30d]')}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function useOutsideClose(ref, open, onClose) {
  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open, ref, onClose]);
}

export function TimePickerColumns({ hour, minute, onHourChange, onMinuteChange, step = 1 }) {
  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')), []);
  const minutes = useMemo(
    () => Array.from({ length: Math.ceil(60 / step) }, (_, i) => (i * step).toString().padStart(2, '0')),
    [step]
  );

  return (
    <div className="flex gap-2">
      <TimeColumn label="ชม." value={hour} options={hours} onSelect={onHourChange} />
      <TimeColumn label="นาที" value={minute} options={minutes} onSelect={onMinuteChange} />
    </div>
  );
}

function TimeColumn({ label, value, options, onSelect }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wide text-center mb-1.5">{label}</p>
      <ul className="max-h-40 overflow-y-auto py-1 rounded-lg border border-[#F3F4F6] bg-[#FAFAFA]" style={{ scrollbarWidth: 'thin' }}>
        {options.map((opt) => (
          <li key={opt}>
            <button
              type="button"
              onClick={() => onSelect(opt)}
              className={cn(
                'w-full px-2 py-2 text-sm font-bold transition-colors text-center',
                value === opt ? 'bg-[#A3E635]/20 text-[#1F2937]' : 'text-[#374151] hover:bg-white'
              )}
            >
              {opt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AppDateField({
  label = 'วันที่',
  value,
  onChange,
  placeholder = 'เลือกวันที่',
  min,
  max,
  icon = calendarIcon,
  allowClear = true,
  showToday = true,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const todayStr = new Date().toISOString().slice(0, 10);

  const selected = value ? parseISO(value) : undefined;
  const display = value ? toThaiDateLabel(value) : placeholder;

  useOutsideClose(ref, open, () => setOpen(false));

  const isDisabled = (date) => {
    const day = startOfDay(date);
    if (min && isBefore(day, startOfDay(parseISO(min)))) return true;
    if (max && isAfter(day, startOfDay(parseISO(max)))) return true;
    return false;
  };

  return (
    <div ref={ref}>
      {label ? <FieldLabel icon={icon}>{label}</FieldLabel> : null}
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerClass(open, !!value)}>
        <span className="flex items-center gap-2 min-w-0">
          <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', value ? 'bg-[#A3E635]/20' : 'bg-[#F3F4F6]')}>
            {calendarIcon}
          </span>
          <span className={cn('truncate', value ? 'font-bold text-[#1F2937]' : '')}>{display}</span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden animate-filterDropIn z-[70] relative">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(day) => {
              if (day) onChange(format(day, 'yyyy-MM-dd'));
              else onChange('');
              setOpen(false);
            }}
            disabled={isDisabled}
            locale={th}
            formatters={thaiCaptionFormatters}
            className="border-0 shadow-none rounded-none"
          />
          {(showToday || (allowClear && value)) && (
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#F3F4F6] bg-[#FAFAFA]">
              {showToday && (
                <button
                  type="button"
                  onClick={() => { onChange(todayStr); setOpen(false); }}
                  className="flex-1 px-2 py-1.5 text-[11px] font-bold text-[#1F2937] rounded-lg border border-[#E5E7EB] bg-white hover:border-[#A3E635] hover:bg-[#A3E635]/5 transition-colors"
                >
                  วันนี้
                </button>
              )}
              {allowClear && value && (
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false); }}
                  className="flex-1 px-2 py-1.5 text-[11px] font-bold text-red-600 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  ล้างวันที่
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AppTimeField({
  label = 'เวลา',
  value,
  onChange,
  placeholder = 'เลือกเวลา',
  icon = clockIcon,
  step = 1,
  allowClear = true,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const [hour = '', minute = ''] = value ? value.split(':') : ['', ''];

  useOutsideClose(ref, open, () => setOpen(false));

  const setPart = (h, m) => {
    if (!h && !m) {
      onChange('');
      return;
    }
    onChange(`${h || '00'}:${m || '00'}`);
  };

  const display = value ? value : placeholder;

  return (
    <div ref={ref}>
      {label ? <FieldLabel icon={icon}>{label}</FieldLabel> : null}
      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerClass(open, !!value)}>
        <span className="flex items-center gap-2 min-w-0">
          <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', value ? 'bg-[#A3E635]/20' : 'bg-[#F3F4F6]')}>
            {clockIcon}
          </span>
          <span className={cn('truncate', value ? 'font-bold text-[#1F2937]' : '')}>{display}</span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden animate-filterDropIn z-[70] relative p-3">
          <TimePickerColumns
            hour={hour}
            minute={minute}
            step={step}
            onHourChange={(h) => setPart(h, minute || '00')}
            onMinuteChange={(m) => setPart(hour || '00', m)}
          />
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#F3F4F6]">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 px-2 py-1.5 text-[11px] font-bold text-[#1F2937] rounded-lg border border-[#E5E7EB] bg-white hover:border-[#A3E635] hover:bg-[#A3E635]/5 transition-colors"
            >
              ยืนยัน
            </button>
            {allowClear && value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="flex-1 px-2 py-1.5 text-[11px] font-bold text-red-600 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
              >
                ล้างเวลา
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterDateField(props) {
  return <AppDateField label="วันที่นัด" placeholder="เลือกวันที่นัด" {...props} />;
}

export function FilterSelectField({
  label,
  icon,
  value,
  onChange,
  options,
  placeholder,
  searchable = false,
  searchAlways = false,
  allowClear = true,
  searchPlaceholder,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    const qCompact = q.replace(/[\s\-_/.:]/g, '');
    return options.filter((o) => {
      const hay = [
        o.label,
        o.searchText,
        o.sublabel,
        o.value,
      ].filter(Boolean).join(' ').toLowerCase();
      if (hay.includes(q)) return true;
      const hayCompact = hay.replace(/[\s\-_/.:]/g, '');
      return qCompact.length > 0 && hayCompact.includes(qCompact);
    });
  }, [options, query, searchable]);

  useOutsideClose(ref, open, () => { setOpen(false); setQuery(''); });

  const inputPlaceholder = searchPlaceholder
    || (String(label || '').toLowerCase().includes('sn')
      ? `ค้นหา SN / รุ่น...`
      : `ค้นหา${label ? ` ${label}` : ''}...`);

  return (
    <div ref={ref}>
      {label ? <FieldLabel>{icon}{label}</FieldLabel> : null}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClass(open, !!value)}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className={cn(
            'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-black',
            value ? 'bg-[#A3E635]/20 text-[#65a30d]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
          )}>
            {value ? (selected?.label?.charAt(0) || '✓') : '—'}
          </span>
          <span className={cn('truncate', value ? 'font-bold text-[#1F2937]' : '')}>
            {selected?.label || placeholder}
          </span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="relative z-[70] mt-1.5 rounded-xl border border-[#E5E7EB] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)] overflow-hidden animate-filterDropIn">
          {searchable && (searchAlways || options.length > 6) && (
            <div className="p-2 border-b border-[#F3F4F6]">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={inputPlaceholder}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20"
                autoFocus
              />
            </div>
          )}
          <ul className="max-h-48 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
            {allowClear && (
              <li>
                <button
                  type="button"
                  onClick={() => { onChange(''); setOpen(false); setQuery(''); }}
                  className={cn(
                    'w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2',
                    !value ? 'bg-[#A3E635]/15 text-[#1F2937] font-bold' : 'text-[#6B7280] hover:bg-[#F9FAFB]'
                  )}
                >
                  <span className="w-5 h-5 rounded-md bg-[#F3F4F6] flex items-center justify-center text-[10px]">∞</span>
                  {placeholder}
                </button>
              </li>
            )}
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-[#9CA3AF]">ไม่พบรายการ{query.trim() ? 'ที่ตรงกับ SN / คำค้น' : ''}</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    disabled={!!opt.disabled}
                    onClick={() => {
                      if (opt.disabled) return;
                      onChange(String(opt.value));
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2',
                      opt.disabled
                        ? 'text-[#9CA3AF] opacity-50 cursor-not-allowed bg-[#F9FAFB]'
                        : String(opt.value) === String(value)
                          ? 'bg-[#A3E635]/15 text-[#1F2937] font-bold'
                          : 'text-[#374151] hover:bg-[#F9FAFB]'
                    )}
                  >
                    <span className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                      opt.disabled
                        ? 'bg-[#E5E7EB] text-[#9CA3AF]'
                        : String(opt.value) === String(value) ? 'bg-[#A3E635] text-[#1F2937]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                    )}>
                      {String(opt.value) === String(value) ? '✓' : String(opt.label || '?').charAt(0)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{opt.label || '—'}</span>
                      {opt.sublabel && (
                        <span className="block truncate text-[10px] font-semibold text-[#65a30d] mt-0.5">
                          {opt.sublabel}
                        </span>
                      )}
                    </span>
                    {opt.disabled && (
                      <span className="text-[10px] font-bold text-red-400 shrink-0">ไม่พอ</span>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export const AppSelectField = FilterSelectField;
