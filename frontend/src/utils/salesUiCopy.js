export function locationSourceLabel(source) {
  const labels = {
    photo_exif: 'เจอพิกัดในรูป',
    current_gps: 'ใช้ตำแหน่งฉัน',
    gps: 'ใช้ตำแหน่งฉัน',
    map: 'เลือกบนแผนที่',
    manual: 'ใส่พิกัดเอง',
  };
  return labels[source] || 'มีพิกัดแล้ว';
}

export function makeActiveFilterChips({
  search,
  status,
  followUp,
  ownerName,
  dateFrom,
  dateTo,
  packageName,
  statusLabel,
  followUpLabel,
}) {
  const chips = [];
  if (search) chips.push({ key: 'search', label: `ค้นหา: ${search}` });
  if (status) chips.push({ key: 'status', label: `สถานะ: ${statusLabel || status}` });
  if (followUp) chips.push({ key: 'follow-up', label: `นัดติดตาม: ${followUpLabel || followUp}` });
  if (ownerName) chips.push({ key: 'owner', label: `พนักงานขาย: ${ownerName}` });
  if (dateFrom || dateTo) {
    const range = dateFrom && dateTo
      ? `${dateFrom} ถึง ${dateTo}`
      : dateFrom
        ? `ตั้งแต่ ${dateFrom}`
        : `ถึง ${dateTo}`;
    chips.push({ key: 'date', label: `วันสร้าง: ${range}` });
  }
  if (packageName) chips.push({ key: 'package', label: `แพ็กเกจ: ${packageName}` });
  return chips;
}
