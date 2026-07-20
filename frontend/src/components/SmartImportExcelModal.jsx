import { useState, useRef, useEffect } from 'react';
import axios from '../api/axios';
import * as XLSX from 'xlsx';
import { AppSelectField } from './DispatchFilterFields';

// ─── Field definitions for the system ─────────────────────────────────────────
// group: 'required' (จำเป็น) | 'recommended' (แนะนำ) | 'extra' (เพิ่มเติม)
const OFFICE_SYSTEM_FIELDS = [
  { key: 'access_no',         label: 'Access No / NON / รหัสงาน',  required: true,  group: 'required' },
  { key: 'customer',          label: 'ชื่อลูกค้า',                 required: false, group: 'recommended' },
  { key: 'phone',             label: 'เบอร์โทร',                   required: false, group: 'recommended' },
  { key: 'plan_arrival_date', label: 'วันที่เข้างาน (YYYY-MM-DD)', required: false, group: 'recommended' },
  { key: 'plan_arrival_time', label: 'เวลาเข้างาน (HH:MM)',        required: false, group: 'recommended' },
  { key: 'address',           label: 'ที่อยู่ / พื้นที่',           required: false, group: 'recommended' },
  { key: 'team_id',           label: 'ทีมช่าง (ชื่อทีม)',           required: false, group: 'recommended' },
  { key: '_engineer_name',    label: 'ชื่อช่าง → หาทีม/รับเหมารายคน',  required: false, group: 'recommended' },
  { key: 'product',           label: 'สินค้า',                     required: false, group: 'extra' },
  { key: 'package',           label: 'แพ็กเกจ',                   required: false, group: 'extra' },
  { key: 'service_note',      label: 'รายละเอียดงาน (Service Note)', required: false, group: 'extra' },
  { key: 'remark',            label: 'หมายเหตุ',                   required: false, group: 'extra' },
  { key: 'lat',               label: 'ละติจูด',                    required: false, group: 'extra' },
  { key: 'lng',               label: 'ลองจิจูด',                   required: false, group: 'extra' },
  { key: 'order_no',          label: 'Order No',                   required: false, group: 'extra' },
  { key: 'area_code',         label: 'Area Code',                  required: false, group: 'extra' },
  { key: 'area_name',         label: 'Area Name / พื้นที่',         required: false, group: 'extra' },
  { key: 'province',          label: 'จังหวัด',                    required: false, group: 'extra' },
  { key: 'task_type',         label: 'ประเภทงาน (Task Type)',       required: false, group: 'extra' },
  { key: 'product_owner',     label: 'Product Owner',              required: false, group: 'extra' },
];

const MA_SYSTEM_FIELDS = [
  { key: 'non_number',        label: 'เลข NON',                    required: true,  group: 'required' },
  { key: 'customer',          label: 'ชื่อลูกค้า',                 required: true,  group: 'required' },
  { key: 'job_time',          label: 'เวลา',                       required: false, group: 'recommended' },
  { key: 'phone',             label: 'เบอร์โทร',                   required: false, group: 'recommended' },
  { key: 'symptoms',          label: 'อาการ',                      required: false, group: 'recommended' },
  { key: 'address',           label: 'ที่อยู่',                    required: false, group: 'recommended' },
  { key: 'team_id',           label: 'ทีมช่าง (ชื่อทีม)',           required: false, group: 'recommended' },
  { key: '_engineer_name',    label: 'ชื่อช่าง → หาทีม/รับเหมารายคน', required: false, group: 'recommended' },
  { key: 'plan_arrival_date', label: 'วันที่เข้างาน (YYYY-MM-DD)', required: false, group: 'recommended' },
  { key: 'area_name',         label: 'พื้นที่',                    required: false, group: 'extra' },
  { key: 'remark',            label: 'หมายเหตุ',                   required: false, group: 'extra' },
];

const ALIAS_LS_KEY = 'excel-engineer-aliases';
const PROFILE_LS_KEY = 'excel-mapping-profiles';

// ─── Keyword heuristics for auto-matching Excel headers to system fields ──────
const FIELD_KEYWORDS = {
  access_no:         ['access', 'เลขที่', 'access no', 'รหัส', 'non', 'เลขnon', 'เลข non'],
  non_number:        ['non', 'เลขnon', 'เลข non', 'เลข NON', 'non number'],
  customer:          ['customer', 'ชื่อลูกค้า', 'ลูกค้า'],
  phone:             ['phone', 'เบอร์', 'โทร', 'tel'],
  plan_arrival_date: ['date', 'วัน', 'plan date', 'วันที่นัด', 'plan_date', 'plan_arrival_date'],
  plan_arrival_time: ['plan time', 'plan_time', 'เวลาเข้า', 'time', 'เวลา', 'job time'],
  job_time:          ['time', 'เวลา', 'job time', 'job_time'],
  address:           ['address', 'ที่อยู่'],
  symptoms:          ['symptoms', 'อาการ', 'ปัญหา'],
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
  area_name:         ['area name', 'ชื่อพื้นที่', 'พื้นที่', 'area'],
  province:          ['province', 'จังหวัด'],
  task_type:         ['task type', 'ประเภทงาน'],
  product_owner:     ['owner', 'product owner'],
};

/** Auto-detect which row is the header (1-based) by scoring keyword hits + text cells */
function detectHeaderRow(rows) {
  let best = 1;
  let bestScore = -1;
  const limit = Math.min(rows.length, 5);
  for (let r = 0; r < limit; r++) {
    const row = rows[r] || [];
    let kwHits = 0;
    let textCells = 0;
    row.forEach((cell) => {
      if (cell === null || cell === undefined || String(cell).trim() === '') return;
      if (typeof cell === 'string' && isNaN(Number(cell))) textCells++;
      const s = String(cell).trim().toLowerCase();
      for (const kws of Object.values(FIELD_KEYWORDS)) {
        if (kws.some((kw) => s.includes(kw))) { kwHits++; break; }
      }
    });
    const score = kwHits * 3 + textCells;
    if (kwHits > 0 && score > bestScore) {
      bestScore = score;
      best = r + 1;
    }
  }
  return best;
}

/** Build auto field→column mapping from headers.
 *  Stored as { fieldKey: colIdx } so several fields (e.g. date + time in one
 *  datetime column) can share the same Excel column. */
