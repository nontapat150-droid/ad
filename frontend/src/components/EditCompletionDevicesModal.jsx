import { useEffect, useState } from 'react';
import api from '../api/axios';

const EMPTY_FIELDS = {
  order_no: '',
  soa_device: '',
  sn_onu: '',
  sn_playbox: '',
  sn_mesh: '',
  sn_sim: '',
  sn_ip_camera: '',
  split_no: '',
  port_no: '',
  l3_name: '',
  cable_length: '',
  ref_id_3bb: '',
  sc_blue: '',
};

function parseInstallDevice(str) {
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

function Field({ label, name, value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-[#042C53] mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm text-[#042C53] bg-white/50 outline-none focus:border-[#378ADD]"
      />
    </div>
  );
}

export default function EditCompletionDevicesModal({ isOpen, onClose, job, onSuccess }) {
  const [fields, setFields] = useState({ ...EMPTY_FIELDS });
  const [loading, setLoading] = useState(false);
  const [loadingJob, setLoadingJob] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !job) return;
    let cancelled = false;
    setError(null);
    setLoadingJob(true);

    const applyJob = (data) => {
      const parsed = parseInstallDevice(data.install_device);
      setFields({
        ...EMPTY_FIELDS,
        order_no: data.order_no || '',
        soa_device: parsed.soa_device || '',
        sn_onu: parsed.sn_onu || '',
        sn_playbox: parsed.sn_playbox || '',
        sn_mesh: parsed.sn_mesh || '',
        sn_sim: parsed.sn_sim || '',
        sn_ip_camera: parsed.sn_ip_camera || '',
        split_no: data.split_no || parsed.split_no || '',
        port_no: data.port_no || parsed.port_no || '',
        l3_name: data.l3_name || parsed.l3_name || '',
        cable_length: data.cable_length || parsed.cable_length || '',
        ref_id_3bb: data.ref_id_3bb || parsed.ref_id_3bb || '',
        sc_blue: data.sc_blue || parsed.sc_blue || '',
      });
    };

    applyJob(job);
    api.get(`/dispatch/jobs/${job.id}/details?type=office`)
      .then((res) => {
        if (!cancelled && res.data) applyJob(res.data);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingJob(false);
      });

    return () => { cancelled = true; };
  }, [isOpen, job?.id]);

  const setField = (name, value) => {
    setFields((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);
      await api.put(`/dispatch/jobs/${job.id}/completion-devices`, fields);
      onSuccess?.();
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details || 'บันทึกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-[110] flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg glass border border-white/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/30 bg-white/40">
          <div>
            <h2 className="text-[#042C53] font-bold text-lg">แก้ไขอุปกรณ์หลังจบงาน</h2>
            <p className="text-xs text-slate-500 mt-0.5">{job.access_no} · {job.customer || '-'}</p>
          </div>
          <button type="button" onClick={onClose} className="w-8 h-8 rounded-full glass border border-white/50 flex items-center justify-center text-[#042C53] hover:bg-white/50">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto flex-1 flex flex-col gap-3">
          {error && <div className="p-3 bg-red-100 text-red-600 rounded-xl text-sm font-medium">{error}</div>}
          {loadingJob && <p className="text-xs text-slate-500">กำลังโหลดข้อมูลอุปกรณ์...</p>}

          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            แก้ข้อความอุปกรณ์ที่บันทึกตอนจบงาน (ไม่สลับของในกระเป๋า) — ถ้าต้องเปลี่ยนชิ้นจากกระเป๋า ให้ใช้ «ยกเลิกจบ» แล้วจบงานใหม่
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Order No" name="order_no" value={fields.order_no} onChange={setField} />
            <Field label="อุปกรณ์ปิด SOA" name="soa_device" value={fields.soa_device} onChange={setField} placeholder="ชื่อ/รุ่น SOA" />
            <Field label="SN ONU" name="sn_onu" value={fields.sn_onu} onChange={setField} />
            <Field label="SN Playbox" name="sn_playbox" value={fields.sn_playbox} onChange={setField} />
            <Field label="SN Mesh" name="sn_mesh" value={fields.sn_mesh} onChange={setField} />
            <Field label="SN Sim" name="sn_sim" value={fields.sn_sim} onChange={setField} />
            <Field label="SN IP Camera" name="sn_ip_camera" value={fields.sn_ip_camera} onChange={setField} />
            <Field label="Splitt" name="split_no" value={fields.split_no} onChange={setField} />
            <Field label="ใช้ Port" name="port_no" value={fields.port_no} onChange={setField} />
            <Field label="#L3 (ชื่อ)" name="l3_name" value={fields.l3_name} onChange={setField} />
            <Field label="ระยะสายจริง (M)" name="cable_length" value={fields.cable_length} onChange={setField} />
            <Field label="Ref ID 3BB" name="ref_id_3bb" value={fields.ref_id_3bb} onChange={setField} />
            <Field label="ตัวต่อ sc สีฟ้า" name="sc_blue" value={fields.sc_blue} onChange={setField} />
          </div>

          <div className="mt-2 pt-3 border-t border-white/40 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#378ADD]/30 text-[#042C53] font-semibold hover:bg-white/50">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#185FA5] to-[#378ADD] text-white font-bold shadow-lg shadow-[#378ADD]/30 flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'บันทึกอุปกรณ์'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
