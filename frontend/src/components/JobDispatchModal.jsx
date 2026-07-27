import { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';
import { AppDateField, AppTimeField, AppSelectField } from './DispatchFilterFields';

// Roles allowed as individual assignee per job type
const OFFICE_ASSIGNEE_ROLES = ['technician', 'office_technician', 'contractor_office'];
const MA_ASSIGNEE_ROLES = ['ma_technician', 'contractor_ma'];

function getUserRoles(u) {
  if (Array.isArray(u.roles)) return u.roles;
  if (u.roles_csv) return String(u.roles_csv).split(',');
  return u.role ? [u.role] : [];
}

const initialForm = {
  // shared
  customer: '',
  phone: '',
  plan_arrival_date: '',
  plan_arrival_time: '',
  address: '',
  lat: '',
  lng: '',
  area_name: '',
  remark: '',
  // office
  access_no: '',
  package: '',
  product: '',
  order_no: '',
  customer_order_no: '',
  task_order: '',
  task_type: '',
  product_owner: '',
  province: '',
  area_code: '',
  service_note: '',
  // ma
  non_number: '',
  symptoms: '',
  // assignment
  team_id: '',
  assignee_id: '',
};

export default function JobDispatchModal({ isOpen, onClose, onSuccess, defaultJobType = 'office' }) {
  const [jobType, setJobType] = useState(defaultJobType === 'ma' ? 'ma' : 'office');
  const [step, setStep] = useState('form'); // 'form' | 'summary'
  const [assignMode, setAssignMode] = useState('unassigned'); // 'team' | 'individual' | 'unassigned'
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(initialForm);

  useEffect(() => {
    if (isOpen) {
      setForm(initialForm);
      setJobType(defaultJobType === 'ma' ? 'ma' : 'office');
      setStep('form');
      setAssignMode('unassigned');
      fetchDropdownData();
    }
  }, [isOpen, defaultJobType]);

  const fetchDropdownData = async () => {
    try {
      const [usersRes, teamsRes] = await Promise.all([
        axios.get('/users').catch(() => ({ data: [] })),
        axios.get('/users/teams').catch(() => ({ data: [] })),
      ]);
      setUsers(usersRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch dropdowns', err);
    }
  };

  const assigneeRoles = jobType === 'ma' ? MA_ASSIGNEE_ROLES : OFFICE_ASSIGNEE_ROLES;
  const assignableUsers = users.filter((u) => getUserRoles(u).some((r) => assigneeRoles.includes(r)));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleJobTypeChange = (type) => {
    if (type === jobType) return;
    setJobType(type);
    // Reset assignment because the assignee role pool differs per type
    setForm((prev) => ({ ...prev, team_id: '', assignee_id: '' }));
  };

  const handleAssignModeChange = (mode) => {
    setAssignMode(mode);
    setForm((prev) => ({ ...prev, team_id: '', assignee_id: '' }));
  };

  // ── Validation ──────────────────────────────────────────────
  const getMissingFields = () => {
    const missing = [];
    const req = (val, label) => { if (!String(val || '').trim()) missing.push(label); };

    if (jobType === 'ma') {
      req(form.non_number, 'เลข NON');
      req(form.customer, 'ชื่อลูกค้า');
      req(form.symptoms, 'อาการ');
    } else {
      req(form.access_no, 'Access No');
      req(form.customer, 'ชื่อลูกค้า');
    }
    req(form.phone, 'เบอร์โทรศัพท์');
    req(form.plan_arrival_date, 'วันที่เข้าทำ');
    req(form.plan_arrival_time, 'เวลานัด');
    req(form.address, 'ที่อยู่');

    if (assignMode === 'team' && !form.team_id) missing.push('ทีมที่รับผิดชอบ');
    if (assignMode === 'individual' && !form.assignee_id) missing.push('ผู้รับผิดชอบ (รายบุคคล)');

    return missing;
  };

  const handleReview = (e) => {
    e.preventDefault();
    const missing = getMissingFields();
    if (missing.length > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'กรอกข้อมูลไม่ครบ',
        html: `กรุณากรอก: <b>${missing.join(', ')}</b>`,
        confirmButtonColor: '#A3E635',
      });
      return;
    }
    setStep('summary');
  };

  // ── Payload & save ──────────────────────────────────────────
  const buildPayload = (forceUnassigned) => {
    let teamId = !forceUnassigned && assignMode === 'team' ? form.team_id || null : null;
    const assigneeId = !forceUnassigned && assignMode === 'individual' ? form.assignee_id || null : null;

    // Individual mode: carry the tech's own team (contractors have none) — same as bulk-assign
    if (assigneeId) {
      const assignee = assignableUsers.find((u) => String(u.id) === String(assigneeId));
      const isContractor = assignee && getUserRoles(assignee).some((r) => ['contractor_office', 'contractor_ma'].includes(r));
      teamId = !isContractor && assignee?.team_id ? assignee.team_id : null;
    }

    if (jobType === 'ma') {
      return {
        non_number: form.non_number.trim(),
        customer: form.customer,
        phone: form.phone,
        symptoms: form.symptoms,
        plan_arrival_date: form.plan_arrival_date,
        job_time: form.plan_arrival_time,
        address: form.address,
        area_name: form.area_name,
        remark: form.remark,
        lat: form.lat,
        lng: form.lng,
        team_id: teamId,
        assigned_user_id: assigneeId,
      };
    }

    return {
      access_no: form.access_no.trim(),
      customer: form.customer,
      phone: form.phone,
      plan_arrival_date: form.plan_arrival_date,
      plan_arrival_time: form.plan_arrival_time,
      address: form.address,
      lat: form.lat,
      lng: form.lng,
      package: form.package,
      product: form.product,
      order_no: form.order_no,
      customer_order_no: form.customer_order_no,
      task_order: form.task_order,
      task_type: form.task_type,
      product_owner: form.product_owner,
      province: form.province,
      area_code: form.area_code,
      area_name: form.area_name,
      service_note: form.service_note,
      remark: form.remark,
      team_id: teamId,
      field_engineer_id: assigneeId,
    };
  };

  const handleSave = async ({ keepOpen = false, forceUnassigned = false } = {}) => {
    setLoading(true);
    const endpoint = jobType === 'ma' ? '/dispatch/ma-jobs' : '/dispatch/jobs';
    const payload = buildPayload(forceUnassigned);
    try {
      try {
        await axios.post(endpoint, payload);
      } catch (err) {
        // MA duplicate (same NON + same date) — ask before allowing a repeat
        if (jobType === 'ma' && err.response?.status === 409 && err.response?.data?.duplicate) {
          const result = await Swal.fire({
            icon: 'warning',
            title: 'พบงานซ้ำ',
            text: err.response.data.error,
            showCancelButton: true,
            confirmButtonText: 'บันทึกซ้ำ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#A3E635',
          });
          if (!result.isConfirmed) return;
          await axios.post(endpoint, { ...payload, allow_duplicate: true });
        } else {
          throw err;
        }
      }

      Swal.fire({
        icon: 'success',
        title: 'บันทึกข้อมูลสำเร็จ!',
        text: forceUnassigned
          ? 'บันทึกงานแบบยังไม่มอบหมายเรียบร้อยแล้ว'
          : 'เพิ่มงานเข้าสู่ระบบเรียบร้อยแล้ว',
        timer: 1800,
        showConfirmButton: false,
      });
      onSuccess();

      if (keepOpen) {
        setForm(initialForm);
        setAssignMode('unassigned');
        setStep('form');
      } else {
        onClose();
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
      Swal.fire({ icon: 'error', title: 'ไม่สามารถบันทึกได้', text: msg, confirmButtonColor: '#A3E635' });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const selectedTeam = teams.find((t) => String(t.id) === String(form.team_id));
  const selectedAssignee = assignableUsers.find((u) => String(u.id) === String(form.assignee_id));

  const assignmentSummary =
    assignMode === 'team' && selectedTeam ? `ทีม: ${selectedTeam.team_name}`
    : assignMode === 'individual' && selectedAssignee ? `รายบุคคล: ${selectedAssignee.full_name}`
    : 'ยังไม่มอบหมาย';

  // ── UI helpers ──────────────────────────────────────────────
  const limeButtonStyle = { background: 'linear-gradient(135deg,#A3E635,#84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-4 md:p-6">
      <div className="absolute inset-0 bg-[#1F2937]/50 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E5E7EB] animate-fade-in-up">
        <div className="h-1 shrink-0" style={{ background: 'linear-gradient(90deg,#A3E635,#65a30d)' }} />

        {/* Header */}
        <div className="px-6 md:px-8 py-4 border-b border-[#F3F4F6] flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-[#1F2937]" style={{ background: 'linear-gradient(135deg,#A3E635,#84cc16)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1F2937] flex items-center gap-2">
                เพิ่มงานด้วยตัวเอง (Manual Entry)
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${jobType === 'ma' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  {jobType === 'ma' ? '🔧 MA' : '🏢 ติดตั้ง'}
                </span>
              </h2>
              <p className="text-sm text-[#9CA3AF] font-medium">
                {step === 'summary' ? 'ตรวจสอบข้อมูลก่อนบันทึก' : 'กรอกข้อมูลที่จำเป็นเพื่อเพิ่มงานใหม่เข้าสู่ระบบ'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-[#F3F4F6] flex items-center justify-center text-[#6B7280] hover:bg-[#E5E7EB] transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {step === 'form' ? (
          <>
            {/* Form Body */}
            <form id="dispatchForm" onSubmit={handleReview} className="flex-1 overflow-y-auto p-4 md:p-6" style={{ scrollbarWidth: 'thin' }}>

              {/* Job type selector */}
              <div className="mb-5">
                <p className="text-sm font-bold text-[#374151] mb-2">ประเภทงาน</p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'office', label: 'งานติดตั้ง', emoji: '🏢', desc: 'งาน Office / ติดตั้งใหม่' },
                    { key: 'ma', label: 'งาน MA', emoji: '🔧', desc: 'งาน Maintenance / ซ่อมบำรุง' },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => handleJobTypeChange(opt.key)}
                      className={`p-4 rounded-2xl border-2 text-left transition-all ${
                        jobType === opt.key
                          ? 'border-[#A3E635] bg-[#A3E635]/10 shadow-md shadow-[#A3E635]/20'
                          : 'border-[#E5E7EB] bg-white hover:border-[#A3E635]/50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{opt.emoji}</div>
                      <p className="font-bold text-[#1F2937] text-sm">{opt.label}</p>
                      <p className="text-[#9CA3AF] text-xs">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-[#E5E7EB] p-4 md:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {jobType === 'ma' ? (
                    <>
                      <Field label="เลข NON" name="non_number" value={form.non_number} onChange={handleChange} required placeholder="เช่น NONxxxxxxx" />
                      <Field label="ชื่อลูกค้า" name="customer" value={form.customer} onChange={handleChange} required placeholder="ระบุชื่อลูกค้า" />
                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-bold text-[#1F2937] mb-2">อาการ / ปัญหา <span className="text-red-500">*</span></label>
                        <textarea
                          name="symptoms"
                          value={form.symptoms}
                          onChange={handleChange}
                          rows="2"
                          placeholder="ระบุอาการเสีย / ปัญหาที่ลูกค้าแจ้ง"
                          className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#A3E635] focus:border-[#A3E635] transition-all outline-none"
                        ></textarea>
                      </div>
                    </>
                  ) : (
                    <>
                      <Field label="Access No" name="access_no" value={form.access_no} onChange={handleChange} required placeholder="เช่น 880xxxxxxx" />
                      <Field label="ชื่อลูกค้า" name="customer" value={form.customer} onChange={handleChange} required placeholder="ระบุชื่อลูกค้า" />
                    </>
                  )}

                  <Field label="เบอร์โทรศัพท์" name="phone" value={form.phone} onChange={handleChange} required placeholder="ระบุเบอร์ติดต่อ" />
                  <AppDateField
                    label="วันที่เข้าทำ (Plan Date) *"
                    value={form.plan_arrival_date}
                    onChange={(v) => setForm((prev) => ({ ...prev, plan_arrival_date: v }))}
                  />
                  <AppTimeField
                    label="เวลานัด (Plan Time) *"
                    value={form.plan_arrival_time}
                    onChange={(v) => setForm((prev) => ({ ...prev, plan_arrival_time: v }))}
                  />
                  <Field label="พื้นที่ (Area Name)" name="area_name" value={form.area_name} onChange={handleChange} />

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-bold text-[#1F2937] mb-2">
                      {jobType === 'ma' ? 'ที่อยู่ลูกค้า' : 'สถานที่ติดตั้ง/ที่อยู่'} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="address"
                      value={form.address}
                      onChange={handleChange}
                      rows="2"
                      placeholder="ระบุที่อยู่ครบถ้วน"
                      className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#A3E635] focus:border-[#A3E635] transition-all outline-none"
                    ></textarea>
                  </div>

                  <Field label="ละติจูด (Latitude)" name="lat" value={form.lat} onChange={handleChange} type="number" step="any" placeholder="เช่น 13.7563" />
                  <Field label="ลองติจูด (Longitude)" name="lng" value={form.lng} onChange={handleChange} type="number" step="any" placeholder="เช่น 100.5018" />

                  {jobType === 'office' && (
                    <>
                      <Field label="แพ็กเกจ (Package)" name="package" value={form.package} onChange={handleChange} />
                      <Field label="สินค้า (Product)" name="product" value={form.product} onChange={handleChange} />
                      <Field label="Order No" name="order_no" value={form.order_no} onChange={handleChange} />
                      <Field label="Customer Order No" name="customer_order_no" value={form.customer_order_no} onChange={handleChange} />
                      <Field label="Task Order" name="task_order" value={form.task_order} onChange={handleChange} />
                      <Field label="ประเภทงาน (Task Type)" name="task_type" value={form.task_type} onChange={handleChange} />
                      <Field label="Product Owner" name="product_owner" value={form.product_owner} onChange={handleChange} />
                      <Field label="จังหวัด (Province)" name="province" value={form.province} onChange={handleChange} />
                      <Field label="Area Code" name="area_code" value={form.area_code} onChange={handleChange} />

                      <div className="col-span-1 md:col-span-2">
                        <label className="block text-sm font-bold text-[#1F2937] mb-2">Service Note</label>
                        <textarea
                          name="service_note"
                          value={form.service_note}
                          onChange={handleChange}
                          rows="2"
                          placeholder="หมายเหตุบริการ / ISP"
                          className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#A3E635] focus:border-[#A3E635] transition-all outline-none"
                        />
                      </div>
                    </>
                  )}

                  {/* Assignment */}
                  <div className="col-span-1 md:col-span-2 border-t border-[#F3F4F6] pt-5 mt-1">
                    <p className="text-sm font-bold text-[#374151] mb-2">การมอบหมายงาน <span className="text-red-500">*</span></p>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[
                        { key: 'team', label: '👥 มอบหมายทีม' },
                        { key: 'individual', label: '👤 รายบุคคล' },
                        { key: 'unassigned', label: '⏳ ยังไม่มอบหมาย' },
                      ].map((opt) => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => handleAssignModeChange(opt.key)}
                          className={`px-3 py-2.5 rounded-xl border-2 text-xs sm:text-sm font-bold transition-all ${
                            assignMode === opt.key
                              ? 'border-[#A3E635] bg-[#A3E635]/10 text-[#1F2937]'
                              : 'border-[#E5E7EB] bg-white text-[#6B7280] hover:border-[#A3E635]/50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {assignMode === 'team' && (
                      <AppSelectField
                        label="ทีมที่รับผิดชอบ"
                        value={String(form.team_id || '')}
                        onChange={(v) => setForm((prev) => ({ ...prev, team_id: v, assignee_id: '' }))}
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
                        label={jobType === 'ma' ? 'ช่าง MA / รับเหมา MA' : 'ช่างติดตั้ง / รับเหมาติดตั้ง'}
                        value={String(form.assignee_id || '')}
                        onChange={(v) => setForm((prev) => ({ ...prev, assignee_id: v, team_id: '' }))}
                        options={assignableUsers.map((u) => ({ value: String(u.id), label: u.full_name }))}
                        placeholder="เลือกผู้รับผิดชอบ"
                        searchable
                      />
                    )}

                    {assignMode === 'unassigned' && (
                      <p className="text-xs text-[#9CA3AF] font-medium px-1">งานจะถูกบันทึกเข้าระบบโดยยังไม่ระบุทีม/ผู้รับผิดชอบ สามารถมอบหมายภายหลังได้</p>
                    )}
                  </div>

                  <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-bold text-[#1F2937] mb-2">หมายเหตุ (Remark)</label>
                    <textarea
                      name="remark"
                      value={form.remark}
                      onChange={handleChange}
                      rows="2"
                      placeholder="ระบุข้อมูลเพิ่มเติม (ถ้ามี)"
                      className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#A3E635] focus:border-[#A3E635] transition-all outline-none"
                    ></textarea>
                  </div>

                </div>
              </div>
            </form>

            {/* Footer (form step) */}
            <div className="px-6 md:px-8 py-4 border-t border-[#F3F4F6] flex justify-end gap-3 shrink-0 bg-white">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 text-sm font-bold text-[#6B7280] border border-[#E5E7EB] rounded-xl hover:bg-[#F3F4F6] transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                form="dispatchForm"
                className="px-8 py-3 text-sm font-bold text-[#1F2937] rounded-xl transition-all"
                style={limeButtonStyle}
              >
                ตรวจสอบข้อมูล →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Summary Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6" style={{ scrollbarWidth: 'thin' }}>
              <div className="rounded-2xl border border-[#E5E7EB] overflow-hidden">
                <div className="px-5 py-3 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <p className="text-sm font-bold text-[#1F2937]">
                    สรุปข้อมูลงาน{jobType === 'ma' ? ' MA' : 'ติดตั้ง'}ก่อนบันทึก
                  </p>
                </div>
                <div className="divide-y divide-[#F3F4F6]">
                  {(jobType === 'ma'
                    ? [
                        ['เลข NON', form.non_number],
                        ['ชื่อลูกค้า', form.customer],
                        ['อาการ / ปัญหา', form.symptoms],
                        ['เบอร์โทรศัพท์', form.phone],
                        ['วันที่เข้าทำ', form.plan_arrival_date],
                        ['เวลานัด', form.plan_arrival_time],
                        ['ที่อยู่', form.address],
                        ['พื้นที่', form.area_name],
                        ['หมายเหตุ', form.remark],
                      ]
                    : [
                        ['Access No', form.access_no],
                        ['ชื่อลูกค้า', form.customer],
                        ['เบอร์โทรศัพท์', form.phone],
                        ['วันที่เข้าทำ', form.plan_arrival_date],
                        ['เวลานัด', form.plan_arrival_time],
                        ['ที่อยู่', form.address],
                        ['แพ็กเกจ', form.package],
                        ['สินค้า', form.product],
                        ['ประเภทงาน', form.task_type],
                        ['หมายเหตุ', form.remark],
                      ]
                  )
                    .filter(([, val]) => String(val || '').trim() !== '')
                    .map(([label, val]) => (
                      <div key={label} className="px-5 py-2.5 grid grid-cols-[140px_1fr] gap-3">
                        <span className="text-xs font-bold text-[#9CA3AF] pt-0.5">{label}</span>
                        <span className="text-sm text-[#1F2937] font-medium break-words">{val}</span>
                      </div>
                    ))}
                  <div className="px-5 py-2.5 grid grid-cols-[140px_1fr] gap-3 bg-[#A3E635]/5">
                    <span className="text-xs font-bold text-[#9CA3AF] pt-0.5">การมอบหมาย</span>
                    <span className="text-sm text-[#1F2937] font-bold">{assignmentSummary}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer (summary step) */}
            <div className="px-6 md:px-8 py-4 border-t border-[#F3F4F6] flex flex-wrap justify-between gap-3 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setStep('form')}
                disabled={loading}
                className="px-5 py-3 text-sm font-bold text-[#6B7280] border border-[#E5E7EB] rounded-xl hover:bg-[#F3F4F6] transition-colors disabled:opacity-50"
              >
                ← แก้ไขข้อมูล
              </button>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => handleSave({ forceUnassigned: true })}
                  disabled={loading}
                  className="px-4 py-3 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl hover:bg-amber-100 transition-colors disabled:opacity-50"
                >
                  บันทึกโดยยังไม่มอบหมาย
                </button>
                <button
                  type="button"
                  onClick={() => handleSave({ keepOpen: true })}
                  disabled={loading}
                  className="px-4 py-3 text-sm font-bold text-[#1F2937] bg-white border-2 border-[#A3E635] rounded-xl hover:bg-[#A3E635]/10 transition-colors disabled:opacity-50"
                >
                  บันทึกและเพิ่มต่อ
                </button>
                <button
                  type="button"
                  onClick={() => handleSave()}
                  disabled={loading}
                  className="px-8 py-3 text-sm font-bold text-[#1F2937] rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
                  style={limeButtonStyle}
                >
                  {loading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-[#1F2937]/30 border-t-[#1F2937] rounded-full animate-spin"></span>
                      กำลังบันทึก...
                    </>
                  ) : 'บันทึก'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Helper Sub-component ──
function Field({ label, name, value, onChange, type = 'text', step, required, placeholder }) {
  return (
    <div className="col-span-1">
      <label className="block text-sm font-bold text-[#1F2937] mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        step={step}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#A3E635] focus:border-[#A3E635] transition-all outline-none"
      />
    </div>
  );
}
