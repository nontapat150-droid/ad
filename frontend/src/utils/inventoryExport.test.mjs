import assert from 'node:assert/strict';
import test from 'node:test';
import { buildInventoryExportSheets } from './inventoryExport.js';

test('buildInventoryExportSheets separates remaining, used, and technician equipment', () => {
  const sheets = buildInventoryExportSheets({
    in_stock: [{ id: 1, category: 'ONU', product_name: 'เราเตอร์', model_name: 'HG-1', sn: 'SN-01', quantity: 2, unit: 'ชิ้น', created_at: '2026-10-20T03:00:00.000Z' }],
    used: [{ id: 2, product_name: 'สาย', model_name: 'สาย 1 เมตร', sn: null, quantity: 5, unit: 'เส้น', used_by_name: 'ช่างเอ', used_at: '2026-10-20T04:00:00.000Z', note: 'ติดตั้งลูกค้า' }],
    with_technician: [{ id: 3, owner_name: 'ช่างบี', team_name: 'ทีมเหนือ', product_name: 'ONU', model_name: 'HG-1', sn: 'SN-02', quantity: 1, unit: 'ชิ้น', dispatched_at: '2026-10-20T05:00:00.000Z' }],
  });

  assert.deepEqual(sheets.map((sheet) => sheet.name), ['ยังมีในคลัง', 'ใช้แล้ว', 'อยู่กับช่าง']);
  assert.equal(sheets[0].rows[0]['สินค้า'], 'เราเตอร์');
  assert.equal(sheets[1].rows[0]['ผู้ใช้'], 'ช่างเอ');
  assert.equal(sheets[2].rows[0]['ช่าง'], 'ช่างบี');
});

test('buildInventoryExportSheets keeps every worksheet when there is no data', () => {
  const sheets = buildInventoryExportSheets({});

  assert.equal(sheets.length, 3);
  assert.deepEqual(sheets.map((sheet) => sheet.rows), [
    [{ ข้อความ: 'ไม่มีสินค้าในคลัง' }],
    [{ ข้อความ: 'ไม่มีรายการใช้แล้ว' }],
    [{ ข้อความ: 'ไม่มีอุปกรณ์ที่อยู่กับช่าง' }],
  ]);
});
