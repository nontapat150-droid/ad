import { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';

export default function InventoryDispatchPage() {
  const [loading, setLoading] = useState(false);
  
  // Staging state
  const [stagedItems, setStagedItems] = useState([]); // items to be dispatched
  const [snInput, setSnInput] = useState('');
  
  // Technician Selection
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  
  const snInputRef = useRef(null);

  useEffect(() => {
    fetchUsers();
    // Focus SN input on load
    setTimeout(() => snInputRef.current?.focus(), 100);
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await axios.get('/users');
      // Filter for active technicians if needed, or show all
      setUsers(res.data.filter(u => u.status === 'approved'));
    } catch (err) {
      console.error('Failed to load users', err);
    }
  };

  const handleSearchSn = async (e) => {
    if (e) e.preventDefault();
    if (!snInput.trim()) return;

    // Check if already in staging
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

    // Show confirmation "Receipt"
    const result = await Swal.fire({
      title: 'ยืนยันการเบิกสินค้า?',
      html: `
        <div class="text-left font-sans space-y-2 mb-4  p-4 rounded-xl border border-white/50 text-sm">
          <p><strong class="text-[#185FA5]">ผู้เบิกรับ:</strong> ${selectedUser.full_name} <br/><span class="text-xs text-[#378ADD]">(${selectedUser.team_name || 'ไม่มีทีม'})</span></p>
          <p><strong class="text-[#185FA5]">จำนวนรวม:</strong> ${stagedItems.length} รายการ</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#94a3b8',
      confirmButtonText: 'ยืนยันการเบิก (Dispatch)',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const payload = {
        target_user_id: selectedUser.id,
        items: stagedItems.map(item => ({ id: item.id }))
      };

      const res = await axios.post('/inventory/dispatch', payload);
      
      Swal.fire({
        icon: 'success',
        title: 'เบิกสินค้าเรียบร้อย!',
        text: res.data.message,
        confirmButtonColor: '#10b981',
        customClass: { popup: 'rounded-2xl' }
      });
      
      // Clear staging
      setStagedItems([]);
      setSelectedUserId('');
      setTimeout(() => snInputRef.current?.focus(), 100);
      
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ล้มเหลว', text: err.response?.data?.error || 'เกิดข้อผิดพลาดในการเบิกสินค้า' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in-up">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: Scanner */}
            <div className="lg:col-span-1 space-y-6">
              <div className="glass p-6 rounded-2xl shadow-sm border border-white/50">
                <h2 className="text-lg font-bold text-[#042C53] mb-4 border-b pb-2">สแกน / ค้นหาสินค้า</h2>
                <form onSubmit={handleSearchSn} className="flex flex-col gap-4">
                  <div className="relative">
                    <input 
                      ref={snInputRef}
                      type="text" 
                      value={snInput}
                      onChange={(e) => {
                        setSnInput(e.target.value);
                        if (e.target.value.length >= 12) {
                          setTimeout(() => { if(snInputRef.current?.value.length >= 12) handleSearchSn(); }, 300);
                        }
                      }}
                      placeholder="สแกนบาร์โค้ด SN..."
                      className="w-full px-4 py-4  border border-[#185FA5]/20 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-brand-800 font-bold tracking-wide shadow-inner"
                      autoFocus
                    />
                    <div className="absolute right-4 top-4 text-[#378ADD] opacity-80">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    disabled={loading || !snInput}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-3 rounded-xl transition-colors disabled:opacity-50"
                  >
                    นำมาพักรอเบิก
                  </button>
                </form>
              </div>

              {/* Technician Selector */}
              <div className="glass p-6 rounded-2xl shadow-sm border border-white/50">
                <h2 className="text-lg font-bold text-[#042C53] mb-4 border-b pb-2">เลือกผู้รับของ (ช่าง)</h2>
                <select 
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-4 py-3  border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-[#042C53] font-medium"
                >
                  <option value="">-- เลือกชื่อช่าง --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} {u.team_name ? `(${u.team_name})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Column: Staging Area */}
            <div className="lg:col-span-2 glass rounded-2xl shadow-sm border border-white/50 flex flex-col h-[calc(100vh-120px)]">
              <div className="p-6 border-b border-white/50  rounded-t-2xl flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-[#042C53]">รายการรอเบิก (Staging)</h2>
                  <p className="text-sm text-[#378ADD]">จำนวนทั้งหมด {stagedItems.length} รายการ</p>
                </div>
                <button 
                  onClick={handleDispatch}
                  disabled={loading || stagedItems.length === 0 || !selectedUserId}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-6 py-3 rounded-xl disabled:opacity-50 shadow-md shadow-[#185FA5]/20 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ยืนยันเบิกสินค้า
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {stagedItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-[#378ADD] opacity-80">
                    <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="font-medium text-lg">ยังไม่มีสินค้าในตะกร้ารอเบิก</p>
                    <p className="text-sm">กรุณาสแกนหรือพิมพ์รหัส SN ด้านซ้ายมือ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stagedItems.map((item, index) => (
                      <div key={`stage-${index}`} className="flex items-center justify-between p-4 glass border border-white/50 rounded-xl hover:border-brand-300 transition-colors shadow-sm group animate-fade-in-up" style={{animationDelay: `${index * 50}ms`}}>
                        <div>
                          <p className="font-bold text-[#042C53] text-lg">{item.sn}</p>
                          <p className="text-sm text-[#378ADD]">{item.product_name} - {item.model_name}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="glass text-[#185FA5] px-3 py-1 rounded-lg text-sm font-bold">
                            จำนวน: {parseFloat(item.quantity).toLocaleString('th-TH', { maximumFractionDigits: 0 })}
                          </span>
                          <button 
                            onClick={() => handleRemoveFromStaging(index)}
                            className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
                            title="เอาออก"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

      </div>
    </div>
  );
}
