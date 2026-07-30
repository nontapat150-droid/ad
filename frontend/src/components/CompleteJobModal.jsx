import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { FilterSelectField, AppDateField } from './DispatchFilterFields';
import { showFriendlyError, PresetChips } from './dashboards/SharedComponents';
import { NoSnEquipmentModal } from './JobActionModals';
import { applyFrequentNoSnLocks, resolveRolesForComplete } from '../utils/frequentNoSn';
import { syncCableReelNoSn, parseCableMeters, isCableReelItem } from '../utils/cableReelSync';
import TechBagPreviewModal from './TechBagPreviewModal';

const BAG_DEVICE_SLOTS = [
  { role: 'ONU', label: 'SN ONU', dashOption: true },
  { role: 'PB', label: 'SN Playbox', dashOption: false },
  { role: 'Mesh', label: 'SN Mesh', dashOption: false },
  { role: 'SIM', label: 'SN Sim', dashOption: false },
  { role: 'Cam', label: 'SN IP Camera', dashOption: false },
];

const ROLE_INSTALL_PREFIX = {
  ONU: 'ONU', PB: 'PB', Mesh: 'Mesh', SIM: 'SIM', Cam: 'Cam',
};

const EMPTY_BAG_SELECTIONS = { ONU: '', PB: '', Mesh: '', SIM: '', Cam: '' };

const WIZARD_STEPS = [
  { key: 'info', label: 'ตรวจข้อมูลงาน', icon: '📋' },
  { key: 'devices', label: 'เลือกอุปกรณ์', icon: '📦' },
  { key: 'install', label: 'ผลติดตั้ง', icon: '🛠️' },
  { key: 'photos', label: 'รูป/ค่าแรกเข้า', icon: '📸' },
  { key: 'review', label: 'ตรวจสอบยืนยัน', icon: '✅' },
];

const DRAFT_KEY_PREFIX = 'office-complete-draft-';
const DRAFT_DEBOUNCE_MS = 400;

const draftKeyFor = (jobId) => `${DRAFT_KEY_PREFIX}${jobId}`;

function bagItemLabel(item) {
  const unit = item.unit || 'ชิ้น';
  const qty = Number(item.quantity) || 0;
  const name = item.product_name || 'สินค้า';
  const model = item.model_name || '-';
  if (!isSnBagItem(item)) {
    const holders = Array.isArray(item.holders) && item.holders.length > 1
      ? ` · ${item.holders.map((h) => `${h.owner_name} ${Number(h.quantity).toLocaleString()}`).join(', ')}`
      : '';
    return `${name} — ${model} · คงเหลือทีม ${qty.toLocaleString()} ${unit}${holders}`;
  }
  const sn = item.sn || '-';
  return `${name} — ${model} [SN: ${sn}] · คงเหลือ ${qty} ${unit}`;
}

function isSnBagItem(item) {
  return Number(item?.has_sn) === 1 || item?.has_sn === true;
}

function buildCompleteBagUrl(job, { isAdmin }) {
  if (job?.team_id) return `/inventory/my-bag?team_id=${job.team_id}`;
  const assigneeId = job?.field_engineer_id || job?.assigned_user_id;
  if (isAdmin && assigneeId) return `/inventory/my-bag?user_id=${assigneeId}`;
  return '/inventory/my-bag';
}

function fmtThaiDate(d) {
  if (!d) return '-';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return String(d);
  }
}

function parseInstallDeviceFields(str) {
  if (!str) return {};
  const map = {
    SOA: 'soa_device', ONU: 'sn_onu', PB: 'sn_playbox', Mesh: 'sn_mesh',
    SIM: 'sn_sim', Cam: 'sn_ip_camera', Sp: 'split_no', Pt: 'port_no',
    L3: 'l3_name', 'สาย': 'cable_length', '3BB': 'ref_id_3bb', 'SCฟ้า': 'sc_blue',
  };
  const out = {};
  for (const part of String(str).split(/[\n|]/)) {
    const line = part.trim();
    if (!line) continue;
    const ci = line.indexOf(':');
    if (ci === -1) continue;
    const key = line.slice(0, ci).trim();
    let val = line.slice(ci + 1).trim();
    const field = map[key];
    if (!field) continue;
    if (field === 'cable_length') val = val.replace(/M$/i, '');
    out[field] = val;
  }
  return out;
}

function resolveEvidenceUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  if (String(path).startsWith('/')) return path;
  return `/uploads/job_evidence/${path}`;
}

/** Merge previously used job devices back into bag lists for re-selection in editMode. */
function mergeUsedDevicesIntoBag(snItems, noSnItems, usedDevices) {
  const sn = snItems.map((i) => ({ ...i }));
  const noSn = noSnItems.map((i) => ({ ...i }));
  const bagSelections = { ...EMPTY_BAG_SELECTIONS };
  const selectedNoSn = {};

  for (const d of usedDevices || []) {
    const id = d.inventory_item_id;
    if (!id) continue;
    const qty = Number(d.quantity) || 1;

    if (d.device_role === 'NoSN') {
      const idx = noSn.findIndex((i) => String(i.id) === String(id));
      if (idx >= 0) {
        noSn[idx] = {
          ...noSn[idx],
          quantity: Number(noSn[idx].quantity || 0) + qty,
        };
        selectedNoSn[id] = {
          ...noSn[idx],
          useQty: qty,
        };
      } else {
        const item = {
          id,
          product_name: d.product_name,
          model_name: d.model_name || '',
          quantity: qty,
          has_sn: 0,
          unit: d.unit || 'ชิ้น',
        };
        noSn.push(item);
        selectedNoSn[id] = { ...item, useQty: qty };
      }
      continue;
    }

    if (BAG_DEVICE_SLOTS.some((s) => s.role === d.device_role)) {
      if (!sn.some((i) => String(i.id) === String(id))) {
        sn.push({
          id,
          sn: d.sn,
          product_name: d.product_name,
          model_name: d.model_name || '',
          quantity: 1,
          has_sn: 1,
          unit: d.unit || 'ชิ้น',
        });
      }
      if (d.sn && d.sn !== '-') {
        bagSelections[d.device_role] = String(id);
      }
    }
  }

  return { sn, noSn, bagSelections, selectedNoSn };
}

