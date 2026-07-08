import { useState, useEffect } from 'react';
import axios from '../api/axios';
import Swal from 'sweetalert2';

const CategoryManagementModal = ({ isOpen, onClose, onCategoryUpdated }) => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/inventory/categories');
      setCategories(res.data);
    } catch (err) {
      console.error('Failed to load categories', err);
      Swal.fire('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลหมวดหมู่ได้', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    try {
      await axios.post('/inventory/categories', { name: newCategoryName.trim() });
      Swal.fire({ icon: 'success', title: 'เพิ่มหมวดหมู่สำเร็จ', timer: 1000, showConfirmButton: false });
      setNewCategoryName('');
      fetchCategories();
      if (onCategoryUpdated) onCategoryUpdated();
    } catch (err) {
      Swal.fire('ข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถเพิ่มหมวดหมู่ได้', 'error');
    }
  };

  const handleDeleteCategory = async (catName) => {
    const res = await Swal.fire({
      title: 'ยืนยันการลบหมวดหมู่?',
      html: `คุณกำลังจะลบหมวดหมู่ <b>"${catName}"</b><br/>สินค้าในหมวดหมู่นี้จะถูกย้ายไปที่ "ไม่มีหมวดหมู่"`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#EF4444',
      cancelButtonColor: '#9CA3AF',
      confirmButtonText: 'ลบเลย',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-3xl' }
    });

    if (res.isConfirmed) {
      try {
        await axios.delete(`/inventory/categories/${encodeURIComponent(catName)}`);
        Swal.fire({ icon: 'success', title: 'ลบหมวดหมู่สำเร็จ', timer: 1000, showConfirmButton: false });
        fetchCategories();
        if (onCategoryUpdated) onCategoryUpdated();
      } catch (err) {
        Swal.fire('ข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถลบหมวดหมู่ได้', 'error');
      }
    }
  };

  const handleEditCategoryName = async (catName) => {
    const { value: newName } = await Swal.fire({
      title: 'แก้ไขชื่อหมวดหมู่',
      input: 'text',
      inputValue: catName,
      inputPlaceholder: 'ชื่อหมวดหมู่ใหม่...',
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#185FA5',
      customClass: { popup: 'rounded-3xl' },
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'กรุณากรอกชื่อหมวดหมู่';
        }
        if (value.trim() === catName) {
          return 'ชื่อหมวดหมู่ไม่ได้เปลี่ยนแปลง';
        }
      }
    });

    if (newName) {
      try {
        await axios.put(`/inventory/categories/${encodeURIComponent(catName)}`, { new_name: newName.trim() });
        Swal.fire({ icon: 'success', title: 'แก้ไขชื่อหมวดหมู่สำเร็จ', timer: 1000, showConfirmButton: false });
        fetchCategories();
        if (onCategoryUpdated) onCategoryUpdated();
      } catch (err) {
        Swal.fire('ข้อผิดพลาด', err.response?.data?.error || 'ไม่สามารถแก้ไขชื่อหมวดหมู่ได้', 'error');
      }
    }
  };

  const handleUploadImage = async (catName) => {
    const { value: file } = await Swal.fire({
      title: 'อัปโหลดรูปภาพหมวดหมู่',
      input: 'file',
      inputAttributes: {
        'accept': 'image/*',
        'aria-label': 'Upload your category image'
      },
      showCancelButton: true,
      confirmButtonText: 'อัปโหลด',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#185FA5',
      customClass: { popup: 'rounded-3xl' }
    });

    if (file) {
      try {
        Swal.fire({ title: 'กำลังอัปโหลด...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        const formData = new FormData();
        formData.append('image', file);
        const uploadRes = await axios.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const imageUrl = uploadRes.data.image_url;

        await axios.put(`/inventory/categories/${encodeURIComponent(catName)}/image`, { image_url: imageUrl });
        
        Swal.fire({ icon: 'success', title: 'อัปโหลดสำเร็จ', timer: 1000, showConfirmButton: false });
        fetchCategories();
        if (onCategoryUpdated) onCategoryUpdated();
      } catch (err) {
        console.error(err);
        Swal.fire('ข้อผิดพลาด', 'ไม่สามารถอัปโหลดรูปภาพได้', 'error');
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-[24px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 bg-gradient-to-r from-[#042C53] to-[#185FA5] text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <svg className="w-6 h-6 text-[#A3E635]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-bold font-prompt">จัดการหมวดหมู่สินค้า</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
          
          {/* Add Category Form */}
          <form onSubmit={handleAddCategory} className="mb-6 flex gap-3">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="ชื่อหมวดหมู่ใหม่..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#185FA5] focus:border-transparent outline-none transition-all shadow-sm font-prompt"
              />
            </div>
            <button
              type="submit"
              disabled={!newCategoryName.trim()}
              className="px-6 py-3 bg-[#A3E635] text-[#042C53] font-bold rounded-xl hover:bg-[#8bc92a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm font-prompt whitespace-nowrap"
            >
              เพิ่ม
            </button>
          </form>

          {/* Categories List */}
          <div className="space-y-3">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#185FA5]"></div>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center p-8 text-gray-500 font-prompt">
                ไม่มีข้อมูลหมวดหมู่
              </div>
            ) : (
              categories.map((cat) => (
                <div 
                  key={cat.name}
                  className="bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between shadow-sm hover:border-[#185FA5]/30 hover:shadow-md transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0 cursor-pointer flex items-center justify-center text-gray-400 group-hover:border-[#185FA5]/30 transition-colors"
                      onClick={() => handleUploadImage(cat.name)}
                      title="คลิกเพื่ออัปโหลดรูปภาพ"
                    >
                      {cat.image_url ? (
                        <img 
                          src={`${import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '') : ''}${cat.image_url}`} 
                          alt={cat.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <span className="font-bold text-[#1F2937] font-prompt">{cat.name}</span>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleEditCategoryName(cat.name)}
                      className="p-2 text-[#185FA5] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      title="แก้ไขชื่อหมวดหมู่"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteCategory(cat.name)}
                      className="p-2 text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                      title="ลบหมวดหมู่"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CategoryManagementModal;
