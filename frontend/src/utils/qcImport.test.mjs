import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { parseQualitySheet } from './qcImport.js';

function parse(blocks) {
  const headers = ['Register Date', 'Access Number', 'Customer Name', 'แพคเกจ'];
  const values = ['01/01/2026', 'TEST00001', 'ลูกค้าทดสอบ', 'Internet'];
  for (const [status, date] of blocks) {
    headers.push('CM สถานะ', 'วันที่เปลี่ยนสถานะจริง');
    values.push(status, date);
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([headers, values]), 'QC');
  return parseQualitySheet(workbook, 'QC').rows[0];
}

test('import selects newest actual date even if an older status is farther right', () => {
  const row = parse([['Active', '20/06/2026'], ['Terminate', '01/03/2026']]);
  assert.equal(row.qc_status, 'Active');
  assert.equal(row.status_changed_at, '2026-06-20');
});

test('status and date come from the same block, not two independent latest cells', () => {
  const row = parse([['Suspend - Debt', '20/06/2026'], ['Terminate', '']]);
  assert.equal(row.qc_status, 'Suspend - Debt');
  assert.equal(row.status_changed_at, '2026-06-20');
});

test('an undated state remains undated', () => {
  const row = parse([['Terminate', '']]);
  assert.equal(row.qc_status, 'Terminate');
  assert.equal(row.status_changed_at, null);
});
