import { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function InventoryHistoryPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'receive', 'dispatch', 'transfer'

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inventory/history');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'receive') return log.action === 'receive';
    if (filter === 'dispatch') return log.action === 'dispatch' || log.action === 'transfer';
    return true;
  });

  return (
    <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
      <div className="p-5 sm:p-6 border-b border-[#E5E7EB] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#F9FAFB]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white border border-[#E5E7EB] flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h2 className="text-lg font-black text-[#1F2937]">ประวัติทำรายการ</h2>
            <p className="text-xs font-medium text-[#6B7280]">บันทึกการนำเข้าและเบิกจ่ายสินค้า</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <div className="flex p-1 bg-white border border-[#E5E7EB] rounded-xl shadow-sm w-full sm:w-auto">
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); setFilter('all'); }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-[#F9FAFB] text-[#1F2937] shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#1F2937] border border-transparent'}`}
            >
              ทั้งหมด
            </button>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); setFilter('receive'); }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'receive' ? 'bg-[#F9FAFB] text-emerald-600 shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#1F2937] border border-transparent'}`}
            >
              นำเข้า
            </button>
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); setFilter('dispatch'); }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'dispatch' ? 'bg-[#F9FAFB] text-blue-600 shadow-sm border border-[#E5E7EB]' : 'text-[#6B7280] hover:text-[#1F2937] border border-transparent'}`}
            >
              นำออก/โอน
            </button>
          </div>
          
          <button type="button" onClick={(e) => { e.preventDefault(); fetchHistory(); }} className="flex items-center justify-center w-11 h-11 rounded-xl border-2 border-[#E5E7EB] text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#1F2937] transition-all shrink-0 bg-white shadow-sm active:scale-95" title="อัปเดตข้อมูล">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-[#F9FAFB] text-[#6B7280]">
            <tr>
              <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">วันเวลา</th>
              <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">ประเภท</th>
              <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">สินค้า</th>
              <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">SN/รหัส</th>
              <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">จำนวน</th>
              <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">ผู้ดำเนินการ</th>
              <th className="p-5 font-black uppercase tracking-wider border-b border-[#E5E7EB]">ผู้รับ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]">
            {loading ? (
              <tr>
                <td colSpan="7" className="text-center py-20">
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <svg className="animate-spin h-10 w-10 text-[#A3E635]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="text-sm font-bold text-[#9CA3AF]">กำลังโหลดข้อมูล...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan="7" className="text-center py-24 text-[#9CA3AF]">
                  <div className="flex flex-col items-center justify-center">
                    <svg className="w-16 h-16 mb-4 text-[#E5E7EB]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-black text-[#6B7280]">ไม่พบประวัติการทำรายการ</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-[#F9FAFB] transition-colors group">
                  <td className="p-5 font-medium text-[#6B7280]">
                    {new Date(log.created_at).toLocaleString('th-TH')}
                  </td>
                  <td className="p-5">
                    {log.action === 'receive' && <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-bold text-xs">นำเข้า</span>}
                    {log.action === 'dispatch' && <span className="text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg font-bold text-xs">เบิกจ่าย</span>}
                    {log.action === 'transfer' && <span className="text-purple-700 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-lg font-bold text-xs">โอนย้าย</span>}
                  </td>
                  <td className="p-5">
                    <div className="font-black text-[#1F2937] text-base">{log.product_name}</div>
                    <div className="text-xs font-bold text-[#6B7280] mt-0.5">{log.model_name}</div>
                  </td>
                  <td className="p-5 font-mono font-bold text-[#1F2937]">
                    {log.sn}
                  </td>
                  <td className="p-5 font-black text-[#1F2937]">
                    {log.quantity}
                  </td>
                  <td className="p-5 font-medium text-[#4B5563]">
                    {log.from_user_name || '-'}
                  </td>
                  <td className="p-5 font-medium text-[#4B5563]">
                    {log.to_user_name || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
