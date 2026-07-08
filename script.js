const fs = require('fs');

const path = 'frontend/src/pages/InventoryStockPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const newFunc = "  const handleViewDetails = async (product) => {\n" +
"    if (product.models.length > 1) {\n" +
"      const cardsHtml = product.models.map(m => {\n" +
"        const imgSrc = m.model_image_url\n" +
"          ? `<img src=\"${import.meta.env.VITE_API_URL || ''}${m.model_image_url}\" style=\"width:40px; height:40px; object-fit:cover; border-radius:8px; border:1px solid #ddd;\" />`\n" +
"          : `<span style=\"font-size: 1.5rem;\">📦</span>`;\n" +
"\n" +
"        return `\n" +
"        <div style=\"display: flex; gap: 8px; align-items: center; margin: 8px 0;\">\n" +
"          <button \n" +
"            type=\"button\" \n" +
"            class=\"swal2-confirm swal2-styled select-model-card\" \n" +
"            data-model-id=\"${m.model_id}\"\n" +
"            data-model-name=\"${m.model_name}\"\n" +
"            style=\"flex: 1; text-align: left; background-color: #F9FAFB; color: #1F2937; border: 1px solid #E5E7EB; padding: 16px 20px; border-radius: 16px; font-weight: 900; font-size: 1rem; transition: all 0.2s;\"\n" +
"            onmouseover=\"this.style.borderColor='#A3E635'; this.style.backgroundColor='#ffffff'; this.style.boxShadow='0 4px 12px rgba(163,230,53,0.15)';\"\n" +
"            onmouseout=\"this.style.borderColor='#E5E7EB'; this.style.backgroundColor='#F9FAFB'; this.style.boxShadow='none';\"\n" +
"          >\n" +
"            <div style=\"display:flex; justify-content:space-between; align-items:center;\">\n" +
"              <div style=\"display: flex; align-items: center; gap: 12px;\">\n" +
"                ${imgSrc}\n" +
"                <span>${m.model_name}</span>\n" +
"              </div>\n" +
"              <span style=\"font-size:0.85rem; background:#A3E635; color:#1F2937; padding:4px 10px; border-radius:8px; font-weight: bold; box-shadow: 0 2px 5px rgba(163,230,53,0.3);\">${m.item_count} ชิ้น</span>\n" +
"            </div>\n" +
"          </button>\n" +
"          <button \n" +
"            type=\"button\" \n" +
"            class=\"edit-model-btn\" \n" +
"            data-model-id=\"${m.model_id}\"\n" +
"            data-model-name=\"${m.model_name}\"\n" +
"            data-model-image=\"${m.model_image_url || ''}\"\n" +
"            style=\"width: 56px; height: 56px; background-color: #EEF2FF; color: #4F46E5; border: 1px solid #E0E7FF; border-radius: 16px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;\"\n" +
"            onmouseover=\"this.style.backgroundColor='#E0E7FF';\"\n" +
"            onmouseout=\"this.style.backgroundColor='#EEF2FF';\"\n" +
"            title=\"แก้ไขโมเดล\"\n" +
"          >\n" +
"            <svg style=\"width: 20px; height: 20px;\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" d=\"M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z\" /></svg>\n" +
"          </button>\n" +
"        </div>\n" +
"      `;\n" +
"      }).join('');\n" +
"\n" +
"      await Swal.fire({\n" +
"        title: `เลือกรุ่นของ ${product.product_name}`,\n" +
"        html: `<div style=\"max-height: 380px; overflow-y: auto; padding: 5px;\">${cardsHtml}</div>`,\n" +
"        showConfirmButton: false,\n" +
"        showCancelButton: true,\n" +
"        cancelButtonText: 'ปิดหน้าต่าง',\n" +
"        cancelButtonColor: '#9CA3AF',\n" +
"        customClass: { popup: 'rounded-3xl' },\n" +
"        didOpen: () => {\n" +
"          const popup = Swal.getPopup();\n" +
"          const btns = popup.querySelectorAll('.select-model-card');\n" +
"          btns.forEach(btn => {\n" +
"            btn.addEventListener('click', () => {\n" +
"              const modelId = btn.getAttribute('data-model-id');\n" +
"              const modelName = btn.getAttribute('data-model-name');\n" +
"              Swal.close();\n" +
"              showSnList(product, { model_id: modelId, model_name: modelName });\n" +
"            });\n" +
"          });\n" +
"\n" +
"          const editBtns = popup.querySelectorAll('.edit-model-btn');\n" +
"          editBtns.forEach(btn => {\n" +
"            btn.addEventListener('click', async (e) => {\n" +
"              e.stopPropagation();\n" +
"              const modelId = btn.getAttribute('data-model-id');\n" +
"              const modelName = btn.getAttribute('data-model-name');\n" +
"              const modelImage = btn.getAttribute('data-model-image');\n" +
"              \n" +
"              Swal.close();\n" +
"              \n" +
"              const { value: formValues } = await Swal.fire({\n" +
"                title: `แก้ไขโมเดล: ${modelName}`,\n" +
"                html: `\n" +
"                  <div style=\"text-align:left;font-size:14px;\">\n" +
"                    <label style=\"font-weight:bold;margin-bottom:6px;display:block;\">ชื่อโมเดล</label>\n" +
"                    <input id=\"swal-model-name\" class=\"swal2-input\" style=\"margin-top:0;margin-bottom:16px;width:100%;box-sizing:border-box;\" value=\"${modelName}\" />\n" +
"                    \n" +
"                    <label style=\"font-weight:bold;margin-bottom:6px;display:block;\">เปลี่ยนรูปภาพโมเดล (ไม่บังคับ)</label>\n" +
"                    <input type=\"file\" id=\"swal-model-image\" accept=\"image/*\" style=\"width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;background:#f9fafb;\" />\n" +
"                  </div>\n" +
"                `,\n" +
"                showCancelButton: true,\n" +
"                confirmButtonText: 'บันทึก',\n" +
"                cancelButtonText: 'ยกเลิก',\n" +
"                preConfirm: async () => {\n" +
"                  const newName = document.getElementById('swal-model-name').value;\n" +
"                  const imgFile = document.getElementById('swal-model-image')?.files[0];\n" +
"                  \n" +
"                  if (!newName.trim()) {\n" +
"                    Swal.showValidationMessage('กรุณากรอกชื่อโมเดล');\n" +
"                    return false;\n" +
"                  }\n" +
"                  \n" +
"                  let imageUrl = undefined;\n" +
"                  if (imgFile) {\n" +
"                    const formData = new FormData();\n" +
"                    formData.append('image', imgFile);\n" +
"                    try {\n" +
"                      const uploadRes = await axios.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });\n" +
"                      imageUrl = uploadRes.data.image_url;\n" +
"                    } catch (err) {\n" +
"                      Swal.showValidationMessage('อัปโหลดรูปภาพไม่สำเร็จ');\n" +
"                      return false;\n" +
"                    }\n" +
"                  }\n" +
"                  return { newName, imageUrl };\n" +
"                }\n" +
"              });\n" +
"              \n" +
"              if (formValues) {\n" +
"                setLoading(true);\n" +
"                try {\n" +
"                  await axios.put(`/inventory/models/${modelId}`, { \n" +
"                    model_name: formValues.newName, \n" +
"                    image_url: formValues.imageUrl \n" +
"                  });\n" +
"                  Swal.fire({ icon: 'success', title: 'แก้ไขสำเร็จ', timer: 1500, showConfirmButton: false });\n" +
"                  fetchStock();\n" +
"                } catch (err) {\n" +
"                  Swal.fire({ icon: 'error', title: 'ไม่สามารถแก้ไขได้', text: err.message });\n" +
"                } finally {\n" +
"                  setLoading(false);\n" +
"                }\n" +
"              }\n" +
"            });\n" +
"          });\n" +
"        }\n" +
"      });\n" +
"    } else {\n" +
"      showSnList(product, product.models[0]);\n" +
"    }\n" +
"  };";

content = content.replace(/  const handleViewDetails = async \(product\) => \{[\s\S]*?\} else \{\s*showSnList\(product, product\.models\[0\]\);\s*\}\s*\};\s*/m, newFunc + '\n\n');

fs.writeFileSync(path, content, 'utf8');
