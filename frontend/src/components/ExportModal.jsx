import { useState } from 'react';
import * as XLSX from 'xlsx';

export default function ExportModal({ isOpen, onClose, data, title, fileNamePrefix }) {
  const [cols, setCols] = useState({
    no: true,
    product_name: true,
    sn: true,
    time: true
  });

  if (!isOpen) return null;

  const handleCheckboxChange = (e) => {
    setCols({
      ...cols,
      [e.target.name]: e.target.checked
    });
  };

  // Format current date in Thai format, e.g. "6 มิถุนายน 2569"
  const getThaiDateString = () => {
    const d = new Date();
    const months = [
      "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
      "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  };

  const exportDateStr = getThaiDateString();

  // Prepare data for preview and export
  const prepareData = () => {
    return data.map((item, index) => {
      const row = {};
      if (cols.no) row['ลำดับ'] = index + 1;
      
      if (cols.product_name) {
        // Handle models and product names flexibly
        const pName = item.product_name || item.name || '';
        const mName = item.model_name ? ` (${item.model_name})` : '';
        row['ชื่อสินค้า'] = `${pName}${mName}`;
      }
      
      if (cols.sn) {
        row['SN'] = item.sn || '-';
      }
      
      if (cols.time) {
        row['เวลา'] = exportDateStr;
      }
      return row;
    });
  };

  const exportData = prepareData();

  const handleExport = () => {
    if (exportData.length === 0) return;
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    
    const finalFileName = `${fileNamePrefix}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, finalFileName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#042C53]/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden animate-[slideUp_0.3s_ease-out] max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-[#042C53] to-[#185FA5] text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold">{title || "ส่งออกข้อมูล Excel"}</h2>
              <p className="text-xs text-white/70">เลือกคอลัมน์และตรวจสอบข้อมูลก่อนส่งออก</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Checkboxes */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-[#042C53] mb-3">เลือกข้อมูลที่ต้องการนำออก (คอลัมน์)</h3>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" name="no" checked={cols.no} onChange={handleCheckboxChange} className="w-5 h-5 border-2 border-slate-300 rounded text-[#185FA5] focus:ring-[#185FA5] cursor-pointer" />
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-[#185FA5]">ลำดับ</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" name="product_name" checked={cols.product_name} onChange={handleCheckboxChange} className="w-5 h-5 border-2 border-slate-300 rounded text-[#185FA5] focus:ring-[#185FA5] cursor-pointer" />
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-[#185FA5]">ชื่อสินค้า</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" name="sn" checked={cols.sn} onChange={handleCheckboxChange} className="w-5 h-5 border-2 border-slate-300 rounded text-[#185FA5] focus:ring-[#185FA5] cursor-pointer" />
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-[#185FA5]">SN</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative flex items-center">
                  <input type="checkbox" name="time" checked={cols.time} onChange={handleCheckboxChange} className="w-5 h-5 border-2 border-slate-300 rounded text-[#185FA5] focus:ring-[#185FA5] cursor-pointer" />
                </div>
                <span className="text-sm font-bold text-slate-700 group-hover:text-[#185FA5]">เวลา</span>
              </label>
            </div>
          </div>

          {/* Real-time Preview */}
          <div>
            <h3 className="text-sm font-bold text-[#042C53] mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              แสดงตัวอย่าง (เรียลไทม์) - {exportData.length} รายการ
            </h3>
            
            {exportData.length > 0 ? (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-[#E6F1FB] text-[#042C53] sticky top-0 z-10">
                      <tr>
                        {Object.keys(exportData[0]).map((key) => (
                          <th key={key} className="px-4 py-3 font-bold whitespace-nowrap border-b border-slate-200">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {exportData.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          {Object.values(row).map((val, colIdx) => (
                            <td key={colIdx} className="px-4 py-2.5 text-slate-600 whitespace-nowrap">
                              {val}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center text-slate-400">
                ไม่มีข้อมูลที่เลือก หรือไม่มีรายการที่จะนำออก
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-slate-500 font-bold hover:bg-slate-200 transition-colors">
            ยกเลิก
          </button>
          <button 
            onClick={handleExport}
            disabled={exportData.length === 0}
            className="px-6 py-2.5 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white font-bold transition-all shadow-md active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            ดาวน์โหลด Excel
          </button>
        </div>
      </div>
    </div>
  );
}
