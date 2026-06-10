import { useState, useRef } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

export default function ImportExcelModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  // Define expected columns for the template
  const TEMPLATE_HEADERS = [
    'Access No', 'Customer Name', 'Phone', 'Plan Date (YYYY-MM-DD)', 
    'Address', 'Latitude', 'Longitude', 'Package', 'Product', 'Remark'
  ];

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'BOU_Dispatch_Template.xlsx');
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        // Parse sheet to JSON array of arrays
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        if (data.length <= 1) {
          Swal.fire({ icon: 'warning', title: 'ไฟล์ว่างเปล่า', text: 'ไม่พบข้อมูลในไฟล์ Excel' });
          return;
        }

        const headers = data[0].map(h => String(h || '').trim().toLowerCase());
        
        const getIdx = (...keywords) => {
          const idx = headers.findIndex(h => keywords.some(kw => h.includes(kw)));
          return idx;
        };

        let idxAccessNo = getIdx('access', 'order no', 'เลขที่');
        let idxCustomer = getIdx('customer', 'ชื่อ', 'ลูกค้า');
        let idxPhone = getIdx('phone', 'เบอร์', 'โทร', 'tel');
        let idxDate = getIdx('date', 'plan', 'วัน');
        let idxAddress = getIdx('address', 'ที่อยู่');
        let idxLat = getIdx('lat', 'ละติจูด');
        let idxLng = getIdx('lng', 'lon', 'ลอง');
        let idxPackage = getIdx('package', 'แพ็ก');
        let idxProduct = getIdx('product', 'สินค้า');
        let idxRemark = getIdx('remark', 'หมายเหตุ', 'note');

        // Fallbacks if not found
        if (idxAccessNo === -1) idxAccessNo = 0;
        if (idxCustomer === -1) idxCustomer = 1;
        if (idxPhone === -1) idxPhone = 2;
        if (idxDate === -1) idxDate = 3;
        if (idxAddress === -1) idxAddress = 4;
        if (idxLat === -1) idxLat = 5;
        if (idxLng === -1) idxLng = 6;
        if (idxPackage === -1) idxPackage = 7;
        if (idxProduct === -1) idxProduct = 8;
        if (idxRemark === -1) idxRemark = 9;

        const parsedJobs = [];
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || !row[idxAccessNo]) continue; // Skip empty rows or rows without Access No

          // Helper to extract numbers from string if parseFloat fails on dirty strings
          const parseCoord = (val) => {
            if (!val) return null;
            const parsed = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
            return isNaN(parsed) ? null : parsed;
          };

          parsedJobs.push({
            access_no: String(row[idxAccessNo] || '').trim(),
            customer: String(row[idxCustomer] || '').trim(),
            phone: String(row[idxPhone] || '').trim(),
            plan_arrival_date: formatExcelDate(row[idxDate]),
            address: String(row[idxAddress] || '').trim(),
            lat: parseCoord(row[idxLat]),
            lng: parseCoord(row[idxLng]),
            package: String(row[idxPackage] || '').trim(),
            product: String(row[idxProduct] || '').trim(),
            remark: String(row[idxRemark] || '').trim(),
          });
        }
        setPreviewData(parsedJobs);
      } catch (err) {
        console.error('Excel parse error:', err);
        Swal.fire({ icon: 'error', title: 'อ่านไฟล์ไม่สำเร็จ', text: 'รูปแบบไฟล์ไม่ถูกต้อง หรือไฟล์อาจเสียหาย' });
      }
    };
    reader.readAsBinaryString(selected);
  };

  // Helper to safely parse excel date if it's a number
  const formatExcelDate = (val) => {
    if (!val) return '';
    if (typeof val === 'number') {
      // Excel dates are days since 1900-01-01
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split('T')[0];
    }
    return String(val).trim();
  };

  const handleSubmit = async () => {
    if (previewData.length === 0) {
      Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูล', text: 'กรุณาอัปโหลดไฟล์ Excel ที่มีข้อมูลงาน' });
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post('/dispatch/jobs/bulk', { jobs: previewData });
      const { successCount, skippedCount, total } = res.data;

      let htmlMsg = `<div class="flex flex-col gap-2 mt-2">
        <div class="bg-emerald-50 text-emerald-600 p-3 rounded-xl border border-emerald-100 flex justify-between items-center">
          <span class="font-semibold">นำเข้าสำเร็จ</span>
          <span class="font-bold text-lg">${successCount} <span class="text-sm font-normal">รายการ</span></span>
        </div>`;
      
      if (skippedCount > 0) {
        htmlMsg += `
        <div class="bg-amber-50 text-amber-600 p-3 rounded-xl border border-amber-100 flex justify-between items-center">
          <span class="font-semibold text-left">ข้ามข้อมูลซ้ำ / ไม่สมบูรณ์</span>
          <span class="font-bold text-lg">${skippedCount} <span class="text-sm font-normal">รายการ</span></span>
        </div>`;
      }
      htmlMsg += `</div>`;

      Swal.fire({ 
        icon: 'success', 
        title: 'นำเข้าข้อมูลเสร็จสิ้น', 
        html: htmlMsg,
        confirmButtonColor: '#185FA5'
      });
      
      if (typeof onSuccess === 'function') onSuccess();
      if (typeof onClose === 'function') onClose();
    } catch (err) {
      console.error('Import excel error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์';
      Swal.fire({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setPreviewData([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={resetModal}></div>
      
      <div className="relative glass w-full max-w-2xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/30 flex justify-between items-center glass shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#042C53]">นำเข้าข้อมูลจาก Excel</h2>
              <p className="text-sm text-[#378ADD] font-medium">เพิ่มงานครั้งละหลายรายการด้วยไฟล์ .xlsx</p>
            </div>
          </div>
          <button onClick={resetModal} className="p-2 text-[#378ADD] hover:glass hover:text-[#185FA5] rounded-xl transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-center justify-between p-4 glass border border-white/50 rounded-2xl">
            <div>
              <h3 className="text-[#042C53] font-bold">1. ดาวน์โหลด Template</h3>
              <p className="text-[#378ADD] text-sm">ดาวน์โหลดไฟล์ต้นแบบเพื่อนำไปกรอกข้อมูลให้ถูกต้องตามฟอร์ม</p>
            </div>
            <button onClick={handleDownloadTemplate} className="px-4 py-2 bg-white/50 border border-white hover:bg-white text-[#185FA5] font-bold rounded-xl shadow-sm transition-colors text-sm flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              โหลด Template
            </button>
          </div>

          <div className="p-4 glass border border-white/50 rounded-2xl">
            <h3 className="text-[#042C53] font-bold mb-1">2. อัปโหลดไฟล์ที่กรอกข้อมูลแล้ว</h3>
            <p className="text-[#378ADD] text-sm mb-4">รองรับเฉพาะไฟล์นามสกุล .xlsx หรือ .xls (กรณีข้อมูลซ้ำ ระบบจะข้ามข้อมูลนั้นให้โดยอัตโนมัติ)</p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv" 
              onChange={handleFileChange}
              ref={fileInputRef}
              className="block w-full text-sm text-[#042C53] file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-[#185FA5] file:text-white hover:file:bg-[#0C447C] transition-all cursor-pointer glass border border-white/50 rounded-xl"
            />
          </div>

          {previewData.length > 0 && (
            <div className="p-4 glass border border-emerald-200 bg-emerald-50/50 rounded-2xl flex flex-col h-64">
              <div className="flex justify-between items-center mb-2 shrink-0">
                <h3 className="text-emerald-700 font-bold">ตรวจสอบและแก้ไขพิกัด (พบ {previewData.length} รายการ)</h3>
              </div>
              <div className="flex-1 overflow-auto bg-white/60 rounded-xl border border-white/80 p-0 shadow-inner">
                <table className="w-full text-sm text-left text-[#042C53]">
                  <thead className="text-xs uppercase bg-white/80 sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="px-4 py-3">Access No</th>
                      <th className="px-4 py-3">ชื่อลูกค้า</th>
                      <th className="px-4 py-3">ละติจูด (Lat)</th>
                      <th className="px-4 py-3">ลองจิจูด (Lng)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((job, idx) => (
                      <tr key={idx} className="border-b border-white/50 hover:bg-white/40 transition-colors">
                        <td className="px-4 py-2 font-bold">{job.access_no}</td>
                        <td className="px-4 py-2 truncate max-w-[120px]" title={job.customer}>{job.customer || '-'}</td>
                        <td className="px-4 py-2">
                          <input 
                            type="number" step="any"
                            value={job.lat || ''}
                            onChange={(e) => {
                              const updated = [...previewData];
                              updated[idx].lat = e.target.value ? parseFloat(e.target.value) : null;
                              setPreviewData(updated);
                            }}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-[#042C53] bg-white text-xs"
                            placeholder="Lat"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input 
                            type="number" step="any"
                            value={job.lng || ''}
                            onChange={(e) => {
                              const updated = [...previewData];
                              updated[idx].lng = e.target.value ? parseFloat(e.target.value) : null;
                              setPreviewData(updated);
                            }}
                            className="w-full px-2 py-1.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-brand-500 outline-none text-[#042C53] bg-white text-xs"
                            placeholder="Lng"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-white/30 glass flex justify-end gap-3 shrink-0">
          <button onClick={resetModal} className="px-6 py-3 text-sm font-bold text-[#185FA5] glass rounded-xl hover:bg-[#E6F1FB] transition-colors">
            ยกเลิก
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading || previewData.length === 0}
            className="px-8 py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
          >
            {loading ? 'กำลังนำเข้า...' : `ยืนยันนำเข้าข้อมูล`}
          </button>
        </div>
      </div>
    </div>
  );
}
