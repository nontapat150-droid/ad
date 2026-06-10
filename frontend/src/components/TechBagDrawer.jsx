import { useState, useEffect } from 'react';
import api from '../api/axios';

export default function TechBagDrawer({ open, onClose }) {
  const [items, setItems] = useState({ consumables: [], equipments: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      api.get('/inventory/bag')
        .then((r) => setItems(r.data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [open]);

  return (
    <div className={`fixed inset-0 z-50 flex justify-end transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} 
        onClick={onClose} 
      />
      
      {/* Drawer Panel */}
      <div className={`relative w-full max-w-md h-full glass border-l border-white/50 shadow-2xl flex flex-col transition-transform duration-300 cubic-bezier(0.34, 1.56, 0.64, 1) ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="p-5 border-b border-white/30 flex items-center justify-between ">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-xl shadow-md shadow-[#185FA5]/20 text-white">
              🎒
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#042C53]">กระเป๋าช่าง</h2>
              <p className="text-xs text-[#378ADD] mt-0.5">รายการอุปกรณ์ที่เบิกมาใช้งาน</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg glass hover:glass border border-white/50 flex items-center justify-center text-[#378ADD] opacity-80 hover:text-[#185FA5] transition-colors shadow-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[1,2,3].map((i) => <div key={i} className="skeleton h-20 w-full" />)}
            </div>
          ) : (
            <>
              {/* Consumables Section */}
              <section>
                <h3 className="text-sm font-bold text-[#042C53] mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-brand-500" /> วัสดุสิ้นเปลือง
                </h3>
                {items.consumables.length === 0 ? (
                  <EmptyState text="ไม่มีวัสดุสิ้นเปลืองในกระเป๋า" />
                ) : (
                  <div className="space-y-2.5">
                    {items.consumables.map((item) => (
                      <div key={item.id} className="p-3.5 rounded-xl glass border border-white/50 flex items-center justify-between hover:border-brand-300 hover:shadow-sm transition-all">
                        <div>
                          <p className="text-sm font-bold text-[#042C53]">{item.item_name}</p>
                          <p className="text-xs text-[#378ADD] mt-0.5">รหัส: {item.item_code}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-[#185FA5] leading-none">{item.qty}</p>
                          <p className="text-[10px] font-semibold text-[#378ADD] mt-1 uppercase tracking-wider">{item.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Equipments Section */}
              <section>
                <h3 className="text-sm font-bold text-[#042C53] mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-4 rounded-full bg-indigo-500" /> อุปกรณ์ / เครื่องมือ (SN)
                </h3>
                {items.equipments.length === 0 ? (
                  <EmptyState text="ไม่มีอุปกรณ์ในกระเป๋า" />
                ) : (
                  <div className="space-y-2.5">
                    {items.equipments.map((item) => (
                      <div key={item.id} className="p-3.5 rounded-xl glass border border-white/50 flex items-center justify-between hover:border-indigo-300 hover:shadow-sm transition-all">
                        <div>
                          <p className="text-sm font-bold text-[#042C53]">{item.item_name}</p>
                          <p className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 inline-block mt-1.5">
                            SN: {item.serial_no}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center ">
      <p className="text-[#378ADD] text-sm">{text}</p>
    </div>
  );
}
