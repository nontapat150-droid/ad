import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ProfileModal from './ProfileModal';
import { useBranding } from '../context/BrandingContext';
import { getImageUrl } from '../utils/imageUtils';

// ── Menu Definition ──────────────────────────────────────────────────────────
const MENU_GROUPS = [
  {
    label: 'เมนูหลัก',
    items: [
      { key: 'home',      label: 'หน้าแรก',          icon: HomeIcon      },
      { key: 'jobs',      label: 'ระบบแจกจ่ายงาน',    icon: JobsIcon      },
      { key: 'customers', label: 'ข้อมูลลูกค้า',      icon: CustomersIcon },
      { key: 'bag',       label: 'กระเป๋าช่าง',       icon: BagIcon       },
    ],
  },
  {
    label: 'บันทึกข้อมูล',
    items: [
      { key: 'entry_fee',     label: 'ค่าแรกเข้า',            icon: EntryFeeIcon  },
      { key: 'oil',           label: 'เติมน้ำมัน',             icon: OilIcon       },
      { key: 'oil_history',   label: 'ประวัติเติมน้ำมันทีม',    icon: OilHistoryIcon },
      { key: 'checkin',       label: 'ลงเวลาเข้างาน',          icon: CheckinIcon   },
      { key: 'ais_expansion', label: 'งานขยาย',                icon: MapIcon       },
    ],
  },
  {
    label: 'เพิ่มเติม',
    items: [
      { key: 'report', label: 'แจ้งปัญหา', icon: ReportIcon },
    ],
  },
];

