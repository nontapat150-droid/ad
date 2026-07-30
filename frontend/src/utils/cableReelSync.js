/**
 * Sync No-SN "สายม้วน …" bag usage with actual cable length (office complete only).
 * Product example: "สายม้วน 1000 m" / model เมตร
 */

export function isCableReelItem(item) {
  const name = String(item?.product_name || '');
  return name.includes('สายม้วน');
}

export function parseCableMeters(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n);
}

/**
 * @returns {{ next: object, warning: string|null, synced: boolean }}
 */
export function syncCableReelNoSn(selectedNoSnItems, noSnItems, cableLengthMeters) {
  const meters = parseCableMeters(cableLengthMeters);
  const prev = selectedNoSnItems && typeof selectedNoSnItems === 'object' ? selectedNoSnItems : {};
  if (meters == null) {
    return { next: prev, warning: null, synced: false };
  }

  const reelItems = (noSnItems || []).filter(isCableReelItem);
  if (!reelItems.length) {
    return {
      next: prev,
      warning: 'ไม่พบอุปกรณ์ "สายม้วน" ในกระเป๋า — กรุณาเบิก/เช็คสต็อก',
      synced: false,
    };
  }

  // Drop other reel rows so only one reel line reflects actual meters
  const next = { ...prev };
  Object.keys(next).forEach((id) => {
    if (isCableReelItem(next[id])) delete next[id];
  });

  const selectedReel = reelItems.find((i) => prev[i.id]);
  const enough = reelItems
    .filter((i) => (Number(i.quantity) || 0) >= meters)
    .sort((a, b) => (Number(b.quantity) || 0) - (Number(a.quantity) || 0));
  const byStock = [...reelItems].sort((a, b) => (Number(b.quantity) || 0) - (Number(a.quantity) || 0));
  const pick = selectedReel || enough[0] || byStock[0];
  if (!pick) {
    return { next: prev, warning: 'ไม่พบสายม้วนที่ใช้ได้', synced: false };
  }

  const maxQty = Math.max(0, Number(pick.quantity) || 0);
  if (maxQty < 1) {
    return {
      next: prev,
      warning: 'สายม้วนในกระเป๋าหมดสต็อก',
      synced: false,
    };
  }

  const useQty = Math.min(meters, maxQty);
  const warning =
    useQty < meters
      ? `ระยะสายจริง ${meters} ม. แต่สายม้วนในกระเป๋ามีแค่ ${maxQty} ม. — ระบบตั้งให้ ${useQty} ม.`
      : null;

  next[pick.id] = {
    ...pick,
    ...(prev[pick.id] || {}),
    useQty,
    // keep frequent lock if it was set; reel qty still follows cable length
    locked: Boolean(prev[pick.id]?.locked),
  };

  return { next, warning, synced: true };
}
