/** Build frontend deep links for notification payloads. */

function qs(params) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v == null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

function dispatchDashboardPath({
  kind = 'office',
  jobId = null,
  openJob = null,
  queue = null,
  date = null,
} = {}) {
  const tab = kind === 'ma' ? 'ma' : 'office';
  const id = openJob || jobId;
  return `/dispatch-dashboard${qs({
    tab,
    openJob: id || undefined,
    queue: queue || undefined,
    date: date || undefined,
  })}`;
}

function bagPath({ userId = null } = {}) {
  if (userId) return `/bag${qs({ user_id: userId })}`;
  return '/bag';
}

function checkinPath({ tab = null, userId = null } = {}) {
  return `/checkin${qs({
    tab: tab || undefined,
    userId: userId || undefined,
  })}`;
}

function usersPath({ status = null } = {}) {
  return `/users${qs({ status: status || undefined })}`;
}

function dashboardPath() {
  return '/dashboard';
}

/** Map legacy /dispatch → dispatch dashboard. */
function normalizeNotificationPath(path) {
  if (!path || typeof path !== 'string') return null;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/')) return null;
  if (trimmed === '/dispatch' || trimmed.startsWith('/dispatch?')) {
    return trimmed.replace(/^\/dispatch/, '/dispatch-dashboard');
  }
  return trimmed;
}

module.exports = {
  dispatchDashboardPath,
  bagPath,
  checkinPath,
  usersPath,
  dashboardPath,
  normalizeNotificationPath,
};
