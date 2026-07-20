const { notifyEvent, getTeamMemberIds, getAdminIds } = require('./notifyEvent');
const { dispatchDashboardPath, bagPath, checkinPath, usersPath, dashboardPath } = require('./notificationPaths');

function refLabel(job, kind = 'office') {
  if (!job) return '';
  if (kind === 'ma') return job.non_number || job.access_no || `#${job.id}`;
  return job.access_no || `#${job.id}`;
}

function customerBit(job) {
  return job?.customer ? ` · ${job.customer}` : '';
}

function formatAppt(job, kind = 'office') {
  if (!job) return '';
  const date = job.plan_arrival_date;
  const rawTime = kind === 'ma'
    ? (job.job_time || job.plan_arrival_time)
    : job.plan_arrival_time;
  let timeStr = '';
  if (rawTime) {
    const m = String(rawTime).match(/(\d{1,2}):(\d{2})/);
    timeStr = m ? `${m[1].padStart(2, '0')}:${m[2]} น.` : String(rawTime).slice(0, 5);
  }
  if (date && timeStr) return ` · นัด ${date} ${timeStr}`;
  if (date) return ` · นัด ${date}`;
  if (timeStr) return ` · ${timeStr}`;
  return '';
}

function batchKey(ids) {
  const sorted = [...(ids || [])].map(Number).filter(Boolean).sort((a, b) => a - b);
  if (!sorted.length) return String(Date.now());
  if (sorted.length === 1) return String(sorted[0]);
  return `${sorted.length}:${sorted[0]}-${sorted[sorted.length - 1]}:${sorted.reduce((s, n) => s + n, 0)}`;
}

function jobPath({ jobIds, kind, queue, date }) {
  const id = jobIds?.[0] || null;
  return dispatchDashboardPath({ kind, jobId: id, openJob: id, queue, date });
}

function memberAssignBody({ n, teamName, jobs, kind, source, extraLine }) {
  const isMa = kind === 'ma';
  const jobWord = isMa ? 'งาน MA' : 'งานติดตั้ง';

  if (n === 1 && jobs?.[0]) {
    const j = jobs[0];
    const ref = refLabel(j, kind);
    const lines = [
      `มี${jobWord}ใหม่เข้าทีม`,
      ref + customerBit(j) + formatAppt(j, kind),
    ];
    if (extraLine) lines.push(extraLine);
    return lines.join('\n');
  }

  const head =
    source === 'auto'
      ? `${teamName} ได้รับ${jobWord}จากระบบจัดสรร ${n} รายการ`
      : source === 'import'
        ? `${teamName} มี${jobWord}จาก Excel ${n} รายการ`
        : `${teamName} ได้รับมอบหมาย${jobWord} ${n} รายการ`;

  return extraLine ? `${head}\n${extraLine}` : head;
}

function adminAssignBody({ n, teamName, jobs, kind }) {
  const isMa = kind === 'ma';
  const jobWord = isMa ? 'งาน MA' : 'งานติดตั้ง';

  if (n === 1 && jobs?.[0]) {
    const j = jobs[0];
    return `${refLabel(j, kind)} · ${teamName}${customerBit(j)}${formatAppt(j, kind)}`;
  }

  return `มอบ ${n} ${jobWord} ให้ ${teamName}`;
}

/**
 * Assign jobs to a team — tech sees action-oriented copy, admins see summary with ref.
 */
