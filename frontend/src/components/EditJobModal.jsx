import { useState, useEffect } from 'react';
import api from '../api/axios';
import { AppDateField, AppTimeField, AppSelectField } from './DispatchFilterFields';

const OFFICE_ASSIGNEE_ROLES = ['technician', 'office_technician', 'contractor_office'];
const MA_ASSIGNEE_ROLES = ['ma_technician', 'contractor_ma'];

function getUserRoles(u) {
  if (Array.isArray(u.roles)) return u.roles;
  if (u.roles_csv) return String(u.roles_csv).split(',');
  return u.role ? [u.role] : [];
}

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

const inputCls = 'w-full px-4 py-2.5 rounded-xl glass border border-white/60 focus:border-[#378ADD] focus:ring-2 focus:ring-[#378ADD]/20 outline-none text-[#042C53] bg-white/50';

function TextInput({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-[#042C53] mb-1">{label}</label>
      <input type={type} className={inputCls} value={value} onChange={onChange} placeholder={placeholder} />
    </div>
  );
}

export default function EditJobModal({ isOpen, onClose, job, onSuccess, type = 'office' }) {
  const jobType = job?.job_type === 'ma' || type === 'ma' ? 'ma' : 'office';
  const isMa = jobType === 'ma';
  const isCompleted = job?.status === 'completed';

  const [formData, setFormData] = useState({
    access_no: '',
    customer: '',
    phone: '',
    address: '',
    lat: '',
    lng: '',
    team_id: '',
    field_engineer_id: '',
    completed_by: '',
    plan_arrival_date: '',
    plan_arrival_time: '',
    package: '',
    product: '',
    order_no: '',
    task_type: '',
    service_note: '',
    symptoms: '',
    area_name: '',
    remark: '',
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
    srt: '',
    spt: '',
    fail_cause: '',
    fix_method: '',
    old_sn: '',
    new_sn: '',
    cable_used: '',
    used_equipment: '',
  });
  const [assignMode, setAssignMode] = useState('unassigned');
  const [teams, setTeams] = useState([]);
  const [techs, setTechs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const set = (key) => (e) => setFormData((prev) => ({ ...prev, [key]: e.target.value }));
  const setVal = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!isOpen || !job) return;
    let cancelled = false;

    const apply = (data) => {
      const assigneeId = data.field_engineer_id || data.assigned_user_id || '';
      const parsed = parseInstallDevice(data.install_device);
      setFormData({
        access_no: data.access_no || data.non_number || '',
        customer: data.customer || '',
        phone: data.phone || '',
        address: data.address || '',
        lat: data.lat || '',
        lng: data.lng || '',
        team_id: data.team_id || '',
        field_engineer_id: assigneeId,
        completed_by: data.completed_by || '',
        plan_arrival_date: data.plan_arrival_date ? String(data.plan_arrival_date).split('T')[0] : '',
        plan_arrival_time: data.plan_arrival_time
          ? (String(data.plan_arrival_time).includes('T')
            ? String(data.plan_arrival_time).split('T')[1].substring(0, 5)
            : String(data.plan_arrival_time).includes(' ')
              ? String(data.plan_arrival_time).split(' ')[1].substring(0, 5)
              : String(data.plan_arrival_time).substring(0, 5))
          : (data.job_time ? String(data.job_time).substring(0, 5) : ''),
        package: data.package || '',
        product: data.product || '',
        order_no: data.order_no || '',
        task_type: data.task_type || '',
        service_note: data.service_note || '',
        symptoms: data.symptoms || '',
        area_name: data.area_name || '',
        remark: data.remark || '',
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
        srt: data.srt || '',
        spt: data.spt || '',
        fail_cause: data.fail_cause || '',
        fix_method: data.fix_method || '',
        old_sn: data.old_sn || '',
        new_sn: data.new_sn || '',
        cable_used: data.cable_used || '',
        used_equipment: data.used_equipment || '',
      });
      setAssignMode(assigneeId ? 'individual' : (data.team_id ? 'team' : 'unassigned'));
    };

    apply(job);
    setError(null);
    fetchData();

    api.get(`/dispatch/jobs/${job.id}/details?type=${jobType}`)
      .then((res) => {
        if (!cancelled && res.data) apply(res.data);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [isOpen, job?.id, jobType]);

  const fetchData = async () => {
    try {
      const [teamRes, usersRes] = await Promise.all([
        api.get('/users/teams').catch(() => ({ data: [] })),
        api.get('/users').catch(() => ({ data: [] })),
      ]);
      setTeams(teamRes.data || []);
      const assigneeRoles = isMa ? MA_ASSIGNEE_ROLES : OFFICE_ASSIGNEE_ROLES;
      setTechs((usersRes.data || []).filter((u) => getUserRoles(u).some((r) => assigneeRoles.includes(r))));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAssignModeChange = (mode) => {
    setAssignMode(mode);
    setFormData((prev) => ({ ...prev, team_id: '', field_engineer_id: '' }));
  };

  const handleTeamChange = (newTeamId) => {
    setFormData((prev) => ({ ...prev, team_id: newTeamId, field_engineer_id: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      let teamId = assignMode === 'team' ? formData.team_id || null : null;
      const assigneeId = assignMode === 'individual' ? formData.field_engineer_id || null : null;
      if (assigneeId) {
        const assignee = techs.find((t) => String(t.id) === String(assigneeId));
        const isContractor = assignee && getUserRoles(assignee).some((r) => ['contractor_office', 'contractor_ma'].includes(r));
        teamId = !isContractor && assignee?.team_id ? assignee.team_id : null;
      }

      const payload = {
        type: jobType,
        access_no: formData.access_no,
        customer: formData.customer,
        phone: formData.phone,
        address: formData.address,
        lat: formData.lat,
        lng: formData.lng,
        team_id: teamId,
        field_engineer_id: assigneeId,
        plan_arrival_date: formData.plan_arrival_date,
        plan_arrival_time: formData.plan_arrival_time,
        package: formData.package,
        product: formData.product,
        order_no: formData.order_no,
        task_type: formData.task_type,
        service_note: formData.service_note,
        symptoms: formData.symptoms,
        area_name: formData.area_name,
        remark: formData.remark,
      };

      if (isMa) {
        payload.assigned_user_id = assigneeId;
        payload.job_time = formData.plan_arrival_time || null;
      }

      if (isCompleted) {
        payload.edit_completion = true;
        payload.completed_by = formData.completed_by || assigneeId || null;
        if (isMa) {
          payload.srt = formData.srt;
          payload.spt = formData.spt;
          payload.fail_cause = formData.fail_cause;
          payload.fix_method = formData.fix_method;
          payload.old_sn = formData.old_sn;
          payload.new_sn = formData.new_sn;
          payload.cable_used = formData.cable_used;
          payload.used_equipment = formData.used_equipment;
        } else {
          payload.soa_device = formData.soa_device;
          payload.sn_onu = formData.sn_onu;
          payload.sn_playbox = formData.sn_playbox;
          payload.sn_mesh = formData.sn_mesh;
          payload.sn_sim = formData.sn_sim;
          payload.sn_ip_camera = formData.sn_ip_camera;
          payload.split_no = formData.split_no;
          payload.port_no = formData.port_no;
          payload.l3_name = formData.l3_name;
          payload.cable_length = formData.cable_length;
          payload.ref_id_3bb = formData.ref_id_3bb;
          payload.sc_blue = formData.sc_blue;
        }
      }

      await api.put(`/dispatch/jobs/${job.id}`, payload);
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      const serverError = err.response?.data?.details || err.response?.data?.error || 'ไม่สามารถบันทึกข้อมูลได้';
      setError(serverError);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass border border-white/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/30 bg-white/40">
          <div>
            <h2 className="text-[#042C53] font-bold text-lg">
              แก้ไขข้อมูลงาน{isMa ? ' MA' : ''} {isMa ? (job.non_number || job.display_non || job.access_no) : job.access_no}
            </h2>
            {isCompleted && (
              <p className="text-xs font-bold text-emerald-700 mt-0.5">✅ งานจบแล้ว — แก้ได้ทั้งข้อมูลงานและผลติดตั้ง</p>
            )}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass border border-white/50 flex items-center justify-center text-[#042C53] hover:bg-white/50 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
          {error && <div className="p-3 bg-red-100 text-red-600 rounded-xl text-sm font-medium">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <TextInput label={isMa ? 'Access / NON' : 'Access (NON)'} value={formData.access_no} onChange={set('access_no')} />
            <TextInput label="ชื่อลูกค้า" value={formData.customer} onChange={set('customer')} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <AppDateField
              label={isCompleted ? 'วันที่ติดตั้ง / นัดหมาย' : 'วันที่นัดหมาย'}
              value={formData.plan_arrival_date}
              onChange={(v) => setVal('plan_arrival_date', v)}
            />
            <AppTimeField
              label="เวลานัดหมาย"
              value={formData.plan_arrival_time}
              onChange={(v) => setVal('plan_arrival_time', v)}
            />
          </div>

          <TextInput label="เบอร์โทร" value={formData.phone} onChange={set('phone')} />

          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">พื้นที่ / ที่อยู่</label>
            <textarea className={`${inputCls} resize-none h-24`} value={formData.address} onChange={set('address')} />
          </div>

          {isMa ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">อาการ / ปัญหา (Symptoms)</label>
                <textarea className={`${inputCls} resize-none h-20`} value={formData.symptoms} onChange={set('symptoms')} placeholder="อาการเสีย / ปัญหาที่ลูกค้าแจ้ง" />
              </div>
              <TextInput label="พื้นที่ (Area Name)" value={formData.area_name} onChange={set('area_name')} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <TextInput label="แพ็กเกจ (Package)" value={formData.package} onChange={set('package')} />
                <TextInput label="สินค้า (Product)" value={formData.product} onChange={set('product')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <TextInput label="Order No" value={formData.order_no} onChange={set('order_no')} />
                <TextInput label="ประเภทงาน (Task Type)" value={formData.task_type} onChange={set('task_type')} />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">รายละเอียดงาน (Service Note)</label>
                <textarea className={`${inputCls} resize-none h-20`} value={formData.service_note} onChange={set('service_note')} placeholder="รายละเอียดของงาน/ISP" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#042C53] mb-1">หมายเหตุ (Remark)</label>
            <textarea className={`${inputCls} resize-none h-20`} value={formData.remark} onChange={set('remark')} placeholder="หมายเหตุเพิ่มเติม" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <TextInput label="ละติจูด (Lat)" value={formData.lat} onChange={set('lat')} placeholder="เช่น 9.12345" />
            <TextInput label="ลองจิจูด (Lng)" value={formData.lng} onChange={set('lng')} placeholder="เช่น 99.12345" />
          </div>

          <button
            type="button"
            onClick={() => {
              if (!navigator.geolocation) {
                setError('เบราว์เซอร์ของคุณไม่รองรับการดึงตำแหน่ง');
                return;
              }
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  setFormData((prev) => ({
                    ...prev,
                    lat: position.coords.latitude.toFixed(6),
                    lng: position.coords.longitude.toFixed(6),
                  }));
                },
                () => setError('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง')
              );
            }}
            className="w-full py-2.5 rounded-xl border border-brand-500 text-brand-600 font-semibold hover:bg-brand-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            จับตำแหน่งปัจจุบัน
          </button>

          <div className="pt-2 border-t border-white/30">
            <label className="block text-sm font-semibold text-[#042C53] mb-2">การมอบหมายงาน</label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {[
                { key: 'team', label: '👥 ทีม' },
                { key: 'individual', label: '👤 รายบุคคล' },
                { key: 'unassigned', label: '⏳ ยังไม่มอบหมาย' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => handleAssignModeChange(opt.key)}
                  className={`px-2 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                    assignMode === opt.key
                      ? 'border-[#378ADD] bg-[#378ADD]/10 text-[#042C53]'
                      : 'border-white/60 bg-white/40 text-[#6B7280] hover:border-[#378ADD]/50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {assignMode === 'team' && (
              <AppSelectField
                label="ทีมที่รับผิดชอบ"
                value={String(formData.team_id || '')}
                onChange={handleTeamChange}
                options={teams.map((t) => ({
                  value: String(t.id),
                  label: `${t.team_name}${t.leader_name ? ` · หัวหน้า ${t.leader_name}` : ''}${
                    Number(t.member_count) ? ` · สมาชิก ${t.member_count}` : ''
                  }`,
                }))}
                placeholder="เลือกทีม"
                searchable
              />
            )}

            {assignMode === 'individual' && (
              <AppSelectField
                label={isMa ? 'ช่าง MA / รับเหมา MA' : 'ช่างติดตั้ง / รับเหมาติดตั้ง'}
                value={String(formData.field_engineer_id || '')}
                onChange={(techId) => setFormData((prev) => ({ ...prev, field_engineer_id: techId, team_id: '' }))}
                options={techs.map((t) => ({ value: String(t.id), label: t.full_name }))}
                placeholder="เลือกผู้รับผิดชอบ"
                searchable
              />
            )}

            {assignMode === 'unassigned' && (
              <p className="text-xs text-[#6B7280] font-medium px-1">งานจะถูกล้างทีม/ผู้รับผิดชอบออก สามารถมอบหมายใหม่ภายหลังได้</p>
            )}
          </div>

          {isCompleted && (
            <div className="pt-2 border-t border-emerald-200/60 space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-emerald-700">📦 ข้อมูลหลังจบงาน</h3>
              </div>
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                แก้ข้อความผลติดตั้งได้ทั้งหมด — การเปลี่ยน SN ไม่สลับของในกระเป๋า หากต้องเปลี่ยนชิ้นจริงให้ใช้ «ยกเลิกจบ» แล้วจบงานใหม่
              </p>

              <AppSelectField
                label="ผู้จบงาน (แสดงในประวัติ)"
                value={String(formData.completed_by || '')}
                onChange={(v) => setVal('completed_by', v)}
                options={techs.map((t) => ({ value: String(t.id), label: t.full_name }))}
                placeholder="เลือกผู้จบงาน"
                searchable
              />

              {isMa ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextInput label="SRT" value={formData.srt} onChange={set('srt')} />
                  <TextInput label="SPT" value={formData.spt} onChange={set('spt')} />
                  <TextInput label="สาเหตุเสีย" value={formData.fail_cause} onChange={set('fail_cause')} />
                  <TextInput label="วิธีแก้ไข" value={formData.fix_method} onChange={set('fix_method')} />
                  <TextInput label="SN เก่า" value={formData.old_sn} onChange={set('old_sn')} />
                  <TextInput label="SN ใหม่" value={formData.new_sn} onChange={set('new_sn')} />
                  <TextInput label="สายที่ใช้" value={formData.cable_used} onChange={set('cable_used')} />
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-semibold text-[#042C53] mb-1">อุปกรณ์ที่ใช้</label>
                    <textarea className={`${inputCls} resize-none h-20`} value={formData.used_equipment} onChange={set('used_equipment')} />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <TextInput label="อุปกรณ์ปิด SOA" value={formData.soa_device} onChange={set('soa_device')} />
                  <TextInput label="SN ONU" value={formData.sn_onu} onChange={set('sn_onu')} />
                  <TextInput label="SN Playbox" value={formData.sn_playbox} onChange={set('sn_playbox')} />
                  <TextInput label="SN Mesh" value={formData.sn_mesh} onChange={set('sn_mesh')} />
                  <TextInput label="SN Sim" value={formData.sn_sim} onChange={set('sn_sim')} />
                  <TextInput label="SN IP Camera" value={formData.sn_ip_camera} onChange={set('sn_ip_camera')} />
                  <TextInput label="Splitt" value={formData.split_no} onChange={set('split_no')} />
                  <TextInput label="ใช้ Port" value={formData.port_no} onChange={set('port_no')} />
                  <TextInput label="#L3 (ชื่อ)" value={formData.l3_name} onChange={set('l3_name')} />
                  <TextInput label="ระยะสายจริง (M)" value={formData.cable_length} onChange={set('cable_length')} />
                  <TextInput label="Ref ID 3BB" value={formData.ref_id_3bb} onChange={set('ref_id_3bb')} />
                  <TextInput label="ตัวต่อ sc สีฟ้า" value={formData.sc_blue} onChange={set('sc_blue')} />
                </div>
              )}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-white/30 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#378ADD]/30 text-[#042C53] font-semibold hover:bg-white/50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#185FA5] to-[#378ADD] text-white font-bold shadow-lg shadow-[#378ADD]/30 hover:shadow-[#378ADD]/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'บันทึกทั้งหมด'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
