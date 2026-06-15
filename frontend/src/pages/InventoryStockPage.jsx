import { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';

export default function InventoryStockPage() {
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchStock();
  }, []);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inventory/stock');
      setStock(res.data);
    } catch (err) {
      console.error('Failed to load stock overview', err);
    } finally {
      setLoading(false);
    }
  };

  const groupedStock = Object.values(stock.reduce((acc, item) => {
    if (!acc[item.product_id]) {
      acc[item.product_id] = {
        product_id: item.product_id,
        product_name: item.product_name,
        has_sn: item.has_sn,
        total_quantity: 0,
        item_count: 0,
        models: []
      };
    }
    acc[item.product_id].total_quantity += parseFloat(item.total_quantity || 0);
    acc[item.product_id].item_count += parseInt(item.item_count || 0);
    acc[item.product_id].models.push({
      model_id: item.model_id,
      model_name: item.model_name,
      total_quantity: item.total_quantity,
      item_count: item.item_count
    });
    return acc;
  }, {}));

  const filteredStock = groupedStock.filter(p => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const matchProduct = p.product_name && p.product_name.toLowerCase().includes(query);
    const matchModel = p.models.some(m => m.model_name && m.model_name.toLowerCase().includes(query));
    return matchProduct || matchModel;
  });

  const showSnList = async (product, model) => {
    try {
      Swal.fire({ title: 'กำลังดึงข้อมูล...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const res = await axios.get(`/inventory/stock/${model.model_id}`);
      const snItems = res.data;
      
      const snHtml = snItems.map(si => `
        <div style="background: #F9FAFB; border: 1px solid #E5E7EB; padding: 12px 16px; margin-bottom: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 14px; color: #1F2937; transition: all 0.2s;" onmouseover="this.style.borderColor='#A3E635'" onmouseout="this.style.borderColor='#E5E7EB'">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-weight: 900; font-size: 15px;">
              ${product.has_sn ? si.sn : `รหัส: ${si.sn}`}
              ${!product.has_sn ? `<span style="color:#1F2937; background:#A3E635; padding:2px 8px; border-radius:6px; font-size:12px; font-weight: bold; margin-left:8px; box-shadow: 0 2px 5px rgba(163,230,53,0.3);">จำนวน ${parseFloat(si.quantity).toLocaleString()}</span>` : ''}
            </span>
            <span style="color: #6B7280; font-size: 13px; font-weight: 500;">นำเข้าเมื่อ: ${new Date(si.created_at).toLocaleDateString('th-TH')}</span>
          </div>
          <button type="button" class="del-sn-btn" data-id="${si.id}" data-sn="${si.sn}" style="background: #FEF2F2; color: #EF4444; border: 1px solid #FEE2E2; padding: 8px 12px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: bold; transition: all 0.2s;" onmouseover="this.style.background='#FEE2E2'" onmouseout="this.style.background='#FEF2F2'">
            ลบรายการ
          </button>
        </div>
      `).join('');

      Swal.fire({
        title: product.has_sn ? 'รายการ Serial Number' : 'ประวัติการนำเข้า (ล็อต)',
        html: `
          <div style="text-align: left; padding: 5px;">
            <p style="margin-bottom: 4px; font-weight: 900; font-size: 1.15rem; color: #1F2937;">${product.product_name}</p>
            <p style="margin-bottom: 20px; color: #6B7280; font-size: 0.95rem; font-weight: bold; display: inline-block; background: #F3F4F6; padding: 4px 10px; border-radius: 8px; border: 1px solid #E5E7EB;">โมเดล: ${model.model_name}</p>
            <div style="max-height: 380px; overflow-y: auto; text-align: left; padding-right: 5px;">
              ${snItems.length > 0 ? snHtml : '<div style="text-align:center; padding: 30px; color:#9CA3AF; font-weight: bold; background: #F9FAFB; border-radius: 12px; border: 1px dashed #E5E7EB;">ไม่มีข้อมูลในสต๊อก</div>'}
            </div>
          </div>
        `,
        confirmButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#1F2937',
        width: '480px',
        customClass: { popup: 'rounded-3xl' },
        didOpen: () => {
          const popup = Swal.getPopup();
          const btns = popup.querySelectorAll('.del-sn-btn');
          btns.forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              const sn = btn.getAttribute('data-sn');
              const confirmDel = await Swal.fire({
                title: 'ยืนยันการลบ',
                html: `ต้องการลบ <b>${sn}</b> ออกจากระบบใช่หรือไม่?<br><small style="color:#ef4444; font-weight:bold;">การกระทำนี้ไม่สามารถย้อนกลับได้</small>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ใช่, ลบเลย',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#ef4444',
                cancelButtonColor: '#9CA3AF'
              });
              
              if (confirmDel.isConfirmed) {
                try {
                  await axios.delete(`/inventory/items/${id}`);
                  await Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1000, showConfirmButton: false });
                  fetchStock();
                  showSnList(product, model); // Refresh modal
                } catch (err) {
                  await Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถลบข้อมูลได้' });
                  showSnList(product, model); // Go back to modal
                }
              } else {
                showSnList(product, model); // Reopen list
              }
            });
          });
        }
      });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถดึงข้อมูล SN ได้' });
    }
  };

  const handleDeleteProduct = async (productId, productName) => {
    const confirmDel = await Swal.fire({
      title: 'ยืนยันการลบทั้งสินค้า',
      html: `คุณกำลังจะลบ <b>${productName}</b><br/><br/><small style="color:#ef4444; font-weight:bold;">คำเตือน: การกระทำนี้จะลบโมเดลและสต๊อกของสินค้านี้ออกทั้งหมดอย่างถาวร!</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบข้อมูลทั้งหมด',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9CA3AF'
    });
    
    if (confirmDel.isConfirmed) {
      setLoading(true);
      try {
        await axios.delete(`/inventory/products/${productId}`);
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', timer: 1500, showConfirmButton: false });
        fetchStock();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถลบข้อมูลได้' });
        setLoading(false);
      }
    }
  };

  const handleViewDetails = async (product) => {
    if (product.models.length > 1) {
      const cardsHtml = product.models.map(m => `
        <button 
          type="button" 
          class="swal2-confirm swal2-styled select-model-card" 
          data-model-id="${m.model_id}"
          data-model-name="${m.model_name}"
          style="width: 100%; text-align: left; background-color: #F9FAFB; color: #1F2937; border: 1px solid #E5E7EB; margin: 8px 0; padding: 16px 20px; border-radius: 16px; font-weight: 900; font-size: 1rem; transition: all 0.2s;"
          onmouseover="this.style.borderColor='#A3E635'; this.style.backgroundColor='#ffffff'; this.style.boxShadow='0 4px 12px rgba(163,230,53,0.15)';"
          onmouseout="this.style.borderColor='#E5E7EB'; this.style.backgroundColor='#F9FAFB'; this.style.boxShadow='none';"
        >
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <span>📦 ${m.model_name}</span>
             <span style="font-size:0.85rem; background:#A3E635; color:#1F2937; padding:4px 10px; border-radius:8px; font-weight: bold; box-shadow: 0 2px 5px rgba(163,230,53,0.3);">${m.item_count} รายการ</span>
          </div>
        </button>
      `).join('');

      await Swal.fire({
        title: `เลือกโมเดลของ ${product.product_name}`,
        html: `<div style="max-height: 380px; overflow-y: auto; padding: 5px;">${cardsHtml}</div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'ปิดหน้าต่าง',
        cancelButtonColor: '#9CA3AF',
        customClass: { popup: 'rounded-3xl' },
        didOpen: () => {
          const popup = Swal.getPopup();
          const btns = popup.querySelectorAll('.select-model-card');
          btns.forEach(btn => {
            btn.addEventListener('click', () => {
              const modelId = btn.getAttribute('data-model-id');
              const modelName = btn.getAttribute('data-model-name');
              Swal.close();
              showSnList(product, { model_id: modelId, model_name: modelName });
            });
          });
        }
      });
    } else {
      showSnList(product, product.models[0]);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-[#E5E7EB] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#F9FAFB]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-[#1F2937]">ภาพรวมคลังสินค้า</h2>
            <p className="text-xs font-medium text-[#6B7280]">จำนวนสินค้าและโมเดลทั้งหมดที่มีในระบบ</p>
          </div>
        </div>
        
        <div className="flex gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <input 
              type="text"
              placeholder="ค้นหาสินค้า หรือ โมเดล..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-[#E5E7EB] rounded-xl focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 outline-none text-[#1F2937] text-sm font-bold bg-white transition-all shadow-sm"
            />
            <svg className="w-5 h-5 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          
          <button type="button" onClick={(e) => { e.preventDefault(); fetchStock(); }} className="flex items-center justify-center w-11 h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#1F2937] transition-all shrink-0 bg-white shadow-sm active:scale-95" title="อัปเดตข้อมูล">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <svg className="animate-spin h-10 w-10 text-[#A3E635]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span className="text-sm font-bold text-[#9CA3AF]">กำลังโหลดข้อมูล...</span>
        </div>
      ) : stock.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#9CA3AF]">
          <div className="w-20 h-20 bg-[#F3F4F6] rounded-full flex items-center justify-center mb-4">
            <svg className="w-10 h-10 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className="text-lg font-black text-[#6B7280]">ไม่มีสินค้าในคลัง</p>
          <p className="text-sm font-medium mt-1">เริ่มเพิ่มสินค้าจากการรับเข้า (Receive)</p>
        </div>
      ) : filteredStock.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#9CA3AF]">
          <svg className="w-16 h-16 mb-4 text-[#E5E7EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg font-black text-[#6B7280]">ไม่พบสินค้าที่ค้นหา</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#F9FAFB] text-[#6B7280]">
              <tr>
                <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">สินค้า (Product)</th>
                <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">โมเดล (Model)</th>
                <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">ประเภทการเก็บ</th>
                <th className="p-5 font-black uppercase tracking-wider text-right border-b border-[#E5E7EB]">จำนวนคงเหลือ</th>
                <th className="p-5 font-black uppercase tracking-wider text-center border-b border-[#E5E7EB]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {filteredStock.map((item, index) => (
                <tr 
                  key={`product-${item.product_id}`} 
                  className="hover:bg-[#F9FAFB] transition-colors group"
                >
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0 group-hover:border-[#A3E635] group-hover:shadow-sm transition-all">
                        <span className="text-lg">📦</span>
                      </div>
                      <div>
                        <p className="font-black text-[#1F2937] text-base">{item.product_name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-5">
                    {item.models.length > 1 ? (
                      <span className="bg-[#F3F4F6] text-[#4B5563] px-3 py-1.5 rounded-lg text-xs font-bold border border-[#E5E7EB]">
                        หลายโมเดล <span className="bg-white px-1.5 py-0.5 rounded text-[#1F2937] ml-1">{item.models.length}</span>
                      </span>
                    ) : (
                      <span className="font-bold text-[#4B5563] bg-white px-3 py-1.5 rounded-lg border border-[#E5E7EB]">
                        {item.models[0].model_name}
                      </span>
                    )}
                  </td>
                  <td className="p-5">
                    <span className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${item.has_sn ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {item.has_sn ? '🔑 มี Serial Number' : '📏 นับตามจำนวน/ความยาว'}
                    </span>
                  </td>
                  <td className="p-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!item.has_sn ? (
                        <>
                          <span className="text-lg font-black text-[#1F2937]">
                            {parseFloat(item.total_quantity).toLocaleString()}
                          </span>
                          <span className="text-xs font-bold text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded-md">หน่วย</span>
                        </>
                      ) : (
                        <span className="text-sm font-black text-[#1F2937] bg-[#A3E635] px-3 py-1.5 rounded-xl shadow-[0_2px_8px_rgba(163,230,53,0.3)]">
                          {item.item_count.toLocaleString()} รายการ
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => handleViewDetails(item)}
                        className="text-[#1F2937] bg-white border-2 border-[#E5E7EB] hover:bg-[#F9FAFB] hover:border-[#D1D5DB] font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                      >
                        ดูรายการ / ลบ
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteProduct(item.product_id, item.product_name)}
                        className="w-10 h-10 rounded-xl bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center transition-colors shadow-sm border border-red-100 active:scale-95"
                        title="ลบสินค้าและโมเดลทั้งหมด"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
