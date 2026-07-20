import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import NotificationBell from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';
import ManualModal from '../components/ManualModal';
import ManualHelpButton from '../components/ManualHelpButton';
import { useAuth } from '../context/AuthContext';
import axios from '../api/axios';
import { getImageUrl } from '../utils/imageUtils';
import { getJobStatusBadgeClass, getJobStatusLabel } from '../constants/jobStatus';

export default function CustomersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const { user } = useAuth();
  const userRoles = user?.roles || [user?.role];
  const [accessNo, setAccessNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerData, setCustomerData] = useState(null);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!accessNo.trim()) return;

    setLoading(true);
    setError(null);
    setCustomerData(null);

    try {
      const res = await axios.get(`/dispatch/search-access/${encodeURIComponent(accessNo.trim())}`);
      setCustomerData(res.data);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setError('ไม่พบข้อมูลลูกค้าสำหรับ Access Number หรือ NON นี้');
      } else {
        setError('เกิดข้อผิดพลาดในการค้นหาข้อมูล');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="flex h-dvh font-sans overflow-hidden bg-[#F3F4F6]">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeKey="customers" 
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[var(--sidebar-width)] transition-[margin] duration-300 ease-out">
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex items-center justify-between px-4 py-3 bg-white border-b border-[#E5E7EB] shrink-0"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-[#6B7280] border border-[#E5E7EB] hover:bg-[#F3F4F6] transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #A3E635, #65a30d)' }}>
                <svg className="w-4 h-4 text-[#1F2937]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h1 className="font-bold text-[#1F2937] text-lg tracking-tight">ข้อมูลลูกค้าและประวัติงาน</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ManualHelpButton onClick={() => setShowManualModal(true)} />
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>

        {/* ── Main Content ────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto w-full">
            
            {/* Search Bar */}
            <div className="bg-white rounded-xl p-6 border border-[#E5E7EB] mb-6"
              style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1.5 h-4 rounded-full bg-gradient-to-b from-[#A3E635] to-[#65a30d]" />
                <h2 className="text-sm font-bold text-[#374151] uppercase tracking-wider">ค้นหาประวัติด้วย Access Number / NON</h2>
              </div>
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input 
                    type="text" 
                    value={accessNo}
                    onChange={(e) => setAccessNo(e.target.value)}
                    placeholder="กรอกเลข Access Number เช่น 880xxxxxxx"
                    className="w-full pl-11 pr-4 py-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl focus:ring-2 focus:ring-[#A3E635]/40 focus:border-[#A3E635] outline-none text-[#1F2937] font-medium transition-all placeholder:text-[#9CA3AF]"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="font-bold px-8 py-3.5 rounded-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[130px] text-[#1F2937]"
                  style={{ background: 'linear-gradient(135deg, #A3E635, #84cc16)', boxShadow: '0 2px 8px rgba(163,230,53,0.3)' }}
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-[#1F2937] border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'ค้นหาข้อมูล'
                  )}
                </button>
              </form>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-6 animate-fade-in-up">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700 font-medium">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {!customerData && !error && !loading && (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-[#F3F4F6] border border-[#E5E7EB] rounded-2xl flex items-center justify-center mx-auto mb-5">
                  <svg className="w-10 h-10 text-[#D1D5DB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-[#9CA3AF]">กรอกเลข Access Number เพื่อเริ่มค้นหา</h3>
              </div>
            )}

            {/* ── Results ────────────────────────────────────── */}
            {customerData && (
              <div className="space-y-5 animate-fade-in-up">
                
                {/* 1. Profile Card */}
                <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden"
                  style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                  {/* Profile header */}
                  <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    style={{ background: 'linear-gradient(135deg, #1F2937 0%, #374151 100%)' }}>
                    <div>
                      <h2 className="text-2xl font-black text-white mb-1">{customerData.customer || 'ไม่ระบุชื่อลูกค้า'}</h2>
                      <p className="text-[#A3E635] font-medium flex items-center gap-2 text-sm">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {customerData.phone || 'ไม่ระบุเบอร์โทร'}
                      </p>
                    </div>
                    <div className="bg-white/10 backdrop-blur-sm px-4 py-2.5 rounded-xl border border-white/15 text-center">
                      <p className="text-[10px] text-[#A3E635] font-bold uppercase tracking-widest mb-1">สถานะปัจจุบัน</p>
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold border ${getJobStatusBadgeClass(customerData.status)}`}>
                        {getJobStatusLabel(customerData.status)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Profile details */}
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-xs font-bold text-[#65a30d] uppercase tracking-wider mb-4 pb-2 border-b border-[#E5E7EB] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635]" />
                        ข้อมูลพื้นที่ (Location)
                      </h3>
                      <div className="space-y-3">
                        <InfoRow label="ที่อยู่" value={customerData.address} />
                        <InfoRow label="จังหวัด / พื้นที่" value={`${customerData.province || '-'} / ${customerData.area_name || '-'}`} />
                        <InfoRow label="พิกัด (Lat, Lng)" value={customerData.lat && customerData.lng ? `${customerData.lat}, ${customerData.lng}` : 'ไม่ระบุพิกัด'} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-[#65a30d] uppercase tracking-wider mb-4 pb-2 border-b border-[#E5E7EB] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635]" />
                        ข้อมูลบริการ (Service)
                      </h3>
                      <div className="space-y-3">
                        <InfoRow label="วันที่ติดตั้ง (Plan Date)" value={customerData.plan_arrival_date ? new Date(customerData.plan_arrival_date).toLocaleDateString('th-TH') : '-'} />
                        <InfoRow label="เลข (NON)" value={customerData.access_no} />
                        <InfoRow label="แพ็กเกจ" value={customerData.package} />
                        <InfoRow label="สินค้า (Product)" value={customerData.product} />
                        <InfoRow label="Order No" value={customerData.order_no} />
                        <InfoRow label="Customer Order No" value={customerData.customer_order_no} />
                        <InfoRow label="Service Note" value={customerData.service_note} />
                        {customerData.used_devices && customerData.used_devices.length > 0 && (
                          <div className="pt-2 border-t border-[#E5E7EB]">
                            {/* SN items (มี Serial Number) */}
                            {customerData.used_devices.filter(d => d.device_role !== 'NoSN').length > 0 && (
                              <>
                                <p className="text-xs font-bold text-[#185FA5] mb-2">อุปกรณ์ที่ติดตั้ง (มี SN)</p>
                                {customerData.used_devices.filter(d => d.device_role !== 'NoSN').map((d, idx) => (
                                  <InfoRow
                                    key={`used-sn-${idx}`}
                                    label={d.device_role}
                                    value={`${d.product_name || ''} ${d.model_name || ''} — SN: ${d.sn || '-'}`.trim()}
                                  />
                                ))}
                              </>
                            )}
                            {/* NoSN items (นับจำนวน ไม่มี SN) */}
                            {customerData.used_devices.filter(d => d.device_role === 'NoSN').length > 0 && (
                              <>
                                <p className="text-xs font-bold text-blue-600 mb-2 mt-2">🔧 อุปกรณ์ติดตั้ง (นับจำนวน)</p>
                                {customerData.used_devices.filter(d => d.device_role === 'NoSN').map((d, idx) => (
                                  <InfoRow
                                    key={`used-nosn-${idx}`}
                                    label={`${d.product_name || ''} ${d.model_name || ''}`.trim()}
                                    value={`จำนวน ${d.quantity || 1} ชิ้น`}
                                  />
                                ))}
                              </>
                            )}
                          </div>
                        )}
                        {customerData.soa_device && (
                          <>
                            <InfoRow label="อุปกรณ์ปิด SOA" value={customerData.soa_device} />
                            {customerData.sn_onu && customerData.sn_onu !== '-' && <InfoRow label="SN ONU" value={customerData.sn_onu} />}
                            {customerData.sn_playbox && customerData.sn_playbox !== '-' && <InfoRow label="SN Playbox" value={customerData.sn_playbox} />}
                            {customerData.sn_mesh && customerData.sn_mesh !== '-' && <InfoRow label="SN Mesh" value={customerData.sn_mesh} />}
                            {customerData.sn_sim && customerData.sn_sim !== '-' && <InfoRow label="SN Sim" value={customerData.sn_sim} />}
                            {customerData.sn_ip_camera && customerData.sn_ip_camera !== '-' && <InfoRow label="SN IP Camera" value={customerData.sn_ip_camera} />}
                            {customerData.split_no && <InfoRow label="Splitt" value={customerData.split_no} />}
                            {customerData.port_no && <InfoRow label="ใช้ Port" value={customerData.port_no} />}
                            {customerData.l3_name && customerData.l3_name !== '-' && <InfoRow label="ใช้ #L3(ชื่อ)" value={customerData.l3_name} />}
                            {customerData.cable_length && <InfoRow label="ระยะสายจริง(M)" value={customerData.cable_length} />}
                            {customerData.ref_id_3bb && customerData.ref_id_3bb !== '-' && <InfoRow label="Ref ID 3BB" value={customerData.ref_id_3bb} />}
                            {customerData.sc_blue && customerData.sc_blue !== '-' && <InfoRow label="ตัวต่อscสีฟ้า" value={customerData.sc_blue} />}
                          </>
                        )}
                        {customerData.install_device && (customerData.install_device.includes('\n') || customerData.install_device.includes('|') || customerData.install_device.includes(',')) ? (
                          <>
                            <div className="pt-2 border-t border-[#E5E7EB]">
                              <p className="text-xs font-bold text-[#65a30d] mb-2">อุปกรณ์ที่ติดตั้งเพิ่มเติม</p>
                              {customerData.install_device.split(/[\n|,]/).map((line, idx) => {
                                if (!line.trim()) return null;
                                const colonIdx = line.indexOf(':');
                                if (colonIdx !== -1) {
                                  const label = line.substring(0, colonIdx).trim();
                                  const value = line.substring(colonIdx + 1).trim();
                                  return <InfoRow key={`device-${idx}`} label={label} value={value} />;
                                }
                                return <InfoRow key={`device-${idx}`} label={`อุปกรณ์ ${idx+1}`} value={line.trim()} />;
                              })}
                            </div>
                          </>
                        ) : customerData.install_device ? (
                          <InfoRow label="อุปกรณ์ที่ติดตั้ง" value={customerData.install_device} />
                        ) : null}
                        <InfoRow label="ประเภทงาน" value={customerData.task_type} />
                        <InfoRow label="Product Owner" value={customerData.product_owner} />
                        <InfoRow label="Order Type" value={customerData.order_type} />
                        <InfoRow label="Task Order" value={customerData.task_order} />
                        <InfoRow label="Region" value={customerData.region} />
                        {customerData.map_link && (
                          <InfoRow label="Map Link" value={
                            <a href={customerData.map_link} target="_blank" rel="noreferrer" className="text-[#185FA5] underline break-all">
                              {customerData.map_link}
                            </a>
                          } />
                        )}
                        {customerData.deadline && (
                          <InfoRow label="Deadline" value={formatDate(customerData.deadline)} />
                        )}
                        {customerData.completed_by_name && (
                          <InfoRow label="ผู้ปิดงาน" value={customerData.completed_by_name} />
                        )}
                        {/* งานไม่จบ - แสดงเหตุผล */}
                        {customerData.latest_job_status === 'failed' && customerData.fail_reason && (
                          <div className="pt-2 border-t border-red-100 mt-1">
                            <p className="text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                              ❌ งานไม่จบ — สาเหตุ:
                            </p>
                            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 font-medium">
                              {customerData.fail_reason}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Dispatch & Timeline Split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  
                  {/* Dispatch Info */}
                  <div className="lg:col-span-1 bg-white rounded-xl border border-[#E5E7EB] p-6"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                    <h3 className="text-xs font-bold text-[#65a30d] uppercase tracking-wider mb-4 pb-2 border-b border-[#E5E7EB] flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      ทีมช่างผู้รับผิดชอบ
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-[#9CA3AF] font-medium mb-1">ทีมที่รับมอบหมาย (Team)</p>
                        <p className="font-bold text-[#1F2937] bg-[#F9FAFB] px-3 py-2.5 rounded-lg border border-[#E5E7EB] text-sm">
                          {customerData.team_name || 'ยังไม่ระบุทีม'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9CA3AF] font-medium mb-1">ช่างหน้างาน (Field Engineer)</p>
                        <p className="font-bold text-[#1F2937] bg-[#F9FAFB] px-3 py-2.5 rounded-lg border border-[#E5E7EB] text-sm">
                          {customerData.engineer_name || 'ยังไม่ระบุช่าง'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9CA3AF] font-medium mb-1">ผู้โทรนัดลูกค้า (Called Engineer)</p>
                        <p className="text-sm text-[#374151]">
                          {customerData.called_engineer || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#9CA3AF] font-medium mb-1">SLA Status</p>
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#A3E635]/10 text-[#374151] text-xs font-bold border border-[#A3E635]/25">
                          {customerData.sla_status || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                    <h3 className="text-xs font-bold text-[#65a30d] uppercase tracking-wider mb-6 pb-2 border-b border-[#E5E7EB] flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ไทม์ไลน์ประวัติงาน (Timeline)
                    </h3>
                    
                    <div className="relative border-l-2 border-[#E5E7EB] ml-3 space-y-8">
                      <TimelineItem 
                        active={!!customerData.create_time || !!customerData.created_at}
                        title="สร้างงานในระบบ (Created)" 
                        time={formatDate(customerData.create_time || customerData.created_at)} 
                        desc="งานถูกนำเข้าสู่ระบบ"
                      />
                      <TimelineItem 
                        active={!!customerData.plan_arrival_time}
                        title="เวลานัดหมาย (Plan Arrival)" 
                        time={formatDate(customerData.plan_arrival_time)} 
                        desc="เวลานัดหมายกับลูกค้า"
                      />

                      <TimelineItem 
                        active={!!customerData.finish_time}
                        isLast
                        title="ปิดงาน (Finished)" 
                        time={formatDate(customerData.finish_time)} 
                        desc={customerData.status === 'completed' ? 'ดำเนินการเสร็จสิ้นเรียบร้อย' : customerData.remark || 'รอดำเนินการ'}
                      />
                    </div>
                  </div>

                </div>

                {/* Additional Remarks */}
                {((customerData.remark && customerData.remark.trim() !== '' && customerData.remark !== 'null') || customerData.reject_reason || customerData.fail_reason) && (
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                    <h3 className="text-xs font-bold text-[#65a30d] uppercase tracking-wider mb-4 pb-2 border-b border-[#E5E7EB] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635]" />
                      บันทึกเพิ่มเติมจากช่าง
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {customerData.remark && customerData.remark.trim() !== '' && customerData.remark !== 'null' && (
                        <div>
                          <p className="text-xs text-[#9CA3AF] font-bold mb-1.5">หมายเหตุ (Remark)</p>
                          <p className="text-sm text-[#374151] bg-[#F9FAFB] p-3 rounded-xl border border-[#E5E7EB] whitespace-pre-wrap">{customerData.remark}</p>
                        </div>
                      )}
                      {customerData.reject_reason && (
                        <div>
                          <p className="text-xs text-amber-600 font-bold mb-1.5">เหตุผลที่ตีกลับ (Reject Reason)</p>
                          <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-100">{customerData.reject_reason}</p>
                        </div>
                      )}
                      {customerData.fail_reason && (
                        <div>
                          <p className="text-xs text-red-600 font-bold mb-1.5">เหตุผลที่ล้มเหลว (Fail Reason)</p>
                          <p className="text-sm text-red-800 bg-red-50 p-3 rounded-xl border border-red-100">{customerData.fail_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Entry Fee Proof */}
                {customerData.entry_fee_image && (
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                    <h3 className="text-xs font-bold text-[#65a30d] uppercase tracking-wider mb-4 pb-2 border-b border-[#E5E7EB] flex items-center gap-1.5">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      หลักฐานค่าแรกเข้า (Entry Fee)
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <div className="w-full sm:w-64 h-64 border border-[#E5E7EB] rounded-xl overflow-hidden bg-[#F9FAFB] flex-shrink-0">
                        <img 
                          src={getImageUrl(customerData.entry_fee_image, 'misc')}
                          alt="Entry Fee Proof" 
                          className="w-full h-full object-cover hover:object-contain transition-all cursor-pointer"
                          onClick={() => window.open(getImageUrl(customerData.entry_fee_image, 'misc'), '_blank')}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-[#9CA3AF] font-medium mb-1">วันที่อัปโหลด</p>
                        <p className="text-[#1F2937] font-bold mb-4">{formatDate(customerData.entry_fee_updated_at)}</p>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                          <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          ชำระเรียบร้อยแล้ว
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Evidence Images */}
                {customerData.completion_images && customerData.completion_images.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#E5E7EB] p-6"
                    style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                    <h3 className="text-xs font-bold text-[#65a30d] uppercase tracking-wider mb-4 pb-2 border-b border-[#E5E7EB] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#A3E635]" />
                      รูปภาพหลักฐานปิดงาน (Evidence Images)
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {customerData.completion_images.map((img, idx) => (
                        <div key={idx} className="aspect-square border border-[#E5E7EB] rounded-xl overflow-hidden bg-[#F9FAFB] shadow-sm">
                          <img 
                            src={getImageUrl(img, 'job_evidence')}
                            alt={`Evidence ${idx + 1}`} 
                            className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                            onClick={() => window.open(getImageUrl(img, 'job_evidence'), '_blank')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </main>
      </div>

      <ManualModal
        isOpen={showManualModal}
        onClose={() => setShowManualModal(false)}
        userRoles={userRoles}
        pageName="customers"
      />
    </div>
  );
}

// ── Helper Components ──────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
      <span className="text-sm font-medium text-[#9CA3AF] w-32 shrink-0">{label}:</span>
      <span className="text-sm text-[#1F2937] font-semibold whitespace-pre-wrap">{value || '-'}</span>
    </div>
  );
}

function TimelineItem({ title, time, desc, active, isLast }) {
  return (
    <div className="relative pl-6">
      <div className={`absolute w-4 h-4 rounded-full -left-[9px] top-1 border-2 border-white ${
        active ? 'bg-[#A3E635]' : 'bg-[#D1D5DB]'
      }`}
        style={active ? { boxShadow: '0 0 0 3px rgba(163,230,53,0.2)' } : {}}
      />
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 ${active ? 'opacity-100' : 'opacity-40'}`}>
        <h4 className="font-bold text-[#1F2937] text-sm">{title}</h4>
        <span className={`text-xs font-semibold px-2 py-1 rounded-md mt-1 sm:mt-0 ${
          active ? 'text-[#374151] bg-[#A3E635]/15 border border-[#A3E635]/25' : 'text-[#9CA3AF] bg-[#F3F4F6]'
        }`}>{time}</span>
      </div>
      <p className={`text-sm ${active ? 'text-[#6B7280]' : 'text-[#9CA3AF]'}`}>{desc}</p>
    </div>
  );
}
