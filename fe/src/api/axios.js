import axios from 'axios';
import { dispatchTooManyRequestsModal } from 'ui-component/TooManyRequestsModal';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { enforceClientApiCooldown } from 'utils/clientApiCooldown';
import { storeIdleLogoutNotice, storeSessionInvalidNotice, storeSessionSupersededNotice } from 'utils/sessionEndNotice';
import { forceAuthLoginRedirect, shouldForceLoginRedirect } from 'utils/forceAuthLoginRedirect';
import { requestPhotoAlbumsUsageRefresh } from 'utils/photoAlbumsUsageRefreshGate';

function shouldRefreshPhotoAlbumsUsageAfterRequest(url) {
  const s = String(url || '');
  if (!s.includes('/api/photoAlbums')) return false;
  if (s.includes('/api/photoAlbums/usage')) return false;
  if (s.includes('/api/photoAlbums/transfer-bytes')) return false;
  if (s.includes('/api/photoAlbums/onedrive/open-progress')) return false;
  if (s.includes('/api/photoAlbums/onedrive/sync-progress')) return false;
  if (s.includes('/api/photoAlbums/onedrive/logoff-progress')) return false;
  return true;
}

const LOGOUT_BLOCK_BACK_KEY = 'logoutBlockBack';
let sessionEndRedirectInFlight = false;
let sessionEndRedirectGeneration = 0;
let sessionEndAbortController = null;

/** Call after successful login so stale session-end redirects cannot wipe the new session. */
export function cancelPendingSessionEndRedirect() {
  sessionEndRedirectGeneration += 1;
  sessionEndRedirectInFlight = false;
  sessionEndAbortController?.abort();
  sessionEndAbortController = null;
}

function redirectToLoginAfterSessionEnd(error) {
  if (sessionEndRedirectInFlight) return;
  const path = window.location.pathname || '';
  if (path.includes('/pages/login')) return;

  sessionEndRedirectInFlight = true;
  const redirectGeneration = sessionEndRedirectGeneration;
  sessionEndAbortController?.abort();
  sessionEndAbortController = new AbortController();
  const { signal } = sessionEndAbortController;

  sessionStorage.setItem(LOGOUT_BLOCK_BACK_KEY, '1');
  if (error?.response?.data?.sessionSuperseded === true) {
    storeSessionSupersededNotice();
  } else if (error?.response?.data?.sessionInvalid === true) {
    storeSessionInvalidNotice(error?.response?.data?.error);
  } else if (error?.response?.data?.sessionExpired === true) {
    storeIdleLogoutNotice(error?.response?.data?.custom_logout_duration);
  }

  // Idle auto-logout must hit /api/logout so cache_onedrive_icon / cache_usb_icon are nulled.
  // Other session-end cases only clear the cookie (another device may still be logged in).
  const endSessionUrl =
    error?.response?.data?.sessionExpired === true ? '/api/logout' : '/api/clearAuthCookie';

  void api
    .post(endSessionUrl, { signal })
    .catch(() => {})
    .finally(() => {
      if (signal.aborted || redirectGeneration !== sessionEndRedirectGeneration) {
        sessionEndRedirectInFlight = false;
        return;
      }
      sessionEndRedirectInFlight = false;
      window.location.replace('/pages/login');
    });
}

function handleAuthFailureRedirect(error) {
  if (!shouldForceLoginRedirect(error)) return false;
  const data = error?.response?.data || {};
  if (data.sessionSuperseded === true || data.sessionInvalid === true || data.sessionExpired === true) {
    redirectToLoginAfterSessionEnd(error);
    return true;
  }
  void forceAuthLoginRedirect({ message: data.error || 'Please log in again.' });
  return true;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // Essential for sending/receiving cookies
  headers: {
    'Content-Type': 'application/json'
  }
});

// Traffic logging (>>>>>) installed from index.jsx via installFeBeTrafficLog(api)

api.interceptors.request.use((config) => {
  enforceClientApiCooldown(config.url || '', { base: config.baseURL || getApiBaseUrl() });
  return config;
});

// Add interceptor to handle 401s and 429 (rate limit) globally
api.interceptors.response.use(
  (response) => {
    const url = `${response.config?.baseURL || ''}${response.config?.url || ''}`;
    if (shouldRefreshPhotoAlbumsUsageAfterRequest(url)) {
      requestPhotoAlbumsUsageRefresh();
    }
    return response;
  },
  (error) => {
    const url = `${error.config?.baseURL || ''}${error.config?.url || ''}`;
    if (shouldRefreshPhotoAlbumsUsageAfterRequest(url)) {
      requestPhotoAlbumsUsageRefresh();
    }
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      if (handleAuthFailureRedirect(error)) {
        return Promise.reject(error);
      }
    }
    if (error.response && error.response.status === 429) {
      if (error.response.data?.maxAttemptsReached) {
        return Promise.reject(error);
      }
      // Vault Encrypt Password lockout uses 429 with remainingSeconds — not API rate limit.
      const url = String(error.config?.url || '');
      if (
        url.includes('/api/recordVault/access/fail') ||
        error.response.data?.remainingSeconds != null ||
        error.response.data?.lockoutSeconds != null
      ) {
        return Promise.reject(error);
      }
      dispatchTooManyRequestsModal();
      return Promise.reject(error);
    }
    return Promise.reject(error);
  }
);

export default api;
