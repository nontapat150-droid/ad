const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
let calls = [];
const dbPath = require.resolve("../config/db");
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return [[{ quantity: "12", log_count: "3" }]];
    },
  },
};
const authPath = require.resolve("../middleware/auth");
require.cache[authPath] = {
  id: authPath,
  filename: authPath,
  loaded: true,
  exports: {
    auth: (req, res, next) => {
      req.user = { role: req.headers["x-role"] || "admin" };
      next();
    },
    requireRole: (roles) => (req, res, next) =>
      roles.includes(req.user.role) ? next() : res.sendStatus(403),
  },
};
const app = express();
app.use("/inventory", require("../routes/inventory"));
test("monthly summary validates month, enforces access and queries full dispatch month", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/inventory/monthly-summary`;
  try {
    for (const month of ["", "2026-13", "2026-00", "2026-9", "bad"]) {
      assert.equal((await fetch(`${url}?month=${month}`)).status, 400);
    }
    assert.equal(
      (
        await fetch(`${url}?month=2026-09`, {
          headers: { "x-role": "technician" },
        })
      ).status,
      403,
    );
    assert.equal(calls.length, 0);
    const result = await fetch(`${url}?month=2026-12`);
    assert.deepEqual(await result.json(), [{ quantity: 12, log_count: 3 }]);
    assert.deepEqual(calls[0].params, ["2026-12-01", "2027-01-01"]);
    assert.match(calls[0].sql, /il.action = 'dispatch'/);
    assert.match(calls[0].sql, /il.created_at >= \? AND il.created_at < \?/);
    assert.match(calls[0].sql, /u.id = il.to_user_id/);
    assert.doesNotMatch(calls[0].sql, /LIMIT|ii.owner_id/);
    await fetch(`${url}?month=2024-02`);
    assert.deepEqual(calls[1].params, ["2024-02-01", "2024-03-01"]);
    for (const ids of ['model_id=1', 'model_id=0&user_id=1', 'model_id=1&user_id=-1', 'model_id=abc&user_id=1']) {
      assert.equal((await fetch(`${url}?month=2026-07&details=1&${ids}`)).status, 400);
    }
    assert.equal(calls.length, 2);
    const detail = await fetch(`${url}?month=2026-07&details=1&model_id=5&user_id=8`);
    assert.equal(detail.status, 200);
    assert.equal((await detail.json())[0].quantity, 12);
    assert.deepEqual(calls[2].params, ['2026-07-01', '2026-08-01', 8, 5]);
    assert.match(calls[2].sql, /il.to_user_id <=> \? AND ii.model_id = \?/);
    assert.match(calls[2].sql, /ORDER BY il.created_at ASC, il.id ASC/);
    assert.match(calls[2].sql, /DATE_FORMAT\(il.created_at, '%Y-%m-%d'\)/);
    await fetch(`${url}?month=2026-07&details=1&model_id=5&user_id=unknown`);
    assert.equal(calls[3].params[2], null);
    assert.equal((await fetch(`${url}?month=2026-07&details=1&model_id=5&user_id=8`, {headers: {'x-role': 'technician'}})).status, 403);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
