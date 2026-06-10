import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import api from '../api/axios';
import Swal from 'sweetalert2';
import UserProfileModal from '../components/UserProfileModal';

export default function AttendanceSummaryPage() {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    fetchSummary();
  }, []);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/checkin/summary');
      setData(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'เกิดข้อผิดพลาด',
        text: 'ไม่สามารถดึงข้อมูลสรุปได้ คุณมีสิทธิ์เข้าถึงหรือไม่?'
      });
      if (err.response?.status === 403) navigate('/checkin');
    } finally {
      setLoading(false);
    }
  };

  // Calculate top-level metrics
  const totalEmployees = data.length;
  const totalCheckins = data.reduce((acc, curr) => acc + (parseInt(curr.total_checkins) || 0), 0);
  const totalLate = data.reduce((acc, curr) => acc + (parseInt(curr.total_late) || 0), 0);
  const totalOntime = data.reduce((acc, curr) => acc + (parseInt(curr.total_ontime) || 0), 0);
  const punctualityRate = totalCheckins > 0 ? Math.round((totalOntime / totalCheckins) * 100) : 0;

  // Filter for table
  const filteredData = data.filter(u => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('th-TH', { 
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const getRoleBadge = (role) => {
    switch(role) {
      case 'super_admin': return <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 text-xs font-bold">ผู้ดูแลระบบสูงสุด</span>;
      case 'admin': return <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">ผู้ดูแลระบบ</span>;
      case 'technician': return <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 text-xs font-bold">ช่างเทคนิค</span>;
      case 'user': return <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 text-xs font-bold">พนักงานทั่วไป</span>;
      default: return <span className="px-2 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold">{role}</span>;
    }
  };

  return (
    <Layout activeKey="checkin" pageTitle="สรุปภาพรวมการเข้างาน">
      <div className="pb-12 space-y-6 animate-[fadeIn_0.4s_ease-out]">
        
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-[#042C53] flex items-center gap-2">
              <span className="text-[#378ADD]">📊</span> แดชบอร์ดสรุปเวลาเข้างาน
            </h1>
            <p className="text-sm font-medium text-slate-500 mt-1">
              สรุปข้อมูลการลงเวลาเข้างานของพนักงานทั้งหมดในบริษัท
            </p>
          </div>
          <button 
            onClick={() => navigate('/checkin')}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-bold text-slate-600 shadow-sm transition-all active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            กลับหน้าบันทึกเวลา
          </button>
        </div>

        {/* Metric Cards (Shadcn Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
            <div className="relative z-10 flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-slate-500">พนักงานทั้งหมด</p>
              <span className="p-2 bg-blue-100 text-blue-600 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg></span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-black text-[#042C53]">{totalEmployees} <span className="text-sm font-bold text-slate-400">คน</span></h3>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
            <div className="relative z-10 flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-slate-500">การเช็คอินทั้งหมด</p>
              <span className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-black text-[#042C53]">{totalCheckins} <span className="text-sm font-bold text-slate-400">ครั้ง</span></h3>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
            <div className="relative z-10 flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-slate-500">อัตราการมาตรงเวลา</p>
              <span className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-black text-[#042C53]">{punctualityRate}<span className="text-xl">%</span></h3>
              <p className="text-xs font-bold text-emerald-600 mt-1">ตรงเวลา {totalOntime} ครั้ง</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-50 rounded-full group-hover:scale-110 transition-transform duration-500 z-0"></div>
            <div className="relative z-10 flex justify-between items-start mb-2">
              <p className="text-sm font-bold text-slate-500">ยอดการมาสายสะสม</p>
              <span className="p-2 bg-rose-100 text-rose-600 rounded-lg"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></span>
            </div>
            <div className="relative z-10">
              <h3 className="text-3xl font-black text-rose-600">{totalLate} <span className="text-sm font-bold text-slate-400">ครั้ง</span></h3>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table Toolbar */}
          <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <h3 className="font-bold text-[#042C53]">รายชื่อพนักงานและสถิติ</h3>
            <div className="relative w-full sm:w-64">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              </div>
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือบทบาท..."
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table Content */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 bg-slate-50 uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">พนักงาน</th>
                  <th className="px-6 py-4">บทบาท</th>
                  <th className="px-6 py-4 text-center">เช็คอินรวม</th>
                  <th className="px-6 py-4 text-center">ตรงเวลา</th>
                  <th className="px-6 py-4 text-center">มาสาย</th>
                  <th className="px-6 py-4">ใช้งานล่าสุด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin"></div>
                        <span>กำลังโหลดข้อมูล...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-slate-500 font-medium">
                      ไม่พบข้อมูลที่ค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredData.map((user) => (
                    <tr 
                      key={user.id} 
                      onClick={() => setSelectedUser(user)}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-[#042C53]">{user.full_name}</span>
                          <span className="text-xs text-slate-400">@{user.username}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-4 text-center font-bold text-slate-600">
                        {user.total_checkins}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded bg-emerald-50 text-emerald-600 font-bold">
                          {user.total_ontime}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded font-bold ${user.total_late > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-50 text-slate-400'}`}>
                          {user.total_late}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                        {formatDate(user.latest_checkin)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {selectedUser && (
        <UserProfileModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)} 
          getRoleBadge={getRoleBadge}
        />
      )}
    </Layout>
  );
}
