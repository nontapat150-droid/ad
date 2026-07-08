const fs = require('fs');

const path = 'frontend/src/pages/InventoryStockPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const newFunc = "  const handleEditUnitSettings = async (product) => {\n" +
"    const categoryOptionsHtml = categories.map(c => `<option value=\"${c.name}\"></option>`).join('');\n" +
"\n" +
"    const result = await Swal.fire({\n" +
"      title: `ตั้งค่าสินค้า / หมวดหมู่`,\n" +
"      html: `\n" +
"        <div style=\"text-align:left;font-size:14px;\">\n" +
"          <p style=\"font-weight:900;font-size:1rem;color:#1F2937;margin-bottom:16px;\">📦 ${product.product_name}</p>\n" +
"          \n" +
"          <label style=\"font-weight:700;color:#042C53;display:block;margin-bottom:6px;\">หมวดหมู่สินค้า (Category)</label>\n" +
"          <input id=\"swal-edit-category\" list=\"edit-category-options\" style=\"width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin-bottom:16px;\" value=\"${product.category || ''}\" placeholder=\"ระบุหมวดหมู่...\" />\n" +
"          <datalist id=\"edit-category-options\">${categoryOptionsHtml}</datalist>\n" +
"\n" +
"          <label style=\"font-weight:700;color:#042C53;display:block;margin-bottom:6px;\">รูปภาพสินค้า (ไม่บังคับ)</label>\n" +
"          <input type=\"file\" id=\"swal-edit-image\" accept=\"image/*\" style=\"width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;background:#f9fafb;margin-bottom:16px;\" />\n" +
"\n" +
"          ${!product.has_sn ? `\n" +
"            <label style=\"font-weight:700;color:#042C53;display:block;margin-bottom:6px;\">หน่วยนับสินค้า</label>\n" +
"            <input id=\"swal-edit-unit\" list=\"unit-options\" style=\"width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin-bottom:16px;\" value=\"${product.unit || 'ชิ้น'}\" placeholder=\"ตัวเลือกเช่น ชิ้น, กล่อง, เมตร...\" />\n" +
"            <datalist id=\"unit-options\">\n" +
"              <option value=\"ชิ้น\"></option>\n" +
"              <option value=\"กล่อง\"></option>\n" +
"              <option value=\"ม้วน\"></option>\n" +
"              <option value=\"เส้น\"></option>\n" +
"              <option value=\"เมตร\"></option>\n" +
"              <option value=\"แพ็ค\"></option>\n" +
"              <option value=\"อัน\"></option>\n" +
"              <option value=\"ชุด\"></option>\n" +
"            </datalist>\n" +
"          ` : `\n" +
"            <p style=\"color:#6B7280;margin-bottom:12px;\">สินค้า SN จะมีหน่วยเป็น <b>\"ชิ้น\"</b> เสมอ</p>\n" +
"          `}\n" +
"          <div style=\"display:flex;gap:12px;margin-bottom:6px;\">\n" +
"            <div style=\"flex:1;\">\n" +
"              <label style=\"font-weight:700;color:#042C53;display:block;margin-bottom:6px;\">จำนวนชิ้นต่อ 1 ลัง/แพ็ค</label>\n" +
"              <input id=\"swal-edit-ppc\" type=\"number\" min=\"1\" value=\"${product.pieces_per_crate || ''}\" placeholder=\"เช่น 12\" style=\"width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;\" />\n" +
"            </div>\n" +
"            <div style=\"flex:1;\">\n" +
"              <label style=\"font-weight:700;color:#042C53;display:block;margin-bottom:6px;\">ชื่อเรียกแพ็คเกจใหญ่</label>\n" +
"              <input id=\"swal-edit-crate-unit\" type=\"text\" list=\"crate-unit-options\" value=\"${product.crate_unit || 'ลัง'}\" placeholder=\"ลัง, แพ็ค...\" style=\"width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;\" />\n" +
"              <datalist id=\"crate-unit-options\">\n" +
"                <option value=\"ลัง\"></option>\n" +
"                <option value=\"แพ็ค\"></option>\n" +
"                <option value=\"ม้วน\"></option>\n" +
"                <option value=\"ขด\"></option>\n" +
"                <option value=\"กล่อง\"></option>\n" +
"              </datalist>\n" +
"            </div>\n" +
"          </div>\n" +
"        </div>\n" +
"      `,\n" +
"      confirmButtonText: 'บันทึก',\n" +
"      confirmButtonColor: '#185FA5',\n" +
"      showCancelButton: true,\n" +
"      cancelButtonText: 'ยกเลิก',\n" +
"      cancelButtonColor: '#9CA3AF',\n" +
"      customClass: { popup: 'rounded-3xl' },\n" +
"      preConfirm: async () => {\n" +
"        const unitEl = document.getElementById('swal-edit-unit');\n" +
"        const imgFile = document.getElementById('swal-edit-image')?.files[0];\n" +
"        \n" +
"        let imageUrl = product.image_url;\n" +
"        if (imgFile) {\n" +
"          const formData = new FormData();\n" +
"          formData.append('image', imgFile);\n" +
"          try {\n" +
"            const uploadRes = await axios.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });\n" +
"            imageUrl = uploadRes.data.image_url;\n" +
"          } catch (err) {\n" +
"            Swal.showValidationMessage('อัปโหลดรูปภาพไม่สำเร็จ');\n" +
"            return false;\n" +
"          }\n" +
"        }\n" +
"        \n" +
"        return {\n" +
"          unit: unitEl ? unitEl.value : product.unit,\n" +
"          ppc: document.getElementById('swal-edit-ppc').value,\n" +
"          crate_unit: document.getElementById('swal-edit-crate-unit').value,\n" +
"          category: document.getElementById('swal-edit-category').value,\n" +
"          image_url: imageUrl\n" +
"        };\n" +
"      }\n" +
"    });\n" +
"\n" +
"    if (result.isConfirmed && result.value) {\n" +
"      setLoading(true);\n" +
"      try {\n" +
"        await axios.put(`/inventory/products/${product.product_id}`, {\n" +
"          unit: result.value.unit,\n" +
"          pieces_per_crate: result.value.ppc,\n" +
"          crate_unit: result.value.crate_unit,\n" +
"          category: result.value.category,\n" +
"          image_url: result.value.image_url\n" +
"        });\n" +
"        Swal.fire({ icon: 'success', title: 'บันทึกข้อมูลเรียบร้อย', timer: 1000, showConfirmButton: false });\n" +
"        fetchStock();\n" +
"      } catch (err) {\n" +
"        Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: err.response?.data?.error || 'ไม่สามารถบันทึกได้' });\n" +
"      } finally {\n" +
"        setLoading(false);\n" +
"      }\n" +
"    }\n" +
"  };";

content = content.replace(/  const handleEditUnitSettings = async \(product\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\s*finally\s*\{[\s\S]*?\}\s*\}\s*\};\s*/m, newFunc + '\n\n');

// Also try replacing without finally in case the previous replacement failed or something
content = content.replace(/  const handleEditUnitSettings = async \(product\) => \{[\s\S]*?\} catch \(err\) \{[\s\S]*?\}\s*\}\s*\};\s*/m, newFunc + '\n\n');

fs.writeFileSync(path, content, 'utf8');
