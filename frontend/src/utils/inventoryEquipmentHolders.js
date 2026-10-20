export function groupEquipmentByHolder(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const ownerId = row.owner_id ?? 'unknown';
    if (!groups.has(ownerId)) {
      groups.set(ownerId, {
        ownerId,
        ownerName: row.owner_name || 'ไม่ระบุผู้ถือ',
        teamName: row.team_name || 'ไม่ระบุทีม',
        quantity: 0,
        itemCount: 0,
        snCount: 0,
        rows: [],
      });
    }
    const group = groups.get(ownerId);
    group.quantity += Number(row.quantity) || 0;
    group.itemCount += Number(row.item_count) || 0;
    group.snCount += Number(row.sn_count) || 0;
    group.rows.push(row);
  }
  return [...groups.values()];
}
