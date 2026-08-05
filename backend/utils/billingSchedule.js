function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function parseIsoDate(value) {
  const match = String(value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, date };
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function aisDueDayFromInstallDate(installDate) {
  const parsed = parseIsoDate(installDate);
  if (!parsed) return null;
  const day = parsed.day;
  if (day <= 3) return 4;
  if (day <= 7) return 8;
  if (day <= 11) return 12;
  if (day <= 15) return 16;
  if (day <= 19) return 20;
  if (day <= 23) return 24;
  if (day <= 27) return 28;
  return 1;
}

function calculateFirstDueDate(installDate, dueDayOverride = null) {
  const parsed = parseIsoDate(installDate);
  if (!parsed) return null;
  const hasOverride = dueDayOverride != null && dueDayOverride !== '';
  const requestedDay = hasOverride && Number.isInteger(Number(dueDayOverride))
    ? Number(dueDayOverride)
    : aisDueDayFromInstallDate(installDate);
  if (!requestedDay || requestedDay < 1 || requestedDay > 31) return null;
  const lastDayNextMonth = new Date(Date.UTC(parsed.year, parsed.month + 1, 0)).getUTCDate();
  return isoDate(new Date(Date.UTC(parsed.year, parsed.month, Math.min(requestedDay, lastDayNextMonth))));
}

function addMonthsToDueDate(firstDueDate, delta) {
  const parsed = parseIsoDate(firstDueDate);
  if (!parsed) return null;
  const targetFirst = new Date(Date.UTC(parsed.year, parsed.month - 1 + delta, 1));
  const lastDay = new Date(Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)).getUTCDate();
  targetFirst.setUTCDate(Math.min(parsed.day, lastDay));
  return isoDate(targetFirst);
}

function previousMonthBounds(dueDate) {
  const parsed = parseIsoDate(dueDate);
  const start = new Date(Date.UTC(parsed.year, parsed.month - 2, 1));
  const end = new Date(Date.UTC(parsed.year, parsed.month - 1, 0));
  return { start: isoDate(start), end: isoDate(end), days: end.getUTCDate() };
}

function buildBillingSchedule({ installDate, monthlyFee, months = 8, dueDay = null, vatRate = 7 }) {
  const parsedInstall = parseIsoDate(installDate);
  if (!parsedInstall) throw new Error('วันติดตั้งไม่ถูกต้อง');
  const safeFee = Math.max(0, Number(monthlyFee) || 0);
  const safeMonths = Math.min(36, Math.max(1, Number.parseInt(months, 10) || 8));
  const safeVatRate = Math.min(100, Math.max(0, Number(vatRate) || 0));
  const effectiveDueDay = dueDay == null ? aisDueDayFromInstallDate(installDate) : Number(dueDay);
  const firstDueDate = calculateFirstDueDate(installDate, effectiveDueDay);
  if (!firstDueDate) throw new Error('วันครบกำหนดชำระไม่ถูกต้อง');

  const installMonthDays = new Date(Date.UTC(parsedInstall.year, parsedInstall.month, 0)).getUTCDate();
  const firstServiceDays = installMonthDays - parsedInstall.day + 1;
  const rows = [];

  for (let index = 0; index < safeMonths; index++) {
    const dueDate = addMonthsToDueDate(firstDueDate, index);
    const period = previousMonthBounds(dueDate);
    const periodStart = index === 0 ? installDate : period.start;
    const serviceDays = index === 0 ? firstServiceDays : period.days;
    const daysInMonth = index === 0 ? installMonthDays : period.days;
    const estimatedAmount = index === 0
      ? roundMoney((safeFee / installMonthDays) * firstServiceDays)
      : roundMoney(safeFee);
    const estimatedVat = roundMoney((estimatedAmount * safeVatRate) / 100);
    const estimatedTotal = roundMoney(estimatedAmount + estimatedVat);

    rows.push({
      bill_month: dueDate.slice(0, 7),
      due_date: dueDate,
      billing_period_start: periodStart,
      billing_period_end: period.end,
      service_days: serviceDays,
      days_in_month: daysInMonth,
      estimated_amount: estimatedAmount,
      estimated_vat: estimatedVat,
      estimated_total: estimatedTotal,
      vat_rate: safeVatRate,
      bill_status: 'unknown',
      amount: 0,
      raw_value: `รอตรวจสอบ · ประมาณ ${estimatedTotal.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`,
      bill_source: 'auto',
    });
  }

  return {
    payment_due_day: effectiveDueDay,
    first_due_date: firstDueDate,
    rows,
  };
}

function billingMonthsFromQcSettings(settings) {
  return Math.min(36, Math.max(
    1,
    Number(settings?.fraud?.months) || 4,
    Number(settings?.churn?.months) || 8
  ));
}

async function syncAutoBillingSchedule(db, customerId, options) {
  if (typeof db.getConnection === 'function') {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const schedule = await syncAutoBillingSchedule(conn, customerId, options);
      await conn.commit();
      return schedule;
    } catch (error) {
      await conn.rollback().catch(() => {});
      throw error;
    } finally {
      conn.release();
    }
  }

  const schedule = buildBillingSchedule(options);
  await db.query(
    `DELETE FROM installed_customer_bills
     WHERE installed_customer_id = ? AND bill_source = 'auto'`,
    [customerId]
  );
  if (!schedule.rows.length) return schedule;

  const placeholders = schedule.rows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = schedule.rows.flatMap((bill) => [
    customerId,
    bill.bill_month,
    bill.bill_status,
    bill.amount,
    bill.raw_value,
    bill.due_date,
    bill.billing_period_start,
    bill.billing_period_end,
    bill.service_days,
    bill.days_in_month,
    bill.estimated_amount,
    bill.estimated_vat,
    bill.estimated_total,
    bill.vat_rate,
    bill.bill_source,
  ]);
  await db.query(
    `INSERT INTO installed_customer_bills
       (installed_customer_id, bill_month, bill_status, amount, raw_value,
        due_date, billing_period_start, billing_period_end, service_days, days_in_month,
        estimated_amount, estimated_vat, estimated_total, vat_rate, bill_source)
     VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE id = id`,
    values
  );
  return schedule;
}

module.exports = {
  aisDueDayFromInstallDate,
  calculateFirstDueDate,
  buildBillingSchedule,
  billingMonthsFromQcSettings,
  syncAutoBillingSchedule,
};
