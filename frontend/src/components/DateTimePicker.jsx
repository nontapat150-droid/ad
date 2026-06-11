import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { cn } from "../lib/utils";

export function DateTimePicker({ value, onChange, placeholder = "เลือกวันและเวลา", className }) {
  const [date, setDate] = useState(value ? new Date(value) : null);
  const [hour, setHour] = useState(value ? new Date(value).getHours().toString().padStart(2, '0') : "08");
  const [minute, setMinute] = useState(value ? new Date(value).getMinutes().toString().padStart(2, '0') : "00");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (value) {
      const v = new Date(value);
      setDate(v);
      setHour(v.getHours().toString().padStart(2, '0'));
      setMinute(v.getMinutes().toString().padStart(2, '0'));
    } else {
      setDate(null);
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
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal bg-white/65 backdrop-blur-sm border-slate-200 h-11 rounded-xl",
            !date && "text-slate-500",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-indigo-500" />
          {date ? formatThaiDate(date) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border border-slate-200 shadow-xl rounded-2xl overflow-hidden" align="start">
        <div className="bg-white">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelectDate}
            initialFocus
            locale={th}
          />
          <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Clock className="w-4 h-4 text-indigo-500" />
              เวลา
            </div>
            <div className="flex items-center gap-1">
              <select
                value={hour}
                onChange={(e) => handleTimeChange('hour', e.target.value)}
                className="p-1 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              >
                {Array.from({ length: 24 }).map((_, i) => (
                  <option key={i} value={i.toString().padStart(2, '0')}>
                    {i.toString().padStart(2, '0')}
                  </option>
                ))}
              </select>
              <span className="text-slate-500 font-bold">:</span>
              <select
                value={minute}
                onChange={(e) => handleTimeChange('minute', e.target.value)}
                className="p-1 border border-slate-200 rounded-md text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
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
