const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/Sidebar.jsx', 'utf8');

// 1. Add state and effect
const hookInjection = `
  const [isCollapsed, setIsCollapsed] = useState(() => localStorage.getItem('sidebar_collapsed') === 'true');
  useEffect(() => {
    document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '80px' : '272px');
    localStorage.setItem('sidebar_collapsed', isCollapsed);
  }, [isCollapsed]);
`;
content = content.replace('const sidebarRef = useRef(null);', 'const sidebarRef = useRef(null);' + hookInjection);

// 2. Change sidebar width class
content = content.replace('z-50 w-[272px] flex', 'z-50 w-[var(--sidebar-width)] flex');
content = content.replace('transition-transform duration-300', 'transition-[width,transform] duration-300');

// 3. Update Branding header
content = content.replace('<div>\r\n                <p className="text-white', '<div className={`transition-all overflow-hidden whitespace-nowrap ${isCollapsed ? \'w-0 opacity-0 hidden\' : \'w-auto opacity-100\'}`}>\r\n                <p className="text-white');

const btnInjection = `
            {/* Collapse btn (desktop only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden md:flex w-8 h-8 rounded-lg items-center justify-center text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className={\`w-5 h-5 transition-transform \${isCollapsed ? 'rotate-180' : ''}\`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
            </button>
`;
content = content.replace('{/* Close btn (mobile only) */}', btnInjection + '            {/* Close btn (mobile only) */}');

// 4. Update User Card
content = content.replace('<div className="min-w-0 flex-1">', '<div className={`min-w-0 flex-1 transition-all overflow-hidden whitespace-nowrap ${isCollapsed ? \'w-0 opacity-0 hidden\' : \'w-auto opacity-100\'}`}>');

// 5. Update Group Label
content = content.replace('<p className="px-4 text-[11px]', '<p className={`px-4 text-[11px] ${isCollapsed ? \'hidden\' : \'\'}`}');

// 6. Update Menu Label
const menuLabelRegex = /<span className=\{\`text-sm flex-1 transition-colors duration-200 \$\{/g;
content = content.replace(menuLabelRegex, '<span className={`text-sm flex-1 transition-colors duration-200 whitespace-nowrap overflow-hidden ${isCollapsed ? \'hidden\' : \'\'} ${');

// 7. Update Menu Arrow
content = content.replace('{hasSub ? (', '<div className={isCollapsed ? \'hidden\' : \'\'}>\r\n                        {hasSub ? (');
content = content.replace(') : null}', ') : null}\r\n                        </div>');

// 8. Update Submenu hide
content = content.replace('{hasSub && isExpanded && (', '{hasSub && isExpanded && !isCollapsed && (');

fs.writeFileSync('frontend/src/components/Sidebar.jsx', content, 'utf8');
console.log('Sidebar.jsx updated');
