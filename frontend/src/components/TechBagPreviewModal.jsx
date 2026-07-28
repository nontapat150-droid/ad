import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

function isSnItem(item) {
  return Number(item?.has_sn) === 1 || item?.has_sn === true;
}

/**
 * Read-only bag preview popup for dispatch / complete flows.
 * Supports user_id and/or team_id without leaving the current page.
 */
export default function TechBagPreviewModal({
  isOpen,
  onClose,
  userId = null,
  teamId = null,
  title = 'กระเป๋าช่าง',
  subtitle = '',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | sn | nosn

  useEffect(() => {
    if (!isOpen) return;
    setSearch('');
    setFilter('all');
    setError(null);

    const params = new URLSearchParams();
    if (teamId) params.set('team_id', String(teamId));
    else if (userId) params.set('user_id', String(userId));

    setLoading(true);
    api.get(`/inventory/my-bag?${params.toString()}`)
      .then((res) => setItems(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        setItems([]);
        setError(err.response?.data?.error || 'โหลดกระเป๋าไม่สำเร็จ');
      })
      .finally(() => setLoading(false));
  }, [isOpen, userId, teamId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const sn = isSnItem(item);
      if (filter === 'sn' && !sn) return false;
      if (filter === 'nosn' && sn) return false;
      if (!q) return true;
      const hay = [
        item.product_name,
        item.model_name,
        item.sn,
        item.owner_name,
        item.unit,
        ...(Array.isArray(item.holders) ? item.holders.map((h) => h.owner_name) : []),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, filter]);

  const snCount = items.filter(isSnItem).length;
  const noSnCount = items.length - snCount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-teal-50 to-cyan-50 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              🎒 {title}
            </h3>
            {subtitle && <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            <p className="text-[11px] text-slate-400 mt-1">
              ทั้งหมด {items.length} · มี SN {snCount} · นับจำนวน {noSnCount}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-5 pt-4 pb-2 space-y-3">
          <div className="relative">
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหา สินค้า / รุ่น / SN / ผู้ถือ..."
              className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 bg-slate-50"
              autoFocus
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                ✕
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {[
              { key: 'all', label: 'ทั้งหมด' },
              { key: 'sn', label: 'มี SN' },
              { key: 'nosn', label: 'นับจำนวน' },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setFilter(opt.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  filter === opt.key
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <span className="ml-auto self-center text-[11px] font-bold text-slate-400">
              แสดง {filtered.length} รายการ
            </span>
          </div>
        </div>

        <div className="px-5 pb-5 overflow-y-auto flex-1 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500">กำลังโหลดกระเป๋า...</div>
          ) : error ? (
            <div className="py-8 text-center text-sm font-bold text-red-600 bg-red-50 rounded-2xl border border-red-100">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-sm font-bold text-slate-500">
                {search || filter !== 'all' ? 'ไม่พบสินค้าตามคำค้นหา' : 'ไม่มีสินค้าในกระเป๋า'}
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const sn = isSnItem(item);
              const qty = Number(item.quantity) || 0;
              return (
                <div
                  key={`${item.id}-${item.model_id}-${item.sn || ''}`}
                  className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-teal-200 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-800 text-sm">{item.product_name || 'สินค้า'}</p>
                        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                          sn ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {sn ? 'มี SN' : 'นับจำนวน'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        รุ่น: {item.model_name || '-'}
                        {sn && item.sn ? ` · SN: ${item.sn}` : ''}
                      </p>
                      {item.is_team_pooled && Array.isArray(item.holders) && item.holders.length > 0 && (
                        <p className="text-[11px] text-slate-400 mt-1">
                          ผู้ถือ: {item.holders.map((h) => `${h.owner_name} ${Number(h.quantity).toLocaleString()}`).join(', ')}
                        </p>
                      )}
                      {!item.is_team_pooled && item.owner_name && (
                        <p className="text-[11px] text-slate-400 mt-1">ผู้ถือ: {item.owner_name}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-black text-teal-700">{qty.toLocaleString()}</p>
                      <p className="text-[10px] font-bold text-slate-400">{item.unit || 'ชิ้น'}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-900"
          >
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
