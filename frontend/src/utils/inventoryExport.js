function thaiDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function rowsOrEmpty(rows, message) {
  return rows.length > 0 ? rows : [{ ข้อความ: message }];
}

export function buildInventoryExportSheets(data = {}) {
  const inStock = (data.in_stock || []).map((item) => ({
    'รหัสรายการ': item.id,
    'หมวดหมู่': item.category || 'ไม่ระบุ',
    'สินค้า': item.product_name || '-',
    'รุ่น': item.model_name || '-',
    'SN / รหัส': item.sn || '-',
    'จำนวน': Number(item.quantity) || 0,
    'หน่วย': item.unit || 'ชิ้น',
    'วันที่รับเข้า': thaiDateTime(item.created_at),
  }));
  const used = (data.used || []).map((item) => ({
    'รหัสประวัติ': item.id,
    'วันที่ใช้': thaiDateTime(item.used_at),
    'สินค้า': item.product_name || '-',
    'รุ่น': item.model_name || '-',
    'SN / รหัส': item.sn || '-',
    'จำนวนที่ใช้': Number(item.quantity) || 0,
    'หน่วย': item.unit || 'ชิ้น',
    'ผู้ใช้': item.used_by_name || 'ไม่ระบุ',
    'หมายเหตุ': item.note || '-',
  }));
  const withTechnician = (data.with_technician || []).map((item) => ({
    'รหัสรายการ': item.id,
    'ช่าง': item.owner_name || 'ไม่ระบุผู้ถือ',
    'ทีม': item.team_name || '-',
    'สินค้า': item.product_name || '-',
    'รุ่น': item.model_name || '-',
    'SN / รหัส': item.sn || '-',
    'จำนวน': Number(item.quantity) || 0,
    'หน่วย': item.unit || 'ชิ้น',
    'วันที่เบิก': thaiDateTime(item.dispatched_at),
  }));

  return [
    { name: 'ยังมีในคลัง', rows: rowsOrEmpty(inStock, 'ไม่มีสินค้าในคลัง') },
    { name: 'ใช้แล้ว', rows: rowsOrEmpty(used, 'ไม่มีรายการใช้แล้ว') },
    { name: 'อยู่กับช่าง', rows: rowsOrEmpty(withTechnician, 'ไม่มีอุปกรณ์ที่อยู่กับช่าง') },
  ];
}
