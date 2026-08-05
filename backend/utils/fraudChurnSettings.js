const DEFAULT_FRAUD_CHURN_SETTINGS = Object.freeze({
  fraud: Object.freeze({ enabled: true, threshold_rate: 3, months: 4 }),
  churn: Object.freeze({ enabled: true, threshold_rate: 1.5, months: 8 }),
});

const SETTING_KEYS = Object.freeze({
  qc_fraud_enabled: ['fraud', 'enabled'],
  qc_fraud_threshold_rate: ['fraud', 'threshold_rate'],
  qc_fraud_months: ['fraud', 'months'],
  qc_churn_enabled: ['churn', 'enabled'],
  qc_churn_threshold_rate: ['churn', 'threshold_rate'],
  qc_churn_months: ['churn', 'months'],
});

function cloneDefaults() {
  return {
    fraud: { ...DEFAULT_FRAUD_CHURN_SETTINGS.fraud },
    churn: { ...DEFAULT_FRAUD_CHURN_SETTINGS.churn },
  };
}

function parseEnabled(value, fallback) {
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  return fallback;
}

async function getFraudChurnSettings(db) {
  const settings = cloneDefaults();
  const keys = Object.keys(SETTING_KEYS);
  const [rows] = await db.query(
    `SELECT setting_key, setting_value
     FROM system_settings
     WHERE setting_key IN (${keys.map(() => '?').join(', ')})`,
    keys
  );

  for (const row of rows) {
    const path = SETTING_KEYS[row.setting_key];
    if (!path) continue;
    const [type, field] = path;
    if (field === 'enabled') {
      settings[type][field] = parseEnabled(row.setting_value, settings[type][field]);
    } else if (field === 'months') {
      const value = Number.parseInt(row.setting_value, 10);
      if (Number.isInteger(value) && value >= 1 && value <= 36) settings[type][field] = value;
    } else {
      const value = Number(row.setting_value);
      if (Number.isFinite(value) && value > 0 && value <= 100) settings[type][field] = value;
    }
  }

  return settings;
}

function validateFraudChurnSettings(input) {
  const output = cloneDefaults();
  for (const type of ['fraud', 'churn']) {
    const source = input?.[type];
    if (!source || typeof source !== 'object') {
      throw new Error(`กรุณาระบุการตั้งค่า ${type === 'fraud' ? 'Fraud' : 'Churn'}`);
    }

    const months = Number(source.months);
    const thresholdRate = Number(source.threshold_rate);
    if (!Number.isInteger(months) || months < 1 || months > 36) {
      throw new Error(`จำนวนเดือนของ ${type === 'fraud' ? 'Fraud' : 'Churn'} ต้องเป็นเลขจำนวนเต็ม 1–36 เดือน`);
    }
    if (!Number.isFinite(thresholdRate) || thresholdRate <= 0 || thresholdRate > 100) {
      throw new Error(`เกณฑ์ของ ${type === 'fraud' ? 'Fraud' : 'Churn'} ต้องมากกว่า 0 และไม่เกิน 100%`);
    }

    output[type] = {
      enabled: parseEnabled(source.enabled, false),
      threshold_rate: Number(thresholdRate.toFixed(2)),
      months,
    };
  }
  return output;
}

async function upsertSetting(db, key, value) {
  const [existing] = await db.query(
    'SELECT setting_key FROM system_settings WHERE setting_key = ? LIMIT 1',
    [key]
  );
  if (existing.length) {
    await db.query('UPDATE system_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
  } else {
    await db.query('INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
  }
}

async function saveFraudChurnSettings(db, input) {
  const settings = validateFraudChurnSettings(input);
  const values = {
    qc_fraud_enabled: settings.fraud.enabled ? '1' : '0',
    qc_fraud_threshold_rate: String(settings.fraud.threshold_rate),
    qc_fraud_months: String(settings.fraud.months),
    qc_churn_enabled: settings.churn.enabled ? '1' : '0',
    qc_churn_threshold_rate: String(settings.churn.threshold_rate),
    qc_churn_months: String(settings.churn.months),
  };
  for (const [key, value] of Object.entries(values)) await upsertSetting(db, key, value);
  return settings;
}

module.exports = {
  DEFAULT_FRAUD_CHURN_SETTINGS,
  getFraudChurnSettings,
  saveFraudChurnSettings,
  validateFraudChurnSettings,
};
