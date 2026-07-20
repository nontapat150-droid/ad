import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { AppDateField, AppTimeField } from './DispatchFilterFields';
import { friendlyJobError, PresetChips } from './dashboards/SharedComponents';
import { INCOMPLETE_REASON_PRESETS, POSTPONE_REASON_PRESETS } from '../constants/jobStatus';

// ── Sub-modal: เลือกอุปกรณ์ไม่มี SN (no-SN items) ──────────────────────────────
export function NoSnEquipmentModal({ isOpen, onClose, noSnItems, selectedNoSnItems, setSelectedNoSnItems }) {
  const [search, setSearch] = useState('');
  if (!isOpen) return null;

  const q = search.trim().toLowerCase();
  const filteredItems = q
    ? noSnItems.filter((item) =>
        `${item.product_name || ''} ${item.model_name || ''} ${item.sn || ''}`.toLowerCase().includes(q))
    : noSnItems;

  const handleToggle = (item) => {
    const maxQty = Number(item.quantity) || 0;
    if (maxQty < 1) return;
    setSelectedNoSnItems((prev) => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = { ...item, useQty: 1 };
      }
      return next;
    });
  };

  const handleQtyChange = (itemId, qty, maxQty) => {
    if (qty === '') {
      setSelectedNoSnItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], useQty: '' } }));
      return;
    }
    const num = parseInt(qty, 10);
    if (!isNaN(num)) {
      const val = Math.min(Math.max(num, 0), maxQty);
      setSelectedNoSnItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], useQty: val } }));
    }
  };

  const handleQtyBlur = (itemId, qty, maxQty) => {
    const num = parseInt(qty, 10);
    if (isNaN(num) || num < 1) {
      setSelectedNoSnItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], useQty: 1 } }));
    } else if (num > maxQty) {
      setSelectedNoSnItems((prev) => ({ ...prev, [itemId]: { ...prev[itemId], useQty: maxQty } }));
    }
  };

  const selectedCount = Object.keys(selectedNoSnItems).length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50">
          <div>
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              🔧 เลือกอุปกรณ์ติดตั้ง
            </h3>
            <p className="text-xs font-medium text-slate-500 mt-0.5">สินค้าที่นับจำนวน (ไม่มี Serial Number)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา สินค้า / รุ่น..."
              className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 bg-slate-50"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                ✕
              </button>
            )}
          </div>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-500 font-bold text-sm">
                {search ? 'ไม่พบอุปกรณ์ที่ตรงคำค้นหา' : 'ไม่มีอุปกรณ์ประเภทนับจำนวนในกระเป๋า'}
              </p>
              {!search && (
                <p className="text-xs text-slate-400 mt-1">อุปกรณ์ที่แสดงคือสินค้าที่ไม่มี SN เช่น สาย, สลักปลั๊ก ฯลฯ</p>
              )}
            </div>
          ) : (
            filteredItems.map((item) => {
              const maxQty = Number(item.quantity) || 0;
              const insufficient = maxQty < 1;
              const isSelected = !!selectedNoSnItems[item.id];
              const useQty = isSelected ? (parseInt(selectedNoSnItems[item.id].useQty, 10) || 0) : 0;
              const remaining = maxQty - useQty;
              const unit = item.unit || 'ชิ้น';

              return (
                <div
                  key={item.id}
                  className={`flex flex-col p-4 rounded-2xl border-2 transition-all ${
                    insufficient
                      ? 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                      : isSelected
                        ? 'border-blue-400 bg-blue-50/60 shadow-sm cursor-pointer'
                        : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/20 cursor-pointer'
                  }`}
                  onClick={() => !insufficient && handleToggle(item)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      insufficient
                        ? 'border-slate-200 bg-slate-100'
                        : isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'
                    }`}>
                      {isSelected && !insufficient && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 text-sm">{item.product_name}</div>
                      <div className="text-xs text-slate-500">
                        รุ่น: {item.model_name || '-'}
                        {insufficient && <span className="ml-2 text-red-500 font-bold">จำนวนไม่พอ</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white border border-slate-200 px-2 py-1.5">
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ก่อนใช้</p>
                      <p className="text-sm font-black text-slate-800">{maxQty} <span className="text-[10px] font-semibold text-slate-500">{unit}</span></p>
                    </div>
                    <div className={`rounded-xl border px-2 py-1.5 ${isSelected ? 'bg-blue-100 border-blue-300' : 'bg-white border-slate-200'}`}>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">ใช้</p>
                      <p className="text-sm font-black text-blue-700">{isSelected ? useQty : '—'}</p>
                    </div>
                    <div className={`rounded-xl border px-2 py-1.5 ${remaining < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">คงเหลือหลังใช้</p>
                      <p className={`text-sm font-black ${remaining < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                        {isSelected ? remaining : maxQty} <span className="text-[10px] font-semibold text-slate-500">{unit}</span>
                      </p>
                    </div>
                  </div>

                  {isSelected && !insufficient && (
                    <div
                      className="mt-3 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="text-xs font-bold text-blue-700 whitespace-nowrap">จำนวนที่ใช้:</label>
                      <input
                        type="number"
                        min="1"
                        max={maxQty}
                        value={selectedNoSnItems[item.id].useQty}
                        onChange={(e) => handleQtyChange(item.id, e.target.value, maxQty)}
                        onBlur={(e) => handleQtyBlur(item.id, e.target.value, maxQty)}
                        className="w-20 px-2 py-1.5 rounded-xl border-2 border-blue-300 focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 outline-none text-center font-bold text-sm"
                      />
                      <span className="text-xs font-semibold text-slate-500">/ {maxQty} {unit}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-600">
            เลือกแล้ว <span className="text-blue-600">{selectedCount}</span> รายการ
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl font-bold bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-sm text-sm"
          >
            ✅ ยืนยันการเลือก
          </button>
        </div>
      </div>
    </div>
  );
}

export function IncompleteJobModal({ isOpen, onClose, job, onSuccess, jobType }) {
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) setRemark('');
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remark.trim()) {
      Swal.fire({ icon: 'warning', title: 'กรุณาระบุสาเหตุ', text: 'แตะตัวเลือกด้านล่าง หรือพิมพ์เอง', confirmButtonColor: '#1F2937' });
      return;
    }

    try {
      setLoading(true);
      const endpoint = jobType === 'ma'
        ? `/dispatch/ma-jobs/${job.id}/incomplete`
        : `/dispatch/jobs/${job.id}/incomplete`;
      await api.put(endpoint, { remark });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      const friendly = friendlyJobError(err, 'เกิดข้อผิดพลาดในการบันทึกงานไม่จบ');
      Swal.fire({ icon: 'error', title: friendly.title, text: friendly.text, confirmButtonColor: '#1F2937' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass border border-white/50 rounded-3xl shadow-2xl p-6 flex flex-col">
        <h2 className="text-red-700 font-bold text-lg mb-4 flex items-center gap-2">
          <span className="text-2xl">❌</span> ไม่สำเร็จ: {job.access_no || job.non_number || job.display_non}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-red-800 mb-2">สาเหตุ / หมายเหตุ (บังคับ)</label>
            <PresetChips
              options={INCOMPLETE_REASON_PRESETS}
              value={remark}
              onPick={setRemark}
              className="mb-2"
            />
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl glass border border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-[#042C53] bg-red-50 resize-none h-28"
              placeholder="แตะตัวเลือกด้านบน หรือพิมพ์เอง" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-red-200 text-red-800 font-semibold hover:bg-red-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-red-500 to-red-600 text-white font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PostponeJobModal({ isOpen, onClose, job, onSuccess, jobType }) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRemark('');
      setNewDate('');
      setNewTime('');
    }
  }, [isOpen]);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDate) {
      Swal.fire({ icon: 'warning', title: 'กรุณาเลือกวันที่ต้องการเลื่อน', confirmButtonColor: '#1F2937' });
      return;
    }

    try {
      setLoading(true);
      const endpoint = jobType === 'ma'
        ? `/dispatch/ma-jobs/${job.id}/postpone`
        : `/dispatch/jobs/${job.id}/postpone`;
      await api.put(endpoint, { new_date: newDate, new_time: newTime, remark });
      onSuccess?.();
      onClose?.();
    } catch (err) {
      const friendly = friendlyJobError(err, 'เกิดข้อผิดพลาดในการเลื่อนนัด');
      Swal.fire({ icon: 'error', title: friendly.title, text: friendly.text, confirmButtonColor: '#1F2937' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass border border-white/50 rounded-3xl shadow-2xl p-6 flex flex-col">
        <h2 className="text-purple-800 font-bold text-lg mb-4 flex items-center gap-2">
          <span className="text-2xl">📅</span> ช่างนัดเวลาอีกครั้ง: {job.access_no || job.non_number || job.display_non}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <AppDateField
                label="วันนัดใหม่"
                value={newDate}
                onChange={setNewDate}
                allowClear={false}
              />
            </div>
            <div className="flex-1">
              <AppTimeField
                label="เวลานัดใหม่"
                value={newTime}
                onChange={setNewTime}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-purple-900 mb-1">หมายเหตุ (ถ้ามี)</label>
            <PresetChips
              options={POSTPONE_REASON_PRESETS}
              value={remark}
              onPick={setRemark}
              className="mb-2"
            />
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass border border-purple-300 focus:border-purple-500 outline-none text-[#042C53] bg-purple-50 resize-none h-20" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-purple-200 text-purple-800 font-semibold hover:bg-purple-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'บันทึกนัดใหม่'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
