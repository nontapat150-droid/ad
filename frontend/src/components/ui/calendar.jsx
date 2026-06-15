import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"
import { cn } from "../../lib/utils"
import { buttonVariants } from "./button"

function Calendar({ className, classNames, showOutsideDays = true, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4 bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.08)]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center mb-2",
        caption_label: "text-sm font-bold text-[#1F2937]",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-8 w-8 bg-white text-[#6B7280] border-[#E5E7EB] hover:text-[#1F2937] hover:border-[#A3E635] hover:bg-[#F9FAFB] rounded-xl shadow-sm transition-colors p-0"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-[#9CA3AF] rounded-md w-9 font-bold text-[0.8rem] uppercase tracking-wider",
        row: "flex w-full mt-2",
        cell: "text-center text-sm p-0 relative [&:has([aria-selected])]:bg-[#F3F4F6] first:[&:has([aria-selected])]:rounded-l-xl last:[&:has([aria-selected])]:rounded-r-xl focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-medium text-[#374151] hover:bg-[#F3F4F6] hover:text-[#1F2937] rounded-xl transition-all aria-selected:opacity-100"
        ),
        day_selected:
          "bg-gradient-to-br from-[#A3E635] to-[#84cc16] text-[#1F2937] font-bold hover:from-[#84cc16] hover:to-[#65a30d] hover:text-[#1F2937] focus:from-[#A3E635] focus:to-[#84cc16] focus:text-[#1F2937] shadow-md shadow-lime-500/20 transform scale-105",
        day_today: "bg-[#F3F4F6] text-[#1F2937] font-bold border border-[#E5E7EB]",
        day_outside:
          "text-[#9CA3AF] opacity-50 aria-selected:bg-[#F3F4F6] aria-selected:text-[#6B7280] aria-selected:opacity-30",
        day_disabled: "text-[#D1D5DB] opacity-50",
        day_range_middle:
          "aria-selected:bg-[#F3F4F6] aria-selected:text-[#1F2937]",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ...props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ...props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
