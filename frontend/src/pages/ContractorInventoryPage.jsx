import { useState, useEffect, useCallback, useMemo } from 'react';
import Layout from '../components/Layout';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { AppDateField, AppSelectField } from '../components/DispatchFilterFields';

function fmtDateTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function fmtDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function monthValue(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthValue(d);
}

function thaiMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
}

const ROLE_BADGE = {
  contractor_office: 'bg-amber-50 text-amber-700 border-amber-200',
  contractor_ma: 'bg-violet-50 text-violet-700 border-violet-200',
};

export default function ContractorInventoryPage() {
  const [data, setData] = useState({
    contractors: [],
    summary: { total_items: 0, total_jobs: 0, contractor_count: 0, total_qty: 0 },
    by_person: [],
    usages: [],
  });
  const [loading, setLoading] = useState(true);
  const [filterUserId, setFilterUserId] = useState('ALL');
  const [filterMode, setFilterMode] = useState('month'); // month | day | range
  const [month, setMonth] = useState(monthValue());
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = { user_id: filterUserId };
      if (filterMode === 'month') {
        params.month = month;
      } else if (filterMode === 'day') {
        params.start_date = day;
        params.end_date = day;
      } else {
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
      }
      const res = await api.get('/inventory/contractor-summary', { params });
      setData(res.data);
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: 'error',
        title: 'โหลดไม่สำเร็จ',
        text: err.response?.data?.error || 'ไม่สามารถโหลดสรุปอุปกรณ์รับเหมาได้',
        confirmButtonColor: '#1F2937',
      });
    } finally {
      setLoading(false);
    }
  }, [filterUserId, filterMode, month, day, startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const contractorOptions = useMemo(
    () => [
      { value: 'ALL', label: 'ทุกคน (รับเหมาทั้งหมด)' },
      ...(data.contractors || []).map((c) => ({
        value: String(c.id),
        label: `${c.full_name} · ${c.role_display}`,
      })),
    ],
    [data.contractors]
  );

  const filteredUsages = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.usages || [];
    return (data.usages || []).filter((u) =>
      [u.contractor_name, u.product_name, u.model_name, u.sn, u.access_no, u.customer, u.device_role]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [data.usages, search]);

  const periodLabel =
    filterMode === 'month'
      ? thaiMonthLabel(month)
      : filterMode === 'day'
        ? fmtDate(day)
        : `${startDate ? fmtDate(startDate) : '…'} – ${endDate ? fmtDate(endDate) : '…'}`;

  return (
    <Layout activeKey="contractor_inventory" pageTitle="สรุปอุปกรณ์รับเหมา">
      <div className="pb-12 space-y-5 animate-[fadeIn_0.35s_ease-out]">
        {/* Header */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
          <div className="h-1 bg-[#A3E635]" />
          <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1F2937] flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-[#1F2937] text-[#A3E635] flex items-center justify-center text-lg">🧰</span>
                สรุปอุปกรณ์รับเหมา
              </h1>
              <p className="text-sm text-[#6B7280] mt-1 font-medium">
                ดูอุปกรณ์ที่ช่างรับเหมาใช้ตอนจบงาน — รายคนหรือทั้งหมด ตามวันที่เลือก
              </p>
            </div>
            <button
              type="button"
              onClick={fetchSummary}
              className="self-start flex items-center gap-2 px-4 py-2.5 bg-[#F9FAFB] hover:bg-[#F3F4F6] text-[#4B5563] rounded-xl font-bold text-sm transition-all border border-[#E5E7EB] active:scale-95"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              รีเฟรช
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex p-1 bg-[#F9FAFB] border border-[#E5E7EB] rounded-2xl w-full sm:w-auto">
            {[
              { id: 'month', label: 'รายเดือน' },
              { id: 'day', label: 'รายวัน' },
              { id: 'range', label: 'ช่วงวันที่' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterMode(tab.id)}
                className={`flex-1 sm:flex-none px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                  filterMode === tab.id
                    ? 'bg-[#1F2937] text-[#A3E635] shadow-sm'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <AppSelectField
                label="ช่างรับเหมา"
                value={filterUserId}
                onChange={setFilterUserId}
                options={contractorOptions}
                allowClear={false}
                searchAlways
              />
            </div>

            {filterMode === 'month' && (
              <div>
                <label className="block text-[11px] font-bold text-[#6B7280] uppercase tracking-wide mb-1.5">
                  เดือน
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setMonth((m) => shiftMonth(m, -1))}
                    className="w-10 h-11 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] font-bold text-[#4B5563] hover:border-[#A3E635]"
                  >
                    ‹
                  </button>
                  <div className="flex-1 h-11 rounded-xl border border-[#E5E7EB] bg-white flex items-center justify-center text-sm font-black text-[#1F2937]">
                    {thaiMonthLabel(month)}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMonth((m) => shiftMonth(m, 1))}
                    className="w-10 h-11 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] font-bold text-[#4B5563] hover:border-[#A3E635]"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}

            {filterMode === 'day' && (
              <AppDateField
                label="วันที่"
                value={day}
                onChange={setDay}
                allowClear={false}
                showToday
              />
            )}

            {filterMode === 'range' && (
              <>
                <AppDateField label="ตั้งแต่" value={startDate} onChange={setStartDate} showToday />
                <AppDateField label="ถึง" value={endDate} onChange={setEndDate} showToday />
              </>
            )}
          </div>

          <p className="text-xs text-[#9CA3AF] font-medium">
            ช่วงที่ดู: <span className="text-[#1F2937] font-bold">{periodLabel}</span>
          </p>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'รายการใช้อุปกรณ์', value: data.summary?.total_items ?? 0, icon: '📦', tone: 'bg-[#F9FAFB] border-[#E5E7EB]' },
            { label: 'งานที่เกี่ยวข้อง', value: data.summary?.total_jobs ?? 0, icon: '🛠️', tone: 'bg-[#F9FAFB] border-[#E5E7EB]' },
            { label: 'จำนวนชิ้น (qty)', value: data.summary?.total_qty ?? 0, icon: '🔢', tone: 'bg-[#F9FAFB] border-[#E5E7EB]' },
            { label: 'รับเหมาที่มีการใช้', value: data.summary?.contractor_count ?? 0, icon: '👷', tone: 'bg-[#A3E635]/10 border-[#A3E635]/30' },
          ].map((m) => (
            <div key={m.label} className={`rounded-2xl sm:rounded-3xl border p-4 sm:p-5 ${m.tone}`}>
              <p className="text-[10px] sm:text-xs font-bold text-[#6B7280] uppercase tracking-wide mb-1">{m.icon} {m.label}</p>
              <p className="text-2xl sm:text-3xl font-black text-[#1F2937]">{loading ? '—' : m.value}</p>
            </div>
          ))}
        </div>

        {/* By person */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between gap-3">
            <h2 className="font-black text-[#1F2937] text-sm sm:text-base">สรุปรายคน</h2>
            <span className="text-[10px] font-bold text-[#9CA3AF]">{(data.by_person || []).length} คน</span>
          </div>
          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="w-10 h-10 border-[3px] border-[#A3E635]/30 border-t-[#A3E635] rounded-full animate-spin" />
            </div>
          ) : (data.by_person || []).length === 0 ? (
            <div className="p-10 text-center text-[#6B7280] text-sm">ยังไม่มีช่างรับเหมาในระบบ</div>
          ) : (
            <div className="divide-y divide-[#F3F4F6] max-h-[320px] overflow-y-auto">
              {(data.by_person || []).map((p) => (
                <button
                  key={p.user_id}
                  type="button"
                  onClick={() => {
                    setFilterUserId(String(p.user_id));
                    setSelectedPerson(p);
                  }}
                  className={`w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-[#F9FAFB] transition-colors ${
                    String(filterUserId) === String(p.user_id) ? 'bg-[#A3E635]/10' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1F2937] text-[#A3E635] flex items-center justify-center font-black text-sm shrink-0">
                    {(p.full_name || '?').charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#1F2937] text-sm truncate">{p.full_name}</p>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg border ${ROLE_BADGE[p.role] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {p.role_display}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                      ใช้ {p.item_count} รายการ · {p.job_count} งาน · คงเหลือในกระเป๋า {p.remaining_bag}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-black text-[#1F2937]">{p.item_count}</p>
                    <p className="text-[9px] font-bold text-[#9CA3AF]">รายการ</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {filterUserId !== 'ALL' && (
            <div className="px-4 py-3 border-t border-[#F3F4F6] bg-[#F9FAFB]">
              <button
                type="button"
                onClick={() => { setFilterUserId('ALL'); setSelectedPerson(null); }}
                className="text-xs font-bold text-[#1F2937] hover:text-[#84CC16]"
              >
                ← ดูทั้งหมดอีกครั้ง
              </button>
            </div>
          )}
        </div>

        {/* Usage list */}
        <div className="bg-white rounded-3xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#F3F4F6] bg-[#F9FAFB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-black text-[#1F2937] text-sm sm:text-base">รายการอุปกรณ์ที่ใช้จบงาน</h2>
              <p className="text-[11px] text-[#9CA3AF] mt-0.5">
                {selectedPerson?.full_name || (filterUserId === 'ALL' ? 'ทุกคน' : 'รายคน')} · {periodLabel}
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหาชื่อ, SN, Access No..."
                className="w-full pl-9 pr-3 h-10 rounded-xl border border-[#E5E7EB] bg-white text-sm outline-none focus:border-[#A3E635] focus:ring-2 focus:ring-[#A3E635]/20"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-10 flex justify-center">
              <div className="w-10 h-10 border-[3px] border-[#A3E635]/30 border-t-[#A3E635] rounded-full animate-spin" />
            </div>
          ) : filteredUsages.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#F9FAFB] border border-[#E5E7EB] flex items-center justify-center text-3xl">📭</div>
              <p className="font-bold text-[#1F2937]">ไม่พบการใช้อุปกรณ์</p>
              <p className="text-sm text-[#6B7280] mt-1">ลองเปลี่ยนช่วงวันที่หรือเลือกช่างอื่น</p>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-[#F3F4F6]">
                {filteredUsages.map((u) => (
                  <div key={u.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[#1F2937] text-sm truncate">{u.product_name || '-'}</p>
                        <p className="text-xs text-[#6B7280]">{u.model_name || '-'}</p>
                      </div>
                      <span className="text-[10px] font-black bg-[#1F2937] text-[#A3E635] px-2 py-0.5 rounded-lg shrink-0">
                        {u.device_role || '-'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#6B7280]">
                      <span className="font-bold text-[#1F2937]">{u.contractor_name}</span>
                      {u.sn && u.sn !== '-' && <span>SN: {u.sn}</span>}
                      <span>×{u.quantity}</span>
                    </div>
                    <div className="text-[11px] text-[#9CA3AF]">
                      {u.access_no ? `Access: ${u.access_no}` : 'ไม่ผูก Access'} · {fmtDateTime(u.used_at)}
                    </div>
                    {u.customer && <p className="text-[11px] text-[#6B7280] truncate">ลูกค้า: {u.customer}</p>}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] uppercase tracking-wider text-[#6B7280] bg-[#F9FAFB] font-bold">
                    <tr>
                      <th className="px-4 py-3">วันเวลา</th>
                      <th className="px-4 py-3">รับเหมา</th>
                      <th className="px-4 py-3">อุปกรณ์</th>
                      <th className="px-4 py-3">SN / บทบาท</th>
                      <th className="px-4 py-3">งาน</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {filteredUsages.map((u) => (
                      <tr key={u.id} className="hover:bg-[#F9FAFB]/80">
                        <td className="px-4 py-3 text-xs text-[#6B7280] whitespace-nowrap">{fmtDateTime(u.used_at)}</td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#1F2937] text-xs">{u.contractor_name}</p>
                          <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${ROLE_BADGE[u.contractor_role] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {u.role_display}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#1F2937] text-xs">{u.product_name || '-'}</p>
                          <p className="text-[11px] text-[#9CA3AF]">{u.model_name || '-'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-black bg-[#1F2937] text-[#A3E635] px-2 py-0.5 rounded-lg">{u.device_role || '-'}</span>
                          {u.sn && u.sn !== '-' && (
                            <p className="text-[11px] font-mono text-[#4B5563] mt-1">{u.sn}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-bold text-[#1F2937]">{u.access_no || '-'}</p>
                          <p className="text-[11px] text-[#9CA3AF] truncate max-w-[160px]">{u.customer || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-right font-black text-[#1F2937]">{u.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
