import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';

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
    <div className="flex h-dvh bg-slate-50 font-sans overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} activeKey="bag" />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="flex items-center justify-between p-4 bg-white border-b border-slate-200 shrink-0 shadow-sm z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-bold text-slate-800 text-xl flex items-center gap-2 tracking-tight">
              <span className="text-2xl">🎒</span>
              กระเป๋าช่าง
            </h1>
          </div>
          
          {/* Admin User Selector */}
          {isAdmin && (
            <div className="hidden sm:block">
              <select 
                className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl focus:ring-brand-500 focus:border-brand-500 block p-2.5 font-bold shadow-sm"
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
              >
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} {u.team_name ? `(${u.team_name})` : ''}</option>
                ))}
              </select>
            </div>
          )}
        </header>

        {/* Mobile Admin User Selector */}
        {isAdmin && (
          <div className="sm:hidden p-4 bg-white border-b border-slate-200">
            <label className="block text-xs font-bold text-slate-500 mb-1">เลือกช่างเพื่อดูข้อมูล:</label>
            <select 
              className="bg-slate-50 border border-slate-300 text-slate-800 text-sm rounded-xl focus:ring-brand-500 focus:border-brand-500 block w-full p-2.5 font-bold shadow-sm"
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
            >
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name} {u.team_name ? `(${u.team_name})` : ''}</option>
              ))}
            </select>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-[#F8FAFC]">
          <div className="max-w-5xl mx-auto space-y-6">
            
            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-200">
              <button 
                type="button"
                onClick={() => setActiveTab('bag')}
                className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 relative ${activeTab === 'bag' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                สินค้าในกระเป๋า
                <span className="ml-2 bg-slate-100 text-slate-600 py-0.5 px-2 rounded-full text-xs">{bagItems.length}</span>
              </button>
              <button 
                type="button"
                onClick={() => setActiveTab('history')}
                className={`pb-3 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'history' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                ประวัติการรับ/โอน
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-20 flex-col gap-4 text-slate-400 animate-fadeIn">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-brand-500"></div>
                กำลังโหลดข้อมูล...
              </div>
            ) : (
              <div key={activeTab} className="animate-fadeIn">
                {activeTab === 'bag' ? (
                  // --- BAG TAB ---
                  bagItems.length === 0 ? (
                    <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center shadow-sm flex flex-col items-center justify-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <span className="text-4xl">📭</span>
                  </div>
                  <p className="text-xl font-bold text-slate-800">ไม่มีสินค้าในกระเป๋า</p>
                  <p className="text-slate-500 mt-2">เมื่อคุณได้รับการเบิกจ่าย สินค้าจะมาปรากฏที่นี่</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {bagItems.map((item, index) => (
                  <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all animate-[scaleIn_0.2s_ease-out] flex flex-col" style={{animationDelay: `${index * 50}ms`}}>
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md uppercase tracking-wider mb-2">{item.product_name}</span>
                        <h3 className="font-bold text-slate-800 text-lg leading-tight break-all">{item.sn}</h3>
                        <p className="text-xs text-slate-500 mt-1">โมเดล: {item.model_name}</p>
                      </div>
                      <div className="bg-slate-50 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-sm shrink-0 border border-slate-200 shadow-inner">
                        x {item.quantity}
                      </div>
                    </div>
                    
                    <div className="mt-auto pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] text-slate-400">
                        รับมาเมื่อ: {new Date(item.dispatched_at).toLocaleDateString('th-TH')}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        {/* Admin Action Buttons */}
                        {isAdmin && (
                          <>
                            <button onClick={() => handleEditQuantity(item)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-all active:scale-90 border border-transparent hover:border-amber-200" title="แก้ไขจำนวน">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteItem(item)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all active:scale-90 border border-transparent hover:border-rose-200" title="นำออก/ลบ">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </>
                        )}
                        {/* Transfer Button */}
                        <button 
                          onClick={() => handleTransfer(item)}
                          className="bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold px-3 py-1.5 rounded-lg transition-all active:scale-95 text-sm border border-brand-200 flex items-center gap-1.5 shadow-sm"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                          ให้ยืม
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )
            ) : (
              // --- HISTORY TAB ---
              <div className="space-y-4">
                {historyItems.length === 0 ? (
                  <div className="bg-white p-10 rounded-3xl border border-slate-200 text-center text-slate-500">
                    ไม่พบประวัติการทำรายการ
                  </div>
                ) : (
                  <>
                    {/* Desktop View */}
                    <div className="hidden md:block bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                      <table className="w-full text-left text-sm text-slate-600">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase border-b border-slate-200">
                          <tr>
                            <th className="px-5 py-4">ประเภท</th>
                            <th className="px-5 py-4">สินค้า</th>
                            <th className="px-5 py-4 text-center">จำนวน</th>
                            <th className="px-5 py-4">ผู้โอน</th>
                            <th className="px-5 py-4">ผู้รับ</th>
                            <th className="px-5 py-4">วันเวลา</th>
                            {isAdmin && <th className="px-5 py-4 text-right">จัดการ</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {historyItems.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 whitespace-nowrap">
                                {log.action === 'dispatch' && <span className="text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-md font-bold text-xs border border-emerald-200">รับเข้า</span>}
                                {log.action === 'transfer' && <span className="text-purple-700 bg-purple-100 px-2.5 py-1 rounded-md font-bold text-xs border border-purple-200">ยืม/โอน</span>}
                                {log.action === 'used' && <span className="text-rose-700 bg-rose-100 px-2.5 py-1 rounded-md font-bold text-xs border border-rose-200">นำออก</span>}
                              </td>
                              <td className="px-5 py-3">
                                <div className="font-bold text-slate-800">{log.product_name}</div>
                                <div className="text-[11px] text-slate-500">SN: {log.sn}</div>
                              </td>
                              <td className="px-5 py-3 font-bold text-slate-800 text-center">{log.quantity}</td>
                              <td className="px-5 py-3 text-xs text-slate-600">{log.from_user_name || '-'}</td>
                              <td className="px-5 py-3 text-xs text-slate-600">{log.to_user_name || '-'}</td>
                              <td className="px-5 py-3 whitespace-nowrap text-xs text-slate-500">
                                {new Date(log.created_at).toLocaleString('th-TH')}
                              </td>
                              {isAdmin && (
                                <td className="px-5 py-3 text-right">
                                  <button onClick={() => handleDeleteLog(log.id)} className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-all active:scale-90" title="ลบประวัติ">
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
                      {historyItems.map(log => (
                        <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              {log.action === 'dispatch' && <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">รับเข้า</span>}
                              {log.action === 'transfer' && <span className="text-purple-700 bg-purple-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">ยืม/โอน</span>}
                              {log.action === 'used' && <span className="text-rose-700 bg-rose-100 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">นำออก</span>}
                              <span className="text-[10px] text-slate-400">{new Date(log.created_at).toLocaleString('th-TH')}</span>
                            </div>
                            {isAdmin && (
                              <button onClick={() => handleDeleteLog(log.id)} className="text-rose-400 hover:text-rose-600 p-1 rounded-md bg-slate-50 transition-all active:scale-90" title="ลบประวัติ">
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            )}
                          </div>
                          
                          <div className="mb-3">
                            <p className="font-bold text-slate-800 leading-tight">{log.product_name}</p>
                            <p className="text-xs text-slate-500 mt-0.5 break-all">SN: {log.sn}</p>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <div className="text-xs">
                              <p className="text-slate-400 mb-0.5">ผู้โอน <span className="text-slate-700 font-medium ml-1">{log.from_user_name || '-'}</span></p>
                              <p className="text-slate-400">ผู้รับ <span className="text-slate-700 font-medium ml-1">{log.to_user_name || '-'}</span></p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-slate-400 block mb-0.5">จำนวน</span>
                              <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">{log.quantity}</span>
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
</div>
  );
}
