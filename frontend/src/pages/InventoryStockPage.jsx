import { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import CategoryManagementModal from '../components/CategoryManagementModal';

export default function InventoryStockPage() {
  const [loading, setLoading] = useState(false);
  const [stock, setStock] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [expandedCategories, setExpandedCategories] = useState({});
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => {
    fetchStock();
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await axios.get('/inventory/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to load categories', err);
    }
  };

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
        unit: item.unit || 'ชิ้น',
        pieces_per_crate: item.pieces_per_crate || null,
        crate_unit: item.crate_unit || 'ลัง',
        category: item.category || null,
          image_url: item.image_url || null,
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
        item_count: item.item_count,
        model_image_url: item.model_image_url || null
      });
    return acc;
  }, {}));

  const filteredStock = groupedStock.filter(p => {
    // Filter by category first
    if (selectedCategory && p.category !== selectedCategory) {
      return false;
    }
    
    // Then filter by search query
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
              ${si.phone_number ? `<span style="color:#042C53;font-size:13px;margin-left:8px;font-weight:bold;">📞 ${si.phone_number}</span>` : ''}
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
      const cardsHtml = product.models.map(m => {
        const imgSrc = m.model_image_url
          ? `<img class="viewable-image" src="${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : ''}${m.model_image_url}" style="width:40px; height:40px; object-fit:cover; border-radius:8px; border:1px solid #ddd; cursor:pointer;" />`
          : `<span style="font-size: 1.5rem;">📦</span>`;

        return `
        <div style="display: flex; gap: 8px; align-items: center; margin: 8px 0;">
          <button 
            type="button" 
            class="swal2-confirm swal2-styled select-model-card" 
            data-model-id="${m.model_id}"
            data-model-name="${m.model_name}"
            style="flex: 1; text-align: left; background-color: #F9FAFB; color: #1F2937; border: 1px solid #E5E7EB; padding: 16px 20px; border-radius: 16px; font-weight: 900; font-size: 1rem; transition: all 0.2s;"
            onmouseover="this.style.borderColor='#A3E635'; this.style.backgroundColor='#ffffff'; this.style.boxShadow='0 4px 12px rgba(163,230,53,0.15)';"
            onmouseout="this.style.borderColor='#E5E7EB'; this.style.backgroundColor='#F9FAFB'; this.style.boxShadow='none';"
          >
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div style="display: flex; align-items: center; gap: 12px;">
                ${imgSrc}
                <span>${m.model_name}</span>
              </div>
              <span style="font-size:0.85rem; background:#A3E635; color:#1F2937; padding:4px 10px; border-radius:8px; font-weight: bold; box-shadow: 0 2px 5px rgba(163,230,53,0.3);">${m.item_count} ชิ้น</span>
            </div>
          </button>
          <button 
            type="button" 
            class="edit-model-btn" 
            data-model-id="${m.model_id}"
            data-model-name="${m.model_name}"
            data-model-image="${m.model_image_url || ''}"
            style="width: 56px; height: 56px; background-color: #EEF2FF; color: #4F46E5; border: 1px solid #E0E7FF; border-radius: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;"
            onmouseover="this.style.backgroundColor='#E0E7FF';"
            onmouseout="this.style.backgroundColor='#EEF2FF';"
            title="แก้ไขโมเดล"
          >
            <svg style="width: 20px; height: 20px;" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          </button>
        </div>
      `;
      }).join('');

      await Swal.fire({
        title: `เลือกรุ่นของ ${product.product_name}`,
        html: `<div style="max-height: 380px; overflow-y: auto; padding: 5px;">${cardsHtml}</div>`,
        showConfirmButton: false,
        showCancelButton: true,
        cancelButtonText: 'ปิดหน้าต่าง',
        cancelButtonColor: '#9CA3AF',
        customClass: { popup: 'rounded-3xl' },
        didOpen: () => {
          const popup = Swal.getPopup();
          const viewableImgs = popup.querySelectorAll('.viewable-image');
          viewableImgs.forEach(img => {
            img.addEventListener('click', (e) => {
              e.stopPropagation();
              Swal.fire({ imageUrl: img.src, imageAlt: 'Model Image', showConfirmButton: false, customClass: { popup: 'rounded-3xl' } });
            });
          });
          const btns = popup.querySelectorAll('.select-model-card');
          btns.forEach(btn => {
            btn.addEventListener('click', () => {
              const modelId = btn.getAttribute('data-model-id');
              const modelName = btn.getAttribute('data-model-name');
              Swal.close();
              showSnList(product, { model_id: modelId, model_name: modelName });
            });
          });

          const editBtns = popup.querySelectorAll('.edit-model-btn');
          editBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const modelId = btn.getAttribute('data-model-id');
              const modelName = btn.getAttribute('data-model-name');
              const modelImage = btn.getAttribute('data-model-image');
              
              Swal.close();
              
              const { value: formValues } = await Swal.fire({
                title: `แก้ไขโมเดล: ${modelName}`,
                html: `
                  <div style="text-align:left;font-size:14px;">
                    <label style="font-weight:bold;margin-bottom:6px;display:block;">ชื่อโมเดล</label>
                    <input id="swal-model-name" class="swal2-input" style="margin-top:0;margin-bottom:16px;width:100%;box-sizing:border-box;" value="${modelName}" />
                    
                    <label style="font-weight:bold;margin-bottom:6px;display:block;">เปลี่ยนรูปภาพโมเดล (ไม่บังคับ)</label>
                    <input type="file" id="swal-model-image" accept="image/*" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;background:#f9fafb;" />
                  </div>
                `,
                showCancelButton: true,
                confirmButtonText: 'บันทึก',
                cancelButtonText: 'ยกเลิก',
                preConfirm: async () => {
                  const newName = document.getElementById('swal-model-name').value;
                  const imgFile = document.getElementById('swal-model-image')?.files[0];
                  
                  if (!newName.trim()) {
                    Swal.showValidationMessage('กรุณากรอกชื่อโมเดล');
                    return false;
                  }
                  
                  let imageUrl = undefined;
                  if (imgFile) {
                    const formData = new FormData();
                    formData.append('image', imgFile);
                    try {
                      const uploadRes = await axios.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                      imageUrl = uploadRes.data.image_url;
                    } catch (err) {
                      Swal.showValidationMessage('อัปโหลดรูปภาพไม่สำเร็จ');
                      return false;
                    }
                  }
                  return { newName, imageUrl };
                }
              });
              
              if (formValues) {
                setLoading(true);
                try {
                  await axios.put(`/inventory/models/${modelId}`, { 
                    model_name: formValues.newName, 
                    image_url: formValues.imageUrl 
                  });
                  Swal.fire({ icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1500, showConfirmButton: false });
                  fetchStock();
                } catch (err) {
                  Swal.fire({ icon: 'error', title: 'ไม่สามารถแก้ไขได้', text: err.message });
                } finally {
                  setLoading(false);
                }
              }
            });
          });
        }
      });
    } else {
      showSnList(product, product.models[0]);
    }
  };

