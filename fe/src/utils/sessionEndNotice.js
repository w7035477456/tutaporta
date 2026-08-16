export const SESSION_END_NOTICE_KEY = 'sessionEndIdleLogoutNotice';
export const SESSION_END_MINUTES_KEY = 'sessionEndIdleLogoutMinutes';
export const SESSION_END_SUPERSEDED_KEY = 'sessionSupersededNotice';
export const SESSION_INVALID_NOTICE_KEY = 'sessionInvalidNotice';
export const SESSION_INVALID_MESSAGE_KEY = 'sessionInvalidNoticeMessage';

function formatLogoutDurationMinutes(minutes) {
  const n = Math.trunc(Number(minutes));
  const duration = Number.isFinite(n) && n > 0 ? n : 60;
  return duration === 1 ? '1 minute' : `${duration} minutes`;
}

export function buildIdleLogoutMessage(minutes) {
  const durationLabel = formatLogoutDurationMinutes(minutes);
  return `For your security, you have been logout after ${durationLabel} of inactivity. Please login again. You can customize logout duration under "Profile & Records"`;
}

export function buildSessionSupersededMessage() {
  return 'Your account was signed in on another device. Please sign in again. If this wasn\'t you, protect your account by contacting Support at support@tutamall.com.';
}

export function buildSessionInvalidMessage() {
  return 'Login User Identity Error detected, please login again. If login fail, please contact admin.';
}

export function storeSessionInvalidNotice(message) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SESSION_END_NOTICE_KEY);
  sessionStorage.removeItem(SESSION_END_MINUTES_KEY);
  sessionStorage.removeItem(SESSION_END_SUPERSEDED_KEY);
  sessionStorage.setItem(SESSION_INVALID_NOTICE_KEY, '1');
  const text = String(message ?? '').trim() || buildSessionInvalidMessage();
  sessionStorage.setItem(SESSION_INVALID_MESSAGE_KEY, text);
}

export function storeIdleLogoutNotice(minutes) {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SESSION_END_SUPERSEDED_KEY);
  sessionStorage.setItem(SESSION_END_NOTICE_KEY, '1');
  const n = Math.trunc(Number(minutes));
  if (Number.isFinite(n) && n > 0) {
    sessionStorage.setItem(SESSION_END_MINUTES_KEY, String(n));
  }
}

export function storeSessionSupersededNotice() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SESSION_END_NOTICE_KEY);
  sessionStorage.removeItem(SESSION_END_MINUTES_KEY);
  sessionStorage.setItem(SESSION_END_SUPERSEDED_KEY, '1');
}

export function clearSessionEndNotices() {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(SESSION_END_NOTICE_KEY);
  sessionStorage.removeItem(SESSION_END_MINUTES_KEY);
  sessionStorage.removeItem(SESSION_END_SUPERSEDED_KEY);
  sessionStorage.removeItem(SESSION_INVALID_NOTICE_KEY);
  sessionStorage.removeItem(SESSION_INVALID_MESSAGE_KEY);
}

/** Read once on login page; clears storage keys. */
export function consumeSessionEndNotice() {
  if (typeof sessionStorage === 'undefined') return null;

  if (sessionStorage.getItem(SESSION_INVALID_NOTICE_KEY) === '1') {
    sessionStorage.removeItem(SESSION_INVALID_NOTICE_KEY);
    const custom = sessionStorage.getItem(SESSION_INVALID_MESSAGE_KEY);
    sessionStorage.removeItem(SESSION_INVALID_MESSAGE_KEY);
    return custom || buildSessionInvalidMessage();
  }

  if (sessionStorage.getItem(SESSION_END_SUPERSEDED_KEY) === '1') {
    sessionStorage.removeItem(SESSION_END_SUPERSEDED_KEY);
    return buildSessionSupersededMessage();
  }

  if (sessionStorage.getItem(SESSION_END_NOTICE_KEY) !== '1') return null;

  sessionStorage.removeItem(SESSION_END_NOTICE_KEY);
  const raw = sessionStorage.getItem(SESSION_END_MINUTES_KEY);
  sessionStorage.removeItem(SESSION_END_MINUTES_KEY);

  const minutes = Math.trunc(Number(raw));
  return buildIdleLogoutMessage(minutes);
}
