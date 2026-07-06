import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import ExportModal from '../components/ExportModal';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
});

// ─── Excel Import Modal ──────────────────────────────────────────────────────
function ExcelImportModal({ isOpen, onClose, products, onConfirm }) {
  const [importRows, setImportRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [isChecking, setIsChecking] = useState(false);
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

  // Case-insensitive match to existing product
  const matchProduct = useCallback((name) => {
    if (!name) return null;
    return products.find(p => p.name.trim().toLowerCase() === String(name).trim().toLowerCase()) || null;
  }, [products]);

  // Case-insensitive match to existing model under a product
  const matchModel = useCallback((product, modelName) => {
    if (!product || !modelName) return null;
    return (product.models || []).find(m =>
      m.model_name.trim().toLowerCase() === String(modelName).trim().toLowerCase()
    ) || null;
  }, []);

  // Build validation for a row (only empty names are errors; unmatched = will auto-create)
  const buildRowMeta = (rawProduct, rawModel, rawSn, matchedProduct, matchedModel) => {
    const isNewProduct = !matchedProduct && !!rawProduct.trim();
    const isNewModel   = !!matchedProduct && !matchedModel && !!rawModel.trim();
    const willAutoCreate = false; // ปิดการสร้างใหม่อัตโนมัติในหน้า Excel Import ตามที่ผู้ใช้ต้องการ

    // Infer has_sn for NEW products from whether SN column has data
    const inferredHasSn = matchedProduct ? matchedProduct.has_sn : !!rawSn.trim();

    const errors = [];
    if (!rawProduct.trim()) errors.push('ไม่มีชื่อสินค้า');
    else if (!matchedProduct) errors.push('ไม่พบชื่อสินค้านี้ในระบบ');

    if (!rawModel.trim()) errors.push('ไม่มีชื่อโมเดล');
    else if (matchedProduct && !matchedModel) errors.push('ไม่พบชื่อโมเดลนี้ในระบบ');

    // SN required only when existing product.has_sn=true
    if (matchedProduct?.has_sn && !rawSn.trim()) errors.push('ไม่มี SN (สินค้านี้ต้องการ SN)');

    return { isNewProduct, isNewModel, willAutoCreate, inferredHasSn, errors };
  };

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
        // raw: true  → don't auto-parse numbers, keep cell values as-is
        // cellText: true → also read formatted text in case of custom number formats
        const workbook = XLSX.read(data, { type: 'array', raw: true, cellText: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // อ่านเป็น Array 2 มิติเพื่อค้นหาแถวที่เป็น Header จริงๆ
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

        if (rawData.length === 0) {
          setParseError('ไฟล์ Excel ว่างเปล่า หรือไม่มีข้อมูล');
          return;
        }

        // ค้นหาแถวที่มีโอกาสเป็น Header มากที่สุด (จาก 10 แถวแรก)
        let headerRowIndex = -1;
        let bestScore = 0;
        const keywords = ['product', 'สินค้า', 'ชื่อสินค้า', 'model', 'โมเดล', 'รุ่น', 'sn', 'serial', 'ซีเรียล', 'รหัส', 'barcode', 'เบอร์', 'phone', 'tel', 'เบอร์โทร'];

        for (let i = 0; i < Math.min(10, rawData.length); i++) {
          const rowArr = rawData[i].map(String);
          let score = 0;
          rowArr.forEach(cell => {
            const lowerCell = cell.toLowerCase().trim();
            if (keywords.some(kw => lowerCell.includes(kw))) score++;
          });
          if (score > bestScore) {
            bestScore = score;
            headerRowIndex = i;
          }
        }

        let headers = [];
        let dataRows = [];

        if (headerRowIndex !== -1) {
          headers = rawData[headerRowIndex].map(String);
          dataRows = rawData.slice(headerRowIndex + 1);
        } else {
          headers = [];
          dataRows = rawData;
        }

        // กรองแถวที่ว่างเปล่าออกไปเลย
        const validDataRows = dataRows.filter(row => row.some(cell => String(cell).trim() !== ''));

        const findKeyIdx = (...candidates) => {
          const idx = headers.findIndex(h => candidates.some(c => h.trim().toLowerCase().includes(c.toLowerCase())));
          return idx !== -1 ? idx : null;
        };

        const productIdx = findKeyIdx('product', 'สินค้า', 'ชื่อสินค้า', 'Product');
        const modelIdx   = findKeyIdx('model', 'โมเดล', 'รุ่น', 'Model');
        const snIdx      = findKeyIdx('sn', 'serial', 'ซีเรียล', 'SN', 'รหัส', 'barcode');
        const phoneIdx   = findKeyIdx('เบอร์', 'phone', 'tel', 'เบอร์โทร');

        if (productIdx === null && modelIdx === null && snIdx === null) {
          const displayHeaders = headers.filter(h => h.trim() && !h.includes('__EMPTY'));
          setParseError(
            `⚠️ คำเตือน: ไม่พบคอลัมน์ที่รู้จักเลย\nคอลัมน์ที่พบในไฟล์: ${displayHeaders.join(', ') || 'ไม่พบหัวคอลัมน์'}\n\n(ระบบข้ามการอ่านคอลัมน์เหล่านี้ และสร้างแถวว่างเพื่อให้คุณกรอกข้อมูลเองตามจำนวนแถวในไฟล์)`
          );
        }

        const rows = validDataRows.map((row, idx) => {
          const rawProduct = productIdx !== null ? String(row[productIdx] ?? '').trim() : '';
          const rawModel   = modelIdx !== null   ? String(row[modelIdx]   ?? '').trim() : '';
          const rawSn      = snIdx !== null      ? String(row[snIdx]      ?? '').trim() : '';
          const rawPhone   = phoneIdx !== null   ? String(row[phoneIdx]   ?? '').trim() : '';

          const matchedProduct = matchProduct(rawProduct);
          const matchedModel   = matchedProduct ? matchModel(matchedProduct, rawModel) : null;
          const meta = buildRowMeta(rawProduct, rawModel, rawSn, matchedProduct, matchedModel);

          return {
            _rowNum: (headerRowIndex !== -1 ? headerRowIndex + 2 : 1) + idx,
            _id: `excel-${idx}-${Date.now()}`,
            rawProduct, rawModel, rawSn, rawPhone,
            matchedProduct, matchedModel,
            product_name: rawProduct,
            model_name: rawModel,
            sn: rawSn,
            phone_number: rawPhone,
            ...meta,
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

      const mp = field === 'product_name' ? matchProduct(value) : row.matchedProduct;
      const mm = field === 'model_name'
        ? matchModel(mp, value)
        : (field === 'product_name' ? null : row.matchedModel);

      const meta = buildRowMeta(updated.product_name, updated.model_name, updated.sn, mp, mm);

      return { ...updated, matchedProduct: mp, matchedModel: mm, ...meta };
    }));
  };

  const removeRow = (id) => {
    setImportRows(prev => prev.filter(r => r._id !== id));
  };

  const validRows  = importRows.filter(r => r.errors.length === 0);
  const errorRows  = importRows.filter(r => r.errors.length > 0);
  const newRows    = validRows.filter(r => r.willAutoCreate);
  const existRows  = validRows.filter(r => !r.willAutoCreate);

  // ── Confirm: SN duplicate check → then pass to parent ───────────────────
  const handleConfirm = async () => {
    if (validRows.length === 0) {
      Swal.fire({ icon: 'warning', title: 'ไม่มีแถวที่ถูกต้อง', text: 'กรุณาแก้ไขข้อมูลก่อนยืนยัน' });
      return;
    }

    if (errorRows.length > 0) {
      const confirmProceed = await Swal.fire({
        icon: 'warning',
        title: 'พบข้อมูลมีปัญหา',
        html: `มีข้อมูลที่อ่านไม่ได้หรือมีปัญหาจำนวน <b>${errorRows.length}</b> รายการ<br><br>ต้องการ <b>ตัดรายการที่มีปัญหาออก</b> แล้วนำเข้าเฉพาะรายการที่ถูกต้องหรือไม่?`,
        showCancelButton: true,
        confirmButtonText: 'ตัดออกและนำเข้าต่อ',
        cancelButtonText: 'ยกเลิก (เพื่อกลับไปแก้ไข)',
        confirmButtonColor: '#185FA5',
        cancelButtonColor: '#94a3b8'
      });

      if (!confirmProceed.isConfirmed) {
        return;
      }
    }

    // Collect SNs that are non-empty (for any product; new products inferred has_sn from rawSn)
    const snsToCheck = validRows
      .map(r => r.sn.trim())
      .filter(Boolean);

    let finalRows = validRows;

    if (snsToCheck.length > 0) {
      setIsChecking(true);
      try {
        const res = await axios.post('/inventory/check-sn-duplicates', { sns: snsToCheck });
        const duplicates = res.data.duplicates || [];
        setIsChecking(false);

        if (duplicates.length > 0) {
          const dupListHtml = duplicates.map(d =>
            `<div style="display:flex;gap:12px;align-items:flex-start;padding:8px 0;border-bottom:1px solid #fecaca;">
               <span style="font-family:monospace;font-weight:700;color:#b91c1c;background:#fee2e2;padding:2px 8px;border-radius:6px;white-space:nowrap;">${d.sn}</span>
               <span style="color:#64748b;font-size:0.85rem;">${d.product_name} / <b>${d.model_name}</b></span>
             </div>`
          ).join('');

          const result = await Swal.fire({
            title: `⚠️ พบ SN ซ้ำ ${duplicates.length} รายการ`,
            html: `
              <p style="color:#64748b;margin-bottom:12px;font-size:0.9rem;">SN ต่อไปนี้มีอยู่ในระบบแล้ว:</p>
              <div style="max-height:240px;overflow-y:auto;text-align:left;padding:0 4px;">
                ${dupListHtml}
              </div>
              <p style="margin-top:16px;font-size:0.88rem;color:#64748b;">ต้องการ <b>ข้ามรายการที่ซ้ำ</b> และนำเข้าส่วนที่เหลือ?</p>
            `,
            showCancelButton: true,
            confirmButtonText: `ข้ามที่ซ้ำ (${duplicates.length}) และนำเข้าต่อ`,
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#185FA5',
            cancelButtonColor: '#94a3b8',
            width: '480px',
          });

          if (!result.isConfirmed) return;

          // Remove duplicate rows from finalRows
          const dupSnSet = new Set(duplicates.map(d => d.sn));
          finalRows = validRows.filter(r => !dupSnSet.has(r.sn.trim()));

          if (finalRows.length === 0) {
            Swal.fire({ icon: 'info', title: 'ไม่มีรายการที่จะนำเข้า', text: 'รายการทั้งหมดซ้ำกับข้อมูลในระบบ' });
            return;
          }
        }
      } catch (err) {
        setIsChecking(false);
        console.error('SN check failed', err);
        // Continue without SN check on network error
      }
    }

    onConfirm(finalRows);
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
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
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

          {/* Legend */}
          {importRows.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg font-bold">
                <span>✅</span> พบในระบบ — เพิ่มได้ทันที ({existRows.length})
              </span>
              <span className="flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg font-bold">
                <span>🆕</span> ไม่พบในระบบ — จะสร้างอัตโนมัติ ({newRows.length})
              </span>
              {errorRows.length > 0 && (
                <span className="flex items-center gap-1.5 bg-red-100 text-red-700 px-3 py-1.5 rounded-lg font-bold">
                  <span>⚠️</span> มีปัญหา — ไม่นำเข้า ({errorRows.length})
                </span>
              )}
            </div>
          )}

          {/* Summary Badges */}
          {importRows.length > 0 && (
            <div className="flex flex-wrap gap-3">
              <span className="bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-bold text-sm">
                📊 รวม {importRows.length} แถว
              </span>
              <span className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-bold text-sm">
                ✅ นำเข้าได้ {validRows.length} แถว
              </span>
              {errorRows.length > 0 && (
                <span className="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-bold text-sm">
                  ⚠️ มีปัญหา {errorRows.length} แถว
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
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">เบอร์โทร</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">สถานะ</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">ลบ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((row) => {
                      const hasError = row.errors.length > 0;
                      const rowBg = hasError ? 'bg-red-50' : row.willAutoCreate ? 'bg-blue-50/40' : 'bg-white hover:bg-slate-50';
                      return (
                        <tr key={row._id} className={`border-b border-slate-100 transition-colors ${rowBg}`}>
                          <td className="px-4 py-3 text-slate-400 text-xs">{row._rowNum}</td>

                          {/* Product Name */}
                          <td className="px-4 py-2 min-w-[160px]">
                            <input
                              list={`product-list-excel-${row._id}`}
                              value={row.product_name}
                              onChange={(e) => updateRow(row._id, 'product_name', e.target.value)}
                              className={`w-full px-3 py-1.5 rounded-lg border text-sm font-medium outline-none focus:ring-2 focus:ring-[#185FA5] ${
                                !row.product_name.trim() ? 'border-red-300 bg-red-50 text-red-700'
                                : row.matchedProduct ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border-blue-300 bg-blue-50 text-blue-800'
                              }`}
                              placeholder="ชื่อสินค้า"
                            />
                            <datalist id={`product-list-excel-${row._id}`}>
                              {products.map(p => <option key={p.id} value={p.name} />)}
                            </datalist>
                            {row.isNewProduct && (
                              <span className="text-[10px] text-blue-600 font-bold mt-0.5 block">🆕 จะสร้างใหม่</span>
                            )}
                          </td>

                          {/* Model Name */}
                          <td className="px-4 py-2 min-w-[160px]">
                            <input
                              list={`model-list-excel-${row._id}`}
                              value={row.model_name}
                              onChange={(e) => updateRow(row._id, 'model_name', e.target.value)}
                              className={`w-full px-3 py-1.5 rounded-lg border text-sm font-medium outline-none focus:ring-2 focus:ring-[#185FA5] ${
                                !row.model_name.trim() ? 'border-red-300 bg-red-50 text-red-700'
                                : row.matchedModel ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                                : 'border-blue-300 bg-blue-50 text-blue-800'
                              }`}
                              placeholder="โมเดล"
                            />
                            <datalist id={`model-list-excel-${row._id}`}>
                              {(row.matchedProduct?.models || []).map(m => <option key={m.id} value={m.model_name} />)}
                            </datalist>
                            {row.isNewModel && (
                              <span className="text-[10px] text-blue-600 font-bold mt-0.5 block">🆕 จะสร้างโมเดลใหม่</span>
                            )}
                          </td>

                          {/* SN */}
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

                          {/* Phone Column */}
                          <td className="py-2.5 px-3 border-b border-slate-100">
                            <input
                              type="text"
                              value={row.phone_number || ''}
                              onChange={(e) => updateRow(row._id, 'phone_number', e.target.value)}
                              className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white"
                              placeholder="081xxx"
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
                            ) : row.willAutoCreate ? (
                              <span className="text-blue-700 font-bold text-xs bg-blue-100 px-2 py-1 rounded-lg">🆕 สร้างใหม่</span>
                            ) : (
                              <span className="text-emerald-700 font-bold text-xs bg-emerald-100 px-2 py-1 rounded-lg">✅ พบในระบบ</span>
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
                {newRows.length > 0 && <span className="text-blue-600"> (สร้างใหม่ {newRows.length})</span>}
                {errorRows.length > 0 && <span className="text-red-500"> — ข้าม {errorRows.length}</span>}
              </span>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              disabled={validRows.length === 0 || isChecking}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-8 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-emerald-600/20"
            >
              {isChecking ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  กำลังตรวจ SN...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  ยืนยันนำเข้า {validRows.length > 0 ? `(${validRows.length} รายการ)` : ''}
                </>
              )}
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
  const [showExportModal, setShowExportModal] = useState(false);
  
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
  const [inputType, setInputType] = useState('scan');
  const [sn, setSn] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [receiveMode, setReceiveMode] = useState('unit');
  const [receiveCrates, setReceiveCrates] = useState(1);
  const [isAutoGenerate, setIsAutoGenerate] = useState(true);
  const [generateCount, setGenerateCount] = useState(1);
  
  // Staging State
  const [stagedItems, setStagedItems] = useState([]);
  
  const snInputRef = useRef(null);

  const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedModelId && selectedProduct?.has_sn) {
      snInputRef.current?.focus();
    }
  }, [selectedModelId, inputType, selectedProduct]);

  const fetchProducts = async () => {
    try {
      const res = await axios.get('/inventory/products');
      setProducts(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to load products', err);
      return [];
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

    if (result.isDismissed) return;
    const hasSn = result.isConfirmed;

    // ถามหน่วยนับ (เฉพาะไม่มี SN) และจำนวนต่อลัง (ทั้ง SN และไม่มี SN)
    let unit = 'ชิ้น';
    let piecesPerCrate = null;
    let crateUnit = 'ลัง';

    if (!hasSn) {
      // ไม่มี SN → ถามหน่วยนับ + จำนวนต่อลัง
      const unitResult = await Swal.fire({
        title: 'ตั้งค่าหน่วยนับ',
        html: `
          <div style="text-align:left;font-size:14px;">
            <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">หน่วยนับสินค้า</label>
            <input id="swal-unit" list="unit-options" class="swal2-input" placeholder="พิมพ์หรือเลือกหน่วยนับ..." style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;" value="ชิ้น" />
            <datalist id="unit-options">
              <option value="ชิ้น"></option>
              <option value="ตัว"></option>
              <option value="กล่อง"></option>
              <option value="อัน"></option>
              <option value="เมตร"></option>
              <option value="ม้วน"></option>
              <option value="ชุด"></option>
              <option value="แผ่น"></option>
            </datalist>
            <div style="margin-top:16px;display:flex;gap:12px;">
              <div style="flex:1;">
                <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">จำนวนย่อยต่อ 1 กลุ่ม</label>
                <input id="swal-ppc" type="number" min="1" placeholder="เช่น 12" class="swal2-input" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;" />
              </div>
              <div style="flex:1;">
                <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">คำเรียกกลุ่ม (ลัง, ม้วน)</label>
                <input id="swal-crate-unit" type="text" list="crate-unit-options" class="swal2-input" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;" value="ลัง" />
                <datalist id="crate-unit-options">
                  <option value="ลัง"></option>
                  <option value="ม้วน"></option>
                  <option value="กล่อง"></option>
                  <option value="แพ็ค"></option>
                  <option value="โหล"></option>
                </datalist>
              </div>
            </div>
            <p style="color:#9CA3AF;font-size:12px;margin-top:6px;font-weight:500;">(เว้นว่างจำนวนย่อย หากไม่ต้องการจัดกลุ่ม)</p>
          </div>
        `,
        confirmButtonText: 'ยืนยัน',
        confirmButtonColor: '#185FA5',
        showCancelButton: true,
        cancelButtonText: 'ข้าม (ใช้ค่าเริ่มต้น)',
        cancelButtonColor: '#9CA3AF',
        preConfirm: () => {
          return {
            unit: document.getElementById('swal-unit').value,
            ppc: document.getElementById('swal-ppc').value,
            crate_unit: document.getElementById('swal-crate-unit').value
          };
        }
      });

      if (unitResult.isConfirmed && unitResult.value) {
        unit = unitResult.value.unit || 'ชิ้น';
        piecesPerCrate = unitResult.value.ppc ? parseInt(unitResult.value.ppc) : null;
        crateUnit = unitResult.value.crate_unit || 'ลัง';
      }
    } else {
      // มี SN → หน่วยเป็นชิ้นเสมอ แต่กำหนดลังได้ (optional)
      const crateResult = await Swal.fire({
        title: 'ตั้งค่าจำนวนต่อลัง',
        html: `
          <div style="text-align:left;font-size:14px;">
            <p style="color:#6B7280;margin-bottom:12px;">สินค้ามี SN → หน่วยเป็น <b>"ชิ้น"</b> เสมอ</p>
            <div style="display:flex;gap:12px;margin-bottom:6px;">
              <div style="flex:1;">
                <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">จำนวนย่อยต่อ 1 กลุ่ม</label>
                <input id="swal-ppc" type="number" min="1" placeholder="เช่น 12" class="swal2-input" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;" />
              </div>
              <div style="flex:1;">
                <label style="font-weight:700;color:#042C53;display:block;margin-bottom:6px;">คำเรียกกลุ่ม (ลัง, ม้วน)</label>
                <input id="swal-crate-unit" type="text" list="crate-unit-options" class="swal2-input" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:12px;font-size:14px;font-weight:600;margin:0;" value="ลัง" />
              </div>
            </div>
            <p style="color:#9CA3AF;font-size:12px;margin-top:6px;font-weight:500;">(เว้นว่างจำนวนย่อย หากไม่ต้องการจัดกลุ่ม)</p>
          </div>
        `,
        confirmButtonText: 'ยืนยัน',
        confirmButtonColor: '#185FA5',
        showCancelButton: true,
        cancelButtonText: 'ข้าม',
        cancelButtonColor: '#9CA3AF',
        preConfirm: () => {
          return {
            ppc: document.getElementById('swal-ppc').value,
            crate_unit: document.getElementById('swal-crate-unit').value
          };
        }
      });

      if (crateResult.isConfirmed && crateResult.value) {
        piecesPerCrate = crateResult.value.ppc ? parseInt(crateResult.value.ppc) : null;
        crateUnit = crateResult.value.crate_unit || 'ลัง';
      }
    }

    setLoading(true);
    try {
      await axios.post('/inventory/products', { 
        name: productSearchInput, 
        has_sn: hasSn,
        unit,
        pieces_per_crate: piecesPerCrate,
        crate_unit: crateUnit
      });
      const res = await axios.get('/inventory/products');
      setProducts(res.data);
      const newProduct = res.data.find(p => p.name === productSearchInput);
      if (newProduct) {
        setSelectedProductId(newProduct.id);
        Swal.fire({ icon: 'success', title: 'เพิ่มสินค้าแล้ว', timer: 1000, showConfirmButton: false });
      }
    } catch (err) {
      console.error('Add product error:', err);
      Swal.fire({ 
        icon: 'error', 
        title: 'เกิดข้อผิดพลาด', 
        text: err.response?.data?.error || err.response?.data?.details || err.message || 'ไม่สามารถเพิ่มสินค้าได้' 
      });
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
      <button type="button" class="swal2-confirm swal2-styled product-del-card" data-id="${p.id}"
        style="width:100%;text-align:left;background-color:#f8fafc;color:#042C53;border:1px solid #cbd5e1;margin:6px 0;padding:16px;border-radius:12px;font-weight:bold;font-size:1rem;transition:all 0.2s;"
        onmouseover="this.style.borderColor='#e3342f';this.style.backgroundColor='#fef2f2';this.style.color='#e3342f';"
        onmouseout="this.style.borderColor='#cbd5e1';this.style.backgroundColor='#f8fafc';this.style.color='#042C53';"
      >🗑️ ${p.name}</button>
    `).join('');

    const { isConfirmed } = await Swal.fire({
      title: 'เลือกลบสินค้า',
      html: `<div style="max-height:350px;overflow-y:auto;padding:5px;">${cardsHtml}</div>`,
      showConfirmButton: false,
      showCancelButton: true,
      cancelButtonText: 'ยกเลิก',
      cancelButtonColor: '#94a3b8',
      didOpen: () => {
        const popup = Swal.getPopup();
        popup.querySelectorAll('.product-del-card').forEach(btn => {
          btn.addEventListener('click', () => { selectedId = btn.getAttribute('data-id'); Swal.clickConfirm(); });
        });
      }
    });

    if (!isConfirmed || !selectedId) return;
    const idToDelete = selectedId;
    const productToDelete = products.find(p => p.id === parseInt(idToDelete));
    const modelNames = (productToDelete?.models || []).map(m => m.model_name).join(', ') || 'ไม่มีโมเดล';

    const confirmResult = await Swal.fire({
      title: 'ยืนยันการลบสินค้า',
      html: `คุณต้องการลบสินค้า <b style="color:#e3342f;">${productToDelete.name}</b> ใช่หรือไม่?<br/><br/><div style="text-align:left;background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:8px;color:#991b1b;"><b style="color:#7f1d1d;">โมเดลที่จะถูกลบไปด้วย:</b><br/>${modelNames}</div>`,
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
          setSelectedProductId(''); setSelectedModelId('');
          setProductSearchInput(''); setModelSearchInput('');
        }
      } catch (err) {
        Swal.fire({ icon: 'error', title: 'ไม่สามารถลบได้', text: err.response?.data?.error || 'เกิดข้อผิดพลาด' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleAddToStaging = (e, autoSn = null) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!selectedProduct || !selectedModelId) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกสินค้าและโมเดล' });
      return;
    }

    let itemsToAdd = [];

    if (selectedProduct.has_sn) {
      const currentInputValue = autoSn !== null ? autoSn : (snInputRef.current?.value.replace(/\D/g, '') || sn);
      const cleanSn = currentInputValue.trim();
      if (!cleanSn) return;
      if (cleanSn.length < 12) {
        Toast.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: 'รหัส SN ต้องมีอย่างน้อย 12 หลัก' });
        return;
      }
      const isDuplicate = stagedItems.some(item => item.sn === cleanSn && item.has_sn);
      if (isDuplicate) {
        Toast.fire({ icon: 'warning', title: 'รหัสซ้ำซ้อน', text: 'รหัส SN นี้อยู่ในรายการพักรอแล้ว' });
        setSn(''); if (snInputRef.current) snInputRef.current.value = ''; return;
      }
      itemsToAdd.push({ id: crypto.randomUUID(), product_name: selectedProduct.name, has_sn: true, model_id: selectedModelId, model_name: selectedModel.model_name, sn: cleanSn, quantity: 1, is_auto_generate: false, generate_count: 1 });
      Toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
    } else {
      if (isAutoGenerate) {
        if (!generateCount || generateCount <= 0) return;
        itemsToAdd.push({ id: crypto.randomUUID(), product_name: selectedProduct.name, has_sn: false, model_id: selectedModelId, model_name: selectedModel.model_name, sn: '(ระบบจะสร้างอัตโนมัติ)', quantity: parseFloat(quantity) || 1, is_auto_generate: true, generate_count: parseInt(generateCount) || 1 });
        Toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
      } else {
        const currentInputValue = autoSn !== null ? autoSn : (snInputRef.current?.value || sn);
        const cleanSn = currentInputValue.trim();
        if (!cleanSn) return;
        const isDuplicate = stagedItems.some(item => item.sn === cleanSn && !item.has_sn && !item.is_auto_generate);
        if (isDuplicate) {
          Toast.fire({ icon: 'warning', title: 'รหัสซ้ำซ้อน', text: 'รหัสสินค้านี้อยู่ในรายการพักรอแล้ว' });
          setSn(''); if (snInputRef.current) snInputRef.current.value = ''; return;
        }
        itemsToAdd.push({ id: crypto.randomUUID(), product_name: selectedProduct.name, has_sn: false, model_id: selectedModelId, model_name: selectedModel.model_name, sn: cleanSn, quantity: parseFloat(quantity) || 1, is_auto_generate: false, generate_count: 1 });
        Toast.fire({ icon: 'success', title: 'บันทึกสำเร็จ' });
      }
    }

    setStagedItems(prev => [...prev, ...itemsToAdd]);
    setSn(''); if (snInputRef.current) snInputRef.current.value = '';
    setGenerateCount(1);
    setTimeout(() => snInputRef.current?.focus(), 50);
  };

  const handleSnChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    setSn(value);
    if (inputType === 'scan' && value.length === 12) handleAddToStaging(null, value);
  };

  const handleSnKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAddToStaging(); }
  };

  const removeStagedItem = (id) => {
    setStagedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleConfirmAll = async () => {
    if (stagedItems.length === 0) return;

    const summaryMap = {};
    stagedItems.forEach(item => {
      const key = `${item.product_name} - ${item.model_name}`;
      if (!summaryMap[key]) summaryMap[key] = 0;
      summaryMap[key] += (item.is_auto_generate ? item.generate_count : 1);
    });
    const totalItems = Object.values(summaryMap).reduce((a, b) => a + b, 0);

    const receiptHtml = `
      <div style="background:#ffffff;padding:24px;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);text-align:left;">
        <div style="text-align:center;margin-bottom:16px;border-bottom:2px dashed #cbd5e1;padding-bottom:16px;">
          <div style="font-size:2rem;margin-bottom:8px;">🧾</div>
          <h3 style="margin:0;font-size:1.25rem;font-weight:800;color:#0f172a;">สรุปรายการนำเข้า</h3>
          <div style="font-size:0.875rem;color:#64748b;margin-top:4px;">ตรวจสอบรายการก่อนยืนยัน</div>
        </div>
        <div style="max-height:250px;overflow-y:auto;margin-bottom:16px;padding-right:4px;">
          ${Object.entries(summaryMap).map(([name, count]) => `
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;font-size:0.95rem;color:#334155;border-bottom:1px solid #f8fafc;padding-bottom:8px;">
              <div style="padding-right:16px;line-height:1.4;">${name}</div>
              <div style="font-weight:700;white-space:nowrap;color:#0f172a;">${count} ชิ้น</div>
            </div>
          `).join('')}
        </div>
        <div style="border-top:2px dashed #cbd5e1;padding-top:16px;display:flex;justify-content:space-between;font-weight:900;font-size:1.15rem;color:#185FA5;">
          <span>รวมทั้งสิ้น</span><span>${totalItems} ชิ้น</span>
        </div>
      </div>
      <p style="margin-top:16px;font-size:0.85rem;color:#94a3b8;">นำเข้าข้อมูลจำนวน ${stagedItems.length} แถว (Record)</p>
    `;

    const result = await Swal.fire({
      html: receiptHtml,
      showCancelButton: true,
      confirmButtonText: 'ยืนยันการนำเข้า',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#94a3b8',
      width: '420px',
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    let successCount = 0, failCount = 0;

    for (const item of stagedItems) {
      try {
        await axios.post('/inventory/receive', {
          model_id: item.model_id,
          sn: item.sn,
          phone_number: item.phone_number,
          quantity: item.quantity,
          is_auto_generate: item.is_auto_generate,
          generate_count: item.generate_count
        });
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

  // ── Handle Excel import confirmed rows ──────────────────────────────────
  // Auto-create products/models if not found, then add to staging
  const handleExcelImportConfirm = async (validRows) => {
    setLoading(true);
    
    // Show progress popup because 300+ items can take a few seconds
    Swal.fire({
      title: 'กำลังประมวลผลข้อมูล',
      text: `กำลังเตรียมข้อมูล ${validRows.length} แถว กรุณารอสักครู่...`,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const newItems = [];
    let createdCount = 0;
    let skipCount = 0;

    // Get fresh product list
    let allProducts = await fetchProducts();

    for (const row of validRows) {
      try {
        // ── Find or Create Product ──────────────────────────────────
        let product = allProducts.find(p =>
          p.name.trim().toLowerCase() === row.product_name.trim().toLowerCase()
        );

        if (!product) {
          // Infer has_sn: if SN column has data → has_sn=true, else false
          const inferredHasSn = !!row.sn?.trim();
          await axios.post('/inventory/products', { name: row.product_name.trim(), has_sn: inferredHasSn });
          allProducts = await fetchProducts();
          product = allProducts.find(p =>
            p.name.trim().toLowerCase() === row.product_name.trim().toLowerCase()
          );
          createdCount++;
        }

        if (!product) { skipCount++; continue; }

        // ── Find or Create Model ────────────────────────────────────
        let model = (product.models || []).find(m =>
          m.model_name.trim().toLowerCase() === row.model_name.trim().toLowerCase()
        );

        if (!model) {
          await axios.post('/inventory/models', { product_id: product.id, model_name: row.model_name.trim() });
          allProducts = await fetchProducts();
          const updProduct = allProducts.find(p => p.id === product.id);
          model = (updProduct?.models || []).find(m =>
            m.model_name.trim().toLowerCase() === row.model_name.trim().toLowerCase()
          );
          product = updProduct;
          createdCount++;
        }

        if (!model) { skipCount++; continue; }

        // ── Build staging item ──────────────────────────────────────
        const hasSn = product.has_sn;
        // Keep full SN string — do NOT strip non-digit chars (SN may contain letters like ZTEGDD20ADB9)
        const cleanSn = row.sn.trim();
        const cleanPhone = row.phone_number ? row.phone_number.trim() : '';
        newItems.push({
          id: crypto.randomUUID(),
          product_name: product.name,
          has_sn: hasSn,
          model_id: model.id,
          model_name: model.model_name,
          sn: cleanSn || '(ระบบจะสร้างอัตโนมัติ)',
          phone_number: cleanPhone,
          quantity: 1,
          is_auto_generate: !hasSn && !cleanSn,
          generate_count: 1,
          _fromExcel: true,
        });

      } catch (err) {
        console.error('Error processing Excel row', row, err);
        skipCount++;
      }
    }

    setLoading(false);
    Swal.close();
    Swal.close();
    setStagedItems(prev => [...prev, ...newItems]);

    let msg = `เพิ่ม ${newItems.length} รายการลงพักรอแล้ว`;
    if (createdCount > 0) msg = `สร้างสินค้า/โมเดลใหม่ ${createdCount} รายการ · ` + msg;
    if (skipCount > 0) msg += ` · ข้าม ${skipCount} รายการ`;

    Toast.fire({
      icon: createdCount > 0 ? 'info' : 'success',
      title: msg,
      timer: 3500,
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

      <div className="pb-24">
        <div className="space-y-6">

              {/* Step 1: Select Product & Model */}
              <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8">
                <div className="flex justify-between items-center mb-6 border-b border-[#E5E7EB] pb-4">
                  <h2 className="text-xl font-black text-[#1F2937]">1. เลือกสินค้าที่จะนำเข้า</h2>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowExcelModal(true)}
                      className="flex items-center gap-2 bg-[#1F2937] hover:bg-[#374151] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_4px_15px_rgba(31,41,55,0.2)] hover:scale-[1.02] active:scale-95"
                      title="นำเข้าจากไฟล์ Excel"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Import Excel
                    </button>

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
                        {products.map(p => <option key={p.id} value={p.name} />)}
                      </datalist>
                      {!selectedProductId && productSearchInput.trim() && (
                        <button type="button" onClick={handleAddNewProduct}
                          className="bg-[#185FA5] hover:bg-[#0C447C] text-white px-4 py-3 rounded-xl font-bold whitespace-nowrap transition-colors shrink-0 shadow-sm">
                          + เพิ่มใหม่
                        </button>
                      )}
                      <button type="button" onClick={handleDeleteProductClick}
                        className="bg-white hover:bg-red-50 text-red-500 px-4 py-3 rounded-xl border border-slate-300 hover:border-red-200 transition-colors shrink-0 flex items-center justify-center shadow-sm gap-2 font-bold"
                        title="ลบสินค้าออกจากระบบ">
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
                        {availableModels.map(m => <option key={m.id} value={m.model_name} />)}
                      </datalist>
                      {selectedProductId && !selectedModelId && modelSearchInput.trim() && (
                        <button type="button" onClick={handleAddNewModel}
                          className="bg-[#185FA5] hover:bg-[#0C447C] text-white px-4 py-3 rounded-xl font-bold whitespace-nowrap transition-colors shrink-0 shadow-sm">
                          + เพิ่มโมเดล
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 2: Receive Data */}
              {selectedProduct && selectedModelId && (
                <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8 animate-[slideUp_0.3s_ease-out]">
                  <h2 className="text-xl font-black text-[#1F2937] mb-6 border-b border-[#E5E7EB] pb-4">2. ใส่จำนวน หรือ สแกนรหัส</h2>
                  
                  {selectedProduct.has_sn ? (
                    <div className="space-y-6">
                      <div className="flex flex-col gap-4">
                        <label className="block text-sm font-semibold text-[#042C53]">สแกนบาร์โค้ด หรือ พิมพ์รหัส SN (กด Enter)</label>
                        <div className="flex gap-2">
                          <input ref={snInputRef} type="text" value={sn} onChange={handleSnChange} onKeyDown={handleSnKeyDown}
                            placeholder="สแกน หรือ พิมพ์รหัส SN..."
                            className="flex-1 min-w-0 px-5 py-4 border-2 border-[#E5E7EB] rounded-2xl outline-none font-black text-[#1F2937] bg-[#F9FAFB] focus:border-[#A3E635] focus:ring-4 focus:ring-[#A3E635]/20 transition-all tracking-wide"
                            autoFocus />
                          <button type="button" onClick={handleAddToStaging} disabled={!sn.trim()}
                            className="bg-[#1F2937] hover:bg-[#374151] text-white font-black px-6 py-4 rounded-2xl disabled:opacity-50 transition-all shadow-[0_4px_15px_rgba(31,41,55,0.2)] hover:scale-[1.02] active:scale-95 shrink-0">
                            ➕ เพิ่ม
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="flex gap-4 p-1 bg-[#F3F4F6] rounded-xl w-fit border border-[#E5E7EB]">
                        <button type="button" onClick={() => setIsAutoGenerate(true)}
                          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${isAutoGenerate ? 'bg-white text-[#1F2937] shadow-sm border border-[#E5E7EB]' : 'text-slate-500 hover:text-[#1F2937]'}`}>
                          สร้างบาร์โค้ดใหม่ (อัตโนมัติ)
                        </button>
                        <button type="button" onClick={() => setIsAutoGenerate(false)}
                          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${!isAutoGenerate ? 'bg-white text-[#1F2937] shadow-sm border border-[#E5E7EB]' : 'text-slate-500 hover:text-[#1F2937]'}`}>
                          มีบาร์โค้ดเดิมอยู่แล้ว
                        </button>
                      </div>

                      {isAutoGenerate ? (
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-black text-[#1F2937] mb-2">ต้องการสร้างกี่รายการ? (เพื่อพิมพ์สติกเกอร์แยก)</label>
                            <input type="number" min="1" value={generateCount} onChange={(e) => setGenerateCount(e.target.value)}
                              className="w-full px-4 py-3 border-2 border-[#E5E7EB] rounded-xl focus:border-[#A3E635] focus:ring-4 focus:ring-[#A3E635]/20 outline-none bg-white font-bold" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="block text-sm font-black text-[#1F2937]">
                                จำนวนต่อ 1 รายการ
                              </label>
                              {selectedProduct?.pieces_per_crate && (
                                <div className="flex bg-[#F3F4F6] p-1 rounded-lg border border-[#E5E7EB]">
                                  <button type="button" onClick={() => setReceiveMode('unit')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${receiveMode === 'unit' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-slate-500'}`}>ระบุเป็น({selectedProduct.unit || 'ชิ้น'})</button>
                                  <button type="button" onClick={() => setReceiveMode('crate')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${receiveMode === 'crate' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}>ระบุเป็น({selectedProduct.crate_unit || 'ลัง'})</button>
                                </div>
                              )}
                            </div>
                            
                            {receiveMode === 'crate' && selectedProduct?.pieces_per_crate ? (
                              <div className="flex gap-2 items-center">
                                <input type="number" min="1" value={receiveCrates} onChange={(e) => { setReceiveCrates(e.target.value); setQuantity(e.target.value * selectedProduct.pieces_per_crate); }}
                                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white" />
                                <span className="text-sm font-bold text-[#6B7280]">{selectedProduct.crate_unit || 'ลัง'}</span>
                                <span className="text-sm font-black text-amber-600 bg-amber-50 px-3 py-3 rounded-xl border border-amber-200 whitespace-nowrap">
                                  = {receiveCrates * selectedProduct.pieces_per_crate} {selectedProduct.unit || 'ชิ้น'}
                                </span>
                              </div>
                            ) : (
                              <input type="number" min="0.1" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white" />
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <label className="block text-sm font-black text-[#1F2937] mb-2">รหัสบาร์โค้ด</label>
                            <input type="text" value={sn} onChange={(e) => setSn(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleAddToStaging(); }}
                              placeholder="สแกนหรือพิมพ์รหัส..."
                              className="w-full px-4 py-3 border-2 border-[#E5E7EB] rounded-xl focus:border-[#A3E635] focus:ring-4 focus:ring-[#A3E635]/20 outline-none bg-white font-bold" />
                          </div>
                          <div>
                            <div className="flex justify-between items-center mb-2">
                              <label className="block text-sm font-black text-[#1F2937]">
                                จำนวนนำเข้า
                              </label>
                              {selectedProduct?.pieces_per_crate && (
                                <div className="flex bg-[#F3F4F6] p-1 rounded-lg border border-[#E5E7EB]">
                                  <button type="button" onClick={() => setReceiveMode('unit')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${receiveMode === 'unit' ? 'bg-white shadow-sm text-[#1F2937]' : 'text-slate-500'}`}>ระบุเป็น({selectedProduct.unit || 'ชิ้น'})</button>
                                  <button type="button" onClick={() => setReceiveMode('crate')} className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${receiveMode === 'crate' ? 'bg-white shadow-sm text-amber-600' : 'text-slate-500'}`}>ระบุเป็น({selectedProduct.crate_unit || 'ลัง'})</button>
                                </div>
                              )}
                            </div>
                            
                            {receiveMode === 'crate' && selectedProduct?.pieces_per_crate ? (
                              <div className="flex gap-2 items-center">
                                <input type="number" min="1" value={receiveCrates} 
                                  onChange={(e) => { setReceiveCrates(e.target.value); setQuantity(e.target.value * selectedProduct.pieces_per_crate); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddToStaging(); }}
                                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white" />
                                <span className="text-sm font-bold text-[#6B7280]">{selectedProduct.crate_unit || 'ลัง'}</span>
                                <span className="text-sm font-black text-amber-600 bg-amber-50 px-3 py-3 rounded-xl border border-amber-200 whitespace-nowrap">
                                  = {receiveCrates * selectedProduct.pieces_per_crate} {selectedProduct.unit || 'ชิ้น'}
                                </span>
                              </div>
                            ) : (
                              <input type="number" min="0.1" step="0.1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleAddToStaging(); }}
                                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none bg-white" />
                            )}
                          </div>
                        </div>
                      )}
                      
                      <button type="button" onClick={handleAddToStaging} disabled={(!isAutoGenerate && !sn.trim())}
                        className="w-full bg-[#1F2937] hover:bg-[#374151] text-white font-black px-8 py-4 rounded-xl disabled:opacity-50 mt-4 transition-all shadow-md active:scale-95 text-lg">
                        ➕ เพิ่มลงตะกร้า
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Staging Area */}
              {stagedItems.length > 0 && (
                <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm p-6 sm:p-8 animate-[slideUp_0.3s_ease-out]">
                  <div className="flex justify-between items-end mb-6 border-b border-[#E5E7EB] pb-4">
                    <div>
                      <h2 className="text-xl font-black text-[#1F2937]">3. ตะกร้าสรุปรายการนำเข้า</h2>
                      <div className="flex items-center gap-3 mt-1">
                        <p className="text-sm font-bold text-[#6B7280]">ตรวจสอบรายการก่อนกดยืนยันทั้งหมด</p>
                        <button 
                          onClick={() => setShowExportModal(true)}
                          className="px-3 py-1 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold rounded-lg shadow-sm transition-colors flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          Export
                        </button>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-[#A3E635]">{stagedItems.length}</span>
                      <span className="text-sm font-bold text-[#1F2937] ml-2">รายการ</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-[#E5E7EB] shadow-sm">
                    <table className="w-full text-left text-sm whitespace-nowrap bg-white">
                      <thead className="bg-[#F9FAFB] text-[#6B7280]">
                        <tr>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB]">สินค้า</th>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB]">โมเดล</th>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB]">SN / รหัส</th>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB]">เบอร์โทร</th>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB]">จำนวน</th>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB] text-center">แหล่งที่มา</th>
                          <th className="p-4 font-black uppercase tracking-wider border-b border-[#E5E7EB] text-center">ลบ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E5E7EB]">
                        {stagedItems.map((item) => (
                          <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                            <td className="p-3 text-[#042C53]">{item.product_name}</td>
                            <td className="p-3 text-[#378ADD]">{item.model_name}</td>
                            <td className="p-3 font-mono text-slate-700">
                              {item.sn}
                              {item.is_auto_generate && <span className="ml-2 text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">Auto ({item.generate_count} items)</span>}
                            </td>
                            <td className="p-3 font-mono text-slate-700">{item.phone_number || '-'}</td>
                            <td className="p-3 text-[#042C53]">{item.quantity}</td>
                            <td className="p-3 text-center">
                              {item._fromExcel ? (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">📄 Excel</span>
                              ) : (
                                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">✍️ Manual</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <button type="button" onClick={() => removeStagedItem(item.id)}
                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-6 flex justify-end">
                    <button onClick={handleConfirmAll} disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-xl disabled:opacity-50 transition-colors shadow-lg shadow-emerald-600/20 flex items-center gap-2">
                      {loading ? 'กำลังประมวลผล...' : (
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
      {/* Export Modal */}
      <ExportModal 
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={stagedItems}
        title="ส่งออกรายการนำเข้า (Receive)"
        fileNamePrefix="Receive_Staging"
      />
    </>
  );
}