function BagDeviceSelect({ role, label, value, onChange, bagItems, usedElsewhere, dashOption }) {
  const available = bagItems.filter(
    (item) => String(item.id) === String(value) || !usedElsewhere.has(item.id)
  );

  const options = available.map((item) => {
    const qty = Number(item.quantity) || 0;
    const sn = item.sn || item.serial_number || '';
    const isSn = isSnBagItem(item);
    return {
      value: String(item.id),
      label: bagItemLabel(item),
      sublabel: isSn && sn ? `SN: ${sn}` : null,
      searchText: [sn, item.product_name, item.model_name, item.unit].filter(Boolean).join(' '),
      disabled: qty < 1,
    };
  });

  if (dashOption) {
    options.unshift({ value: 'dash', label: 'ไม่มี (-)', searchText: 'ไม่มี dash -' });
  }

  return (
    <FilterSelectField
      label={label}
      value={value}
      onChange={(v) => onChange(role, v)}
      options={options}
      placeholder="เลือกจากกระเป๋าช่าง"
      searchable
      searchAlways
      searchPlaceholder="ค้นหา SN / รุ่น / ชื่อสินค้า..."
      icon={
        <svg className="w-3.5 h-3.5 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      }
    />
  );
}

function FieldHint({ message }) {
  if (!message) return null;
  return (
    <p className="text-[11px] font-bold text-red-500 mt-1 flex items-center gap-1 animate-fade-in">
      <span>⚠️</span> {message}
    </p>
  );
}

function StepIndicator({ current, onJump }) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-center">
        {WIZARD_STEPS.map((step, idx) => {
          const isDone = idx < current;
          const isActive = idx === current;
          return (
            <div key={step.key} className={`flex items-center ${idx < WIZARD_STEPS.length - 1 ? 'flex-1' : ''}`}>
              <button
                type="button"
                onClick={() => { if (idx < current) onJump(idx); }}
                disabled={idx >= current}
                className={`flex flex-col items-center gap-1 ${idx < current ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                    isActive
                      ? 'bg-[#185FA5] border-[#185FA5] text-white shadow-lg shadow-[#185FA5]/30 scale-110'
                      : isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'bg-white/70 border-slate-300 text-slate-400'
                  }`}
                >
                  {isDone ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    idx + 1
                  )}
                </span>
                <span className={`hidden sm:block text-[10px] font-bold whitespace-nowrap ${
                  isActive ? 'text-[#185FA5]' : isDone ? 'text-emerald-600' : 'text-slate-400'
                }`}>
                  {step.label}
                </span>
              </button>
              {idx < WIZARD_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1.5 sm:mb-4 rounded-full transition-colors ${
                  idx < current ? 'bg-emerald-400' : 'bg-slate-200'
                }`} />
              )}
            </div>
          );
        })}
      </div>
      {/* Current step label — mobile only */}
      <p className="sm:hidden text-center text-xs font-black text-[#185FA5] mt-2">
        {WIZARD_STEPS[current].icon} ขั้นตอนที่ {current + 1}/5 — {WIZARD_STEPS[current].label}
      </p>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="text-sm font-bold text-[#042C53] break-words">{value || '-'}</span>
    </div>
  );
}

export function CompleteJobModal({ isOpen, onClose, job, onSuccess, editMode = false }) {
  const { user } = useAuth();
  const isAdmin = (user?.roles || [user?.role || '']).some((r) => ['super_admin', 'admin'].includes(r));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState({});

  const [images, setImages] = useState([]);
  const [remark, setRemark] = useState('');

  // Base fields
  const [installDate, setInstallDate] = useState('');
  const [accessNo, setAccessNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [mainPackage, setMainPackage] = useState('');
  const [orderNo, setOrderNo] = useState('');

  // Device fields — SN from tech bag only (SOA is free text)
  const [bagItems, setBagItems] = useState([]);
  const [bagLoading, setBagLoading] = useState(false);
  const [bagSelections, setBagSelections] = useState({ ...EMPTY_BAG_SELECTIONS });
  const [soaDevice, setSoaDevice] = useState('');
  const [splitNo, setSplitNo] = useState('');
  const [portNo, setPortNo] = useState('');
  const [l3Name, setL3Name] = useState('');
  const [cableLength, setCableLength] = useState('');
  const [refId3bb, setRefId3bb] = useState('');
  const [scBlue, setScBlue] = useState('');

  // No-SN equipment (ใช้อุปกรณ์ติดตั้ง)
  const [noSnItems, setNoSnItems] = useState([]);
  const [selectedNoSnItems, setSelectedNoSnItems] = useState({});
  const [showNoSnModal, setShowNoSnModal] = useState(false);
  const [showBagPreview, setShowBagPreview] = useState(false);

  // Entry fee
  const [entryFeeStatus, setEntryFeeStatus] = useState('none'); // 'none' | 'slip' | 'cash' | 'backdate'
  const [entryFeeSlip, setEntryFeeSlip] = useState(null);
  const [entryFeeBackdate, setEntryFeeBackdate] = useState('');

  const [imagePreviews, setImagePreviews] = useState([]);
  const [entryFeeSlipPreview, setEntryFeeSlipPreview] = useState(null);
  const [existingImages, setExistingImages] = useState([]);

  const [loading, setLoading] = useState(false);
  const [showSummaryPopup, setShowSummaryPopup] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Guards the debounced draft save so the initial reset never overwrites a stored draft
  const hydratedRef = useRef(false);
  const cableReelWarnRef = useRef('');

  const applyCableReelForLength = (metersValue, { toast = true } = {}) => {
    setSelectedNoSnItems((prev) => {
      const { next, warning, synced } = syncCableReelNoSn(prev, noSnItems, metersValue);
      if (toast && warning && cableReelWarnRef.current !== `${metersValue}:${warning}`) {
        cableReelWarnRef.current = `${metersValue}:${warning}`;
        queueMicrotask(() => {
          Swal.fire({
            icon: 'warning',
            title: 'ปรับสายม้วนอัตโนมัติ',
            text: warning,
            confirmButtonColor: '#185FA5',
          });
        });
      } else if (synced && !warning) {
        cableReelWarnRef.current = '';
      }
      return next;
    });
  };

  const setCableLengthAndSync = (value) => {
    setCableLength(value);
    setErrors((p) => (p.cableLength ? { ...p, cableLength: null } : p));
    if (parseCableMeters(value) != null) {
      applyCableReelForLength(value, { toast: true });
    }
  };

  // ── Open / reset / restore draft ─────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !job) {
      hydratedRef.current = false;
      return;
    }

    hydratedRef.current = false;
    setStep(0);
    setErrors({});
    setInstallDate(
      editMode && job.plan_arrival_date
        ? String(job.plan_arrival_date).split('T')[0]
        : new Date().toLocaleDateString('en-CA')
    );
    setAccessNo(job.access_no || '');
    setCustomerName(job.customer || '');
    setMainPackage(job.package || '');
    setOrderNo(job.order_no || '');
    setImages([]);
    setRemark(job.remark || '');
    setBagSelections({ ...EMPTY_BAG_SELECTIONS });
    setSoaDevice('');
    setSplitNo(''); setPortNo(''); setL3Name(''); setCableLength(''); setRefId3bb(''); setScBlue('');
    setEntryFeeStatus('none'); setEntryFeeSlip(null); setEntryFeeBackdate('');
    imagePreviews.forEach((url) => { if (String(url).startsWith('blob:')) URL.revokeObjectURL(url); });
    if (entryFeeSlipPreview) URL.revokeObjectURL(entryFeeSlipPreview);
    setImagePreviews([]);
    setEntryFeeSlipPreview(null);
    setExistingImages([]);
    setSelectedNoSnItems({});
    setShowNoSnModal(false);
    setDraftRestored(false);

    // Restore draft only for fresh complete (not edit completed job)
    if (!editMode) {
      try {
        const raw = localStorage.getItem(draftKeyFor(job.id));
        if (raw) {
          const d = JSON.parse(raw);
          if (d && typeof d === 'object') {
            if (d.installDate) setInstallDate(d.installDate);
            if (d.bagSelections) {
              const { SOA: _legacySoa, ...restBag } = d.bagSelections;
              setBagSelections({ ...EMPTY_BAG_SELECTIONS, ...restBag });
              if (d.soaDevice == null && typeof _legacySoa === 'string' && _legacySoa && _legacySoa !== 'dash' && Number.isNaN(Number(_legacySoa))) {
                setSoaDevice(_legacySoa);
              }
            }
            if (d.soaDevice != null) setSoaDevice(d.soaDevice);
            if (d.orderNo != null) setOrderNo(d.orderNo);
            if (d.splitNo != null) setSplitNo(d.splitNo);
            if (d.portNo != null) setPortNo(d.portNo);
            if (d.l3Name != null) setL3Name(d.l3Name);
            if (d.cableLength != null) setCableLength(d.cableLength);
            if (d.refId3bb != null) setRefId3bb(d.refId3bb);
            if (d.scBlue != null) setScBlue(d.scBlue);
            if (d.remark != null) setRemark(d.remark);
            if (d.entryFeeStatus) setEntryFeeStatus(d.entryFeeStatus);
            if (d.entryFeeBackdate != null) setEntryFeeBackdate(d.entryFeeBackdate);
            if (d.selectedNoSnItems && typeof d.selectedNoSnItems === 'object') {
              setSelectedNoSnItems(d.selectedNoSnItems);
            }
            if (typeof d.step === 'number') setStep(Math.min(Math.max(d.step, 0), 3));
            setDraftRestored(true);
          }
        }
      } catch { /* corrupt draft — ignore */ }
    }

    hydratedRef.current = true;

    // Load tech / team bag (+ used devices when editing completed job)
    setBagLoading(true);
    const bagUrl = buildCompleteBagUrl(job, { isAdmin });
    const detailsPromise = editMode
      ? api.get(`/dispatch/jobs/${job.id}/details?type=office`).catch(() => ({ data: null }))
      : Promise.resolve({ data: null });

    Promise.all([
      api.get(bagUrl),
      api.get('/settings/frequent-no-sn').catch(() => ({ data: { product_ids: [], roles: [] } })),
      resolveRolesForComplete({ api, user, job, isAdmin }),
      detailsPromise,
    ])
      .then(([res, cfgRes, roleList, detailsRes]) => {
        const all = Array.isArray(res.data) ? res.data : [];
        let snItems = all.filter(isSnBagItem);
        let noSn = all.filter((item) => !isSnBagItem(item));
        const freqConfig = cfgRes?.data || { product_ids: [], roles: [] };
        const details = detailsRes?.data;

        if (editMode && details) {
          const parsed = parseInstallDeviceFields(details.install_device || job.install_device);
          if (parsed.soa_device) setSoaDevice(parsed.soa_device);
          if (parsed.split_no) setSplitNo(parsed.split_no);
          if (parsed.port_no) setPortNo(parsed.port_no);
          if (parsed.l3_name) setL3Name(parsed.l3_name);
          if (parsed.cable_length) setCableLength(parsed.cable_length);
          if (parsed.ref_id_3bb) setRefId3bb(parsed.ref_id_3bb);
          if (parsed.sc_blue) setScBlue(parsed.sc_blue);
          if (details.order_no) setOrderNo(details.order_no);
          if (details.access_no) setAccessNo(details.access_no);
          if (details.customer) setCustomerName(details.customer);
          if (details.package) setMainPackage(details.package);
          if (details.remark) setRemark(details.remark);
          if (details.plan_arrival_date) {
            setInstallDate(String(details.plan_arrival_date).split('T')[0]);
          }

          const existing = Array.isArray(details.images) ? details.images : [];
          setExistingImages(existing);
          setImagePreviews(existing.map((img) => resolveEvidenceUrl(img.image_path || img)));

          const merged = mergeUsedDevicesIntoBag(snItems, noSn, details.used_devices || []);
          snItems = merged.sn;
          noSn = merged.noSn;
          setBagSelections(() => {
            const next = { ...EMPTY_BAG_SELECTIONS, ...merged.bagSelections };
            if (parsed.sn_onu === '-') next.ONU = 'dash';
            return next;
          });
          // Keep previously used quantities as-is (do not force frequent no-SN qty=1 on edit)
          setSelectedNoSnItems(merged.selectedNoSn);
        }

        setBagItems(snItems);
        setNoSnItems(noSn);

        if (!editMode) {
          setBagSelections((prev) => {
            const next = { ...prev };
            let changed = false;
            Object.keys(next).forEach((role) => {
              const v = next[role];
              if (v && v !== 'dash' && !snItems.some((i) => String(i.id) === String(v))) {
                next[role] = '';
                changed = true;
              }
            });
            return changed ? next : prev;
          });
          setSelectedNoSnItems((prev) => {
            const pruned = {};
            Object.values(prev).forEach((it) => {
              const live = noSn.find((n) => n.id === it.id);
              if (live) {
                pruned[it.id] = {
                  ...live,
                  useQty: Math.min(parseInt(it.useQty, 10) || 1, live.quantity),
                  locked: !!it.locked,
                };
              }
            });
            return applyFrequentNoSnLocks(pruned, noSn, freqConfig, roleList);
          });
        }
      })
      .catch(() => { setBagItems([]); setNoSnItems([]); })
      .finally(() => setBagLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, job?.id, editMode]);

  // After bag + draft/edit cable length are ready, sync สายม้วน qty to match meters
  useEffect(() => {
    if (!isOpen || !hydratedRef.current || bagLoading) return;
    if (!noSnItems.length) return;
    if (parseCableMeters(cableLength) == null) return;
    setSelectedNoSnItems((prev) => {
      const { next } = syncCableReelNoSn(prev, noSnItems, cableLength);
      const prevReels = Object.values(prev).filter(isCableReelItem);
      const nextReels = Object.values(next).filter(isCableReelItem);
      if (
        prevReels.length === nextReels.length
        && prevReels.every((p) => nextReels.some((n) => String(n.id) === String(p.id) && String(n.useQty) === String(p.useQty)))
      ) {
        return prev;
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, bagLoading, noSnItems, cableLength]);

  // ── Debounced draft save (no File/blob data) — skip in editMode ──────────
  useEffect(() => {
    if (!isOpen || !job || !hydratedRef.current || editMode) return;
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(draftKeyFor(job.id), JSON.stringify({
          step,
          installDate,
          bagSelections,
          soaDevice,
          orderNo,
          splitNo,
          portNo,
          l3Name,
          cableLength,
          refId3bb,
          scBlue,
          remark,
          entryFeeStatus,
          entryFeeBackdate,
          selectedNoSnItems,
          savedAt: Date.now(),
        }));
      } catch { /* storage full/unavailable — draft is best-effort */ }
    }, DRAFT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [
    isOpen, job, step, installDate, bagSelections, soaDevice, orderNo, splitNo, portNo, l3Name,
    cableLength, refId3bb, scBlue, remark, entryFeeStatus, entryFeeBackdate, selectedNoSnItems,
  ]);

  const clearDraft = () => {
    if (job) {
      try { localStorage.removeItem(draftKeyFor(job.id)); } catch { /* ignore */ }
    }
  };

  const discardDraftAndReset = () => {
    clearDraft();
    setStep(0);
    setErrors({});
    setInstallDate(new Date().toLocaleDateString('en-CA'));
    setRemark('');
    setOrderNo(job?.order_no || '');
    setBagSelections({ ...EMPTY_BAG_SELECTIONS });
    setSoaDevice('');
    setSplitNo(''); setPortNo(''); setL3Name(''); setCableLength(''); setRefId3bb(''); setScBlue('');
    setEntryFeeStatus('none'); setEntryFeeBackdate('');
    setSelectedNoSnItems({});
    setDraftRestored(false);
  };

  // ── Bag helpers ───────────────────────────────────────────────────────────
  const handleBagSelection = (role, value) => {
    setBagSelections((prev) => ({ ...prev, [role]: value }));
    setErrors((prev) => (prev.bag ? { ...prev, bag: null } : prev));
  };

  const getUsedItemIds = (excludeRole) => {
    const ids = new Set();
    Object.entries(bagSelections).forEach(([r, val]) => {
      if (r !== excludeRole && val && val !== 'dash') ids.add(parseInt(val, 10));
    });
    return ids;
  };

  const buildDeviceDetailsFromBag = () => {
    const parts = [];
    if (String(soaDevice).trim()) {
      parts.push(`SOA:${String(soaDevice).trim()}`);
    }
    BAG_DEVICE_SLOTS.forEach(({ role }) => {
      const sel = bagSelections[role];
      if (!sel) return;
      const prefix = ROLE_INSTALL_PREFIX[role];
      if (sel === 'dash') {
        parts.push(`${prefix}:-`);
        return;
      }
      const item = bagItems.find((b) => String(b.id) === String(sel));
      if (!item) return;
      parts.push(`${prefix}:${item.sn}`);
    });
    return parts;
  };

  const getDeviceVal = (role) => {
    const sel = bagSelections[role];
    if (sel === 'dash') return '-';
    if (sel) {
      const item = bagItems.find((b) => String(b.id) === String(sel));
      if (item) return item.sn;
    }
    return '-';
  };

  const entryFeeText = entryFeeStatus === 'slip' ? 'โอนเงิน (แนบสลิป)' :
                       entryFeeStatus === 'cash' ? 'รับเงินสดหน้างาน' :
                       entryFeeStatus === 'backdate' ? `โอนเงินย้อนหลัง (${entryFeeBackdate || '-'})` : '-';

  // ── File inputs ───────────────────────────────────────────────────────────
  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
    imagePreviews.forEach((url) => { if (String(url).startsWith('blob:')) URL.revokeObjectURL(url); });
    setImagePreviews(files.map((f) => URL.createObjectURL(f)));
    setExistingImages([]);
    setErrors((prev) => (prev.images ? { ...prev, images: null } : prev));
  };

  const handleEntryFeeSlipChange = (e) => {
    const file = e.target.files[0];
    setEntryFeeSlip(file);
    if (entryFeeSlipPreview) URL.revokeObjectURL(entryFeeSlipPreview);
    if (file) setEntryFeeSlipPreview(URL.createObjectURL(file));
    else setEntryFeeSlipPreview(null);
    setErrors((prev) => (prev.entryFeeSlip ? { ...prev, entryFeeSlip: null } : prev));
  };

  // ── Step validation ───────────────────────────────────────────────────────
  const validateStep = (stepIdx) => {
    const errs = {};
    if (stepIdx === 1) {
      const usedIds = Object.values(bagSelections).filter((v) => v && v !== 'dash');
      if (new Set(usedIds).size !== usedIds.length) {
        errs.bag = 'เลือกอุปกรณ์ซ้ำกัน กรุณาเลือกคนละชิ้น';
      }
    }
    if (stepIdx === 2) {
      if (!installDate) errs.installDate = 'กรุณาเลือกวันที่ติดตั้ง';
      if (!String(splitNo).trim()) errs.splitNo = 'กรุณากรอก Splitt';
      if (!String(portNo).trim()) errs.portNo = 'กรุณากรอก Port ที่ใช้';
      if (!String(cableLength).trim()) errs.cableLength = 'กรุณากรอกระยะสายจริง (เมตร) หรือแตะตัวเลือกด้านบน';
      else if (parseCableMeters(cableLength) == null) errs.cableLength = 'ระยะสายจริงต้องเป็นตัวเลขที่มากกว่า 0';
    }
    if (stepIdx === 3) {
      const hasNewImages = images.length > 0;
      const hasExisting = editMode && existingImages.length > 0;
      if (!hasNewImages && !hasExisting) {
        errs.images = 'กรุณาอัปโหลดรูปหลักฐานอย่างน้อย 1 รูป (สูงสุด 40 รูป)';
      } else if (images.length > 40) {
        errs.images = `เลือกไว้ ${images.length} รูป — อัปโหลดได้สูงสุด 40 รูป กรุณาเลือกใหม่`;
      }
      if (!editMode || entryFeeStatus !== 'none') {
        if ((entryFeeStatus === 'slip' || entryFeeStatus === 'backdate') && !entryFeeSlip) {
          errs.entryFeeSlip = 'กรุณาแนบรูปสลิปค่าแรกเข้า';
        }
        if (entryFeeStatus === 'backdate' && !entryFeeBackdate) {
          errs.entryFeeBackdate = 'กรุณาเลือกวันที่โอนย้อนหลัง';
        }
      }
    }
    return errs;
  };

  const goNext = () => {
    const errs = validateStep(step);
    if (Object.values(errs).some(Boolean)) {
      setErrors(errs);
      return;
    }
    if (step === 2 && parseCableMeters(cableLength) != null) {
      applyCableReelForLength(cableLength, { toast: true });
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  };

  // ── Submit (same payload shape as before — backend unchanged) ─────────────
  const handleSubmit = async () => {
    for (const idx of [1, 2, 3]) {
      const errs = validateStep(idx);
      if (Object.values(errs).some(Boolean)) {
        setErrors(errs);
        setStep(idx);
        return;
      }
    }

    try {
      setLoading(true);
      const reelSync = syncCableReelNoSn(selectedNoSnItems, noSnItems, cableLength);
      if (reelSync.synced) setSelectedNoSnItems(reelSync.next);
      if (reelSync.warning) {
        Swal.fire({
          icon: 'warning',
          title: 'ปรับสายม้วนอัตโนมัติ',
          text: reelSync.warning,
          confirmButtonColor: '#185FA5',
        });
      }
      const formData = new FormData();
      formData.append('remark', remark);
      formData.append('installDate', installDate);
      formData.append('accessNo', accessNo);
      formData.append('customerName', customerName);
      formData.append('mainPackage', mainPackage);
      formData.append('orderNo', orderNo);

      const usedInventory = BAG_DEVICE_SLOTS
        .filter(({ role }) => bagSelections[role] && bagSelections[role] !== 'dash')
        .map(({ role }) => ({
          inventory_item_id: parseInt(bagSelections[role], 10),
          device_role: role,
        }));

      const noSnSource = reelSync.synced ? reelSync.next : selectedNoSnItems;
      const noSnPayload = Object.values(noSnSource).map(i => ({
        item_id: i.id,
        quantity: parseInt(i.useQty, 10) || 1,
        product_name: i.product_name,
        model_name: i.model_name || '',
        unit: i.unit || 'ชิ้น',
      }));

      const manualParts = [
        splitNo ? `Sp:${splitNo}` : null,
        portNo ? `Pt:${portNo}` : null,
        l3Name ? `L3:${l3Name}` : null,
        cableLength ? `สาย:${cableLength}M` : null,
        refId3bb ? `3BB:${refId3bb}` : null,
        scBlue ? `SCฟ้า:${scBlue}` : null,
      ].filter(Boolean);

      const noSnParts = noSnPayload.map(i => `${i.product_name} ${i.model_name} x${i.quantity} ${i.unit}`.trim());
      const deviceDetails = [...buildDeviceDetailsFromBag(), ...manualParts, ...noSnParts].join(' | ');

      formData.append('installDevice', deviceDetails);
      formData.append('usedInventory', JSON.stringify(usedInventory));
      formData.append('noSnItems', JSON.stringify(noSnPayload));
      formData.append('soaDevice', soaDevice);
      formData.append('splitNo', splitNo);
      formData.append('portNo', portNo);
      formData.append('l3Name', l3Name);
      formData.append('cableLength', cableLength);
      formData.append('refId3bb', refId3bb);
      formData.append('scBlue', scBlue);

      formData.append('entryFeeStatus', entryFeeStatus);
      if ((entryFeeStatus === 'slip' || entryFeeStatus === 'backdate') && entryFeeSlip) {
        formData.append('entryFeeSlip', entryFeeSlip);
      }
      if (entryFeeStatus === 'backdate' && entryFeeBackdate) {
        formData.append('entryFeeBackdate', entryFeeBackdate);
      }

      if (editMode) {
        formData.append('recomplete', 'true');
        if (images.length === 0 && existingImages.length > 0) {
          formData.append('keepExistingImages', 'true');
        }
      }

      for (let i = 0; i < images.length; i++) {
        formData.append('images', images[i]);
      }

      await api.put(`/dispatch/jobs/${job.id}/complete`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Successful complete — drop the local draft
      hydratedRef.current = false;
      clearDraft();

      const summaryText = [
        `วันที่ติดตั้ง (Plan Date): ${installDate || '-'}`,
        `เลข (NON): ${accessNo || '-'}`,
        `แพ็กเกจ: ${mainPackage || '-'}`,
        `Order No: ${String(orderNo).trim() || '-'}`,
        `อุปกรณ์ปิด SOA: ${String(soaDevice).trim() || '-'}`,
        `Splitt: ${splitNo || '-'}`,
        `ใช้ Port: ${portNo || '-'}`,
        `ระยะสายจริง(M): ${cableLength || '-'}`,
        `SN Playbox: ${getDeviceVal('PB')}`,
        `SN ONU: ${getDeviceVal('ONU')}`,
        `SN IP camera: ${getDeviceVal('Cam')}`,
        `Ref ID 3BB: ${refId3bb || '-'}`,
        `ตัวต่อscสีฟ้า: ${scBlue || '-'}`,
        `ค่าแรกเข้า: ${entryFeeText}`,
        `หมายเหตุ: ${remark || '-'}`
      ].join('\n');

      setSummaryData({ text: summaryText });
      setShowSummaryPopup(true);
      // onSuccess called after user closes popup
    } catch (err) {
      console.error(err);
      await showFriendlyError(err, editMode ? 'เกิดข้อผิดพลาดในการแก้ไขการจบงาน' : 'เกิดข้อผิดพลาดในการจบงาน');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !job) return null;

  const assigneeText = job.engineer_name || job.tech_names || job.team_name || '-';
  const selectedDeviceCount = Object.values(bagSelections).filter((v) => v && v !== 'dash').length;
  const inputCls = 'w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm';
  const inputErrCls = 'w-full px-3 py-2 rounded-xl glass border border-red-300 ring-1 ring-red-200 text-sm';

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass border border-white/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 pt-4 bg-white/80 backdrop-blur-sm border-b border-white/60">
          <div className="flex items-center justify-between">
            <h2 className="text-[#042C53] font-bold text-lg flex items-center gap-2">
              <span className="text-2xl">{editMode ? '✏️' : '✅'}</span>
              {editMode ? 'แก้ไขการจบงาน' : 'จบงาน'}: {job.access_no}
            </h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <StepIndicator current={step} onJump={(idx) => { setErrors({}); setStep(idx); }} />
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {draftRestored && !editMode && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
              <p className="text-xs font-bold text-amber-700">
                📝 พบแบบร่างที่บันทึกไว้ — ระบบกู้คืนข้อมูลให้แล้ว (รูปภาพ / สลิปค่าแรกเข้าต้องเลือกใหม่)
              </p>
              <button
                type="button"
                onClick={discardDraftAndReset}
                className="text-xs font-bold text-amber-600 hover:text-red-500 underline whitespace-nowrap transition-colors"
              >
                ล้างแบบร่าง
              </button>
            </div>
          )}

          {/* ── Step 1: ตรวจข้อมูลงาน ── */}
          {step === 0 && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="p-4 bg-white/40 rounded-2xl border border-white/50">
                <h3 className="text-sm font-bold text-[#185FA5] mb-3">📋 ตรวจสอบข้อมูลงานก่อนเริ่ม</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoRow label="Access (NON)" value={job.access_no} />
                  <InfoRow label="Order No" value={job.order_no} />
                  <InfoRow label="ชื่อลูกค้า" value={job.customer} />
                  <InfoRow label="เบอร์โทร" value={job.phone} />
                  <div className="sm:col-span-2">
                    <InfoRow label="ที่อยู่ติดตั้ง" value={job.address} />
                  </div>
                  <InfoRow label="แพ็กเกจ" value={job.package} />
                  <InfoRow label="ทีม / ช่างผู้รับผิดชอบ" value={assigneeText} />
                  <InfoRow label="วันนัดหมาย" value={fmtThaiDate(job.plan_arrival_date)} />
                  <InfoRow label="เวลานัดหมาย" value={job.plan_arrival_time} />
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center">
                ข้อมูลถูกต้องแล้ว กด "ถัดไป" เพื่อเลือกอุปกรณ์จากกระเป๋าช่าง
              </p>
            </div>
          )}

          {/* ── Step 2: เลือกอุปกรณ์ ── */}
          {step === 1 && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 mb-1">
                  <h3 className="text-sm font-bold text-[#185FA5]">รายละเอียดอุปกรณ์ติดตั้ง (เลือกจากกระเป๋าทีม — ใช้ร่วมกันได้)</h3>
                  <div className="flex items-center gap-2">
                    {isAdmin && (job.field_engineer_id || job.assigned_user_id || job.team_id) && (
                      <button
                        type="button"
                        onClick={() => setShowBagPreview(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 text-xs font-bold hover:bg-teal-100 transition-all"
                      >
                        🎒 ดูกระเป๋าช่าง
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNoSnModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      ใช้อุปกรณ์ติดตั้ง
                      {Object.keys(selectedNoSnItems).length > 0 && (
                        <span className="ml-1 bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black">
                          {Object.keys(selectedNoSnItems).length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {errors.bag && (
                  <div className="md:col-span-2 p-2.5 bg-red-50 border border-red-200 rounded-xl">
                    <FieldHint message={errors.bag} />
                  </div>
                )}

                {Object.keys(selectedNoSnItems).length > 0 && (
                  <div className="md:col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-200 mb-1">
                    <p className="text-xs font-bold text-blue-700 mb-1.5">🔧 อุปกรณ์ที่เลือก:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(selectedNoSnItems).map(item => (
                        <span key={item.id} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${
                          item.locked
                            ? 'bg-amber-50 border-amber-300 text-amber-900'
                            : 'bg-white border-blue-200 text-blue-800'
                        }`}>
                          {item.locked ? '🔒 ' : ''}{item.product_name} {item.model_name} × {item.useQty} {item.unit || 'ชิ้น'}
                          {!item.locked && (
                            <button
                              type="button"
                              onClick={() => setSelectedNoSnItems(prev => { const n = {...prev}; delete n[item.id]; return n; })}
                              className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors"
                            >✕</button>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {bagLoading ? (
                  <p className="md:col-span-2 text-sm text-gray-500">กำลังโหลดกระเป๋าช่าง...</p>
                ) : bagItems.length === 0 ? (
                  <p className="md:col-span-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    ไม่มีอุปกรณ์ SN ในกระเป๋า — กรุณาเบิกอุปกรณ์ก่อนจบงาน
                  </p>
                ) : null}
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">อุปกรณ์ปิด SOA</label>
                  <input
                    type="text"
                    value={soaDevice}
                    onChange={(e) => setSoaDevice(e.target.value)}
                    placeholder="พิมพ์ชื่อ/รุ่นอุปกรณ์ปิด SOA"
                    className={inputCls}
                  />
                </div>
                {BAG_DEVICE_SLOTS.map(({ role, label, dashOption }) => (
                  <BagDeviceSelect
                    key={role}
                    role={role}
                    label={label}
                    value={bagSelections[role]}
                    onChange={handleBagSelection}
                    bagItems={bagItems}
                    usedElsewhere={getUsedItemIds(role)}
                    dashOption={dashOption}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: ผลติดตั้ง ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
                <h3 className="md:col-span-2 text-sm font-bold text-[#185FA5] mb-1">ข้อมูลพื้นฐาน</h3>
                <div>
                  <AppDateField
                    label="วันที่ติดตั้ง"
                    value={installDate}
                    onChange={(v) => { setInstallDate(v); setErrors(p => (p.installDate ? { ...p, installDate: null } : p)); }}
                    max={new Date().toLocaleDateString('en-CA')}
                    allowClear={false}
                    showToday
                  />
                  {installDate && installDate < new Date().toLocaleDateString('en-CA') && (
                    <p className="text-[10px] text-amber-600 mt-1 font-medium">📅 ปิดงานย้อนหลังวันที่ {installDate}</p>
                  )}
                  <FieldHint message={errors.installDate} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">ปิดเคสงาน (NON)</label>
                  <input
                    type="text"
                    readOnly={!editMode}
                    value={accessNo}
                    onChange={(e) => setAccessNo(e.target.value)}
                    className={editMode
                      ? inputCls
                      : 'w-full px-3 py-2 rounded-xl border border-gray-200 outline-none text-gray-500 bg-gray-100 text-sm cursor-not-allowed'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">ชื่อ-นามสกุล ลูกค้า</label>
                  <input
                    type="text"
                    readOnly={!editMode}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className={editMode
                      ? inputCls
                      : 'w-full px-3 py-2 rounded-xl border border-gray-200 outline-none text-gray-500 bg-gray-100 text-sm cursor-not-allowed'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">แพ็กเกจหลัก</label>
                  <input
                    type="text"
                    readOnly={!editMode}
                    value={mainPackage}
                    onChange={(e) => setMainPackage(e.target.value)}
                    className={editMode
                      ? inputCls
                      : 'w-full px-3 py-2 rounded-xl border border-gray-200 outline-none text-gray-500 bg-gray-100 text-sm cursor-not-allowed'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">Order No</label>
                  <input
                    type="text"
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                    placeholder="กรอก Order No"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
                <h3 className="md:col-span-2 text-sm font-bold text-[#185FA5] mb-1">ผลการติดตั้ง</h3>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">Splitt <span className="text-red-500">*</span></label>
                  <input type="text" value={splitNo}
                    onChange={(e) => { setSplitNo(e.target.value); setErrors(p => (p.splitNo ? { ...p, splitNo: null } : p)); }}
                    className={errors.splitNo ? inputErrCls : inputCls} />
                  <FieldHint message={errors.splitNo} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">ใช้ Port <span className="text-red-500">*</span></label>
                  <input type="text" value={portNo}
                    onChange={(e) => { setPortNo(e.target.value); setErrors(p => (p.portNo ? { ...p, portNo: null } : p)); }}
                    className={errors.portNo ? inputErrCls : inputCls} />
                  <FieldHint message={errors.portNo} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">ใช้ #L3(ชื่อ)</label>
                  <input type="text" value={l3Name} onChange={(e) => setL3Name(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">ระยะสายจริง(M) <span className="text-red-500">*</span></label>
                  <PresetChips
                    options={['20', '50', '100']}
                    value={String(cableLength)}
                    onPick={(v) => setCableLengthAndSync(v)}
                    className="mb-1.5"
                  />
                  <input type="number" step="0.1" value={cableLength}
                    onChange={(e) => setCableLengthAndSync(e.target.value)}
                    className={errors.cableLength ? inputErrCls : inputCls} />
                  <p className="text-[10px] text-[#6B7280] mt-1 font-medium">
                    ระบบจะเลือก/ปรับจำนวน &quot;สายม้วน&quot; ในกระเป๋าให้เท่ากับระยะสายจริงอัตโนมัติ
                  </p>
                  <FieldHint message={errors.cableLength} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">Ref ID 3BB</label>
                  <input type="text" value={refId3bb} onChange={(e) => setRefId3bb(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#042C53] mb-1">ตัวต่อ sc สีฟ้า</label>
                  <input type="text" value={scBlue} onChange={(e) => setScBlue(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: รูป/ค่าแรกเข้า ── */}
          {step === 3 && (
            <div className="flex flex-col gap-4 animate-fade-in">
              {/* Entry Fee Section */}
              <div className="p-4 bg-gradient-to-br from-[#A3E635]/20 to-[#A3E635]/5 rounded-2xl border border-[#A3E635]/40 shadow-sm">
                <h3 className="text-sm font-bold text-[#4D7C0F] mb-3 flex items-center gap-2">
                  <span>💰</span> ค่าแรกเข้า
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setEntryFeeStatus('none')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${entryFeeStatus === 'none' ? 'border-[#84CC16] bg-white shadow-md text-[#4D7C0F] scale-105' : 'border-white/60 bg-white/40 text-[#042C53] hover:border-[#84CC16]/50 hover:bg-white/60'}`}
                  >
                    <span className="text-xl drop-shadow-sm">🚫</span>
                    <span className="text-[11px] font-bold">ไม่มี</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryFeeStatus('slip')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${entryFeeStatus === 'slip' ? 'border-[#84CC16] bg-white shadow-md text-[#4D7C0F] scale-105' : 'border-white/60 bg-white/40 text-[#042C53] hover:border-[#84CC16]/50 hover:bg-white/60'}`}
                  >
                    <span className="text-xl drop-shadow-sm">💳</span>
                    <span className="text-[11px] font-bold text-center">แนบสลิป</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryFeeStatus('cash')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${entryFeeStatus === 'cash' ? 'border-[#84CC16] bg-white shadow-md text-[#4D7C0F] scale-105' : 'border-white/60 bg-white/40 text-[#042C53] hover:border-[#84CC16]/50 hover:bg-white/60'}`}
                  >
                    <span className="text-xl drop-shadow-sm">💵</span>
                    <span className="text-[11px] font-bold text-center">รับหน้างาน</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEntryFeeStatus('backdate')}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${entryFeeStatus === 'backdate' ? 'border-purple-400 bg-white shadow-md text-purple-700 scale-105' : 'border-white/60 bg-white/40 text-[#042C53] hover:border-purple-300 hover:bg-white/60'}`}
                  >
                    <span className="text-xl drop-shadow-sm">📅</span>
                    <span className="text-[11px] font-bold text-center">ย้อนหลัง</span>
                  </button>
                </div>

                {/* Slip upload — shown for 'slip' and 'backdate' */}
                {(entryFeeStatus === 'slip' || entryFeeStatus === 'backdate') && (
                  <div className="animate-fade-in-up mt-4 p-3 bg-white/60 rounded-xl border border-white/80">
                    <label className="block text-xs font-semibold text-[#042C53] mb-2 flex items-center gap-2">
                      <span className="text-blue-500">📎</span> อัปโหลดสลิปค่าแรกเข้า <span className="text-red-500">*</span>
                    </label>
                    <div className="relative mt-2 group cursor-pointer">
                      <input type="file" accept="image/*" onChange={handleEntryFeeSlipChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <div className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl transition-all bg-white/50 ${entryFeeSlipPreview ? 'border-[#84CC16] bg-[#84CC16]/10' : errors.entryFeeSlip ? 'border-red-300 bg-red-50/50' : 'border-[#378ADD]/50 hover:border-[#378ADD] hover:bg-[#378ADD]/5'}`}>
                        {entryFeeSlipPreview ? (
                          <img src={entryFeeSlipPreview} alt="Slip Preview" className="h-32 object-contain rounded-lg shadow-sm" />
                        ) : (
                          <>
                            <span className="text-3xl mb-2">📸</span>
                            <span className="text-sm font-semibold text-[#185FA5]">คลิกเพื่ออัปโหลดสลิป</span>
                          </>
                        )}
                      </div>
                    </div>
                    <FieldHint message={errors.entryFeeSlip} />
                  </div>
                )}

                {/* Backdate date picker — shown only for 'backdate' */}
                {entryFeeStatus === 'backdate' && (
                  <div className="animate-fade-in-up mt-3 p-3 bg-purple-50/80 rounded-xl border border-purple-200">
                    <AppDateField
                      label="เลือกวันที่ย้อนหลัง"
                      value={entryFeeBackdate}
                      onChange={(v) => { setEntryFeeBackdate(v); setErrors(p => (p.entryFeeBackdate ? { ...p, entryFeeBackdate: null } : p)); }}
                      max={new Date().toLocaleDateString('en-CA')}
                      allowClear={false}
                      showToday={false}
                    />
                    <FieldHint message={errors.entryFeeBackdate} />
                    <p className="text-[10px] text-purple-500 mt-1.5 font-medium">⚠️ รายการนี้จะแสดงเป็น "ย้อนหลัง" ในประวัติ</p>
                  </div>
                )}
              </div>

              {/* Images and Remark */}
              <div className="grid grid-cols-1 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
                <div>
                  <label className="block text-sm font-semibold text-[#042C53] mb-1">
                    รูปภาพหลักฐานปิดงาน {editMode && existingImages.length > 0 ? '(เดิมใช้ได้ — หรือเลือกใหม่)' : <><span className="text-red-500">*</span> (สูงสุด 40 รูป)</>}
                  </label>
                  <div className="relative mt-2 group cursor-pointer">
                    <input type="file" multiple accept="image/*" onChange={handleImagesChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl bg-white/50 transition-all ${errors.images ? 'border-red-300 bg-red-50/50' : 'border-[#378ADD]/50 hover:bg-[#378ADD]/5 hover:border-[#378ADD]'}`}>
                      <span className="text-4xl mb-2">🖼️</span>
                      <span className="text-sm font-semibold text-[#185FA5]">คลิกเพื่ออัปโหลด หรือลากไฟล์มาวาง</span>
                      <span className="text-xs text-gray-500 mt-1">สามารถเลือกได้สูงสุด 40 รูป</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-xs text-gray-500">รองรับไฟล์รูปภาพเท่านั้น</p>
                    <p className={`text-xs font-bold ${images.length > 40 ? 'text-red-500' : 'text-[#185FA5]'}`}>{images.length}/40 รูป</p>
                  </div>
                  <FieldHint message={errors.images} />
                  {imagePreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 p-2 bg-white/30 rounded-xl border border-white/50 max-h-40 overflow-y-auto">
                      {imagePreviews.map((url, i) => (
                        <img key={i} src={url} alt={`Preview ${i}`} className="h-16 w-16 object-cover rounded-lg shadow-sm border border-white" />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#042C53] mb-1">หมายเหตุ (ถ้ามี)</label>
                  <textarea value={remark} onChange={(e) => setRemark(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50 resize-none h-16 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 5: ตรวจสอบยืนยัน ── */}
          {step === 4 && (
            <div className="flex flex-col gap-3 animate-fade-in">
              <div className="p-4 bg-white/40 rounded-2xl border border-white/50">
                <h3 className="text-sm font-bold text-[#185FA5] mb-3">📋 ข้อมูลงาน</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoRow label="Access (NON)" value={accessNo} />
                  <InfoRow label="ลูกค้า" value={customerName} />
                  <InfoRow label="แพ็กเกจ" value={mainPackage} />
                  <InfoRow label="Order No" value={String(orderNo).trim() || '-'} />
                  <InfoRow label="วันที่ติดตั้ง" value={installDate} />
                </div>
              </div>

              <div className="p-4 bg-white/40 rounded-2xl border border-white/50">
                <h3 className="text-sm font-bold text-[#185FA5] mb-3">📦 อุปกรณ์ที่ใช้ ({selectedDeviceCount} ชิ้น SN)</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <InfoRow label="อุปกรณ์ปิด SOA" value={String(soaDevice).trim() || '-'} />
                  {BAG_DEVICE_SLOTS.map(({ role, label }) => (
                    <InfoRow key={role} label={label} value={getDeviceVal(role)} />
                  ))}
                </div>
                {Object.keys(selectedNoSnItems).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/60">
                    <p className="text-[11px] font-semibold text-slate-500 mb-1.5">อุปกรณ์นับจำนวน (ไม่มี SN)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.values(selectedNoSnItems).map(item => (
                        <span key={item.id} className="px-2.5 py-1 bg-blue-50 rounded-lg border border-blue-200 text-xs font-semibold text-blue-800">
                          {item.product_name} {item.model_name} × {item.useQty} {item.unit || 'ชิ้น'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-white/40 rounded-2xl border border-white/50">
                <h3 className="text-sm font-bold text-[#185FA5] mb-3">🛠️ ผลการติดตั้ง</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <InfoRow label="Splitt" value={splitNo} />
                  <InfoRow label="ใช้ Port" value={portNo} />
                  <InfoRow label="#L3 (ชื่อ)" value={l3Name} />
                  <InfoRow label="ระยะสายจริง (M)" value={cableLength} />
                  <InfoRow label="Ref ID 3BB" value={refId3bb} />
                  <InfoRow label="ตัวต่อ sc สีฟ้า" value={scBlue} />
                </div>
              </div>

              <div className="p-4 bg-white/40 rounded-2xl border border-white/50">
                <h3 className="text-sm font-bold text-[#185FA5] mb-3">📸 รูป / ค่าแรกเข้า</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoRow
                    label="รูปหลักฐานปิดงาน"
                    value={images.length > 0
                      ? `${images.length} รูป (ใหม่)`
                      : existingImages.length > 0
                        ? `${existingImages.length} รูป (เดิม)`
                        : '0 รูป'}
                  />
                  <InfoRow label="ค่าแรกเข้า" value={entryFeeText} />
                  {remark && (
                    <div className="sm:col-span-2">
                      <InfoRow label="หมายเหตุ" value={remark} />
                    </div>
                  )}
                </div>
                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {imagePreviews.slice(0, 8).map((url, i) => (
                      <img key={i} src={url} alt={`Preview ${i}`} className="h-12 w-12 object-cover rounded-lg shadow-sm border border-white" />
                    ))}
                    {imagePreviews.length > 8 && (
                      <span className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">
                        +{imagePreviews.length - 8}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <p className="text-xs text-center text-slate-500">
                ตรวจสอบข้อมูลครบถ้วนแล้ว กด "{editMode ? 'บันทึกการแก้ไข' : 'ยืนยันจบงาน'}" เพื่อบันทึก
              </p>
              {isAdmin && (job.field_engineer_id || job.assigned_user_id) && (
                <p className="text-xs text-center text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  👤 แอดมินจบงานแทน — ผู้จบงานจะบันทึกเป็นชื่อช่างที่ได้รับมอบหมาย
                  {job.engineer_name ? ` (${job.engineer_name})` : ''}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer — step navigation */}
        <div className="flex gap-3 px-5 py-4 bg-white/90 backdrop-blur-sm border-t border-white/50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {step === 0 ? (
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-[#378ADD]/30 text-[#042C53] font-semibold hover:bg-white/50 transition-colors">
              ยกเลิก
            </button>
          ) : (
            <button type="button" onClick={goBack} disabled={loading}
              className="flex-1 py-3 rounded-xl border border-[#378ADD]/30 text-[#042C53] font-semibold hover:bg-white/50 transition-colors flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              ย้อนกลับ
            </button>
          )}

          {step < WIZARD_STEPS.length - 1 ? (
            <button type="button" onClick={goNext}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#185FA5] to-[#378ADD] text-white font-bold shadow-lg shadow-[#378ADD]/30 hover:shadow-[#378ADD]/50 transition-all flex items-center justify-center gap-1.5">
              ถัดไป
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : (editMode ? 'บันทึกการแก้ไข' : 'ยืนยันจบงาน')}
            </button>
          )}
        </div>
      </div>

      {/* No-SN Equipment Picker Sub-Modal */}
      <NoSnEquipmentModal
        isOpen={showNoSnModal}
        onClose={() => setShowNoSnModal(false)}
        noSnItems={noSnItems}
        selectedNoSnItems={selectedNoSnItems}
        setSelectedNoSnItems={setSelectedNoSnItems}
      />

      <TechBagPreviewModal
        isOpen={showBagPreview}
        onClose={() => setShowBagPreview(false)}
        userId={job.field_engineer_id || job.assigned_user_id || null}
        teamId={job.team_id || null}
        title={job.engineer_name || job.team_name || 'กระเป๋าช่าง'}
        subtitle={[job.access_no, job.customer].filter(Boolean).join(' · ')}
      />

      {/* Post-Complete Summary Popup */}
      {showSummaryPopup && summaryData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-[#042C53]/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-emerald-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span className="text-2xl">✅</span> ปิดงานสำเร็จ!
              </h3>
              <p className="text-emerald-100 text-sm mt-0.5">คัดลอกข้อมูลเพื่อส่งให้ลูกค้าหรือทีม</p>
            </div>
            {/* Summary text box */}
            <div className="p-5">
              <pre
                id="completion-summary-text"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 text-sm text-[#374151] font-mono whitespace-pre-wrap break-words select-all"
              >{summaryData.text}</pre>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(summaryData.text);
                    } catch(e) {
                      const el = document.getElementById('completion-summary-text');
                      const range = document.createRange();
                      range.selectNode(el);
                      window.getSelection().removeAllRanges();
                      window.getSelection().addRange(range);
                      document.execCommand('copy');
                    }
                    Swal.fire({ icon: 'success', title: 'คัดลอกแล้ว!', showConfirmButton: false, timer: 1000, position: 'top-end', toast: true });
                  }}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex justify-center items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  📋 คัดลอกทั้งหมด
                </button>
                <button
                  onClick={() => {
                    setShowSummaryPopup(false);
                    setSummaryData(null);
                    onSuccess();
                    onClose();
                  }}
                  className="flex-1 py-3 rounded-xl border border-[#E5E7EB] text-[#374151] font-semibold hover:bg-[#F9FAFB] transition-colors"
                >
                  ปิด
                </button>
              </div>
              <button
                onClick={() => setShowBagPreview(true)}
                className="w-full mt-3 py-2.5 rounded-xl border border-teal-200 bg-teal-50 text-teal-700 font-bold text-sm hover:bg-teal-100 transition-colors flex items-center justify-center gap-2"
              >
                🎒 ดูกระเป๋าช่าง (ตรวจสอบสต๊อกหลังปิดงาน)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompleteJobModal;
