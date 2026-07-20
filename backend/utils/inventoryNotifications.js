const { notifyEvent, getTeamMemberIds } = require('./notifyEvent');
const { bagPath } = require('./notificationPaths');

function itemSummary(labels = [], max = 3) {
  const list = (labels || []).filter(Boolean);
  if (!list.length) return '';
  const head = list.slice(0, max).join(', ');
  const extra = list.length > max ? ` +${list.length - max}` : '';
  return head + extra;
}

/**
 * Admin dispatched items to a tech — one summary per dispatch action (not per line item).
 */
async function notifyInventoryDispatched({
  targetUserId,
  targetUserName = 'ช่าง',
  teamId = null,
  itemCount = 1,
  itemLabels = [],
  actorId = null,
  batchId = null,
}) {
  const uid = Number(targetUserId);
  if (!uid) return;

  const n = Number(itemCount) || 1;
  const stamp = batchId || `${uid}:${Date.now()}`;
  const summary = itemSummary(itemLabels);
  const path = bagPath({ userId: uid });

  await notifyEvent({
    eventKey: `inventory.dispatch:${stamp}:user:${uid}`,
    actorId,
    title: '📦 มีของเข้ากระเป๋า!',
    body: `เบิก ${n} รายการเข้ากระเป๋าของคุณ${summary ? `\n${summary}` : ''}\nกดเพื่อดูกระเป๋า`,
    type: 'inventory_dispatched',
    data: {
      related_id: uid,
      target_user_id: uid,
      team_id: teamId || null,
      count: n,
      path,
    },
    recipients: [uid],
  });

  if (teamId) {
    const teammates = await getTeamMemberIds(teamId, { excludeUserId: actorId });
    const teamRecipients = teammates.filter((id) => id !== uid);
    if (teamRecipients.length) {
      await notifyEvent({
        eventKey: `inventory.dispatch:${stamp}:team:${teamId}`,
        actorId,
        title: '📦 ทีมได้รับเบิกของ',
        body: `เบิกให้ ${targetUserName} ${n} รายการ${summary ? `\n${summary}` : ''}`,
        type: 'inventory_dispatched',
        data: {
          related_id: uid,
          target_user_id: uid,
          team_id: teamId,
          count: n,
          path: bagPath({ userId: uid }),
        },
        recipients: teamRecipients,
      });
    }
  }
}

/**
 * Bag item transferred between techs — notify recipient only.
 */
async function notifyInventoryTransferred({
  targetUserId,
  fromUserName = 'เพื่อนร่วมทีม',
  productLabel = 'อุปกรณ์',
  quantity = 1,
  itemId = null,
  actorId = null,
}) {
  const uid = Number(targetUserId);
  if (!uid || uid === Number(actorId)) return;

  const qty = Number(quantity) || 1;
  const key = itemId ? `item:${itemId}` : `t:${Date.now()}`;

  await notifyEvent({
    eventKey: `inventory.transfer:${key}:to:${uid}`,
    actorId,
    title: '🔄 รับโอนอุปกรณ์',
    body: `${fromUserName} โอน ${productLabel} จำนวน ${qty} ให้คุณ\nกดเพื่อดูกระเป๋า`,
    type: 'inventory_transferred',
    data: {
      related_id: itemId,
      item_id: itemId,
      quantity: qty,
      path: bagPath({ userId: uid }),
    },
    recipients: [uid],
  });
}

module.exports = {
  notifyInventoryDispatched,
  notifyInventoryTransferred,
};