async function notifyJobsAssignedToTeam({
  teamId,
  teamName = 'ทีม',
  jobIds = [],
  jobs = [],
  count,
  actorId = null,
  kind = 'office',
  extraLine = '',
  source = 'assign',
}) {
  if (!teamId) return;
  const n = Number(count) || jobIds.length || jobs.length || 1;
  const isMa = kind === 'ma';
  const base = `${isMa ? 'ma' : 'job'}.${source}:${batchKey(jobIds.length ? jobIds : jobs.map((j) => j.id))}:team:${teamId}`;
  const icon = isMa ? '🔧' : '📋';
  const jobWord = isMa ? 'งาน MA' : 'งานติดตั้ง';
  const path = jobPath({ jobIds, kind, queue: 'assigned' });

  const memberTitle =
    source === 'auto'
      ? `${icon} มี${jobWord}จากระบบจัดสรร!`
      : source === 'import'
        ? `${icon} มี${jobWord}จาก Excel!`
        : n === 1
          ? `${icon} มี${jobWord}ใหม่เข้าทีม!`
          : `${icon} มี${jobWord}ใหม่ ${n} รายการ!`;

  const memberBody = memberAssignBody({ n, teamName, jobs, kind, source, extraLine });

  const adminTitle =
    source === 'auto'
      ? `${icon} จัดสรรอัตโนมัติ`
      : source === 'import'
        ? `${icon} Import มอบหมายทีม`
        : `${icon} มอบหมาย${jobWord}`;

  const adminBody = adminAssignBody({ n, teamName, jobs, kind });

  const data = {
    related_id: jobIds[0] || jobs[0]?.id || null,
    team_id: teamId,
    count: n,
    path,
    job_type: kind,
    source,
  };

  const members = await getTeamMemberIds(teamId, { excludeUserId: actorId });
  await notifyEvent({
    eventKey: `${base}:members`,
    actorId,
    title: memberTitle,
    body: memberBody,
    type: isMa ? 'ma_job_assigned' : 'job_assigned',
    data,
    recipients: members,
    resend: source === 'assign' || source === 'import' || source === 'auto',
  });

  await notifyEvent({
    eventKey: `${base}:admins`,
    actorId,
    title: adminTitle,
    body: adminBody,
    type: isMa ? 'ma_job_assigned' : 'job_assigned',
    data,
    recipients: await getAdminIds(),
    resend: source === 'assign' || source === 'import' || source === 'auto',
  });
}

/** Assign to a specific user (+ optional shared team bag mates). */
async function notifyJobsAssignedToUser({
  userId,
  userName = 'ช่าง',
  teamId = null,
  notifyTeam = true,
  jobIds = [],
  jobs = [],
  count,
  actorId = null,
  kind = 'office',
}) {
  if (!userId) return;
  const n = Number(count) || jobIds.length || jobs.length || 1;
  const isMa = kind === 'ma';
  const base = `${isMa ? 'ma' : 'job'}.assign_user:${batchKey(jobIds.length ? jobIds : jobs.map((j) => j.id))}:user:${userId}`;
  const icon = isMa ? '🔧' : '📋';
  const jobWord = isMa ? 'งาน MA' : 'งาน';
  const path = jobPath({ jobIds, kind, queue: 'assigned' });

  let assigneeBody =
    n === 1 && jobs?.[0]
      ? `คุณได้รับมอบหมาย${jobWord} ${refLabel(jobs[0], kind)}${customerBit(jobs[0])}${formatAppt(jobs[0], kind)}`
      : `คุณได้รับมอบหมาย${jobWord}ใหม่ ${n} รายการ`;

  await notifyEvent({
    eventKey: `${base}:assignee`,
    actorId,
    title: `${icon} คุณได้รับมอบหมายงาน`,
    body: assigneeBody,
    type: isMa ? 'ma_job_assigned' : 'job_assigned',
    data: {
      related_id: jobIds[0] || jobs[0]?.id || null,
      count: n,
      path,
      job_type: kind,
      assignee_id: userId,
    },
    recipients: [userId],
    resend: true,
  });

  if (notifyTeam && teamId) {
    const mates = (await getTeamMemberIds(teamId, { excludeUserId: actorId }))
      .filter((id) => Number(id) !== Number(userId));
    if (mates.length) {
      const mateBody =
        n === 1 && jobs?.[0]
          ? `${userName} ได้รับมอบหมาย ${refLabel(jobs[0], kind)}${customerBit(jobs[0])}`
          : `${userName} ได้รับมอบหมาย${jobWord} ${n} รายการ`;

      await notifyEvent({
        eventKey: `${base}:team`,
        actorId,
        title: `${icon} เพื่อนทีมได้รับงาน`,
        body: mateBody,
        type: isMa ? 'ma_job_assigned' : 'job_assigned',
        data: {
          related_id: jobIds[0] || jobs[0]?.id || null,
          team_id: teamId,
          count: n,
          path,
          job_type: kind,
        },
        recipients: mates,
        resend: true,
      });
    }
  }

  const adminBody =
    n === 1 && jobs?.[0]
      ? `มอบ ${refLabel(jobs[0], kind)} ให้ ${userName}${customerBit(jobs[0])}${formatAppt(jobs[0], kind)}`
      : `มอบ ${n} ${jobWord} ให้ ${userName}`;

  await notifyEvent({
    eventKey: `${base}:admins`,
    actorId,
    title: `${icon} มอบหมายให้ช่าง`,
    body: adminBody,
    type: isMa ? 'ma_job_assigned' : 'job_assigned',
    data: {
      related_id: jobIds[0] || jobs[0]?.id || null,
      count: n,
      path,
      job_type: kind,
      assignee_id: userId,
    },
    recipients: await getAdminIds(),
    resend: true,
  });
}