// ── แก้ไขหน่วยนับ / จำนวนต่อลัง ──
  const handleEditUnitSettings = async (product) => {
    const categoryOptionsHtml = categories.map(c => `<option value="${c.name}"></option>`).join('');

    const result = await Swal.fire({
      title: `ตั้งค่าสินค้า / หมวดหมู่`,
      html: `
        <div style="text-align:left;font-size:14px;">
          <p style="font-weight:900;font-size:1rem;color:#1F2937;margin-bottom:16px;">📦 ${product.product_name}</p>
          
          <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">หมวดหมู่สินค้า (Category)</label>
          <input id="swal-edit-category" list="edit-category-options" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin-bottom:16px;" value="${product.category || ''}" placeholder="ระบุหมวดหมู่..." />
          <datalist id="edit-category-options">${categoryOptionsHtml}</datalist>

          <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">รูปภาพสินค้า (ไม่บังคับ)</label>
          <input type="file" id="swal-edit-image" accept="image/*" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;background:#f9fafb;margin-bottom:16px;" />

          ${!product.has_sn ? `
            <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">หน่วยนับสินค้า</label>
            <input id="swal-edit-unit" list="unit-options" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin-bottom:16px;" value="${product.unit || 'ชิ้น'}" placeholder="ตัวเลือกเช่น ชิ้น, กล่อง, เมตร..." />
            <datalist id="unit-options">
              <option value="ชิ้น"></option>
              <option value="กล่อง"></option>
              <option value="ม้วน"></option>
              <option value="เส้น"></option>
              <option value="เมตร"></option>
              <option value="แพ็ค"></option>
              <option value="อัน"></option>
              <option value="ชุด"></option>
            </datalist>
          ` : `
            <p style="color:#6B7280;margin-bottom:12px;">สินค้า SN จะมีหน่วยเป็น <b>"ชิ้น"</b> เสมอ</p>
          `}
          <div style="display:flex;gap:12px;margin-bottom:6px;">
            <div style="flex:1;">
              <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">จำนวนชิ้นต่อ 1 ลัง/แพ็ค</label>
              <input id="swal-edit-ppc" type="number" min="1" value="${product.pieces_per_crate || ''}" placeholder="เช่น 12" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;" />
            </div>
            <div style="flex:1;">
              <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">ชื่อเรียกแพ็คเกจใหญ่</label>
              <input id="swal-edit-crate-unit" type="text" list="crate-unit-options" value="${product.crate_unit || 'ลัง'}" placeholder="ลัง, แพ็ค..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;" />
              <datalist id="crate-unit-options">
                <option value="ลัง"></option>
                <option value="แพ็ค"></option>
                <option value="ม้วน"></option>
                <option value="ขด"></option>
                <option value="กล่อง"></option>
              </datalist>
            </div>
          </div>
        </div>
      `,
      confirmButtonText: 'บันทึก',
      confirmButtonColor: '#185FA5',
      showCancelButton: true,
      cancelButtonText: 'ยกเลิก',
      cancelButtonColor: '#9CA3AF',
      customClass: { popup: 'rounded-3xl' },
      preConfirm: async () => {
        const unitEl = document.getElementById('swal-edit-unit');
        const imgFile = document.getElementById('swal-edit-image')?.files[0];
        
        let imageUrl = product.image_url;
        if (imgFile) {
          const formData = new FormData();
          formData.append('image', imgFile);
          try {
            const uploadRes = await axios.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            imageUrl = uploadRes.data.image_url;
          } catch (err) {
            Swal.showValidationMessage('อัปโหลดรูปภาพไม่สำเร็จ');
            return false;
          }
        }
        
        return {
          unit: unitEl ? unitEl.value : product.unit,
          ppc: document.getElementById('swal-edit-ppc').value,
          crate_unit: document.getElementById('swal-edit-crate-unit').value,
          category: document.getElementById('swal-edit-category').value,
          image_url: imageUrl
        };
      }
    });

    if (result.isConfirmed && result.value) {
      setLoading(true);
      try {
        await axios.put(`/inventory/products/${product.product_id}`, {
          unit: result.value.unit,
          pieces_per_crate: result.value.ppc,
          crate_unit: result.value.crate_unit,
          category: result.value.category,
          image_url: result.value.image_url
        });
        Swal.fire({ icon: 'success', title: 'บันทึกข้อมูลเรียบร้อย', timer: 1000, showConfirmButton: false });
        fetchStock();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถบันทึกได้' });
      } finally {
        setLoading(false);
      }
    }
  };

