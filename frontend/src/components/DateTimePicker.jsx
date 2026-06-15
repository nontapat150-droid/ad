import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { cn } from "../lib/utils";

export function DateTimePicker({ value, onChange, placeholder = "เลือกวันและเวลา", className }) {
  // ฟังก์ชันแปลงสตริงที่อาจมีปัญหาในบางเบราว์เซอร์ให้เป็น ISO Format ที่รองรับ
  const parseSafeDate = (val) => {
    if (!val) return null;
    if (val instanceof Date) return val;
    // แทนที่ space ด้วย T สำหรับ iOS/Safari e.g. '2024-03-20 08:00:00' -> '2024-03-20T08:00:00'
    const safeStr = typeof val === 'string' ? val.replace(' ', 'T') : val;
    const d = new Date(safeStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const [date, setDate] = useState(parseSafeDate(value));
  const [hour, setHour] = useState(date ? date.getHours().toString().padStart(2, '0') : "08");
  const [minute, setMinute] = useState(date ? date.getMinutes().toString().padStart(2, '0') : "00");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const d = parseSafeDate(value);
    setDate(d);
    if (d) {
      setHour(d.getHours().toString().padStart(2, '0'));
      setMinute(d.getMinutes().toString().padStart(2, '0'));
    }
  }, [value]);

  const handleSelectDate = (selectedDate) => {
    if (selectedDate) {
      const newDate = new Date(selectedDate);
      newDate.setHours(parseInt(hour, 10));
      newDate.setMinutes(parseInt(minute, 10));
      setDate(newDate);
      if (onChange) onChange(newDate);
    } else {
      setDate(null);
      if (onChange) onChange(null);
    }
  };

  const handleTimeChange = (type, val) => {
    if (type === 'hour') setHour(val);
    if (type === 'minute') setMinute(val);
    
    if (date) {
      const newDate = new Date(date);
      if (type === 'hour') newDate.setHours(parseInt(val, 10));
      if (type === 'minute') newDate.setMinutes(parseInt(val, 10));
      setDate(newDate);
      if (onChange) onChange(newDate);
    }
  };

  const formatThaiDate = (d) => {
    if (!d) return placeholder;
    const formattedDate = format(d, "dd MMMM", { locale: th });
    const thaiYear = d.getFullYear() + 543;
    const formattedTime = format(d, "HH:mm");
    return `${formattedDate} ${thaiYear} เวลา ${formattedTime} น.`;
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-bold bg-white border-[#E5E7EB] h-[52px] px-4 rounded-xl hover:border-[#A3E635] hover:ring-2 hover:ring-[#A3E635]/20 hover:bg-white transition-all shadow-sm",
            !date ? "text-[#9CA3AF]" : "text-[#1F2937]",
            className
          )}
        >
          <CalendarIcon className={cn("mr-3 h-5 w-5", date ? "text-[#A3E635]" : "text-[#9CA3AF]")} />
          {date ? formatThaiDate(date) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border border-[#E5E7EB] shadow-[0_10px_40px_rgba(0,0,0,0.12)] rounded-3xl overflow-hidden animate-[slideUp_0.2s_ease-out]" align="start">
        <div className="bg-white">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelectDate}
            initialFocus
            locale={th}
          />
          <div className="p-4 border-t border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-bold text-[#4B5563]">
              <Clock className="w-4 h-4 text-[#A3E635]" />
              ระบุเวลา
            </div>
            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#E5E7EB] shadow-sm">
              <select
                value={hour}
                onChange={(e) => handleTimeChange('hour', e.target.value)}
                className="p-1.5 rounded-lg text-sm font-bold text-[#1F2937] outline-none hover:bg-[#F3F4F6] focus:ring-2 focus:ring-[#A3E635]/50 bg-transparent cursor-pointer appearance-none text-center min-w-[40px]"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i.toString().padStart(2, '0')}>
                    {i.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-[#9CA3AF] font-bold">:</span>
              <select
                value={minute}
                onChange={(e) => handleTimeChange('minute', e.target.value)}
                className="p-1.5 rounded-lg text-sm font-bold text-[#1F2937] outline-none hover:bg-[#F3F4F6] focus:ring-2 focus:ring-[#A3E635]/50 bg-transparent cursor-pointer appearance-none text-center min-w-[40px]"
              >
                {Array.from({ length: 60 }).map((_, i) => (
                  <option key={i} value={i.toString().padStart(2, '0')}>
                    {i.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

