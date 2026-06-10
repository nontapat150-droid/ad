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
    <div className="animate-fade-in-up">
      <div className="max-w-6xl mx-auto space-y-6">
            
            <div className="glass p-6 rounded-2xl shadow-sm border border-white/50">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex gap-2 p-1 glass rounded-xl">
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setFilter('all'); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'glass text-[#042C53] shadow-sm' : 'text-[#378ADD] hover:text-[#042C53]'}`}
                  >
                    ทั้งหมด
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setFilter('receive'); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'receive' ? 'glass text-emerald-600 shadow-sm' : 'text-[#378ADD] hover:text-[#042C53]'}`}
                  >
                    นำเข้า
                  </button>
                  <button 
                    type="button"
                    onClick={(e) => { e.preventDefault(); setFilter('dispatch'); }}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'dispatch' ? 'glass text-[#185FA5] shadow-sm' : 'text-[#378ADD] hover:text-[#042C53]'}`}
                  >
                    นำออก/โอน
                  </button>
                </div>
                <button type="button" onClick={(e) => { e.preventDefault(); fetchHistory(); }} className="flex items-center gap-2 text-sm font-bold text-[#185FA5] hover:text-[#185FA5] transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  รีเฟรชข้อมูล
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[#185FA5]">
                  <thead className=" text-[#042C53] uppercase font-bold text-xs">
                    <tr>
                      <th className="px-4 py-3 rounded-tl-xl">วันเวลา</th>
                      <th className="px-4 py-3">ประเภท</th>
                      <th className="px-4 py-3">สินค้า</th>
                      <th className="px-4 py-3">SN/รหัส</th>
                      <th className="px-4 py-3">จำนวน</th>
                      <th className="px-4 py-3">ผู้ดำเนินการ</th>
                      <th className="px-4 py-3 rounded-tr-xl">ผู้รับ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500 mx-auto"></div>
                        </td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="text-center py-10 text-[#378ADD]">ไม่พบประวัติการทำรายการ</td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="border-b border-white/30 hover: transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap text-[#378ADD]">
                            {new Date(log.created_at).toLocaleString('th-TH')}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {log.action === 'receive' && <span className="text-emerald-600 bg-emerald-50 px-2 py-1 rounded font-bold text-xs">นำเข้า</span>}
                            {log.action === 'dispatch' && <span className="text-[#185FA5] bg-[#E6F1FB] px-2 py-1 rounded font-bold text-xs">เบิกจ่าย</span>}
                            {log.action === 'transfer' && <span className="text-purple-600 bg-purple-50 px-2 py-1 rounded font-bold text-xs">โอนย้าย</span>}
                          </td>
                          <td className="px-4 py-4">
                            <div className="font-bold text-[#042C53]">{log.product_name}</div>
                            <div className="text-xs text-[#378ADD]">{log.model_name}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap font-medium text-[#042C53]">
                            {log.sn}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap font-bold text-[#042C53]">
                            {log.quantity}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {log.from_user_name || '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            {log.to_user_name || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

      </div>
    </div>
  );
}
