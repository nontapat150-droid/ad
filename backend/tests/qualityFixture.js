const path = require('node:path');
const { serviceStatus, dateOnly } = require('../utils/qualityStatus');
const settings = { fraud: { enabled: true, months: 4, threshold_rate: 3 }, churn: { enabled: true, months: 8, threshold_rate: 1.5 } };
const samples = [
  { id: 1, customer_name: 'ลูกค้าทดสอบ Active', qc_status: 'Active', status: 'active', install_date: '2026-07-01', status_changed_at: '2026-08-01' },
  { id: 2, customer_name: 'ลูกค้าทดสอบ Suspend', qc_status: 'Suspend - Debt', status: 'active', install_date: '2026-08-01', status_changed_at: '2026-09-01' },
  { id: 3, customer_name: 'ลูกค้าทดสอบ Terminate', qc_status: 'Terminate', status: 'cancelled', install_date: '2026-08-15', status_changed_at: '2026-09-10', cancelled_at: '2026-09-10', is_case: 1 },
  { id: 4, customer_name: 'ลูกค้าทดสอบ วันที่ไม่ครบ', qc_status: 'Terminate', status: 'cancelled', install_date: '2026-09-01', cancelled_at: null },
].map((item) => ({ monthly_fee: 599, package_name: 'แพ็กเกจทดสอบ', non_number: `DEMO000${item.id}`, seller_name: 'ทีมทดสอบ', payment_due_day: 4, first_due_date: '2026-09-04', first_due_month: '2026-09', payment_due_source: 'manual', tracking_due_at: '2026-12-01', tracking_days_remaining: 81, ...item }));

function fixtureApp() {
  const express = require('express');
  const customers = structuredClone(samples);
  const calls = [];
  const db = { query: async (sql, params = []) => {
    calls.push({sql, params});
    if (/SHOW COLUMNS/.test(sql)) return [[{Field: 'present'}]];
    if (/^(CREATE|ALTER|UPDATE installed_customers\s+SET (monthly_fee|payment_due|first_due))/i.test(sql.trim())) return [{affectedRows: 0}];
    if (/SELECT \* FROM installed_customers WHERE id/.test(sql)) return [[customers.find((c) => c.id === Number(params[0]))].filter(Boolean)];
    if (/UPDATE installed_customers\s+SET customer_name/.test(sql)) {
      const c = customers.find((c) => c.id === Number(params.at(-1)));
      Object.assign(c, { customer_name: params[0], non_number: params[1], package_name: params[2], monthly_fee: params[3], install_date: params[4], status: params[9], cancelled_at: params[10], cancel_reason: params[11], qc_status: params[12], status_changed_at: params[14] });
      return [{affectedRows: 1}];
    }
    if (/SELECT DATE_FORMAT\(install_date/.test(sql)) return [[{value:'2026-09',total:1},{value:'2026-08',total:2},{value:'2026-07',total:1}]];
    if (/MIN\(bill_month\)/.test(sql)) return [[{min_month:null,max_month:null}]];
    const range = params.slice(-2);
    const filtered = customers.filter((c) => { const date = sql.includes('COALESCE(GREATEST') ? serviceStatus(c).service_status_date : dateOnly(c.install_date); return date && date >= range[0] && date <= range[1]; });
    if (/AS total_installs/.test(sql)) return [[{total_installs: filtered.length, cases: filtered.filter(c=>c.is_case).length}]];
    if (/SELECT c.id, c.customer_name/.test(sql)) return [filtered.map(c=>({...c}))];
    if (/COALESCE\(SUM\(CASE/.test(sql)) return [[{outstanding_total:0,outstanding_bills:0}]];
    return [[]];
  }};
  function stub(relative, exports) {
    const id = require.resolve(path.join(__dirname,'..',relative));
    require.cache[id] = {id, filename:id, loaded:true, exports};
  }
  stub('config/db',db);
  stub('middleware/auth',{auth:(req,_res,next)=>{req.user={id:9001,role:'super_admin'};next();}, requireRole:()=> (_req,_res,next)=>next()});
  stub('utils/customerSync',{lookupPackageFee:async()=>599});
  stub('utils/fraudChurnSettings',{getFraudChurnSettings:async()=>settings});
  const billing = require('../utils/billingSchedule');
  stub('utils/billingSchedule',{...billing, syncAutoBillingSchedule:async()=>({})});
  delete require.cache[require.resolve('../routes/installedCustomers')];
  const app = express();
  app.use(express.json());
  app.use('/api/installed-customers',require('../routes/installedCustomers'));
  return { app, calls, customers, settings };
}
module.exports = { fixtureApp };
