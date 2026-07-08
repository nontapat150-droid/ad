import re

with open('frontend/src/pages/InventoryStockPage.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

new_func = r'''  const handleViewDetails = async (product) => {
    if (product.models.length > 1) {
      const cardsHtml = product.models.map(m => `
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
                ${m.model_image_url ? `<img src="${import.meta.env.VITE_API_URL || ''}${m.model_image_url}" style="width:40px; height:40px; object-fit:cover; border-radius:8px; border:1px solid #ddd;" />` : `<span style="font-size: 1.5rem;">📦</span>`}
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
      `).join('');

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
  };'''

content = re.sub(r'  const handleViewDetails = async \(product\) => \{.*?    } else \{\n      showSnList\(product, product\.models\[0\]\);\n    \}\n  \};', new_func, content, flags=re.DOTALL)

with open('frontend/src/pages/InventoryStockPage.jsx', 'w', encoding='utf-8') as f:
    f.write(content)
