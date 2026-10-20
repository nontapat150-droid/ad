import { useCallback, useEffect, useState } from 'react';
import { Package, RefreshCw, Search, UserRound } from 'lucide-react';
import axios from '../api/axios';
import { groupEquipmentByHolder } from '../utils/inventoryEquipmentHolders';

const count = (value) => Number(value || 0).toLocaleString('th-TH');

export default function InventoryEquipmentHoldersPage() {
  const [holders, setHolders] = useState([]);
  const [sn, setSn] = useState('');
  const [snResults, setSnResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  const loadHolders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/inventory/equipment-holders');
      setHolders(Array.isArray(data?.holders) ? data.holders : []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'โหลดอุปกรณ์ของช่างไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { loadHolders(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadHolders]);

  const searchSn = async (event) => {
    event.preventDefault();
    const value = sn.trim();
    if (!value) {
      setSnResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await axios.get('/inventory/equipment-holders', { params: { sn: value } });
      setSnResults(Array.isArray(data?.sn_results) ? data.sn_results : []);
      setError('');
    } catch (err) {
      setSnResults([]);
      setError(err.response?.data?.error || 'ค้นหา SN ไม่สำเร็จ');
    } finally {
      setSearching(false);
    }
  };

  const groups = groupEquipmentByHolder(holders);
  const totalQuantity = groups.reduce((sum, group) => sum + group.quantity, 0);

  return (
    <section className="space-y-5 text-[#1F2937]">
      <div className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black"><UserRound className="text-lime-600" size={22} />อุปกรณ์กับช่าง</h2>
            <p className="mt-1 text-sm text-[#6B7280]">ดูว่าอุปกรณ์ที่เบิกแล้วยังอยู่กับช่างคนใด และมีจำนวนเท่าไร</p>
          </div>
          <button type="button" aria-label="อัปเดตข้อมูลอุปกรณ์" disabled={loading} onClick={loadHolders} className="min-h-11 self-start rounded-xl border border-[#E5E7EB] px-3 text-slate-600 hover:bg-lime-50 disabled:opacity-50">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        <form onSubmit={searchSn} className="mt-5 flex flex-col gap-2 sm:flex-row">
          <label className="sr-only" htmlFor="equipment-sn-search">ค้นหา SN</label>
          <div className="relative flex-1">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="equipment-sn-search" value={sn} onChange={(event) => setSn(event.target.value)} placeholder="ค้นหา SN เพื่อดูว่าอยู่กับช่างคนไหน" className="min-h-11 w-full rounded-xl border border-[#E5E7EB] bg-white py-2.5 pl-10 pr-3 text-sm font-semibold outline-none focus:border-lime-500 focus:ring-2 focus:ring-lime-500/20" />
          </div>
          <button type="submit" disabled={searching} className="min-h-11 rounded-xl bg-lime-400 px-5 text-sm font-black text-slate-900 hover:bg-lime-300 disabled:opacity-60">
            {searching ? 'กำลังค้นหา...' : 'ค้นหา SN'}
          </button>
          {sn && <button type="button" onClick={() => { setSn(''); setSnResults([]); }} className="min-h-11 rounded-xl border border-[#E5E7EB] px-4 text-sm font-bold text-slate-600">ล้าง</button>}
        </form>
      </div>

      {sn.trim() && !searching && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
          <p className="text-sm font-black text-sky-900">ผลค้นหา SN: {sn}</p>
          {snResults.length === 0 ? (
            <p className="mt-2 text-sm text-sky-800">ไม่พบ SN นี้ในอุปกรณ์ที่อยู่กับช่าง</p>
          ) : (
            <div className="mt-3 space-y-2">
              {snResults.map((item) => (
                <div key={item.id} className="rounded-xl border border-sky-200 bg-white px-3 py-3 text-sm">
                  <p className="font-black text-slate-800">{item.product_name} · {item.model_name}</p>
                  <p className="mt-1 text-slate-600">SN {item.sn} · อยู่กับ <strong>{item.owner_name}</strong>{item.team_name ? ` · ${item.team_name}` : ''}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4"><p className="text-xs text-slate-500">ช่างที่มีอุปกรณ์</p><p className="mt-1 text-2xl font-black">{count(groups.length)} คน</p></div>
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4"><p className="text-xs text-slate-500">อุปกรณ์ทั้งหมด</p><p className="mt-1 text-2xl font-black">{count(totalQuantity)} ชิ้น</p></div>
        <div className="col-span-2 rounded-2xl border border-[#E5E7EB] bg-white p-4 sm:col-span-1"><p className="text-xs text-slate-500">รายการสินค้า</p><p className="mt-1 text-2xl font-black">{count(holders.length)} รายการ</p></div>
      </div>

      {loading ? (
        <div role="status" className="py-14 text-center text-sm font-semibold text-slate-500">กำลังโหลดอุปกรณ์ของช่าง...</div>
      ) : groups.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#E5E7EB] p-12 text-center"><Package className="mx-auto mb-3 text-lime-600" /><p className="font-bold text-slate-700">ยังไม่มีอุปกรณ์ที่อยู่กับช่าง</p></div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <article key={group.ownerId} className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white">
              <div className="flex flex-col gap-2 border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="font-black text-slate-800">{group.ownerName}</h3><p className="mt-0.5 text-xs text-slate-500">{group.teamName}</p></div>
                <div className="flex gap-2 text-xs font-bold"><span className="rounded-full bg-lime-50 px-2.5 py-1 text-lime-800">{count(group.quantity)} ชิ้น</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">SN {count(group.snCount)}</span></div>
              </div>
              <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-5 py-3">สินค้า</th><th className="px-5 py-3">รุ่น</th><th className="px-5 py-3 text-right">จำนวน</th><th className="px-5 py-3 text-right">มี SN</th></tr></thead><tbody>{group.rows.map((row, index) => <tr key={`${row.product_name}-${row.model_name}-${index}`} className="border-t border-[#E5E7EB]"><td className="px-5 py-3 font-bold">{row.product_name}</td><td className="px-5 py-3 text-slate-600">{row.model_name}</td><td className="px-5 py-3 text-right font-black">{count(row.quantity)} <span className="text-xs font-normal">{row.unit || 'ชิ้น'}</span></td><td className="px-5 py-3 text-right">{count(row.sn_count)} ชิ้น</td></tr>)}</tbody></table></div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
