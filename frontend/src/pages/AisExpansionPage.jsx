import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import ExpansionMapPicker from '../components/ExpansionMapPicker';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

const STATUS_META = {
  draft: { label: 'ยังไม่ไป', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  survey: { label: 'กำลังทำ', className: 'bg-sky-50 text-sky-700 border-sky-200' },
  quoted: { label: 'คุยแล้ว', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  won: { label: 'ปิดได้', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  lost: { label: 'ไม่ได้', className: 'bg-red-50 text-red-700 border-red-200' },
  handed_off: { label: 'ส่งต่อแล้ว', className: 'bg-violet-50 text-violet-700 border-violet-200' },
};

/** One clear next step for sales — avoid long status chains on the card */
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

const emptyForm = () => ({
  customer_name: '',
  phone: '',
  address: '',
  access_no: '',
  lat: null,
  lng: null,
  splitter_note: '',
  radius_m: 500,
  status: 'draft',
  follow_up_at: '',
  remark: '',
  lost_reason: '',
});

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return (
    <span className={`inline-flex text-[10px] font-black px-2 py-0.5 rounded-full border ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function ExpansionFormModal({ open, job, onClose, onSaved, isAdmin }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(job?.id);
  const locked = job?.status === 'handed_off';

  useEffect(() => {
    if (!open) return;
    if (job) {
      setForm({
        customer_name: job.customer_name || '',
        phone: job.phone || '',
        address: job.address || '',
        access_no: job.access_no || '',
        lat: job.lat != null ? Number(job.lat) : null,
        lng: job.lng != null ? Number(job.lng) : null,
        splitter_note: job.splitter_note || '',
        radius_m: job.radius_m ?? 500,
        status: job.status || 'draft',
        follow_up_at: job.follow_up_at ? String(job.follow_up_at).slice(0, 10) : '',
        remark: job.remark || '',
        lost_reason: job.lost_reason || '',
      });
    } else {
      setForm(emptyForm());
    }
  }, [open, job]);

  if (!open) return null;

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (locked) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        lat: form.lat,
        lng: form.lng,
        follow_up_at: form.follow_up_at || null,
      };
      if (isEdit) {
        await api.put(`/expansion/${job.id}`, payload);
      } else {
        await api.post('/expansion', payload);
      }
      onSaved?.();
      onClose();
      Swal.fire({ icon: 'success', title: isEdit ? 'บันทึกแล้ว' : 'สร้างงานขยายแล้ว', timer: 1400, showConfirmButton: false });
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
      <div className="relative w-full max-w-2xl bg-white rounded-t-3xl sm:rounded-3xl border border-[#E5E7EB] shadow-2xl max-h-[94vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] shrink-0">
          <div>
            <h3 className="font-black text-[#1F2937] text-lg">
              {isEdit ? `แก้ไขงานขยาย #${job.id}` : 'สร้างงานขยายใหม่'}
            </h3>
            {isEdit && <div className="mt-1"><StatusBadge status={job.status} /></div>}
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-xl bg-[#F3F4F6] text-[#6B7280]">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">ชื่อลูกค้า</label>
              <input
                disabled={locked}
                value={form.customer_name}
                onChange={(e) => setField('customer_name', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                placeholder="ชื่อลูกค้า"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">เบอร์โทร</label>
              <input
                disabled={locked}
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                placeholder="08x-xxx-xxxx"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">ที่อยู่</label>
              <textarea
                disabled={locked}
                value={form.address}
                onChange={(e) => setField('address', e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A3E635]/40 resize-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">Access No (ถ้ามี)</label>
              <input
                disabled={locked}
                value={form.access_no}
                onChange={(e) => setField('access_no', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                placeholder="ใส่ตอนส่งต่อติดตั้งก็ได้"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">นัดติดตาม</label>
              <input
                type="date"
                disabled={locked}
                value={form.follow_up_at}
                onChange={(e) => setField('follow_up_at', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A3E635]/40"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">หมายเหตุ Splitter / จุดสนใจ</label>
              <input
                disabled={locked}
                value={form.splitter_note}
                onChange={(e) => setField('splitter_note', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A3E635]/40"
                placeholder="เช่น ใกล้ splitter หมู่บ้าน..."
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-bold text-[#6B7280] uppercase mb-1">หมายเหตุ</label>
              <textarea
                disabled={locked}
                value={form.remark}
                onChange={(e) => setField('remark', e.target.value)}
                rows={2}
                className="w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm font-semibold outline-none focus:ring-2 focus:ring-[#A3E635]/40 resize-none"
              />
            </div>
            {form.status === 'lost' || job?.status === 'lost' ? (
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-bold text-red-600 uppercase mb-1">เหตุผลที่ไม่ได้</label>
                <input
                  disabled={locked}
                  value={form.lost_reason}
                  onChange={(e) => setField('lost_reason', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-200"
                />
              </div>
            ) : null}
          </div>

          <div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase mb-2">พิกัดบนแผนที่</p>
            <ExpansionMapPicker
              lat={form.lat}
              lng={form.lng}
              radiusM={form.radius_m}
              selectable={!locked}
              height="260px"
              onPick={({ lat, lng }) => {
                setField('lat', lat);
                setField('lng', lng);
              }}
              onRadiusChange={(n) => setField('radius_m', n)}
            />
            {form.lat != null && form.lng != null && (
              <p className="text-xs text-[#6B7280] mt-2 font-medium">
                เลือกแล้ว: {Number(form.lat).toFixed(6)}, {Number(form.lng).toFixed(6)}
              </p>
            )}
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

export default function AisExpansionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userRoles = user?.roles || [user?.role];
  const isAdmin = userRoles.some((r) => ['admin', 'super_admin'].includes(r));

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState('open'); // open | today | done
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (viewTab === 'open') params.scope = 'open';
      if (viewTab === 'done') params.scope = 'done';
      if (viewTab === 'today') {
        params.scope = 'open';
        params.follow_up = 'today';
      }
      if (search.trim()) params.q = search.trim();
      const { data } = await api.get('/expansion', { params });
      setJobs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      Swal.fire({ icon: 'error', title: 'โหลดงานขยายไม่สำเร็จ', text: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  }, [viewTab, search]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

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
      title: 'ลบงานขยาย?',
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

  return (
    <Layout activeKey="ais_expansion" pageTitle="ระบบงานขยาย AIS" manualPage="ais_expansion">
      <div className="max-w-5xl mx-auto w-full space-y-4 pb-8">
        {/* Header actions */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-4 sm:p-5"
          style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-black text-[#1F2937]">งานขยายของ{isAdmin ? 'ทีม' : 'ฉัน'}</h2>
              <p className="text-xs text-[#6B7280] mt-0.5">เช็ครายการ · โทร · นำทาง · อัปเดตผล</p>
            </div>
            <button
              type="button"
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-[#1F2937]"
              style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
            >
              + สร้างงาน
            </button>
          </div>

          <div className="flex gap-1.5 p-1 bg-[#F3F4F6] rounded-xl mb-3">
            {[
              { key: 'open', label: 'ต้องทำ' },
              { key: 'today', label: 'นัดวันนี้' },
              { key: 'done', label: 'จบแล้ว' },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setViewTab(tab.key)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-colors ${
                  viewTab === tab.key
                    ? 'bg-white text-[#1F2937] shadow-sm'
                    : 'text-[#6B7280]'
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
              placeholder="ค้นหาชื่อ / เบอร์ / ที่อยู่"
              className="flex-1 px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-sm outline-none focus:ring-2 focus:ring-[#A3E635]/40"
            />
            <button
              type="submit"
              className="px-3 py-2.5 rounded-xl text-xs font-bold bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151]"
            >
              ค้นหา
            </button>
          </form>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => <div key={i} className="h-28 bg-[#E5E7EB]/60 rounded-2xl" />)}
          </div>
        ) : jobs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center">
            <p className="text-[#9CA3AF] font-bold mb-3">ยังไม่มีงานขยาย</p>
            <button
              type="button"
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-[#1F2937]"
              style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}
            >
              สร้างงานแรก
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
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
                      {job.follow_up_at && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded-md">
                          นัด {String(job.follow_up_at).slice(0, 10)}
                        </span>
                      )}
                    </div>
                    <p className="font-black text-[#1F2937] text-base truncate">
                      {job.customer_name || 'ไม่ระบุชื่อลูกค้า'}
                    </p>
                    <p className="text-sm text-[#6B7280] truncate">{job.phone || 'ไม่มีเบอร์'}</p>
                    {job.address && (
                      <p className="text-xs text-[#9CA3AF] mt-1 line-clamp-2">{job.address}</p>
                    )}
                    {job.splitter_note && (
                      <p className="text-xs font-semibold text-orange-700 mt-1">📍 {job.splitter_note}</p>
                    )}
                    {isAdmin && job.owner_name && (
                      <p className="text-[11px] text-[#9CA3AF] mt-1">เซล: {job.owner_name}</p>
                    )}
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
                    📞 โทร
                  </button>
                  <button
                    type="button"
                    disabled={!(job.lat || job.address)}
                    onClick={() => openMaps(job)}
                    className="min-h-[48px] rounded-xl text-xs font-bold bg-white border border-[#E5E7EB] text-[#1F2937] disabled:opacity-35"
                  >
                    🗺️ นำทาง
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditing(job); setFormOpen(true); }}
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
      </div>

      <ExpansionFormModal
        open={formOpen}
        job={editing}
        isAdmin={isAdmin}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSaved={fetchJobs}
      />
    </Layout>
  );
}
