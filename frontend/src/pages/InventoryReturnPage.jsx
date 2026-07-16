import { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

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
  contractor_office: { bg: 'bg-sky-100', text: 'text-sky-700',    label: 'รับเหมาติดตั้ง' },
  contractor_ma: { bg: 'bg-violet-100', text: 'text-violet-700',  label: 'รับเหมา MA' },
  default:     { bg: 'bg-gray-100',  text: 'text-gray-600',       label: 'พนักงาน'     },
};

// ── Custom User Dropdown ─────────────────────────────────────────────
function UserDropdown({ users, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef  = useRef(null);
  const searchRef = useRef(null);

  const selectedUser = users.find(u => String(u.id) === String(value));

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

  const teamColorMap = {};
  let colorIdx = 0;
  users.forEach(u => {
    const key = u.team_name || '__none__';
    if (!teamColorMap[key]) {
      teamColorMap[key] = TEAM_COLORS[colorIdx % TEAM_COLORS.length];
      colorIdx++;
    }
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
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 shadow-sm ${tc.bg} ${tc.text}`}>
          {u.full_name?.charAt(0)?.toUpperCase() || '?'}
        </div>
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
    <div ref={wrapRef} className="relative z-10 w-full max-w-md">
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
          <span className="flex-1 text-[#9CA3AF] font-bold text-sm">-- เลือกช่างเพื่อดูสินค้าในกระเป๋า --</span>
        )}
        <svg
          className={`w-5 h-5 text-[#6B7280] shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-2xl"
        >
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
              <div className="space-y-0.5">
                {users.map(u => <UserRow key={u.id} u={u} inList />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InventoryReturnPage() {
  const [activeTab, setActiveTab] = useState('scan'); // 'scan' | 'manual'
  const [sn, setSn] = useState('');
  const [stagedItems, setStagedItems] = useState([]);
  const [loading, setLoading] = useState(false);

  // Manual Mode State
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [bagItems, setBagItems] = useState([]);
  const [loadingBag, setLoadingBag] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/users');
      setUsers(res.data.filter(u => u.status === 'approved' && ['technician', 'contractor_office', 'contractor_ma'].includes(u.role)));
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const handleSearchSN = async (e) => {
    e?.preventDefault();
    if (!sn.trim()) return;

    setLoading(true);
    try {
      const res = await axios.get(`/inventory/search-dispatched-sn/${encodeURIComponent(sn.trim())}`);
      const item = res.data;
      
      if (stagedItems.find(i => i.id === item.id)) {
         Swal.fire({ icon: 'warning', title: 'ซ้ำ!', text: 'สินค้านี้อยู่ในรายการรอคืนแล้ว', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
      } else {
         setStagedItems(prev => [...prev, { ...item, return_quantity: Math.floor(item.quantity) }]);
         Swal.fire({ icon: 'success', title: 'เพิ่มลงรายการรอคืนแล้ว', toast: true, position: 'top-end', timer: 1500, showConfirmButton: false });
      }
      setSn('');
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'ไม่พบสินค้า',
        text: err.response?.data?.error || 'ไม่พบสินค้านี้ในกระเป๋าช่างคนใด',
        confirmButtonColor: '#EF4444'
      });
    } finally {
      setLoading(false);
    }
  };

  const updateStagedQuantity = (id, val) => {
    const num = parseInt(val, 10);
    setStagedItems(prev => prev.map(item => {
      if (item.id === id) {
        if (!num || num < 1) return { ...item, return_quantity: 1 };
        if (num > item.quantity) return { ...item, return_quantity: Math.floor(item.quantity) };
        return { ...item, return_quantity: num };
      }
      return item;
    }));
  };

  const removeStagedItem = (id) => {
    setStagedItems(prev => prev.filter(i => i.id !== id));
  };

  const handleBulkReturn = async () => {
    if (stagedItems.length === 0) return;
    
    const result = await Swal.fire({
      title: 'ยืนยันการคืนสินค้า?',
      text: `คุณกำลังคืนสินค้าจำนวน ${stagedItems.length} รายการเข้าสู่คลังหลัก`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการคืนทั้งหมด',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#A3E635'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await axios.post('/inventory/return-bulk', {
          items: stagedItems.map(item => ({ item_id: item.id, return_quantity: item.return_quantity }))
        });
        Swal.fire({ icon: 'success', title: 'คืนสินค้าสำเร็จ!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        setStagedItems([]);
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: err.response?.data?.error || 'ไม่สามารถคืนสินค้าได้'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleReturnAction = async (item) => {
    const { value: quantityStr } = await Swal.fire({
      title: 'ระบุจำนวนที่ต้องการคืนเข้าคลัง',
      html: `
        <div class="mb-2 text-left text-sm">
          <p><strong>ชื่อสินค้า:</strong> ${item.product_name}</p>
          <p><strong>SN:</strong> ${item.sn}</p>
          <p><strong>ผู้ถือสินค้า:</strong> ${item.owner_name || '-'}</p>
          <hr class="my-2"/>
          <p>จำนวนคงเหลือ: <span class="font-bold text-lg text-[#1F2937]">${item.quantity}</span> ${item.unit || ''}</p>
        </div>
        <div class="text-sm text-red-500 font-bold bg-red-50 p-2 rounded-lg border border-red-100 mt-2">
          ⚠️ สินค้าจำนวนนี้จะนำกลับสู่สต๊อกทันที
        </div>
      `,
      input: 'number',
      inputValue: Math.floor(item.quantity),
      inputAttributes: { min: 1, max: Math.floor(item.quantity), step: 1 },
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการคืน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#A3E635',
      inputValidator: (value) => {
        return new Promise((resolve) => {
          const num = parseInt(value, 10);
          if (!num || num <= 0) resolve('จำนวนต้องมากกว่า 0 และเป็นจำนวนเต็ม');
          else if (num > parseFloat(item.quantity)) resolve('จำนวนเกินกว่าที่มีอยู่');
          else resolve();
        });
      }
    });

    if (quantityStr) {
      try {
        setLoading(true);
        await axios.post('/inventory/return', {
          item_id: item.id,
          return_quantity: parseInt(quantityStr, 10)
        });
        Swal.fire({ icon: 'success', title: 'คืนสินค้าสำเร็จ!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        
        // Refresh data
        if (activeTab === 'manual') {
          fetchBag(selectedUserId);
        }
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'เกิดข้อผิดพลาด',
          text: err.response?.data?.error || 'ไม่สามารถคืนสินค้าได้'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const fetchBag = async (uid) => {
    if (!uid) {
      setBagItems([]);
      return;
    }
    setLoadingBag(true);
    try {
      const res = await axios.get(`/inventory/my-bag?user_id=${uid}`);
      setBagItems(res.data);
    } catch (err) {
      console.error('Failed to load bag', err);
    } finally {
      setLoadingBag(false);
    }
  };

  useEffect(() => {
    fetchBag(selectedUserId);
  }, [selectedUserId]);

  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 border border-[#E5E7EB] shadow-sm">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-black text-[#1F2937] flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </div>
            คืนสินค้าเข้าคลัง (Return)
          </h2>
          <p className="text-sm font-medium text-[#6B7280] mt-1 ml-13">ดึงสินค้าจากกระเป๋าช่างกลับคืนสู่สต๊อกกลาง</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[#E5E7EB] mb-8">
        <button
          onClick={() => setActiveTab('scan')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'scan' ? 'border-[#A3E635] text-[#1F2937]' : 'border-transparent text-[#9CA3AF] hover:text-[#6B7280]'
          }`}
        >
          สแกนบาร์โค้ด SN
        </button>
        <button
          onClick={() => setActiveTab('manual')}
          className={`pb-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'manual' ? 'border-[#A3E635] text-[#1F2937]' : 'border-transparent text-[#9CA3AF] hover:text-[#6B7280]'
          }`}
        >
          เลือกจากกระเป๋าช่าง
        </button>
      </div>

      {activeTab === 'scan' && (
        <div className="max-w-xl">
          <form onSubmit={handleSearchSN} className="mb-8">
            <label className="block text-sm font-bold text-[#374151] mb-2">สแกนหรือพิมพ์ Serial Number (SN)</label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={sn}
                onChange={e => setSn(e.target.value)}
                placeholder="ระบุ SN ที่ต้องการคืน..."
                className="flex-1 px-4 py-3 bg-[#F9FAFB] border-2 border-[#E5E7EB] rounded-xl text-[#1F2937] font-bold focus:outline-none focus:border-[#A3E635] focus:ring-4 focus:ring-[#A3E635]/20 transition-all"
              />
              <button
                type="submit"
                disabled={loading || !sn}
                className="px-6 py-3 bg-[#1F2937] text-white font-bold rounded-xl hover:bg-[#374151] disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {loading ? 'กำลังค้นหา...' : 'ค้นหา'}
              </button>
            </div>
          </form>

          {stagedItems.length > 0 && (
            <div className="mt-8 animate-[fadeIn_0.3s_ease-out]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-[#1F2937]">รายการรอคืน ({stagedItems.length})</h3>
                <button
                  onClick={() => setStagedItems([])}
                  className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors"
                >ล้างรายการทั้งหมด</button>
              </div>
              
              <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden mb-6">
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                     <thead className="bg-[#F9FAFB] text-[#6B7280]">
                       <tr>
                         <th className="p-4 font-black">สินค้า</th>
                         <th className="p-4 font-black">SN</th>
                         <th className="p-4 font-black w-32">จำนวนคืน</th>
                         <th className="p-4 font-black text-right">จัดการ</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-[#E5E7EB]">
                       {stagedItems.map(item => (
                         <tr key={item.id} className="hover:bg-[#F9FAFB] transition-colors">
                           <td className="p-4">
                             <div className="font-black text-[#1F2937]">{item.product_name}</div>
                             <div className="text-xs font-bold text-[#6B7280]">{item.model_name}</div>
                             <div className="text-[10px] font-bold text-blue-600 mt-1">
                               ถือโดย: {item.owner_name} {item.team_name ? `(${item.team_name})` : ''}
                             </div>
                           </td>
                           <td className="p-4 font-mono font-bold text-[#1F2937]">{item.sn}</td>
                           <td className="p-4">
                             <div className="flex items-center gap-2">
                               <input 
                                 type="number" 
                                 min="1" 
                                 max={Math.floor(item.quantity)}
                                 value={item.return_quantity}
                                 onChange={e => updateStagedQuantity(item.id, e.target.value)}
                                 className="w-20 px-3 py-1.5 bg-white border border-[#E5E7EB] rounded-lg text-center font-bold focus:outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20"
                               />
                               <span className="text-xs font-bold text-[#9CA3AF]">/ {Math.floor(item.quantity)}</span>
                             </div>
                           </td>
                           <td className="p-4 text-right">
                             <button onClick={() => removeStagedItem(item.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors">
                               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
              </div>

              <button
                onClick={handleBulkReturn}
                disabled={loading}
                className="w-full py-4 rounded-xl font-black text-[#1F2937] shadow-[0_4px_15px_rgba(163,230,53,0.3)] hover:shadow-[0_6px_20px_rgba(163,230,53,0.4)] transition-all flex items-center justify-center gap-2 hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)' }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
                ยืนยันการคืนสินค้าทั้งหมด ({stagedItems.length} รายการ)
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'manual' && (
        <div>
          <div className="mb-6">
            <label className="block text-sm font-bold text-[#374151] mb-2">เลือกกระเป๋าช่าง</label>
            <UserDropdown users={users} value={selectedUserId} onChange={setSelectedUserId} />
          </div>

          {selectedUserId && (
            <div>
              <h3 className="text-lg font-black text-[#1F2937] mb-4">รายการสินค้าในกระเป๋า</h3>
              {loadingBag ? (
                <div className="py-12 flex justify-center"><p className="text-[#9CA3AF] font-bold">กำลังโหลด...</p></div>
              ) : bagItems.length === 0 ? (
                <div className="text-center py-12 bg-[#F9FAFB] rounded-2xl border border-dashed border-[#E5E7EB]">
                  <p className="text-[#9CA3AF] font-bold">ไม่มีสินค้าในกระเป๋าช่างคนนี้</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bagItems.map(item => (
                    <div key={item.id} className="p-4 border border-[#E5E7EB] rounded-2xl hover:border-[#A3E635] hover:shadow-md transition-all bg-white relative">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="text-sm font-black text-[#1F2937] line-clamp-1">{item.product_name}</p>
                          <p className="text-xs font-semibold text-[#6B7280]">{item.model_name}</p>
                        </div>
                      </div>
                      <div className="bg-[#F9FAFB] p-2 rounded-lg mb-4 border border-[#E5E7EB]">
                        <p className="text-xs font-semibold text-[#6B7280] mb-1">SN:</p>
                        <p className="text-xs font-bold text-[#1F2937] break-all">{item.sn || '-'}</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-black text-[#1F2937]">{item.quantity} {item.unit}</span>
                        <button
                          onClick={() => handleReturnAction(item)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-[#374151] border border-amber-300/30 hover:border-amber-400 flex items-center gap-1.5 bg-amber-50"
                        >
                          <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                          คืนคลัง
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
