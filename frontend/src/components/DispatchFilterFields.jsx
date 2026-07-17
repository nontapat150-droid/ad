import { useState, useEffect, useRef, useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { Calendar } from './ui/calendar';
import { cn } from '../lib/utils';

const triggerClass = (active, hasValue) =>
  cn(
    'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-all text-left',
    active
      ? 'border-[#A3E635] ring-2 ring-[#A3E635]/20 bg-white shadow-sm'
      : hasValue
        ? 'border-[#A3E635]/40 bg-[#A3E635]/5 text-[#1F2937] hover:border-[#A3E635]'
        : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#9CA3AF] hover:border-[#A3E635]/50 hover:bg-white'
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

export function FilterDateField({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = value ? parseISO(value) : undefined;
  const todayStr = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const display = value
    ? format(parseISO(value), 'd MMMM yyyy', { locale: th })
    : 'เลือกวันที่นัด';

  return (
    <div ref={ref}>
      <FieldLabel
        icon={
          <svg className="w-3.5 h-3.5 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        }
      >
        วันที่นัด
      </FieldLabel>

      <button type="button" onClick={() => setOpen((o) => !o)} className={triggerClass(open, !!value)}>
        <span className="flex items-center gap-2 min-w-0">
          <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', value ? 'bg-[#A3E635]/20' : 'bg-[#F3F4F6]')}>
            <svg className={cn('w-3.5 h-3.5', value ? 'text-[#65a30d]' : 'text-[#9CA3AF]')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </span>
          <span className={cn('truncate', value ? 'font-bold text-[#1F2937]' : '')}>{display}</span>
        </span>
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="mt-2 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden animate-filterDropIn">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(day) => {
              if (day) onChange(format(day, 'yyyy-MM-dd'));
              else onChange('');
              setOpen(false);
            }}
            locale={th}
            className="border-0 shadow-none rounded-none"
          />
          <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#F3F4F6] bg-[#FAFAFA]">
            <button
              type="button"
              onClick={() => { onChange(todayStr); setOpen(false); }}
              className="flex-1 px-2 py-1.5 text-[11px] font-bold text-[#1F2937] rounded-lg border border-[#E5E7EB] bg-white hover:border-[#A3E635] hover:bg-[#A3E635]/5 transition-colors"
            >
              วันนี้
            </button>
            {value && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className="flex-1 px-2 py-1.5 text-[11px] font-bold text-red-600 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
              >
                ล้างวันที่
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterSelectField({ label, icon, value, onChange, options, placeholder, searchable = false, searchAlways = false }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const selected = options.find((o) => String(o.value) === String(value));

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query, searchable]);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  return (
    <div ref={ref}>
      <FieldLabel>{icon}{label}</FieldLabel>

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
        <div className="relative z-[60] mt-1.5 rounded-xl border border-[#E5E7EB] bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)] overflow-hidden animate-filterDropIn">
          {searchable && (searchAlways || options.length > 6) && (
            <div className="p-2 border-b border-[#F3F4F6]">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`ค้นหา${label}...`}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20"
                autoFocus
              />
            </div>
          )}
          <ul className="max-h-48 overflow-y-auto py-1" style={{ scrollbarWidth: 'thin' }}>
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
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-xs text-[#9CA3AF]">ไม่พบรายการ</li>
            ) : (
              filtered.map((opt) => (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => { onChange(String(opt.value)); setOpen(false); setQuery(''); }}
                    className={cn(
                      'w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2',
                      String(opt.value) === String(value)
                        ? 'bg-[#A3E635]/15 text-[#1F2937] font-bold'
                        : 'text-[#374151] hover:bg-[#F9FAFB]'
                    )}
                  >
                    <span className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0',
                      String(opt.value) === String(value) ? 'bg-[#A3E635] text-[#1F2937]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                    )}>
                      {String(opt.value) === String(value) ? '✓' : opt.label.charAt(0)}
                    </span>
                    <span className="truncate">{opt.label}</span>
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
