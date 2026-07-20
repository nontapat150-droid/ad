import { useEffect, useMemo, useState } from 'react';
import { filterManualSections, getManual } from '../manuals';

function SectionBlock({ section }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black text-[#1F2937] dark:text-slate-100">{section.heading}</h3>
      {section.body && (
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{section.body}</p>
      )}
      {section.steps?.length > 0 && (
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
          {section.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
      {section.tips?.length > 0 && (
        <ul className="space-y-1.5">
          {section.tips.map((tip, i) => (
            <li
              key={i}
              className="text-sm text-slate-600 dark:text-slate-300 bg-[#A3E635]/10 border border-[#A3E635]/25 rounded-xl px-3 py-2"
            >
              <span className="font-bold text-[#65a30d]">เทคนิค: </span>
              {tip}
            </li>
          ))}
        </ul>
      )}
      {section.faqs?.length > 0 && (
        <div className="space-y-2">
          {section.faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-[#E5E7EB] dark:border-slate-600 bg-[#F9FAFB] dark:bg-slate-700/50 p-3">
              <p className="text-sm font-bold text-[#1F2937] dark:text-slate-100">ถาม: {faq.q}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">ตอบ: {faq.a}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ManualModal({ isOpen, onClose, userRoles = [], pageName = 'dashboard' }) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  const bundle = useMemo(
    () => getManual(userRoles, pageName),
    [userRoles, pageName]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setSearch('');
      setActiveTab(0);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, pageName]);

  if (!isOpen) return null;

  const tab = bundle.tabs[activeTab] || bundle.tabs[0];
  const filtered = filterManualSections(tab?.manual, search);
  const hasMultipleTabs = bundle.tabs.length > 1;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div
        className="bg-white dark:bg-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="manual-title"
      >
        <div className="p-5 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-start gap-3 bg-gradient-to-br from-slate-50 to-white dark:from-slate-800 dark:to-slate-800/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#A3E635]/20 text-[#65a30d] flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 id="manual-title" className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100 truncate">
                คู่มือการใช้งาน
              </h2>
              <p className="text-xs text-[#65a30d] font-medium truncate">
                {bundle.pageTitle}
                {tab?.label ? ` · ${tab.label}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"
            aria-label="ปิด"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {hasMultipleTabs && (
          <div className="px-4 pt-3 flex gap-1.5 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
            {bundle.tabs.map((t, i) => (
              <button
                key={t.roleKey}
                type="button"
                onClick={() => setActiveTab(i)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  activeTab === i
                    ? 'bg-[#1F2937] text-white'
                    : 'bg-[#F3F4F6] dark:bg-slate-700 text-[#6B7280] dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="px-4 sm:px-6 pt-3 shrink-0">
          <div className="relative">
            <svg className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาในคู่มือ เช่น จบงาน, Excel, แผนที่..."
              className="w-full h-10 pl-9 pr-3 rounded-xl text-sm border border-[#E5E7EB] dark:border-slate-600 bg-white dark:bg-slate-900 text-[#1F2937] dark:text-slate-100 outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20"
            />
          </div>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0">
          {!filtered ? (
            <div className="text-center py-10 space-y-2">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">ยังไม่มีคู่มือสำหรับหน้านี้</p>
              <p className="text-xs text-slate-500">
                ลองเปิดคู่มือที่หน้าแรก หรือใช้เมนูแจ้งปัญหาหากติดขัด
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-black text-[#1F2937] dark:text-slate-100">{filtered.title}</h3>
                {filtered.summary && (
                  <p className="text-sm text-[#6B7280] dark:text-slate-400 mt-1 leading-relaxed">{filtered.summary}</p>
                )}
              </div>
              {filtered.sections?.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">ไม่พบหัวข้อที่ตรงกับคำค้นหา</p>
              ) : (
                filtered.sections.map((section, i) => (
                  <SectionBlock key={`${section.heading}-${i}`} section={section} />
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-[#1F2937] hover:bg-slate-700 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  );
}
