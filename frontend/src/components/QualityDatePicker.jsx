import { useRef, useState } from 'react';
import { format, isValid, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { cn } from '../lib/utils';

const thaiDate = (date) => `${format(date, 'd MMM', { locale: th })} ${date.getFullYear() + 543}`;
const thaiMonth = (date) => `${format(date, 'MMMM', { locale: th })} ${date.getFullYear() + 543}`;
const bangkokToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

/** ISO date value and native form constraints, with the site's Thai calendar UI. */
export default function QualityDatePicker({ value = '', onChange, min, max, required = false, className, 'aria-label': ariaLabel = 'เลือกวันที่' }) {
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [today, setToday] = useState(bangkokToday);
  const triggerRef = useRef(null);
  const selected = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
  const unavailable = (iso) => (min && iso < min) || (max && iso > max);
  const initialDate = selected || parseISO(min && today < min ? min : max && today > max ? max : today);
  const choose = (iso) => {
    if (iso && unavailable(iso)) return;
    onChange({ target: { value: iso } });
    setInvalid(false);
    setOpen(false);
  };

  return (
    <span className="relative block min-w-0">
      <input
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => choose(event.target.value)}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          triggerRef.current?.focus();
        }}
      />
      <Popover open={open} onOpenChange={(nextOpen) => { if (nextOpen) setToday(bangkokToday()); setOpen(nextOpen); }}>
        <PopoverTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-label={`${ariaLabel}${selected ? `: ${thaiDate(selected)}` : ''}`}
            aria-invalid={invalid || undefined}
            className={cn('flex h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-left text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:border-lime-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:border-lime-500', className, open && 'border-lime-500 ring-2 ring-lime-500/20', invalid && 'border-rose-500')}
          >
            <CalendarDays className="h-4 w-4 shrink-0 text-lime-600 dark:text-lime-400" />
            <span className={cn('min-w-0 flex-1 truncate', !selected && 'text-slate-400')}>{selected ? thaiDate(selected) : 'เลือกวันที่'}</span>
            <ChevronDown className={cn('h-4 w-4 shrink-0 text-slate-400 transition-transform', open && 'rotate-180')} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={8} collisionPadding={12} aria-label={`ปฏิทิน${ariaLabel}`} className="date-picker-popover w-auto max-w-[calc(100vw-24px)] max-h-[var(--radix-popover-content-available-height)] overflow-x-hidden overflow-y-auto rounded-2xl border-slate-200 bg-white p-0 shadow-xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <Calendar
            mode="single"
            required={required}
            selected={selected}
            defaultMonth={initialDate}
            today={parseISO(today)}
            onSelect={(date) => { if (date) choose(format(date, 'yyyy-MM-dd')); }}
            disabled={(date) => Boolean(unavailable(format(date, 'yyyy-MM-dd')))}
            locale={th}
            formatters={{ formatCaption: thaiMonth }}
            labels={{ labelPrevious: () => 'เดือนก่อนหน้า', labelNext: () => 'เดือนถัดไป', labelDay: (date) => thaiDate(date) }}
            initialFocus
            className="border-0 bg-white shadow-none dark:bg-slate-900"
            classNames={{
              caption_label: 'text-sm font-bold text-slate-900 dark:text-white',
              nav_button: 'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-lime-500 hover:bg-lime-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
              day: 'h-9 w-9 rounded-lg p-0 text-sm font-medium text-slate-700 hover:bg-lime-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 dark:text-slate-200 dark:hover:bg-slate-800',
              day_selected: '!bg-[#78BE20] !text-slate-950 font-bold shadow-sm',
              day_today: 'border border-lime-500 font-bold text-lime-700 dark:text-lime-300',
              day_disabled: '!text-slate-300 opacity-40 hover:!bg-transparent dark:!text-slate-600',
              day_outside: 'opacity-35',
              cell: 'relative p-0 text-center text-sm focus-within:z-20',
            }}
          />
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
            <button type="button" disabled={Boolean(unavailable(today))} onClick={() => choose(today)} className="rounded-lg px-3 py-1.5 text-xs font-bold text-lime-700 hover:bg-lime-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-lime-300 dark:hover:bg-lime-950">วันนี้</button>
            {!required && value && <button type="button" onClick={() => choose('')} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800">ล้างวันที่</button>}
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800">ปิด</button>
          </div>
        </PopoverContent>
      </Popover>
      {invalid && <span role="alert" className="mt-1 block text-xs font-medium text-rose-600">กรุณาเลือกวันที่ที่อยู่ในช่วงที่กำหนด</span>}
    </span>
  );
}
