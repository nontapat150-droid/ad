import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDispatchDate, parseDispatchDetails } from './inventoryDispatchDetails.js';

test('formats Thai Buddhist dates and safely handles missing or invalid dates', () => {
  assert.equal(formatDispatchDate('2026-07-12'), '12 ก.ค. 2569');
  for (const value of [undefined, null, '', 42, '2026-02-30', '2026-13-01']) {
    assert.equal(formatDispatchDate(value), 'ไม่ระบุวันที่');
  }
});
test('rejects old summary payloads instead of displaying them as details', () => {
  for (const data of [null, {}, [{ user_id: 1, quantity: 2, log_count: 1 }], [null]]) {
    assert.throws(() => parseDispatchDetails(data), /เซิร์ฟเวอร์ยังไม่พร้อม/);
  }
  assert.deepEqual(parseDispatchDetails([]), []);
  assert.equal(parseDispatchDetails([{ id: 1, quantity: '2', dispatch_date: null, dispatch_time: null }])[0].quantity, 2);
});
