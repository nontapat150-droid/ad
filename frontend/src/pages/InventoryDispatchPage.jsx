import { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import ExportModal from '../components/ExportModal';

// ── Team colour palette ──────────────────────────────────────────────────────
const TEAM_COLORS = [
  { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  { bg: 'bg-violet-100',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500'  },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-100',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-500'   },
  { bg: 'bg-rose-100',    text: 'text-rose-700',    border: 'border-rose-200',    dot: 'bg-rose-500'    },
  { bg: 'bg-cyan-100',    text: 'text-cyan-700',    border: 'border-cyan-200',    dot: 'bg-cyan-500'    },
  { bg: 'bg-orange-100',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500'  },
  { bg: 'bg-pink-100',    text: 'text-pink-700',    border: 'border-pink-200',    dot: 'bg-pink-500'    },
];

const ROLE_STYLES = {
  super_admin: { bg: 'bg-[#1F2937]', text: 'text-white',          label: 'Super Admin' },
  admin:       { bg: 'bg-[#A3E635]', text: 'text-[#1F2937]',      label: 'Admin'       },
  technician:  { bg: 'bg-sky-100',   text: 'text-sky-700',        label: 'ช่าง'        },
  default:     { bg: 'bg-gray-100',  text: 'text-gray-600',       label: 'พนักงาน'     },
};

// ── Custom Premium User Dropdown ─────────────────────────────────────────────
function UserDropdown({ users, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef  = useRef(null);
  const searchRef = useRef(null);

  const selectedUser = users.find(u => String(u.id) === String(value));

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 60);
    else setSearch('');
  }, [open]);

  // Deterministic team → colour map
  const teamColorMap = {};
  let colorIdx = 0;
  users.forEach(u => {
    const key = u.team_name || '__none__';
    if (!teamColorMap[key]) {
      teamColorMap[key] = TEAM_COLORS[colorIdx % TEAM_COLORS.length];
      colorIdx++;
    }
  });

  // Group users by team
  const groups = {};
  users.forEach(u => {
    const key = u.team_name || 'ไม่มีทีม';
    if (!groups[key]) groups[key] = [];
    groups[key].push(u);
  });

  const filteredUsers = search.trim()
    ? users.filter(u =>
        u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.team_name?.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const getRoleStyle = (role) => ROLE_STYLES[role] || ROLE_STYLES.default;

  const UserRow = ({ u, inList = false }) => {
    const tc = teamColorMap[u.team_name || '__none__'];
    const rc = getRoleStyle(u.role);
    const isSelected = String(u.id) === String(value);
    return (
      <button
        type="button"
        onClick={() => { onChange(String(u.id)); setOpen(false); }}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left rounded-xl transition-all
          ${inList ? 'hover:bg-[#F9FAFB] active:scale-[0.99]' : ''}
          ${isSelected ? 'bg-[#F0FDF4] ring-1 ring-[#A3E635]/60' : ''}`}
      >
        {/* Avatar circle */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${tc.bg} ${tc.text}`}>
          {u.full_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
        {/* Name + badges */}
        <div className="flex-1 min-w-0">
          <p className="font-black text-[#1F2937] text-sm truncate">{u.full_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {u.team_name && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${tc.bg} ${tc.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${tc.dot}`} />
                {u.team_name}
              </span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${rc.bg} ${rc.text}`}>
              {rc.label}
            </span>
          </div>
        </div>
        {/* Checkmark */}
        {isSelected && (
          <svg className="w-4 h-4 text-[#84CC16] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
    );
  };

  const triggerTc = selectedUser ? teamColorMap[selectedUser.team_name || '__none__'] : null;
  const triggerRc = selectedUser ? getRoleStyle(selectedUser.role) : null;

  return (
    <div ref={wrapRef} className="relative">

      {/* ── Trigger Button ── */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-5 py-4 bg-[#F9FAFB] border-2 rounded-2xl transition-all text-left
          ${open
            ? 'border-[#A3E635] ring-4 ring-[#A3E635]/20 shadow-[0_8px_30px_rgba(163,230,53,0.2)]'
            : 'border-[#E5E7EB] hover:border-[#A3E635]/60 hover:shadow-md'}`}
      >
        {selectedUser ? (
          <>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${triggerTc.bg} ${triggerTc.text}`}>
              {selectedUser.full_name?.charAt(0)?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[#1F2937] text-sm truncate">{selectedUser.full_name}</p>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                {selectedUser.team_name && (
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${triggerTc.bg} ${triggerTc.text}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${triggerTc.dot}`} />
                    {selectedUser.team_name}
                  </span>
                )}
                <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${triggerRc.bg} ${triggerRc.text}`}>
                  {triggerRc.label}
                </span>
              </div>
            </div>
          </>
        ) : (
          <span className="flex-1 text-[#9CA3AF] font-bold text-sm">-- เลือกชื่อช่าง --</span>
        )}
        <svg
          className={`w-5 h-5 text-[#6B7280] shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* ── Dropdown Panel ── */}
      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden"
          style={{
            boxShadow: '0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
            animation: 'dropdownIn 0.22s cubic-bezier(0.16,1,0.3,1)'
          }}
        >
          {/* Search bar */}
          <div className="p-3 border-b border-[#F3F4F6] bg-[#FAFAFA]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อหรือทีม..."
                className="w-full pl-9 pr-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-sm text-[#1F2937] font-bold focus:outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 transition-all"
              />
            </div>
          </div>

          {/* User list */}
          <div className="max-h-72 overflow-y-auto p-2">
            {filteredUsers ? (
              filteredUsers.length === 0 ? (
                <p className="text-center text-sm text-[#9CA3AF] font-bold py-6">ไม่พบผู้ใช้ที่ค้นหา</p>
              ) : (
                <div className="space-y-0.5">
                  {filteredUsers.map(u => <UserRow key={u.id} u={u} inList />)}
                </div>
              )
            ) : (
              Object.entries(groups).map(([teamName, members]) => {
                const tc = teamColorMap[teamName === 'ไม่มีทีม' ? '__none__' : teamName];
                return (
                  <div key={teamName} className="mb-3 last:mb-0">
                    {/* Team header */}
                    <div className={`flex items-center gap-2 px-3 py-1.5 mb-1 rounded-lg mx-1 ${tc?.bg || 'bg-gray-100'}`}>
                      <span className={`w-2 h-2 rounded-full ${tc?.dot || 'bg-gray-400'}`} />
                      <span className={`text-xs font-black uppercase tracking-wider ${tc?.text || 'text-gray-600'}`}>{teamName}</span>
                      <span className={`ml-auto text-xs font-bold ${tc?.text || 'text-gray-600'}`}>{members.length} คน</span>
                    </div>
                    <div className="space-y-0.5">
                      {members.map(u => <UserRow key={u.id} u={u} inList />)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
      `}</style>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function InventoryDispatchPage() {
  const [loading, setLoading] = useState(false);
  const [stagedItems, setStagedItems] = useState([]);
  const [snInput, setSnInput] = useState('');
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const snInputRef = useRef(null);

  useEffect(() => {
    fetchUsers();
    setTimeout(() => snInputRef.current?.focus(), 100);
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/users');
      setUsers(res.data.filter(u => u.status === 'approved'));
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const handleSearchSn = async (e) => {
    if (e) e.preventDefault();
    if (!snInput.trim()) return;
    if (stagedItems.some(item => item.sn === snInput.trim())) {
      Swal.fire({ icon: 'warning', title: 'สินค้านี้รอเบิกอยู่แล้ว', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
      setSnInput('');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`/inventory/search-sn/${encodeURIComponent(snInput.trim())}`);
      setStagedItems(prev => [...prev, res.data]);
      setSnInput('');
    } catch (err) {
      const msg = err.response?.data?.error || 'ไม่พบสินค้า หรือสินค้านี้เบิกไปแล้ว';
      Swal.fire({ icon: 'error', title: 'ไม่สามารถนำมาพักได้', text: msg, toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
    } finally {
      setLoading(false);
      setTimeout(() => snInputRef.current?.focus(), 100);
    }
  };

  const handleRemoveFromStaging = (index) => {
    setStagedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleDispatch = async () => {
    if (stagedItems.length === 0) {
      Swal.fire({ icon: 'warning', title: 'ไม่มีสินค้าสำหรับเบิก' });
      return;
    }
    if (!selectedUserId) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกช่าง/ผู้รับของ' });
      return;
    }
    const selectedUser = users.find(u => u.id === parseInt(selectedUserId));
    const result = await Swal.fire({
      title: 'ยืนยันการเบิกสินค้า?',
      html: `
        <div class="text-left font-sans space-y-2 mb-4 p-5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm">
          <p><strong class="text-[#1F2937] text-base">ผู้เบิกรับ:</strong> <span class="font-bold">${selectedUser.full_name}</span>
          <br/><span class="text-xs font-bold text-[#6B7280] bg-white px-2 py-1 rounded-md border border-[#E5E7EB] inline-block mt-1">ทีม: ${selectedUser.team_name || 'ไม่มีทีม'}</span></p>
          <div class="h-px bg-[#E5E7EB] my-2"></div>
          <p><strong class="text-[#1F2937] text-base">จำนวนรวม:</strong>
          <span class="font-black text-[#A3E635] text-lg bg-white px-3 py-1 rounded-xl shadow-sm border border-[#E5E7EB]">${stagedItems.length} รายการ</span></p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1F2937',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'ยืนยันการเบิก',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-3xl' }
    });
    if (!result.isConfirmed) return;
    setLoading(true);
    try {
      const payload = { target_user_id: selectedUser.id, items: stagedItems.map(item => ({ id: item.id })) };
      const res = await axios.post('/inventory/dispatch', payload);
      Swal.fire({ icon: 'success', title: 'เบิกสินค้าเรียบร้อย!', text: res.data.message, confirmButtonColor: '#1F2937', customClass: { popup: 'rounded-3xl' } });
      setStagedItems([]);
      setSelectedUserId('');
      setTimeout(() => snInputRef.current?.focus(), 100);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ล้มเหลว', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการเบิกสินค้า', customClass: { popup: 'rounded-3xl' } });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Scanner + Picker ── */}
        <div className="lg:col-span-1 space-y-6">

          {/* Scanner */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-black text-[#1F2937] mb-6 border-b border-[#E5E7EB] pb-4">สแกน / ค้นหาสินค้า</h2>
            <form onSubmit={handleSearchSn} className="flex flex-col gap-4">
              <div className="relative">
                <input
                  ref={snInputRef}
                  type="text"
                  value={snInput}
                  onChange={(e) => {
                    setSnInput(e.target.value);
                    if (e.target.value.length >= 12) {
                      setTimeout(() => { if (snInputRef.current?.value.length >= 12) handleSearchSn(); }, 300);
                    }
                  }}
                  placeholder="สแกนบาร์โค้ด SN..."
                  className="w-full px-5 py-4 bg-[#F9FAFB] border-2 border-[#E5E7EB] rounded-2xl focus:border-[#A3E635] focus:ring-4 focus:ring-[#A3E635]/20 outline-none text-[#1F2937] font-black tracking-wide transition-all"
                  autoFocus
                />
                <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading || !snInput}
                className="bg-[#1F2937] hover:bg-[#374151] text-white font-bold px-4 py-4 rounded-2xl transition-all disabled:opacity-50 shadow-[0_4px_15px_rgba(31,41,55,0.2)] hover:scale-[1.02] active:scale-95"
              >
                นำมาพักรอเบิก
              </button>
            </form>
          </div>

          {/* User Picker */}
          <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8">
            <h2 className="text-xl font-black text-[#1F2937] mb-6 border-b border-[#E5E7EB] pb-4">เลือกผู้รับของ (ช่าง)</h2>
            <UserDropdown users={users} value={selectedUserId} onChange={setSelectedUserId} />
            {selectedUserId && (
              <div className="mt-3 p-3 bg-[#F0FDF4] border border-[#A3E635]/40 rounded-2xl flex items-center gap-2">
                <svg className="w-4 h-4 text-[#84CC16] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <p className="text-xs font-bold text-[#4B5563]">เลือกแล้ว — กดยืนยันเบิกสินค้าด้านขวาได้เลย</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Staging ── */}
        <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-[#E5E7EB] flex flex-col h-[calc(100vh-160px)]">
          <div className="p-6 sm:p-8 border-b border-[#E5E7EB] rounded-t-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-[#F9FAFB]">
            <div>
              <h2 className="text-xl font-black text-[#1F2937]">รายการรอเบิก (Staging)</h2>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-sm font-bold text-[#6B7280]">จำนวนทั้งหมด {stagedItems.length} รายการ</p>
                <button 
                  onClick={() => setShowExportModal(true)}
                  className="px-3 py-1 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export
                </button>
              </div>
            </div>
            <button
              onClick={handleDispatch}
              disabled={loading || stagedItems.length === 0 || !selectedUserId}
              className="bg-[#A3E635] hover:bg-[#84CC16] text-[#1F2937] font-black px-6 py-3.5 rounded-2xl disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(163,230,53,0.3)] disabled:shadow-none transition-all flex items-center gap-2 active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              ยืนยันเบิกสินค้า
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[#F9FAFB]">
            {stagedItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-[#9CA3AF]">
                <div className="w-20 h-20 bg-white border border-[#E5E7EB] rounded-full flex items-center justify-center mb-4 shadow-sm">
                  <svg className="w-10 h-10 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <p className="font-black text-lg text-[#6B7280]">ยังไม่มีสินค้าในตะกร้ารอเบิก</p>
                <p className="text-sm font-medium mt-1">กรุณาสแกนหรือพิมพ์รหัส SN ด้านซ้ายมือ</p>
              </div>
            ) : (
              <div className="space-y-3">
                {stagedItems.map((item, index) => (
                  <div
                    key={`stage-${index}`}
                    className="flex items-center justify-between p-5 bg-white border border-[#E5E7EB] rounded-2xl hover:border-[#A3E635] hover:shadow-[0_4px_12px_rgba(163,230,53,0.15)] transition-all"
                    style={{ animation: `dropdownIn 0.25s ease-out ${index * 30}ms both` }}
                  >
                    <div>
                      <p className="font-black text-[#1F2937] text-lg font-mono">{item.sn}</p>
                      <p className="text-sm font-bold text-[#6B7280] mt-1">{item.product_name} - {item.model_name}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="bg-[#F3F4F6] border border-[#E5E7EB] text-[#1F2937] px-4 py-2 rounded-xl text-sm font-black shadow-sm">
                        จำนวน: {parseFloat(item.quantity).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                      </span>
                      <button
                        onClick={() => handleRemoveFromStaging(index)}
                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100 active:scale-95"
                        title="เอาออก"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
      
      {/* Export Modal */}
      <ExportModal 
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={stagedItems}
        title="ส่งออกรายการนำออก (Dispatch)"
        fileNamePrefix="Dispatch_Staging"
      />
    </div>
  );
}
