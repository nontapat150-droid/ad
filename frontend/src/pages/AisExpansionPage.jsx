import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ExpansionMapPicker, { haversineMeters } from '../components/ExpansionMapPicker';
import { Calendar } from '../components/ui/calendar';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

const STATUS_META = {
  draft: { label: 'ยังไม่ไป', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  survey: { label: 'กำลังทำ', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  quoted: { label: 'คุยแล้ว', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  won: { label: 'ปิดได้', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lost: { label: 'ไม่ได้', className: 'bg-red-50 text-red-700 border-red-200' },
  handed_off: { label: 'ส่งต่อแล้ว', className: 'bg-violet-50 text-violet-700 border-violet-200' },
};

const NEXT_ACTIONS = {
  draft: [{ status: 'survey', label: 'เริ่มทำ' }],
  survey: [
    { status: 'quoted', label: 'คุยแล้ว' },
    { status: 'won', label: 'ปิดได้' },
    { status: 'lost', label: 'ไม่ได้' },
  ],
  quoted: [
    { status: 'won', label: 'ปิดได้' },
    { status: 'lost', label: 'ไม่ได้' },
  ],
  won: [],
  lost: [{ status: 'survey', label: 'เปิดใหม่' }],
  handed_off: [],
};

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 10;
const NEARBY_RADIUS_M = 3000;

const inputCls =
  'w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-gradient-to-b from-white to-[#F9FAFB] text-sm font-semibold shadow-[inset_0_1px_0_#FFFFFF,0_1px_2px_rgba(0,0,0,0.03)] outline-none focus:ring-2 focus:ring-[#A3E635]/35 focus:border-[#B7E45A] disabled:opacity-60 disabled:bg-[#F9FAFB]';
const labelCls = 'block text-[11px] font-bold text-[#6B7280] uppercase mb-1';

const emptyForm = () => ({
  customer_type: 'general',
  customer_name: '',
  id_card: '',
  phone: '',
  address: '',
  package_name: '',
  contract_info: '',
  occupation: '',
  approval_request: '',
  install_date: '',
  install_date_text: '',
  non_number: '',
  sales_note: '',
  tech_note: '',
  access_no: '',
  owner_user_id: '',
  entry_fee_request: '',
  pair_line: '',
  lat: null,
  lng: null,
  splitter_id: null,
  straight_distance_m: '',
  estimated_cable_m: '',
  splitter_note: '',
  radius_m: 500,
  status: 'draft',
  follow_up_at: '',
  follow_up_time: '',
  follow_up_channel: '',
  follow_up_note: '',
  remark: '',
  lost_reason: '',
});

const emptySplitterForm = () => ({
  code: '',
  name: '',
  area: '',
  remark: '',
  lat: null,
  lng: null,
  status: 'active',
});

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`inline-flex text-[10px] font-black px-2 py-0.5 rounded-full border ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function resolveImageUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function excelDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function buildExpansionExportRows(rows, { isAdmin }) {
  return rows.map((job, idx) => ({
    ลำดับ: idx + 1,
    รหัสงานขาย: job.id ?? '',
    สถานะ: STATUS_META[job.status]?.label || job.status || '',
    ประเภทลูกค้า: job.customer_type === 'corporate' ? 'นิติบุคคล' : 'ลูกค้าทั่วไป',
    'ชื่อลูกค้า/บริษัท': job.customer_name || '',
    'เลขบัตร/ผู้เสียภาษี': job.id_card || '',
    เบอร์โทร: job.phone || '',
    ที่อยู่: job.address || '',
    แพ็กเกจ: job.package_name || '',
    ข้อมูลสัญญา: job.contract_info || '',
    'อาชีพ/ผู้ติดต่อ': job.occupation || '',
    ขออนุมัติ: job.approval_request || '',
    ขอวันติดตั้ง: excelDate(job.install_date) || job.install_date_text || '',
    'เลข NON': job.non_number || '',
    หมายเหตุเซล: job.sales_note || '',
    หมายเหตุถึงช่าง: job.tech_note || '',
    AccessNo: job.access_no || '',
    สถานะงานติดตั้ง: installationStatusMeta(job)?.label || '',
    ทีมติดตั้ง: job.install_team_name || '',
    ช่างผู้รับผิดชอบ: job.install_assignee_name || '',
    วันติดตาม: excelDate(job.follow_up_at),
    เวลาติดตาม: job.follow_up_time || '',
    ช่องทางติดตาม: job.follow_up_channel || '',
    รายละเอียดติดตาม: job.follow_up_note || '',
    Splitter: job.splitter_code || job.splitter_name || '',
    ระยะสายประมาณเมตร: job.estimated_cable_m ?? '',
    เหตุผลไม่ได้: job.lost_reason || '',
    หมายเหตุเพิ่มเติม: job.remark || '',
    พิกัดLat: job.lat ?? '',
    พิกัดLng: job.lng ?? '',
    ...(isAdmin ? { เซลผู้ดูแล: job.owner_name || '' } : {}),
    สร้างเมื่อ: job.created_at || '',
    อัปเดตล่าสุด: job.updated_at || '',
  }));
}

function computeSheetColumnWidths(rows) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  return headers.map((header) => {
    let maxLen = String(header).length;
    rows.forEach((row) => {
      const v = row[header] == null ? '' : String(row[header]);
      if (v.length > maxLen) maxLen = v.length;
    });
    return { wch: Math.min(60, Math.max(10, maxLen + 2)) };
  });
}

function Field({ label, required, children }) {
  return (
    <div>
      <label className={labelCls}>
        {label}
        {required ? <span className="text-red-500"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function toDateFromISO(iso) {
  if (!iso) return undefined;
  const parts = String(iso).split('-');
  if (parts.length !== 3) return undefined;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  const d = Number(parts[2]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined;
  return new Date(y, m - 1, d);
}

function toISODateString(date) {
  if (!(date instanceof Date)) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function prettyThaiDate(iso) {
  const d = toDateFromISO(iso);
  if (!d) return '';
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' });
}

function FancySelect({ value, onChange, options, disabled, placeholder = 'เลือกข้อมูล' }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${inputCls} flex items-center justify-between text-left ${open ? 'ring-2 ring-[#A3E635]/35 border-[#B7E45A]' : ''}`}
      >
        <span className={selected ? 'text-[#1F2937]' : 'text-[#9CA3AF]'}>{selected?.label || placeholder}</span>
        <svg className={`w-4 h-4 text-[#6B7280] transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && !disabled && (
        <div className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12),0_4px_16px_rgba(0,0,0,0.06)]">
          <div className="max-h-72 overflow-y-auto p-2">
            {options.map((opt) => {
              const active = String(opt.value) === String(value);
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                    active
                      ? 'bg-[#A3E635]/15 text-[#1F2937] border border-[#A3E635]/40'
                      : 'text-[#374151] hover:bg-[#F3F4F6]'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FancyDatePicker({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={`${inputCls} flex items-center justify-between text-left ${open ? 'ring-2 ring-[#A3E635]/35 border-[#B7E45A]' : ''}`}
      >
        <span className={value ? 'text-[#1F2937]' : 'text-[#9CA3AF]'}>
          {value ? prettyThaiDate(value) : 'เลือกวันที่ติดตั้ง'}
        </span>
        <svg className="w-4 h-4 text-[#6B7280]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 2v3m8-3v3M4.5 9.5h15M5 4.5h14a1.5 1.5 0 011.5 1.5v13A1.5 1.5 0 0119 20.5H5A1.5 1.5 0 013.5 19V6A1.5 1.5 0 015 4.5z" />
        </svg>
      </button>
      {open && !disabled && (
        <div className="mt-2 rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden animate-filterDropIn z-[70] relative">
          <Calendar
            mode="single"
            selected={toDateFromISO(value)}
            onSelect={(date) => {
              onChange(toISODateString(date));
              setOpen(false);
            }}
            className="rdp p-4 bg-white border-[#E5E7EB] border-0 shadow-none rounded-none"
          />
        </div>
      )}
    </div>
  );
}

function ExpansionFormModal({ open, job, onClose, onSaved, isAdmin, salesName, salesUsers = [] }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState(1);
  const [nearby, setNearby] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingPreviews, setPendingPreviews] = useState([]);
  const fileRef = useRef(null);
  const isEdit = Boolean(job?.id);
  const locked = job?.status === 'handed_off';

  const totalPhotos = photos.length + pendingFiles.length;
  const stepMeta = [
    { id: 1, label: 'ข้อมูลลูกค้า' },
    { id: 2, label: 'หน้างาน/พิกัด' },
    { id: 3, label: 'รูปภาพ/บันทึก' },
  ];

  useEffect(() => {
    if (!open) return;
    setStep(1);
    let cancelled = false;

    const load = async () => {
      if (job?.id) {
        try {
          const { data } = await api.get(`/expansion/${job.id}`);
          if (cancelled) return;
          setForm({
            customer_type: data.customer_type === 'corporate' ? 'corporate' : 'general',
            customer_name: data.customer_name || '',
            id_card: data.id_card || '',
            phone: data.phone || '',
            address: data.address || '',
            package_name: data.package_name || '',
            contract_info: data.contract_info || '',
            occupation: data.occupation || '',
            approval_request: data.approval_request || '',
            install_date: data.install_date ? String(data.install_date).slice(0, 10) : '',
            install_date_text: data.install_date_text || '',
            non_number: data.non_number || '',
            sales_note: data.sales_note || '',
            tech_note: data.tech_note || '',
            access_no: data.access_no || '',
            owner_user_id: data.owner_user_id || '',
            entry_fee_request: data.entry_fee_request ?? '',
            pair_line: data.pair_line || '',
            lat: data.lat != null ? Number(data.lat) : null,
            lng: data.lng != null ? Number(data.lng) : null,
            splitter_id: data.splitter_id != null ? Number(data.splitter_id) : null,
            straight_distance_m: data.straight_distance_m != null ? String(data.straight_distance_m) : '',
            estimated_cable_m: data.estimated_cable_m != null ? String(data.estimated_cable_m) : '',
            splitter_note: data.splitter_note || '',
            radius_m: data.radius_m ?? 500,
            status: data.status || 'draft',
            follow_up_at: data.follow_up_at ? String(data.follow_up_at).slice(0, 10) : '',
            follow_up_time: data.follow_up_time ? String(data.follow_up_time).slice(0, 5) : '',
            follow_up_channel: data.follow_up_channel || '',
            follow_up_note: data.follow_up_note || '',
            remark: data.remark || '',
            lost_reason: data.lost_reason || '',
          });
          setPhotos(Array.isArray(data.photos) ? data.photos : []);
        } catch (err) {
          console.error(err);
          setForm(emptyForm());
          setPhotos([]);
        }
      } else {
        setForm({
          ...emptyForm(),
          owner_user_id: isAdmin && salesUsers[0]?.id ? String(salesUsers[0].id) : '',
        });
        setPhotos([]);
      }
      setPendingFiles([]);
      setPendingPreviews((prev) => {
        prev.forEach((u) => URL.revokeObjectURL(u));
        return [];
      });
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, job]);

  useEffect(() => {
    if (!open || form.lat == null || form.lng == null) {
      setNearby([]);
      return undefined;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get('/splitters/nearby', {
          params: { lat: form.lat, lng: form.lng, radius_m: NEARBY_RADIUS_M },
        });
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setNearby(list);
        setForm((prev) => {
          if (prev.splitter_id && list.some((s) => Number(s.id) === Number(prev.splitter_id))) {
            const sp = list.find((s) => Number(s.id) === Number(prev.splitter_id));
            const dist = Math.round(Number(sp.distance_m));
            return {
              ...prev,
              straight_distance_m: String(dist),
            };
          }
          if (!list.length) {
            return { ...prev, splitter_id: null, straight_distance_m: '' };
          }
          const nearest = list[0];
          const dist = Math.round(Number(nearest.distance_m));
          const keepEstimate = prev.estimated_cable_m !== '' && prev.estimated_cable_m != null;
          return {
            ...prev,
            splitter_id: nearest.id,
            straight_distance_m: String(dist),
            estimated_cable_m: keepEstimate ? prev.estimated_cable_m : String(dist),
          };
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) setNearby([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, form.lat, form.lng]);

  if (!open) return null;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const validateStep = (targetStep) => {
    if (targetStep === 1) {
      if (!form.customer_name.trim()) {
        return form.customer_type === 'corporate'
          ? 'กรุณากรอกชื่อบริษัท/หน่วยงาน'
          : 'กรุณากรอกชื่อ-นามสกุลลูกค้า';
      }
      if (!form.id_card.trim()) {
        return form.customer_type === 'corporate'
          ? 'กรุณากรอกเลขผู้เสียภาษี'
          : 'กรุณากรอกเลขบัตรประชาชน';
      }
      if (!form.phone.trim()) return 'กรุณากรอกเบอร์ติดต่อ';
      const phoneDigits = form.phone.replace(/\D/g, '');
      if (phoneDigits.length < 9 || phoneDigits.length > 15) return 'เบอร์โทรศัพท์ต้องมี 9-15 หลัก';
      const idDigits = form.id_card.replace(/\D/g, '');
      if (idDigits.length !== 13) return 'เลขบัตรประชาชน/เลขผู้เสียภาษีต้องมี 13 หลัก';
      if (!form.occupation.trim()) return form.customer_type === 'corporate' ? 'กรุณากรอกผู้ติดต่อ' : 'กรุณากรอกอาชีพ';
      if (!form.address.trim()) return 'กรุณากรอกที่อยู่ติดตั้ง';
      if (!form.package_name.trim()) return 'กรุณากรอกแพ็กเกจ';
      if (!form.contract_info.trim()) return 'กรุณากรอกสัญญา';
      if (!form.install_date && !form.install_date_text.trim()) return 'กรุณาระบุขอวันติดตั้ง หรือ เลข NON';
      return null;
    }
    if (targetStep === 2) {
      if (form.lat == null || form.lng == null) return 'กรุณาปักพิกัดบ้านลูกค้า';
      if (form.estimated_cable_m === '' || form.estimated_cable_m == null) return 'กรุณากรอกระยะสายประมาณ';
      if (Number(form.estimated_cable_m) < 0) return 'ระยะสายต้องไม่ติดลบ';
      return null;
    }
    if (targetStep === 3) {
      if (totalPhotos < MIN_PHOTOS) return `ต้องมีรูปอย่างน้อย ${MIN_PHOTOS} รูป`;
      if (totalPhotos > MAX_PHOTOS) return `รูปได้ไม่เกิน ${MAX_PHOTOS} รูป`;
      return null;
    }
    return null;
  };

  const handleNextStep = () => {
    const errMsg = validateStep(step);
    if (errMsg) {
      Swal.fire({ icon: 'warning', title: errMsg });
      return;
    }
    setStep((prev) => Math.min(3, prev + 1));
  };

  const selectSplitter = (id) => {
    const sp = nearby.find((s) => Number(s.id) === Number(id));
    if (!sp) {
      setField('splitter_id', id);
      return;
    }
    const dist = Math.round(
      Number(sp.distance_m) ||
        haversineMeters(Number(form.lat), Number(form.lng), Number(sp.lat), Number(sp.lng))
    );
    setForm((prev) => ({
      ...prev,
      splitter_id: sp.id,
      straight_distance_m: String(dist),
      estimated_cable_m: String(dist),
    }));
  };

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const room = MAX_PHOTOS - (photos.length + pendingFiles.length);
    if (room <= 0) {
      Swal.fire({ icon: 'warning', title: `อัปโหลดได้ไม่เกิน ${MAX_PHOTOS} รูป` });
      return;
    }
    const take = files.slice(0, room);
    const urls = take.map((f) => URL.createObjectURL(f));
    setPendingFiles((prev) => [...prev, ...take]);
    setPendingPreviews((prev) => [...prev, ...urls]);
  };

  const removePending = (idx) => {
    setPendingPreviews((prev) => {
      URL.revokeObjectURL(prev[idx]);
      return prev.filter((_, i) => i !== idx);
    });
    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeSavedPhoto = async (photoId) => {
    if (!job?.id || locked) return;
    try {
      const { data } = await api.delete(`/expansion/${job.id}/photos/${photoId}`);
      setPhotos(data.photos || []);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ลบรูปไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const uploadPending = async (expansionId) => {
    if (!pendingFiles.length) return;
    const fd = new FormData();
    pendingFiles.forEach((f) => fd.append('images', f));
    const { data } = await api.post(`/expansion/${expansionId}/photos`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setPhotos(data.photos || []);
    setPendingPreviews((prev) => {
      prev.forEach((u) => URL.revokeObjectURL(u));
      return [];
    });
    setPendingFiles([]);
    return data.photo_count;
  };

  const validateClient = () => {
    for (const stepNo of [1, 2, 3]) {
      const err = validateStep(stepNo);
      if (err) return err;
    }
    return null;
  };

  const handleSave = async () => {
    if (locked) return;
    const errMsg = validateClient();
    if (errMsg) {
      Swal.fire({ icon: 'warning', title: errMsg });
      return;
    }

    setSaving(true);
    let createdId = null;
    try {
      const payload = {
        ...form,
        approval_request: form.approval_request || null,
        install_date: form.install_date || null,
        follow_up_at: form.follow_up_at || null,
        follow_up_time: form.follow_up_time || null,
        follow_up_channel: form.follow_up_channel || null,
        follow_up_note: form.follow_up_note || null,
        owner_user_id: form.owner_user_id || undefined,
        splitter_id: form.splitter_id || null,
        straight_distance_m: form.straight_distance_m === '' ? null : form.straight_distance_m,
        estimated_cable_m: form.estimated_cable_m === '' ? null : form.estimated_cable_m,
        skip_photo_check: '1',
      };

      const { data: duplicateResult } = await api.post('/expansion/duplicate-check', {
        ...payload,
        exclude_id: job?.id || null,
      });
      if (duplicateResult?.duplicate) {
        const names = (duplicateResult.rows || []).slice(0, 3)
          .map((row) => `#${row.id} ${row.customer_name || '-'} (${STATUS_META[row.status]?.label || row.status})`)
          .join('<br>');
        const confirmDuplicate = await Swal.fire({
          icon: 'warning',
          title: 'พบข้อมูลที่อาจซ้ำ',
          html: `<div class="text-sm text-left">${names}<br><br>ตรวจสอบเบอร์โทร เลขบัตร NON และ Access ก่อนยืนยัน</div>`,
          showCancelButton: true,
          confirmButtonText: 'ยืนยันบันทึก',
          cancelButtonText: 'กลับไปตรวจสอบ',
          confirmButtonColor: '#b45309',
        });
        if (!confirmDuplicate.isConfirmed) return;
        payload.override_duplicate = true;
      }

      let id = job?.id;
      if (isEdit) {
        await uploadPending(id);
        await api.put(`/expansion/${id}`, payload);
      } else {
        const { data: created } = await api.post('/expansion', payload);
        id = created.id;
        createdId = id;
        await uploadPending(id);
        await api.put(`/expansion/${id}`, { ...payload, skip_photo_check: undefined });
      }

      onSaved?.();
      onClose();
      Swal.fire({
        icon: 'success',
        title: isEdit ? 'บันทึกแล้ว' : 'สร้างงานขายแล้ว',
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (err) {
      if (createdId) {
        try { await api.post(`/expansion/${createdId}/rollback-create`); } catch { /* keep original error */ }
      }
      Swal.fire({
        icon: 'error',
        title: 'บันทึกไม่สำเร็จ',
        text: err.response?.data?.error || err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-[#1F2937]/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white rounded-t-3xl sm:rounded-3xl border border-[#E5E7EB] shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] shrink-0">
          <div>
            <h3 className="font-black text-[#1F2937] text-lg">
              {isEdit ? `แก้ไขงานขาย #${job.id}` : 'สร้างงานขายใหม่'}
            </h3>
            {isEdit && (
              <div className="mt-1">
                <StatusBadge status={job.status} />
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-[#F3F4F6] text-[#6B7280]">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
            <div className="flex items-center gap-2 flex-wrap">
              {stepMeta.map((s) => (
                <div
                  key={s.id}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                    step === s.id
                      ? 'bg-[#A3E635] border-[#84cc16] text-[#1F2937]'
                      : step > s.id
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-white border-[#E5E7EB] text-[#6B7280]'
                  }`}
                >
                  {s.id}. {s.label}
                </div>
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ประเภทลูกค้า" required>
              <FancySelect
                disabled={locked}
                value={form.customer_type || 'general'}
                onChange={(v) => setField('customer_type', v)}
                options={[
                  { value: 'general', label: 'ลูกค้าทั่วไป' },
                  { value: 'corporate', label: 'นิติบุคคล' },
                ]}
              />
            </Field>
            <Field label={form.customer_type === 'corporate' ? 'ชื่อบริษัท/หน่วยงาน' : 'ชื่อ-นามสกุลลูกค้า'} required>
              <input disabled={locked} value={form.customer_name} onChange={(e) => setField('customer_name', e.target.value)} className={inputCls} />
            </Field>
            <Field label={form.customer_type === 'corporate' ? 'เลขผู้เสียภาษี' : 'เลขบัตรประชาชน'} required>
              <input disabled={locked} value={form.id_card} onChange={(e) => setField('id_card', e.target.value)} className={inputCls} inputMode="numeric" />
            </Field>
            <Field label="เบอร์ติดต่อ" required>
              <input disabled={locked} value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={inputCls} />
            </Field>
            <Field label={form.customer_type === 'corporate' ? 'ผู้ติดต่อ' : 'อาชีพ'} required>
              <input disabled={locked} value={form.occupation} onChange={(e) => setField('occupation', e.target.value)} className={inputCls} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="ที่อยู่ติดตั้ง" required>
                <textarea disabled={locked} value={form.address} onChange={(e) => setField('address', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </Field>
            </div>
            <Field label="แพ็กเกจ" required>
              <input disabled={locked} value={form.package_name} onChange={(e) => setField('package_name', e.target.value)} className={inputCls} />
            </Field>
            <Field label="สัญญา" required>
              <input disabled={locked} value={form.contract_info} onChange={(e) => setField('contract_info', e.target.value)} className={inputCls} />
            </Field>
            <Field label="ขออนุมัติ">
              <FancySelect
                disabled={locked}
                value={form.approval_request || ''}
                onChange={(v) => setField('approval_request', v)}
                options={[
                  { value: '', label: 'ไม่ระบุ' },
                  { value: 'ฟรีค่าแรกเข้า', label: 'ฟรีค่าแรกเข้า' },
                  { value: 'บ้านเลขที่0', label: 'บ้านเลขที่0' },
                  { value: 'ใบอนุญาตทำงาน', label: 'ใบอนุญาตทำงาน' },
                ]}
              />
            </Field>
            <Field label="ขอวันติดตั้ง (วันที่)">
              <FancyDatePicker
                disabled={locked}
                value={form.install_date}
                onChange={(v) => setField('install_date', v)}
              />
            </Field>
            <Field label="หมายเหตุวันติดตั้ง" required={!form.install_date}>
              <input disabled={locked} value={form.install_date_text} onChange={(e) => setField('install_date_text', e.target.value)} className={inputCls} placeholder="เช่น รอลูกค้ายืนยันวัน" />
            </Field>
            <Field label="เลข NON (ถ้ามี)">
              <input disabled={locked} value={form.non_number} onChange={(e) => setField('non_number', e.target.value)} className={inputCls} placeholder="เช่น NON12345678" />
            </Field>
            <Field label="Access Number (ถ้ามี)">
              <input disabled={locked} value={form.access_no} onChange={(e) => setField('access_no', e.target.value)} className={inputCls} placeholder="เช่น 880xxxxxxx" />
            </Field>
            <Field label="พนักงานขาย">
              {isAdmin && salesUsers.length ? (
                <FancySelect
                  disabled={locked}
                  value={String(form.owner_user_id || '')}
                  onChange={(v) => setField('owner_user_id', v)}
                  placeholder="เลือกพนักงานขาย"
                  options={salesUsers.map((sales) => ({ value: String(sales.id), label: sales.full_name || sales.username }))}
                />
              ) : (
                <input disabled value={job?.owner_name || salesName || '-'} className={`${inputCls} bg-[#F3F4F6]`} />
              )}
            </Field>
            <Field label="ขอค่าแรกเข้า (บาท)">
              <input disabled={locked} type="number" min="0" step="0.01" value={form.entry_fee_request} onChange={(e) => setField('entry_fee_request', e.target.value)} className={inputCls} />
            </Field>
            <Field label="คู่สาย">
              <input disabled={locked} value={form.pair_line} onChange={(e) => setField('pair_line', e.target.value)} className={inputCls} />
            </Field>
            <div className="sm:col-span-2 rounded-2xl border border-sky-200 bg-sky-50/70 p-3">
              <p className="text-xs font-black text-sky-800 mb-3">นัดติดตามลูกค้า</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field label="วันที่ติดตาม">
                  <FancyDatePicker disabled={locked} value={form.follow_up_at} onChange={(v) => setField('follow_up_at', v)} />
                </Field>
                <Field label="เวลา">
                  <input disabled={locked} type="time" value={form.follow_up_time} onChange={(e) => setField('follow_up_time', e.target.value)} className={inputCls} />
                </Field>
                <Field label="ช่องทาง">
                  <FancySelect
                    disabled={locked}
                    value={form.follow_up_channel}
                    onChange={(v) => setField('follow_up_channel', v)}
                    options={[
                      { value: '', label: 'ไม่ระบุ' },
                      { value: 'phone', label: 'โทรศัพท์' },
                      { value: 'line', label: 'LINE' },
                      { value: 'visit', label: 'เข้าพบ' },
                      { value: 'other', label: 'อื่น ๆ' },
                    ]}
                  />
                </Field>
                <div className="sm:col-span-3">
                  <Field label="สิ่งที่ต้องติดตาม">
                    <input disabled={locked} value={form.follow_up_note} onChange={(e) => setField('follow_up_note', e.target.value)} className={inputCls} placeholder="เช่น โทรยืนยันเอกสารและวันติดตั้ง" />
                  </Field>
                </div>
              </div>
            </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Field label="หมายเหตุการขาย">
                <textarea disabled={locked} value={form.sales_note} onChange={(e) => setField('sales_note', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="หมายเหตุถึงพี่ช่าง">
                <textarea disabled={locked} value={form.tech_note} onChange={(e) => setField('tech_note', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </Field>
            </div>
            <Field label="ระยะสายประมาณ (ม.)" required>
              <input
                disabled={locked}
                type="number"
                step="1"
                value={form.estimated_cable_m}
                onChange={(e) => setField('estimated_cable_m', e.target.value)}
                className={inputCls}
              />
            </Field>
            {(form.status === 'lost' || job?.status === 'lost') && (
              <div className="sm:col-span-2">
                <Field label="เหตุผลที่ไม่ได้">
                  <input disabled={locked} value={form.lost_reason} onChange={(e) => setField('lost_reason', e.target.value)} className={`${inputCls} border-red-200 bg-red-50`} />
                </Field>
              </div>
            )}
            </div>
          )}

          {step === 2 && (
          <div>
            <p className={`${labelCls} mb-2`}>พิกัดบ้าน + Splitter</p>
            <ExpansionMapPicker
              mode="sales"
              lat={form.lat}
              lng={form.lng}
              selectable={!locked}
              height="280px"
              splitters={nearby}
              selectedSplitterId={form.splitter_id}
              onSelectSplitter={selectSplitter}
              onPick={({ lat, lng }) => {
                setField('lat', lat);
                setField('lng', lng);
              }}
            />
            {form.lat != null && form.lng != null && (
              <p className="text-xs text-[#6B7280] mt-2 font-medium">
                บ้าน: {Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}
              </p>
            )}
          </div>
          )}

          {step === 3 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className={labelCls}>
                รูปภาพ <span className="text-red-500">*</span>
                <span className="normal-case font-semibold text-[#9CA3AF] ml-1">
                  ({totalPhotos}/{MAX_PHOTOS} อย่างน้อย {MIN_PHOTOS})
                </span>
              </p>
              {!locked && totalPhotos < MAX_PHOTOS && (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-[#F3F4F6] border border-[#E5E7EB]"
                >
                  + เพิ่มรูป
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickFiles} />
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-square rounded-xl overflow-hidden border border-[#E5E7EB] bg-[#F3F4F6]">
                  <img src={resolveImageUrl(p.image_path)} alt="" className="w-full h-full object-cover" />
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => removeSavedPhoto(p.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {pendingPreviews.map((url, idx) => (
                <div key={`p-${idx}`} className="relative aspect-square rounded-xl overflow-hidden border border-amber-200 bg-amber-50">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                  {!locked && (
                    <button
                      type="button"
                      onClick={() => removePending(idx)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}

          {isAdmin && job?.owner_name && (
            <p className="text-xs text-[#9CA3AF]">เจ้าของงาน: {job.owner_name}</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#E5E7EB] flex gap-2 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-[#F3F4F6] font-bold text-[#374151] text-sm">
            ปิด
          </button>
          {!locked && (
            <>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                  className="flex-1 py-3 rounded-xl bg-white border border-[#E5E7EB] font-bold text-[#374151] text-sm"
                >
                  ย้อนกลับ
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-[#1F2937]"
                  style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
                >
                  ถัดไป
                </button>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="flex-1 py-3 rounded-xl font-bold text-sm text-[#1F2937] disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
                >
                  {saving ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SplitterAdminPanel() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptySplitterForm());
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('active');
  const [q, setQ] = useState('');
  const [importing, setImporting] = useState(false);
  const [kmlPreview, setKmlPreview] = useState(null);
  const [kmlFile, setKmlFile] = useState(null);
  const kmlInputRef = useRef(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/splitters', {
        params: { status: statusFilter, q: q.trim() || undefined },
      });
      setList(Array.isArray(data) ? data : []);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'โหลด Splitter ไม่สำเร็จ', text: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, q]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setEditingId(null);
    setForm(emptySplitterForm());
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setForm({
      code: row.code || '',
      name: row.name || '',
      area: row.area || '',
      remark: row.remark || '',
      lat: row.lat != null ? Number(row.lat) : null,
      lng: row.lng != null ? Number(row.lng) : null,
      status: row.status || 'active',
    });
  };

  const handleSave = async () => {
    if (form.lat == null || form.lng == null) {
      Swal.fire({ icon: 'warning', title: 'กรุณาปักพิกัด Splitter บนแผนที่' });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form };
      if (editingId) {
        await api.put(`/splitters/${editingId}`, payload);
      } else {
        await api.post('/splitters', payload);
      }
      resetForm();
      fetchList();
      Swal.fire({ icon: 'success', title: editingId ? 'อัปเดตแล้ว' : 'เพิ่ม Splitter แล้ว', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: err.response?.data?.error || err.message });
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (row) => {
    const conf = await Swal.fire({
      icon: 'warning',
      title: 'ปิดใช้งาน Splitter?',
      text: row.code || row.name || `#${row.id}`,
      showCancelButton: true,
      confirmButtonText: 'ปิดใช้งาน',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    if (!conf.isConfirmed) return;
    try {
      await api.delete(`/splitters/${row.id}`);
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const reactivate = async (row) => {
    try {
      await api.put(`/splitters/${row.id}`, { status: 'active' });
      fetchList();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const handleKmlPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    setKmlPreview(null);
    setKmlFile(file);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/splitters/import-kml', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setKmlPreview(data);
    } catch (err) {
      setKmlFile(null);
      Swal.fire({
        icon: 'error',
        title: 'อ่านไฟล์ KML ไม่สำเร็จ',
        text: err.response?.data?.error || err.message,
      });
    } finally {
      setImporting(false);
    }
  };

  const confirmKmlImport = async () => {
    if (!kmlFile || !kmlPreview?.summary?.will_import) return;
    const conf = await Swal.fire({
      icon: 'question',
      title: 'ยืนยันนำเข้า Splitter?',
      html: `<p class="text-sm text-left">จะบันทึก <b>${kmlPreview.summary.will_import}</b> จุดใหม่<br/>ข้าม ${kmlPreview.summary.skipped || 0} จุด (ซ้ำ)<br/>หลังบันทึก เซลจะใช้หา Splitter ใกล้บ้านได้ทันที</p>`,
      showCancelButton: true,
      confirmButtonText: 'บันทึกลงระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#65a30d',
    });
    if (!conf.isConfirmed) return;

    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', kmlFile);
      fd.append('confirm', '1');
      const { data } = await api.post('/splitters/import-kml', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setKmlPreview(null);
      setKmlFile(null);
      fetchList();
      Swal.fire({
        icon: 'success',
        title: 'นำเข้าสำเร็จ',
        text: data.message || `บันทึก ${data.summary?.imported || 0} จุด`,
      });
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'นำเข้าไม่สำเร็จ',
        text: err.response?.data?.error || err.message,
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-black text-[#1F2937]">Import จาก Google Earth (KML)</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">
              นำเข้าหลายจุดทีเดียว → บันทึกลงคลัง Splitter → เซลสร้างงานขายแล้วระบบจับจุดใกล้บ้านอัตโนมัติ
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={kmlInputRef}
              type="file"
              accept=".kml,application/vnd.google-earth.kml+xml,text/xml,application/xml"
              className="hidden"
              onChange={handleKmlPick}
            />
            <button
              type="button"
              disabled={importing}
              onClick={() => kmlInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white hover:bg-[#F9FAFB] disabled:opacity-60"
            >
              {importing ? 'กำลังอ่านไฟล์...' : 'เลือกไฟล์ .kml'}
            </button>
          </div>
        </div>

        {kmlPreview && (
          <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="px-2 py-1 rounded-lg bg-white border border-[#E5E7EB] text-[#374151]">
                ไฟล์: {kmlPreview.filename || '-'}
              </span>
              <span className="px-2 py-1 rounded-lg bg-white border border-[#E5E7EB] text-[#374151]">
                พบทั้งหมด {kmlPreview.summary?.total || 0}
              </span>
              <span className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700">
                จะนำเข้า {kmlPreview.summary?.will_import || 0}
              </span>
              <span className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                ข้ามซ้ำ {kmlPreview.summary?.skipped || 0}
              </span>
            </div>

            {(kmlPreview.preview || []).length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white divide-y divide-[#F3F4F6]">
                {kmlPreview.preview.map((row, idx) => (
                  <div key={`${row.code}-${idx}`} className="px-3 py-2 text-xs">
                    <p className="font-black text-[#1F2937] truncate">{row.code || row.name}</p>
                    <p className="text-[#6B7280]">
                      {row.area || '-'} · {Number(row.lat).toFixed(5)}, {Number(row.lng).toFixed(5)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={importing || !(kmlPreview.summary?.will_import > 0)}
                onClick={confirmKmlImport}
                className="px-4 py-2.5 rounded-xl text-xs font-black text-[#1F2937] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
              >
                {importing ? 'กำลังบันทึก...' : `ยืนยันบันทึก ${kmlPreview.summary?.will_import || 0} จุด`}
              </button>
              <button
                type="button"
                disabled={importing}
                onClick={() => {
                  setKmlPreview(null);
                  setKmlFile(null);
                }}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white border border-[#E5E7EB]"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-black text-[#1F2937]">{editingId ? `แก้ไข Splitter #${editingId}` : 'ปัก Splitter ใหม่'}</h3>
            <p className="text-xs text-[#6B7280] mt-0.5">แอดมินปักจุดเก็บในระบบ — เซลจะเห็นเมื่อปักบ้านลูกค้าใกล้ๆ</p>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-3 py-2 rounded-xl text-xs font-bold bg-[#F3F4F6]">
              ยกเลิกแก้ไข
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="รหัส">
            <input value={form.code} onChange={(e) => setField('code', e.target.value)} className={inputCls} placeholder="เช่น SP-BT-01" />
          </Field>
          <Field label="ชื่อ">
            <input value={form.name} onChange={(e) => setField('name', e.target.value)} className={inputCls} />
          </Field>
          <Field label="พื้นที่/โซน">
            <input value={form.area} onChange={(e) => setField('area', e.target.value)} className={inputCls} />
          </Field>
          <Field label="หมายเหตุ">
            <input value={form.remark} onChange={(e) => setField('remark', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <ExpansionMapPicker
          mode="admin"
          lat={form.lat}
          lng={form.lng}
          selectable
          height="260px"
          splitters={
            form.lat != null && form.lng != null
              ? [{ id: editingId || 'new', lat: form.lat, lng: form.lng, code: form.code || 'NEW' }]
              : []
          }
          selectedSplitterId={editingId || 'new'}
          onPick={({ lat, lng }) => {
            setField('lat', lat);
            setField('lng', lng);
          }}
        />

        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="w-full py-3 rounded-xl font-bold text-sm text-[#1F2937] disabled:opacity-60"
          style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
        >
          {saving ? 'กำลังบันทึก...' : editingId ? 'อัปเดต Splitter' : 'บันทึก Splitter'}
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row gap-2 mb-3">
          <div className="flex gap-1.5 p-1 bg-[#F3F4F6] rounded-xl flex-1">
            {[
              { key: 'active', label: 'ใช้งาน' },
              { key: 'inactive', label: 'ปิดแล้ว' },
              { key: 'all', label: 'ทั้งหมด' },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatusFilter(t.key)}
                className={`flex-1 py-2 rounded-lg text-xs font-black ${
                  statusFilter === t.key ? 'bg-white text-[#1F2937] shadow-sm' : 'text-[#6B7280]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              fetchList();
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหารหัส/ชื่อ/โซน"
              className="px-3 py-2 rounded-xl border border-[#E5E7EB] text-sm outline-none"
            />
            <button type="submit" className="px-3 py-2 rounded-xl text-xs font-bold bg-[#F3F4F6] border border-[#E5E7EB]">
              ค้นหา
            </button>
          </form>
        </div>

        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-[#E5E7EB]/60 rounded-xl" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <p className="text-center text-[#9CA3AF] font-bold py-8">ยังไม่มี Splitter</p>
        ) : (
          <div className="space-y-2">
            {list.map((row) => (
              <div key={row.id} className="border border-[#E5E7EB] rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
                <div className="min-w-0">
                  <p className="font-black text-[#1F2937] text-sm truncate">
                    {row.code || `SP-${row.id}`} {row.name ? `· ${row.name}` : ''}
                  </p>
                  <p className="text-xs text-[#6B7280]">
                    {row.area || '-'} · {Number(row.lat).toFixed(5)}, {Number(row.lng).toFixed(5)}
                  </p>
                  <p className="text-[10px] font-bold mt-0.5">
                    {row.status === 'active' ? (
                      <span className="text-emerald-600">active</span>
                    ) : (
                      <span className="text-red-500">inactive</span>
                    )}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" onClick={() => startEdit(row)} className="px-3 py-2 rounded-lg text-xs font-bold bg-[#F3F4F6]">
                    แก้ไข
                  </button>
                  {row.status === 'active' ? (
                    <button type="button" onClick={() => deactivate(row)} className="px-3 py-2 rounded-lg text-xs font-bold bg-red-50 text-red-600">
                      ปิดใช้
                    </button>
                  ) : (
                    <button type="button" onClick={() => reactivate(row)} className="px-3 py-2 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700">
                      เปิดใช้
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function followUpState(iso) {
  if (!iso) return null;
  const value = String(iso).slice(0, 10);
  const today = new Date().toLocaleDateString('en-CA');
  if (value < today) return 'overdue';
  if (value === today) return 'today';
  return 'future';
}

function installationStatusMeta(job) {
  if (!job?.handed_off_job_id) return null;
  if (job.install_status === 'completed') return { label: 'ติดตั้งสำเร็จ', className: 'bg-emerald-50 border-emerald-200 text-emerald-700' };
  if (job.install_status === 'in_progress') return { label: 'กำลังติดตั้ง', className: 'bg-violet-50 border-violet-200 text-violet-700' };
  if (['failed', 'cancelled', 'postponed'].includes(job.install_status)) return { label: 'งานติดตั้งมีปัญหา', className: 'bg-red-50 border-red-200 text-red-700' };
  if (job.install_team_id || job.install_assignee_id) {
    return { label: `มอบหมายแล้ว${job.install_team_name ? ` · ${job.install_team_name}` : ''}${job.install_assignee_name ? ` · ${job.install_assignee_name}` : ''}`, className: 'bg-sky-50 border-sky-200 text-sky-700' };
  }
  return { label: 'รอแอดมินมอบหมายงานติดตั้ง', className: 'bg-amber-50 border-amber-200 text-amber-800' };
}

const HISTORY_ACTION_LABELS = {
  created: 'สร้างงานขาย',
  updated: 'แก้ไขข้อมูล',
  status_changed: 'เปลี่ยนสถานะ',
  assigned: 'เปลี่ยนผู้รับผิดชอบ',
  handed_off: 'ส่งต่องานติดตั้ง',
  photos_added: 'เพิ่มรูปภาพ',
  photo_deleted: 'ลบรูปภาพ',
};

const HISTORY_FIELD_LABELS = {
  customer_name: 'ชื่อลูกค้า', phone: 'เบอร์โทร', address: 'ที่อยู่', package_name: 'แพ็กเกจ',
  contract_info: 'สัญญา', occupation: 'อาชีพ/ผู้ติดต่อ', access_no: 'Access Number',
  non_number: 'เลข NON', follow_up_at: 'วันติดตาม', follow_up_time: 'เวลาติดตาม',
  follow_up_channel: 'ช่องทางติดตาม', follow_up_note: 'รายละเอียดติดตาม', status: 'สถานะ',
  owner_user_id: 'ผู้รับผิดชอบ', install_date: 'วันติดตั้ง', install_date_text: 'หมายเหตุวันติดตั้ง',
  sales_note: 'หมายเหตุการขาย', tech_note: 'หมายเหตุถึงช่าง', pair_line: 'คู่สาย',
  estimated_cable_m: 'ระยะสาย', splitter_id: 'Splitter', approval_request: 'คำขออนุมัติ',
};

function SalesHistoryModal({ job, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!job?.id) return;
    let active = true;
    api.get(`/expansion/${job.id}/history`)
      .then(({ data }) => { if (active) setRows(Array.isArray(data) ? data : []); })
      .catch((err) => Swal.fire({ icon: 'error', title: 'โหลดประวัติไม่สำเร็จ', text: err.response?.data?.error || err.message }))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [job]);

  if (!job) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button type="button" aria-label="ปิดประวัติ" className="absolute inset-0 bg-slate-900/55 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl max-h-[88vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-black text-slate-800">ประวัติงานขาย #{job.id}</h3>
            <p className="text-xs text-slate-500 truncate">{job.customer_name}</p>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600">✕</button>
        </div>
        <div className="overflow-y-auto p-4">
          {loading ? (
            <p className="py-10 text-center text-slate-400">กำลังโหลด...</p>
          ) : rows.length === 0 ? (
            <p className="py-10 text-center text-slate-400">ยังไม่มีประวัติ</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => {
                const changedCount = Object.keys(row.changed_fields || {}).length;
                return (
                  <div key={row.id} className="relative pl-5 border-l-2 border-lime-300">
                    <span className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-lime-500 ring-4 ring-white" />
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-black text-slate-800">{HISTORY_ACTION_LABELS[row.action] || row.action}</p>
                        <p className="text-[10px] text-slate-400 whitespace-nowrap">{new Date(row.created_at).toLocaleString('th-TH')}</p>
                      </div>
                      {row.old_status !== row.new_status && row.new_status && (
                        <p className="text-xs text-slate-600 mt-1">
                          {STATUS_META[row.old_status]?.label || row.old_status || '-'} → {STATUS_META[row.new_status]?.label || row.new_status}
                        </p>
                      )}
                      {row.note && <p className="text-xs text-slate-600 mt-1">{row.note}</p>}
                      {changedCount > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          แก้ไข: {Object.keys(row.changed_fields).map((key) => HISTORY_FIELD_LABELS[key] || key).join(', ')}
                        </p>
                      )}
                      <p className="text-[11px] font-semibold text-slate-500 mt-2">โดย {row.created_by_name || 'ระบบ'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function progressPercent(value, target) {
  if (!target) return 0;
  return Math.min(100, Math.round((Number(value) || 0) * 100 / Number(target)));
}

function SalesAnalyticsPanel({ isAdmin, salesUsers }) {
  const [month, setMonth] = useState(() => new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [ownerId, setOwnerId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month };
      if (isAdmin && ownerId) params.owner_id = ownerId;
      const response = await api.get('/expansion/analytics', { params });
      setData(response.data || null);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'โหลดรายงานไม่สำเร็จ', text: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  }, [month, ownerId, isAdmin]);

  useEffect(() => {
    const timer = setTimeout(() => loadAnalytics(), 0);
    return () => clearTimeout(timer);
  }, [loadAnalytics]);

  const setTarget = async (row) => {
    const result = await Swal.fire({
      title: `ตั้งเป้า ${row.owner_name}`,
      html: `
        <div class="text-left space-y-3">
          <label class="block text-xs font-bold text-slate-600">ลูกค้าเป้าหมาย</label>
          <input id="target-leads" type="number" min="0" value="${row.target_leads || 0}" class="swal2-input !m-0 !w-full">
          <label class="block text-xs font-bold text-slate-600">ปิดการขายเป้าหมาย</label>
          <input id="target-won" type="number" min="0" value="${row.target_won || 0}" class="swal2-input !m-0 !w-full">
          <label class="block text-xs font-bold text-slate-600">ส่งติดตั้งเป้าหมาย</label>
          <input id="target-handoffs" type="number" min="0" value="${row.target_handoffs || 0}" class="swal2-input !m-0 !w-full">
        </div>`,
      showCancelButton: true,
      confirmButtonText: 'บันทึกเป้าหมาย',
      cancelButtonText: 'ยกเลิก',
      preConfirm: () => ({
        target_leads: Number(document.getElementById('target-leads')?.value || 0),
        target_won: Number(document.getElementById('target-won')?.value || 0),
        target_handoffs: Number(document.getElementById('target-handoffs')?.value || 0),
      }),
    });
    if (!result.isConfirmed) return;
    try {
      await api.put(`/expansion/targets/${row.owner_user_id}`, { month, ...result.value });
      await loadAnalytics();
      Swal.fire({ icon: 'success', title: 'บันทึกเป้าหมายแล้ว', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'บันทึกเป้าหมายไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const exportReport = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    const metrics = [
      ['เดือน', data.month], ['ลูกค้าใหม่', data.metrics?.leads || 0], ['ปิดการขาย', data.metrics?.won || 0],
      ['ส่งติดตั้ง', data.metrics?.handoffs || 0], ['อัตราปิดการขาย (%)', data.metrics?.conversion_rate || 0],
      ['วันเฉลี่ยก่อนปิด', data.metrics?.avg_days_to_win || 0], ['งานติดตามเกินกำหนด', data.metrics?.overdue_now || 0],
      ['งานติดตั้งรอมอบหมาย', data.installation?.waiting_assignment || 0],
    ].map(([หัวข้อ, ค่า]) => ({ หัวข้อ, ค่า }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(metrics), 'summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet((data.leaderboard || []).map((row, index) => ({
      ลำดับ: index + 1, พนักงานขาย: row.owner_name, ลูกค้าใหม่: row.leads, ปิดการขาย: row.won,
      ส่งติดตั้ง: row.handoffs, เป้าลูกค้า: row.target_leads, เป้าปิดการขาย: row.target_won,
      เป้าส่งติดตั้ง: row.target_handoffs,
    }))), 'sales_team');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.packages || []), 'packages');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.trend || []), 'daily_trend');
    XLSX.writeFile(wb, `sales_performance_${data.month}.xlsx`);
  };

  if (loading && !data) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-slate-400 font-bold">กำลังคำนวณผลงานขาย...</div>;
  }
  const metrics = data?.metrics || {};
  const maxTrend = Math.max(1, ...(data?.trend || []).map((row) => Math.max(row.leads, row.won, row.handoffs)));
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-800">ผลงานและเป้าหมายงานขาย</h2>
          <p className="text-xs text-slate-500 mt-0.5">ดูตั้งแต่ลูกค้าใหม่ ปิดการขาย จนถึงสถานะงานติดตั้ง</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold" />
          {isAdmin && (
            <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold bg-white">
              <option value="">ทั้งทีมขาย</option>
              {salesUsers.map((sales) => <option key={sales.id} value={sales.id}>{sales.full_name || sales.username}</option>)}
            </select>
          )}
          <button type="button" onClick={exportReport} className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-700">Export รายงาน</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {[
          ['ลูกค้าใหม่', metrics.leads, 'bg-white border-slate-200 text-slate-800'],
          ['ปิดการขาย', metrics.won, 'bg-emerald-50 border-emerald-200 text-emerald-800'],
          ['Conversion', `${metrics.conversion_rate || 0}%`, 'bg-lime-50 border-lime-200 text-lime-800'],
          ['เฉลี่ยก่อนปิด', `${metrics.avg_days_to_win || 0} วัน`, 'bg-sky-50 border-sky-200 text-sky-800'],
        ].map(([label, value, tone]) => (
          <div key={label} className={`rounded-2xl border p-4 ${tone}`}>
            <p className="text-[11px] font-bold opacity-70">{label}</p>
            <p className="text-2xl font-black mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-black text-slate-800 mb-3">เส้นทางการขายของลูกค้าใหม่เดือนนี้</h3>
          <div className="space-y-2">
            {[
              ['ลูกค้าใหม่', metrics.leads, 'bg-slate-500'], ['กำลังสำรวจ', metrics.survey, 'bg-sky-500'],
              ['คุยแล้ว', metrics.quoted, 'bg-amber-500'], ['ปิดได้', metrics.won_cohort, 'bg-emerald-500'],
              ['ปิดไม่ได้', metrics.lost_cohort, 'bg-red-400'],
            ].map(([label, value, color]) => (
              <div key={label}>
                <div className="flex justify-between text-xs font-bold text-slate-600 mb-1"><span>{label}</span><span>{value || 0}</span></div>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${metrics.leads ? Math.max(3, (value || 0) * 100 / metrics.leads) : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-black text-slate-800 mb-3">สถานะหลังส่งมอบงานติดตั้ง</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['รอแอดมินมอบหมาย', data?.installation?.waiting_assignment, 'text-amber-700 bg-amber-50 border-amber-200'],
              ['มอบหมายแล้ว', data?.installation?.assigned, 'text-sky-700 bg-sky-50 border-sky-200'],
              ['กำลังติดตั้ง', data?.installation?.in_progress, 'text-violet-700 bg-violet-50 border-violet-200'],
              ['ติดตั้งสำเร็จ', data?.installation?.completed, 'text-emerald-700 bg-emerald-50 border-emerald-200'],
              ['มีปัญหา', data?.installation?.problem, 'text-red-700 bg-red-50 border-red-200'],
            ].map(([label, value, tone]) => (
              <div key={label} className={`rounded-xl border p-3 ${tone}`}><p className="text-[10px] font-bold">{label}</p><p className="text-xl font-black mt-1">{value || 0}</p></div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200"><h3 className="text-sm font-black text-slate-800">ผลงานรายพนักงานขาย</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs"><tr><th className="text-left p-3">พนักงานขาย</th><th className="p-3">ลูกค้าใหม่</th><th className="p-3">ปิดได้</th><th className="p-3">ส่งติดตั้ง</th><th className="text-left p-3">ความคืบหน้าเป้าปิด</th>{isAdmin && <th className="p-3">จัดการ</th>}</tr></thead>
            <tbody>
              {(data?.leaderboard || []).map((row) => (
                <tr key={row.owner_user_id} className="border-t border-slate-100">
                  <td className="p-3 font-black text-slate-800">{row.owner_name}</td><td className="p-3 text-center font-bold">{row.leads}</td><td className="p-3 text-center font-bold text-emerald-700">{row.won}</td><td className="p-3 text-center font-bold text-sky-700">{row.handoffs}</td>
                  <td className="p-3"><div className="flex items-center gap-2"><div className="h-2 flex-1 rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-lime-500" style={{ width: `${progressPercent(row.won, row.target_won)}%` }} /></div><span className="text-[11px] font-bold text-slate-500">{row.target_won ? `${row.won}/${row.target_won}` : 'ยังไม่ตั้งเป้า'}</span></div></td>
                  {isAdmin && <td className="p-3 text-center"><button type="button" onClick={() => setTarget(row)} className="px-3 py-2 rounded-lg bg-slate-100 text-xs font-bold">ตั้งเป้า</button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-black text-slate-800 mb-3">แนวโน้มรายวัน</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {(data?.trend || []).length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">ยังไม่มีข้อมูลเดือนนี้</p> : data.trend.map((row) => (
              <div key={String(row.day)} className="grid grid-cols-[72px_1fr_auto] gap-2 items-center text-[11px]">
                <span className="font-bold text-slate-500">{String(row.day).slice(8, 10)}/{String(row.day).slice(5, 7)}</span>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex"><span className="bg-slate-400" style={{ width: `${row.leads * 100 / maxTrend}%` }} /><span className="bg-emerald-500" style={{ width: `${row.won * 100 / maxTrend}%` }} /></div>
                <span className="font-bold text-slate-600">ใหม่ {row.leads} · ปิด {row.won}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-black text-slate-800 mb-3">แพ็กเกจที่ปิดการขายได้</h3>
          <div className="space-y-2">
            {(data?.packages || []).length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">ยังไม่มีข้อมูลเดือนนี้</p> : data.packages.map((row, index) => (
              <div key={row.package_name} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5"><p className="text-xs font-bold text-slate-700 truncate"><span className="text-slate-400 mr-2">#{index + 1}</span>{row.package_name}</p><span className="text-sm font-black text-emerald-700">{row.won}</span></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AisExpansionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userRoles = user?.roles || [user?.role];
  const isAdmin = userRoles.some((r) => ['admin', 'super_admin'].includes(r));

  const [pageTab, setPageTab] = useState('jobs'); // jobs | splitters
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState('open');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [historyJob, setHistoryJob] = useState(null);
  const [summary, setSummary] = useState({ open: 0, follow_today: 0, follow_overdue: 0, won_month: 0, waiting_handoff: 0, install_waiting_assignment: 0 });
  const [followFilter, setFollowFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [packageFilter, setPackageFilter] = useState('');
  const [salesUsers, setSalesUsers] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, per_page: 12, total: 0, total_pages: 1 });

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (viewTab === 'open') params.scope = 'open';
      if (viewTab === 'done') params.scope = 'done';
      if (search.trim()) params.q = search.trim();
      if (followFilter) params.follow_up = followFilter;
      if (statusFilter) params.status = statusFilter;
      if (isAdmin && ownerFilter) params.owner_id = ownerFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (packageFilter.trim()) params.package_name = packageFilter.trim();
      params.page = page;
      params.per_page = 12;
      const { data } = await api.get('/expansion', { params });
      setJobs(Array.isArray(data) ? data : (Array.isArray(data?.rows) ? data.rows : []));
      if (data?.pagination) setPagination(data.pagination);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'โหลดงานขายไม่สำเร็จ', text: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  }, [viewTab, search, followFilter, statusFilter, ownerFilter, dateFrom, dateTo, packageFilter, page, isAdmin]);

  const fetchSummary = useCallback(async () => {
    try {
      const { data } = await api.get('/expansion/summary');
      setSummary((prev) => ({ ...prev, ...(data || {}) }));
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (pageTab === 'jobs') {
      fetchJobs();
      fetchSummary();
    }
  }, [fetchJobs, fetchSummary, pageTab]);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/expansion/sales-users')
      .then(({ data }) => setSalesUsers(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, [isAdmin]);

  const callPhone = (phone) => {
    if (!phone) return;
    const first = String(phone).split(/[,/|]/)[0].replace(/[^\d+]/g, '');
    if (first) window.location.href = `tel:${first}`;
  };

  const openMaps = (job) => {
    const lat = parseFloat(job.lat);
    const lng = parseFloat(job.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
      return;
    }
    if (job.address) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`, '_blank');
    }
  };

  const changeStatus = async (job, nextStatus) => {
    let lost_reason = job.lost_reason;
    if (nextStatus === 'lost') {
      const { value } = await Swal.fire({
        title: 'เหตุผลที่ไม่ได้',
        input: 'text',
        inputPlaceholder: 'เช่น ลูกค้าไม่สนใจ / พื้นที่ไม่พร้อม',
        showCancelButton: true,
        confirmButtonText: 'บันทึก',
        cancelButtonText: 'ยกเลิก',
        confirmButtonColor: '#1F2937',
        inputValidator: (v) => (!v?.trim() ? 'กรุณาระบุเหตุผล' : undefined),
      });
      if (!value) return;
      lost_reason = value.trim();
    }

    try {
      await api.put(`/expansion/${job.id}`, { status: nextStatus, lost_reason });
      await Promise.all([fetchJobs(), fetchSummary()]);
      Swal.fire({ icon: 'success', title: 'อัปเดตสถานะแล้ว', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'เปลี่ยนสถานะไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const handleHandoff = async (job) => {
    const { value: accessNo } = await Swal.fire({
      title: 'ส่งต่องานติดตั้ง',
      html: '<p class="text-sm text-left text-slate-600 mb-2">กรอก Access Number เพื่อสร้างงานในระบบแจกจ่ายงาน</p>',
      input: 'text',
      inputValue: job.access_no || '',
      inputPlaceholder: '880xxxxxxx',
      showCancelButton: true,
      confirmButtonText: 'ส่งต่อติดตั้ง',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#185FA5',
      inputValidator: (v) => (!v?.trim() ? 'ต้องมี Access Number' : undefined),
    });
    if (!accessNo) return;

    try {
      const { data } = await api.post(`/expansion/${job.id}/handoff`, { access_no: accessNo.trim() });
      await Promise.all([fetchJobs(), fetchSummary()]);
      if (!isAdmin) {
        await Swal.fire({
          icon: 'success',
          title: data.already ? 'ส่งต่อไปแล้ว' : 'ส่งเข้าคิวติดตั้งแล้ว',
          text: `งานติดตั้ง #${data.job_id} กำลังรอแอดมินมอบหมายทีม/ช่าง`,
          confirmButtonText: 'รับทราบ',
          confirmButtonColor: '#185FA5',
        });
        return;
      }
      const go = await Swal.fire({
        icon: 'success',
        title: data.already ? 'ส่งต่อไปแล้ว' : 'ส่งเข้าคิวติดตั้งแล้ว',
        text: `งานติดตั้ง #${data.job_id} รอแอดมินมอบหมายทีม/ช่าง · Access ${data.access_no || accessNo}`,
        showCancelButton: true,
        confirmButtonText: 'ไปหน้าแจกจ่ายงาน',
        cancelButtonText: 'อยู่หน้านี้',
        confirmButtonColor: '#185FA5',
      });
      if (go.isConfirmed) navigate('/dispatch-dashboard?tab=office');
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ส่งต่อไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const handleDelete = async (job) => {
    const conf = await Swal.fire({
      icon: 'warning',
      title: 'ลบงานขาย?',
      text: `#${job.id} ${job.customer_name || ''}`,
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#dc2626',
    });
    if (!conf.isConfirmed) return;
    try {
      await api.delete(`/expansion/${job.id}`);
      await Promise.all([fetchJobs(), fetchSummary()]);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const handleAssign = async (job) => {
    const inputOptions = Object.fromEntries(salesUsers.map((sales) => [String(sales.id), sales.full_name || sales.username]));
    const { value } = await Swal.fire({
      title: 'มอบหมายพนักงานขาย',
      input: 'select',
      inputOptions,
      inputValue: String(job.owner_user_id || ''),
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (v) => (!v ? 'กรุณาเลือกพนักงานขาย' : undefined),
    });
    if (!value || Number(value) === Number(job.owner_user_id)) return;
    try {
      await api.put(`/expansion/${job.id}/assign`, { owner_user_id: Number(value) });
      await Promise.all([fetchJobs(), fetchSummary()]);
      Swal.fire({ icon: 'success', title: 'มอบหมายงานแล้ว', timer: 1200, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'มอบหมายไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = { page: 1, per_page: 100 };
      if (viewTab === 'open') params.scope = 'open';
      if (viewTab === 'done') params.scope = 'done';
      if (search.trim()) params.q = search.trim();
      if (followFilter) params.follow_up = followFilter;
      if (statusFilter) params.status = statusFilter;
      if (isAdmin && ownerFilter) params.owner_id = ownerFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (packageFilter.trim()) params.package_name = packageFilter.trim();

      Swal.fire({ title: 'กำลังจัดทำ Excel', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const first = await api.get('/expansion', { params });
      let allJobs = Array.isArray(first.data?.rows) ? first.data.rows : [];
      const totalPages = Number(first.data?.pagination?.total_pages) || 1;
      for (let exportPage = 2; exportPage <= totalPages; exportPage += 1) {
        const response = await api.get('/expansion', { params: { ...params, page: exportPage } });
        allJobs = allJobs.concat(Array.isArray(response.data?.rows) ? response.data.rows : []);
      }
      Swal.close();
      if (!allJobs.length) {
        Swal.fire({ icon: 'info', title: 'ไม่มีข้อมูล', text: 'ไม่มีรายการงานขายสำหรับ Export' });
        return;
      }
      const rows = buildExpansionExportRows(allJobs, { isAdmin });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = computeSheetColumnWidths(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'sales_jobs');
      const day = new Date().toLocaleDateString('en-CA');
      const scopeLabel = viewTab === 'done' ? 'done' : 'open';
      XLSX.writeFile(wb, `sales_jobs_${scopeLabel}_${day}.xlsx`);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Export ไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const displayedJobs = jobs;

  return (
    <Layout activeKey="ais_expansion" pageTitle="ระบบงานขาย / งานขยาย" manualPage="ais_expansion">
      <div className="max-w-5xl mx-auto w-full space-y-4 pb-8">
        <div className="flex gap-1.5 p-1 bg-[#F3F4F6] rounded-xl">
            {[
              { key: 'jobs', label: 'งานขาย' },
              { key: 'analytics', label: 'ผลงานและเป้าหมาย' },
              ...(isAdmin ? [{ key: 'splitters', label: 'คลัง Splitter' }] : []),
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPageTab(tab.key)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-colors ${
                  pageTab === tab.key ? 'bg-white text-[#1F2937] shadow-sm' : 'text-[#6B7280]'
                }`}
              >
                {tab.label}
              </button>
            ))}
        </div>

        {pageTab === 'analytics' ? (
          <SalesAnalyticsPanel isAdmin={isAdmin} salesUsers={salesUsers} />
        ) : pageTab === 'splitters' && isAdmin ? (
          <SplitterAdminPanel />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
              {[
                { key: 'open', label: 'งานที่ต้องทำ', value: summary.open, tone: 'border-slate-200 bg-white text-slate-800', onClick: () => { setPage(1); setViewTab('open'); setFollowFilter(''); setStatusFilter(''); } },
                { key: 'today', label: 'ติดตามวันนี้', value: summary.follow_today, tone: 'border-sky-200 bg-sky-50 text-sky-800', onClick: () => { setPage(1); setViewTab('open'); setFollowFilter('today'); } },
                { key: 'overdue', label: 'เลยกำหนด', value: summary.follow_overdue, tone: 'border-red-200 bg-red-50 text-red-700', onClick: () => { setPage(1); setViewTab('open'); setFollowFilter('overdue'); } },
                { key: 'waiting', label: 'รอส่งติดตั้ง', value: summary.waiting_handoff, tone: 'border-amber-200 bg-amber-50 text-amber-800', onClick: () => { setPage(1); setViewTab('open'); setStatusFilter('won'); setFollowFilter(''); } },
                { key: 'installQueue', label: 'รอแอดมินมอบหมาย', value: summary.install_waiting_assignment, tone: 'border-violet-200 bg-violet-50 text-violet-800', onClick: () => setPageTab('analytics') },
                { key: 'won', label: 'ปิดได้เดือนนี้', value: summary.won_month, tone: 'border-emerald-200 bg-emerald-50 text-emerald-800', onClick: null },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick || undefined}
                  className={`rounded-2xl border p-3 text-left min-h-[82px] ${item.tone} ${item.onClick ? 'hover:-translate-y-0.5 transition-transform' : 'cursor-default'}`}
                >
                  <p className="text-[11px] font-bold opacity-75">{item.label}</p>
                  <p className="text-2xl font-black mt-1">{item.value || 0}</p>
                </button>
              ))}
            </div>
            <div
              className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-black text-[#1F2937]">งานขายของ{isAdmin ? 'ทีม' : 'ฉัน'}</h2>
                  <p className="text-xs text-[#6B7280] mt-0.5">ลงขาย · วัดระยะประมาณจาก Splitter · อัปโหลดรูป</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border border-[#D1D5DB] text-[#1F2937] bg-white hover:bg-[#F9FAFB]"
                  >
                    Export Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-[#1F2937]"
                    style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
                  >
                    + สร้างงานขาย
                  </button>
                </div>
              </div>

              <div className="flex gap-1.5 p-1 bg-[#F3F4F6] rounded-xl mb-3">
                {[
                  { key: 'open', label: 'ต้องทำ' },
                  { key: 'done', label: 'จบแล้ว' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => { setPage(1); setViewTab(tab.key); }}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-colors ${
                      viewTab === tab.key ? 'bg-white text-[#1F2937] shadow-sm' : 'text-[#6B7280]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setSearch(searchInput.trim());
                }}
              >
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="ค้นหาชื่อ / เบอร์ / ที่อยู่ / บัตร"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                />
                <button type="submit" className="px-3 py-2.5 rounded-xl text-xs font-bold bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151]">
                  ค้นหา
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <select value={statusFilter} onChange={(e) => {
                  const value = e.target.value;
                  setPage(1);
                  setStatusFilter(value);
                  if (['lost', 'handed_off'].includes(value)) setViewTab('done');
                  else if (value) setViewTab('open');
                }} className="px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-bold text-slate-700">
                  <option value="">ทุกสถานะ</option>
                  {Object.entries(STATUS_META).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
                </select>
                <select value={followFilter} onChange={(e) => { setPage(1); setFollowFilter(e.target.value); }} className="px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-bold text-slate-700">
                  <option value="">ทุกวันติดตาม</option>
                  <option value="today">ติดตามวันนี้</option>
                  <option value="overdue">เลยกำหนดติดตาม</option>
                  <option value="scheduled">มีนัดติดตาม</option>
                </select>
                {isAdmin ? (
                  <select value={ownerFilter} onChange={(e) => { setPage(1); setOwnerFilter(e.target.value); }} className="px-3 py-2.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-bold text-slate-700">
                    <option value="">พนักงานขายทั้งหมด</option>
                    {salesUsers.map((sales) => <option key={sales.id} value={sales.id}>{sales.full_name || sales.username}</option>)}
                  </select>
                ) : (
                  <button type="button" onClick={() => { setPage(1); setStatusFilter(''); setFollowFilter(''); setDateFrom(''); setDateTo(''); setPackageFilter(''); setSearchInput(''); setSearch(''); }} className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">ล้างตัวกรอง</button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                <label className="text-[10px] font-bold text-slate-500">สร้างตั้งแต่
                  <input type="date" value={dateFrom} onChange={(e) => { setPage(1); setDateFrom(e.target.value); }} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700" />
                </label>
                <label className="text-[10px] font-bold text-slate-500">ถึงวันที่
                  <input type="date" value={dateTo} onChange={(e) => { setPage(1); setDateTo(e.target.value); }} className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700" />
                </label>
                <label className="text-[10px] font-bold text-slate-500">แพ็กเกจ
                  <input value={packageFilter} onChange={(e) => { setPage(1); setPackageFilter(e.target.value); }} placeholder="ชื่อแพ็กเกจแบบตรงกัน" className="mt-1 w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700" />
                </label>
              </div>
              {(search || statusFilter || followFilter || ownerFilter || dateFrom || dateTo || packageFilter) && (
                <button
                  type="button"
                  onClick={() => { setPage(1); setStatusFilter(''); setFollowFilter(''); setOwnerFilter(''); setDateFrom(''); setDateTo(''); setPackageFilter(''); setSearchInput(''); setSearch(''); }}
                  className="mt-2 text-[11px] font-bold text-slate-500 underline underline-offset-2"
                >
                  ล้างการค้นหาและตัวกรองทั้งหมด
                </button>
              )}

            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-[#E5E7EB]/60 rounded-2xl" />
                ))}
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#9CA3AF] font-bold mb-3">ยังไม่มีงานขาย</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#1F2937]"
                  style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
                >
                  สร้างงานแรก
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {displayedJobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-black text-[#9CA3AF]">#{job.id}</span>
                          <StatusBadge status={job.status} />
                        </div>
                        <p className="font-black text-[#1F2937] text-base truncate">{job.customer_name || 'ไม่ระบุชื่อลูกค้า'}</p>
                        <p className="text-sm text-[#6B7280] truncate">{job.phone || 'ไม่มีเบอร์'}</p>
                        {job.package_name && <p className="text-xs text-[#374151] mt-0.5 font-semibold">{job.package_name}</p>}
                        {(job.non_number || job.access_no) && (
                          <p className="text-xs text-slate-600 mt-1 font-semibold">
                            {job.non_number ? `NON ${job.non_number}` : ''}
                            {job.non_number && job.access_no ? ' · ' : ''}
                            {job.access_no ? `Access ${job.access_no}` : ''}
                          </p>
                        )}
                        {job.address && <p className="text-xs text-[#9CA3AF] mt-1 line-clamp-2">{job.address}</p>}
                        {job.follow_up_at && !['lost', 'handed_off'].includes(job.status) && (
                          <div className={`mt-2 rounded-xl border px-3 py-2 ${
                            followUpState(job.follow_up_at) === 'overdue'
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : followUpState(job.follow_up_at) === 'today'
                                ? 'bg-sky-50 border-sky-200 text-sky-700'
                                : 'bg-slate-50 border-slate-200 text-slate-600'
                          }`}>
                            <p className="text-[11px] font-black">
                              {followUpState(job.follow_up_at) === 'overdue' ? 'เลยกำหนดติดตาม · ' : followUpState(job.follow_up_at) === 'today' ? 'ติดตามวันนี้ · ' : 'นัดติดตาม · '}
                              {prettyThaiDate(job.follow_up_at)}{job.follow_up_time ? ` ${String(job.follow_up_time).slice(0, 5)} น.` : ''}
                            </p>
                            {job.follow_up_note && <p className="text-[11px] mt-0.5 line-clamp-1">{job.follow_up_note}</p>}
                          </div>
                        )}
                        {(job.estimated_cable_m != null || job.splitter_code || job.splitter_name) && (
                          <p className="text-xs font-semibold text-amber-700 mt-1">
                            {job.splitter_code || job.splitter_name || 'Splitter'}
                            {job.estimated_cable_m != null ? ` · ประมาณ ${job.estimated_cable_m} ม.` : ''}
                            {job.photo_count != null ? ` · รูป ${job.photo_count}` : ''}
                          </p>
                        )}
                        {isAdmin && job.owner_name && <p className="text-[11px] text-[#9CA3AF] mt-1">เซล: {job.owner_name}</p>}
                        {job.handed_off_job_id && (
                          <div className={`mt-2 rounded-xl border px-3 py-2 ${installationStatusMeta(job)?.className}`}>
                            <p className="text-[11px] font-black">{installationStatusMeta(job)?.label}</p>
                            <p className="text-[10px] mt-0.5 opacity-75">
                              งานติดตั้ง #{job.handed_off_job_id}{job.access_no ? ` · Access ${job.access_no}` : ''}
                              {job.install_plan_date ? ` · นัด ${prettyThaiDate(job.install_plan_date)}` : ''}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {job.lat != null && job.lng != null && (
                          <p className="text-[10px] font-mono text-[#9CA3AF]">
                            {Number(job.lat).toFixed(4)}, {Number(job.lng).toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#F3F4F6]">
                      <button
                        type="button"
                        disabled={!job.phone}
                        onClick={() => callPhone(job.phone)}
                        className="min-h-[48px] rounded-xl text-xs font-bold bg-white border border-[#E5E7EB] text-[#1F2937] disabled:opacity-35"
                      >
                        โทร
                      </button>
                      <button
                        type="button"
                        disabled={!(job.lat || job.address)}
                        onClick={() => openMaps(job)}
                        className="min-h-[48px] rounded-xl text-xs font-bold bg-white border border-[#E5E7EB] text-[#1F2937] disabled:opacity-35"
                      >
                        นำทาง
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(job);
                          setFormOpen(true);
                        }}
                        className="min-h-[48px] rounded-xl text-xs font-bold bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]"
                      >
                        {job.status === 'handed_off' ? 'ดูรายละเอียด' : 'แก้ไข'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryJob(job)}
                        className="min-h-[48px] rounded-xl text-xs font-bold bg-white border border-[#E5E7EB] text-slate-600"
                      >
                        ประวัติ
                      </button>

                      {isAdmin && salesUsers.length > 0 && job.status !== 'handed_off' && (
                        <button
                          type="button"
                          onClick={() => handleAssign(job)}
                          className="min-h-[48px] rounded-xl text-xs font-bold bg-sky-50 text-sky-700 border border-sky-200"
                        >
                          มอบหมาย
                        </button>
                      )}

                      {(NEXT_ACTIONS[job.status] || []).map((a) => (
                        <button
                          key={a.status}
                          type="button"
                          onClick={() => changeStatus(job, a.status)}
                          className={`min-h-[48px] rounded-xl text-xs font-black border ${
                            a.status === 'won'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : a.status === 'lost'
                                ? 'bg-red-50 text-red-600 border-red-200'
                                : a.status === 'quoted'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-[#A3E635]/20 text-[#1F2937] border-[#A3E635]/40'
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}

                      {job.status === 'won' && (
                        <button
                          type="button"
                          onClick={() => handleHandoff(job)}
                          className="min-h-[48px] rounded-xl text-xs font-black bg-blue-50 text-blue-700 border border-blue-200 col-span-2 sm:col-span-2"
                        >
                          ส่งต่อติดตั้ง
                        </button>
                      )}

                      {job.status === 'handed_off' && job.handed_off_job_id && isAdmin && (
                        <button
                          type="button"
                          onClick={() => navigate(`/dispatch-dashboard?tab=office&openJob=${job.handed_off_job_id}`)}
                          className="min-h-[48px] rounded-xl text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 col-span-2"
                        >
                          เปิดงานติดตั้ง
                        </button>
                      )}

                      {isAdmin && job.status !== 'handed_off' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(job)}
                          className="min-h-[48px] rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-100"
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && pagination.total > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-500">ทั้งหมด {pagination.total} รายการ · หน้า {pagination.page}/{pagination.total_pages}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-w-[88px] px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold disabled:opacity-35">ก่อนหน้า</button>
                  <button type="button" disabled={page >= pagination.total_pages} onClick={() => setPage((value) => Math.min(pagination.total_pages, value + 1))} className="min-w-[88px] px-3 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold disabled:opacity-35">ถัดไป</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ExpansionFormModal
        open={formOpen}
        job={editing}
        isAdmin={isAdmin}
        salesName={user?.full_name}
        salesUsers={salesUsers}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          fetchJobs();
          fetchSummary();
        }}
      />
      <SalesHistoryModal key={historyJob?.id || 'closed'} job={historyJob} onClose={() => setHistoryJob(null)} />
    </Layout>
  );
}
