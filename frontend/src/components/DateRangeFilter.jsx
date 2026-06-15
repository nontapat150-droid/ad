import { useState, useEffect, useRef } from 'react';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { CalendarIcon } from 'lucide-react';
export default function DateRangeFilter({ startDate, endDate, setStartDate, setEndDate }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // For internal state before applying
  const [tempStart, setTempStart] = useState(startDate);
  const [tempEnd, setTempEnd] = useState(endDate);

  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
  }, [startDate, endDate, isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApply = () => {
    setStartDate(tempStart);
    setEndDate(tempEnd);
    setIsOpen(false);
  };

  const setPreset = (preset) => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    switch (preset) {
      case 'today':
        break;
      case 'last7':
        start.setDate(today.getDate() - 6);
        break;
      case 'last30':
        start.setDate(today.getDate() - 29);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisYear':
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      default:
        break;
    }

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);
    
    setTempStart(startStr);
    setTempEnd(endStr);
    
    // Auto apply for presets
    setStartDate(startStr);
    setEndDate(endStr);
    setIsOpen(false);
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="relative z-50" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-3 px-4 py-2.5 bg-white rounded-xl border transition-all shadow-sm group hover:border-[#A3E635] hover:shadow-md active:scale-95 ${isOpen ? 'border-[#A3E635] ring-2 ring-[#A3E635]/20' : 'border-[#E5E7EB]'}`}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center text-[#374151] group-hover:bg-[#A3E635] group-hover:text-[#1F2937] transition-colors shadow-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-0.5">ช่วงเวลาที่แสดงผล</p>
            <p className="text-sm font-bold text-[#1F2937]">
              {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
            </p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full right-0 mt-3 bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-[#E5E7EB] p-2 min-w-[340px] md:min-w-[480px] origin-top-right animate-[fadeInUp_0.2s_ease-out]">
          <div className="flex flex-col md:flex-row">
            {/* Presets */}
            <div className="w-full md:w-1/3 p-2 border-b md:border-b-0 md:border-r border-[#E5E7EB] flex flex-col gap-1">
              <p className="text-xs font-bold text-[#9CA3AF] mb-2 px-2 uppercase tracking-wider">ตัวเลือกด่วน</p>
              {[
                { id: 'today', label: 'วันนี้' },
                { id: 'last7', label: '7 วันที่ผ่านมา' },
                { id: 'last30', label: '30 วันที่ผ่านมา' },
                { id: 'thisMonth', label: 'เดือนนี้' },
                { id: 'lastMonth', label: 'เดือนที่แล้ว' },
                { id: 'thisYear', label: 'ปีนี้' },
              ].map(preset => (
                <button
                  key={preset.id}
                  onClick={() => setPreset(preset.id)}
                  className="text-left px-3 py-2.5 text-sm text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#1F2937] font-bold rounded-xl transition-all active:scale-95"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Range */}
            <div className="w-full md:w-2/3 p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-[#9CA3AF] mb-4 uppercase tracking-wider">กำหนดเอง</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#6B7280] mb-1">ตั้งแต่วันที่</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="w-full flex items-center justify-between pl-3 pr-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm font-bold text-[#1F2937] hover:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/50 transition-all outline-none shadow-sm"
                        >
                          {tempStart ? format(parseISO(tempStart), "d MMM yyyy", { locale: th }) : <span>เลือกวันที่</span>}
                          <CalendarIcon className="h-4 w-4 text-[#9CA3AF]" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[110] border-none shadow-none bg-transparent" align="start">
                        <Calendar
                          mode="single"
                          selected={tempStart ? parseISO(tempStart) : undefined}
                          onSelect={(date) => date && setTempStart(format(date, 'yyyy-MM-dd'))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-[#6B7280] mb-1">ถึงวันที่</label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button
                          className="w-full flex items-center justify-between pl-3 pr-3 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm font-bold text-[#1F2937] hover:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/50 transition-all outline-none shadow-sm"
                        >
                          {tempEnd ? format(parseISO(tempEnd), "d MMM yyyy", { locale: th }) : <span>เลือกวันที่</span>}
                          <CalendarIcon className="h-4 w-4 text-[#9CA3AF]" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[110] border-none shadow-none bg-transparent" align="start">
                        <Calendar
                          mode="single"
                          selected={tempEnd ? parseISO(tempEnd) : undefined}
                          onSelect={(date) => date && setTempEnd(format(date, 'yyyy-MM-dd'))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#4B5563] hover:text-[#1F2937] font-bold text-sm rounded-xl transition-all active:scale-95 shadow-sm"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 py-2.5 bg-[#1F2937] hover:bg-[#374151] text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                  นำไปใช้
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
