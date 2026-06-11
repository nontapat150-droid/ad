import { useState, useEffect, useRef } from 'react';

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
        className={`flex items-center justify-between gap-3 px-4 py-2 bg-white rounded-2xl border transition-all shadow-sm group hover:border-[#378ADD] hover:shadow-md ${isOpen ? 'border-[#378ADD] ring-2 ring-[#378ADD]/20' : 'border-slate-200'}`}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#185FA5]/10 flex items-center justify-center text-[#185FA5] group-hover:bg-[#185FA5] group-hover:text-white transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">ช่วงเวลาที่แสดงผล</p>
            <p className="text-sm font-bold text-[#042C53]">
              {formatDateDisplay(startDate)} - {formatDateDisplay(endDate)}
            </p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-3 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 min-w-[340px] md:min-w-[480px] origin-top-right animate-fade-in-up">
          <div className="flex flex-col md:flex-row">
            {/* Presets */}
            <div className="w-full md:w-1/3 p-2 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col gap-1">
              <p className="text-xs font-bold text-slate-400 mb-2 px-2">ตัวเลือกด่วน</p>
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
                  className="text-left px-3 py-2 text-sm text-[#042C53] hover:bg-[#185FA5]/5 hover:text-[#185FA5] font-medium rounded-xl transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Custom Range */}
            <div className="w-full md:w-2/3 p-4 flex flex-col justify-between">
              <div>
                <p className="text-xs font-bold text-slate-400 mb-4">กำหนดเอง</p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">ตั้งแต่วันที่</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={tempStart}
                        onChange={(e) => setTempStart(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-[#042C53] focus:ring-2 focus:ring-[#378ADD]/50 focus:border-[#378ADD] transition-all outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">ถึงวันที่</label>
                    <div className="relative">
                      <input
                        type="date"
                        value={tempEnd}
                        onChange={(e) => setTempEnd(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-[#042C53] focus:ring-2 focus:ring-[#378ADD]/50 focus:border-[#378ADD] transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-sm rounded-xl transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 py-2.5 bg-gradient-to-r from-[#185FA5] to-[#0C447C] hover:from-[#134D8A] hover:to-[#08315C] text-white font-bold text-sm rounded-xl shadow-md transition-colors"
                >
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
