import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function UseEquipmentModal({ isOpen, onClose, bagItems, onUsageComplete, initialSelectedItem, selectedUserId }) {
  const [step, setStep] = useState(1);
  const [selectedItems, setSelectedItems] = useState({});
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchJob, setSearchJob] = useState('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (initialSelectedItem) {
        setSelectedItems({
          [initialSelectedItem.id]: { ...initialSelectedItem, useQty: initialSelectedItem.has_sn ? 1 : 1 }
        });
      } else {
        setSelectedItems({});
      }
      setSelectedJobId(null);
      setSearchJob('');
    }
  }, [isOpen, initialSelectedItem]);

  const handleToggleItem = (item) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[item.id]) {
        delete next[item.id];
      } else {
        next[item.id] = { ...item, useQty: item.has_sn ? 1 : 1 };
      }
      return next;
    });
  };

  const handleQtyChange = (itemId, qty, maxQty) => {
    const val = parseInt(qty) || 1;
    if (val < 1) return;
    if (val > maxQty) return;
    
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], useQty: val }
    }));
  };

  const fetchJobs = async () => {
    try {
      setIsLoading(true);
      const res = await axios.get(`/dispatch/jobs${selectedUserId ? `?user_id=${selectedUserId}` : ''}`);
      const data = res.data;
      // Filter only NON jobs that are not completed
      const nonJobs = data.filter(j => j.access_no && j.access_no.startsWith('NON') && j.status !== 'completed');
      setJobs(nonJobs);
    } catch (err) {
      console.error('Failed to fetch jobs', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextStep = () => {
    if (Object.keys(selectedItems).length === 0) {
      alert('กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ');
      return;
    }
    setStep(2);
    fetchJobs();
  };

  const handleSubmit = async () => {
    if (!selectedJobId) {
      alert('กรุณาเลือกงาน (NON) ที่ต้องการใช้อุปกรณ์');
      return;
    }

    const itemsPayload = Object.values(selectedItems).map(i => ({
      item_id: i.id,
      quantity: i.useQty
    }));

    try {
      setIsLoading(true);
      const res = await axios.post('/inventory/use-equipment', {
        job_id: selectedJobId,
        items: itemsPayload
      });

      if (res.status === 200) {
        alert('บันทึกการใช้งานอุปกรณ์และปิดงานสำเร็จ!');
        onUsageComplete();
        onClose();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
      alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div>
            <h3 className="text-xl font-black text-slate-800">
              {step === 1 ? 'เลือกอุปกรณ์ที่ต้องการใช้งาน' : 'เลือกงานที่ต้องการใช้ (NON)'}
            </h3>
            <p className="text-sm font-medium text-slate-500 mt-1">
              {step === 1 ? 'เลือกอุปกรณ์จากกระเป๋าช่างของคุณ' : 'ผูกอุปกรณ์เข้ากับงานเพื่อดำเนินการปิดงานทันที'}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 1 && (
            <div className="space-y-3">
              {bagItems.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-500 font-bold">ไม่มีอุปกรณ์ในกระเป๋า</p>
                </div>
              ) : (
                bagItems.map(item => {
                  const isSelected = !!selectedItems[item.id];
                  return (
                    <div 
                      key={item.id} 
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all ${
                        isSelected ? 'border-brand-500 bg-brand-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <button 
                          onClick={() => handleToggleItem(item)}
                          className={`mt-1 flex-shrink-0 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                            isSelected ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-300 hover:border-brand-400'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <div>
                          <div className="font-bold text-slate-800">{item.product_name}</div>
                          <div className="text-xs font-semibold text-slate-500 mt-0.5">
                            โมเดล: {item.model_name || '-'}
                            {item.has_sn ? <span className="ml-2 px-1.5 py-0.5 bg-slate-100 rounded text-slate-600 border border-slate-200">SN: {item.serial_number}</span> : null}
                          </div>
                        </div>
                      </div>

                      {isSelected && !item.has_sn && (
                        <div className="mt-3 sm:mt-0 flex items-center gap-3 pl-10 sm:pl-0">
                          <label className="text-sm font-bold text-slate-600">จำนวน:</label>
                          <input
                            type="number"
                            min="1"
                            max={item.quantity}
                            value={selectedItems[item.id].useQty}
                            onChange={(e) => handleQtyChange(item.id, e.target.value, item.quantity)}
                            className="w-20 px-3 py-1.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none text-center font-bold"
                          />
                          <span className="text-xs font-bold text-slate-500">/ {item.quantity}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <input
                type="text"
                placeholder="ค้นหาชื่องาน หรือ เลข NON..."
                value={searchJob}
                onChange={e => setSearchJob(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 outline-none transition-all font-medium text-sm"
              />

              {isLoading ? (
                <div className="flex justify-center items-center py-10">
                  <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <p className="text-slate-500 font-bold">ไม่พบงาน NON ที่สามารถใช้งานได้</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-300">
                  {jobs.filter(j => 
                    (j.access_no || '').toLowerCase().includes(searchJob.toLowerCase()) || 
                    (j.customer_name || '').toLowerCase().includes(searchJob.toLowerCase())
                  ).map(job => (
                    <div 
                      key={job.id}
                      onClick={() => setSelectedJobId(job.id)}
                      className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-center justify-between ${
                        selectedJobId === job.id ? 'border-brand-500 bg-brand-50 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="font-black text-slate-800 text-base">{job.access_no}</div>
                        <div className="text-sm font-semibold text-slate-600 mt-0.5">{job.customer_name || 'ไม่ระบุชื่อลูกค้า'}</div>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                        selectedJobId === job.id ? 'border-brand-500 bg-brand-500' : 'border-slate-300'
                      }`}>
                        {selectedJobId === job.id && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between rounded-b-3xl">
          {step === 1 ? (
            <div className="flex-1" />
          ) : (
            <button
              onClick={() => setStep(1)}
              className="px-5 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
            >
              กลับ
            </button>
          )}

          {step === 1 ? (
            <button
              onClick={handleNextStep}
              disabled={Object.keys(selectedItems).length === 0}
              className="px-6 py-2.5 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
            >
              ต่อไป
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!selectedJobId || isLoading}
              className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
              ยืนยันการใช้งานและปิดงาน
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
