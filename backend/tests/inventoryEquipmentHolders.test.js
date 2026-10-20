const assert = require('node:assert/strict');
const { test } = require('node:test');
const express = require('express');

const calls = [];
const dbPath = require.resolve('../config/db');
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('ii.sn LIKE ?')) {
        return [[{ id: 44, sn: 'SN-001', quantity: '1', owner_name: 'ช่างเอ', product_name: 'ONU', model_name: 'HG-1' }]];
      }
      return [[{ owner_id: 7, owner_name: 'ช่างเอ', team_name: 'ทีมเหนือ', product_name: 'ONU', model_name: 'HG-1', quantity: '2', item_count: '2', sn_count: '2' }]];
    },
  },
};

const authPath = require.resolve('../middleware/auth');
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    auth: (req, res, next) => { req.user = { role: req.headers['x-role'] || 'admin' }; next(); },
    requireRole: (roles) => (req, res, next) => roles.includes(req.user.role) ? next() : res.sendStatus(403),
  },
};

const app = express();
app.use('/inventory', require('../routes/inventory'));

test('equipment holders shows current devices by person and finds serial numbers safely', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/inventory/equipment-holders`;
  try {
    assert.equal((await fetch(url, { headers: { 'x-role': 'technician' } })).status, 403);
    const summary = await fetch(url);
    assert.equal(summary.status, 200);
    assert.deepEqual(await summary.json(), {
      holders: [{ owner_id: 7, owner_name: 'ช่างเอ', team_name: 'ทีมเหนือ', product_name: 'ONU', model_name: 'HG-1', quantity: 2, item_count: 2, sn_count: 2 }],
      sn_results: [],
    });
    assert.match(calls[0].sql, /ii\.status = 'dispatched'/);
    assert.match(calls[0].sql, /GROUP BY ii\.owner_id/);
    assert.doesNotMatch(calls[0].sql, /ii\.sn LIKE \?/);

    const searched = await fetch(`${url}?sn=SN-001`);
    assert.equal(searched.status, 200);
    assert.deepEqual((await searched.json()).sn_results, [{ id: 44, sn: 'SN-001', quantity: 1, owner_name: 'ช่างเอ', product_name: 'ONU', model_name: 'HG-1' }]);
    assert.deepEqual(calls[2].params, ['%SN-001%']);
    assert.match(calls[2].sql, /ii\.sn LIKE \?/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
