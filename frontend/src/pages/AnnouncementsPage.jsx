import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import AOS from 'aos';
import Swal from 'sweetalert2';
import api from '../api/axios';
import Layout from '../components/Layout';
import { DateTimePicker } from '../components/DateTimePicker';
import { AppSelectField } from '../components/DispatchFilterFields';

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAnn, setEditingAnn] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    type: 'info',
    status: 'active',
    expires_at: ''
  });

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get('/announcements');
      setAnnouncements(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลประกาศได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
    AOS.refresh();
  }, []);

  const handleOpenModal = (ann = null) => {
    if (ann) {
      setEditingAnn(ann);
      setFormData({
        title: ann.title,
        message: ann.message,
        type: ann.type,
        status: ann.status,
        expires_at: ann.expires_at ? new Date(ann.expires_at).toISOString().slice(0, 16) : ''
      });
    } else {
      setEditingAnn(null);
      setFormData({
        title: '',
        message: '',
        type: 'info',
        status: 'active',
        expires_at: ''
      });
    }
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.title || !formData.message) {
      Swal.fire('แจ้งเตือน', 'กรุณากรอกหัวข้อและเนื้อหาให้ครบถ้วน', 'warning');
      return;
    }
    
    try {
      const payload = {
        ...formData,
        expires_at: formData.expires_at ? new Date(formData.expires_at).toISOString() : null
      };

      if (editingAnn) {
        await api.put(`/announcements/${editingAnn.id}`, payload);
        Swal.fire({ title: 'สำเร็จ', text: 'อัปเดตประกาศเรียบร้อย', icon: 'success', timer: 1500, showConfirmButton: false });
      } else {
        await api.post('/announcements', payload);
        Swal.fire({ title: 'สำเร็จ', text: 'สร้างประกาศเรียบร้อย', icon: 'success', timer: 1500, showConfirmButton: false });
      }
      setModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถบันทึกประกาศได้', 'error');
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: 'ยืนยันการลบ',
      text: 'คุณต้องการลบประกาศนี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#cbd5e1',
      confirmButtonText: 'ลบประกาศ',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true
    });

    if (confirm.isConfirmed) {
      try {
        await api.delete(`/announcements/${id}`);
        Swal.fire({ title: 'ลบสำเร็จ', text: 'ประกาศถูกลบออกจากระบบแล้ว', icon: 'success', timer: 1500, showConfirmButton: false });
        fetchAnnouncements();
      } catch (err) {
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถลบประกาศได้', 'error');
      }
    }
  };

  const toggleStatus = async (ann) => {
    try {
      const newStatus = ann.status === 'active' ? 'inactive' : 'active';
      await api.put(`/announcements/${ann.id}`, { ...ann, status: newStatus });
      fetchAnnouncements();
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้', 'error');
    }
  };

  return (
    <Layout activeKey="announcements" pageTitle="ระบบประกาศ">
      <div className="flex flex-col gap-6 pb-10">
        <div data-aos="fade-down" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-[#042C53] text-2xl md:text-3xl font-bold">จัดการประกาศจากระบบ 📢</h1>
            <p className="text-[#378ADD] text-sm mt-1">เพิ่ม ลบ หรือแก้ไขประกาศที่จะแสดงในหน้าแรกของพนักงาน</p>
          </div>
          <button 
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-gradient-to-r from-[#185FA5] to-[#378ADD] hover:from-[#0C447C] hover:to-[#185FA5] text-white px-5 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            สร้างประกาศใหม่
          </button>
        </div>

        <div data-aos="fade-up" className="glass rounded-3xl border border-white/50 shadow-sm overflow-hidden">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/50 border-b border-white/50 text-[#185FA5] text-sm font-bold tracking-wide">
                  <th className="p-4 pl-6 font-semibold whitespace-nowrap">หัวข้อประกาศ</th>
                  <th className="p-4 font-semibold whitespace-nowrap hidden md:table-cell">ประเภท</th>
                  <th className="p-4 font-semibold whitespace-nowrap hidden lg:table-cell">หมดอายุ</th>
                  <th className="p-4 font-semibold whitespace-nowrap">สถานะ</th>
                  <th className="p-4 pr-6 font-semibold text-right whitespace-nowrap">จัดการ</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-white/30">
                {loading ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-[#378ADD]">
                      <div className="flex justify-center mb-2">
                        <div className="w-6 h-6 border-2 border-[#185FA5] border-t-transparent rounded-full animate-spin"></div>
                      </div>
                      กำลังโหลดข้อมูล...
                    </td>
                  </tr>
                ) : announcements.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-10 text-center text-[#378ADD]">
                      ยังไม่มีประกาศในระบบ
                    </td>
                  </tr>
                ) : (
                  announcements.map((ann) => {
                    const isExpired = ann.expires_at && new Date(ann.expires_at) < new Date();
                    return (
                      <tr key={ann.id} className="hover:bg-white/40 transition-colors group">
                        <td className="p-4 pl-6">
                          <p className="text-[#042C53] font-bold line-clamp-1">{ann.title}</p>
                          <p className="text-[#378ADD] text-xs line-clamp-1 mt-0.5 max-w-xs">{ann.message}</p>
                        </td>
                        <td className="p-4 hidden md:table-cell">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                            ann.type === 'banner' ? 'bg-indigo-100 text-indigo-700' :
                            ann.type === 'warning' ? 'bg-orange-100 text-orange-700' :
                            ann.type === 'gift' ? 'bg-pink-100 text-pink-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {ann.type}
                          </span>
                        </td>
                        <td className="p-4 hidden lg:table-cell text-[#378ADD] text-xs">
                          {ann.expires_at ? (
                            <span className={isExpired ? 'text-red-500 font-medium' : ''}>
                              {new Date(ann.expires_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                            </span>
                          ) : (
                            'ไม่มีกำหนด'
                          )}
                        </td>
                        <td className="p-4">
                          <button 
                            onClick={() => toggleStatus(ann)}
                            className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                              ann.status === 'active' 
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            }`}
                          >
                            {ann.status === 'active' ? 'เปิดใช้งาน' : 'ปิดการใช้งาน'}
                          </button>
                        </td>
                        <td className="p-4 pr-6 text-right space-x-2 whitespace-nowrap">
                          <button 
                            onClick={() => handleOpenModal(ann)}
                            className="p-1.5 rounded-lg text-[#185FA5] hover:bg-[#E6F1FB] transition-colors"
                            title="แก้ไข"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button 
                            onClick={() => handleDelete(ann.id)}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                            title="ลบ"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg glass border border-white/50 rounded-3xl p-6 md:p-8 shadow-2xl relative animate-scale-up">
            <button 
              onClick={() => setModalOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/50 text-[#185FA5] hover:bg-white flex items-center justify-center transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <h3 className="text-[#042C53] font-bold text-xl mb-6">
              {editingAnn ? '✏️ แก้ไขประกาศ' : '📝 สร้างประกาศใหม่'}
            </h3>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">หัวข้อประกาศ <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                  className="w-full h-11 px-4 rounded-xl border border-[#378ADD]/30 bg-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 text-[#042C53] font-medium transition-all"
                  placeholder="เช่น อัปเดตระบบประจำเดือน, โปรดระวังมิจฉาชีพ"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">เนื้อหา <span className="text-red-500">*</span></label>
                <textarea 
                  required
                  rows="3"
                  value={formData.message}
                  onChange={e => setFormData({...formData, message: e.target.value})}
                  className="w-full p-4 rounded-xl border border-[#378ADD]/30 bg-white/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#185FA5]/30 text-[#042C53] text-sm resize-none transition-all"
                  placeholder="รายละเอียดประกาศ..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <AppSelectField
                  label="ประเภทประกาศ"
                  value={formData.type}
                  onChange={(v) => setFormData({ ...formData, type: v })}
                  options={[
                    { value: 'info', label: 'ข้อมูลทั่วไป (Info)' },
                    { value: 'banner', label: 'แจ้งเตือนสำคัญ (Banner)' },
                    { value: 'warning', label: 'คำเตือน (Warning)' },
                    { value: 'gift', label: 'กิจกรรม/ของขวัญ (Gift)' },
                  ]}
                  placeholder="เลือกประเภท"
                  allowClear={false}
                />
                <AppSelectField
                  label="สถานะ"
                  value={formData.status}
                  onChange={(v) => setFormData({ ...formData, status: v })}
                  options={[
                    { value: 'active', label: 'เปิดใช้งาน' },
                    { value: 'inactive', label: 'ปิดใช้งานชั่วคราว' },
                  ]}
                  placeholder="เลือกสถานะ"
                  allowClear={false}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#185FA5] mb-1.5">เวลาหมดอายุ (ไม่บังคับ)</label>
                <DateTimePicker
                  value={formData.expires_at ? new Date(formData.expires_at) : null}
                  onChange={(d) => setFormData({
                    ...formData,
                    expires_at: d ? format(d, "yyyy-MM-dd'T'HH:mm") : '',
                  })}
                  placeholder="ไม่กำหนดหมดอายุ"
                />
                <p className="text-xs text-[#378ADD] mt-1">หากไม่กำหนด ประกาศจะแสดงตลอดไปจนกว่าจะปิดสถานะ</p>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 h-12 rounded-xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit"
                  className="flex-1 h-12 rounded-xl bg-gradient-to-r from-[#185FA5] to-[#378ADD] text-white font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                >
                  บันทึกประกาศ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
