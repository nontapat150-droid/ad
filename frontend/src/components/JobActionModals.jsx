import { useState, useEffect } from 'react';
import api from '../api/axios';
import Swal from 'sweetalert2';
import { FilterSelectField, AppDateField, AppTimeField } from './DispatchFilterFields';

const BAG_DEVICE_SLOTS = [
  { role: 'SOA', label: 'อุปกรณ์ปิด SOA', dashOption: false },
  { role: 'ONU', label: 'SN ONU', dashOption: true },
  { role: 'PB', label: 'SN Playbox', dashOption: false },
  { role: 'Mesh', label: 'SN Mesh', dashOption: false },
  { role: 'SIM', label: 'SN Sim', dashOption: false },
  { role: 'Cam', label: 'SN IP Camera', dashOption: false },
];

const ROLE_INSTALL_PREFIX = {
  SOA: 'SOA', ONU: 'ONU', PB: 'PB', Mesh: 'Mesh', SIM: 'SIM', Cam: 'Cam',
};

function bagItemLabel(item) {
  return `${item.product_name} — ${item.model_name} [SN: ${item.sn}]`;
}

function BagDeviceSelect({ role, label, value, onChange, bagItems, usedElsewhere, dashOption }) {
  const available = bagItems.filter(
    (item) => String(item.id) === String(value) || !usedElsewhere.has(item.id)
  );

  const options = available.map((item) => ({
    value: String(item.id),
    label: bagItemLabel(item),
  }));

  if (dashOption) {
    options.unshift({ value: 'dash', label: 'ไม่มี (-)' });
  }

  return (
    <FilterSelectField
      label={label}
      value={value}
      onChange={(v) => onChange(role, v)}
      options={options}
      placeholder="เลือกจากกระเป๋าช่าง"
      searchable
      searchAlways
      icon={
        <svg className="w-3.5 h-3.5 text-[#65a30d]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      }
    />
  );
}

// ── Sub-modal: เลือกอุปกรณ์ไม่มี SN (no-SN items) ──────────────────────────────
export function NoSnEquipmentModal({ isOpen, onClose, noSnItems, selectedNoSnItems, setSelectedNoSnItems }) {
  if (!isOpen) return null;

  const handleToggle = (item) => {
    setSelectedNoSnItems(prev => {
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
      setSelectedNoSnItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], useQty: '' } }));
      return;
    }
    const num = parseInt(qty, 10);
    if (!isNaN(num)) {
      const val = Math.min(num, maxQty);
      setSelectedNoSnItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], useQty: val } }));
    }
  };

  const handleQtyBlur = (itemId, qty) => {
    const num = parseInt(qty, 10);
    if (isNaN(num) || num < 1) {
      setSelectedNoSnItems(prev => ({ ...prev, [itemId]: { ...prev[itemId], useQty: 1 } }));
    }
  };

  const selectedCount = Object.keys(selectedNoSnItems).length;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-200">
        {/* Header */}
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

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {noSnItems.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <p className="text-slate-500 font-bold text-sm">ไม่มีอุปกรณ์ประเภทนับจำนวนในกระเป๋า</p>
              <p className="text-xs text-slate-400 mt-1">อุปกรณ์ที่แสดงคือสินค้าที่ไม่มี SN เช่น สาย, สลักปลั๊ก ฯลฯ</p>
            </div>
          ) : (
            noSnItems.map(item => {
              const isSelected = !!selectedNoSnItems[item.id];
              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    isSelected ? 'border-blue-400 bg-blue-50/60 shadow-sm' : 'border-slate-200 hover:border-blue-200 hover:bg-blue-50/20'
                  }`}
                  onClick={() => handleToggle(item)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'border-slate-300'
                    }`}>
                      {isSelected && (
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">{item.product_name}</div>
                      <div className="text-xs text-slate-500">
                        รุ่น: {item.model_name || '-'} · คงเหลือ: <span className="font-bold text-slate-700">{item.quantity}</span> {item.unit || 'ชิ้น'}
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div
                      className="mt-3 sm:mt-0 flex items-center gap-2 sm:ml-4"
                      onClick={e => e.stopPropagation()}
                    >
                      <label className="text-xs font-bold text-blue-700 whitespace-nowrap">จำนวนที่ใช้:</label>
                      <input
                        type="number"
                        min="1"
                        max={item.quantity}
                        value={selectedNoSnItems[item.id].useQty}
                        onChange={e => handleQtyChange(item.id, e.target.value, item.quantity)}
                        onBlur={e => handleQtyBlur(item.id, e.target.value)}
                        className="w-20 px-2 py-1.5 rounded-xl border-2 border-blue-300 focus:ring-2 focus:ring-blue-400/30 focus:border-blue-500 outline-none text-center font-bold text-sm"
                      />
                      <span className="text-xs font-semibold text-slate-500">/ {item.quantity}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
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

export function CompleteJobModal({ isOpen, onClose, job, onSuccess }) {
  const [images, setImages] = useState([]);
  const [remark, setRemark] = useState('');
  
  // Base Fields
  const [installDate, setInstallDate] = useState('');
  const [accessNo, setAccessNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [mainPackage, setMainPackage] = useState('');
  
  // Detailed Device Fields — SN from tech bag only
  const [bagItems, setBagItems] = useState([]);
  const [bagLoading, setBagLoading] = useState(false);
  const [bagSelections, setBagSelections] = useState({
    SOA: '', ONU: '', PB: '', Mesh: '', SIM: '', Cam: '',
  });
  const [splitNo, setSplitNo] = useState('');
  const [portNo, setPortNo] = useState('');
  const [l3Name, setL3Name] = useState('');
  const [cableLength, setCableLength] = useState('');
  const [refId3bb, setRefId3bb] = useState('');
  const [scBlue, setScBlue] = useState('');

  // No-SN Equipment (ใช้อุปกรณ์ติดตั้ง)
  const [noSnItems, setNoSnItems] = useState([]);
  const [selectedNoSnItems, setSelectedNoSnItems] = useState({});
  const [showNoSnModal, setShowNoSnModal] = useState(false);

  // Entry Fee Fields
  const [entryFeeStatus, setEntryFeeStatus] = useState('none'); // 'none', 'slip', 'cash', 'backdate'
  const [entryFeeSlip, setEntryFeeSlip] = useState(null);
  const [entryFeeBackdate, setEntryFeeBackdate] = useState(''); // YYYY-MM-DD for backdate mode

  const [imagePreviews, setImagePreviews] = useState([]);
  const [entryFeeSlipPreview, setEntryFeeSlipPreview] = useState(null);

  const [loading, setLoading] = useState(false);
  const [showSummaryPopup, setShowSummaryPopup] = useState(false);
  const [summaryData, setSummaryData] = useState(null);

  useEffect(() => {
    if (isOpen && job) {
      setInstallDate(new Date().toLocaleDateString('en-CA'));
      setAccessNo(job.access_no || '');
      setCustomerName(job.customer || '');
      setMainPackage(job.package || '');
      setImages([]);
      setRemark('');
      setBagSelections({ SOA: '', ONU: '', PB: '', Mesh: '', SIM: '', Cam: '' });
      setSplitNo(''); setPortNo(''); setL3Name(''); setCableLength(''); setRefId3bb(''); setScBlue('');
      setEntryFeeStatus('none'); setEntryFeeSlip(null); setEntryFeeBackdate('');
      imagePreviews.forEach(url => URL.revokeObjectURL(url));
      if (entryFeeSlipPreview) URL.revokeObjectURL(entryFeeSlipPreview);
      setImagePreviews([]);
      setEntryFeeSlipPreview(null);

      setSelectedNoSnItems({});
      setShowNoSnModal(false);

      setBagLoading(true);
      api.get('/inventory/my-bag')
        .then((res) => {
          const all = res.data || [];
          // has_sn items → SN selector dropdowns
          const snItems = all.filter((item) => item.has_sn !== 0 && item.has_sn !== false);
          // no-SN items → use equipment popup
          const noSn = all.filter((item) => item.has_sn === 0 || item.has_sn === false);
          setBagItems(snItems);
          setNoSnItems(noSn);
        })
        .catch(() => { setBagItems([]); setNoSnItems([]); })
        .finally(() => setBagLoading(false));
    }
  }, [isOpen, job]);

  const handleBagSelection = (role, value) => {
    setBagSelections((prev) => ({ ...prev, [role]: value }));
  };

  const getUsedItemIds = (excludeRole) => {
    const ids = new Set();
    Object.entries(bagSelections).forEach(([r, val]) => {
      if (r !== excludeRole && val && val !== 'dash') ids.add(parseInt(val, 10));
    });
    return ids;
  };

  const buildDeviceDetailsFromBag = () => {
    const parts = [];
    BAG_DEVICE_SLOTS.forEach(({ role }) => {
      const sel = bagSelections[role];
      if (!sel) return;
      const prefix = ROLE_INSTALL_PREFIX[role];
      if (sel === 'dash') {
        parts.push(`${prefix}:-`);
        return;
      }
      const item = bagItems.find((b) => String(b.id) === String(sel));
      if (!item) return;
      const val = role === 'SOA'
        ? `${item.product_name} ${item.model_name}`.trim()
        : item.sn;
      parts.push(`${prefix}:${val}`);
    });
    return parts;
  };

  const handleImagesChange = (e) => {
    const files = Array.from(e.target.files);
    setImages(files);
    imagePreviews.forEach(url => URL.revokeObjectURL(url));
    setImagePreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleEntryFeeSlipChange = (e) => {
    const file = e.target.files[0];
    setEntryFeeSlip(file);
    if (entryFeeSlipPreview) URL.revokeObjectURL(entryFeeSlipPreview);
    if (file) setEntryFeeSlipPreview(URL.createObjectURL(file));
    else setEntryFeeSlipPreview(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) {
      alert('กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป (สูงสุด 40 รูป)');
      return;
    }
    if (images.length > 40) {
      alert('อัปโหลดรูปภาพได้สูงสุด 40 รูป');
      return;
    }
    if ((entryFeeStatus === 'slip' || entryFeeStatus === 'backdate') && !entryFeeSlip) {
      alert('กรุณาแนบรูปสลิปค่าแรกเข้า');
      return;
    }
    if (entryFeeStatus === 'backdate' && !entryFeeBackdate) {
      alert('กรุณาเลือกวันที่ย้อนหลัง');
      return;
    }

    const usedIds = Object.values(bagSelections).filter((v) => v && v !== 'dash');
    if (new Set(usedIds).size !== usedIds.length) {
      alert('เลือกอุปกรณ์ซ้ำกัน กรุณาเลือกคนละชิ้น');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('remark', remark);
      formData.append('installDate', installDate);
      formData.append('accessNo', accessNo);
      formData.append('customerName', customerName);
      formData.append('mainPackage', mainPackage);

      const usedInventory = BAG_DEVICE_SLOTS
        .filter(({ role }) => bagSelections[role] && bagSelections[role] !== 'dash')
        .map(({ role }) => ({
          inventory_item_id: parseInt(bagSelections[role], 10),
          device_role: role,
        }));

      // No-SN items selected from UseEquipment popup
      const noSnPayload = Object.values(selectedNoSnItems).map(i => ({
        item_id: i.id,
        quantity: parseInt(i.useQty, 10) || 1,
        product_name: i.product_name,
        model_name: i.model_name || '',
        unit: i.unit || 'ชิ้น',
      }));

      const manualParts = [
        splitNo ? `Sp:${splitNo}` : null,
        portNo ? `Pt:${portNo}` : null,
        l3Name ? `L3:${l3Name}` : null,
        cableLength ? `สาย:${cableLength}M` : null,
        refId3bb ? `3BB:${refId3bb}` : null,
        scBlue ? `SCฟ้า:${scBlue}` : null,
      ].filter(Boolean);

      // Build no-SN summary into device details
      const noSnParts = noSnPayload.map(i => `${i.product_name} ${i.model_name} x${i.quantity} ${i.unit}`.trim());
      const deviceDetails = [...buildDeviceDetailsFromBag(), ...manualParts, ...noSnParts].join(' | ');

      formData.append('installDevice', deviceDetails);
      formData.append('usedInventory', JSON.stringify(usedInventory));
      formData.append('noSnItems', JSON.stringify(noSnPayload));
      formData.append('splitNo', splitNo);
      formData.append('portNo', portNo);
      formData.append('l3Name', l3Name);
      formData.append('cableLength', cableLength);
      formData.append('refId3bb', refId3bb);
      formData.append('scBlue', scBlue);

      formData.append('entryFeeStatus', entryFeeStatus);
      if ((entryFeeStatus === 'slip' || entryFeeStatus === 'backdate') && entryFeeSlip) {
        formData.append('entryFeeSlip', entryFeeSlip);
      }
      if (entryFeeStatus === 'backdate' && entryFeeBackdate) {
        formData.append('entryFeeBackdate', entryFeeBackdate);
      }

      for (let i = 0; i < images.length; i++) {
        formData.append('images', images[i]);
      }

      await api.put(`/dispatch/jobs/${job.id}/complete`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      // Build summary for popup
      const getDeviceVal = (role) => {
        const sel = bagSelections[role];
        if (sel === 'dash') return '-';
        if (sel) {
          const item = bagItems.find(b => String(b.id) === String(sel));
          if (item) return role === 'SOA' ? `${item.product_name} ${item.model_name}`.trim() : item.sn;
        }
        return '-';
      };

      const entryFeeText = entryFeeStatus === 'slip' ? 'โอนเงิน (แนบสลิป)' :
                           entryFeeStatus === 'cash' ? 'รับเงินสดหน้างาน' :
                           entryFeeStatus === 'backdate' ? `โอนเงินย้อนหลัง (${entryFeeBackdate})` : '-';

      const summaryText = [
        `วันที่ติดตั้ง (Plan Date): ${installDate || '-'}`,
        `เลข (NON): ${accessNo || '-'}`,
        `แพ็กเกจ: ${mainPackage || '-'}`,
        `Order No: ${job.order_no || '-'}`,
        `SOA: -`,
        `อุปกรณ์ปิด SOA: ${getDeviceVal('SOA')}`,
        `Splitt: ${splitNo || '-'}`,
        `ใช้ Port: ${portNo || '-'}`,
        `ระยะสายจริง(M): ${cableLength || '-'}`,
        `SN Playbox: ${getDeviceVal('PB')}`,
        `SN ONU: ${getDeviceVal('ONU')}`,
        `SN IP camera: ${getDeviceVal('Cam')}`,
        `Ref ID 3BB: ${refId3bb || '-'}`,
        `ตัวต่อscสีฟ้า: ${scBlue || '-'}`,
        `ค่าแรกเข้า: ${entryFeeText}`,
        `หมายเหตุ: ${remark || '-'}`
      ].join('\n');

      setSummaryData({ text: summaryText });
      setShowSummaryPopup(true);
      // onSuccess called after user closes popup
    } catch (err) {
      console.error(err);
      
      // ดึงข้อความ Error มาแสดงผล
      const status = err.response?.status || 'Unknown';
      let errorMsg = err.response?.data?.details || err.response?.data?.error || err.message || 'เกิดข้อผิดพลาดในการจบงาน';
      
      // แสดง Popup ด้วย SweetAlert2
      Swal.fire({
        icon: 'error',
        title: `บันทึกไม่สำเร็จ (รหัส: ${status})`,
        text: errorMsg,
        confirmButtonText: 'ตกลง'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !job) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl glass border border-white/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 overflow-y-auto">
          <h2 className="text-[#042C53] font-bold text-lg mb-4 flex items-center gap-2 sticky top-0 bg-white/90 p-2 rounded-xl backdrop-blur-sm shadow-sm z-10">
            <span className="text-2xl">✅</span> จบงาน: {job.access_no}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Base Info Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
              <h3 className="md:col-span-2 text-sm font-bold text-[#185FA5] mb-1">ข้อมูลพื้นฐาน</h3>
              <div>
                <AppDateField
                  label="วันที่ติดตั้ง (ห้ามย้อนหลัง)"
                  value={installDate}
                  onChange={setInstallDate}
                  min={new Date().toLocaleDateString('en-CA')}
                  allowClear={false}
                  showToday
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#042C53] mb-1">ปิดเคสงาน (NON)</label>
                <input type="text" readOnly value={accessNo}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none text-gray-500 bg-gray-100 text-sm cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#042C53] mb-1">ชื่อ-นามสกุล ลูกค้า</label>
                <input type="text" readOnly value={customerName}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none text-gray-500 bg-gray-100 text-sm cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#042C53] mb-1">แพ็กเกจหลัก</label>
                <input type="text" readOnly value={mainPackage}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 outline-none text-gray-500 bg-gray-100 text-sm cursor-not-allowed" />
              </div>
            </div>

            {/* Detailed Device Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
              <div className="md:col-span-2 flex items-center justify-between mb-1">
                <h3 className="text-sm font-bold text-[#185FA5]">รายละเอียดอุปกรณ์ติดตั้ง (เลือกจากกระเป๋าช่าง)</h3>
                <button
                  type="button"
                  onClick={() => setShowNoSnModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-all shadow-sm"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  ใช้อุปกรณ์ติดตั้ง
                  {Object.keys(selectedNoSnItems).length > 0 && (
                    <span className="ml-1 bg-white text-blue-600 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-black">
                      {Object.keys(selectedNoSnItems).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Summary of selected no-SN items */}
              {Object.keys(selectedNoSnItems).length > 0 && (
                <div className="md:col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-200 mb-1">
                  <p className="text-xs font-bold text-blue-700 mb-1.5">🔧 อุปกรณ์ที่เลือก:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.values(selectedNoSnItems).map(item => (
                      <span key={item.id} className="inline-flex items-center gap-1 px-2.5 py-1 bg-white rounded-lg border border-blue-200 text-xs font-semibold text-blue-800">
                        {item.product_name} {item.model_name} × {item.useQty} {item.unit || 'ชิ้น'}
                        <button
                          type="button"
                          onClick={() => setSelectedNoSnItems(prev => { const n = {...prev}; delete n[item.id]; return n; })}
                          className="ml-0.5 text-blue-400 hover:text-red-500 transition-colors"
                        >✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {bagLoading ? (
                <p className="md:col-span-2 text-sm text-gray-500">กำลังโหลดกระเป๋าช่าง...</p>
              ) : bagItems.length === 0 ? (
                <p className="md:col-span-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  ไม่มีอุปกรณ์ SN ในกระเป๋า — กรุณาเบิกอุปกรณ์ก่อนจบงาน
                </p>
              ) : null}
              {BAG_DEVICE_SLOTS.map(({ role, label, dashOption }) => (
                <BagDeviceSelect
                  key={role}
                  role={role}
                  label={label}
                  value={bagSelections[role]}
                  onChange={handleBagSelection}
                  bagItems={bagItems}
                  usedElsewhere={getUsedItemIds(role)}
                  dashOption={dashOption}
                />
              ))}
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">Splitt <span className="text-red-500">*</span></label><input type="text" required value={splitNo} onChange={(e) => setSplitNo(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">ใช้ Port <span className="text-red-500">*</span></label><input type="text" required value={portNo} onChange={(e) => setPortNo(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">ใช้ #L3(ชื่อ)</label><input type="text" value={l3Name} onChange={(e) => setL3Name(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">ระยะสายจริง(M) <span className="text-red-500">*</span></label><input type="number" step="0.1" required value={cableLength} onChange={(e) => setCableLength(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">Ref ID 3BB</label><input type="text" value={refId3bb} onChange={(e) => setRefId3bb(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
              <div><label className="block text-xs font-semibold text-[#042C53] mb-1">ตัวต่อ sc สีฟ้า</label><input type="text" value={scBlue} onChange={(e) => setScBlue(e.target.value)} className="w-full px-3 py-2 rounded-xl glass border border-white/60 text-sm" /></div>
            </div>

            {/* Entry Fee Section */}
            <div className="p-4 bg-gradient-to-br from-[#A3E635]/20 to-[#A3E635]/5 rounded-2xl border border-[#A3E635]/40 shadow-sm">
              <h3 className="text-sm font-bold text-[#4D7C0F] mb-3 flex items-center gap-2">
                <span>💰</span> ค่าแรกเข้า
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <button 
                  type="button" 
                  onClick={() => setEntryFeeStatus('none')} 
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${entryFeeStatus === 'none' ? 'border-[#84CC16] bg-white shadow-md text-[#4D7C0F] scale-105' : 'border-white/60 bg-white/40 text-[#042C53] hover:border-[#84CC16]/50 hover:bg-white/60'}`}
                >
                  <span className="text-xl drop-shadow-sm">🚫</span>
                  <span className="text-[11px] font-bold">ไม่มี</span>
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setEntryFeeStatus('slip')} 
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${entryFeeStatus === 'slip' ? 'border-[#84CC16] bg-white shadow-md text-[#4D7C0F] scale-105' : 'border-white/60 bg-white/40 text-[#042C53] hover:border-[#84CC16]/50 hover:bg-white/60'}`}
                >
                  <span className="text-xl drop-shadow-sm">💳</span>
                  <span className="text-[11px] font-bold text-center">แนบสลิป</span>
                </button>
                
                <button 
                  type="button" 
                  onClick={() => setEntryFeeStatus('cash')} 
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${entryFeeStatus === 'cash' ? 'border-[#84CC16] bg-white shadow-md text-[#4D7C0F] scale-105' : 'border-white/60 bg-white/40 text-[#042C53] hover:border-[#84CC16]/50 hover:bg-white/60'}`}
                >
                  <span className="text-xl drop-shadow-sm">💵</span>
                  <span className="text-[11px] font-bold text-center">รับหน้างาน</span>
                </button>

                <button 
                  type="button" 
                  onClick={() => setEntryFeeStatus('backdate')} 
                  className={`p-3 rounded-xl border-2 flex flex-col items-center justify-center gap-1.5 transition-all ${entryFeeStatus === 'backdate' ? 'border-purple-400 bg-white shadow-md text-purple-700 scale-105' : 'border-white/60 bg-white/40 text-[#042C53] hover:border-purple-300 hover:bg-white/60'}`}
                >
                  <span className="text-xl drop-shadow-sm">📅</span>
                  <span className="text-[11px] font-bold text-center">ย้อนหลัง</span>
                </button>
              </div>
              
              {/* Slip upload — shown for 'slip' and 'backdate' */}
              {(entryFeeStatus === 'slip' || entryFeeStatus === 'backdate') && (
                <div className="animate-fade-in-up mt-4 p-3 bg-white/60 rounded-xl border border-white/80">
                  <label className="block text-xs font-semibold text-[#042C53] mb-2 flex items-center gap-2">
                    <span className="text-blue-500">📎</span> อัปโหลดสลิปค่าแรกเข้า <span className="text-red-500">*</span>
                  </label>
                  <div className="relative mt-2 group cursor-pointer">
                    <input type="file" accept="image/*" onChange={handleEntryFeeSlipChange} 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                    <div className={`flex flex-col items-center justify-center p-4 border-2 border-dashed rounded-xl transition-all bg-white/50 ${entryFeeSlipPreview ? 'border-[#84CC16] bg-[#84CC16]/10' : 'border-[#378ADD]/50 hover:border-[#378ADD] hover:bg-[#378ADD]/5'}`}>
                      {entryFeeSlipPreview ? (
                        <img src={entryFeeSlipPreview} alt="Slip Preview" className="h-32 object-contain rounded-lg shadow-sm" />
                      ) : (
                        <>
                          <span className="text-3xl mb-2">📸</span>
                          <span className="text-sm font-semibold text-[#185FA5]">คลิกเพื่ออัปโหลดสลิป</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Backdate date picker — shown only for 'backdate' */}
              {entryFeeStatus === 'backdate' && (
                <div className="animate-fade-in-up mt-3 p-3 bg-purple-50/80 rounded-xl border border-purple-200">
                  <AppDateField
                    label="เลือกวันที่ย้อนหลัง"
                    value={entryFeeBackdate}
                    onChange={setEntryFeeBackdate}
                    max={new Date().toLocaleDateString('en-CA')}
                    allowClear={false}
                    showToday={false}
                  />
                  <p className="text-[10px] text-purple-500 mt-1.5 font-medium">⚠️ รายการนี้จะแสดงเป็น "ย้อนหลัง" ในประวัติ</p>
                </div>
              )}
            </div>

            {/* Images and Remark */}
            <div className="grid grid-cols-1 gap-3 p-4 bg-white/40 rounded-2xl border border-white/50">
              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">รูปภาพหลักฐานปิดงาน <span className="text-red-500">*</span> (สูงสุด 40 รูป)</label>
                <div className="relative mt-2 group cursor-pointer">
                  <input type="file" multiple accept="image/*" onChange={handleImagesChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-[#378ADD]/50 rounded-xl bg-white/50 hover:bg-[#378ADD]/5 hover:border-[#378ADD] transition-all">
                    <span className="text-4xl mb-2">🖼️</span>
                    <span className="text-sm font-semibold text-[#185FA5]">คลิกเพื่ออัปโหลด หรือลากไฟล์มาวาง</span>
                    <span className="text-xs text-gray-500 mt-1">สามารถเลือกได้สูงสุด 40 รูป</span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">รองรับไฟล์รูปภาพเท่านั้น</p>
                  <p className="text-xs text-[#185FA5] font-bold">{images.length}/40 รูป</p>
                </div>
                {imagePreviews.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3 p-2 bg-white/30 rounded-xl border border-white/50 max-h-40 overflow-y-auto">
                    {imagePreviews.map((url, i) => (
                      <img key={i} src={url} alt={`Preview ${i}`} className="h-16 w-16 object-cover rounded-lg shadow-sm border border-white" />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-[#042C53] mb-1">หมายเหตุ (ถ้ามี)</label>
                <textarea value={remark} onChange={(e) => setRemark(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl glass border border-white/60 focus:border-[#378ADD] outline-none text-[#042C53] bg-white/50 resize-none h-16 text-sm" />
              </div>
            </div>

            <div className="flex gap-3 mt-2 sticky bottom-0 bg-white/90 p-3 -mx-2 -mb-2 rounded-xl backdrop-blur-sm z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] border-t border-white/50">
              <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-[#378ADD]/30 text-[#042C53] font-semibold hover:bg-white/50 transition-colors">
                ยกเลิก
              </button>
              <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-400 to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex justify-center items-center">
                {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'ยืนยันจบงาน'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* No-SN Equipment Picker Sub-Modal */}
      <NoSnEquipmentModal
        isOpen={showNoSnModal}
        onClose={() => setShowNoSnModal(false)}
        noSnItems={noSnItems}
        selectedNoSnItems={selectedNoSnItems}
        setSelectedNoSnItems={setSelectedNoSnItems}
      />

      {/* Post-Complete Summary Popup */}
      {showSummaryPopup && summaryData && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-[#042C53]/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-emerald-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <span className="text-2xl">✅</span> ปิดงานสำเร็จ!
              </h3>
              <p className="text-emerald-100 text-sm mt-0.5">คัดลอกข้อมูลเพื่อส่งให้ลูกค้าหรือทีม</p>
            </div>
            {/* Summary text box */}
            <div className="p-5">
              <pre
                id="completion-summary-text"
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 text-sm text-[#374151] font-mono whitespace-pre-wrap break-words select-all"
              >{summaryData.text}</pre>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(summaryData.text);
                    } catch(e) {
                      const el = document.getElementById('completion-summary-text');
                      const range = document.createRange();
                      range.selectNode(el);
                      window.getSelection().removeAllRanges();
                      window.getSelection().addRange(range);
                      document.execCommand('copy');
                    }
                    // Show brief success feedback
                    Swal.fire({ icon: 'success', title: 'คัดลอกแล้ว!', showConfirmButton: false, timer: 1000, position: 'top-end', toast: true });
                  }}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all flex justify-center items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>
                  📋 คัดลอกทั้งหมด
                </button>
                <button
                  onClick={() => {
                    setShowSummaryPopup(false);
                    setSummaryData(null);
                    onSuccess();
                    onClose();
                  }}
                  className="flex-1 py-3 rounded-xl border border-[#E5E7EB] text-[#374151] font-semibold hover:bg-[#F9FAFB] transition-colors"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function IncompleteJobModal({ isOpen, onClose, job, onSuccess }) {
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!remark.trim()) {
      alert('กรุณากรอกหมายเหตุ');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/dispatch/jobs/${job.id}/incomplete`, { remark });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการบันทึกงานไม่จบ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass border border-white/50 rounded-3xl shadow-2xl p-6 flex flex-col">
        <h2 className="text-red-700 font-bold text-lg mb-4 flex items-center gap-2">
          <span className="text-2xl">❌</span> ไม่สำเร็จ: {job.access_no}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-semibold text-red-800 mb-1">สาเหตุ / หมายเหตุ (บังคับ)</label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)} required
              className="w-full px-4 py-2.5 rounded-xl glass border border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-200 outline-none text-[#042C53] bg-red-50 resize-none h-28" />
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

export function PostponeJobModal({ isOpen, onClose, job, onSuccess }) {
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [remark, setRemark] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !job) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newDate) {
      alert('กรุณาเลือกวันที่ต้องการเลื่อน');
      return;
    }

    try {
      setLoading(true);
      await api.put(`/dispatch/jobs/${job.id}/postpone`, { new_date: newDate, new_time: newTime, remark });
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'เกิดข้อผิดพลาดในการเลื่อนนัด');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-[#042C53]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md glass border border-white/50 rounded-3xl shadow-2xl p-6 flex flex-col">
        <h2 className="text-purple-800 font-bold text-lg mb-4 flex items-center gap-2">
          <span className="text-2xl">📅</span> เลื่อนนัด: {job.access_no}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <AppDateField
                label="วันที่ต้องการเลื่อนนัด"
                value={newDate}
                onChange={setNewDate}
                allowClear={false}
              />
            </div>
            <div className="flex-1">
              <AppTimeField
                label="เวลา (ไม่บังคับ)"
                value={newTime}
                onChange={setNewTime}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-purple-900 mb-1">หมายเหตุ (ถ้ามี)</label>
            <textarea value={remark} onChange={(e) => setRemark(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl glass border border-purple-300 focus:border-purple-500 outline-none text-[#042C53] bg-purple-50 resize-none h-20" />
          </div>
          <div className="flex gap-3 mt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-purple-200 text-purple-800 font-semibold hover:bg-purple-50 transition-colors">
              ยกเลิก
            </button>
            <button type="submit" disabled={loading} className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all flex justify-center items-center">
              {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : 'บันทึก'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
