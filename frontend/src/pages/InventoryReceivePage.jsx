import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import axios from '../api/axios';
import Swal from 'sweetalert2';

// ─── Excel Import Modal ──────────────────────────────────────────────────────
function ExcelImportModal({ isOpen, onClose, products, onConfirm }) {
  const [importRows, setImportRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const fileInputRef = useRef(null);

  const resetModal = () => {
    setImportRows([]);
    setFileName('');
    setParseError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  // Map a row value to existing product/model by fuzzy match (case-insensitive, trimmed)
  const matchProduct = useCallback((name) => {
    if (!name) return null;
    return products.find(p => p.name.trim().toLowerCase() === String(name).trim().toLowerCase()) || null;
  }, [products]);

  const matchModel = useCallback((product, modelName) => {
    if (!product || !modelName) return null;
    return (product.models || []).find(m =>
      m.model_name.trim().toLowerCase() === String(modelName).trim().toLowerCase()
    ) || null;
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setImportRows([]);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) {
          setParseError('ไฟล์ Excel ว่างเปล่า หรือไม่มีข้อมูล');
          return;
        }

        // Detect columns dynamically (case-insensitive)
        const keys = Object.keys(json[0]);
        const findKey = (...candidates) =>
          keys.find(k => candidates.some(c => k.trim().toLowerCase().includes(c.toLowerCase()))) || null;

        const productKey = findKey('product', 'สินค้า', 'ชื่อสินค้า', 'Product');
        const modelKey = findKey('model', 'โมเดล', 'รุ่น', 'Model');
        const snKey = findKey('sn', 'serial', 'ซีเรียล', 'SN', 'รหัส', 'barcode');

        if (!productKey && !modelKey && !snKey) {
          setParseError(
            `ไม่พบคอลัมน์ที่รู้จัก\nคอลัมน์ในไฟล์: ${keys.join(', ')}\n\nกรุณาใช้หัวคอลัมน์: ชื่อสินค้า, โมเดล, SN`
          );
          return;
        }

        const rows = json.map((row, idx) => {
          const rawProduct = productKey ? String(row[productKey] ?? '').trim() : '';
          const rawModel = modelKey ? String(row[modelKey] ?? '').trim() : '';
          const rawSn = snKey ? String(row[snKey] ?? '').trim() : '';

          const matchedProduct = matchProduct(rawProduct);
          const matchedModel = matchedProduct ? matchModel(matchedProduct, rawModel) : null;

          const errors = [];
          if (!rawProduct) errors.push('ไม่มีชื่อสินค้า');
          else if (!matchedProduct) errors.push(`ไม่พบสินค้า "${rawProduct}" ในระบบ`);
          if (!rawModel) errors.push('ไม่มีชื่อโมเดล');
          else if (matchedProduct && !matchedModel) errors.push(`ไม่พบโมเดล "${rawModel}"`);
          if (!rawSn && matchedProduct?.has_sn) errors.push('ไม่มี SN');

          return {
            _rowNum: idx + 2,
            _id: `excel-${idx}-${Date.now()}`,
            rawProduct,
            rawModel,
            rawSn,
            matchedProduct,
            matchedModel,
            errors,
            // editable fields
            product_name: rawProduct,
            model_name: rawModel,
            sn: rawSn,
          };
        });

        setImportRows(rows);
      } catch (err) {
        console.error(err);
        setParseError('ไม่สามารถอ่านไฟล์ได้ กรุณาตรวจสอบว่าเป็น .xlsx หรือ .xls');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const updateRow = (id, field, value) => {
    setImportRows(prev => prev.map(row => {
      if (row._id !== id) return row;
      const updated = { ...row, [field]: value };

      // Re-validate on edit
      const mp = field === 'product_name' ? matchProduct(value) : row.matchedProduct;
      const mm = field === 'model_name' ? matchModel(mp, value) : (field === 'product_name' ? null : row.matchedModel);
      const errs = [];
      if (!updated.product_name) errs.push('ไม่มีชื่อสินค้า');
      else if (!mp) errs.push(`ไม่พบสินค้า "${updated.product_name}" ในระบบ`);
      if (!updated.model_name) errs.push('ไม่มีชื่อโมเดล');
      else if (mp && !mm) errs.push(`ไม่พบโมเดล "${updated.model_name}"`);
      if (!updated.sn && mp?.has_sn) errs.push('ไม่มี SN');

      return {
        ...updated,
        matchedProduct: mp,
        matchedModel: field === 'model_name' ? mm : (field === 'product_name' ? null : row.matchedModel),
        errors: errs,
      };
    }));
  };

  const removeRow = (id) => {
    setImportRows(prev => prev.filter(r => r._id !== id));
  };

  const validRows = importRows.filter(r => r.errors.length === 0);
  const errorRows = importRows.filter(r => r.errors.length > 0);

  const handleConfirm = () => {
    if (validRows.length === 0) {
      Swal.fire({ icon: 'warning', title: 'ไม่มีแถวที่ถูกต้อง', text: 'กรุณาแก้ไขข้อมูลก่อนยืนยัน' });
      return;
    }
    onConfirm(validRows);
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(4,44,83,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-[#042C53] to-[#185FA5] text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-xl p-2">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">นำเข้าข้อมูลจาก Excel</h2>
              <p className="text-xs text-white/70">ตรวจสอบและแก้ไขข้อมูลก่อนยืนยันเข้าระบบ</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* File Upload Zone */}
          <div
            className="border-2 border-dashed border-[#185FA5]/30 rounded-2xl p-6 text-center cursor-pointer hover:border-[#185FA5]/60 hover:bg-[#E6F1FB]/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="bg-[#E6F1FB] rounded-2xl p-4">
                <svg className="w-10 h-10 text-[#185FA5]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              {fileName ? (
                <div>
                  <p className="text-[#042C53] font-bold text-base">{fileName}</p>
                  <p className="text-[#378ADD] text-sm mt-1">คลิกเพื่อเปลี่ยนไฟล์</p>
                </div>
              ) : (
                <div>
                  <p className="text-[#042C53] font-bold">คลิกเพื่อเลือกไฟล์ Excel</p>
                  <p className="text-slate-400 text-sm mt-1">รองรับ .xlsx, .xls</p>
                </div>
              )}
            </div>
          </div>

          {/* Column Guide */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
            <p className="font-bold mb-2">📋 รูปแบบหัวคอลัมน์ที่รองรับ:</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-2 border border-amber-100">
                <p className="font-bold text-[#042C53]">ชื่อสินค้า</p>
                <p className="text-xs text-slate-500">product, สินค้า, ชื่อสินค้า</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-amber-100">
                <p className="font-bold text-[#042C53]">โมเดล</p>
                <p className="text-xs text-slate-500">model, โมเดล, รุ่น</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-amber-100">
                <p className="font-bold text-[#042C53]">Serial Number</p>
                <p className="text-xs text-slate-500">sn, serial, SN, รหัส, barcode</p>
              </div>
            </div>
          </div>

          {/* Parse Error */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm whitespace-pre-wrap">
              <p className="font-bold mb-1">❌ ไม่สามารถอ่านไฟล์ได้</p>
              {parseError}
            </div>
          )}

          {/* Summary badges */}
          {importRows.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm">
                📊 รวม {importRows.length} แถว
              </span>
              <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm">
                ✅ ถูกต้อง {validRows.length} แถว
              </span>
              {errorRows.length > 0 && (
                <span className="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-bold text-sm">
                  ⚠️ มีปัญหา {errorRows.length} แถว (จะไม่ถูกนำเข้า)
                </span>
              )}
            </div>
          )}

          {/* Data Table */}
          {importRows.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto max-h-80">
                <table className="w-full text-sm text-left">
                  <thead className="bg-[#042C53] text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">แถว</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">ชื่อสินค้า</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">โมเดล</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">SN / รหัส</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">สถานะ</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">ลบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row) => {
                      const hasError = row.errors.length > 0;
                      return (
                        <tr key={row._id} className={`border-b border-slate-100 transition-colors ${hasError ? 'bg-red-50' : 'bg-white hover:bg-slate-50'}`}>
                          <td className="px-4 py-3 text-slate-400 text-xs">{row._rowNum}</td>
                          
                          {/* Product Name - editable */}
                          <td className="px-4 py-2 min-w-[160px]">
                            <input
                              list={`product-list-excel-${row._id}`}
                              value={row.product_name}
                              onChange={(e) => updateRow(row._id, 'product_name', e.target.value)}
                              className={`w-full px-3 py-1.5 rounded-lg border text-sm font-medium outline-none focus:ring-2 focus:ring-[#185FA5] ${
                                row.matchedProduct ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-700'
                              }`}
                              placeholder="ชื่อสินค้า"
                            />
                            <datalist id={`product-list-excel-${row._id}`}>
                              {products.map(p => <option key={p.id} value={p.name} />)}
                            </datalist>
                          </td>

                          {/* Model Name - editable */}
                          <td className="px-4 py-2 min-w-[160px]">
                            <input
                              list={`model-list-excel-${row._id}`}
                              value={row.model_name}
                              onChange={(e) => updateRow(row._id, 'model_name', e.target.value)}
                              className={`w-full px-3 py-1.5 rounded-lg border text-sm font-medium outline-none focus:ring-2 focus:ring-[#185FA5] ${
                                row.matchedModel ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-700'
                              }`}
                              placeholder="โมเดล"
                            />
                            <datalist id={`model-list-excel-${row._id}`}>
                              {(row.matchedProduct?.models || []).map(m => <option key={m.id} value={m.model_name} />)}
                            </datalist>
                          </td>

                          {/* SN - editable */}
                          <td className="px-4 py-2 min-w-[160px]">
                            <input
                              type="text"
                              value={row.sn}
                              onChange={(e) => updateRow(row._id, 'sn', e.target.value)}
                              className={`w-full px-3 py-1.5 rounded-lg border font-mono text-sm outline-none focus:ring-2 focus:ring-[#185FA5] ${
                                !row.sn && row.matchedProduct?.has_sn
                                  ? 'border-red-300 bg-red-50 text-red-700'
                                  : 'border-slate-300 bg-white text-slate-700'
                              }`}
                              placeholder={row.matchedProduct?.has_sn ? 'SN (จำเป็น)' : 'SN (ถ้ามี)'}
                            />
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {hasError ? (
                              <div className="group relative cursor-help">
                                <span className="text-red-600 font-bold text-xs bg-red-100 px-2 py-1 rounded-lg">⚠️ มีปัญหา</span>
                                <div className="absolute left-0 top-7 bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl z-20 whitespace-nowrap hidden group-hover:block min-w-max">
                                  {row.errors.map((e, i) => <div key={i}>• {e}</div>)}
                                </div>
                              </div>
                            ) : (
                              <span className="text-emerald-700 font-bold text-xs bg-emerald-100 px-2 py-1 rounded-lg">✅ พร้อม</span>
                            )}
                          </td>

                          {/* Delete Row */}
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(row._id)}
                              className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                              title="ลบแถวนี้"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center shrink-0">
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold hover:bg-slate-100 transition-colors"
          >
            ยกเลิก
          </button>

          <div className="flex items-center gap-3">
            {importRows.length > 0 && (
              <span className="text-sm text-slate-500">
                นำเข้า <span className="font-bold text-emerald-700">{validRows.length}</span> แถว
                {errorRows.length > 0 && <span className="text-red-500"> (ข้าม {errorRows.length} แถวที่มีปัญหา)</span>}
              </span>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={validRows.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              ยืนยันนำเข้า {validRows.length > 0 ? `(${validRows.length} รายการ)` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function InventoryReceivePage() {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [showExcelModal, setShowExcelModal] = useState(false);
  
  // Selection state
  const [productSearchInput, setProductSearchInput] = useState('');
  const [modelSearchInput, setModelSearchInput] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  
  // Product Details
  const selectedProduct = products.find(p => p.id === parseInt(selectedProductId));
  const availableModels = selectedProduct?.models || [];
  const selectedModel = availableModels.find(m => m.id === parseInt(selectedModelId));
  
  // Form State
  const [inputType, setInputType] = useState('scan'); // 'scan' | 'type'
  const [sn, setSn] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isAutoGenerate, setIsAutoGenerate] = useState(true);
  const [generateCount, setGenerateCount] = useState(1);
  
  // Staging State
  const [stagedItems, setStagedItems] = useState([]);
  
  const snInputRef = useRef(null);

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    // Focus the SN input automatically when scanning mode is active and model is selected
    if (selectedModelId && selectedProduct?.has_sn) {
      snInputRef.current?.focus();
    }
  }, [selectedModelId, inputType, selectedProduct]);

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/inventory/products');
      setProducts(res.data);
    } catch (err) {
      console.error('Failed to load products', err);
    }
  };

  const handleProductSearch = (e) => {
    const val = e.target.value;
    setProductSearchInput(val);
    const found = products.find(p => p.name === val);
    if (found) {
      setSelectedProductId(found.id);
      if (found.models && found.models.length > 0) {
        setSelectedModelId(found.models[0].id);
        setModelSearchInput(found.models[0].model_name);
      } else {
        setSelectedModelId('');
        setModelSearchInput('');
      }
    } else {
      setSelectedProductId('');
      setSelectedModelId('');
      setModelSearchInput('');
    }
  };

  const handleModelSearch = (e) => {
    const val = e.target.value;
    setModelSearchInput(val);
    if (selectedProduct) {
      const found = availableModels.find(m => m.model_name === val);
      if (found) {
        setSelectedModelId(found.id);
      } else {
        setSelectedModelId('');
      }
    }
  };

  const handleAddNewProduct = async () => {
    if (!productSearchInput.trim()) return;
    
    const result = await Swal.fire({
      title: 'เพิ่มสินค้าใหม่',
      html: `ต้องการเพิ่ม <b>${productSearchInput}</b> เข้าระบบหรือไม่?<br/><br/><b style="color:#042C53;">สินค้านี้มีการใช้ Serial Number (SN) หรือไม่?</b>`,
      icon: 'question',
      showDenyButton: true,
      showCancelButton: true,
      confirmButtonText: '✅ มี SN (ทีละชิ้น)',
      denyButtonText: '📦 ไม่มี SN (ระบุจำนวน)',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#185FA5',
      denyButtonColor: '#378ADD',
      cancelButtonColor: '#cbd5e1'
    });

    if (result.isDismissed) return; // User canceled
    
    const hasSn = result.isConfirmed;

    setLoading(true);
    try {
      await axios.post('/inventory/products', { name: productSearchInput, has_sn: hasSn });
      const res = await axios.get('/inventory/products');
      setProducts(res.data);
      const newProduct = res.data.find(p => p.name === productSearchInput);
      if (newProduct) {
        setSelectedProductId(newProduct.id);
        Swal.fire({ icon: 'success', title: 'เพิ่มสินค้าแล้ว', timer: 1000, showConfirmButton: false });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถเพิ่มสินค้าได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewModel = async () => {
    if (!selectedProductId || !modelSearchInput.trim()) return;
    setLoading(true);
    try {
      await axios.post('/inventory/models', { product_id: selectedProductId, model_name: modelSearchInput });
      const res = await axios.get('/inventory/products');
      setProducts(res.data);
      const updatedProduct = res.data.find(p => p.id === parseInt(selectedProductId));
      const newModel = updatedProduct?.models?.find(m => m.model_name === modelSearchInput);
      if (newModel) {
        setSelectedModelId(newModel.id);
        Swal.fire({ icon: 'success', title: 'เพิ่มโมเดลแล้ว', timer: 1000, showConfirmButton: false });
      }
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: 'ไม่สามารถเพิ่มโมเดลได้' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteProductClick = async () => {
    if (products.length === 0) {
      Swal.fire({ icon: 'info', title: 'ไม่มีสินค้าในระบบ' });
      return;
    }

    let selectedId = null;

    const cardsHtml = products.map(p => `
      <button 
        type="button" 
        class="swal2-confirm swal2-styled product-del-card" 
        data-id="${p.id}"
        style="width: 100%; text-align: left; background-color: #f8fafc; color: #042C53; border: 1px solid #cbd5e1; margin: 6px 0; padding: 16px; border-radius: 12px; font-weight: bold; font-size: 1rem; transition: all 0.2s;"
        onmouseover="this.style.borderColor='#e3342f'; this.style.backgroundColor='#fef2f2'; this.style.color='#e3342f';"
        onmouseout="this.style.borderColor='#cbd5e1'; this.style.backgroundColor='#f8fafc'; this.style.color='#042C53';"
      >
        🗑️ ${p.name}
      </button>
    `).join('');

    const { isConfirmed } = await Swal.fire({
      title: 'เลือกลบสินค้า',
      html: `<div style="max-height: 350px; overflow-y: auto; padding: 5px;">${cardsHtml}</div>`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'ยกเลิก',
      cancelButtonColor: '#94a3b8',
      didOpen: () => {
        const popup = Swal.getPopup();
        const btns = popup.querySelectorAll('.product-del-card');
        btns.forEach(btn => {
          btn.addEventListener('click', () => {
            selectedId = btn.getAttribute('data-id');
            Swal.clickConfirm();
          });
        });
      }
    });

    if (!isConfirmed || !selectedId) return;
    const idToDelete = selectedId;

    const productToDelete = products.find(p => p.id === parseInt(idToDelete));
    const linkedModels = productToDelete?.models || [];
    const modelNames = linkedModels.map(m => m.model_name).join(', ') || 'ไม่มีโมเดล';

    const confirmResult = await Swal.fire({
      title: 'ยืนยันการลบสินค้า',
      html: `คุณต้องการลบสินค้า <b style="color:#e3342f;">${productToDelete.name}</b> ใช่หรือไม่?<br/><br/><div style="text-align:left; background:#fef2f2; border:1px solid #fecaca; padding:10px; border-radius:8px; color:#991b1b;"><b style="color:#7f1d1d;">โมเดลที่จะถูกลบไปด้วย:</b><br/>${modelNames}</div>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#e3342f'
    });

    if (confirmResult.isConfirmed) {
      setLoading(true);
      try {
        await axios.delete(`/inventory/products/${idToDelete}`);
        Swal.fire({ icon: 'success', title: 'ลบสำเร็จ', text: 'ลบสินค้าและโมเดลเรียบร้อยแล้ว', timer: 1500, showConfirmButton: false });
        fetchProducts();
        if (selectedProductId === parseInt(idToDelete)) {
          setSelectedProductId('');
          setSelectedModelId('');
          setProductSearchInput('');
          setModelSearchInput('');
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ไม่สามารถลบได้', text: err.response?.data?.error || 'เกิดข้อผิดพลาด' });
      } finally {
        setLoading(false);
      }
    }
  };

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 1500,
    timerProgressBar: true,
  });

  const handleAddToStaging = (e, autoSn = null) => {
    if (e && e.preventDefault) e.preventDefault();
    
    if (!selectedProduct || !selectedModelId) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกสินค้าและโมเดล' });
      return;
    }

    let itemsToAdd = [];

    if (selectedProduct.has_sn) {
      // Use provided autoSn, or ref value, or state
      const currentInputValue = autoSn !== null ? autoSn : (snInputRef.current?.value.replace(/\D/g, '') || sn);
      const cleanSn = currentInputValue.trim();
      
      if (!cleanSn) return;

      if (cleanSn.length < 12) {
        Toast.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: 'รหัส SN ต้องมีอย่างน้อย 12 หลัก' });
        return;
      }

      // Check duplicate in staging
      const isDuplicate = stagedItems.some(item => item.sn === cleanSn && item.has_sn);
      if (isDuplicate) {
        Toast.fire({ icon: 'warning', title: 'รหัสซ้ำซ้อน', text: 'รหัส SN นี้อยู่ในรายการพักรอแล้ว' });
        setSn('');
        if (snInputRef.current) snInputRef.current.value = '';
        return;
      }

      itemsToAdd.push({
        id: Date.now() + Math.random(),
        product_name: selectedProduct.name,
        has_sn: true,
        model_id: selectedModelId,
        model_name: selectedModel.model_name,
        sn: cleanSn,
        quantity: 1,
        is_auto_generate: false,
        generate_count: 1
      });
      
      Toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
    } else {
      // No SN mode
      if (isAutoGenerate) {
        if (!generateCount || generateCount <= 0) return;
        itemsToAdd.push({
          id: Date.now() + Math.random(),
          product_name: selectedProduct.name,
          has_sn: false,
          model_id: selectedModelId,
          model_name: selectedModel.model_name,
          sn: '(ระบบจะสร้างอัตโนมัติ)',
          quantity: parseFloat(quantity) || 1,
          is_auto_generate: true,
          generate_count: parseInt(generateCount) || 1
        });
        Toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
      } else {
        const currentInputValue = autoSn !== null ? autoSn : (snInputRef.current?.value || sn);
        const cleanSn = currentInputValue.trim();
        if (!cleanSn) return;
        
        // Check duplicate in staging
        const isDuplicate = stagedItems.some(item => item.sn === cleanSn && !item.has_sn && !item.is_auto_generate);
        if (isDuplicate) {
          Toast.fire({ icon: 'warning', title: 'รหัสซ้ำซ้อน', text: 'รหัสสินค้านี้อยู่ในรายการพักรอแล้ว' });
          setSn('');
          if (snInputRef.current) snInputRef.current.value = '';
          return;
        }

        itemsToAdd.push({
          id: Date.now() + Math.random(),
          product_name: selectedProduct.name,
          has_sn: false,
          model_id: selectedModelId,
          model_name: selectedModel.model_name,
          sn: cleanSn,
          quantity: parseFloat(quantity) || 1,
          is_auto_generate: false,
          generate_count: 1
        });
        Toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
      }
    }

    setStagedItems(prev => [...prev, ...itemsToAdd]);
    
    // Reset inputs
    setSn('');
    if (snInputRef.current) snInputRef.current.value = '';
    setGenerateCount(1);
    
    setTimeout(() => snInputRef.current?.focus(), 50);
  };

  const handleSnChange = (e) => {
    // Keep only numbers
    const value = e.target.value.replace(/\D/g, '');
    setSn(value);
    
    // Auto-submit when exactly 12 digits are reached in scan mode
    if (inputType === 'scan' && value.length === 12) {
      handleAddToStaging(null, value);
    }
  };

  const handleSnKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddToStaging();
    }
  };

  const removeStagedItem = (id) => {
    setStagedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmAll = async () => {
    if (stagedItems.length === 0) return;

    // Group summary by product/model for the sweetalert
    const summaryMap = {};
    stagedItems.forEach(item => {
      const key = `${item.product_name} - ${item.model_name}`;
      if (!summaryMap[key]) summaryMap[key] = 0;
      summaryMap[key] += (item.is_auto_generate ? item.generate_count : 1);
    });
    
    const totalItems = Object.values(summaryMap).reduce((a, b) => a + b, 0);

    const receiptHtml = `
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06); position: relative; text-align: left;">
        <div style="text-align: center; margin-bottom: 16px; border-bottom: 2px dashed #cbd5e1; padding-bottom: 16px;">
          <div style="font-size: 2rem; margin-bottom: 8px;">🧾</div>
          <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #0f172a;">สรุปรายการนำเข้า</h3>
          <div style="font-size: 0.875rem; color: #64748b; margin-top: 4px;">ตรวจสอบรายการก่อนยืนยัน</div>
        </div>
        
        <div style="max-height: 250px; overflow-y: auto; margin-bottom: 16px; padding-right: 4px;">
          ${Object.entries(summaryMap).map(([name, count]) => `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; font-size: 0.95rem; color: #334155; border-bottom: 1px solid #f8fafc; padding-bottom: 8px;">
              <div style="padding-right: 16px; line-height: 1.4;">${name}</div>
              <div style="font-weight: 700; white-space: nowrap; color: #0f172a;">${count} ชิ้น</div>
            </div>
          `).join('')}
        </div>

        <div style="border-top: 2px dashed #cbd5e1; padding-top: 16px; display: flex; justify-content: space-between; font-weight: 900; font-size: 1.15rem; color: #185FA5;">
          <span>รวมทั้งสิ้น</span>
          <span>${totalItems} ชิ้น</span>
        </div>
      </div>
      <p style="margin-top: 16px; font-size: 0.85rem; color: #94a3b8;">นำเข้าข้อมูลจำนวน ${stagedItems.length} แถว (Record)</p>
    `;

    const result = await Swal.fire({
      html: receiptHtml,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการนำเข้า',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#94a3b8',
      width: '420px',
      customClass: {
        confirmButton: 'shadow-md',
      }
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    let successCount = 0;
    let failCount = 0;

    // Process sequentially to avoid overwhelming the server
    for (const item of stagedItems) {
      try {
        const payload = {
          model_id: item.model_id,
          sn: item.is_auto_generate ? '' : item.sn,
          quantity: item.quantity,
          is_auto_generate: item.is_auto_generate,
          generate_count: item.generate_count
        };
        await axios.post('/inventory/receive', payload);
        successCount++;
      } catch (err) {
        console.error('Error receiving item', item, err);
        failCount++;
      }
    }

    setLoading(false);
    
    if (failCount === 0) {
      Swal.fire({ icon: 'success', title: 'สำเร็จ', text: `นำเข้าสินค้าทั้งหมด ${successCount} รายการเรียบร้อยแล้ว` });
      setStagedItems([]);
    } else {
      Swal.fire({ icon: 'warning', title: 'สำเร็จบางส่วน', text: `นำเข้าสำเร็จ ${successCount} รายการ, ล้มเหลว ${failCount} รายการ (อาจเกิดจาก SN ซ้ำ)` });
      setStagedItems([]); 
    }
  };

  // ── Handle Excel import confirmed rows ───────────────────────────────────
  const handleExcelImportConfirm = async (validRows) => {
    // Convert excel rows to staged items format
    const newItems = validRows.map((row) => {
      const product = row.matchedProduct;
      const model = row.matchedModel;
      const hasSn = product?.has_sn;
      const cleanSn = row.sn.replace(/\D/g, '');

      return {
        id: Date.now() + Math.random(),
        product_name: product.name,
        has_sn: hasSn,
        model_id: model.id,
        model_name: model.model_name,
        sn: hasSn ? cleanSn : (row.sn || '(ระบบจะสร้างอัตโนมัติ)'),
        quantity: 1,
        is_auto_generate: hasSn ? false : !row.sn,
        generate_count: 1,
        _fromExcel: true,
      };
    });

    setStagedItems(prev => [...prev, ...newItems]);

    Toast.fire({
      icon: 'success',
      title: `เพิ่ม ${newItems.length} รายการจาก Excel ลงรายการพักรอแล้ว`,
    });
  };

  return (
    <>
      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        products={products}
        onConfirm={handleExcelImportConfirm}
      />

      <div className="animate-fade-in-up pb-24">
        <div className="max-w-4xl mx-auto space-y-6">
              
              {/* Step 1: Select Product & Model */}
              <div className="glass p-6 rounded-2xl shadow-sm border border-white/50">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                  <h2 className="text-lg font-bold text-[#042C53]">1. เลือกสินค้าที่จะนำเข้า</h2>
                  <div className="flex items-center gap-2">
                    {/* ── Excel Import Button ── */}
                    <button
                      type="button"
                      onClick={() => setShowExcelModal(true)}
                      className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-md shadow-emerald-600/20 hover:scale-[1.02] active:scale-95"
                      title="นำเข้าจากไฟล์ Excel"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Import Excel
                    </button>
                    <span className="text-sm font-bold text-[#185FA5] bg-[#E6F1FB] px-3 py-1 rounded-full">⚡ สแกนต่อเนื่องอัตโนมัติ</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-[#042C53] mb-2">ค้นหาสินค้า (พิมพ์ชื่อ)</label>
                    <div className="flex gap-2">
                      <input 
                        list="product-list"
                        value={productSearchInput}
                        onChange={handleProductSearch}
                        placeholder="พิมพ์เพื่อค้นหาสินค้า..."
                        className="flex-1 min-w-0 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-[#042C53] font-medium bg-white"
                      />
                      <datalist id="product-list">
                        {products.map(p => (
                          <option key={p.id} value={p.name} />
                        ))}
                      </datalist>
                      {!selectedProductId && productSearchInput.trim() && (
                        <button 
                          type="button" 
                          onClick={handleAddNewProduct}
                          className="bg-[#185FA5] hover:bg-[#0C447C] text-white px-4 py-3 rounded-xl font-bold whitespace-nowrap transition-colors shrink-0 shadow-sm"
                        >
                          + เพิ่มใหม่
                        </button>
                      )}
                      <button 
                        type="button"
                        onClick={handleDeleteProductClick}
                        className="bg-white hover:bg-red-50 text-red-500 px-4 py-3 rounded-xl border border-slate-300 hover:border-red-200 transition-colors shrink-0 flex items-center justify-center shadow-sm gap-2 font-bold"
                        title="ลบสินค้าออกจากระบบ"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        ลบสินค้า
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-[#042C53] mb-2">โมเดล (Model)</label>
                    <div className="flex gap-2">
                      <input 
                        list="model-list"
                        value={modelSearchInput}
                        onChange={handleModelSearch}
                        disabled={!selectedProductId}
                        placeholder={selectedProductId ? "พิมพ์เพื่อค้นหาหรือเพิ่มโมเดล..." : "กรุณาเลือกสินค้าก่อน"}
                        className="flex-1 min-w-0 px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none text-[#042C53] font-medium bg-white disabled:opacity-50 disabled:bg-slate-50"
                      />
                      <datalist id="model-list">
                        {availableModels.map(m => (
                          <option key={m.id} value={m.model_name} />
                        ))}
                      </datalist>
                      {selectedProductId && !selectedModelId && modelSearchInput.trim() && (
                        <button 
                          type="button" 
                          onClick={handleAddNewModel}
                          className="bg-[#185FA5] hover:bg-[#0C447C] text-white px-4 py-3 rounded-xl font-bold whitespace-nowrap transition-colors shrink-0 shadow-sm"
                        >
                          + เพิ่มโมเดล
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Receive Data */}
              {selectedProduct && selectedModelId && (
                <div className="glass p-6 rounded-2xl shadow-sm border border-white/50 animate-fade-in-up">
                  <h2 className="text-lg font-bold text-[#042C53] mb-4 border-b pb-2">2. ระบุข้อมูลนำเข้า</h2>
                  
                  {selectedProduct.has_sn ? (
                    // ----- HAS SN MODE -----
                    <div className="space-y-6">
                      <div className="flex gap-4 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
                        <button 
                          type="button"
                          onClick={() => { setInputType('scan'); setSn(''); snInputRef.current?.focus(); }}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${inputType === 'scan' ? 'bg-white text-[#185FA5] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-[#042C53]'}`}
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" /></svg>
                            โหมดสแกน
                          </span>
                        </button>
                        <button 
                          type="button"
                          onClick={() => { setInputType('type'); setSn(''); snInputRef.current?.focus(); }}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${inputType === 'type' ? 'bg-white text-[#185FA5] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-[#042C53]'}`}
                        >
                          <span className="flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            โหมดพิมพ์
                          </span>
                        </button>
                      </div>

                      <div className="flex flex-col gap-4">
                        <label className="block text-sm font-semibold text-[#042C53]">Serial Number (SN)</label>
                        <div className="flex gap-2">
                          <input 
                            ref={snInputRef}
                            type="text" 
                            value={sn}
                            onChange={handleSnChange}
                            onKeyDown={handleSnKeyDown}
                            placeholder={inputType === 'scan' ? 'ยิงบาร์โค้ดเลย ระบบจะเพิ่มลงตารางล่างอัตโนมัติ...' : 'พิมพ์ SN แล้วกด Enter เพื่อเพิ่มลงตารางล่าง...'}
                            className={`flex-1 min-w-0 px-4 py-4 border rounded-xl outline-none font-medium transition-all ${
                              inputType === 'scan' ? 'bg-[#E6F1FB] border-[#185FA5]/30 text-brand-800 focus:ring-2 focus:ring-brand-500' : 'bg-white border-slate-300 text-[#042C53] focus:ring-2 focus:ring-brand-500'
                            }`}
                            autoFocus
                          />
                          {inputType === 'type' && (
                            <button 
                              type="button" 
                              onClick={handleAddToStaging}
                              disabled={!sn.trim()}
                              className="bg-[#185FA5] hover:bg-[#0C447C] text-white font-bold px-6 py-4 rounded-xl disabled:opacity-50 transition-colors shrink-0"
                            >
                              เพิ่ม
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // ----- NO SN MODE -----
                    <div className="space-y-6">
                      <div className="flex gap-4 p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
                        <button 
                          type="button"
                          onClick={() => setIsAutoGenerate(true)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isAutoGenerate ? 'bg-white text-[#185FA5] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-[#042C53]'}`}
                        >
                          รันรหัสอัตโนมัติ
                        </button>
                        <button 
                          type="button"
                          onClick={() => setIsAutoGenerate(false)}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${!isAutoGenerate ? 'bg-white text-[#185FA5] shadow-sm border border-slate-200' : 'text-slate-500 hover:text-[#042C53]'}`}
                        >
                          กำหนดรหัสเอง
                        </button>
                      </div>

                      {isAutoGenerate ? (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-[#042C53] mb-2">จำนวนรายการที่ต้องการสร้าง</label>
                            <input 
                              type="number" min="1" 
                              value={generateCount} onChange={(e) => setGenerateCount(e.target.value)}
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-[#042C53] mb-2">จำนวน/รายการ (เช่น 100 เมตร)</label>
                            <input 
                              type="number" min="0.1" step="0.1" 
                              value={quantity} onChange={(e) => setQuantity(e.target.value)}
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-semibold text-[#042C53] mb-2">รหัสสินค้า</label>
                            <input 
                              type="text" 
                              value={sn} onChange={(e) => setSn(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddToStaging(); }}
                              placeholder="กรอกรหัสสินค้า..."
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-semibold text-[#042C53] mb-2">จำนวน/รายการ</label>
                            <input 
                              type="number" min="0.1" step="0.1" 
                              value={quantity} onChange={(e) => setQuantity(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddToStaging(); }}
                              className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white"
                            />
                          </div>
                        </div>
                      )}
                      
                      <button 
                        type="button" 
                        onClick={handleAddToStaging}
                        disabled={(!isAutoGenerate && !sn.trim())}
                        className="w-full bg-[#185FA5] hover:bg-[#0C447C] text-white font-bold px-8 py-3 rounded-xl disabled:opacity-50 mt-4 transition-colors"
                      >
                        เพิ่มลงรายการพักรอ
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Staging Area */}
              {stagedItems.length > 0 && (
                <div className="glass p-6 rounded-2xl shadow-sm border border-white/50 animate-fade-in-up">
                  <div className="flex justify-between items-end mb-4 border-b pb-2">
                    <div>
                      <h2 className="text-lg font-bold text-[#042C53]">3. รายการพักรอเข้าคลัง (Staging)</h2>
                      <p className="text-sm text-[#378ADD] mt-1">ตรวจสอบรายการก่อนกดยืนยันทั้งหมด</p>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-[#185FA5]">{stagedItems.length}</span>
                      <span className="text-sm text-[#042C53] ml-2">รายการ</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm whitespace-nowrap bg-white">
                      <thead className="bg-[#E6F1FB] text-[#042C53]">
                        <tr>
                          <th className="p-3 font-semibold border-b border-slate-200">สินค้า</th>
                          <th className="p-3 font-semibold border-b border-slate-200">โมเดล</th>
                          <th className="p-3 font-semibold border-b border-slate-200">SN / รหัส</th>
                          <th className="p-3 font-semibold border-b border-slate-200">จำนวน/รายการ</th>
                          <th className="p-3 font-semibold border-b border-slate-200 text-center">แหล่งที่มา</th>
                          <th className="p-3 font-semibold border-b border-slate-200 text-center">ลบ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stagedItems.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-[#042C53]">{item.product_name}</td>
                            <td className="p-3 text-[#378ADD]">{item.model_name}</td>
                            <td className="p-3 font-mono text-slate-700">
                              {item.sn}
                              {item.is_auto_generate && <span className="ml-2 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">Auto ({item.generate_count} items)</span>}
                            </td>
                            <td className="p-3 text-[#042C53]">{item.quantity}</td>
                            <td className="p-3 text-center">
                              {item._fromExcel ? (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">📄 Excel</span>
                              ) : (
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">✍️ Manual</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button 
                                type="button" 
                                onClick={() => removeStagedItem(item.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button 
                      onClick={handleConfirmAll}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-xl disabled:opacity-50 transition-colors shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                    >
                      {loading ? (
                        'กำลังประมวลผล...'
                      ) : (
                        <>
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ยืนยันการนำเข้าทั้งหมด ({stagedItems.length} รายการ)
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

        </div>
      </div>
    </>
  );
}