// ── แก้ไขชื่อสินค้า / รวมสินค้า ──
  const handleRenameProduct = async (product) => {
    const result = await Swal.fire({
      title: 'เปลี่ยนชื่อสินค้า / รวมสินค้า',
      html: `
        <div style="text-align:left;font-size:14px;">
          <p style="font-weight:700;color:#042C53;margin-bottom:8px;">ชื่อสินค้าปัจจุบัน:</p>
          <p style="background:#F3F4F6;padding:10px;border-radius:8px;margin-bottom:16px;">${product.product_name}</p>
          <label style="font-weight:700;color:#042C53;display:block;margin-bottom:8px;">ชื่อสินค้าใหม่:</label>
          <input id="swal-rename-input" class="swal2-input" value="${product.product_name}" style="width:100%;margin:0;font-size:16px;" />
          <p style="color:#6B7280;font-size:12px;margin-top:12px;line-height:1.4;">
            <b>หมายเหตุ:</b> หากชื่อที่ตั้งใหม่ตรงกับสินค้าอื่นที่มีอยู่ในระบบ ระบบจะรวมข้อมูล (Merge) ไอเท็มและโมเดลทั้งหมดเข้าไปอยู่ในสินค้านั้นให้โดยอัตโนมัติ (ต้องเป็นสินค้าประเภทเดียวกัน)
          </p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#185FA5',
      customClass: { popup: 'rounded-3xl' },
      preConfirm: () => {
        const val = document.getElementById('swal-rename-input').value.trim();
        if (!val) {
          Swal.showValidationMessage('กรุณาระบุชื่อสินค้า');
          return false;
        }
        if (val === product.product_name) {
          Swal.showValidationMessage('ชื่อสินค้ายังเหมือนเดิม');
          return false;
        }
        return val;
      }
    });

    if (result.isConfirmed && result.value) {
      setLoading(true);
      try {
        const response = await axios.put(`/inventory/products/${product.product_id}/rename`, {
          new_name: result.value
        });
        Swal.fire({ icon: 'success', title: 'สำเร็จ', text: response.data.message, timer: 2000, showConfirmButton: false });
        fetchStock();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถเปลี่ยนชื่อสินค้าได้' });
        setLoading(false);
      }
    }
  };

  const handleClearSystem = async () => {
    const confirm = await Swal.fire({
      title: 'ล้างข้อมูลคลังสินค้า?',
      html: `คุณกำลังจะลบ <b>ข้อมูลสินค้าคงคลัง (SN) และประวัติรับ/จ่าย ทั้งหมด</b><br/><br/><small style="color:#ef4444; font-weight:bold;">คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้ (ชื่อสินค้าและโมเดลจะยังคงอยู่)</small>`,
      icon: 'warning',
      input: 'text',
      inputPlaceholder: 'พิมพ์คำว่า "ยืนยัน" เพื่อดำเนินการต่อ',
      showCancelButton: true,
      confirmButtonText: 'ล้างข้อมูลทันที',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9CA3AF',
      customClass: { popup: 'rounded-3xl' },
      preConfirm: (inputValue) => {
        if (inputValue !== 'ยืนยัน') {
          Swal.showValidationMessage('กรุณาพิมพ์คำว่า "ยืนยัน" ให้ถูกต้อง');
          return false;
        }
        return true;
      }
    });

    if (confirm.isConfirmed) {
      setLoading(true);
      try {
        await axios.delete('/inventory/clear');
        Swal.fire({ icon: 'success', title: 'ล้างข้อมูลสำเร็จ', showConfirmButton: false, timer: 1500 });
        fetchStock();
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถล้างข้อมูลได้' });
        setLoading(false);
      }
    }
  };

  const groupedByCategory = filteredStock.reduce((acc, item) => {
    const cat = item.category || 'อื่นๆ (ไม่มีหมวดหมู่)';
    if (!acc[cat]) {
      acc[cat] = [];
    }
    acc[cat].push(item);
    return acc;
  }, {});

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({
      ...prev,
      [cat]: !prev[cat]
    }));
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
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-4 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm whitespace-nowrap hidden sm:flex items-center gap-2"
              title="จัดการหมวดหมู่"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
              จัดการหมวดหมู่
            </button>
            {/* Mobile icon-only button */}
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="px-3 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl border border-indigo-100 hover:bg-indigo-100 transition-colors shadow-sm sm:hidden flex items-center justify-center"
              title="จัดการหมวดหมู่"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" /></svg>
            </button>

            <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full sm:w-40 px-4 py-2.5 border border-[#E5E7EB] rounded-xl focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20 outline-none text-[#1F2937] text-sm font-bold bg-white transition-all shadow-sm appearance-none"
            >
              <option value="">ทุกหมวดหมู่</option>
              {categories.map(cat => (
                <option key={cat.name} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#9CA3AF]">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
          
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
          
          <button type="button" onClick={handleClearSystem} className="flex items-center justify-center h-11 px-4 rounded-xl border-2 border-[#FEE2E2] text-[#EF4444] hover:bg-[#FEF2F2] font-bold text-sm transition-all shrink-0 bg-white shadow-sm active:scale-95 gap-2" title="ล้างข้อมูล SN">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span className="hidden sm:inline">ล้างข้อมูล SN</span>
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
        <div className="flex flex-col gap-4 p-4 sm:p-6 bg-[#F9FAFB]">
          {Object.keys(groupedByCategory).sort().map(cat => {
            const items = groupedByCategory[cat];
            const isExpanded = expandedCategories[cat] || (searchQuery.trim().length > 0);
            
            // ค้นหา metadata ของหมวดหมู่นี้
            const catMeta = categories.find(c => c.name === cat) || {};
            
            return (
              <div key={cat} className="bg-white rounded-2xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                {/* Category Header */}
                <div className="w-full flex items-center justify-between p-4 sm:p-5 hover:bg-[#F9FAFB] transition-colors border-b border-[#E5E7EB]">
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => toggleCategory(cat)}
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-sm overflow-hidden shrink-0">
                      {catMeta.image_url ? (
                        <img src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : ''}${catMeta.image_url}`} alt={cat} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); Swal.fire({ imageUrl: e.target.src, imageAlt: cat, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); }} />
                      ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-[#1F2937] text-lg">{cat}</h3>
                      <p className="text-sm font-bold text-[#6B7280] mt-0.5">
                        {items.length} รายการ (รวม {items.reduce((sum, item) => sum + item.models.length, 0)} โมเดล)
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* ปุ่มอัปโหลดรูปหมวดหมู่ */}
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (cat === 'อื่นๆ (ไม่มีหมวดหมู่)') {
                          Swal.fire('ไม่สามารถเปลี่ยนรูปภาพได้', 'หมวดหมู่นี้เป็นหมวดหมู่เริ่มต้น', 'info');
                          return;
                        }
                        const { value: file } = await Swal.fire({
                          title: `เปลี่ยนรูปภาพหมวดหมู่: ${cat}`,
                          input: 'file',
                          inputAttributes: { accept: 'image/*' },
                          showCancelButton: true,
                          confirmButtonText: 'อัปโหลด',
                          cancelButtonText: 'ยกเลิก'
                        });
                        if (file) {
                          setLoading(true);
                          const formData = new FormData();
                          formData.append('image', file);
                          try {
                            const uploadRes = await axios.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                            await axios.put(`/inventory/categories/${encodeURIComponent(cat)}/image`, { image_url: uploadRes.data.image_url });
                            Swal.fire({ icon: 'success', title: 'เปลี่ยนรูปภาพสำเร็จ', timer: 1500, showConfirmButton: false });
                            fetchStock();
                            fetchCategories();
                          } catch (err) {
                            Swal.fire({ icon: 'error', title: 'อัปโหลดไม่สำเร็จ', text: err.message });
                          } finally {
                            setLoading(false);
                          }
                        }
                      }}
                      className="p-2 rounded-xl text-indigo-500 bg-indigo-50 hover:bg-indigo-100 transition-colors border border-indigo-100"
                      title="เปลี่ยนรูปภาพหมวดหมู่"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    </button>
                    
                    <button onClick={() => toggleCategory(cat)} className={`w-10 h-10 rounded-full flex items-center justify-center bg-[#F3F4F6] text-[#4B5563] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Category Items */}
                {isExpanded && (
                  <div className="border-t border-[#E5E7EB] overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-[#F9FAFB] text-[#6B7280]">
                        <tr>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB]">สินค้า (Product)</th>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB]">โมเดล (Model)</th>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB]">ประเภทการเก็บ</th>
                          <th className="p-4 font-black uppercase tracking-wider text-right border-b border-[#E5E7EB]">จำนวนคงเหลือ</th>
                          <th className="p-4 font-black uppercase tracking-wider text-center border-b border-[#E5E7EB]">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {items.map((item, index) => (
                          <tr 
                  key={`product-${item.product_id}`} 
                  className="hover:bg-[#F9FAFB] transition-colors group"
                >
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center shrink-0 overflow-hidden group-hover:border-[#A3E635] group-hover:shadow-sm transition-all">
                        {item.image_url ? (
                          <img src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : ''}${item.image_url}`} alt={item.product_name} className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity" onClick={(e) => { e.stopPropagation(); Swal.fire({ imageUrl: e.target.src, imageAlt: item.product_name, showConfirmButton: false, customClass: { popup: 'rounded-3xl' } }); }} />
                        ) : (
                          <span className="text-2xl">📦</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col">
                          <p className="font-black text-[#1F2937] text-base">{item.product_name}</p>
                          {item.category && <span className="text-[10px] font-bold text-white bg-blue-500 px-1.5 py-0.5 rounded inline-block w-max mt-0.5">{item.category}</span>}
                        </div>
                        <button onClick={() => handleRenameProduct(item)} className="text-[#9CA3AF] hover:text-[#A3E635] transition-colors" title="แก้ไขชื่อสินค้า">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
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
                          <span className="text-xs font-bold text-[#6B7280] bg-[#F3F4F6] px-2 py-1 rounded-md">{item.unit || 'ชิ้น'}</span>
                          {item.pieces_per_crate && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200">
                              1 {item.crate_unit || 'ลัง'} = {item.pieces_per_crate} {item.unit || 'ชิ้น'}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="text-sm font-black text-[#1F2937] bg-[#A3E635] px-3 py-1.5 rounded-xl shadow-[0_2px_8px_rgba(163,230,53,0.3)]">
                            {item.item_count.toLocaleString()} ชิ้น
                          </span>
                          {item.pieces_per_crate && (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 ml-1">
                              1 {item.crate_unit || 'ลัง'} = {item.pieces_per_crate} ชิ้น
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="p-5 text-center">
                    <div className="flex justify-center items-center gap-2">
                      <button 
                        type="button" 
                        onClick={() => handleEditUnitSettings(item)}
                        className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-100 flex items-center justify-center transition-colors shadow-sm border border-amber-100 active:scale-95"
                        title="ตั้งค่าหน่วย / ลัง"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                      </button>
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
          })}
        </div>
      )}
    </div>
  );
}

