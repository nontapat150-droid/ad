import { useEffect, useState } from "react";
import InventoryDispatchDetailsModal from "../components/InventoryDispatchDetailsModal";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Package,
  RefreshCw,
} from "lucide-react";
import axios from "../api/axios";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../components/ui/popover";

const months = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];
const currentMonth = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).format(new Date());
const control =
  "flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-bold text-[#1F2937] hover:border-lime-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";
const popup =
  "border-[#E5E7EB] bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

function FilterSelect({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <span className="mb-2 block text-xs font-bold text-[#6B7280] dark:text-slate-400">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className={control} aria-label={label}>
            <span className="truncate">
              {options.find((option) => option.value === value)?.label}
            </span>
            <ChevronDown size={16} className="shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={`${popup} max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto p-1.5`}
        >
          <div role="group" aria-label={label}>
            {options.map((option) => (
              <button
                key={option.value}
                aria-pressed={value === option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`block w-full rounded-lg px-3 py-2.5 text-left text-sm focus-visible:ring-2 focus-visible:ring-lime-500 ${value === option.value ? "bg-lime-100 font-bold text-lime-900 dark:bg-lime-900 dark:text-lime-100" : "hover:bg-slate-100 dark:hover:bg-slate-700"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function MonthPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const choose = (month) => {
    onChange(month);
    setOpen(false);
  };
  return (
    <div>
      <span className="mb-2 block text-xs font-bold text-[#6B7280] dark:text-slate-400">
        เดือนที่เบิก
      </span>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) setYear(Number(value.slice(0, 4)));
        }}
      >
        <PopoverTrigger asChild>
          <button className={control} aria-label="เลือกเดือนที่เบิก">
            <CalendarDays size={18} className="text-lime-600" />
            <span className="flex-1 text-left">
              {months[Number(value.slice(5)) - 1]}{" "}
              {Number(value.slice(0, 4)) + 543}
            </span>
            <ChevronDown size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className={`${popup} w-72 p-3`}>
          <div className="mb-3 flex items-center justify-between">
            <button
              aria-label="ปีก่อนหน้า"
              disabled={year <= 2000}
              onClick={() => setYear(year - 1)}
              className="rounded-lg p-2 hover:bg-lime-100 disabled:opacity-30 dark:hover:bg-slate-700"
            >
              <ChevronLeft size={20} />
            </button>
            <strong>พ.ศ. {year + 543}</strong>
            <button
              aria-label="ปีถัดไป"
              disabled={year >= 2099}
              onClick={() => setYear(year + 1)}
              className="rounded-lg p-2 hover:bg-lime-100 disabled:opacity-30 dark:hover:bg-slate-700"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {months.map((name, index) => {
              const month = `${year}-${String(index + 1).padStart(2, "0")}`;
              return (
                <button
                  key={name}
                  aria-pressed={month === value}
                  onClick={() => choose(month)}
                  className={`rounded-lg px-1 py-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-lime-500 ${month === value ? "bg-lime-400 text-slate-900" : "hover:bg-lime-50 dark:hover:bg-slate-700"}`}
                >
                  {name}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => choose(currentMonth())}
            className="mt-3 w-full rounded-lg border border-lime-300 py-2 text-sm font-bold text-lime-700 dark:text-lime-300"
          >
            เดือนนี้
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function InventoryMonthlySummaryPage() {
  const [selectedRow, setSelectedRow] = useState(null);
  const [month, setMonth] = useState(currentMonth);
  const [category, setCategory] = useState("all");
  const [groupBy, setGroupBy] = useState("person");
  const [recipient, setRecipient] = useState("all");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    axios
      .get("/inventory/monthly-summary", {
        params: { month },
        signal: controller.signal,
      })
      .then((response) => {
        setRows(response.data);
        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setRows([]);
          setError(
            err.response?.data?.error || "โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, reload]);
  const categories = [...new Set(rows.map((row) => row.category))].sort(
    (a, b) => a.localeCompare(b, "th"),
  );
  const groupId = (row) =>
    String(
      groupBy === "person"
        ? (row.user_id ?? "unknown")
        : (row.team_id ?? "unknown"),
    );
  const groupName = (row) =>
    groupBy === "person"
      ? row.user_name || `ผู้รับ #${row.user_id ?? "ไม่ระบุ"}`
      : row.team_name || "ไม่ระบุทีม";
  const recipients = [
    ...new Map(rows.map((row) => [groupId(row), groupName(row)])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "th"));
  const filtered = rows.filter(
    (row) =>
      (category === "all" || row.category === category) &&
      (recipient === "all" || groupId(row) === recipient),
  );
  const groups = new Map();
  filtered.forEach((row) => {
    const id = groupId(row);
    if (!groups.has(id)) groups.set(id, { name: groupName(row), rows: [] });
    groups.get(id).rows.push(row);
  });
  const changeMonth = (value) => {
    if (value !== month) {
      setLoading(true);
      setError("");
      setRows([]);
      setMonth(value);
      setCategory("all");
      setRecipient("all");
    }
  };
  return (
    <section className="space-y-5 text-[#1F2937] dark:text-slate-100">
      <div className="rounded-3xl border border-[#E5E7EB] bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-[#1F2937]">
              <Package className="text-lime-600" size={22} />
              สรุปการเบิกรายเดือน
            </h2>
            <p className="mt-1 text-sm text-[#6B7280] dark:text-slate-400">
              ดูว่าใครเบิกสินค้าอะไร จำนวนเท่าไร ในเดือนที่เลือก
            </p>
          </div>
          <button
            aria-label="อัปเดตข้อมูล"
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setError("");
              setReload((value) => value + 1);
            }}
            className="rounded-xl border border-[#E5E7EB] p-3 hover:bg-lime-50 disabled:opacity-40 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MonthPicker value={month} onChange={changeMonth} />
          <FilterSelect
            label="ประเภทสินค้า"
            value={category}
            onChange={setCategory}
            options={[
              { value: "all", label: "ทุกประเภท" },
              ...categories.map((value) => ({ value, label: value })),
            ]}
          />
          <FilterSelect
            label="รูปแบบสรุป"
            value={groupBy}
            onChange={(value) => {
              setGroupBy(value);
              setRecipient("all");
            }}
            options={[
              { value: "person", label: "แยกรายคน" },
              { value: "team", label: "แยกรายทีม" },
            ]}
          />
          <FilterSelect
            label={groupBy === "person" ? "ผู้เบิก" : "ทีม"}
            value={recipient}
            onChange={setRecipient}
            options={[
              {
                value: "all",
                label: groupBy === "person" ? "ทุกคน" : "ทุกทีม",
              },
              ...recipients.map(([value, label]) => ({ value, label })),
            ]}
          />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-[#6B7280] dark:text-slate-400">
          นับเฉพาะรายการเบิกจากคลังตามวันที่บันทึก ไม่รวมโอนย้ายและไม่หักยอดคืน
          • การจัดทีมอ้างอิงทีมปัจจุบันของผู้รับ
        </p>
      </div>
      {loading ? (
        <div role="status" className="py-16 text-center text-sm">
          กำลังโหลดสรุปการเบิก...
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl bg-red-50 p-6 text-red-700">
          {error}
          <button
            className="ml-3 underline"
            onClick={() => {
              setLoading(true);
              setReload((value) => value + 1);
            }}
          >
            ลองใหม่
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              [groupBy === "person" ? "ผู้เบิก" : "ทีมที่เบิก", groups.size],
              [
                "ประเภทที่แสดง",
                new Set(filtered.map((row) => row.category)).size,
              ],
              [
                "รายการเบิก",
                filtered.reduce((sum, row) => sum + row.log_count, 0),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-[#E5E7EB] bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-black text-[#1F2937]">
                  {value.toLocaleString("th-TH")}
                </p>
              </div>
            ))}
          </div>
          {groups.size === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#E5E7EB] p-12 text-center">
              <Package className="mx-auto mb-3 text-lime-600" />
              <h3 className="font-bold text-[#1F2937]">ไม่พบรายการเบิก</h3>
              <p className="mt-2 text-sm text-[#6B7280] dark:text-slate-400">
                ลองเลือกเดือน ประเภทสินค้า หรือผู้เบิกอื่น
              </p>
            </div>
          ) : (
            [...groups.entries()].map(([id, group]) => (
              <article
                key={id}
                className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                <div className="border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4 dark:border-slate-700 dark:bg-slate-800">
                  <h3 className="font-black text-[#1F2937]">{group.name}</h3>
                  <p className="mt-1 text-xs text-[#6B7280] dark:text-slate-400">
                    {group.rows
                      .reduce((sum, row) => sum + row.log_count, 0)
                      .toLocaleString("th-TH")}{" "}
                    รายการเบิก
                    {groupBy === "person"
                      ? ` • ${group.rows[0].team_name || "ไม่ระบุทีม"}`
                      : ` • ${new Set(group.rows.map((row) => row.user_id)).size} คน`}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] text-left text-sm">
                    <thead className="text-xs text-[#6B7280] dark:text-slate-400">
                      <tr>
                        {[
                          ...(groupBy === "team" ? ["ผู้เบิก"] : []),
                          "ประเภท",
                          "สินค้า / รุ่น",
                          "จำนวนที่เบิก",
                          "จำนวนครั้ง",
                        ].map((label) => (
                          <th key={label} scope="col" className="px-5 py-3">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row, index) => (
                        <tr
                          key={index}
                          className="border-t border-[#E5E7EB] dark:border-slate-700"
                        >
                          {groupBy === "team" && (
                            <td className="px-5 py-4">
                              {row.user_name ||
                                `ผู้รับ #${row.user_id ?? "ไม่ระบุ"}`}
                            </td>
                          )}
                          <td className="px-5 py-4">
                            <span className="rounded-lg bg-lime-50 px-2 py-1 text-xs font-semibold text-lime-800 dark:bg-lime-950 dark:text-lime-200">
                              {row.category}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-bold text-[#1F2937]">
                              {row.product_name}
                            </p>
                            <p className="text-xs text-[#6B7280] dark:text-slate-400">
                              {row.model_name}
                            </p>
                          </td>
                          <td className="px-5 py-4 font-bold tabular-nums">
                            {row.quantity.toLocaleString("th-TH")}{" "}
                            <span className="text-xs font-normal">
                              {row.unit || "ชิ้น"}
                            </span>
                          </td>
                          <td className="px-5 py-4 tabular-nums">
                            <button
                              onClick={() => setSelectedRow(row)}
                              aria-label={`ดูรายละเอียด ${row.log_count} ครั้งของ ${row.product_name} ${row.model_name} ผู้เบิก ${row.user_name || row.user_id || "ไม่ระบุ"}`}
                              className="min-h-11 rounded-xl border border-lime-300 bg-lime-50 px-3 py-2 font-bold text-lime-700 underline decoration-dotted underline-offset-4 hover:bg-lime-100 focus-visible:ring-2 focus-visible:ring-lime-500 dark:bg-lime-950 dark:text-lime-200"
                            >
                              {row.log_count.toLocaleString("th-TH")} ครั้ง
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </article>
            ))
          )}
        </>
      )}
      {selectedRow && (
        <InventoryDispatchDetailsModal
          row={selectedRow}
          month={month}
          onClose={() => setSelectedRow(null)}
        />
      )}
    </section>
  );
}
