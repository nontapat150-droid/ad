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
    query: async (sql) => {
      calls.push(sql);
      if (sql.includes("il.action = 'used'")) {
        return [[{ id: 2, product_name: 'สาย', quantity: '5', used_by_name: 'ช่างเอ' }]];
      }
      if (sql.includes("ii.status = 'dispatched'")) {
        return [[{ id: 3, product_name: 'ONU', quantity: '1', owner_name: 'ช่างบี' }]];
      }
      return [[{ id: 1, product_name: 'เราเตอร์', quantity: '2' }]];
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

test('inventory export data separates current stock, used items, and technician equipment', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/inventory/export-data`;
  try {
    assert.equal((await fetch(url, { headers: { 'x-role': 'technician' } })).status, 403);

    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      in_stock: [{ id: 1, product_name: 'เราเตอร์', quantity: 2 }],
      used: [{ id: 2, product_name: 'สาย', quantity: 5, used_by_name: 'ช่างเอ' }],
      with_technician: [{ id: 3, product_name: 'ONU', quantity: 1, owner_name: 'ช่างบี' }],
    });
    assert.equal(calls.length, 3);
    assert.match(calls[0], /ii\.status = 'in_stock'/);
    assert.match(calls[1], /il\.action = 'used'/);
    assert.match(calls[2], /ii\.status = 'dispatched'/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
