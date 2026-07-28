/**
 * Merge auto-locked frequent no-SN bag items (qty 1) into selected map.
 * Locked rows cannot be removed by the technician during complete.
 */
export function applyFrequentNoSnLocks(selectedNoSnItems, noSnItems, config, userRoles) {
  const productIds = Array.isArray(config?.product_ids) ? config.product_ids.map(String) : [];
  const roles = Array.isArray(config?.roles) ? config.roles : [];
  const roleSet = new Set((userRoles || []).map(String));
  if (!productIds.length || !roles.length || !roles.some((r) => roleSet.has(String(r)))) {
    return selectedNoSnItems || {};
  }

  const productSet = new Set(productIds);
  const next = { ...(selectedNoSnItems || {}) };
  const claimedProducts = new Set();

  // Keep existing locked rows for products still in bag
  Object.values(next).forEach((it) => {
    if (it?.locked && it.product_id != null) claimedProducts.add(String(it.product_id));
  });

  for (const item of noSnItems || []) {
    const pid = item.product_id != null ? String(item.product_id) : '';
    if (!pid || !productSet.has(pid) || claimedProducts.has(pid)) continue;
    if ((Number(item.quantity) || 0) < 1) continue;

    claimedProducts.add(pid);
    const prev = next[item.id];
    next[item.id] = {
      ...item,
      ...(prev || {}),
      useQty: 1,
      locked: true,
    };
  }

  // Re-assert lock + qty 1 on any already-selected matching products
  Object.keys(next).forEach((id) => {
    const it = next[id];
    const pid = it?.product_id != null ? String(it.product_id) : '';
    if (pid && productSet.has(pid)) {
      next[id] = { ...it, locked: true, useQty: 1 };
    }
  });

  return next;
}

export async function resolveRolesForComplete({ api, user, job, isAdmin }) {
  const selfRoles = user?.roles || [user?.role || ''].filter(Boolean);
  const assigneeId = job?.field_engineer_id || job?.assigned_user_id;
  if (!isAdmin || !assigneeId || Number(assigneeId) === Number(user?.id)) {
    return selfRoles;
  }
  try {
    const res = await api.get('/users');
    const list = Array.isArray(res.data) ? res.data : [];
    const assignee = list.find((u) => Number(u.id) === Number(assigneeId));
    if (!assignee) return selfRoles;
    if (Array.isArray(assignee.roles) && assignee.roles.length) return assignee.roles;
    if (assignee.roles_csv) {
      return String(assignee.roles_csv).split(',').map((r) => r.trim()).filter(Boolean);
    }
    return assignee.role ? [assignee.role] : selfRoles;
  } catch {
    return selfRoles;
  }
}
