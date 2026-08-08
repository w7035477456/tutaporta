import api from 'api/axios';
import { storeSessionInvalidNotice } from 'utils/sessionEndNotice';

const LOGOUT_BLOCK_BACK_KEY = 'logoutBlockBack';

let authRedirectInFlight = false;

function requestUrl(error) {
  const raw = error?.config?.url || '';
  return String(raw).split('?')[0];
}

/** True when the client should clear auth and send the user to login (never show inline "Authentication required"). */
export function shouldForceLoginRedirect(error) {
  const status = Number(error?.response?.status);
  if (!Number.isFinite(status) || (status !== 401 && status !== 403)) return false;

  const url = requestUrl(error);
  if (url.includes('/api/verifyPassword')) return false;
  if (url.includes('/api/me')) return false;
  if (url.includes('/api/clearAuthCookie')) return false;

  const data = error?.response?.data || {};
  if (data.sessionSuperseded === true || data.sessionInvalid === true || data.sessionExpired === true) {
    return true;
  }

  const serverError = String(data.error ?? '').trim();
  if (status === 401 && serverError === 'Authentication required') return true;

  return false;
}

/** True when an Admin Tools tab passed a plain string auth failure message. */
export function isAuthFailureMessage(message) {
  const text = String(message ?? '').trim();
  return text === 'Authentication required' || text === 'Admin access required';
}

/**
 * Clear httpOnly auth cookie and hard-navigate to login.
 * Safe to call multiple times (deduped).
 */
export async function forceAuthLoginRedirect({ message } = {}) {
  if (authRedirectInFlight) return;
  if (typeof window === 'undefined') return;

  const path = window.location.pathname || '';
  if (path.includes('/pages/login')) return;

  authRedirectInFlight = true;
  sessionStorage.setItem(LOGOUT_BLOCK_BACK_KEY, '1');
  storeSessionInvalidNotice(message || 'Please log in again.');

  try {
    await api.post('/api/clearAuthCookie');
  } catch {
    /* best-effort cookie clear */
  }

  window.location.replace('/pages/login');
}