export default function Sidebar({ open, onClose, activeKey, onNavigate }) {
  const { user, logout } = useAuth();
  const { branding } = useBranding();
  const sidebarRef = useRef(null);
  const navigate = useNavigate();
  const [expandedKeys, setExpandedKeys] = useState({ inventory: true });
  const [profileOpen, setProfileOpen] = useState(false);

  const toggleExpand = (key) => {
    setExpandedKeys(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Close on outside click (mobile)
  useEffect(() => {
    const handler = (e) => {
      if (open && window.innerWidth < 768 && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  // Lock body scroll when sidebar open on mobile
  useEffect(() => {
    if (open && window.innerWidth < 768) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const userRoles  = user?.roles || [user?.role || ''];
  const isSuperAdmin  = userRoles.includes('super_admin');
  const isAdminOnly   = userRoles.includes('admin') && !isSuperAdmin;
  const isAdmin       = isSuperAdmin || isAdminOnly;
  const isMATech      = userRoles.includes('ma_technician') || userRoles.includes('contractor_ma');
  const isOfficeTech  = userRoles.includes('technician') || userRoles.includes('contractor_office');
  const isSales       = userRoles.includes('sales');

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
      else if (key === 'home_ma')       navigate('/ma-tech');
      else if (key === 'checkin')       navigate('/checkin');
      else if (key === 'oil')           navigate('/oil');
      else if (key === 'inventory')     navigate('/inventory');
      else if (key === 'users')         navigate('/users');
      else if (key === 'bag')           navigate('/bag');
      else if (key === 'entry_fee')     navigate('/entry-fee');
      else if (key === 'jobs')          navigate('/dispatch-dashboard');
      else if (key === 'ma_performance')navigate('/ma-performance');
      else if (key === 'announcements') navigate('/announcements');
      else if (key === 'report')        navigate('/report');
      else if (key === 'customers')     navigate('/customers');
      else if (key === 'ais_expansion') navigate('/ais-expansion');
      else if (key === 'oil_history')   navigate('/oil-history');
      else if (key === 'settings')      navigate('/settings');
      else if (key === 'contractor_inventory') navigate('/contractor-inventory');
    }
    if (window.innerWidth < 768) onClose();
  };

  const ADMIN_GROUP = {
    label: 'ผู้ดูแลระบบ',
    items: [
      ...(isSuperAdmin ? [{ key: 'users', label: 'จัดการผู้ใช้', icon: UsersIcon }] : []),
      { key: 'inventory', label: 'ระบบคลัง', icon: InventoryIcon },
      { key: 'contractor_inventory', label: 'สรุปอุปกรณ์รับเหมา', icon: InventoryIcon },
      ...(isSuperAdmin ? [{ key: 'ma_performance', label: 'สรุปผล MA', icon: ChartBarIcon }] : []),
      { key: 'announcements', label: 'ระบบประกาศ', icon: AnnouncementsIcon },
      { key: 'report', label: 'รายการแจ้งปัญหา', icon: ReportIcon },
      ...(isSuperAdmin ? [{ key: 'settings', label: 'ตั้งค่าระบบ', icon: CogIcon }] : []),
    ],
  };

  // Filter menus based on role
  const baseGroups = MENU_GROUPS.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (isAdminOnly && ['oil', 'oil_history', 'entry_fee'].includes(item.key)) return false;
      return true;
    })
  })).filter(group => group.items.length > 0);

  const techGroups = MENU_GROUPS.map(group => {
    let items = group.items;
    items = items.map(item => {
      if (item.key === 'jobs' && (isOfficeTech || isMATech) && !isAdmin) {
        return { ...item, label: 'งานวันนี้' };
      }
      if (item.key === 'home') {
        let homeItems = [];
        if (isAdmin || isOfficeTech || isSales || (!isMATech && !isOfficeTech && !isSales)) {
          homeItems.push({ key: 'home', label: 'หน้าแรก', icon: item.icon });
        }
        if (isMATech) {
          homeItems.push({ key: 'home_ma', label: 'สรุปผล MA ของฉัน', icon: item.icon });
        }
        return homeItems;
      }
      return item;
    }).flat();

    return {
      ...group,
      items: items.filter(item => {
        if (isSales && !isAdmin) {
          const allowedForSales = ['home', 'oil', 'oil_history', 'checkin', 'ais_expansion', 'report'];
          return allowedForSales.includes(item.key);
        }
        if (isMATech && !isOfficeTech && !isAdmin) {
          const allowedForMATech = ['home_ma', 'bag', 'oil', 'oil_history', 'report', 'jobs', 'checkin'];
          return allowedForMATech.includes(item.key);
        }
        if (isOfficeTech && !isAdmin) {
          const allowedForOfficeTech = ['home', 'home_ma', 'bag', 'entry_fee', 'oil', 'oil_history', 'report', 'jobs', 'checkin'];
          return allowedForOfficeTech.includes(item.key);
        }
        return ['home', 'home_ma', 'checkin', 'jobs', 'oil', 'oil_history', 'entry_fee', 'bag', 'report', 'ais_expansion'].includes(item.key);
      })
    };
  }).filter(group => group.items.length > 0);

  const dynamicMenuGroups = isAdmin
    ? [...baseGroups, ADMIN_GROUP]
    : techGroups;

  return (
    <>
      {/* ── Overlay (mobile) ─────────────────────────────── */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#1F2937]/60 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* ── Sidebar Panel ────────────────────────────────── */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 bottom-0 z-50 w-[272px] flex flex-col transition-transform duration-300 ease-out md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          background: '#1F2937',
          borderRight: '1px solid rgba(163,230,53,0.12)',
          boxShadow: '4px 0 24px rgba(0,0,0,0.25)',
        }}
      >
        {/* ── Header: Logo + Brand ─────────────────────── */}
        <div className="px-5 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              {branding?.website_logo ? (
                <img src={getImageUrl(branding.website_logo, 'branding')} alt="Logo" className="w-10 h-10 object-contain rounded-xl" />
              ) : (
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-md"
                  style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)', boxShadow: '0 4px 12px rgba(163,230,53,0.3)' }}>
                  <svg className="w-5 h-5 text-[#1F2937]" viewBox="0 0 24 24" fill="none">
                    <path d="M12 18a1 1 0 100-2 1 1 0 000 2z" fill="currentColor"/>
                    <path d="M8.5 14.5a5 5 0 017 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M5.5 11.5a9 9 0 0113 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                    <path d="M2.5 8.5a13 13 0 0119 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                </div>
              )}
              <div>
                <p className="text-white font-black text-base leading-tight">
                  {branding?.website_name || 'Bonus'}
                </p>
                <p className="text-[#A3E635] text-[10px] font-bold tracking-widest uppercase">AIS Platform</p>
              </div>
            </div>
            {/* Close btn (mobile only) */}
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* User card */}
          <div
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all hover:bg-white/5 group"
            style={{ border: '1px solid rgba(163,230,53,0.15)', background: 'rgba(163,230,53,0.05)' }}
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-[#1F2937] text-sm shadow-md shrink-0 overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
              {user?.profile_image ? (
                <img
                  src={`/uploads/profiles/${user.profile_image}`}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm truncate leading-tight">
                {user?.full_name || 'พนักงานช่าง'}
              </p>
              <div className="flex items-center flex-wrap gap-1 mt-1">
                {userRoles.map((r, i) => {
                  const label = r === 'super_admin' ? 'Super Admin'
                    : r === 'admin'          ? 'แอดมิน'
                    : r === 'ma_technician'  ? 'ช่าง MA'
                    : r === 'technician'     ? 'ช่างติดตั้ง'
                    : r === 'contractor_office' ? 'รับเหมาติดตั้ง'
                    : r === 'contractor_ma'  ? 'รับเหมา MA'
                    : r === 'sales'          ? 'เซล' : r;
                  return (
                    <span key={i}
                      className="text-[9px] font-bold text-[#1F2937] bg-[#A3E635] rounded px-1.5 py-0.5 leading-none">
                      {label}
                    </span>
                  );
                })}
                {teamName && <span className="text-[10px] text-[#9CA3AF] truncate ml-0.5">{teamName}</span>}
              </div>
            </div>
            {/* Online indicator */}
            <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#A3E635]"
              style={{ boxShadow: '0 0 8px rgba(163,230,53,0.6)' }} />
          </div>
        </div>

        {/* ── Navigation ───────────────────────────────── */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 min-h-0 custom-scrollbar">
          {dynamicMenuGroups.map((group) => (
            <div key={group.label}>
              {/* Group label */}
              <p className="text-[10px] font-bold tracking-[0.18em] uppercase px-3 mb-2"
                style={{ color: 'rgba(163,230,53,0.55)' }}>
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive   = activeKey === item.key;
                  const hasSub     = !!item.subItems;
                  const isExpanded = expandedKeys[item.key];
                  const isSubActive = hasSub && item.subItems.some(sub => activeKey === sub.key);

                  return (
                    <div key={item.key} className="space-y-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          hasSub ? toggleExpand(item.key) : handleNav(item.key);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 relative group overflow-hidden"
                        style={
                          (isActive || isSubActive)
                            ? {
                                background: 'linear-gradient(135deg, rgba(163,230,53,0.18), rgba(101,163,13,0.12))',
                                border: '1px solid rgba(163,230,53,0.35)',
                              }
                            : {
                                background: 'transparent',
                                border: '1px solid transparent',
                              }
                        }
                        onMouseEnter={e => {
                          if (!isActive && !isSubActive) {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.border = '1px solid rgba(255,255,255,0.08)';
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive && !isSubActive) {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.border = '1px solid transparent';
                          }
                        }}
                      >
                        {/* Active left accent bar */}
                        {(isActive || isSubActive) && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 rounded-r-full bg-[#A3E635]"
                            style={{ boxShadow: '0 0 6px rgba(163,230,53,0.5)' }} />
                        )}

                        {/* Icon container */}
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200 ${
                          (isActive || isSubActive)
                            ? 'text-[#A3E635]'
                            : 'text-[#6B7280] group-hover:text-[#D1D5DB]'
                        }`}
                          style={
                            (isActive || isSubActive)
                              ? { background: 'rgba(163,230,53,0.15)' }
                              : { background: 'transparent' }
                          }>
                          <item.icon active={isActive || isSubActive} />
                        </div>

                        {/* Label */}
                        <span className={`text-sm flex-1 transition-colors duration-200 ${
                          (isActive || isSubActive)
                            ? 'font-bold text-white'
                            : 'font-medium text-[#9CA3AF] group-hover:text-[#E5E7EB]'
                        }`}>
                          {item.label}
                        </span>

                        {/* Arrow / expand */}
                        {hasSub ? (
                          <svg className={`w-4 h-4 text-[#6B7280] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        ) : isActive ? (
                          <svg className="w-3.5 h-3.5 text-[#A3E635]" fill="currentColor" viewBox="0 0 8 8">
                            <circle cx="4" cy="4" r="3" />
                          </svg>
                        ) : null}
                      </button>

                      {/* Sub items */}
                      {hasSub && isExpanded && (
                        <div className="pl-[44px] pr-2 space-y-0.5 mt-0.5 animate-fade-in-up">
                          {item.subItems.map((sub) => {
                            const isChildActive = activeKey === sub.key;
                            return (
                              <button
                                type="button"
                                key={sub.key}
                                onClick={(e) => { e.preventDefault(); handleNav(sub.key); }}
                                className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-sm ${
                                  isChildActive
                                    ? 'text-[#A3E635] font-bold bg-[#A3E635]/10'
                                    : 'text-[#6B7280] hover:text-[#D1D5DB] hover:bg-white/5 font-medium'
                                }`}
                              >
                                {sub.label}
                                {isChildActive && (
                                  <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#A3E635]" />
                                )}
                              </button>
                            );
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

        {/* ── Footer: Logout ───────────────────────────── */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); logout(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left group"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center group-hover:bg-red-500/25 transition-colors">
              <LogoutIcon />
            </div>
            <span className="text-sm font-semibold text-red-400 group-hover:text-red-300 transition-colors">
              ออกจากระบบ
            </span>
          </button>

          {/* Version */}
          <p className="text-center text-[10px] mt-3" style={{ color: 'rgba(163,230,53,0.35)' }}>
            Bonus v2.0 · AIS Platform
          </p>
        </div>
      </aside>

      {/* Profile Modal */}
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────
function HomeIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
  </svg>;
}
function JobsIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
  </svg>;
}
function BagIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
  </svg>;
}
function OilIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
  </svg>;
}
function CheckinIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>;
}
function MapIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>;
}
function ReportIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
  </svg>;
}
function LogoutIcon() {
  return <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="text-red-400">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
  </svg>;
}
function UsersIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
  </svg>;
}
function CustomersIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>;
}
function InventoryIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>;
}
function ChartBarIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M18 17V9m-5 8v-3m-5 3v-6" />
  </svg>;
}
function AnnouncementsIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
  </svg>;
}
function EntryFeeIcon() {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>;
}
function OilHistoryIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>;
}
function CogIcon({ active }) {
  return <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 2.2 : 1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>;
}
