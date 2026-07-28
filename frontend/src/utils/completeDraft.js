/** Draft keys must match CompleteJobModal / CompleteMaJobModal */

export const officeDraftKey = (jobId) => `office-complete-draft-${jobId}`;
export const maDraftKey = (jobId) => `ma-complete-draft-${jobId}`;

function parseInstallDeviceFields(str) {
  if (!str) return {};
  const map = {
    SOA: 'soa_device', ONU: 'sn_onu', PB: 'sn_playbox', Mesh: 'sn_mesh',
    SIM: 'sn_sim', Cam: 'sn_ip_camera', Sp: 'split_no', Pt: 'port_no',
    L3: 'l3_name', 'สาย': 'cable_length', '3BB': 'ref_id_3bb', 'SCฟ้า': 'sc_blue',
  };
  const out = {};
  for (const part of String(str).split(/[\n|]/)) {
    const line = part.trim();
    if (!line) continue;
    const ci = line.indexOf(':');
    if (ci === -1) continue;
    const key = line.slice(0, ci).trim();
    let val = line.slice(ci + 1).trim();
    const field = map[key];
    if (!field) continue;
    if (field === 'cable_length') val = val.replace(/M$/i, '');
    out[field] = val;
  }
  return out;
}

const SN_ROLES = ['ONU', 'PB', 'Mesh', 'SIM', 'Cam'];

/**
 * Save office complete draft from job details (before cancel-completion).
 * Photos / entry-fee slips cannot be restored — user re-attaches if needed.
 */
export function saveOfficeCompleteDraftFromDetails(jobId, details) {
  if (!jobId || !details) return false;
  const parsed = parseInstallDeviceFields(details.install_device);
  const bagSelections = { ONU: '', PB: '', Mesh: '', SIM: '', Cam: '' };
  const selectedNoSnItems = {};

  for (const d of details.used_devices || []) {
    const id = d.inventory_item_id;
    if (!id) continue;
    if (d.device_role === 'NoSN') {
      selectedNoSnItems[id] = {
        id,
        product_id: d.product_id,
        product_name: d.product_name,
        model_name: d.model_name || '',
        quantity: Number(d.quantity) || 1,
        useQty: Number(d.quantity) || 1,
        unit: d.unit || 'ชิ้น',
        has_sn: 0,
      };
      continue;
    }
    if (SN_ROLES.includes(d.device_role)) {
      if (d.sn === '-' || d.sn === '') {
        if (d.device_role === 'ONU') bagSelections.ONU = 'dash';
      } else {
        bagSelections[d.device_role] = String(id);
      }
    }
  }

  if (parsed.sn_onu === '-') bagSelections.ONU = 'dash';

  const installDate = details.plan_arrival_date
    ? String(details.plan_arrival_date).split('T')[0]
    : new Date().toLocaleDateString('en-CA');

  const payload = {
    step: 1,
    installDate,
    bagSelections,
    soaDevice: parsed.soa_device || '',
    orderNo: details.order_no || '',
    splitNo: parsed.split_no || details.split_no || '',
    portNo: parsed.port_no || details.port_no || '',
    l3Name: parsed.l3_name || details.l3_name || '',
    cableLength: parsed.cable_length || details.cable_length || '',
    refId3bb: parsed.ref_id_3bb || details.ref_id_3bb || '',
    scBlue: parsed.sc_blue || details.sc_blue || '',
    remark: details.remark || '',
    entryFeeStatus: 'none',
    entryFeeBackdate: '',
    selectedNoSnItems,
    savedAt: Date.now(),
    fromCancelCompletion: true,
  };

  try {
    localStorage.setItem(officeDraftKey(jobId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Save MA complete draft from job details (before cancel-completion).
 */
export function saveMaCompleteDraftFromDetails(jobId, details) {
  if (!jobId || !details) return false;
  const selectedSnIds = [];
  const selectedNoSnItems = {};

  for (const d of details.used_devices || []) {
    const id = d.inventory_item_id;
    if (!id) continue;
    if (d.device_role === 'NoSN') {
      selectedNoSnItems[id] = {
        id,
        product_id: d.product_id,
        product_name: d.product_name,
        model_name: d.model_name || '',
        quantity: Number(d.quantity) || 1,
        useQty: Number(d.quantity) || 1,
        unit: d.unit || 'ชิ้น',
        has_sn: 0,
      };
    } else {
      selectedSnIds.push(id);
    }
  }

  const payload = {
    srt: details.srt || '',
    spt: details.spt || '',
    failCause: details.fail_cause || '',
    fixMethod: details.fix_method || '',
    oldSn: details.old_sn || '',
    newSn: details.new_sn || '',
    cableUsed: details.cable_used || '',
    remark: details.remark || '',
    selectedSnIds,
    selectedNoSnItems,
    savedAt: Date.now(),
    fromCancelCompletion: true,
  };

  try {
    localStorage.setItem(maDraftKey(jobId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}
