import { useState, useCallback } from "react";

/**
 * ThemeToggle - ?????????????????/???
 * ????????????? ????????????????? header
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("color-theme") ||
      (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem("color-theme", next);
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      return next;
    });
  }, []);

  return (
    <button
      onClick={toggleTheme}
      className="w-9 h-9 rounded-xl flex items-center justify-center border border-[#E5E7EB] dark:border-slate-600 bg-[#F9FAFB] dark:bg-slate-700 hover:bg-[#E5E7EB] dark:hover:bg-slate-600 transition-all shrink-0 active:scale-95"
      title={theme === "dark" ? "????????????????????" : "??????????????????"}
      aria-label="toggle theme"
    >
      {theme === "dark" ? (
        <svg className="text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={18} height={18}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        <svg className="text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} width={18} height={18}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}
