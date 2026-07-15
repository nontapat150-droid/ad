import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import Swal from 'sweetalert2';

export default function ContractorInventoryPage() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await api.get('/inventory/contractor-summary');
      setSummaries(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถโหลดข้อมูลสรุปอุปกรณ์รับเหมาได้'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout 
      sidebarOpen={sidebarOpen} 
      setSidebarOpen={setSidebarOpen} 
      activeMenu="contractor_inventory"
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-[#E5E7EB] shadow-sm">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#1F2937]">
              สรุปอุปกรณ์รับเหมา (Contractor Inventory)
            </h1>
            <p className="text-sm font-medium text-[#6B7280] mt-1">
              แสดงภาพรวมการเบิก-ใช้งานอุปกรณ์ของช่างรับเหมา
            </p>
          </div>
          <button 
            onClick={fetchSummary}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#4B5563] rounded-xl font-bold transition-all border border-[#E5E7EB]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            รีเฟรชข้อมูล
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#A3E635]"></div>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#E5E7EB] p-12 text-center shadow-sm">
            <div className="bg-[#F9FAFB] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#F3F4F6]">
              <svg className="w-10 h-10 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-[#1F2937] mb-2">ไม่พบข้อมูลผู้รับเหมา</h3>
            <p className="text-[#6B7280]">ยังไม่มีข้อมูลการเบิกหรือใช้อุปกรณ์ของผู้รับเหมาในขณะนี้</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {summaries.map(s => (
              <div key={s.contractor_id} className="bg-white rounded-3xl border border-[#E5E7EB] p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                {/* Decorative background element */}
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-gradient-to-br from-[#A3E635]/10 to-transparent rounded-full blur-2xl group-hover:bg-[#A3E635]/20 transition-all"></div>
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-black text-[#1F2937]">{s.contractor_name}</h3>
                      <span className="inline-block mt-2 px-3 py-1 bg-[#F9FAFB] text-[#4B5563] text-xs font-bold rounded-lg border border-[#E5E7EB]">
                        {s.role_display}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#F9FAFB] p-4 rounded-2xl border border-[#E5E7EB]">
                      <p className="text-xs font-bold text-[#6B7280] mb-1 uppercase tracking-wider">เบิกทั้งหมด</p>
                      <p className="text-2xl font-black text-[#1F2937]">{s.total_dispatched}</p>
                    </div>
                    
                    <div className="bg-[#F9FAFB] p-4 rounded-2xl border border-[#E5E7EB]">
                      <p className="text-xs font-bold text-[#6B7280] mb-1 uppercase tracking-wider">ใช้ไป</p>
                      <p className="text-2xl font-black text-[#1F2937]">{s.total_used}</p>
                    </div>

                    <div className="col-span-2 bg-gradient-to-r from-[#A3E635]/10 to-[#84cc16]/10 p-4 rounded-2xl border border-[#A3E635]/20">
                      <div className="flex justify-between items-center">
                        <p className="text-sm font-bold text-[#4d7c0f]">คงเหลือในกระเป๋า</p>
                        <p className="text-3xl font-black text-[#65a30d]">{s.remaining}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