function buildAutoMapping(hdrs, systemFields) {
  const validKeys = new Set(systemFields.map((f) => f.key));
  const autoMap = {};
  hdrs.forEach((h, idx) => {
    const lower = String(h || '').toLowerCase();
    if (!lower) return;
    for (const [fieldKey, keywords] of Object.entries(FIELD_KEYWORDS)) {
      if (!validKeys.has(fieldKey) || autoMap[fieldKey] !== undefined) continue;
      if (keywords.some((kw) => lower.includes(kw))) {
        autoMap[fieldKey] = idx;
        break;
      }
    }
  });
  return autoMap;
}

/** Excel-style column letter: 0→A, 1→B, 26→AA */
function colLabel(idx) {
  let s = '';
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

/** Signature of a header layout so we can remember mapping profiles per file format */
function headerSignature(hdrs) {
  return hdrs.map((h) => String(h || '').normalize('NFKC').trim().toLowerCase()).join('|');
}

function readMappingProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILE_LS_KEY) || '{}') || {};
  } catch { return {}; }
}

function readLocalAliases() {
  try {
    return JSON.parse(localStorage.getItem(ALIAS_LS_KEY) || '{}') || {};
  } catch { return {}; }
}

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

// ─── Helper: resolve assignee from engineer nickname or team name ────────────
const CONTRACTOR_ROLES = ['contractor_office', 'contractor_ma'];

function userIsContractor(user) {
  if (!user) return false;
  const roles = user.roles || (user.roles_csv ? String(user.roles_csv).split(',') : [user.role]);
  return roles.some((r) => CONTRACTOR_ROLES.includes(r));
}

/** Normalize Thai engineer/team names for matching (เจมส์ ≈ ช่างเจมส์ ≈ ช่าง เจมส์) */
function normalizePersonName(name) {
  return String(name || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/^ช่าง\s*/g, '')
    .replace(/^ทีม\s*/g, '')
    .replace(/[\s\-_.]+/g, '')
    .replace(/[()（）[\]【】]/g, '');
}

/**
 * Resolve Excel engineer/team name.
 * Order: exact normalized alias/name → exact team → unmatched (no fuzzy substring).
 * Always keep assignee id when an individual matches.
 */
