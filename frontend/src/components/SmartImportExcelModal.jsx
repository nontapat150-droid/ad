import { useState, useRef, useEffect } from 'react';
import axios from '../api/axios';
import * as XLSX from 'xlsx';

// ─── Field definitions for the system ─────────────────────────────────────────
const SYSTEM_FIELDS = [
  { key: 'access_no',         label: 'Access No / รหัสงาน',       required: true  },
  { key: 'customer',          label: 'ชื่อลูกค้า',                 required: false },
  { key: 'phone',             label: 'เบอร์โทร',                   required: false },
  { key: 'plan_arrival_date', label: 'วันที่เข้างาน (YYYY-MM-DD)', required: false },
  { key: 'plan_arrival_time', label: 'เวลาเข้างาน (HH:MM)',        required: false },
  { key: 'address',           label: 'ที่อยู่ / พื้นที่',           required: false },
  { key: 'team_id',           label: 'ทีมช่าง (ชื่อทีม)',           required: false },
  { key: '_engineer_name',    label: 'ชื่อช่าง → หาทีมอัตโนมัติ',  required: false },
  { key: 'product',           label: 'สินค้า',                     required: false },
  { key: 'package',           label: 'แพ็กเกจ',                   required: false },
  { key: 'service_note',      label: 'รายละเอียดงาน (Service Note)', required: false },
  { key: 'remark',            label: 'หมายเหตุ',                   required: false },
  { key: 'lat',               label: 'ละติจูด',                    required: false },
  { key: 'lng',               label: 'ลองจิจูด',                   required: false },
  { key: 'order_no',          label: 'Order No',                   required: false },
  { key: 'area_code',         label: 'Area Code',                  required: false },
  { key: 'area_name',         label: 'Area Name / พื้นที่',         required: false },
  { key: 'province',          label: 'จังหวัด',                    required: false },
  { key: 'task_type',         label: 'ประเภทงาน (Task Type)',       required: false },
  { key: 'product_owner',     label: 'Product Owner',              required: false },
];

const IGNORE_KEY = '__ignore__';

function getSheetMeta(workbook) {
  return workbook.SheetNames.map((name) => {
    const ws = workbook.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    const dataRows = rows.filter((row) =>
      row.some((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '')
    );
    const headers = (rows[0] || []).filter((cell) => cell !== null && cell !== undefined && String(cell).trim() !== '');
    return {
      name,
      rowCount: dataRows.length,
      colCount: headers.length || (dataRows[0]?.length ?? 0),
      previewHeaders: headers.slice(0, 4).map((h) => String(h).trim()).filter(Boolean),
    };
  });
}

function SheetPickerPopup({ sheets, onSelect, onCancel }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-[#1F2937]/40 backdrop-blur-[2px] rounded-3xl">
      <div
        className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] shadow-[0_20px_50px_rgba(15,23,42,0.18)] overflow-hidden animate-filterDropIn"
        role="dialog"
        aria-label="เลือกแท็บ Excel"
      >
        <div className="h-1" style={{ background: 'linear-gradient(90deg,#A3E635,#65a30d)' }} />
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}>
              📑
            </div>
            <div>
              <h3 className="text-base font-black text-[#1F2937]">เลือกแท็บที่ต้องการอ่าน</h3>
              <p className="text-[11px] text-[#9CA3AF] font-medium mt-0.5">ไฟล์นี้มี {sheets.length} แท็บ — เลือกแท็บที่มีข้อมูลงาน</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#9CA3AF] hover:text-[#1F2937] hover:bg-[#F3F4F6] transition-colors"
            aria-label="ยกเลิก"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {sheets.map((sheet, idx) => (
            <button
              key={sheet.name}
              onClick={() => onSelect(sheet.name)}
              className="w-full text-left p-4 rounded-xl border-2 border-[#E5E7EB] bg-white hover:border-[#A3E635] hover:bg-[#A3E635]/5 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-[#F3F4F6] group-hover:bg-[#A3E635]/20 flex items-center justify-center text-sm font-black text-[#6B7280] group-hover:text-[#65a30d] shrink-0 transition-colors">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1F2937] truncate">{sheet.name}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                    {sheet.rowCount} แถว · {sheet.colCount} คอลัมน์
                  </p>
                  {sheet.previewHeaders.length > 0 && (
                    <p className="text-[10px] text-[#6B7280] mt-1.5 truncate">
                      หัวคอลัมน์: {sheet.previewHeaders.join(' · ')}
                      {sheet.colCount > 4 ? ' ...' : ''}
                    </p>
                  )}
                </div>
                <svg className="w-5 h-5 text-[#D1D5DB] group-hover:text-[#65a30d] shrink-0 mt-1 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
              </div>
            </button>
          ))}
        </div>

        <div className="px-4 pb-4">
          <button
            onClick={onCancel}
            className="w-full px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] text-sm font-semibold hover:bg-[#F3F4F6] transition-colors"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Helper: parse Excel date serial to YYYY-MM-DD ────────────────────────────
