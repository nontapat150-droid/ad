import assert from 'node:assert/strict';
import test from 'node:test';
import { locationSourceLabel, makeActiveFilterChips } from './salesUiCopy.js';

test('locationSourceLabel explains where a customer coordinate came from', () => {
  assert.equal(locationSourceLabel('photo_exif'), 'เจอพิกัดในรูป');
  assert.equal(locationSourceLabel('current_gps'), 'ใช้ตำแหน่งฉัน');
  assert.equal(locationSourceLabel('map'), 'เลือกบนแผนที่');
  assert.equal(locationSourceLabel('manual'), 'ใส่พิกัดเอง');
  assert.equal(locationSourceLabel('unknown'), 'มีพิกัดแล้ว');
});

test('makeActiveFilterChips includes only filters the user has selected', () => {
  const chips = makeActiveFilterChips({
    search: 'สมชาย',
    status: 'survey',
    followUp: '',
    ownerName: 'นิด',
    dateFrom: '2026-10-01',
    dateTo: '2026-10-31',
    packageName: '',
    statusLabel: 'กำลังทำ',
    followUpLabel: '',
  });

  assert.deepEqual(chips, [
    { key: 'search', label: 'ค้นหา: สมชาย' },
    { key: 'status', label: 'สถานะ: กำลังทำ' },
    { key: 'owner', label: 'พนักงานขาย: นิด' },
    { key: 'date', label: 'วันสร้าง: 2026-10-01 ถึง 2026-10-31' },
  ]);
});
