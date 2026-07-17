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
  { key: 'team_id',           label: 'ทีมช่าง',                    required: false },
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
    // Excel time fraction
    const totalMinutes = Math.round(raw * 24 * 60);
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    // Match HH:MM in string
    const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      return `${timeMatch[1].padStart(2,'0')}:${timeMatch[2]}`;
    }
    // Fallback
    return s.substring(0, 5);
  }
  return String(raw);
}

// ─── Helper: apply custom prefix if team name has no prefix ──────────────────
function normalizeTeamName(raw, teams, prefix) {
  if (!raw) return '';
  const str = String(raw).trim();
  // Try direct match
  const exact = teams.find(t => t.team_name === str || t.team_name.toLowerCase() === str.toLowerCase());
  if (exact) return exact.team_name;
  // Try with prefix
  if (prefix) {
    const withPrefix = prefix + str;
    const prefixed = teams.find(t => t.team_name === withPrefix || t.team_name.toLowerCase() === withPrefix.toLowerCase());
    if (prefixed) return prefixed.team_name;
  }
  return str; // return as-is if no match
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
  const [rawData, setRawData] = useState([]); // all rows as array of arrays
  const [headers, setHeaders] = useState([]); // detected header labels
  const [mapping, setMapping] = useState({}); // { excelColIndex: systemFieldKey }
  const [parsedRows, setParsedRows] = useState([]); // after applying mapping
  const [teams, setTeams] = useState([]);
  const [teamPrefix, setTeamPrefix] = useState('ช่าง'); // For admin to prepend to unmatched teams
  const [loading, setLoading] = useState(false);
  const [importResult, setImportResult] = useState(null); // { success, skipped, errors }
  const [notification, setNotification] = useState('');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Fetch teams for normalizing team names
      axios.get('/users/teams').then(r => setTeams(r.data || [])).catch(() => {});
      // Reset
      setStep(defaultJobType ? 2 : 1);
      setJobType(defaultJobType || 'office');
      setHeaderRow(1);
      setFile(null);
      setWorkbook(null);
      setRawData([]);
      setHeaders([]);
      setMapping({});
      setParsedRows([]);
      setTeamPrefix('ช่าง');
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

  // ─── Step 2: Upload file & choose header row ───────────────────────────────
  function handleFileChange(e) {
    const sel = e.target.files[0];
    if (!sel) return;
    setFile(sel);
    setRawData([]);
    setHeaders([]);
    setMapping({});

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary', cellDates: false });
        setWorkbook(wb);
      } catch (err) {
        setNotification('ไม่สามารถอ่านไฟล์ Excel ได้');
      }
    };
    reader.readAsBinaryString(sel);
  }

  function handleProceedToMapping() {
    if (!workbook) { setNotification('กรุณาอัปโหมดไฟล์ Excel ก่อน'); return; }
    const ws = workbook.Sheets[workbook.SheetNames[0]];
    const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });
    if (allRows.length < headerRow) { setNotification('ไฟล์มีข้อมูลไม่เพียงพอ'); return; }

    setRawData(allRows);
    const hdrs = (allRows[headerRow - 1] || []).map(h => String(h || '').trim());
    setHeaders(hdrs);

    // Auto-match columns using keyword heuristics
    const autoMap = {};
    const fieldKeywords = {
      access_no:         ['access', 'เลขที่', 'access no', 'รหัส'],
      customer:          ['customer', 'ชื่อ', 'ลูกค้า'],
      phone:             ['phone', 'เบอร์', 'โทร', 'tel'],
      plan_arrival_date: ['date', 'วัน', 'plan date', 'วันที่นัด', 'plan_date', 'plan_arrival_date'],
      plan_arrival_time: ['time', 'เวลา', 'plan time', 'plan_time'],
      address:           ['address', 'ที่อยู่'],
      team_id:           ['team', 'ทีม'],
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
            disabled={!workbook}
            className="px-6 py-2.5 rounded-xl font-bold text-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: workbook ? '0 2px 8px rgba(163,230,53,0.3)' : 'none' }}
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
          // Normalize team name → id
          const rawName = String(val).trim();
          const normalizedName = normalizeTeamName(rawName, teams, teamPrefix);
          const found = teams.find(t => t.team_name === normalizedName || t.team_name.toLowerCase() === normalizedName.toLowerCase());
          obj['_team_name_display'] = normalizedName;
          val = found ? found.id : null;
          if (!val) obj['_team_name_unmatched'] = rawName;
        } else {
          val = String(val).trim();
        }
        obj[fieldKey] = val;
      });
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
        </div>

        {/* Unmatched team warning */}
        {unmatchedTeam.length > 0 && (
          <div className="mb-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <h4 className="text-sm font-bold text-amber-800 flex items-center gap-2 mb-2">
              ⚠️ ชื่อทีมไม่ตรงกับระบบ (จะนำเข้าโดยไม่ระบุทีม):
            </h4>
            <div className="flex flex-wrap gap-2 mb-3">
              {[...new Set(unmatchedTeam.map(r => r._team_name_unmatched))].map((name, i) => (
                <span key={i} className="px-2 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-lg shadow-sm border border-amber-200">{name}</span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row sm:items-end gap-3 mt-4 pt-3 border-t border-amber-200/60">
              <div className="flex-1 max-w-xs">
                <label className="block text-[11px] font-bold text-amber-800 mb-1">ลองเติมคำนำหน้าชื่อช่าง (เช่น 'ช่าง', 'ทีม'):</label>
                <input 
                  type="text" 
                  value={teamPrefix}
                  onChange={(e) => setTeamPrefix(e.target.value)}
                  placeholder="เช่น ช่าง"
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-semibold text-amber-900 bg-white"
                />
              </div>
              <button 
                onClick={handleBuildPreview}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
              >
                🔄 จับคู่ใหม่
              </button>
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
                  .filter(([, v]) => v !== IGNORE_KEY && v !== 'team_id')
                  .slice(0, 6)
                  .map(([idx, key]) => {
                    const field = SYSTEM_FIELDS.find(f => f.key === key);
                    return <th key={idx} className="px-3 py-2 text-left font-bold text-[#374151] whitespace-nowrap">{field?.label || key}</th>;
                  })}
                <th className="px-3 py-2 text-left font-bold text-[#374151]">ทีมช่าง</th>
              </tr>
            </thead>
            <tbody>
              {validRows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]">
                  <td className="px-3 py-2 text-[#9CA3AF]">{i + 1}</td>
                  {Object.entries(mapping)
                    .filter(([, v]) => v !== IGNORE_KEY && v !== 'team_id')
                    .slice(0, 6)
                    .map(([idx, key]) => (
                      <td key={idx} className="px-3 py-2 text-[#374151] max-w-[120px] truncate">{row[key] || '-'}</td>
                    ))}
                  <td className="px-3 py-2 text-[#374151]">
                    {row._team_name_display ? (
                      row.team_id
                        ? <span className="text-emerald-600 font-semibold">{row._team_name_display}</span>
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
        const { _team_name_display, _team_name_unmatched, ...rest } = row;
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
