import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';

// ── Menu Definition ────────────────────────────────────────
const MENU_GROUPS = [
  {
    label: 'เมนูหลัก',
    items: [
      { key: 'home',      label: 'หน้าแรก',         icon: HomeIcon      },
      { key: 'jobs',      label: 'ระบบแจกจ่ายงาน',    icon: JobsIcon      },
      { key: 'customers', label: 'ข้อมูลลูกค้า',      icon: CustomersIcon },
      { key: 'bag',       label: 'กระเป๋าช่าง',      icon: BagIcon     },
    ],
  },
  {
    label: 'บันทึกข้อมูล',
    items: [
      { key: 'entry_fee', label: 'ค่าแรกเข้า',  icon: EntryFeeIcon },
      { key: 'oil',       label: 'เติมน้ำมัน',    icon: OilIcon     },
      { key: 'checkin',   label: 'ลงเวลาเข้างาน', icon: CheckinIcon },
    ],
  },
  {
    label: 'เพิ่มเติม',
    items: [
      { key: 'report',  label: 'แจ้งปัญหา',    icon: ReportIcon  },
    ],
  },
];

export default function Sidebar({
  open,
  onClose,
  activeKey,
  onNavigate,
}) {
  const { user, logout } = useAuth();
  const sidebarRef = useRef(null);
  const navigate = useNavigate();
  const [expandedKeys, setExpandedKeys] = useState({ inventory: true });
  const [profileOpen, setProfileOpen] = useState(false);
  const [localOpen, setLocalOpen] = useState(false);

  const isOpen = open || localOpen;

  const handleClose = () => {
    setLocalOpen(false);
    onClose?.();
  };

  const toggleExpand = (key) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Close on outside click (mobile)
  useEffect(() => {
    const handler = (e) => {
      if (isOpen && window.innerWidth < 768 && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, onClose]);

  // Lock body scroll when sidebar open on mobile
  useEffect(() => {
    if (isOpen && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const userRoles = user?.roles || [user?.role || ''];
  const isSuperAdmin = userRoles.includes('super_admin');
  const isAdminOnly = userRoles.includes('admin') && !isSuperAdmin;
  const isAdmin = isSuperAdmin || isAdminOnly;
  const isMATech = userRoles.includes('ma_technician');
  const isOfficeTech = userRoles.includes('technician');

  const initials = user?.full_name ? user.full_name.substring(0, 2).toUpperCase() : 'U';
  const teamName = user?.team_name || '';

  const handleNav = (key) => {
    onNavigate?.(key);
    if (!onNavigate) {
      if (key === 'home') {
        if (isSuperAdmin) navigate('/super-admin');
        else if (isAdminOnly) navigate('/admin');
        else navigate('/office-tech');
      }
      else if (key === 'home_ma') navigate('/ma-tech');
      else if (key === 'checkin') navigate('/checkin');
      else if (key === 'oil') navigate('/oil');
      else if (key === 'inventory') navigate('/inventory');
      else if (key === 'users') navigate('/users');
      else if (key === 'bag') navigate('/bag');
      else if (key === 'entry_fee') navigate('/entry-fee');
      else if (key === 'jobs') navigate('/jobs');
      else if (key === 'ma_performance') navigate('/ma-performance');
      else if (key === 'announcements') navigate('/announcements');
      else if (key === 'report') navigate('/report');
      else if (key === 'customers') navigate('/customers');
    }
    if (window.innerWidth < 768) {
      onClose();
    }
  };

  const dynamicMenuGroups = [];

  // Group 1: Admin
  if (isAdmin) {
    dynamicMenuGroups.push({
      label: 'ผู้ดูแลระบบ',
      items: [
        ...(isSuperAdmin ? [{ key: 'users', label: 'จัดการผู้ใช้', icon: UsersIcon }] : []),
        { key: 'inventory', label: 'ระบบคลัง', icon: InventoryIcon },
        ...(isSuperAdmin ? [{ key: 'ma_performance', label: 'สรุปผล MA', icon: ChartBarIcon }] : []),
        { key: 'announcements', label: 'ระบบประกาศ', icon: AnnouncementsIcon },
      ]
    });
  }

  // Loop over MENU_GROUPS and filter/modify
  MENU_GROUPS.forEach(group => {
    let items = [...group.items];

    // Filter items based on roles
    items = items.filter(item => {
      if (isOfficeTech && !isAdmin) {
        // Office Tech allowed menu items exactly as requested
        const allowedForOfficeTech = ['home', 'bag', 'entry_fee', 'oil', 'checkin', 'report', 'jobs'];
        return allowedForOfficeTech.includes(item.key);
      }
      
      if (isMATech && !isAdmin) {
        // MA Tech allowed menu items exactly as requested
        const allowedForMATech = ['home', 'bag', 'oil', 'checkin', 'report', 'jobs'];
        return allowedForMATech.includes(item.key);
      }
      
      // For others (Admin, SuperAdmin)
      if (['oil', 'entry_fee', 'bag'].includes(item.key)) {
        return isSuperAdmin;
      }
      return true;
    });

    // Modify labels/home item based on tech roles
    items = items.map(item => {
      if (item.key === 'jobs' && (isOfficeTech || isMATech) && !isAdmin) {
        return { ...item, label: 'งานวันนี้' };
      }
      
      if (item.key === 'home') {
        let homeItems = [];
        if (isAdmin || isOfficeTech || (!isMATech && !isOfficeTech)) {
          homeItems.push({ key: 'home', label: 'หน้าแรก', icon: item.icon });
        }
        if (isMATech) {
          homeItems.push({ key: 'home_ma', label: 'สรุปผล MA', icon: item.icon });
        }
        return homeItems;
      }
      return item;
    }).flat();

    if (items.length > 0) {
      dynamicMenuGroups.push({ ...group, items });
    }
  });

  return (
    <>
      {/* ── Overlay (mobile only) ──────────────────────── */}
      <div
        onClick={handleClose}
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 bottom-0 z-50 w-[280px] flex flex-col bg-white/80 backdrop-blur-2xl border-r border-white/50 shadow-2xl md:shadow-none transform transition-transform duration-300 ease-out md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>

        {/* ── Header ──────────────────────────────────── */}
        <div className="p-6 pb-4 border-b border-white/30">
          {/* Logo row */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-glow-green shrink-0">
                <BuildingIcon />
              </div>
              <div>
                <p className="text-[#042C53] font-bold text-lg leading-tight">Bount</p>
                <p className="text-[#378ADD] text-xs mt-0.5">ระบบจัดการงาน</p>
              </div>
            </div>
            {/* Close btn (mobile) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleClose();
              }}
              className="md:hidden w-8 h-8 rounded-lg glass border border-white/50 flex items-center justify-center text-[#378ADD] active:bg-[#E6F1FB] transition-colors">
              <svg className="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User card */}
          <div 
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-3 p-3.5 rounded-2xl border border-white/50 cursor-pointer hover:bg-white/40 transition-colors"
          >
            {/* Avatar */}
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center font-bold text-white text-base shadow-md shrink-0 overflow-hidden">
              {user?.profile_image ? (
                <img 
                  src={`/uploads/profiles/${user.profile_image}`} 
                  alt="Profile" 
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[#042C53] font-bold text-sm truncate">
                {user?.full_name || 'พนักงานช่าง'}
              </p>
              <div className="flex items-center flex-wrap gap-1 mt-1">
                {userRoles.map((r, i) => {
                  const label = r === 'super_admin' ? 'Super Admin' : 
                                r === 'admin' ? 'แอดมิน' : 
                                r === 'ma_technician' ? 'ช่าง MA' : 
                                r === 'technician' ? 'ช่าง Office' : 
                                r === 'sales' ? 'เซล' : r;
                  return (
                    <span key={i} className="text-[10px] font-semibold text-[#185FA5] bg-[#B5D4F4] border border-[#185FA5]/20 rounded-md px-1.5 py-0.5">
                      {label}
                    </span>
                  );
                })}
                {teamName && <span className="text-[11px] text-[#378ADD] truncate ml-1">{teamName}</span>}
              </div>
            </div>
            {/* Online dot */}
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] shrink-0" />
          </div>
        </div>

        {/* ── Navigation Groups ────────────────────────── */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-6 min-h-0">
          {dynamicMenuGroups.map((group) => (
            <div key={group.label}>
              <p className="text-[11px] font-bold tracking-wider text-[#378ADD] opacity-80 uppercase px-3 mb-2">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeKey === item.key;
                  const hasSub = !!item.subItems;
                  const isExpanded = expandedKeys[item.key];
                  // If activeKey matches any subItem, parent might be considered active (optional),
                  // but we'll stick to exact match or submatch.
                  const isSubActive = hasSub && item.subItems.some(sub => activeKey === sub.key);

                  return (
                    <div key={item.key} className="space-y-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          hasSub ? toggleExpand(item.key) : handleNav(item.key);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group overflow-hidden ${
                          (isActive || isSubActive)
                            ? 'bg-[#E6F1FB] border border-[#185FA5]/20 shadow-sm'
                            : 'border border-transparent hover:'
                        }`}>

                        {/* Active left bar */}
                        {(isActive || isSubActive) && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 rounded-r bg-brand-500" />
                        )}

                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                          (isActive || isSubActive) ? 'bg-[#B5D4F4] text-[#185FA5]' : 'glass text-[#378ADD] opacity-80 group-hover:text-[#185FA5] group-hover:bg-[#E6F1FB]'
                        }`}>
                          <item.icon active={isActive || isSubActive} />
                        </div>

                        <span className={`text-sm transition-colors ${
                          (isActive || isSubActive) ? 'font-bold text-[#0C447C]' : 'font-medium text-[#185FA5] group-hover:text-[#042C53]'
                        }`}>
                          {item.label}
                        </span>

                        {/* Expand/Collapse Arrow for subItems, or Active Arrow */}
                        {hasSub ? (
                          <svg className={`ml-auto w-4 h-4 text-[#378ADD] opacity-80 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : isActive ? (
                          <svg className="ml-auto w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        ) : null}
                      </button>

                      {/* Render SubItems */}
                      {hasSub && isExpanded && (
                        <div className="pl-[52px] pr-3 space-y-1 mt-1 animate-fade-in-up">
                          {item.subItems.map((sub) => {
                            const isChildActive = activeKey === sub.key;
                            return (
                              <button
                                type="button"
                                key={sub.key}
                                onClick={(e) => {
                                  e.preventDefault();
                                  handleNav(sub.key);
                                }}
                                className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-sm ${
                                  isChildActive 
                                    ? 'bg-[#B5D4F4]/50 text-[#0C447C] font-bold' 
                                    : 'text-[#378ADD] hover:glass hover:text-[#042C53] font-medium'
                                }`}
                              >
                                {sub.label}
                                {isChildActive && (
                                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-500" />
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* ── Footer ──────────────────────────────────── */}
        <div className="p-4 border-t border-white/30 mt-auto">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              logout();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 transition-all text-left group">
            <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
              <LogoutIcon />
            </div>
            <span className="text-sm font-semibold text-red-600 group-hover:text-red-700 transition-colors">ออกจากระบบ</span>
          </button>
          <p className="text-center text-[11px] text-[#378ADD] opacity-80 mt-4">
            Bount v1.0
          </p>
        </div>
      </aside>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 h-[70px] bg-white/90 backdrop-blur-xl border-t border-slate-200 z-30 flex items-center justify-around px-2 pb-safe shadow-[0_-10px_20px_rgba(0,0,0,0.03)] transition-transform duration-300 ${isOpen ? 'translate-y-full' : 'translate-y-0'}`}>
        <BottomNavItem icon={<HomeIcon active={activeKey === 'home' || activeKey === 'home_ma'} />} label="หน้าแรก" onClick={() => { handleClose(); handleNav('home'); }} active={activeKey === 'home' || activeKey === 'home_ma'} />
        <BottomNavItem icon={<JobsIcon active={activeKey === 'jobs'} />} label="งาน" onClick={() => { handleClose(); handleNav('jobs'); }} active={activeKey === 'jobs'} />
        <BottomNavItem icon={<CheckinIcon active={activeKey === 'checkin'} />} label="ลงเวลา" onClick={() => { handleClose(); handleNav('checkin'); }} active={activeKey === 'checkin'} />
        <BottomNavItem 
          icon={
            <svg className="w-[22px] h-[22px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          } 
          label="เมนู" 
          onClick={() => setLocalOpen(true)} 
          active={isOpen} 
        />
      </nav>

      {/* Profile Modal */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

function BottomNavItem({ icon, label, onClick, active }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center w-full h-full gap-1 transition-colors ${active ? 'text-[#185FA5]' : 'text-slate-400 hover:text-slate-600'}`}>
      <div className={`transition-transform duration-200 ${active ? 'scale-110' : 'scale-100'}`}>
        {icon}
      </div>
      <span className={`text-[10px] ${active ? 'font-bold' : 'font-medium'}`}>{label}</span>
    </button>
  );
}

// ── Icons ───────────────────────────────────────────────────
function HomeIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>;
}
function JobsIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>;
}
function BagIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
  </svg>;
}
function OilIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
  </svg>;
}
function CheckinIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>;
}
function MapIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>;
}
function ReportIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>;
}
function ProfileIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>;
}
function BuildingIcon() {
  return <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
  </svg>;
}
function LogoutIcon() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="text-red-500">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>;
}
function UsersIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>;
}

function CustomersIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>;
}

function InventoryIcon({ active }) { return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>; }
function DispatchIcon({ active }) { return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>; }

function EntryFeeIcon() {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="transition-colors">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChartBarIcon({ active }) {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 17V9m-5 8v-3m-5 3v-6" />
    </svg>
  );
}

function AnnouncementsIcon({ active }) {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  );
}

function DashboardIcon({ active }) {
  return (
    <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2 : 1.75} className="transition-colors">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}