/** Notify previous team that a job was reassigned away. */
async function notifyJobsRemovedFromTeam({
  teamId,
  teamName = 'ทีม',
  jobIds = [],
  jobs = [],
  newTeamName = 'ทีมใหม่',
  actorId = null,
  kind = 'office',
}) {
  if (!teamId) return;
  const isMa = kind === 'ma';
  const n = Number(jobIds.length || jobs.length) || 1;
  const base = `${isMa ? 'ma' : 'job'}.removed:${batchKey(jobIds.length ? jobIds : jobs.map((j) => j.id))}:from:${teamId}`;
  const icon = isMa ? '🔧' : '📋';
  const path = jobPath({ jobIds, kind, queue: 'assigned' });

  let body =
    n === 1 && jobs?.[0]
      ? `งาน ${refLabel(jobs[0], kind)} ถูกย้ายออกจากทีมไป ${newTeamName}`
      : `งาน ${n} รายการถูกย้ายออกจากทีมไป ${newTeamName}`;

  await notifyEvent({
    eventKey: `${base}:members`,
    actorId,
    title: `${icon} งานถูกย้ายออกจากทีม`,
    body,
    type: isMa ? 'ma_job_unassigned' : 'job_unassigned',
    data: {
      related_id: jobIds[0] || jobs[0]?.id || null,
      team_id: teamId,
      path,
      job_type: kind,
    },
    recipients: await getTeamMemberIds(teamId, { excludeUserId: actorId }),
  });
}

/** Job completed — admins only (actor skipped). */
async function notifyJobCompleted({
  job,
  jobId,
  actorId,
  actorName = 'ช่าง',
  kind = 'office',
}) {
  const isMa = kind === 'ma';
  const id = jobId || job?.id;
  const ref = refLabel({ ...job, id }, kind);
  const path = dispatchDashboardPath({ kind, jobId: id, openJob: id, queue: 'completed' });

  await notifyEvent({
    eventKey: `${isMa ? 'ma' : 'job'}.completed:${id}:admins`,
    actorId,
    title: isMa ? '✅ งาน MA เสร็จสิ้น' : '✅ งานเสร็จสิ้น',
    body: `${actorName} ปิดงาน ${ref}${customerBit(job)} เรียบร้อยแล้ว`,
    type: isMa ? 'ma_job_completed' : 'job_completed',
    data: {
      related_id: id,
      job_id: id,
      path,
      job_type: kind,
    },
    recipients: await getAdminIds(),
  });
}

/** Job failed — admins + original team. */
async function notifyJobFailed({
  job,
  jobId,
  actorId,
  actorName = 'ช่าง',
  remark = '',
  kind = 'office',
}) {
  const isMa = kind === 'ma';
  const id = jobId || job?.id;
  const ref = refLabel({ ...job, id }, kind);
  const reason = String(remark || '').trim().slice(0, 80);
  const base = `${isMa ? 'ma' : 'job'}.failed:${id}`;
  const path = dispatchDashboardPath({ kind, jobId: id, openJob: id, queue: 'failed' });

  const title = isMa ? '❌ งาน MA ไม่จบ' : '❌ งานไม่จบ';
  const body = `${actorName} รายงานงาน ${ref} ไม่สำเร็จ${reason ? `: ${reason}` : ''}`;
  const data = {
    related_id: id,
    job_id: id,
    path,
    job_type: kind,
  };

  await notifyEvent({
    eventKey: `${base}:admins`,
    actorId,
    title,
    body,
    type: isMa ? 'ma_job_failed' : 'job_failed',
    data,
    recipients: await getAdminIds(),
  });

  if (job?.team_id) {
    await notifyEvent({
      eventKey: `${base}:team:${job.team_id}`,
      actorId,
      title,
      body: `งาน ${ref} ในทีมถูกบันทึกว่าไม่สำเร็จ${reason ? `: ${reason}` : ''}`,
      type: isMa ? 'ma_job_failed' : 'job_failed',
      data: { ...data, team_id: job.team_id },
      recipients: await getTeamMemberIds(job.team_id, { excludeUserId: actorId }),
    });
  }
}

