import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function UserProfileModal({ user, onClose, getRoleBadge }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    fetchHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedDate]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      let url = `/checkin/user/${user.id}/history`;
      if (selectedDate) {
        const d = selectedDate;
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        url += `?date=${dateStr}`;
      } else {
        const mStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth()+1).padStart(2,'0')}`;
        url += `?month=${mStr}`;
      }
      const res = await api.get(url);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1));
    setSelectedDate(null);
  };
  const handleNextMonth = () => {
    setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1));
    setSelectedDate(null);
  };

  const daysInMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1).getDay();
  const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

  const formatTime = (iso) => iso ? `${new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.` : '-';
  const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 animate-[fadeIn_0.3s_ease-out]">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-5xl h-[85vh] sm:h-[80vh] flex flex-col bg-white/90 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 bg-white/50 flex justify-between items-start shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-indigo-100 border border-white shadow-sm flex items-center justify-center text-2xl font-bold text-indigo-600">
              {user.full_name?.charAt(0) || '?'}
            </div>
            <div>
              <h2 className="text-2xl font-black text-[#042C53]">{user.full_name}</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm font-bold text-slate-400">@{user.username || user.role}</span>
                {getRoleBadge(user.role)}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 rounded-xl transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-slate-50/30">
          
          {/* Left Column: Calendar */}
          <div className="w-full lg:w-80 p-6 border-r border-slate-200/50 flex flex-col shrink-0 overflow-y-auto">
            <div className="glass p-5 rounded-3xl border border-white shadow-sm bg-white/40">
              <div className="flex items-center justify-between mb-4">
                <button onClick={handlePrevMonth} className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
                <div className="font-black text-[#042C53] tracking-wide">
                  {monthNames[selectedMonth.getMonth()]} {selectedMonth.getFullYear()}
                </div>
                <button onClick={handleNextMonth} className="w-8 h-8 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>

              {/* Day Labels */}
              <div className="grid grid-cols-7 gap-1 text-center mb-2">
                {['อา','จ','อ','พ','พฤ','ศ','ส'].map(d => (
                  <div key={d} className="text-xs font-bold text-slate-400 py-1">{d}</div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-8"></div>
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isSelected = selectedDate && selectedDate.getDate() === day;
                  const isToday = new Date().toDateString() === new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day).toDateString();
                  
                  return (
                    <button
                      key={day}
                      onClick={() => {
                        if (isSelected) setSelectedDate(null); // deselect
                        else setSelectedDate(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day));
                      }}
                      className={`h-8 w-8 mx-auto rounded-full text-sm font-bold flex items-center justify-center transition-all ${
                        isSelected 
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30' 
                          : isToday 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'text-slate-600 hover:bg-slate-200/50'
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              
              {selectedDate && (
                <button 
                  onClick={() => setSelectedDate(null)}
                  className="w-full mt-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition-colors"
                >
                  แสดงประวัติทั้งหมดในเดือนนี้
                </button>
              )}
            </div>
            
            <div className="mt-6 glass p-5 rounded-3xl border border-white shadow-sm bg-indigo-50/50">
              <h3 className="font-bold text-[#185FA5] text-sm mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                คำแนะนำ
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                คลิกที่วันที่ในปฏิทินเพื่อดูประวัติเฉพาะวันนั้น หากไม่ได้เลือกจะแสดงประวัติทั้งหมดในเดือนที่เลือก
              </p>
            </div>
          </div>

          {/* Right Column: History List */}
          <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50 relative">
            <h3 className="font-bold text-[#042C53] text-lg mb-4">
              {selectedDate 
                ? `ประวัติวันที่ ${selectedDate.getDate()} ${monthNames[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}` 
                : `ประวัติเดือน${monthNames[selectedMonth.getMonth()]} ${selectedMonth.getFullYear()}`
              }
            </h3>

            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="h-32 bg-slate-200/50 animate-pulse rounded-2xl" />)}
              </div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <p className="font-bold">ไม่พบประวัติการลงเวลา</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map(record => (
                  <div key={record.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4">
                    {/* Photos */}
                    <div className="flex gap-2 shrink-0">
                      <div className="relative">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                          {record.image_path ? (
                            <img src={`/uploads/checkins/${record.image_path}`} alt="Checkin" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">ไม่มีรูป</div>
                          )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-blue-100 text-blue-700 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border border-white">เข้า</div>
                      </div>
                      
                      <div className="relative">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                          {record.checkout_image ? (
                            <img src={`/uploads/checkouts/${record.checkout_image}`} alt="Checkout" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">ไม่มีรูป</div>
                          )}
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-indigo-100 text-indigo-700 text-[10px] font-black px-1.5 py-0.5 rounded shadow-sm border border-white">ออก</div>
                      </div>
                    </div>
                    
                    {/* Details */}
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-[#378ADD] text-xs font-bold mb-0.5">{formatDate(record.checkin_time)}</p>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              <span className="font-black text-[#042C53]">{formatTime(record.checkin_time)}</span>
                            </div>
                            <span className="text-slate-300">→</span>
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                              <span className="font-black text-[#042C53]">{formatTime(record.checkout_time)}</span>
                            </div>
                          </div>
                        </div>
                        {record.is_late === 1 ? (
                          <span className="px-3 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-black shadow-sm border border-rose-100">มาสาย</span>
                        ) : (
                          <span className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-black shadow-sm border border-emerald-100">ตรงเวลา</span>
                        )}
                      </div>
                      
                      {record.is_edited === 1 && (
                        <p className="text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-1 rounded border border-amber-200 inline-block w-max mt-1">
                          ✏️ มีการแก้ไขรูปภาพ แต่ไม่เปลี่ยนเวลาเช็คอิน
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
