import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import axios from '../api/axios';

export default function CustomersPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="flex h-dvh  font-sans overflow-hidden">
      <Sidebar 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        activeKey="customers" 
      />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        {/* Header */}
        <header className="flex items-center justify-between p-4 glass border-b border-white/50 shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl  text-[#185FA5] border border-white/50 hover:glass transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="font-bold text-[#042C53] text-lg md:text-xl tracking-tight flex items-center gap-2">
              <svg className="w-6 h-6 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              ข้อมูลลูกค้าและประวัติงาน
            </h1>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto w-full">
            
            {/* Search Bar */}
            <div className="glass rounded-2xl p-6 shadow-sm border border-white/50 mb-8">
              <h2 className="text-sm font-bold text-[#378ADD] uppercase tracking-wider mb-4">ค้นหาประวัติด้วย Access Number / NON</h2>
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-[#378ADD] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input 
                    type="text" 
                    value={accessNo}
                    onChange={(e) => setAccessNo(e.target.value)}
                    placeholder="กรอกเลข Access Number เช่น 880xxxxxxx"
                    className="w-full pl-11 pr-4 py-4  border border-white/50 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none text-[#042C53] font-medium transition-all"
                    required
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading}
                  className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-8 py-4 rounded-xl transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px]"
                >
                  {loading ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'ค้นหาข้อมูล'
                  )}
                </button>
              </form>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl mb-8 animate-fade-in-up">
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
                <div className="w-24 h-24 glass text-slate-300 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#378ADD] opacity-80">กรอกเลข Access Number เพื่อเริ่มค้นหา</h3>
              </div>
            )}

            {/* Results */}
            {customerData && (
              <div className="space-y-6 animate-fade-in-up">
                
                {/* 1. Profile Card */}
                <div className="glass rounded-2xl shadow-sm border border-white/50 overflow-hidden">
                  <div className="bg-[#E6F1FB] border-b border-brand-100 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-brand-800 mb-1">{customerData.customer || 'ไม่ระบุชื่อลูกค้า'}</h2>
                      <p className="text-[#185FA5] font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {customerData.phone || 'ไม่ระบุเบอร์โทร'}
                      </p>
                    </div>
                    <div className="glass px-4 py-2 rounded-xl border border-brand-100 shadow-sm text-center">
                      <p className="text-xs text-[#378ADD] font-bold uppercase mb-1">สถานะปัจจุบัน</p>
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold ${
                        customerData.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        customerData.status === 'in_progress' ? 'bg-amber-100 text-amber-700' :
                        customerData.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'glass text-[#042C53]'
                      }`}>
                        {customerData.status === 'completed' ? 'เสร็จสิ้น' :
                         customerData.status === 'in_progress' ? 'กำลังดำเนินการ' :
                         customerData.status === 'failed' ? 'ล้มเหลว' : 'รอดำเนินการ'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h3 className="text-sm font-bold text-[#378ADD] opacity-80 uppercase tracking-wider mb-4 border-b pb-2">ข้อมูลพื้นที่ (Location)</h3>
                      <div className="space-y-3">
                        <InfoRow label="ที่อยู่" value={customerData.address} />
                        <InfoRow label="จังหวัด / พื้นที่" value={`${customerData.province || '-'} / ${customerData.area_name || '-'}`} />
                        <InfoRow label="พิกัด (Lat, Lng)" value={customerData.lat && customerData.lng ? `${customerData.lat}, ${customerData.lng}` : 'ไม่ระบุพิกัด'} />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#378ADD] opacity-80 uppercase tracking-wider mb-4 border-b pb-2">ข้อมูลบริการ (Service)</h3>
                      <div className="space-y-3">
                        <InfoRow label="แพ็กเกจ" value={customerData.package} />
                        <InfoRow label="อุปกรณ์ที่ติดตั้ง" value={customerData.install_device} />
                        <InfoRow label="ประเภทงาน" value={customerData.task_type} />
                        <InfoRow label="Product Owner" value={customerData.product_owner} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Dispatch & Timeline Split */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Dispatch Info */}
                  <div className="lg:col-span-1 glass rounded-2xl shadow-sm border border-white/50 p-6">
                    <h3 className="text-sm font-bold text-[#378ADD] opacity-80 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#378ADD] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      ทีมช่างผู้รับผิดชอบ
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-[#378ADD] font-medium mb-1">ทีมที่รับมอบหมาย (Team)</p>
                        <p className="font-bold text-[#042C53]  px-3 py-2 rounded-lg border border-white/30">
                          {customerData.team_name || 'ยังไม่ระบุทีม'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#378ADD] font-medium mb-1">ช่างหน้างาน (Field Engineer)</p>
                        <p className="font-bold text-[#042C53]  px-3 py-2 rounded-lg border border-white/30">
                          {customerData.engineer_name || 'ยังไม่ระบุช่าง'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#378ADD] font-medium mb-1">ผู้โทรนัดลูกค้า (Called Engineer)</p>
                        <p className="text-sm text-[#042C53]">
                          {customerData.called_engineer || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#378ADD] font-medium mb-1">SLA Status</p>
                        <span className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-bold">
                          {customerData.sla_status || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="lg:col-span-2 glass rounded-2xl shadow-sm border border-white/50 p-6">
                    <h3 className="text-sm font-bold text-[#378ADD] opacity-80 uppercase tracking-wider mb-6 border-b pb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#378ADD] opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      ไทม์ไลน์ประวัติงาน (Timeline)
                    </h3>
                    
                    <div className="relative border-l-2 border-white/50 ml-3 space-y-8">
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
                        active={!!customerData.set_off_time}
                        title="ออกเดินทาง (Set off)" 
                        time={formatDate(customerData.set_off_time)} 
                        desc="ช่างเริ่มเดินทางไปยังจุดหมาย"
                      />
                      <TimelineItem 
                        active={!!customerData.arrival_time}
                        title="ถึงหน้างาน (Arrival)" 
                        time={formatDate(customerData.arrival_time)} 
                        desc="ช่างเดินทางถึงจุดหมาย"
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

                {/* Additional Remarks if any */}
                {(customerData.remark || customerData.reject_reason || customerData.fail_reason) && (
                  <div className="glass rounded-2xl shadow-sm border border-white/50 p-6">
                    <h3 className="text-sm font-bold text-[#378ADD] opacity-80 uppercase tracking-wider mb-4 border-b pb-2">บันทึกเพิ่มเติมจากช่าง</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {customerData.remark && (
                        <div>
                          <p className="text-xs text-[#378ADD] font-bold mb-1">หมายเหตุ (Remark)</p>
                          <p className="text-sm text-[#042C53]  p-3 rounded-xl border border-white/30">{customerData.remark}</p>
                        </div>
                      )}
                      {customerData.reject_reason && (
                        <div>
                          <p className="text-xs text-amber-500 font-bold mb-1">เหตุผลที่ตีกลับ (Reject Reason)</p>
                          <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-100">{customerData.reject_reason}</p>
                        </div>
                      )}
                      {customerData.fail_reason && (
                        <div>
                          <p className="text-xs text-red-500 font-bold mb-1">เหตุผลที่ล้มเหลว (Fail Reason)</p>
                          <p className="text-sm text-red-800 bg-red-50 p-3 rounded-xl border border-red-100">{customerData.fail_reason}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Entry Fee Proof */}
                {customerData.entry_fee_image && (
                  <div className="glass rounded-2xl shadow-sm border border-white/50 p-6">
                    <h3 className="text-sm font-bold text-[#378ADD] opacity-80 uppercase tracking-wider mb-4 border-b pb-2 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#378ADD]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      หลักฐานค่าแรกเข้า (Entry Fee)
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-6 items-start">
                      <div className="w-full sm:w-64 h-64 border rounded-xl overflow-hidden  flex-shrink-0">
                        <img 
                          src={`http://localhost:3001${customerData.entry_fee_image}`} 
                          alt="Entry Fee Proof" 
                          className="w-full h-full object-cover hover:object-contain transition-all cursor-pointer"
                          onClick={() => window.open(`http://localhost:3001${customerData.entry_fee_image}`, '_blank')}
                        />
                      </div>
                      <div>
                        <p className="text-sm text-[#378ADD] font-medium mb-1">วันที่อัปโหลด</p>
                        <p className="text-[#042C53] font-bold mb-4">{formatDate(customerData.entry_fee_updated_at)}</p>
                        <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700">
                          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          ชำระเรียบร้อยแล้ว
                        </span>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

// ── Helper Components ──
function InfoRow({ label, value }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-4">
      <span className="text-sm font-medium text-[#378ADD] w-32 shrink-0">{label}:</span>
      <span className="text-sm text-[#042C53] font-semibold">{value || '-'}</span>
    </div>
  );
}

function TimelineItem({ title, time, desc, active, isLast }) {
  return (
    <div className="relative pl-6">
      <div className={`absolute w-4 h-4 rounded-full -left-[9px] top-1 border-2 border-white ${active ? 'bg-brand-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]' : 'bg-slate-300'}`}></div>
      <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between mb-1 ${active ? 'opacity-100' : 'opacity-50'}`}>
        <h4 className="font-bold text-[#042C53] text-sm">{title}</h4>
        <span className="text-xs font-semibold text-[#185FA5] bg-[#E6F1FB] px-2 py-1 rounded-md mt-1 sm:mt-0">{time}</span>
      </div>
      <p className={`text-sm ${active ? 'text-[#185FA5]' : 'text-[#378ADD] opacity-80'}`}>{desc}</p>
    </div>
  );
}
