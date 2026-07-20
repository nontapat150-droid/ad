/** Shared help button used in page headers */
export default function ManualHelpButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs text-[#65a30d] hover:text-[#1F2937] font-semibold bg-[#F3F4F6] dark:bg-slate-700 hover:bg-[#A3E635]/15 px-3 py-1.5 rounded-lg border border-[#E5E7EB] dark:border-slate-600 hover:border-[#A3E635]/40 transition-all active:scale-95 ${className}`}
      title="คู่มือการใช้งาน"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="hidden sm:inline">คู่มือ</span>
    </button>
  );
}
