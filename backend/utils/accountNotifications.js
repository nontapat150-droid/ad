const { notifyEvent, getAdminIds } = require('./notifyEvent');
const { checkinPath, usersPath, dashboardPath } = require('./notificationPaths');

/**
 * Employee submitted leave — notify admins once per leave record.
 */
async function notifyLeaveRequested({
  leaveId,
  userId,
  userName = 'พนักงาน',
  leaveDate,
  reason = '',
  leaveType = 'general',
  actorId = null,
}) {
  if (!leaveId) return;

  const dateStr = leaveDate || '-';
  const note = String(reason || '').trim().slice(0, 80);
  const typeLabel =
    leaveType === 'ma' ? 'MA' : leaveType === 'sales' ? 'Sales' : 'ทั่วไป';

  await notifyEvent({
    eventKey: `leave.requested:${leaveId}:admins`,
    actorId: actorId ?? userId,
    title: '🏖️ แจ้งลางาน',
    body:
      `${userName} ลาวันที่ ${dateStr} (${typeLabel})` +
      (note ? `\n${note}` : '') +
      '\nกดเพื่อดูรายการลา',
    type: 'leave_requested',
    data: {
      related_id: leaveId,
      leave_id: leaveId,
      user_id: userId,
      leave_date: dateStr,
      path: checkinPath({ tab: 'leave', userId }),
    },
    recipients: await getAdminIds(),
  });
}

/**
 * Admin approved a pending account — notify the user once.
 */
async function notifyUserApproved({
  userId,
  userName = '',
  actorId = null,
}) {
  const uid = Number(userId);
  if (!uid) return;

  await notifyEvent({
    eventKey: `user.approved:${uid}`,
    actorId,
    title: '✅ บัญชีได้รับการอนุมัติ',
    body:
      `ยินดีต้อนรับ${userName ? ` ${userName}` : ''}! บัญชีพร้อมใช้งานแล้ว\nกดเพื่อเข้าหน้าหลัก`,
    type: 'user_approved',
    data: {
      related_id: uid,
      user_id: uid,
      path: dashboardPath(),
    },
    recipients: [uid],
  });
}

/**
 * Self-registration — notify admins once per new pending user.
 */
async function notifyUserRegistered({
  userId,
  userName = '',
  username = '',
  role = '',
  actorId = null,
}) {
  const uid = Number(userId);
  if (!uid) return;

  await notifyEvent({
    eventKey: `user.registered:${uid}:admins`,
    actorId,
    title: '👤 สมัครสมาชิกใหม่',
    body: `${userName || username || 'ผู้ใช้ใหม่'} (${username}) · รออนุมัติ${role ? ` · ${role}` : ''}\nกดเพื่ออนุมัติ`,
    type: 'user_registered',
    data: {
      related_id: uid,
      user_id: uid,
      path: usersPath({ status: 'pending' }),
    },
    recipients: await getAdminIds(),
  });
}

module.exports = {
  notifyLeaveRequested,
  notifyUserApproved,
  notifyUserRegistered,
};
