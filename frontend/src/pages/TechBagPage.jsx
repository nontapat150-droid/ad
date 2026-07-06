import { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';

export default function TechBagPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Roles
  const userRoles = user?.roles || [user?.role || ''];
  const isAdmin = userRoles.some(r => ['super_admin', 'admin'].includes(r));

  // State
  const [bagItems, setBagItems] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [users, setUsers] = useState([]); 
  const [activeTab, setActiveTab] = useState('bag');
  const [selectedUserId, setSelectedUserId] = useState(user?.id);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchBag(selectedUserId);
      fetchHistory(selectedUserId);
    }
  }, [selectedUserId]);

  const fetchBag = async (uid) => {
    setLoading(true);
    try {
      const res = await axios.get(`/inventory/my-bag?user_id=${uid}`);
      setBagItems(res.data);
    } catch (err) {
      console.error('Failed to load bag', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (uid) => {
    try {
      const res = await axios.get(`/inventory/my-history?user_id=${uid}`);
      setHistoryItems(res.data);
    } catch (err) {
      console.error('Failed to load history', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/users');
      setUsers(res.data.filter(u => u.status === 'approved'));
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const handleTransfer = async (item) => {
    const userOptions = {};
    users.forEach(u => {
      userOptions[u.id] = `${u.full_name} ${u.team_name ? '('+u.team_name+')' : ''}`;
    });

    const { value: targetUserId } = await Swal.fire({
      title: 'เลือกช่างที่ต้องการโอนให้',
      input: 'select',
      inputOptions: userOptions,
      inputPlaceholder: '-- เลือกชื่อช่าง --',
      showCancelButton: true,
      confirmButtonText: 'ถัดไป',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (value) => {
        return new Promise((resolve) => {
          if (value) resolve();
          else resolve('กรุณาเลือกช่าง');
        });
      }
    });

    if (!targetUserId) return;

    const { value: quantityStr } = await Swal.fire({
      title: 'ระบุจำนวนที่ต้องการโอน',
      text: `จำนวนคงเหลือของคุณ: ${item.quantity}`,
      input: 'number',
      inputValue: item.quantity,
      inputAttributes: { min: 0.1, max: item.quantity, step: 0.1 },
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการโอน',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (value) => {
        return new Promise((resolve) => {
          const num = parseFloat(value);
          if (!num || num <= 0) resolve('จำนวนต้องมากกว่า 0');
          else if (num > parseFloat(item.quantity)) resolve('จำนวนเกินกว่าที่มีอยู่');
          else resolve();
        });
      }
    });

    if (!quantityStr) return;

    try {
      setLoading(true);
      await axios.post('/inventory/transfer', {
        item_id: item.id,
        target_user_id: parseInt(targetUserId),
        transfer_quantity: parseFloat(quantityStr)
      });
      Swal.fire({ icon: 'success', title: 'โอนของสำเร็จ!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
      fetchBag(selectedUserId);
      fetchHistory(selectedUserId);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ล้มเหลว', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการโอน' });
    } finally {
      setLoading(false);
    }
  };

  // --- Admin Functions ---
  const handleEditQuantity = async (item) => {
    const { value: quantityStr } = await Swal.fire({
      title: 'แก้ไขจำนวนสินค้า',
      text: `จำนวนปัจจุบัน: ${item.quantity}`,
      input: 'number',
      inputValue: item.quantity,
      inputAttributes: { min: 0.1, step: 0.1 },
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (value) => {
        return new Promise((resolve) => {
          if (!parseFloat(value) || parseFloat(value) <= 0) resolve('จำนวนต้องมากกว่า 0');
          else resolve();
        });
      }
    });

    if (!quantityStr) return;

    try {
      setLoading(true);
      await axios.put(`/inventory/items/tech/${item.id}`, { quantity: parseFloat(quantityStr) });
      Swal.fire({ icon: 'success', title: 'อัปเดตจำนวนสำเร็จ!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
      fetchBag(selectedUserId);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ล้มเหลว', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการแก้ไข' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteItem = async (item) => {
    const result = await Swal.fire({
      title: 'ลบสินค้านี้ออกจากกระเป๋าช่าง?',
      text: "การลบนี้จะเปลี่ยนสถานะสินค้าเป็น 'ถูกใช้/สูญหาย' คุณแน่ใจหรือไม่?",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        setLoading(true);
        await axios.delete(`/inventory/items/tech/${item.id}`);
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        fetchBag(selectedUserId);
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ล้มเหลว', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการลบ' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleDeleteLog = async (logId) => {
    const result = await Swal.fire({
      title: 'ลบประวัติรายการนี้?',
      text: "ประวัติการโอนย้ายนี้จะหายไปจากระบบแบบถาวร",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/inventory/logs/${logId}`);
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ!', toast: true, position: 'top-end', timer: 2000, showConfirmButton: false });
        fetchHistory(selectedUserId);
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ล้มเหลว', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการลบ' });
      }
    }
  };

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6]">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="bag" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[272px]">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB] shrink-0 z-10"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-xl text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                <svg className="w-4 h-4 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                </svg>
              </div>
              <h1 className="font-bold text-[#1F2937] text-lg tracking-tight">กระเป๋าช่าง</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationBell />
            {/* Admin User Selector (Desktop) */}
            {isAdmin && (
              <div className="hidden sm:block">
                <CustomUserSelect 
                  value={selectedUserId} 
                  onChange={setSelectedUserId} 
                  users={users} 
                />
              </div>
            )}
          </div>
        </header>

        {/* Mobile Admin User Selector */}
        {isAdmin && (
          <div className="sm:hidden px-4 py-3 bg-white border-b border-[#E5E7EB] relative z-[9]">
            <label className="block text-[10px] font-bold text-[#9CA3AF] uppercase tracking-wider mb-1.5">เลือกช่างเพื่อดูข้อมูล</label>
            <CustomUserSelect 
              value={selectedUserId} 
              onChange={setSelectedUserId} 
              users={users} 
            />
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-5">
            
            {/* ── Tabs ─────────────────────────────────────── */}
            <div className="flex gap-1 bg-white p-1.5 rounded-xl border border-[#E5E7EB]"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <button 
                type="button"
                onClick={() => setActiveTab('bag')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'bag'
                    ? 'text-[#1F2937] shadow-sm'
                    : 'text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F9FAFB]'
                }`}
                style={activeTab === 'bag' ? {
                  background: 'linear-gradient(135deg, rgba(163,230,53,0.18), rgba(101,163,13,0.10))',
                  border: '1px solid rgba(163,230,53,0.35)',
                } : { border: '1px solid transparent' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                </svg>
                สินค้าในกระเป๋า
                <span className={`py-0.5 px-2 rounded-md text-xs font-bold ${
                  activeTab === 'bag' ? 'bg-[#A3E635]/20 text-[#374151]' : 'bg-[#F3F4F6] text-[#9CA3AF]'
                }`}>{bagItems.length}</span>
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('history')}
                className={`flex-1 py-2.5 px-4 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
                  activeTab === 'history'
                    ? 'text-[#1F2937] shadow-sm'
                    : 'text-[#9CA3AF] hover:text-[#374151] hover:bg-[#F9FAFB]'
                }`}
                style={activeTab === 'history' ? {
                  background: 'linear-gradient(135deg, rgba(163,230,53,0.18), rgba(101,163,13,0.10))',
                  border: '1px solid rgba(163,230,53,0.35)',
                } : { border: '1px solid transparent' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                ประวัติการรับ/โอน
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20 flex-col gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse"
                  style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                  <svg className="w-5 h-5 text-[#1F2937] animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <span className="text-sm text-[#9CA3AF] font-medium">กำลังโหลดข้อมูล...</span>
              </div>
            ) : (
              <div key={activeTab} className="animate-fade-in">
                {activeTab === 'bag' ? (
                  // ── BAG TAB ──
                  bagItems.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl border border-[#E5E7EB] text-center flex flex-col items-center justify-center"
                      style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                      <div className="w-16 h-16 bg-[#F3F4F6] rounded-2xl flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z" />
                        </svg>
                      </div>
                      <p className="text-lg font-bold text-[#1F2937]">ไม่มีสินค้าในกระเป๋า</p>
                      <p className="text-[#9CA3AF] text-sm mt-1">เมื่อคุณได้รับการเบิกจ่าย สินค้าจะมาปรากฏที่นี่</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bagItems.map((item, index) => (
                        <div key={item.id}
                          className="bg-white p-5 rounded-xl border border-[#E5E7EB] hover:border-[#A3E635]/30 hover:shadow-md transition-all duration-200 flex flex-col group"
                          style={{
                            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                            animation: `fadeInUp 0.3s ease-out ${index * 60}ms both`,
                          }}>
                          <div className="flex justify-between items-start mb-4 gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="inline-block px-2 py-0.5 bg-[#A3E635]/10 text-[#65a30d] text-[10px] font-bold rounded-md uppercase tracking-wider mb-2 border border-[#A3E635]/20">
                                {item.product_name}
                              </span>
                              <h3 className="font-bold text-[#1F2937] text-base leading-tight break-all">{item.sn}</h3>
                              <p className="text-xs text-[#9CA3AF] mt-1 flex flex-wrap items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-[#D1D5DB] inline-block" />
                                โมเดล: <span className="text-[#6B7280] font-medium">{item.model_name}</span>
                                {item.phone_number && (
                                  <>
                                    <span className="w-1 h-1 rounded-full bg-[#D1D5DB] inline-block ml-1" />
                                    เบอร์โทร: <span className="text-[#042C53] font-bold">📞 {item.phone_number}</span>
                                  </>
                                )}
                              </p>
                            </div>
                            <div className="bg-[#1F2937] text-white font-bold px-3 py-1.5 rounded-lg text-sm shrink-0"
                              style={{ boxShadow: '0 2px 6px rgba(31,41,55,0.15)' }}>
                              x {item.quantity}
                            </div>
                          </div>
                          
                          <div className="mt-auto pt-3.5 border-t border-[#F3F4F6] flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] text-[#9CA3AF]">
                              รับมาเมื่อ: <span className="text-[#6B7280] font-medium">{new Date(item.dispatched_at).toLocaleDateString('th-TH')}</span>
                            </p>
                            
                            <div className="flex items-center gap-1.5">
                              {/* Admin Action Buttons */}
                              {isAdmin && (
                                <>
                                  <button onClick={() => handleEditQuantity(item)}
                                    className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-all duration-150 active:scale-90 border border-transparent hover:border-amber-200" title="แก้ไขจำนวน">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                  </button>
                                  <button onClick={() => handleDeleteItem(item)}
                                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all duration-150 active:scale-90 border border-transparent hover:border-red-200" title="นำออก/ลบ">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </>
                              )}
                              {/* Transfer Button */}
                              <button 
                                onClick={() => handleTransfer(item)}
                                className="font-bold px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95 text-sm flex items-center gap-1.5 text-[#374151] border border-[#A3E635]/30 hover:border-[#A3E635]"
                                style={{ background: 'rgba(163,230,53,0.12)' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(163,230,53,0.22)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(163,230,53,0.12)'; }}
                              >
                                <svg className="w-4 h-4 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                                ให้ยืม
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // ── HISTORY TAB ──
                  <div className="space-y-4">
                    {historyItems.length === 0 ? (
                      <div className="bg-white p-10 rounded-xl border border-[#E5E7EB] text-center text-[#9CA3AF] font-medium"
                        style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                        ไม่พบประวัติการทำรายการ
                      </div>
                    ) : (
                      <>
                        {/* Desktop View */}
                        <div className="hidden md:block bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                          style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                          <table className="w-full text-left text-sm">
                            <thead className="bg-[#F9FAFB] text-[11px] text-[#9CA3AF] font-bold uppercase tracking-wider border-b border-[#E5E7EB]">
                              <tr>
                                <th className="px-5 py-3.5">ประเภท</th>
                                <th className="px-5 py-3.5">สินค้า</th>
                                <th className="px-5 py-3.5 text-center">จำนวน</th>
                                <th className="px-5 py-3.5">ผู้โอน</th>
                                <th className="px-5 py-3.5">ผู้รับ</th>
                                <th className="px-5 py-3.5">วันเวลา</th>
                                {isAdmin && <th className="px-5 py-3.5 text-right">จัดการ</th>}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F3F4F6]">
                              {historyItems.map((log) => (
                                <tr key={log.id} className="hover:bg-[#F9FAFB] transition-colors duration-150">
                                  <td className="px-5 py-3.5 whitespace-nowrap">
                                    {log.action === 'dispatch' && <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md font-bold text-xs border border-emerald-200">รับเข้า</span>}
                                    {log.action === 'transfer' && <span className="text-violet-700 bg-violet-50 px-2.5 py-1 rounded-md font-bold text-xs border border-violet-200">ยืม/โอน</span>}
                                    {log.action === 'used' && <span className="text-red-600 bg-red-50 px-2.5 py-1 rounded-md font-bold text-xs border border-red-200">นำออก</span>}
                                  </td>
                                  <td className="px-5 py-3.5">
                                    <div className="font-bold text-[#1F2937]">{log.product_name}</div>
                                    <div className="text-[11px] text-[#9CA3AF]">SN: {log.sn}</div>
                                  </td>
                                  <td className="px-5 py-3.5 font-bold text-[#1F2937] text-center">{log.quantity}</td>
                                  <td className="px-5 py-3.5 text-xs text-[#6B7280]">{log.from_user_name || '-'}</td>
                                  <td className="px-5 py-3.5 text-xs text-[#6B7280]">{log.to_user_name || '-'}</td>
                                  <td className="px-5 py-3.5 whitespace-nowrap text-xs text-[#9CA3AF]">
                                    {new Date(log.created_at).toLocaleString('th-TH')}
                                  </td>
                                  {isAdmin && (
                                    <td className="px-5 py-3.5 text-right">
                                      <button onClick={() => handleDeleteLog(log.id)}
                                        className="text-red-400 hover:bg-red-50 p-2 rounded-lg transition-all duration-150 active:scale-90 border border-transparent hover:border-red-200" title="ลบประวัติ">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile View */}
                        <div className="md:hidden space-y-3">
                          {historyItems.map((log, idx) => (
                            <div key={log.id}
                              className="bg-white p-4 rounded-xl border border-[#E5E7EB] relative hover:border-[#A3E635]/20 transition-all duration-200"
                              style={{
                                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                                animation: `fadeInUp 0.3s ease-out ${idx * 50}ms both`,
                              }}>
                              <div className="flex justify-between items-start mb-2.5">
                                <div className="flex items-center gap-2">
                                  {log.action === 'dispatch' && <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-emerald-100">รับเข้า</span>}
                                  {log.action === 'transfer' && <span className="text-violet-700 bg-violet-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-violet-100">ยืม/โอน</span>}
                                  {log.action === 'used' && <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-red-100">นำออก</span>}
                                  <span className="text-[10px] text-[#9CA3AF]">{new Date(log.created_at).toLocaleString('th-TH')}</span>
                                </div>
                                {isAdmin && (
                                  <button onClick={() => handleDeleteLog(log.id)}
                                    className="text-red-400 hover:text-red-600 p-1.5 rounded-lg bg-[#F9FAFB] hover:bg-red-50 transition-all duration-150 active:scale-90 border border-[#E5E7EB]" title="ลบประวัติ">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                )}
                              </div>
                              
                              <div className="mb-3">
                                <p className="font-bold text-[#1F2937] leading-tight">{log.product_name}</p>
                                <p className="text-xs text-[#9CA3AF] mt-0.5 break-all">SN: {log.sn}</p>
                              </div>

                              <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F9FAFB] rounded-lg p-3 border border-[#E5E7EB]">
                                <div className="text-xs">
                                  <p className="text-[#9CA3AF] mb-0.5">ผู้โอน <span className="text-[#374151] font-medium ml-1">{log.from_user_name || '-'}</span></p>
                                  <p className="text-[#9CA3AF]">ผู้รับ <span className="text-[#374151] font-medium ml-1">{log.to_user_name || '-'}</span></p>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-[#9CA3AF] block mb-0.5">จำนวน</span>
                                  <span className="font-bold text-[#1F2937] bg-white px-2 py-0.5 rounded border border-[#E5E7EB] text-sm">{log.quantity}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Smooth entry animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
// ── Helper Components ──────────────────────────────────────
const ROLE_CONFIG = {
  super_admin: { label: 'Super Admin', color: 'bg-[#1F2937] text-[#A3E635] border-[#1F2937] shadow-sm' },
  admin: { label: 'Admin', color: 'bg-rose-500 text-white border-rose-600 shadow-sm' },
  technician: { label: 'ช่าง', color: 'bg-[#A3E635] text-[#1F2937] border-[#84cc16] shadow-sm' },
  office_technician: { label: 'ช่าง Office', color: 'bg-[#A3E635] text-[#1F2937] border-[#84cc16] shadow-sm' },
  ma_technician: { label: 'ช่าง MA', color: 'bg-amber-500 text-white border-amber-600 shadow-sm' },
  sales: { label: 'เซล', color: 'bg-blue-500 text-white border-blue-600 shadow-sm' },
  default: { label: 'พนักงาน', color: 'bg-[#F3F4F6] text-[#4B5563] border-[#D1D5DB]' }
};

function getRoleBadge(roleKey) {
  const cfg = ROLE_CONFIG[roleKey] || { ...ROLE_CONFIG.default, label: roleKey || 'พนักงาน' };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shrink-0 ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function CustomUserSelect({ value, onChange, users }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedUser = users.find(u => u.id == value) || users[0];

  return (
    <div className="relative w-full sm:w-64" ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-white border text-left text-sm rounded-xl px-4 py-2.5 transition-all outline-none group ${
          isOpen ? 'border-[#A3E635] ring-4 ring-[#A3E635]/20' : 'border-[#E5E7EB] hover:border-[#A3E635]/50 hover:shadow-md'
        }`}
        style={{ boxShadow: isOpen ? '0 4px 12px rgba(163,230,53,0.15)' : '0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div className="flex flex-col items-start min-w-0 pr-3 w-full">
          {selectedUser ? (
            <>
              <div className="flex items-center gap-2 w-full">
                <span className="truncate font-bold text-[#1F2937] leading-tight group-hover:text-[#65a30d] transition-colors">{selectedUser.full_name}</span>
                {getRoleBadge(selectedUser.role)}
              </div>
              {selectedUser.team_name && <span className="text-[10px] text-[#9CA3AF] font-bold tracking-wider uppercase mt-0.5">{selectedUser.team_name}</span>}
            </>
          ) : (
            <span className="text-[#9CA3AF] font-bold">กำลังโหลด...</span>
          )}
        </div>
        <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors ${isOpen ? 'bg-[#A3E635]/20 text-[#65a30d]' : 'bg-[#F3F4F6] text-[#9CA3AF] group-hover:bg-[#A3E635]/10 group-hover:text-[#65a30d]'}`}>
          <svg className={`w-4 h-4 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      <div 
        className={`absolute top-[calc(100%+8px)] left-0 right-0 sm:right-auto sm:w-72 bg-white rounded-xl border border-[#E5E7EB] overflow-hidden transition-all duration-300 origin-top z-[60] ${
          isOpen ? 'opacity-100 scale-100 visible translate-y-0' : 'opacity-0 scale-95 invisible -translate-y-2'
        }`}
        style={{ boxShadow: '0 12px 30px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)' }}
      >
        <div className="max-h-[50vh] sm:max-h-64 overflow-y-auto p-1.5 space-y-0.5" style={{ scrollbarWidth: 'thin' }}>
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => { onChange(u.id); setIsOpen(false); }}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center justify-between group ${
                value == u.id 
                  ? 'bg-[#A3E635]/15 border border-[#A3E635]/30 shadow-sm' 
                  : 'hover:bg-[#F9FAFB] border border-transparent'
              }`}
            >
              <div className="flex flex-col min-w-0 pr-3 w-full">
                <div className="flex items-center gap-2 w-full">
                  <span className={`truncate leading-tight font-bold ${value == u.id ? 'text-[#1F2937]' : 'text-[#374151] group-hover:text-[#1F2937]'}`}>{u.full_name}</span>
                  {getRoleBadge(u.role)}
                </div>
                {u.team_name && <span className={`text-[10px] uppercase font-bold tracking-wider mt-0.5 ${value == u.id ? 'text-[#65a30d]' : 'text-[#9CA3AF] group-hover:text-[#6B7280]'}`}>{u.team_name}</span>}
              </div>
              {value == u.id && (
                <div className="w-5 h-5 rounded-full bg-[#A3E635] flex items-center justify-center shrink-0 shadow-sm shadow-lime-500/30">
                  <svg className="w-3.5 h-3.5 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