function resolveTeamFromName(rawName, teams, allUsers, aliases = {}) {
  if (!rawName) {
    return {
      teamId: null,
      teamName: '',
      engineerName: '',
      fieldEngineerId: null,
      isContractor: false,
      unmatched: null,
      ambiguous: false,
    };
  }

  const raw = String(rawName).trim();
  const core = normalizePersonName(raw);

  // Alias map: normalized excel nickname → user id (legacy) or { user_id } / { team_id }
  const aliasVal = core ? aliases[core] : null;
  const aliasUserId = aliasVal && typeof aliasVal === 'object' ? aliasVal.user_id : aliasVal;
  const aliasTeamId = aliasVal && typeof aliasVal === 'object' ? aliasVal.team_id : null;
  if (aliasTeamId) {
    const aliasTeam = teams.find((t) => String(t.id) === String(aliasTeamId));
    if (aliasTeam) {
      return {
        teamId: aliasTeam.id,
        teamName: aliasTeam.team_name,
        engineerName: '',
        fieldEngineerId: null,
        isContractor: false,
        unmatched: null,
        ambiguous: false,
      };
    }
  }
  if (aliasUserId) {
    const aliasUser = allUsers.find((u) => String(u.id) === String(aliasUserId));
    if (aliasUser) {
      if (userIsContractor(aliasUser)) {
        return {
          teamId: null,
          teamName: 'รับเหมา (รายคน)',
          engineerName: aliasUser.full_name,
          fieldEngineerId: aliasUser.id,
          isContractor: true,
          unmatched: null,
          ambiguous: false,
        };
      }
      const team = aliasUser.team_id ? teams.find((t) => t.id === aliasUser.team_id) : null;
      return {
        teamId: aliasUser.team_id || null,
        teamName: team ? team.team_name : (aliasUser.full_name || ''),
        engineerName: aliasUser.full_name,
        fieldEngineerId: aliasUser.id,
        isContractor: false,
        unmatched: null,
        ambiguous: false,
      };
    }
  }

  const exactUsers = allUsers.filter(
    (u) => u.full_name && normalizePersonName(u.full_name) === core
  );
  if (exactUsers.length > 1) {
    return {
      teamId: null,
      teamName: raw,
      engineerName: '',
      fieldEngineerId: null,
      isContractor: false,
      unmatched: raw,
      ambiguous: true,
      candidates: exactUsers.map((u) => ({ id: u.id, name: u.full_name })),
    };
  }
  if (exactUsers.length === 1) {
    const matchedUser = exactUsers[0];
    if (userIsContractor(matchedUser)) {
      return {
        teamId: null,
        teamName: 'รับเหมา (รายคน)',
        engineerName: matchedUser.full_name,
        fieldEngineerId: matchedUser.id,
        isContractor: true,
        unmatched: null,
        ambiguous: false,
      };
    }
    const team = matchedUser.team_id ? teams.find((t) => t.id === matchedUser.team_id) : null;
    return {
      teamId: matchedUser.team_id || null,
      teamName: team ? team.team_name : matchedUser.full_name,
      engineerName: matchedUser.full_name,
      fieldEngineerId: matchedUser.id,
      isContractor: false,
      unmatched: null,
      ambiguous: false,
    };
  }

  // Ends-with core only when unique (ช่างเจมส์ สุขใจ)
  const endsWithUsers = allUsers.filter((u) => {
    if (!u.full_name) return false;
    const n = normalizePersonName(u.full_name);
    return n === core || n.endsWith(core) || core.endsWith(n);
  });
  if (endsWithUsers.length === 1 && core.length >= 2) {
    const matchedUser = endsWithUsers[0];
    if (userIsContractor(matchedUser)) {
      return {
        teamId: null,
        teamName: 'รับเหมา (รายคน)',
        engineerName: matchedUser.full_name,
        fieldEngineerId: matchedUser.id,
        isContractor: true,
        unmatched: null,
        ambiguous: false,
      };
    }
    const team = matchedUser.team_id ? teams.find((t) => t.id === matchedUser.team_id) : null;
    return {
      teamId: matchedUser.team_id || null,
      teamName: team ? team.team_name : matchedUser.full_name,
      engineerName: matchedUser.full_name,
      fieldEngineerId: matchedUser.id,
      isContractor: false,
      unmatched: null,
      ambiguous: false,
    };
  }
  if (endsWithUsers.length > 1) {
    return {
      teamId: null,
      teamName: raw,
      engineerName: '',
      fieldEngineerId: null,
      isContractor: false,
      unmatched: raw,
      ambiguous: true,
      candidates: endsWithUsers.map((u) => ({ id: u.id, name: u.full_name })),
    };
  }

  const exactTeam = teams.find((t) => normalizePersonName(t.team_name) === core);
  if (exactTeam) {
    return {
      teamId: exactTeam.id,
      teamName: exactTeam.team_name,
      engineerName: '',
      fieldEngineerId: null,
      isContractor: false,
      unmatched: null,
      ambiguous: false,
    };
  }

  return {
    teamId: null,
    teamName: raw,
    engineerName: '',
    fieldEngineerId: null,
    isContractor: false,
    unmatched: raw,
    ambiguous: false,
  };
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
  const [headerRowMode, setHeaderRowMode] = useState('auto'); // 'auto' | 1 | 2
  const [headerRow, setHeaderRow] = useState(1); // effective header row (1-based)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [sheetMeta, setSheetMeta] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [rawData, setRawData] = useState([]); // all rows as array of arrays
  const [headers, setHeaders] = useState([]); // detected header labels
  const [mapping, setMapping] = useState({}); // { excelColIndex: systemFieldKey }
  const [autoFields, setAutoFields] = useState(new Set()); // auto-mapped fields pending review
  const [extraOpen, setExtraOpen] = useState(false);
  const [savedProfile, setSavedProfile] = useState(null); // saved mapping profile for this layout
  const [profileChoice, setProfileChoice] = useState(''); // '' | 'applied' | 'review' | 'fresh'
  const [parsedRows, setParsedRows] = useState([]); // after applying mapping
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [dbAliases, setDbAliases] = useState({}); // normalized_alias → { user_id, team_id }
  const [preflight, setPreflight] = useState(null); // { ready, errors, duplicates }
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
      setHeaderRowMode('auto');
      setHeaderRow(1);
      setShowAdvanced(false);
      setFile(null);
      setWorkbook(null);
      setSheetNames([]);
      setSheetMeta([]);
      setSelectedSheet('');
      setShowSheetPicker(false);
      setRawData([]);
      setHeaders([]);
      setMapping({});
      setAutoFields(new Set());
      setExtraOpen(false);
      setSavedProfile(null);
      setProfileChoice('');
      setParsedRows([]);
      setPreflight(null);
      setImportResult(null);
      setNotification('');
    }
  }, [isOpen, defaultJobType]);

  // Load shared aliases from server (graceful when endpoint is unavailable)
  useEffect(() => {
    if (!isOpen) return;
    axios.get('/dispatch/import-aliases', { params: { job_type: jobType } })
      .then((r) => {
        const map = {};
        (r.data || []).forEach((row) => {
          if (!row.normalized_alias) return;
          map[row.normalized_alias] = { user_id: row.user_id || null, team_id: row.team_id || null };
        });
        setDbAliases(map);
      })
      .catch(() => setDbAliases({}));
  }, [isOpen, jobType]);

  if (!isOpen) return null;

  const SYSTEM_FIELDS = jobType === 'ma' ? MA_SYSTEM_FIELDS : OFFICE_SYSTEM_FIELDS;

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

    // Auto-detect header row unless the user overrode it in advanced options
    const effectiveHeaderRow = headerRowMode === 'auto' ? detectHeaderRow(allRows) : Number(headerRowMode);
    if (allRows.length < effectiveHeaderRow) { setNotification('ไฟล์มีข้อมูลไม่เพียงพอ'); return; }
    setHeaderRow(effectiveHeaderRow);

    setRawData(allRows);
    const hdrs = (allRows[effectiveHeaderRow - 1] || []).map(h => String(h || '').trim());
    setHeaders(hdrs);

    // Auto-match columns using keyword heuristics
    const autoMap = buildAutoMapping(hdrs, SYSTEM_FIELDS);
    setMapping(autoMap);
    setAutoFields(new Set(Object.keys(autoMap)));

    // Look up a saved mapping profile for this job type + header layout
    const profiles = readMappingProfiles();
    const profile = profiles[`${jobType}::${headerSignature(hdrs)}`] || null;
    setSavedProfile(profile);
    setProfileChoice('');
    setStep(3);
  }

  function renderStep2() {
    return (
      <div className="space-y-5">
        <h3 className="text-lg font-bold text-[#1F2937]">อัปโหลดไฟล์ Excel</h3>

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

        {/* Advanced options: header row override (auto-detected by default) */}
        <div className="rounded-xl border border-[#E5E7EB] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-[#F9FAFB] hover:bg-[#F3F4F6] transition-colors"
          >
            <span className="text-xs font-bold text-[#6B7280] flex items-center gap-2">
              ⚙️ ตัวเลือกขั้นสูง
              <span className="text-[10px] font-medium text-[#9CA3AF]">
                (หัวตาราง: {headerRowMode === 'auto' ? 'ตรวจจับอัตโนมัติ' : `แถวที่ ${headerRowMode}`})
              </span>
            </span>
            <svg className={`w-4 h-4 text-[#9CA3AF] transition-transform ${showAdvanced ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {showAdvanced && (
            <div className="p-4 bg-white border-t border-[#F3F4F6]">
              <p className="text-xs font-bold text-[#374151] mb-2">แถวหัวตาราง (Header)</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { val: 'auto', label: 'อัตโนมัติ', desc: 'ระบบตรวจจับให้', emoji: '✨' },
                  { val: 1,      label: 'แถวที่ 1',  desc: 'Row 1 = Header', emoji: '1️⃣' },
                  { val: 2,      label: 'แถวที่ 2',  desc: 'Row 1 = Title',  emoji: '2️⃣' },
                ].map(opt => (
                  <button
                    key={opt.val}
                    onClick={() => setHeaderRowMode(opt.val)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      headerRowMode === opt.val
                        ? 'border-[#A3E635] bg-[#A3E635]/10 shadow-md'
                        : 'border-[#E5E7EB] bg-white hover:border-[#A3E635]/50'
                    }`}
                  >
                    <div className="text-base mb-0.5">{opt.emoji}</div>
                    <p className="font-bold text-[#1F2937] text-xs">{opt.label}</p>
                    <p className="text-[#9CA3AF] text-[10px]">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
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

  // ─── Step 3: Guided field mapping ─────────────────────────────────────────
  /** Convert a saved profile (field → header label) to a field→column mapping */
  function profileToMapping(profile) {
    const next = {};
    Object.entries(profile?.fieldToHeader || {}).forEach(([fieldKey, headerLabel]) => {
      if (!SYSTEM_FIELDS.some((f) => f.key === fieldKey)) return;
      const idx = headers.findIndex((h) => h === headerLabel);
      if (idx >= 0) next[fieldKey] = idx;
    });
    return next;
  }

  function renderStep3() {
    const dataStartRow = headerRow; // 0-indexed: headerRow-1 is header, data starts at headerRow

    // mapping is fieldKey → colIdx; several fields may share one column
    const inverse = mapping;

    const requiredFields = SYSTEM_FIELDS.filter((f) => f.group === 'required');
    const missingRequired = requiredFields.filter((f) => inverse[f.key] === undefined);

    function fieldStatus(f) {
      if (inverse[f.key] !== undefined) return autoFields.has(f.key) ? 'review' : 'mapped';
      return f.required ? 'missing' : 'unused';
    }

    function statusChip(status) {
      const map = {
        mapped:  { text: 'จับคู่แล้ว', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
        review:  { text: 'ตรวจสอบ',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
        missing: { text: 'ยังขาด',    cls: 'bg-red-100 text-red-600 border-red-200' },
        unused:  { text: 'ไม่ใช้',    cls: 'bg-[#F3F4F6] text-[#9CA3AF] border-[#E5E7EB]' },
      };
      const s = map[status];
      return <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border shrink-0 ${s.cls}`}>{s.text}</span>;
    }

    const DATE_FIELD_KEYS = ['plan_arrival_date'];
    const TIME_FIELD_KEYS = ['plan_arrival_time', 'job_time'];

    /** Render a raw cell for humans — converts Excel date/time serials to readable text */
    function formatSampleValue(v, fieldKey) {
      if (typeof v === 'number') {
        if (fieldKey && DATE_FIELD_KEYS.includes(fieldKey)) return parseExcelDate(v);
        if (fieldKey && TIME_FIELD_KEYS.includes(fieldKey)) return parseExcelTime(v);
        // No field context: guess from the serial range Excel uses for dates (1954–2064)
        if (v > 0 && v < 1) return parseExcelTime(v);
        if (v >= 20000 && v < 60000) {
          const datePart = parseExcelDate(v);
          const hasTime = v % 1 !== 0;
          return hasTime ? `${datePart} ${parseExcelTime(v)}` : datePart;
        }
      }
      return String(v);
    }

    function sampleValues(colIdx, count = 3, fieldKey = null) {
      const out = [];
      for (let r = dataStartRow; r < rawData.length && out.length < count; r++) {
        const v = (rawData[r] || [])[colIdx];
        if (v !== null && v !== undefined && String(v).trim() !== '') {
          out.push(formatSampleValue(v, fieldKey).substring(0, 25));
        }
      }
      return out;
    }

    function handleFieldColumnChange(fieldKey, colIdxStr) {
      setMapping(prev => {
        const next = { ...prev };
        if (colIdxStr === '' || colIdxStr === undefined) {
          delete next[fieldKey];
        } else {
          next[fieldKey] = parseInt(colIdxStr);
        }
        return next;
      });
      // User made an explicit choice — no longer "needs review"
      setAutoFields(prev => { const n = new Set(prev); n.delete(fieldKey); return n; });
      setImportResult(null);
    }

    function confirmField(fieldKey) {
      setAutoFields(prev => { const n = new Set(prev); n.delete(fieldKey); return n; });
    }

    function columnOptionsFor(fieldKey) {
      return headers.map((h, idx) => {
        // Other fields already reading this column (sharing is allowed, e.g. date + time)
        const usedByKeys = Object.keys(mapping).filter((k) => mapping[k] === idx && k !== fieldKey);
        const usedByLabels = usedByKeys
          .map((k) => SYSTEM_FIELDS.find((f) => f.key === k)?.label)
          .filter(Boolean);
        const samples = sampleValues(idx, 1, fieldKey);
        return {
          value: String(idx),
          label: `${colLabel(idx)} · ${h || `คอลัมน์ ${idx + 1}`}${samples[0] ? ` (เช่น ${samples[0]})` : ''}${usedByLabels.length ? ` — ใช้ร่วมกับ ${usedByLabels.join(', ')}` : ''}`,
        };
      });
    }

    function renderFieldCard(f) {
      const status = fieldStatus(f);
      const colIdx = inverse[f.key];
      const colIdxStr = colIdx !== undefined ? String(colIdx) : undefined;
      const samples = colIdx !== undefined ? sampleValues(Number(colIdx), 3, f.key) : [];
      return (
        <div
          key={f.key}
          className={`p-3 rounded-xl border transition-all ${
            status === 'missing' ? 'border-red-300 bg-red-50/50' :
            status === 'review' ? 'border-amber-300 bg-amber-50/40' :
            status === 'mapped' ? 'border-[#A3E635]/40 bg-[#A3E635]/5' :
            'border-[#E5E7EB] bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-xs font-bold text-[#374151] truncate">
              {f.label}{f.required && <span className="text-red-500 ml-0.5">*</span>}
            </p>
            <div className="flex items-center gap-1.5">
              {status === 'review' && (
                <button
                  type="button"
                  onClick={() => confirmField(f.key)}
                  className="px-2 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full hover:bg-emerald-100 transition-colors"
                >
                  ✓ ถูกต้อง
                </button>
              )}
              {statusChip(status)}
            </div>
          </div>
          <p className="text-[10px] text-[#9CA3AF] mb-1.5">ข้อมูลนี้อยู่คอลัมน์ไหน?</p>
          <AppSelectField
            label=""
            value={colIdxStr ?? ''}
            onChange={(v) => handleFieldColumnChange(f.key, v)}
            options={columnOptionsFor(f.key)}
            placeholder="— ไม่ใช้คอลัมน์ไหน —"
            searchable
            allowClear
          />
          {samples.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              <span className="text-[10px] text-[#9CA3AF]">ตัวอย่าง:</span>
              {samples.map((s, i) => (
                <span key={i} className="px-1.5 py-0.5 bg-white text-[#6B7280] text-[10px] rounded border border-[#E5E7EB] max-w-[140px] truncate">{s}</span>
              ))}
            </div>
          )}
        </div>
      );
    }

    const groups = [
      { id: 'required',    label: 'จำเป็น',    icon: '🔴', fields: SYSTEM_FIELDS.filter(f => f.group === 'required') },
      { id: 'recommended', label: 'แนะนำ',     icon: '🟡', fields: SYSTEM_FIELDS.filter(f => f.group === 'recommended') },
      { id: 'extra',       label: 'เพิ่มเติม', icon: '⚪', fields: SYSTEM_FIELDS.filter(f => f.group === 'extra') },
    ];

    const counts = { mapped: 0, review: 0, missing: 0 };
    SYSTEM_FIELDS.forEach((f) => {
      const s = fieldStatus(f);
      if (counts[s] !== undefined) counts[s]++;
    });

    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-[#1F2937]">จับคู่ข้อมูลกับคอลัมน์ Excel</h3>
          <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2 py-1 rounded-lg shrink-0">
            {headers.length} คอลัมน์ · หัวตารางแถวที่ {headerRow}
          </span>
        </div>

        {/* Saved mapping profile banner */}
        {savedProfile && !profileChoice && (
          <div className="mb-3 p-4 bg-blue-50 rounded-xl border border-blue-200">
            <p className="text-sm font-bold text-blue-800 mb-0.5">💾 พบรูปแบบการจับคู่ที่เคยใช้กับไฟล์แบบนี้</p>
            <p className="text-[11px] text-blue-600 mb-3">
              บันทึกเมื่อ {savedProfile.savedAt ? new Date(savedProfile.savedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
              {' '}— ต้องการใช้รูปแบบเดิมหรือไม่?
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  const next = profileToMapping(savedProfile);
                  setMapping(next);
                  setAutoFields(new Set());
                  setProfileChoice('applied');
                  handleBuildPreview(next);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                ⚡ ใช้รูปแบบเดิม
              </button>
              <button
                type="button"
                onClick={() => {
                  setMapping(profileToMapping(savedProfile));
                  setAutoFields(new Set());
                  setProfileChoice('review');
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-blue-700 bg-white border border-blue-300 hover:bg-blue-100 transition-colors"
              >
                🔍 ตรวจสอบ
              </button>
              <button
                type="button"
                onClick={() => setProfileChoice('fresh')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-[#6B7280] bg-white border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors"
              >
                🔄 เริ่มใหม่
              </button>
            </div>
          </div>
        )}

        {/* Status summary */}
        <div className="flex gap-2 flex-wrap mb-3">
          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[11px] font-bold rounded-full border border-emerald-200">จับคู่แล้ว: {counts.mapped}</span>
          {counts.review > 0 && <span className="px-2.5 py-1 bg-amber-100 text-amber-700 text-[11px] font-bold rounded-full border border-amber-200">ตรวจสอบ: {counts.review}</span>}
          {counts.missing > 0 && <span className="px-2.5 py-1 bg-red-100 text-red-600 text-[11px] font-bold rounded-full border border-red-200">ยังขาด: {counts.missing}</span>}
        </div>

        <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
          {groups.map((g) => {
            if (g.fields.length === 0) return null;
            const isExtra = g.id === 'extra';
            const mappedInGroup = g.fields.filter((f) => inverse[f.key] !== undefined).length;
            return (
              <div key={g.id}>
                <button
                  type="button"
                  onClick={() => { if (isExtra) setExtraOpen(v => !v); }}
                  className={`w-full flex items-center gap-2 mb-1.5 ${isExtra ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span className="text-[11px] font-black text-[#6B7280] uppercase tracking-wide">{g.icon} {g.label}</span>
                  <span className="text-[10px] text-[#9CA3AF]">({mappedInGroup}/{g.fields.length})</span>
                  <span className="flex-1 h-px bg-[#E5E7EB]" />
                  {isExtra && (
                    <svg className={`w-3.5 h-3.5 text-[#9CA3AF] transition-transform ${extraOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  )}
                </button>
                {(!isExtra || extraOpen) && (
                  <div className="space-y-2">
                    {g.fields.map(renderFieldCard)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {missingRequired.length > 0 && (
          <div className="mt-3 p-2.5 bg-red-50 rounded-xl border border-red-200 text-xs font-semibold text-red-600">
            ⚠️ ต้องจับคู่ฟิลด์จำเป็นก่อน: {missingRequired.map(f => f.label).join(', ')}
          </div>
        )}

        <div className="flex justify-between mt-4">
          <button onClick={() => setStep(2)} className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-semibold hover:bg-[#F3F4F6]">← ย้อนกลับ</button>
          <button
            onClick={() => handleBuildPreview()}
            disabled={missingRequired.length > 0}
            className="px-6 py-2.5 rounded-xl font-bold text-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: missingRequired.length === 0 ? '0 2px 8px rgba(163,230,53,0.3)' : 'none' }}
          >
            ตรวจสอบข้อมูล →
          </button>
        </div>
      </div>
    );
  }

  // ─── Build preview rows from mapping ──────────────────────────────────────
  function buildRows(activeMapping) {
    const dataStart = headerRow; // 0-indexed, rows after header
    const cellHasData = (cell) => cell !== null && cell !== undefined && String(cell).trim() !== '';
    const mappedCols = Object.values(activeMapping).map(Number);
    const dataRows = rawData.slice(dataStart)
      .map((row, i) => ({ row, excelRowNo: dataStart + i + 1 }))
      // Skip rows with no data in any *mapped* column (footer/summary/stray rows)
      .filter(({ row }) => mappedCols.some((c) => cellHasData(row[c])));
    // DB aliases first, local aliases override
    const aliases = { ...dbAliases, ...readLocalAliases() };

    const applyResolved = (obj, resolved, rawName) => {
      if (resolved.fieldEngineerId) {
        obj.field_engineer_id = resolved.fieldEngineerId;
        if (jobType === 'ma') obj.assigned_user_id = resolved.fieldEngineerId;
      }
      if (resolved.teamId) {
        obj.team_id = resolved.teamId;
        obj['_team_name_display'] = resolved.teamName;
      }
      if (resolved.isContractor) {
        obj.team_id = null;
        obj['_is_contractor'] = true;
        obj['_team_name_display'] = 'รับเหมา (รายคน)';
      }
      if (resolved.engineerName) obj['_engineer_resolved'] = resolved.engineerName;
      if (resolved.ambiguous) {
        obj['_engineer_unmatched'] = rawName;
        obj['_ambiguous_candidates'] = resolved.candidates || [];
      } else if (!resolved.teamId && !resolved.fieldEngineerId) {
        obj['_team_name_unmatched'] = rawName;
        obj['_engineer_unmatched'] = rawName;
      } else {
        delete obj['_team_name_unmatched'];
        delete obj['_engineer_unmatched'];
      }
    };

    const built = dataRows.map(({ row, excelRowNo }) => {
      const obj = { _row_no: excelRowNo };
      // activeMapping is fieldKey → colIdx; fields may share the same column
      Object.entries(activeMapping).forEach(([fieldKey, colIdx]) => {
        let val = row[Number(colIdx)];
        if (val === null || val === undefined) { obj[fieldKey] = ''; return; }

        // Special transforms
        if (fieldKey === 'plan_arrival_date') {
          val = parseExcelDate(val);
        } else if (fieldKey === 'plan_arrival_time' || fieldKey === 'job_time') {
          val = parseExcelTime(val);
        } else if (fieldKey === 'team_id') {
          const rawName = String(val).trim();
          const resolved = resolveTeamFromName(rawName, teams, allUsers, aliases);
          applyResolved(obj, resolved, rawName);
          val = resolved.teamId;
        } else if (fieldKey === '_engineer_name') {
          const rawName = String(val).trim();
          obj['_engineer_name'] = rawName;
          const resolved = resolveTeamFromName(rawName, teams, allUsers, aliases);
          applyResolved(obj, resolved, rawName);
          val = rawName;
        } else {
          val = String(val).trim();
        }
        obj[fieldKey] = val;
      });

      return obj;
    });

    return built;
  }

  /** Strip display-only keys and normalize per-job-type fields before sending */
  function cleanRowsForImport(rows) {
    return rows.map(row => {
      const {
        _row_no,
        _team_name_display,
        _team_name_unmatched,
        _engineer_name,
        _engineer_unmatched,
        _engineer_resolved,
        _is_contractor,
        _ambiguous_candidates,
        ...rest
      } = row;
      // MA: map field_engineer_id → assigned_user_id; time → job_time
      if (jobType === 'ma') {
        if (rest.field_engineer_id && !rest.assigned_user_id) {
          rest.assigned_user_id = rest.field_engineer_id;
        }
        if (rest.plan_arrival_time && !rest.job_time) {
          rest.job_time = rest.plan_arrival_time;
        }
        if (!rest.non_number && rest.access_no) {
          rest.non_number = rest.access_no;
        }
      }
      return rest;
    });
  }

  function rowHasKeyNumber(r) {
    const has = (v) => String(v ?? '').trim() !== '';
    return jobType === 'ma' ? (has(r.non_number) || has(r.access_no)) : has(r.access_no);
  }

  function getValidRows(rows) {
    return rows.filter(rowHasKeyNumber);
  }

  /** Ask the server to validate + detect duplicates without inserting (graceful if unsupported) */
  async function runPreflight(rows) {
    setPreflight(null);
    const validRows = getValidRows(rows);
    if (validRows.length === 0) return;
    try {
      const endpoint = jobType === 'ma' ? '/dispatch/ma-jobs/bulk' : '/dispatch/jobs/bulk';
      const res = await axios.post(`${endpoint}?preflight=1`, { jobs: cleanRowsForImport(validRows) });
      if (res.data && (Array.isArray(res.data.errors) || Array.isArray(res.data.duplicates))) {
        setPreflight(res.data);
      }
    } catch {
      // Older backend without preflight support — skip silently
    }
  }

  /** Save the current mapping as a profile for this job type + header layout */
  function saveMappingProfile(activeMapping) {
    try {
      const fieldToHeader = {};
      Object.entries(activeMapping).forEach(([fieldKey, colIdx]) => {
        fieldToHeader[fieldKey] = headers[Number(colIdx)];
      });
      const profiles = readMappingProfiles();
      profiles[`${jobType}::${headerSignature(headers)}`] = {
        fieldToHeader,
        headerRow,
        savedAt: Date.now(),
      };
      localStorage.setItem(PROFILE_LS_KEY, JSON.stringify(profiles));
    } catch { /* localStorage full/unavailable */ }
  }

  function handleBuildPreview(mappingOverride) {
    const activeMapping = mappingOverride || mapping;

    // Block when required fields are unmapped
    const mappedKeys = new Set(Object.keys(activeMapping));
    const missing = SYSTEM_FIELDS.filter(f => f.required && !mappedKeys.has(f.key));
    if (missing.length > 0) {
      setNotification(`กรุณาจับคู่ฟิลด์จำเป็นก่อน: ${missing.map(f => f.label).join(', ')}`);
      return;
    }

    const built = buildRows(activeMapping);
    setParsedRows(built);
    saveMappingProfile(activeMapping);
    setImportResult(null);
    runPreflight(built);
    setStep(4);
  }

  // ─── Fix unmatched engineer/team from the preview step ─────────────────────
  async function handleFixAssignee(rawName, value) {
    // value: 'u:<userId>' or 't:<teamId>'
    if (!value) return;
    const core = normalizePersonName(rawName);
    if (!core) return;
    const [kind, id] = value.split(':');
    const userId = kind === 'u' ? parseInt(id) : null;
    const teamId = kind === 't' ? parseInt(id) : null;

    // 1) Save alias to localStorage
    try {
      const local = readLocalAliases();
      local[core] = userId ? { user_id: userId } : { team_id: teamId };
      localStorage.setItem(ALIAS_LS_KEY, JSON.stringify(local));
    } catch { /* localStorage unavailable */ }

    // 2) Share alias via server (graceful if endpoint doesn't exist yet)
    axios.post('/dispatch/import-aliases', {
      normalized_alias: core,
      user_id: userId || undefined,
      team_id: teamId || undefined,
      job_type: jobType,
    }).catch(() => {});

    // 3) Re-resolve rows with the new alias
    const rebuilt = buildRows(mapping);
    setParsedRows(rebuilt);
    runPreflight(rebuilt);
  }

  // ─── Step 4: Preview & Import ──────────────────────────────────────────────
  function renderStep4() {
    const validRows = getValidRows(parsedRows);
    const invalidRows = parsedRows.filter(r => !rowHasKeyNumber(r));

    // Unique unmatched engineer/team names (with ambiguous candidates if any)
    const unmatchedItems = [];
    const seenNames = new Set();
    parsedRows.forEach(r => {
      const name = r._engineer_unmatched || r._team_name_unmatched;
      if (!name || seenNames.has(name)) return;
      seenNames.add(name);
      unmatchedItems.push({
        name,
        count: parsedRows.filter(x => (x._engineer_unmatched || x._team_name_unmatched) === name).length,
        candidates: r._ambiguous_candidates || [],
      });
    });

    const baseAssigneeOptions = [
      ...teams.map(t => ({ value: `t:${t.id}`, label: `🚐 ทีม ${t.team_name}` })),
      ...allUsers
        .filter(u => u.full_name)
        .map(u => ({ value: `u:${u.id}`, label: `👷 ${u.full_name}${userIsContractor(u) ? ' (รับเหมา)' : ''}` })),
    ];

    const dupCount = preflight?.duplicates?.length || 0;
    const updateCount = preflight?.updateReady || 0;
    const unchangedCount = preflight?.unchanged?.length || 0;
    const insertCount = preflight ? (preflight.ready || 0) : validRows.length;
    const actionableCount = insertCount + updateCount;
    const keyLabel = jobType === 'ma' ? 'NON' : 'Access No';

    return (
      <div>
        <h3 className="text-base font-bold text-[#1F2937] mb-1">ตรวจสอบข้อมูลก่อนนำเข้า</h3>
        <p className="text-[11px] text-[#6B7280] mb-3">
          ถ้า{keyLabel}ตรงกับงานเดิม ระบบจะอัปเดตเฉพาะช่องที่มีการเปลี่ยนแปลง (ช่องว่างในไฟล์ไม่ทับข้อมูลเดิม) — ไม่เปลี่ยนจะข้าม
        </p>

        {/* Summary badges */}
        <div className="flex gap-2 flex-wrap mb-4">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
            ✅ งานใหม่: {insertCount} รายการ
          </span>
          {updateCount > 0 && (
            <span className="px-3 py-1 bg-sky-100 text-sky-700 text-xs font-bold rounded-full border border-sky-200">
              ✏️ จะอัปเดต: {updateCount} รายการ
            </span>
          )}
          {unchangedCount > 0 && (
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-full border border-slate-200">
              ⏭️ ไม่เปลี่ยน (ข้าม): {unchangedCount} รายการ
            </span>
          )}
          {invalidRows.length > 0 && (
            <span className="px-3 py-1 bg-red-100 text-red-600 text-xs font-bold rounded-full border border-red-200">
              ⚠️ ไม่มี{keyLabel}: {invalidRows.length} รายการ
              {' '}(แถว Excel: {invalidRows.slice(0, 8).map(r => r._row_no).filter(Boolean).join(', ')}{invalidRows.length > 8 ? ', ...' : ''})
            </span>
          )}
          {dupCount > 0 && (
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded-full border border-purple-200">
              🔁 ข้าม (ซ้ำในไฟล์/ปิดงานแล้ว): {dupCount} รายการ
            </span>
          )}
          {unmatchedItems.length > 0 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full border border-orange-200">
              👷 ช่าง/ทีมไม่ตรง: {unmatchedItems.length} ชื่อ
            </span>
          )}
        </div>

        {updateCount > 0 && (
          <div className="mb-3 p-3 bg-sky-50 rounded-xl border border-sky-200">
            <p className="text-xs font-bold text-sky-800 mb-1.5">✏️ จะอัปเดตงานเดิม ({keyLabel} ตรงกัน):</p>
            <div className="flex flex-wrap gap-1.5">
              {(preflight.updateJobs || []).slice(0, 12).map((d, i) => (
                <span key={i} className="px-2 py-0.5 bg-white text-sky-700 text-[10px] font-semibold rounded-lg border border-sky-200">
                  {d.access_no || d.non_number}
                  {d.changed?.length ? <span className="text-sky-400"> ({d.changed.slice(0, 3).join(', ')}{d.changed.length > 3 ? '…' : ''})</span> : null}
                </span>
              ))}
              {updateCount > 12 && (
                <span className="text-[10px] text-sky-500 font-semibold">... อีก {updateCount - 12} รายการ</span>
              )}
            </div>
          </div>
        )}

        {/* Duplicate detail from preflight */}
        {dupCount > 0 && (
          <div className="mb-3 p-3 bg-purple-50 rounded-xl border border-purple-200">
            <p className="text-xs font-bold text-purple-800 mb-1.5">🔁 รายการที่จะข้าม (ซ้ำในไฟล์ หรืองานปิดแล้ว):</p>
            <div className="flex flex-wrap gap-1.5">
              {preflight.duplicates.slice(0, 12).map((d, i) => (
                <span key={i} className="px-2 py-0.5 bg-white text-purple-700 text-[10px] font-semibold rounded-lg border border-purple-200">
                  {d.access_no || d.non_number} <span className="text-purple-400">({d.reason})</span>
                </span>
              ))}
              {preflight.duplicates.length > 12 && (
                <span className="text-[10px] text-purple-500 font-semibold">... อีก {preflight.duplicates.length - 12} รายการ</span>
              )}
            </div>
          </div>
        )}

        {/* Fix unmatched engineers/teams inline */}
        {unmatchedItems.length > 0 && (
          <div className="mb-3 p-4 bg-orange-50 rounded-xl border border-orange-200">
            <h4 className="text-sm font-bold text-orange-800 mb-1">👷 ชื่อช่าง/ทีมที่ไม่ตรงกับระบบ</h4>
            <p className="text-[11px] text-orange-600 mb-3">เลือกช่างหรือทีมที่ถูกต้อง — ระบบจะจำไว้ใช้ครั้งถัดไปอัตโนมัติ (หรือปล่อยว่างเพื่อนำเข้าโดยไม่ระบุทีม)</p>
            <div className="space-y-2">
              {unmatchedItems.map((item) => {
                const options = item.candidates.length > 0
                  ? [
                      ...item.candidates.map(c => ({ value: `u:${c.id}`, label: `⭐ ${c.name} (ใกล้เคียง)` })),
                      ...baseAssigneeOptions.filter(o => !item.candidates.some(c => `u:${c.id}` === o.value)),
                    ]
                  : baseAssigneeOptions;
                return (
                  <div key={item.name} className="grid grid-cols-[1fr_auto_1.2fr] items-center gap-2 p-2.5 bg-white rounded-xl border border-orange-100">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-orange-800 truncate">{item.name}</p>
                      <p className="text-[10px] text-orange-500">{item.count} รายการ{item.candidates.length > 0 ? ' · มีชื่อใกล้เคียง' : ''}</p>
                    </div>
                    <div className="text-orange-300">→</div>
                    <AppSelectField
                      label=""
                      value=""
                      onChange={(v) => handleFixAssignee(item.name, v)}
                      options={options}
                      placeholder="เลือกช่าง/ทีม..."
                      searchable
                      allowClear={false}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Preview table */}
        <div className="max-h-[35vh] overflow-auto rounded-xl border border-[#E5E7EB] mb-4" style={{ scrollbarWidth: 'thin' }}>
          <table className="w-full text-xs">
            <thead className="bg-[#F3F4F6] sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left font-bold text-[#374151]">#</th>
                {Object.keys(mapping)
                  .filter((key) => key !== 'team_id' && key !== '_engineer_name')
                  .slice(0, 6)
                  .map((key) => {
                    const field = SYSTEM_FIELDS.find(f => f.key === key);
                    return <th key={key} className="px-3 py-2 text-left font-bold text-[#374151] whitespace-nowrap">{field?.label || key}</th>;
                  })}
                {mapping['_engineer_name'] !== undefined && (
                  <th className="px-3 py-2 text-left font-bold text-[#374151]">ช่าง</th>
                )}
                <th className="px-3 py-2 text-left font-bold text-[#374151]">ทีมช่าง</th>
              </tr>
            </thead>
            <tbody>
              {validRows.slice(0, 50).map((row, i) => (
                <tr key={i} className="border-t border-[#F3F4F6] hover:bg-[#F9FAFB]">
                  <td className="px-3 py-2 text-[#9CA3AF]">{i + 1}</td>
                  {Object.keys(mapping)
                    .filter((key) => key !== 'team_id' && key !== '_engineer_name')
                    .slice(0, 6)
                    .map((key) => (
                      <td key={key} className="px-3 py-2 text-[#374151] max-w-[120px] truncate">{row[key] || '-'}</td>
                    ))}
                  {mapping['_engineer_name'] !== undefined && (
                    <td className="px-3 py-2 text-[#374151] max-w-[100px] truncate">
                      {row._engineer_name
                        ? row._engineer_unmatched
                          ? <span className="text-orange-500">{row._engineer_name} ⚠️</span>
                          : <span className="text-blue-600 font-semibold">{row._engineer_name}</span>
                        : '-'}
                    </td>
                  )}
                  <td className="px-3 py-2 text-[#374151]">
                    {row._is_contractor || row.field_engineer_id ? (
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        <span className="text-[10px] font-black text-[#1F2937] bg-[#A3E635] px-1.5 py-0.5 rounded">
                          รับเหมา
                        </span>
                        <span className="text-emerald-700 font-semibold">
                          {row._engineer_resolved || row._team_name_display || '-'}
                        </span>
                        <span className="text-[10px] text-[#9CA3AF]">(รายคน)</span>
                      </span>
                    ) : row._team_name_display ? (
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
          <div className={`p-3 rounded-xl text-sm font-semibold mb-3 ${(importResult.success > 0 || importResult.updated > 0) ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
            {(importResult.success > 0 || importResult.updated > 0)
              ? `✅ งานใหม่ ${importResult.success || 0} · อัปเดต ${importResult.updated || 0}${importResult.skipped > 0 ? ` · ข้าม ${importResult.skipped}` : ''}`
              : `❌ ไม่สามารถนำเข้าได้: ${importResult.error || 'เกิดข้อผิดพลาด'}`
            }
            {importResult.unchanged?.length > 0 && (
              <p className="text-[11px] font-medium mt-1 text-slate-600">
                ⏭️ ไม่เปลี่ยนแปลง: {importResult.unchanged.slice(0, 8).map(d => d.access_no || d.non_number).join(', ')}
                {importResult.unchanged.length > 8 ? ` ... อีก ${importResult.unchanged.length - 8}` : ''}
              </p>
            )}
            {importResult.duplicates?.length > 0 && (
              <p className="text-[11px] font-medium mt-1 text-emerald-600">
                🔁 ข้าม: {importResult.duplicates.slice(0, 8).map(d => d.access_no || d.non_number).join(', ')}
                {importResult.duplicates.length > 8 ? ` ... อีก ${importResult.duplicates.length - 8} รายการ` : ''}
              </p>
            )}
            {importResult.errors?.length > 0 && (
              <p className="text-[11px] font-medium mt-1 text-red-600">
                ⚠️ ผิดพลาด {importResult.errors.length} แถว: {importResult.errors.slice(0, 5).map(e => `แถว ${e.row}${e.error ? ` (${e.error})` : ''}`).join(', ')}
                {importResult.errors.length > 5 ? ' ...' : ''}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <button onClick={() => setStep(3)} disabled={loading} className="px-4 py-2.5 rounded-xl border border-[#E5E7EB] text-[#6B7280] font-semibold hover:bg-[#F3F4F6] disabled:opacity-50">← แก้ไขจับคู่</button>
          <button
            onClick={handleImport}
            disabled={loading || validRows.length === 0 || (preflight && actionableCount === 0)}
            className="px-6 py-2.5 rounded-xl font-bold text-[#1F2937] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all"
            style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' }}
          >
            {loading ? <span className="w-4 h-4 border-2 border-[#1F2937]/30 border-t-[#1F2937] rounded-full animate-spin" /> : '📥'}
            {preflight
              ? (updateCount > 0 ? `นำเข้า/อัปเดต ${actionableCount} รายการ` : `นำเข้า ${insertCount} รายการ`)
              : `นำเข้า ${validRows.length} รายการ`}
          </button>
        </div>
      </div>
    );
  }

  // ─── Perform import ────────────────────────────────────────────────────────
  async function handleImport() {
    const validRows = getValidRows(parsedRows);
    if (validRows.length === 0) return;

    setLoading(true);
    setImportResult(null);

    try {
      const cleanRows = cleanRowsForImport(validRows);
      const endpoint = jobType === 'ma' ? '/dispatch/ma-jobs/bulk' : '/dispatch/jobs/bulk';
      const res = await axios.post(endpoint, { jobs: cleanRows });

      const successCount = res.data.successCount ?? 0;
      const updatedCount = res.data.updatedCount ?? 0;
      const skippedCount = res.data.skippedCount || 0;
      const unchangedList = res.data.unchanged || [];
      const updateJobs = res.data.updateJobs || [];
      const dateChanged = updateJobs.some((u) => (u.changed || []).includes('plan_arrival_date'));

      setImportResult({
        success: successCount,
        updated: updatedCount,
        skipped: skippedCount,
        duplicates: res.data.duplicates || [],
        unchanged: unchangedList,
        errors: res.data.errors || [],
      });
      onSuccess?.({
        created: successCount,
        updated: updatedCount,
        unchanged: unchangedList.length,
        clearDateFilter: dateChanged || updatedCount > 0,
      });
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
