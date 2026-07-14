import { useState, useRef, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

export default function CustomImportExcelModal({ isOpen, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [previewData, setPreviewData] = useState([]);
  const [teams, setTeams] = useState([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchTeams();
    }
  }, [isOpen]);

  const fetchTeams = async () => {
    try {
      const res = await axios.get('/users/teams');
      setTeams(res.data || []);
    } catch (err) {
      console.error('Failed to fetch teams', err);
    }
  };

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    setFile(selected);
    setPreviewData([]);
    setSheetNames([]);
    setSelectedSheet('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        
        // Show Swal to select sheet if multiple exist
        if (wb.SheetNames.length > 1) {
          const options = wb.SheetNames.reduce((acc, sheet) => {
            acc[sheet] = sheet;
            return acc;
          }, {});
          
          Swal.fire({
            title: 'เลือก Sheet ที่ต้องการอ่าน',
            input: 'select',
            inputOptions: options,
            inputPlaceholder: 'เลือก Sheet',
            showCancelButton: true,
            confirmButtonText: 'ตกลง',
            cancelButtonText: 'ยกเลิก',
          }).then((result) => {
            if (result.isConfirmed && result.value) {
              setSelectedSheet(result.value);
              processSheet(wb, result.value);
            } else {
              // User cancelled sheet selection
              resetModal();
            }
          });
        } else {
          // Only one sheet, process directly
          setSelectedSheet(wb.SheetNames[0]);
          processSheet(wb, wb.SheetNames[0]);
        }
      } catch (err) {
        console.error('Excel parse error:', err);
        Swal.fire({ icon: 'error', title: 'อ่านไฟล์ไม่สำเร็จ', text: 'รูปแบบไฟล์ไม่ถูกต้อง หรือไฟล์อาจเสียหาย' });
      }
    };
    reader.readAsBinaryString(selected);
  };

  const parseTime = (timeStr) => {
    if (timeStr === undefined || timeStr === null || timeStr === '') return '';
    // if time is in decimal due to excel formatting
    if (typeof timeStr === 'number') {
      // Excel serial date: integer is days, fraction is time
      const fraction = timeStr % 1;
      const totalSeconds = Math.round(fraction * 24 * 60 * 60);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    }
    const str = String(timeStr).trim();
    // simple validation for HH:mm, HH.mm, "10.30 น."
    const timeMatch = str.match(/(\d{1,2})[\.:](\d{2})/);
    if (timeMatch) {
      return `${String(timeMatch[1]).padStart(2, '0')}:${timeMatch[2]}:00`;
    }
    return '';
  };

  const parseDateFromRemark = (remark) => {
    if (!remark) return null;
    // Look for DD/MM/YY or DD/MM/YYYY
    const dateMatch = remark.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (!dateMatch) return null;
    
    let d = parseInt(dateMatch[1]);
    let m = parseInt(dateMatch[2]);
    let y = parseInt(dateMatch[3]);
    
    // Convert BE to CE
    if (y < 100) y += 2500;
    if (y > 2400) y -= 543;
    
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const findTeamId = (excelTeamName) => {
    if (!excelTeamName) return null;
    let searchName = String(excelTeamName).trim().toLowerCase();
    
    // เติมคำว่า 'ช่าง' ด้านหน้าเสมอ ถ้ายังไม่มี
    if (!searchName.startsWith('ช่าง')) {
      searchName = 'ช่าง' + searchName;
    }
    
    // Exact match first
    const exactMatch = teams.find(t => t.team_name.trim().toLowerCase() === searchName);
    if (exactMatch) return exactMatch.id;
    
    // Fuzzy match (substring)
    const fuzzyMatch = teams.find(t => 
      t.team_name.toLowerCase().includes(searchName) || 
      searchName.includes(t.team_name.toLowerCase())
    );
    return fuzzyMatch ? fuzzyMatch.id : null;
  };

  const processSheet = (wb, sheetName) => {
    const ws = wb.Sheets[sheetName];
    // header: 1 reads it as array of arrays
    const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
    
    if (data.length <= 2) {
      Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูล', text: 'ต้องมีข้อมูลเริ่มตั้งแต่บรรทัดที่ 3 (บรรทัด 2 เป็นหัวตาราง)' });
      return;
    }

    // Row 2 (index 1) is header
    const headers = data[1].map(h => String(h || '').trim());
    
    const getIdx = (...keywords) => {
      return headers.findIndex(h => keywords.some(kw => h.toLowerCase().includes(kw.toLowerCase())));
    };

    const idxTime = getIdx('เวลา');
    const idxNon = getIdx('NON', 'Access');
    const idxCustomer = getIdx('ชื่อลูกค้า', 'ลูกค้า');
    const idxPhone = getIdx('เบอร์โทร', 'โทร');
    const idxPackage = getIdx('โปร');
    const idxSale = getIdx('เซล');
    const idxTech = getIdx('ช่าง');
    const idxAddress = getIdx('ที่อยู่');
    const idxArea = getIdx('พื้นที่');
    const idxStatus = getIdx('สถานะ');
    const idxRemark = getIdx('หมายเหตุ');

    const parsedJobs = [];
    
    // Data starts from row 3 (index 2)
    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      const access_no = idxNon >= 0 ? String(row[idxNon] || '').trim() : '';
      if (!access_no) continue; // Skip if no NON / access_no

      const timeRaw = idxTime >= 0 ? row[idxTime] : '';
      const planTime = parseTime(timeRaw);
      
      const rawStatus = idxStatus >= 0 ? String(row[idxStatus] || '').trim() : '';
      const rawRemark = idxRemark >= 0 ? String(row[idxRemark] || '').trim() : '';
      const rawSale = idxSale >= 0 ? String(row[idxSale] || '').trim() : '';
      
      let finalStatus = 'pending';
      let finalRemark = rawRemark;
      let finalDate = null; // We default to null (today or whatever backend decides)

      // Handle Sale -> Append to remark
      if (rawSale) {
        finalRemark = finalRemark ? `${finalRemark} | เซล: ${rawSale}` : `เซล: ${rawSale}`;
      }

      // Handle Status specific logic
      if (rawStatus.toLowerCase().includes('reject')) {
        finalStatus = 'failed';
        // Keep remark as is
      } else if (rawStatus.toLowerCase().includes('เลื่อน')) {
        finalStatus = 'postponed';
        // Try to parse date from remark
        const extractedDate = parseDateFromRemark(rawRemark);
        if (extractedDate) {
          finalDate = extractedDate;
        }
      } else if (rawStatus.toLowerCase().includes('completed') || rawStatus.includes('สำเร็จ')) {
        finalStatus = 'completed';
      }

      const techName = idxTech >= 0 ? String(row[idxTech] || '').trim() : '';
      const teamId = findTeamId(techName);

      parsedJobs.push({
        access_no: access_no,
        customer: idxCustomer >= 0 ? String(row[idxCustomer] || '').trim() : '',
        phone: idxPhone >= 0 ? String(row[idxPhone] || '').trim() : '',
        package: idxPackage >= 0 ? String(row[idxPackage] || '').trim() : '',
        address: idxAddress >= 0 ? String(row[idxAddress] || '').trim() : '',
        area_name: idxArea >= 0 ? String(row[idxArea] || '').trim() : '',
        remark: finalRemark,
        plan_arrival_time: planTime,
        plan_arrival_date: finalDate,
        status: finalStatus,
        team_id: teamId,
        tech_name_excel: techName // For display in preview
      });
    }

    setPreviewData(parsedJobs);
  };

  const handleSubmit = async () => {
    if (previewData.length === 0) {
      Swal.fire({ icon: 'warning', title: 'ไม่มีข้อมูล', text: 'ไม่พบข้อมูลงานที่สมบูรณ์' });
      return;
    }

    setLoading(true);
    try {
      // Use existing bulk endpoint which has been modified to accept status & team_id
      const res = await axios.post('/dispatch/jobs/bulk', { jobs: previewData });
      const { successCount, skippedCount } = res.data;

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
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet('');
    setPreviewData([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={resetModal}></div>
      
      <div className="relative glass w-full max-w-5xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up bg-white">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">นำเข้า Custom Excel</h2>
              <p className="text-sm text-gray-500 font-medium">รูปแบบพิเศษ (อ่านบรรทัด 2 เป็น Header)</p>
            </div>
          </div>
          <button onClick={resetModal} className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-xl transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50">
          <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-sm">
            <h3 className="text-gray-800 font-bold mb-1">อัปโหลดไฟล์</h3>
            <p className="text-gray-500 text-sm mb-4">รองรับเฉพาะไฟล์ .xlsx (ข้อมูลหัวคอลัมน์ต้องอยู่บรรทัดที่ 2)</p>
            
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileChange}
              ref={fileInputRef}
              className="block w-full text-sm text-gray-800 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 transition-all cursor-pointer border border-gray-200 rounded-xl bg-gray-50"
            />
            {selectedSheet && (
              <div className="mt-3 text-sm text-gray-600 bg-blue-50 p-2 rounded-lg border border-blue-100 inline-block">
                กำลังอ่านข้อมูลจาก Sheet: <span className="font-bold text-blue-700">{selectedSheet}</span>
              </div>
            )}
          </div>

          {previewData.length > 0 && (
            <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col h-96">
              <div className="flex justify-between items-center mb-3 shrink-0">
                <h3 className="text-gray-800 font-bold">ตรวจสอบความถูกต้อง ({previewData.length} รายการ)</h3>
              </div>
              <div className="flex-1 overflow-auto rounded-xl border border-gray-200 shadow-inner">
                <table className="w-full text-sm text-left text-gray-700 min-w-max">
                  <thead className="text-xs uppercase bg-gray-100 sticky top-0 shadow-sm z-10">
                    <tr>
                      <th className="px-3 py-3">NON (Access No)</th>
                      <th className="px-3 py-3">ลูกค้า / เบอร์</th>
                      <th className="px-3 py-3">เวลา / วันที่เลื่อน</th>
                      <th className="px-3 py-3">พื้นที่</th>
                      <th className="px-3 py-3">ทีมช่าง (ในไฟล์ &rarr; ในระบบ)</th>
                      <th className="px-3 py-3">สถานะ</th>
                      <th className="px-3 py-3">หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((job, idx) => (
                      <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 font-bold">{job.access_no}</td>
                        <td className="px-3 py-2 max-w-[150px] truncate" title={job.customer}>
                          <div className="font-semibold text-gray-800 truncate">{job.customer || '-'}</div>
                          <div className="text-xs text-gray-500">{job.phone}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {job.plan_arrival_time && <div className="text-gray-800 font-medium">เวลา: {job.plan_arrival_time}</div>}
                          {job.plan_arrival_date && <div className="text-blue-600 text-xs">เลื่อนไป: {job.plan_arrival_date}</div>}
                        </td>
                        <td className="px-3 py-2 truncate max-w-[100px]" title={job.area_name}>{job.area_name || '-'}</td>
                        <td className="px-3 py-2">
                          <div className="text-xs text-gray-500">ไฟล์: {job.tech_name_excel || '-'}</div>
                          {job.team_id ? (
                            <span className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md">
                              ตรงกับระบบ ✅
                            </span>
                          ) : (
                            job.tech_name_excel && (
                              <span className="inline-block px-2 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-md">
                                ไม่พบทีม ❌
                              </span>
                            )
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-1 text-xs font-bold rounded-md whitespace-nowrap ${
                            job.status === 'completed' ? 'bg-green-100 text-green-700' :
                            job.status === 'failed' ? 'bg-red-100 text-red-700' :
                            job.status === 'postponed' ? 'bg-purple-100 text-purple-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {job.status === 'completed' ? 'เสร็จสิ้น' :
                             job.status === 'failed' ? 'ล้มเหลว (Reject)' :
                             job.status === 'postponed' ? 'เลื่อนนัด' : 'รอจ่าย'}
                          </span>
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate text-xs text-gray-600" title={job.remark}>
                          {job.remark || '-'}
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
        <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-end gap-3 shrink-0">
          <button onClick={resetModal} className="px-6 py-2.5 text-sm font-bold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
            ยกเลิก
          </button>
          <button 
            onClick={handleSubmit}
            disabled={loading || previewData.length === 0}
            className="px-8 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
          >
            {loading ? 'กำลังนำเข้า...' : `ยืนยันนำเข้า ${previewData.length} รายการ`}
          </button>
        </div>
      </div>
    </div>
  );
}
