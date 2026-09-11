const { test } = require('node:test');
const assert = require('node:assert/strict');
const { fixtureApp } = require('./qualityFixture');

test('QC API: inclusive cross-month filters, date validation and actual service updates', async () => {
  const { app, calls } = fixtureApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve=>server.on('listening',resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/installed-customers`;
  try {
    const get = (query) => fetch(`${url}/qc?type=fraud&${query}`);
    let response = await get('date_from=2026-07-01&date_to=2026-09-01&date_type=install');
    let body = await response.json();
    assert.equal(response.status,200);
    assert.equal(body.customers.length,4);
    assert.equal(body.customers[1].service_status,'suspend');
    assert.equal(body.customers[3].cm_status,'incomplete');
    response = await get('date_from=2026-09-01&date_to=2026-09-10&date_type=status_changed');
    body = await response.json();
    assert.deepEqual(body.customers.map(c=>c.id),[2,3]);
    assert.ok(calls.some(({sql,params})=>sql.includes('COALESCE(GREATEST') && params.at(-2)==='2026-09-01'));
    for (const query of ['date_from=2026-09-10&date_to=2026-09-01','date_from=2026-02-30&date_to=2026-03-01','date_from=2026-01-01','date_from=2026-01-01&date_to=2026-09-11&date_type=bad']) {
      assert.equal((await get(query)).status,400);
    }
    const put = (data) => fetch(`${url}/1`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    assert.equal((await put({service_status:'suspend',status_changed_at:''})).status,400);
    assert.equal((await put({service_status:'suspend',status_changed_at:'2099-01-01'})).status,400);
    response = await put({service_status:'suspend',status_changed_at:'2026-09-02'});
    assert.equal(response.status,200);
    body=await response.json();
    assert.equal(body.qc_status,'Suspend');
    assert.equal(body.status_changed_at,'2026-09-02');
    response=await put({service_status:'terminate',status_changed_at:'2026-09-03'});
    body=await response.json();
    assert.equal(body.status,'cancelled');
    assert.equal(body.cancelled_at,'2026-09-03');
    assert.ok(calls.some(({sql})=>sql.includes('INSERT INTO quality_audit_logs')));
  } finally { await new Promise(resolve=>server.close(resolve)); }
});
