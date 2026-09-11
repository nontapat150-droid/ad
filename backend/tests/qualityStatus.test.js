const { test } = require('node:test');
const assert = require('node:assert/strict');
const { bangkokToday, dateOnly, normalizeServiceStatus, serviceStatus, validateStatusDate, resolveImportStatus, qualityOutcome } = require('../utils/qualityStatus');

test('Bangkok calendar day and valid dates do not depend on server timezone', () => {
  assert.equal(bangkokToday(new Date('2026-09-10T18:00:00Z')), '2026-09-11');
  assert.equal(dateOnly(new Date('2026-01-31T17:00:00Z')), '2026-02-01');
  assert.equal(dateOnly('2026-02-30'), null);
  assert.equal(dateOnly('2024-02-29'), '2024-02-29');
});

test('all three service states remain distinct, unknown is not Active', () => {
  for (const [raw, expected] of [['Active', 'active'], ['Suspend - Debt', 'suspend'], ['Suspended', 'suspend'], ['Terminate', 'terminate'], ['Disconnected', 'terminate'], ['Inactive', 'unknown'], ['pending', 'unknown']]) {
    assert.equal(normalizeServiceStatus(raw), expected);
  }
  assert.equal(serviceStatus({status: 'active', qc_status: 'Suspend - Debt'}).service_status, 'suspend');
  assert.equal(serviceStatus({status: 'cancelled', qc_status: 'Active'}).service_status, 'terminate');
});

test('missing, future and pre-install dates remain visibly unconfirmed', () => {
  const customer = { status: 'cancelled', install_date: '2026-01-01', cancelled_at: null };
  assert.ok(serviceStatus(customer, '2026-09-11').service_status_issue);
  assert.ok(serviceStatus({...customer, cancelled_at: '2026-12-01'}, '2026-09-11').service_status_issue);
  assert.ok(serviceStatus({...customer, cancelled_at: '2025-12-31'}, '2026-09-11').service_status_issue);
  assert.equal(serviceStatus({...customer, cancelled_at: '2026-09-11'}, '2026-09-11').service_status_issue, null);
  assert.equal(validateStatusDate('2026-09-11', '2026-01-01', '2026-09-11'), null);
  assert.ok(validateStatusDate('2026-09-12', '2026-01-01', '2026-09-11'));
});

test('older files cannot overwrite a newer effective service state', () => {
  const existing = {status: 'active', qc_status: 'Active', status_changed_at: '2026-06-20', install_date: '2026-01-01'};
  const result = resolveImportStatus({qc_status: 'Terminate', status_changed_at: '2026-05-01'}, existing, existing.install_date);
  assert.equal(result.qcStatus, 'Active');
  assert.equal(result.statusChangedAt, '2026-06-20');
  assert.equal(result.cancelledAt, null);
});

test('observation date is never used as the actual cancellation date', () => {
  const result = resolveImportStatus({qc_status: 'Terminate', status_observed_at: '2026-06-01'}, null, '2026-01-01');
  assert.equal(result.status, 'cancelled');
  assert.equal(result.statusChangedAt, null);
  assert.equal(result.cancelledAt, null);
});

test('a newer Suspend replaces Terminate and clears cancellation fields', () => {
  const existing = {status: 'cancelled', qc_status: 'Terminate', cancelled_at: '2026-03-01', status_changed_at: '2026-03-01'};
  const result = resolveImportStatus({qc_status: 'Suspend - Debt', status_changed_at: '2026-04-01'}, existing, '2026-01-01');
  assert.equal(result.qcStatus, 'Suspend - Debt');
  assert.equal(result.status, 'active');
  assert.equal(result.cancelledAt, null);
});

test('CM uses the latest effective status and excludes future/unconfirmed cancellation', () => {
  const customer = {status:'cancelled', qc_status:'Suspend', install_date:'2026-01-01', cancelled_at:'2026-02-01', status_changed_at:'2026-03-01'};
  assert.equal(serviceStatus(customer, '2026-09-11').service_status, 'suspend');
  assert.equal(qualityOutcome(customer, 4, '2026-09-11').is_case, false);
  const future = {...customer, qc_status:'Terminate', cancelled_at:'2026-12-01',status_changed_at:'2026-12-01'};
  assert.equal(serviceStatus(future, '2026-09-11').service_status, 'unknown');
  assert.equal(qualityOutcome(future, 4, '2026-09-11').cm_status, 'incomplete');
});

test('CM cutoff clamps to the last day of the month and excludes the cutoff day', () => {
  const customer = {status:'cancelled',qc_status:'Terminate',install_date:'2026-01-31',cancelled_at:'2026-02-27'};
  assert.equal(qualityOutcome(customer,1,'2026-09-11').is_case,true);
  assert.equal(qualityOutcome({...customer,cancelled_at:'2026-02-28'},1,'2026-09-11').is_case,false);
});
