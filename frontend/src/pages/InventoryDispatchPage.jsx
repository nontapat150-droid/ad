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
        <div class="text-left font-sans space-y-2 mb-4 p-5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] text-sm">
          <p><strong class="text-[#1F2937] text-base">ผู้เบิกรับ:</strong> <span class="font-bold">${selectedUser.full_name}</span> <br/><span class="text-xs font-bold text-[#6B7280] bg-white px-2 py-1 rounded-md border border-[#E5E7EB] inline-block mt-1">ทีม: ${selectedUser.team_name || 'ไม่มีทีม'}</span></p>
          <div class="h-px bg-[#E5E7EB] my-2"></div>
          <p><strong class="text-[#1F2937] text-base">จำนวนรวม:</strong> <span class="font-black text-[#A3E635] text-lg bg-white px-3 py-1 rounded-xl shadow-sm border border-[#E5E7EB]">${stagedItems.length} รายการ</span></p>
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
      const payload = {
        target_user_id: selectedUser.id,
        items: stagedItems.map(item => ({ id: item.id }))
      };

      const res = await axios.post('/inventory/dispatch', payload);
      
      Swal.fire({
        icon: 'success',
        title: 'เบิกสินค้าเรียบร้อย!',
        text: res.data.message,
        confirmButtonColor: '#1F2937',
        customClass: { popup: 'rounded-3xl' }
      });
      
      // Clear staging
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
            
            {/* Left Column: Scanner */}
            <div className="lg:col-span-1 space-y-6">
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
                          setTimeout(() => { if(snInputRef.current?.value.length >= 12) handleSearchSn(); }, 300);
                        }
                      }}
                      placeholder="สแกนบาร์โค้ด SN..."
                      className="w-full px-5 py-4 bg-[#F9FAFB] border-2 border-[#E5E7EB] rounded-2xl focus:border-[#A3E635] focus:ring-4 focus:ring-[#A3E635]/20 outline-none text-[#1F2937] font-black tracking-wide transition-all"
                      autoFocus
                    />
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
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

              {/* Technician Selector */}
              <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8">
                <h2 className="text-xl font-black text-[#1F2937] mb-6 border-b border-[#E5E7EB] pb-4">เลือกผู้รับของ (ช่าง)</h2>
                <select 
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-5 py-4 bg-[#F9FAFB] border-2 border-[#E5E7EB] rounded-2xl focus:border-[#A3E635] focus:ring-4 focus:ring-[#A3E635]/20 outline-none text-[#1F2937] font-bold transition-all cursor-pointer appearance-none"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%236B7280\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'/%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.5em 1.5em' }}
                >
                  <option value="">-- เลือกชื่อช่าง --</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.full_name} {u.team_name ? `(${u.team_name})` : ''}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Right Column: Staging Area */}
            <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-[#E5E7EB] flex flex-col h-[calc(100vh-160px)]">
              <div className="p-6 sm:p-8 border-b border-[#E5E7EB] rounded-t-3xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-[#F9FAFB]">
                <div>
                  <h2 className="text-xl font-black text-[#1F2937]">รายการรอเบิก (Staging)</h2>
                  <p className="text-sm font-bold text-[#6B7280] mt-1">จำนวนทั้งหมด {stagedItems.length} รายการ</p>
                </div>
                <button 
                  onClick={handleDispatch}
                  disabled={loading || stagedItems.length === 0 || !selectedUserId}
                  className="bg-[#A3E635] hover:bg-[#84CC16] text-[#1F2937] font-black px-6 py-3.5 rounded-2xl disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-[0_4px_15px_rgba(163,230,53,0.3)] disabled:shadow-none transition-all flex items-center gap-2 active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
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
                      <div key={`stage-${index}`} className="flex items-center justify-between p-5 bg-white border border-[#E5E7EB] rounded-2xl hover:border-[#A3E635] hover:shadow-[0_4px_12px_rgba(163,230,53,0.15)] transition-all group animate-[slideUp_0.3s_ease-out]" style={{animationDelay: `${index * 30}ms`}}>
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
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
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
