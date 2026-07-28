import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ExpansionMapPicker, { haversineMeters } from '../components/ExpansionMapPicker';
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
  'w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A3E635]/40 disabled:opacity-60';
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
  sales_note: '',
  tech_note: '',
  access_no: '',
  lat: null,
  lng: null,
  splitter_id: null,
  straight_distance_m: '',
  estimated_cable_m: '',
  splitter_note: '',
  radius_m: 500,
  status: 'draft',
  follow_up_at: '',
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
    ชื่อลูกค้า/บริษัท: job.customer_name || '',
    เลขบัตร/ผู้เสียภาษี: job.id_card || '',
    เบอร์โทร: job.phone || '',
    ที่อยู่: job.address || '',
    แพ็กเกจ: job.package_name || '',
    ข้อมูลสัญญา: job.contract_info || '',
    อาชีพ/ผู้ติดต่อ: job.occupation || '',
    ขออนุมัติ: job.approval_request || '',
    ขอวันติดตั้ง: excelDate(job.install_date) || job.install_date_text || '',
    หมายเหตุเซล: job.sales_note || '',
    หมายเหตุถึงช่าง: job.tech_note || '',
    AccessNo: job.access_no || '',
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

function clampScore(v) {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function parseNum(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readinessScore(job) {
  let score = 0;
  if (job.customer_name) score += 12;
  if (job.phone) score += 12;
  if (job.address) score += 10;
  if (job.id_card) score += 8;
  if (job.package_name) score += 8;
  if (job.lat != null && job.lng != null) score += 12;
  if (job.estimated_cable_m != null && job.estimated_cable_m !== '') score += 20;
  if (job.photo_count >= MIN_PHOTOS) score += 18;
  return score; // 0..100
}

function feasibilityScore(job, myLocation, todayISO) {
  const statusBonus = job.status === 'survey' ? 8 : job.status === 'quoted' ? 6 : job.status === 'draft' ? 3 : 0;
  const followBonus = String(job.follow_up_at || '').slice(0, 10) === todayISO ? 8 : 0;
  const cable = parseNum(job.estimated_cable_m);
  const cableScore = cable == null ? 8 : cable <= 150 ? 20 : cable <= 300 ? 14 : cable <= 500 ? 8 : 4;

  let distanceM = null;
  let distanceScore = 10;
  if (myLocation && job.lat != null && job.lng != null) {
    distanceM = haversineMeters(myLocation.lat, myLocation.lng, Number(job.lat), Number(job.lng));
    distanceScore = distanceM <= 1000 ? 22 : distanceM <= 2000 ? 18 : distanceM <= 3000 ? 14 : distanceM <= 5000 ? 10 : 4;
  }

  const splitterDist = parseNum(job.straight_distance_m);
  const splitterScore = splitterDist == null ? 8 : splitterDist <= 300 ? 20 : splitterDist <= 800 ? 14 : splitterDist <= 1500 ? 9 : 5;

  const ready = readinessScore(job); // 0..100
  const total = (distanceScore * 0.30) + (splitterScore * 0.25) + (cableScore * 0.20) + (ready * 0.20) + statusBonus + followBonus;
  return { score: clampScore(total), distanceM };
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

function ExpansionFormModal({ open, job, onClose, onSaved, isAdmin, salesName }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [pendingPreviews, setPendingPreviews] = useState([]);
  const fileRef = useRef(null);
  const isEdit = Boolean(job?.id);
  const locked = job?.status === 'handed_off';

  const totalPhotos = photos.length + pendingFiles.length;

  useEffect(() => {
    if (!open) return;
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
            sales_note: data.sales_note || '',
            tech_note: data.tech_note || '',
            access_no: data.access_no || '',
            lat: data.lat != null ? Number(data.lat) : null,
            lng: data.lng != null ? Number(data.lng) : null,
            splitter_id: data.splitter_id != null ? Number(data.splitter_id) : null,
            straight_distance_m: data.straight_distance_m != null ? String(data.straight_distance_m) : '',
            estimated_cable_m: data.estimated_cable_m != null ? String(data.estimated_cable_m) : '',
            splitter_note: data.splitter_note || '',
            radius_m: data.radius_m ?? 500,
            status: data.status || 'draft',
            follow_up_at: data.follow_up_at ? String(data.follow_up_at).slice(0, 10) : '',
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
        setForm(emptyForm());
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
    if (!form.address.trim()) return 'กรุณากรอกที่อยู่ติดตั้ง';
    if (!form.phone.trim()) return 'กรุณากรอกเบอร์ติดต่อ';
    if (!form.package_name.trim()) return 'กรุณากรอกแพ็กเกจ';
    if (!form.contract_info.trim()) return 'กรุณากรอกสัญญา';
    if (!form.occupation.trim()) return form.customer_type === 'corporate' ? 'กรุณากรอกผู้ติดต่อ' : 'กรุณากรอกอาชีพ';
    if (!form.install_date && !form.install_date_text.trim()) return 'กรุณาระบุขอวันติดตั้ง';
    if (form.lat == null || form.lng == null) return 'กรุณาปักพิกัดบ้านลูกค้า';
    if (form.estimated_cable_m === '' || form.estimated_cable_m == null) return 'กรุณากรอกระยะสายประมาณ';
    if (totalPhotos < MIN_PHOTOS) return `ต้องมีรูปอย่างน้อย ${MIN_PHOTOS} รูป`;
    if (totalPhotos > MAX_PHOTOS) return `รูปได้ไม่เกิน ${MAX_PHOTOS} รูป`;
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
    try {
      const payload = {
        ...form,
        approval_request: form.approval_request || null,
        install_date: form.install_date || null,
        follow_up_at: null,
        splitter_id: form.splitter_id || null,
        straight_distance_m: form.straight_distance_m === '' ? null : form.straight_distance_m,
        estimated_cable_m: form.estimated_cable_m === '' ? null : form.estimated_cable_m,
        skip_photo_check: '1',
      };

      let id = job?.id;
      if (isEdit) {
        await uploadPending(id);
        await api.put(`/expansion/${id}`, payload);
      } else {
        const { data: created } = await api.post('/expansion', payload);
        id = created.id;
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="ประเภทลูกค้า" required>
              <select
                disabled={locked}
                value={form.customer_type || 'general'}
                onChange={(e) => setField('customer_type', e.target.value)}
                className={inputCls}
              >
                <option value="general">ลูกค้าทั่วไป</option>
                <option value="corporate">นิติบุคคล</option>
              </select>
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
              <select
                disabled={locked}
                value={form.approval_request || ''}
                onChange={(e) => setField('approval_request', e.target.value)}
                className={inputCls}
              >
                <option value="">ไม่ระบุ</option>
                <option value="ฟรีค่าแรกเข้า">ฟรีค่าแรกเข้า</option>
                <option value="บ้านเลขที่0">บ้านเลขที่0</option>
                <option value="ใบอนญาติทำงาน">ใบอนญาติทำงาน</option>
              </select>
            </Field>
            <Field label="ขอวันติดตั้ง (วันที่)">
              <input disabled={locked} type="date" value={form.install_date} onChange={(e) => setField('install_date', e.target.value)} className={inputCls} />
            </Field>
            <Field label="ขอวันติดตั้ง (ข้อความ)" required={!form.install_date}>
              <input disabled={locked} value={form.install_date_text} onChange={(e) => setField('install_date_text', e.target.value)} className={inputCls} placeholder="เช่น เสาร์หน้าช่วงเช้า" />
            </Field>
            <Field label="พนักงานขาย">
              <input disabled value={job?.owner_name || salesName || '-'} className={`${inputCls} bg-[#F3F4F6]`} />
            </Field>
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

          {isAdmin && job?.owner_name && (
            <p className="text-xs text-[#9CA3AF]">เจ้าของงาน: {job.owner_name}</p>
          )}
        </div>

        <div className="px-4 py-3 border-t border-[#E5E7EB] flex gap-2 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl bg-[#F3F4F6] font-bold text-[#374151] text-sm">
            ปิด
          </button>
          {!locked && (
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

  return (
    <div className="space-y-4">
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
  const [myLocation, setMyLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [nearRadiusM, setNearRadiusM] = useState(NEARBY_RADIUS_M);
  const [onlyNearby, setOnlyNearby] = useState(false);
  const [sortByScore, setSortByScore] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (viewTab === 'open') params.scope = 'open';
      if (viewTab === 'done') params.scope = 'done';
      if (search.trim()) params.q = search.trim();
      const { data } = await api.get('/expansion', { params });
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'โหลดงานขายไม่สำเร็จ', text: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  }, [viewTab, search]);

  useEffect(() => {
    if (pageTab === 'jobs') fetchJobs();
  }, [fetchJobs, pageTab]);

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
      fetchJobs();
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
      await fetchJobs();
      const go = await Swal.fire({
        icon: 'success',
        title: data.already ? 'ส่งต่อไปแล้ว' : 'ส่งต่อติดตั้งสำเร็จ',
        text: `งานติดตั้ง #${data.job_id} · Access ${data.access_no || accessNo}`,
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
      fetchJobs();
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: err.response?.data?.error || err.message });
    }
  };

  const handleExportExcel = () => {
    if (!displayedJobs.length) {
      Swal.fire({ icon: 'info', title: 'ไม่มีข้อมูล', text: 'ไม่มีรายการงานขายสำหรับ Export' });
      return;
    }
    const rows = buildExpansionExportRows(displayedJobs, { isAdmin });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = computeSheetColumnWidths(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'sales_jobs');
    const day = new Date().toLocaleDateString('en-CA');
    const scopeLabel = viewTab === 'done' ? 'done' : 'open';
    XLSX.writeFile(wb, `sales_jobs_${scopeLabel}_${day}.xlsx`);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      Swal.fire({ icon: 'warning', title: 'ไม่รองรับ GPS', text: 'อุปกรณ์หรือเบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setMyLocation({
          lat: Number(pos.coords.latitude),
          lng: Number(pos.coords.longitude),
        });
        setOnlyNearby(true);
        setSortByScore(true);
      },
      () => {
        setLocating(false);
        Swal.fire({ icon: 'warning', title: 'ระบุตำแหน่งไม่สำเร็จ', text: 'กรุณาอนุญาตสิทธิ์ตำแหน่ง แล้วลองใหม่อีกครั้ง' });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const todayISO = new Date().toLocaleDateString('en-CA');
  const scoredJobs = useMemo(() => {
    return jobs.map((job) => {
      const { score, distanceM } = feasibilityScore(job, myLocation, todayISO);
      return { ...job, __score: score, __distanceM: distanceM };
    });
  }, [jobs, myLocation, todayISO]);

  const displayedJobs = useMemo(() => {
    let list = [...scoredJobs];
    if (onlyNearby && myLocation) {
      list = list.filter((job) => job.__distanceM != null && job.__distanceM <= Number(nearRadiusM || NEARBY_RADIUS_M));
    }
    if (sortByScore) {
      list.sort((a, b) => {
        if (b.__score !== a.__score) return b.__score - a.__score;
        const ad = a.__distanceM == null ? Number.MAX_SAFE_INTEGER : a.__distanceM;
        const bd = b.__distanceM == null ? Number.MAX_SAFE_INTEGER : b.__distanceM;
        return ad - bd;
      });
    }
    return list;
  }, [scoredJobs, onlyNearby, myLocation, nearRadiusM, sortByScore]);

  return (
    <Layout activeKey="ais_expansion" pageTitle="ระบบงานขาย / งานขยาย" manualPage="ais_expansion">
      <div className="max-w-5xl mx-auto w-full space-y-4 pb-8">
        {isAdmin && (
          <div className="flex gap-1.5 p-1 bg-[#F3F4F6] rounded-xl">
            {[
              { key: 'jobs', label: 'งานขาย' },
              { key: 'splitters', label: 'คลัง Splitter' },
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
        )}

        {pageTab === 'splitters' && isAdmin ? (
          <SplitterAdminPanel />
        ) : (
          <>
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
                    onClick={() => setViewTab(tab.key)}
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

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleLocateMe}
                  disabled={locating}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#1F2937] hover:bg-[#F9FAFB] disabled:opacity-60"
                >
                  {locating ? 'กำลังหาตำแหน่ง...' : '📍 บ้านใกล้ฉัน'}
                </button>
                <label className={`px-3 py-2 rounded-xl text-xs font-bold border ${myLocation ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                  <input
                    type="checkbox"
                    className="mr-1.5"
                    checked={onlyNearby}
                    disabled={!myLocation}
                    onChange={(e) => setOnlyNearby(e.target.checked)}
                  />
                  เฉพาะในรัศมี
                </label>
                <select
                  value={nearRadiusM}
                  disabled={!myLocation}
                  onChange={(e) => setNearRadiusM(Number(e.target.value))}
                  className="px-2 py-2 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white disabled:opacity-60"
                >
                  <option value={1000}>1 กม.</option>
                  <option value={2000}>2 กม.</option>
                  <option value={3000}>3 กม.</option>
                  <option value={5000}>5 กม.</option>
                </select>
                <label className="px-3 py-2 rounded-xl text-xs font-bold border border-[#E5E7EB] bg-white text-[#1F2937]">
                  <input
                    type="checkbox"
                    className="mr-1.5"
                    checked={sortByScore}
                    onChange={(e) => setSortByScore(e.target.checked)}
                  />
                  เรียงตามความคุ้ม
                </label>
                {myLocation && (
                  <button
                    type="button"
                    onClick={() => {
                      setMyLocation(null);
                      setOnlyNearby(false);
                    }}
                    className="px-2.5 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
                  >
                    ล้างตำแหน่ง
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 bg-[#E5E7EB]/60 rounded-2xl" />
                ))}
              </div>
            ) : displayedJobs.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
                <p className="text-[#9CA3AF] font-bold mb-3">
                  {jobs.length > 0 ? 'ไม่พบงานในเงื่อนไขตำแหน่ง/รัศมี' : 'ยังไม่มีงานขาย'}
                </p>
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
                          {sortByScore && (
                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border ${
                              job.__score >= 80
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : job.__score >= 60
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}>
                              คุ้ม {job.__score}
                            </span>
                          )}
                        </div>
                        <p className="font-black text-[#1F2937] text-base truncate">{job.customer_name || 'ไม่ระบุชื่อลูกค้า'}</p>
                        <p className="text-sm text-[#6B7280] truncate">{job.phone || 'ไม่มีเบอร์'}</p>
                        {job.package_name && <p className="text-xs text-[#374151] mt-0.5 font-semibold">{job.package_name}</p>}
                        {job.address && <p className="text-xs text-[#9CA3AF] mt-1 line-clamp-2">{job.address}</p>}
                        {(job.estimated_cable_m != null || job.splitter_code || job.splitter_name) && (
                          <p className="text-xs font-semibold text-amber-700 mt-1">
                            {job.splitter_code || job.splitter_name || 'Splitter'}
                            {job.estimated_cable_m != null ? ` · ประมาณ ${job.estimated_cable_m} ม.` : ''}
                            {job.photo_count != null ? ` · รูป ${job.photo_count}` : ''}
                            {job.__distanceM != null ? ` · ห่าง ${Math.round(job.__distanceM)} ม.` : ''}
                          </p>
                        )}
                        {isAdmin && job.owner_name && <p className="text-[11px] text-[#9CA3AF] mt-1">เซล: {job.owner_name}</p>}
                        {job.handed_off_job_id && (
                          <p className="text-[11px] font-bold text-violet-700 mt-1">
                            งานติดตั้ง #{job.handed_off_job_id}
                            {job.access_no ? ` · ${job.access_no}` : ''}
                          </p>
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

                      {(NEXT_ACTIONS[job.status] || []).slice(0, 1).map((a) => (
                        <button
                          key={a.status}
                          type="button"
                          onClick={() => changeStatus(job, a.status)}
                          className={`min-h-[48px] rounded-xl text-xs font-black border ${
                            a.status === 'won'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-[#A3E635]/20 text-[#1F2937] border-[#A3E635]/40'
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}

                      {(NEXT_ACTIONS[job.status] || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => changeStatus(job, NEXT_ACTIONS[job.status][1].status)}
                          className="min-h-[48px] rounded-xl text-xs font-bold bg-red-50 text-red-600 border border-red-200 col-span-2 sm:col-span-1"
                        >
                          {NEXT_ACTIONS[job.status][1].label}
                        </button>
                      )}

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
          </>
        )}
      </div>

      <ExpansionFormModal
        open={formOpen}
        job={editing}
        isAdmin={isAdmin}
        salesName={user?.full_name}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={fetchJobs}
      />
    </Layout>
  );
}
