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
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; margin-bottom: 8px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; font-family: monospace; font-size: 15px; color: #0f172a;">
          <div style="display:flex; flex-direction:column; gap:4px;">
            <span style="font-weight: bold;">
              ${product.has_sn ? si.sn : `รหัส: ${si.sn}`}
              ${!product.has_sn ? `<span style="color:#166534; background:#dcfce7; padding:2px 6px; border-radius:4px; font-size:12px; margin-left:8px;">จำนวน ${parseFloat(si.quantity).toLocaleString()}</span>` : ''}
            </span>
            <span style="color: #64748b; font-size: 13px;">${new Date(si.created_at).toLocaleDateString('th-TH')}</span>
          </div>
          <button type="button" class="del-sn-btn" data-id="${si.id}" data-sn="${si.sn}" style="background: #fee2e2; color: #ef4444; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; transition: background 0.2s;">ลบข้อมูล</button>
        </div>
      `).join('');

      Swal.fire({
        title: product.has_sn ? 'รายการ SN' : 'รายการนำเข้า',
        html: `
          <p style="margin-bottom: 4px; font-weight: bold; font-size: 1.1rem; color: #042C53;">${product.product_name}</p>
          <p style="margin-bottom: 16px; color: #378ADD; font-size: 0.95rem;">โมเดล: ${model.model_name}</p>
          <div style="max-height: 350px; overflow-y: auto; text-align: left; padding-right: 5px;">
            ${snItems.length > 0 ? snHtml : '<div style="text-align:center; padding: 20px; color:#94a3b8;">ไม่มีข้อมูลในสต๊อก</div>'}
          </div>
        `,
        confirmButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#185FA5',
        width: '450px',
        customClass: { popup: 'rounded-2xl' },
        didOpen: () => {
          const popup = Swal.getPopup();
          const btns = popup.querySelectorAll('.del-sn-btn');
          btns.forEach(btn => {
            btn.addEventListener('click', async () => {
              const id = btn.getAttribute('data-id');
              const sn = btn.getAttribute('data-sn');
              const confirmDel = await Swal.fire({
                title: 'ยืนยันการลบ',
                html: `ต้องการลบ <b>${sn}</b> ออกจากระบบใช่หรือไม่?<br><small style="color:#ef4444;">การกระทำนี้ไม่สามารถย้อนกลับได้</small>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'ลบข้อมูล',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#ef4444'
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
      confirmButtonColor: '#ef4444'
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
          style="width: 100%; text-align: left; background-color: #f8fafc; color: #042C53; border: 1px solid #cbd5e1; margin: 6px 0; padding: 16px; border-radius: 12px; font-weight: bold; font-size: 1rem; transition: all 0.2s;"
          onmouseover="this.style.borderColor='#378ADD'; this.style.backgroundColor='#E6F1FB';"
          onmouseout="this.style.borderColor='#cbd5e1'; this.style.backgroundColor='#f8fafc';"
        >
          <div style="display:flex; justify-content:space-between; align-items:center;">
             <span>📦 ${m.model_name}</span>
             <span style="font-size:0.8rem; background:#dcfce7; color:#166534; padding:4px 8px; border-radius:12px;">${m.item_count} รายการ</span>
          </div>
        </button>
      `).join('');

      await Swal.fire({
        title: `เลือกโมเดลของ ${product.product_name}`,
        html: `<div style="max-height: 350px; overflow-y: auto; padding: 5px;">${cardsHtml}</div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'ปิดหน้าต่าง',
        cancelButtonColor: '#94a3b8',
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
    <div className="animate-fade-in-up">
      <div className="max-w-5xl mx-auto space-y-6">
            
            <div className="glass p-6 rounded-2xl shadow-sm border border-white/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-lg font-bold text-[#042C53]">ภาพรวมคลังสินค้า</h2>
                
                <div className="flex gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <input 
                      type="text"
                      placeholder="ค้นหาสินค้า หรือ โมเดล..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#185FA5] outline-none text-[#042C53] text-sm bg-white"
                    />
                    <svg className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  
                  <button type="button" onClick={(e) => { e.preventDefault(); fetchStock(); }} className="flex items-center justify-center p-2.5 rounded-xl border border-slate-200 text-[#185FA5] hover:bg-[#E6F1FB] transition-colors shrink-0 bg-white shadow-sm" title="อัปเดตข้อมูล">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                </div>
              ) : stock.length === 0 ? (
                <div className="text-center py-20 text-[#378ADD]">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <p className="text-lg font-medium">ไม่มีสินค้าในคลัง</p>
                </div>
              ) : filteredStock.length === 0 ? (
                <div className="text-center py-20 text-[#378ADD]">
                  <p className="text-lg font-medium">ไม่พบสินค้าที่ค้นหา</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-[#E6F1FB] text-[#042C53]">
                      <tr>
                        <th className="p-4 font-semibold text-left border-b border-slate-200">สินค้า (Product)</th>
                        <th className="p-4 font-semibold text-left border-b border-slate-200">โมเดล (Model)</th>
                        <th className="p-4 font-semibold text-left border-b border-slate-200">ประเภทการเก็บ</th>
                        <th className="p-4 font-semibold text-right border-b border-slate-200">จำนวนคงเหลือรวม</th>
                        <th className="p-4 font-semibold text-center border-b border-slate-200">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStock.map((item, index) => (
                        <tr 
                          key={`product-${item.product_id}`} 
                          className="border-b border-slate-100 transition-colors animate-fade-in-up hover:bg-slate-50"
                          style={{animationDelay: `${index * 30}ms`}}
                        >
                          <td className="p-4 font-bold text-left text-[#042C53] text-base">{item.product_name}</td>
                          <td className="p-4 font-medium text-left text-[#378ADD]">
                            {item.models.length > 1 ? (
                              <span className="bg-[#E6F1FB] text-[#185FA5] px-2.5 py-1 rounded-lg text-xs font-bold border border-[#b9d5f0]">
                                หลายโมเดล ({item.models.length})
                              </span>
                            ) : (
                              item.models[0].model_name
                            )}
                          </td>
                          <td className="p-4 text-left">
                            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${item.has_sn ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              {item.has_sn ? 'มี Serial Number' : 'นับตามจำนวน/ความยาว'}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {!item.has_sn ? (
                                <>
                                  <span className="text-lg font-black text-[#042C53]">
                                    {parseFloat(item.total_quantity).toLocaleString()}
                                  </span>
                                  <span className="text-xs font-bold text-slate-500">หน่วย</span>
                                </>
                              ) : (
                                <span className="text-[13px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg shadow-sm">
                                  {item.item_count.toLocaleString()} รายการ
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center items-center gap-2">
                              <button 
                                type="button" 
                                onClick={() => handleViewDetails(item)}
                                className="text-[#185FA5] hover:text-white font-bold text-xs bg-[#E6F1FB] hover:bg-[#185FA5] px-4 py-2 rounded-lg transition-colors shadow-sm"
                              >
                                ดูรายการ / ลบ
                              </button>
                              <button 
                                type="button" 
                                onClick={() => handleDeleteProduct(item.product_id, item.product_name)}
                                className="text-red-500 hover:text-white font-bold text-xs bg-red-50 hover:bg-red-500 px-4 py-2 rounded-lg transition-colors shadow-sm"
                                title="ลบสินค้าและโมเดลทั้งหมด"
                              >
                                🗑️ ลบทั้งสินค้า
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

      </div>
    </div>
  );
}