/** Job postponed — admins + original team (before team cleared). */
async function notifyJobPostponed({
  job,
  jobId,
  actorId,
  actorName = 'ช่าง',
  newDate,
  remark = '',
  kind = 'office',
}) {
  const isMa = kind === 'ma';
  const id = jobId || job?.id;
  const ref = refLabel({ ...job, id }, kind);
  const note = String(remark || '').trim().slice(0, 60);
  const base = `${isMa ? 'ma' : 'job'}.postponed:${id}:${newDate || ''}`;
  const path = dispatchDashboardPath({
    kind,
    jobId: id,
    openJob: id,
    queue: 'tech_reschedule',
    date: newDate || undefined,
  });

  const title = isMa ? '📅 เลื่อนนัดงาน MA' : '📅 เลื่อนนัดงาน';
  const body =
    `${actorName} เลื่อนนัดงาน ${ref} ไปวันที่ ${newDate || '-'}` +
    (note ? `: ${note}` : '');
  const data = {
    related_id: id,
    job_id: id,
    path,
    job_type: kind,
    new_date: newDate || '',
  };

  await notifyEvent({
    eventKey: `${base}:admins`,
    actorId,
    title,
    body,
    type: isMa ? 'ma_job_postponed' : 'job_postponed',
    data,
    recipients: await getAdminIds(),
  });

  if (job?.team_id) {
    await notifyEvent({
      eventKey: `${base}:team:${job.team_id}`,
      actorId,
      title,
      body: `งาน ${ref} ในทีมถูกเลื่อนนัดเป็น ${newDate || '-'}${note ? ` (${note})` : ''}`,
      type: isMa ? 'ma_job_postponed' : 'job_postponed',
      data: { ...data, team_id: job.team_id },
      recipients: await getTeamMemberIds(job.team_id, { excludeUserId: actorId }),
    });
  }
}

async function notifyImportSummary({
  kind = 'office',
  actorId = null,
  created = 0,
  updated = 0,
  teamStats = {},
}) {
  const isMa = kind === 'ma';
  const stamp = new Date().toISOString().slice(0, 16);
  const icon = isMa ? '🔧' : '📋';

  const entries = teamStats instanceof Map
    ? [...teamStats.entries()]
    : Object.entries(teamStats);

  for (const [teamIdRaw, stat] of entries) {
    const teamId = Number(teamIdRaw);
    if (!teamId) continue;
    const c = Number(stat.created) || 0;
    const u = Number(stat.updated) || 0;
    if (c + u <= 0) continue;
    await notifyJobsAssignedToTeam({
      teamId,
      teamName: stat.name || 'ทีม',
      jobIds: stat.jobIds || [],
      count: c + u,
      actorId,
      kind,
      source: 'import',
      extraLine: [
        c ? `งานใหม่ ${c}` : null,
        u ? `อัปเดต ${u}` : null,
      ].filter(Boolean).join(' · '),
    });
  }

  if (created + updated > 0) {
    await notifyEvent({
      eventKey: `${isMa ? 'ma' : 'job'}.import.summary:${stamp}:admins`,
      actorId,
      title: `${icon} Import ${isMa ? 'MA' : 'ติดตั้ง'} สำเร็จ`,
      body: [
        created ? `สร้างใหม่ ${created}` : null,
        updated ? `อัปเดต ${updated}` : null,
      ].filter(Boolean).join(' · ') || 'นำเข้าเสร็จสิ้น',
      type: isMa ? 'ma_import' : 'job_import',
      data: {
        created,
        updated,
        path: dispatchDashboardPath({ kind, queue: 'all' }),
        job_type: kind,
      },
      recipients: await getAdminIds(),
    });
  }
}

module.exports = {
  notifyJobsAssignedToTeam,
  notifyJobsAssignedToUser,
  notifyJobsRemovedFromTeam,
  notifyJobCompleted,
  notifyJobFailed,
  notifyJobPostponed,
  notifyImportSummary,
  batchKey,
  refLabel,
  dispatchDashboardPath,
  bagPath,
  checkinPath,
  usersPath,
  dashboardPath,
};