function parseExcelDate(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number') {
    // Excel date serial
    const jsDate = XLSX.SSF.parse_date_code(raw);
    if (!jsDate) return String(raw);
    const y = jsDate.y;
    const m = String(jsDate.m).padStart(2, '0');
    const d = String(jsDate.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof raw === 'string') {
    // Also consider time attached, e.g. "12/03/2026 10:30:00"
    const datePart = raw.trim().split(' ')[0];
    
    // Support DD/MM/YYYY
    const ddmm = datePart.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (ddmm) {
      const [, d, m, y] = ddmm;
      const year = y.length === 2 ? (parseInt(y) > 50 ? '19' + y : '20' + y) : y;
      return `${year}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const yyyymm = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (yyyymm) {
      const [, y, m, d] = yyyymm;
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    return datePart;
  }
  return String(raw);
}

// ─── Helper: parse Excel time to HH:MM ────────────────────────────────────────
function parseExcelTime(raw) {
  if (raw === null || raw === undefined || raw === '') return '';
  if (typeof raw === 'number') {
    // Excel stores datetime as integer (days since 1900) + fractional day (time).
    // A pure time value is 0 < raw < 1; a datetime serial has an integer part ≥ 1.
    // We always strip the integer part so both cases work correctly.
    const timeFraction = raw % 1; // keep only the fractional day
    const totalMinutes = Math.round(timeFraction * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    // Also handle strings like "12/03/2026 10:30" — grab the time portion
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
    }
    return s.substring(0, 5);
  }
  return String(raw);
}

// ─── Helper: resolve team from engineer nickname or team name ────────────────
function resolveTeamFromName(rawName, teams, allUsers) {
  if (!rawName) {
    return { teamId: null, teamName: '', engineerName: '', unmatched: null };
  }

  const raw = String(rawName).trim();
  const searchNames = new Set([raw]);

  // เติมคำว่า 'ช่าง' ด้านหน้าเสมอ ถ้ายังไม่มี (เช่น เจมส์ → ช่างเจมส์)
  if (!raw.startsWith('ช่าง')) {
    searchNames.add(`ช่าง${raw}`);
  }
  if (!raw.startsWith('ทีม')) {
    searchNames.add(`ทีม${raw}`);
  }

  const candidates = [...searchNames].map((name) => name.trim()).filter(Boolean);

  // 1. จับคู่ชื่อช่างในระบบก่อน
  for (const searchName of candidates) {
    const searchLower = searchName.toLowerCase();
    const exactUser = allUsers.find(
      (u) => u.full_name && u.full_name.trim().toLowerCase() === searchLower
    );
    const fuzzyUser = !exactUser
      ? allUsers.find(
          (u) =>
            u.full_name &&
            (u.full_name.toLowerCase().includes(searchLower) ||
              searchLower.includes(u.full_name.toLowerCase()))
        )
      : null;
    const matchedUser = exactUser || fuzzyUser;

    if (matchedUser?.team_id) {
      const team = teams.find((t) => t.id === matchedUser.team_id);
      return {
        teamId: matchedUser.team_id,
        teamName: team ? team.team_name : `ทีม #${matchedUser.team_id}`,
        engineerName: matchedUser.full_name,
        unmatched: null,
      };
    }
  }

  // 2. ถ้าไม่เจอช่าง ลองจับชื่อทีม
  for (const searchName of candidates) {
    const exactTeam = teams.find(
      (t) =>
        t.team_name === searchName ||
        t.team_name.toLowerCase() === searchName.toLowerCase()
    );
    if (exactTeam) {
      return {
        teamId: exactTeam.id,
        teamName: exactTeam.team_name,
        engineerName: '',
        unmatched: null,
      };
    }
  }

  return { teamId: null, teamName: raw, engineerName: '', unmatched: raw };
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepBar({ step }) {
  const steps = ['ประเภทงาน', 'อ่าน Header', 'จับคู่คอลัมน์', 'ตรวจสอบ & นำเข้า'];
  return (
    <div className="flex items-center gap-0 mb-6 px-2">
      {steps.map((label, i) => {
        const num = i + 1;
        const isActive = step === num;
        const isDone = step > num;
        return (
          <div key={num} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${
                isDone ? 'bg-emerald-500 border-emerald-500 text-white' :
                isActive ? 'bg-[#1F2937] border-[#1F2937] text-white' :
                'bg-white border-[#D1D5DB] text-[#9CA3AF]'
              }`}>
                {isDone ? '✓' : num}
              </div>
              <span className={`text-[9px] mt-1 font-semibold text-center leading-tight w-16 ${isActive ? 'text-[#1F2937]' : isDone ? 'text-emerald-600' : 'text-[#9CA3AF]'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 ${isDone ? 'bg-emerald-400' : 'bg-[#E5E7EB]'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SmartImportExcelModal({ isOpen, onClose, onSuccess, defaultJobType }) {
  const [step, setStep] = useState(1);
  const [jobType, setJobType] = useState(defaultJobType || 'office'); // 'office' | 'ma'
  const [headerRow, setHeaderRow] = useState(1); // 1 or 2
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [sheetMeta, setSheetMeta] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [rawData, setRawData] = useState([]); // all rows as array of arrays
  const [headers, setHeaders] = useState([]); // detected header labels
  const [mapping, setMapping] = useState({}); // { excelColIndex: systemFieldKey }
  const [parsedRows, setParsedRows] = useState([]); // after applying mapping
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null); // { success, skipped, errors }
  const [notification, setNotification] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch teams and users for resolving engineer name → team
      axios.get('/users/teams').then(r => setTeams(r.data || [])).catch(() => {});
      axios.get('/users').then(r => setAllUsers(r.data || [])).catch(() => {});
      // Reset
      setStep(defaultJobType ? 2 : 1);
      setJobType(defaultJobType || 'office');
      setHeaderRow(1);
      setFile(null);
      setWorkbook(null);
      setSheetNames([]);
      setSheetMeta([]);
      setSelectedSheet('');
      setShowSheetPicker(false);
      setRawData([]);
      setHeaders([]);
      setMapping({});
      setParsedRows([]);
      setImportResult(null);
      setNotification('');
    }
  }, [isOpen, defaultJobType]);

  if (!isOpen) return null;

  // ─── Step 1: Choose job type ───────────────────────────────────────────────
  function renderStep1() {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-[#1F2937] mb-2">เลือกประเภทงานที่ต้องการนำเข้า</h3>
        <div className="grid grid-cols-2 gap-4">
          {[
            { key: 'office', label: 'งานติดตั้ง', emoji: '🏢', desc: 'งาน Office / ติดตั้งใหม่' },
            { key: 'ma',     label: 'งาน MA',     emoji: '🔧', desc: 'งาน Maintenance / ซ่อมบำรุง' },
          ].map(opt => (
            <button
              key={opt.key}
              onClick={() => setJobType(opt.key)}
              className={`p-6 rounded-2xl border-2 text-left transition-all hover:scale-[1.02] active:scale-[0.98] ${
                jobType === opt.key
                  ? 'border-[#A3E635] bg-[#A3E635]/10 shadow-lg shadow-[#A3E635]/20'
                  : 'border-[#E5E7EB] bg-white hover:border-[#A3E635]/50'
              }`}
            >
              <div className="text-3xl mb-2">{opt.emoji}</div>
              <p className="font-bold text-[#1F2937] text-base">{opt.label}</p>
              <p className="text-[#6B7280] text-xs mt-1">{opt.desc}</p>
            </button>
          ))}
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={() => setStep(2)}
            className="px-6 py-3 rounded-xl font-bold text-[#1F2937] transition-all"
            style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' }}
          >
            ถัดไป →
          </button>
        </div>
      </div>
    );
  }

  function resetFileSelection() {
    setFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSheetMeta([]);
    setSelectedSheet('');
    setShowSheetPicker(false);
    setRawData([]);
    setHeaders([]);
    setMapping({});
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleSheetSelect(sheetName) {
    setSelectedSheet(sheetName);
    setShowSheetPicker(false);
    setRawData([]);
    setHeaders([]);
    setMapping({});
    setNotification('');
  }

  function handleSheetPickerCancel() {
    setShowSheetPicker(false);
    resetFileSelection();
  }

  // ─── Step 2: Upload file & choose header row ───────────────────────────────
  function handleFileChange(e) {
    const sel = e.target.files[0];
    if (!sel) return;
    setFile(sel);
    setRawData([]);
    setHeaders([]);
    setMapping({});
    setSelectedSheet('');
    setSheetNames([]);
    setSheetMeta([]);
    setShowSheetPicker(false);
    setNotification('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        const meta = getSheetMeta(wb);
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        setSheetMeta(meta);

        if (wb.SheetNames.length > 1) {
          setShowSheetPicker(true);
        } else {
          setSelectedSheet(wb.SheetNames[0]);
        }
      } catch (err) {
        setNotification('ไม่สามารถอ่านไฟล์ Excel ได้');
        resetFileSelection();
      }
    };
    reader.readAsBinaryString(sel);
  }

  function handleProceedToMapping() {
    if (!workbook) { setNotification('กรุณาอัปโหลดไฟล์ Excel ก่อน'); return; }
    const sheetName = selectedSheet || workbook.SheetNames[0];
    if (!sheetName) { setNotification('กรุณาเลือกแท็บที่ต้องการอ่าน'); return; }
    const ws = workbook.Sheets[sheetName];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    if (allRows.length < headerRow) { setNotification('ไฟล์มีข้อมูลไม่เพียงพอ'); return; }

    setRawData(allRows);
    const hdrs = (allRows[headerRow - 1] || []).map(h => String(h || '').trim());
    setHeaders(hdrs);

    // Auto-match columns using keyword heuristics
    const autoMap = {};
    const fieldKeywords = {
      access_no:         ['access', 'เลขที่', 'access no', 'รหัส'],
      customer:          ['customer', 'ชื่อลูกค้า', 'ลูกค้า'],
      phone:             ['phone', 'เบอร์', 'โทร', 'tel'],
      plan_arrival_date: ['date', 'วัน', 'plan date', 'วันที่นัด', 'plan_date', 'plan_arrival_date'],
      plan_arrival_time: ['time', 'เวลา', 'plan time', 'plan_time'],
      address:           ['address', 'ที่อยู่'],
      team_id:           ['team', 'ทีม'],
      _engineer_name:    ['engineer', 'ชื่อช่าง', 'ช่าง', 'technician', 'assigned', 'ผู้รับผิดชอบ'],
      product:           ['product', 'สินค้า'],
      package:           ['package', 'แพ็ก'],
      service_note:      ['service', 'note', 'รายละเอียด'],
      remark:            ['remark', 'หมายเหตุ'],
      lat:               ['lat', 'ละติ'],
      lng:               ['lng', 'lon', 'ลอง'],
      order_no:          ['order no', 'order_no'],
      area_code:         ['area code', 'รหัสพื้นที่'],
      area_name:         ['area name', 'ชื่อพื้นที่', 'พื้นที่'],
      province:          ['province', 'จังหวัด'],
      task_type:         ['task type', 'ประเภทงาน'],
      product_owner:     ['owner', 'product owner'],
    };

    const usedFields = new Set();
    hdrs.forEach((h, idx) => {
      const lower = h.toLowerCase();
      for (const [fieldKey, keywords] of Object.entries(fieldKeywords)) {
        if (usedFields.has(fieldKey)) continue;
        if (keywords.some(kw => lower.includes(kw))) {
          autoMap[idx] = fieldKey;
          usedFields.add(fieldKey);
          break;
        }
      }
      if (autoMap[idx] === undefined) autoMap[idx] = IGNORE_KEY;
    });

    setMapping(autoMap);
    setStep(3);
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        <h3 className="text-lg font-bold text-[#1F2937]">อัปโหมดไฟล์ & เลือกวิธีอ่าน Header</h3>

        {/* File drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            file ? 'border-emerald-400 bg-emerald-50' : 'border-[#D1D5DB] hover:border-[#A3E635] hover:bg-[#A3E635]/5'
          }`}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
          {file ? (
            <div>
              <div className="text-3xl mb-2">📊</div>
              <p className="font-bold text-emerald-700">{file.name}</p>
              <p className="text-xs text-emerald-600 mt-1">คลิกเพื่อเปลี่ยนไฟล์</p>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-2">📂</div>
              <p className="font-bold text-[#374151]">คลิกหรือลากไฟล์ Excel มาวาง</p>
              <p className="text-xs text-[#9CA3AF] mt-1">รองรับ .xlsx, .xls</p>
            </div>
          )}
        </div>

        {/* Selected sheet */}
        {workbook && selectedSheet && (
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-[#A3E635]/30 bg-[#A3E635]/5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#A3E635]/30 flex items-center justify-center text-sm shrink-0">📑</div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-[#65a30d] uppercase tracking-wide">แท็บที่เลือก</p>
                <p className="text-sm font-bold text-[#1F2937] truncate">{selectedSheet}</p>
              </div>
            </div>
            {sheetNames.length > 1 && (
              <button
                type="button"
                onClick={() => setShowSheetPicker(true)}
                className="px-3 py-1.5 text-xs font-bold text-[#1F2937] rounded-lg border border-[#A3E635]/40 bg-white hover:bg-[#A3E635]/10 transition-colors shrink-0"
              >
                เปลี่ยนแท็บ
              </button>
            )}
          </div>
        )}

        {workbook && !selectedSheet && sheetNames.length > 1 && (
          <button
            type="button"
            onClick={() => setShowSheetPicker(true)}
            className="w-full p-4 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 text-amber-800 text-sm font-bold hover:bg-amber-100 transition-colors"
          >
            📑 กรุณาเลือกแท็บ Excel ก่อนดำเนินการต่อ
          </button>
        )}

        {/* Header row selection */}
        <div>
          <p className="text-sm font-bold text-[#374151] mb-3">เลือกวิธีอ่านหัว Column</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { val: 1, label: 'อ่านตั้งแต่บรรทัดแรก', desc: 'Row 1 = Header', emoji: '1️⃣' },
              { val: 2, label: 'อ่านคอลัมน์บรรทัดที่ 2', desc: 'Row 1 = Title, Row 2 = Header', emoji: '2️⃣' },
            ].map(opt => (
              <button
                key={opt.val}
                onClick={() => setHeaderRow(opt.val)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  headerRow === opt.val
                    ? 'border-[#A3E635] bg-[#A3E635]/10 shadow-md'
                    : 'border-[#E5E7EB] bg-white hover:border-[#A3E635]/50'
                }`}
              >
                <div className="text-xl mb-1">{opt.emoji}</div>
                <p className="font-bold text-[#1F2937] text-sm">{opt.label}</p>
                <p className="text-[#9CA3AF] text-xs">{opt.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex justify-between">
          <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-semibold hover:bg-[#F3F4F6]">← ย้อนกลับ</button>
          <button
            onClick={handleProceedToMapping}
            disabled={!workbook || !selectedSheet}
            className="px-6 py-2.5 rounded-xl font-bold text-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: workbook && selectedSheet ? '0 2px 8px rgba(163,230,53,0.3)' : 'none' }}
          >
            อ่าน Header →
          </button>
        </div>
      </div>
    );
  }

  // ─── Step 3: Column mapping ────────────────────────────────────────────────
  function renderStep3() {
    // Get sample values for each Excel column (row after header)
    const dataStartRow = headerRow; // 0-indexed: headerRow-1 is header, so data starts at headerRow
    const sampleRow = rawData[dataStartRow] || [];

    function handleMappingChange(colIdx, value) {
      setMapping(prev => {
        const next = { ...prev };
        // Remove other columns mapped to same field (except IGNORE)
        if (value !== IGNORE_KEY) {
          Object.keys(next).forEach(k => {
            if (next[k] === value && parseInt(k) !== colIdx) next[k] = IGNORE_KEY;
          });
        }
        next[colIdx] = value;
        return next;
      });
    }

    const fieldOptions = [
      { key: IGNORE_KEY, label: '— ไม่นำเข้า (ข้าม) —' },
      ...SYSTEM_FIELDS.map(f => ({ key: f.key, label: f.label + (f.required ? ' *' : '') })),
    ];

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-[#1F2937]">จับคู่คอลัมน์ Excel → ฟิลด์ในระบบ</h3>
          <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-1 rounded-lg">{headers.length} คอลัมน์</span>
        </div>

        <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {headers.map((h, idx) => {
            const sample = sampleRow[idx] !== undefined && sampleRow[idx] !== null ? String(sampleRow[idx]).substring(0, 30) : '';
            const currentVal = mapping[idx] ?? IGNORE_KEY;
            return (
              <div key={idx} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-2 p-3 rounded-xl border transition-all ${
                currentVal !== IGNORE_KEY ? 'border-[#A3E635]/40 bg-[#A3E635]/5' : 'border-[#E5E7EB] bg-white'
              }`}>
                {/* Excel column info */}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#374151] truncate">{h || `คอลัมน์ ${idx + 1}`}</p>
                  {sample && <p className="text-[10px] text-[#9CA3AF] truncate">ตัวอย่าง: {sample}</p>}
                </div>
                {/* Arrow */}
                <div className={`text-base ${currentVal !== IGNORE_KEY ? 'text-[#65a30d]' : 'text-[#D1D5DB]'}`}>→</div>
                {/* System field selector */}
                <select
                  value={currentVal}
                  onChange={e => handleMappingChange(idx, e.target.value)}
                  className={`w-full px-2 py-1.5 text-xs rounded-lg border outline-none transition-colors ${
                    currentVal !== IGNORE_KEY
                      ? 'border-[#A3E635] bg-[#A3E635]/5 text-[#374151] font-semibold'
                      : 'border-[#E5E7EB] text-[#9CA3AF]'
                  }`}
                >
                  {fieldOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>{opt.label}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>

        {/* Mapped fields summary */}
        <div className="mt-3 p-3 bg-[#F9FAFB] rounded-xl border border-[#E5E7EB]">
          <p className="text-xs font-bold text-[#6B7280] mb-2">ฟิลด์ที่จะนำเข้า:</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(mapping)
              .filter(([, v]) => v !== IGNORE_KEY)
              .map(([idx, key]) => {
                const field = SYSTEM_FIELDS.find(f => f.key === key);
                return (
                  <span key={idx} className="px-2 py-0.5 bg-[#A3E635]/20 text-[#374151] text-[11px] font-semibold rounded-lg border border-[#A3E635]/30">
                    {field?.label || key}
                  </span>
                );
              })}
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <button onClick={() => setStep(2)} className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-semibold hover:bg-[#F3F4F6]">← ย้อนกลับ</button>
          <button
            onClick={handleBuildPreview}
            className="px-6 py-2.5 rounded-xl font-bold text-[#1F2937] transition-all"
            style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' }}
          >
            ตรวจสอบข้อมูล →
          </button>
        </div>
      </div>
    );
  }

  // ─── Build preview rows from mapping ──────────────────────────────────────
  function handleBuildPreview() {
    const dataStart = headerRow; // 0-indexed, rows after header
    const dataRows = rawData.slice(dataStart).filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

    const built = dataRows.map(row => {
      const obj = {};
      Object.entries(mapping).forEach(([colIdxStr, fieldKey]) => {
        if (fieldKey === IGNORE_KEY) return;
        const colIdx = parseInt(colIdxStr);
        let val = row[colIdx];
        if (val === null || val === undefined) { obj[fieldKey] = ''; return; }

        // Special transforms
        if (fieldKey === 'plan_arrival_date') {
          val = parseExcelDate(val);
        } else if (fieldKey === 'plan_arrival_time') {
          val = parseExcelTime(val);
        } else if (fieldKey === 'team_id') {
          const rawName = String(val).trim();
          const resolved = resolveTeamFromName(rawName, teams, allUsers);
          obj['_team_name_display'] = resolved.teamName || rawName;
          if (resolved.engineerName) obj['_engineer_resolved'] = resolved.engineerName;
          val = resolved.teamId;
          if (!val) obj['_team_name_unmatched'] = rawName;
        } else if (fieldKey === '_engineer_name') {
          const rawName = String(val).trim();
          obj['_engineer_name'] = rawName;
          const resolved = resolveTeamFromName(rawName, teams, allUsers);
          if (resolved.teamId && !obj.team_id) {
            obj.team_id = resolved.teamId;
            obj['_team_name_display'] = resolved.teamName;
            if (resolved.engineerName) obj['_engineer_resolved'] = resolved.engineerName;
            delete obj['_team_name_unmatched'];
            delete obj['_engineer_unmatched'];
          } else if (!resolved.teamId) {
            obj['_engineer_unmatched'] = rawName;
          }
          val = rawName;
        } else {
          val = String(val).trim();
        }
        obj[fieldKey] = val;
      });

      // Post-pass: if _engineer_name resolved a team and team_id was not yet set
      // (handled inside loop above already)
      return obj;
    });

    setParsedRows(built);
    setStep(4);
  }

  // ─── Step 4: Preview & Import ──────────────────────────────────────────────
  function renderStep4() {
    const validRows = parsedRows.filter(r => r.access_no);
    const invalidRows = parsedRows.filter(r => !r.access_no);
    const unmatchedTeam = parsedRows.filter(r => r._team_name_unmatched);
    const unmatchedEngineer = parsedRows.filter(r => r._engineer_unmatched);

    return (
      <div>
        <h3 className="text-base font-bold text-[#1F2937] mb-1">ตรวจสอบข้อมูลก่อนนำเข้า</h3>

        {/* Summary badges */}
        <div className="flex gap-2 flex-wrap mb-4">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
            ✅ นำเข้าได้: {validRows.length} รายการ
          </span>
          {invalidRows.length > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full border border-red-200">
              ⚠️ ไม่มี Access No: {invalidRows.length} รายการ
            </span>
          )}
          {unmatchedTeam.length > 0 && (
            <span className="px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
              🔍 ทีมไม่ตรง: {unmatchedTeam.length} รายการ
            </span>
          )}
          {unmatchedEngineer.length > 0 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
              👷 ไม่พบช่าง: {unmatchedEngineer.length} รายการ
            </span>
          )}
        </div>

        {/* Unmatched engineer warning */}
        {unmatchedEngineer.length > 0 && (
          <div className="mb-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
            <h4 className="text-sm font-bold text-orange-800 flex items-center gap-2 mb-2">
              👷 ไม่พบช่างในระบบ (จะนำเข้าโดยไม่ระบุทีม):
            </h4>
            <div className="flex flex-wrap gap-2 mb-2">
              {[...new Set(unmatchedEngineer.map(r => r._engineer_unmatched))].map((name, i) => (
                <span key={i} className="px-2 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-lg shadow-sm border border-orange-200">{name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Unmatched team warning */}
        {unmatchedTeam.length > 0 && (
          <div className="mb-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
              ⚠️ ชื่อทีม/ช่างไม่ตรงกับระบบ (จะนำเข้าโดยไม่ระบุทีม):
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {[...new Set(unmatchedTeam.map(r => r._team_name_unmatched))].map((name, i) => (
                <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg shadow-sm border border-amber-200">{name}</span>
              ))}
            </div>
          </div>
        )}

        {/* Preview table */}
        <div className="max-h-[35vh] overflow-auto rounded-xl border border-[#E5E7EB] mb-4" style={{ scrollbarWidth: 'thin' }}>
          <table className="w-full text-xs">
            <thead className="bg-[#F3F4F6] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-[#374151]">#</th>
                {Object.entries(mapping)
                  .filter(([, v]) => v !== IGNORE_KEY && v !== 'team_id' && v !== '_engineer_name')
                  .slice(0, 6)
                  .map(([idx, key]) => {
                    const field = SYSTEM_FIELDS.find(f => f.key === key);
                    return <th key={idx} className="px-3 py-2 text-left font-bold text-[#374151] whitespace-nowrap">{field?.label || key}</th>;
                  })}
                {Object.values(mapping).includes('_engineer_name') && (
                  <th className="px-3 py-2 text-left font-bold text-[#374151]">ช่าง</th>
                )}
                <th className="px-3 py-2 text-left font-bold text-[#374151]">ทีมช่าง</th>
              </tr>
            </thead>
            <tbody>
              {validRows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]">
                  <td className="px-3 py-2 text-[#9CA3AF]">{i + 1}</td>
                  {Object.entries(mapping)
                    .filter(([, v]) => v !== IGNORE_KEY && v !== 'team_id' && v !== '_engineer_name')
                    .slice(0, 6)
                    .map(([idx, key]) => (
                      <td key={idx} className="px-3 py-2 text-[#374151] max-w-[120px] truncate">{row[key] || '-'}</td>
                    ))}
                  {Object.values(mapping).includes('_engineer_name') && (
                    <td className="px-3 py-2 text-[#374151] max-w-[100px] truncate">
                      {row._engineer_name
                        ? row._engineer_unmatched
                          ? <span className="text-orange-500">{row._engineer_name} ⚠️</span>
                          : <span className="text-blue-600 font-semibold">{row._engineer_name}</span>
                        : '-'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-[#374151]">
                    {row._team_name_display ? (
                      row.team_id
                        ? (
                          <span className="text-emerald-600 font-semibold">
                            {row._team_name_display}
                            {row._engineer_resolved && row._engineer_resolved !== row._team_name_display && (
                              <span className="text-[10px] text-[#6B7280] font-normal ml-1">({row._engineer_resolved})</span>
                            )}
                          </span>
                        )
                        : <span className="text-amber-600">{row._team_name_display} ⚠️</span>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {validRows.length > 50 && (
            <p className="px-3 py-2 text-xs text-[#9CA3AF] text-center bg-[#F9FAFB]">... และอีก {validRows.length - 50} รายการ</p>
          )}
        </div>

        {importResult && (
          <div className={`p-3 rounded-xl text-sm font-semibold mb-3 ${importResult.success > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {importResult.success > 0
              ? `✅ นำเข้าสำเร็จ ${importResult.success} รายการ${importResult.skipped > 0 ? `, ข้าม ${importResult.skipped} รายการซ้ำ` : ''}`
              : `❌ ไม่สามารถนำเข้าได้: ${importResult.error || 'เกิดข้อผิดพลาด'}`
            }
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => setStep(3)} disabled={loading} className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-semibold hover:bg-[#F3F4F6] disabled:opacity-50">← แก้ไขจับคู่</button>
          <button
            onClick={handleImport}
            disabled={loading || validRows.length === 0}
            className="px-6 py-2.5 rounded-xl font-bold text-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' }}
          >
            {loading ? <span className="w-4 h-4 border-2 border-[#1F2937]/30 border-t-[#1F2937] rounded-full animate-spin" /> : '📥'}
            นำเข้า {validRows.length} รายการ
          </button>
        </div>
      </div>
    );
  }

  // ─── Perform import ────────────────────────────────────────────────────────
  async function handleImport() {
    const validRows = parsedRows.filter(r => r.access_no);
    if (validRows.length === 0) return;

    setLoading(true);
    setImportResult(null);

    try {
      // Clean up display-only keys
      const cleanRows = validRows.map(row => {
        const {
          _team_name_display,
          _team_name_unmatched,
          _engineer_name,
          _engineer_unmatched,
          _engineer_resolved,
          ...rest
        } = row;
        return rest;
      });

      const endpoint = jobType === 'ma' ? '/dispatch/ma-jobs/bulk' : '/dispatch/jobs/bulk';
      const res = await axios.post(endpoint, { jobs: cleanRows });

      const successCount = res.data.successCount || res.data.count || validRows.length;
      const skippedCount = res.data.skippedCount || 0;

      setImportResult({ success: successCount, skipped: skippedCount });
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'เกิดข้อผิดพลาด';
      setImportResult({ success: 0, error: msg });
    } finally {
      setLoading(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#1F2937]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-[#E5E7EB]">

        {showSheetPicker && sheetMeta.length > 0 && (
          <SheetPickerPopup
            sheets={sheetMeta}
            onSelect={handleSheetSelect}
            onCancel={handleSheetPickerCancel}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F3F4F6] shrink-0">
          <div>
            <h2 className="text-[#1F2937] font-bold text-lg flex items-center gap-2">
              📊 นำเข้าข้อมูล Excel
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${jobType === 'ma' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {jobType === 'ma' ? '🔧 MA' : '🏢 ติดตั้ง'}
              </span>
            </h2>
            <p className="text-xs text-[#9CA3AF] mt-0.5">ขั้นตอนที่ {step} จาก 4</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] hover:bg-[#E5E7EB] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'thin' }}>
          <StepBar step={step} />

          {notification && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-200 flex items-center gap-2">
              ⚠️ {notification}
              <button onClick={() => setNotification('')} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>
      </div>
    </div>
  );
}
