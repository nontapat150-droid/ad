import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import axios from "../api/axios";

const shortMonths = [
  "ม.ค.",
  "ก.พ.",
  "มี.ค.",
  "เม.ย.",
  "พ.ค.",
  "มิ.ย.",
  "ก.ค.",
  "ส.ค.",
  "ก.ย.",
  "ต.ค.",
  "พ.ย.",
  "ธ.ค.",
];
const displayDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${shortMonths[month - 1]} ${year + 543}`;
};

export default function InventoryDispatchDetailsModal({ row, month, onClose }) {
  const dialog = useRef(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    axios
      .get("/inventory/monthly-summary", {
        params: {
          month,
          details: "1",
          user_id: row.user_id ?? "unknown",
          model_id: row.model_id,
        },
        signal: controller.signal,
      })
      .then((response) => setRecords(response.data))
      .catch((err) => {
        if (!controller.signal.aborted)
          setError(
            err.response?.data?.error || "โหลดรายละเอียดไม่สำเร็จ กรุณาลองใหม่",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [month, row.user_id, row.model_id, reload]);
  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      aria-labelledby="dispatch-details-title"
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-[#E5E7EB] bg-white p-0 text-[#1F2937] shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
    >
      <div className="flex items-start justify-between gap-3 border-b border-[#E5E7EB] p-5 dark:border-slate-700">
        <div>
          <h2
            id="dispatch-details-title"
            className="text-lg font-bold text-[#1F2937]"
          >
            รายละเอียดการเบิกแต่ละครั้ง
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            {row.product_name} • {row.model_name}
          </p>
          <p className="mt-1 text-sm text-[#6B7280]">
            ผู้เบิก: {row.user_name || `ผู้รับ #${row.user_id ?? "ไม่ระบุ"}`}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="ปิดรายละเอียดการเบิก"
          className="rounded-xl p-2 hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-lime-500 dark:hover:bg-slate-700"
        >
          <X size={20} />
        </button>
      </div>
      <div className="max-h-[55vh] overflow-auto p-5">
        {loading ? (
          <p role="status" className="py-8 text-center text-[#6B7280]">
            กำลังโหลดรายละเอียด...
          </p>
        ) : error ? (
          <div role="alert" className="text-red-600">
            {error}
            <button
              className="ml-2 underline"
              onClick={() => {
                setLoading(true);
                setError("");
                setReload((value) => value + 1);
              }}
            >
              ลองใหม่
            </button>
          </div>
        ) : records.length === 0 ? (
          <p className="py-8 text-center text-[#6B7280]">
            ไม่พบประวัติการเบิกในเดือนนี้
          </p>
        ) : (
          <>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-[#6B7280]">
                  <th scope="col" className="pb-3">
                    ครั้งที่
                  </th>
                  <th scope="col" className="pb-3">
                    วันที่เบิก
                  </th>
                  <th scope="col" className="pb-3 text-right">
                    จำนวนที่เบิก
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record, index) => (
                  <tr
                    key={record.id}
                    className="border-t border-[#E5E7EB] dark:border-slate-700"
                  >
                    <td className="py-3">{index + 1}</td>
                    <td className="py-3">
                      <span className="whitespace-nowrap">
                        {displayDate(record.dispatch_date)}
                      </span>
                      <span className="mt-1 block text-xs text-[#6B7280]">
                        {record.dispatch_time} น.
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold">
                      {record.quantity.toLocaleString("th-TH")}{" "}
                      {row.unit || "ชิ้น"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 flex justify-between rounded-xl bg-lime-50 p-3 text-sm font-bold text-lime-800 dark:bg-lime-950 dark:text-lime-200">
              <span>รวม {records.length.toLocaleString("th-TH")} ครั้ง</span>
              <span>
                {records
                  .reduce((sum, record) => sum + record.quantity, 0)
                  .toLocaleString("th-TH")}{" "}
                {row.unit || "ชิ้น"}
              </span>
            </div>
          </>
        )}
      </div>
      <div className="border-t border-[#E5E7EB] px-5 py-4 dark:border-slate-700">
        <p className="text-xs text-[#6B7280]">
          แต่ละครั้งอ้างอิงบันทึกการเบิกสินค้าในระบบ
        </p>
      </div>
    </dialog>
  );
}
