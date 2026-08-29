import { getApiBaseUrl } from 'config/apiBaseUrl';

export const GOOGLE_SIGNUP_OAUTH_MESSAGE_TYPE = 'google-signup-oauth';
export const GOOGLE_SIGNUP_OAUTH_ACK_TYPE = 'google-signup-oauth-ack';
export const GOOGLE_SIGNUP_EMAIL_STORAGE_KEY = 'googleSignupEmail';
export const GOOGLE_SIGNUP_TOKEN_STORAGE_KEY = 'googleSignupToken';
export const GOOGLE_SIGNUP_OAUTH_RESULT_KEY = 'googleSignupOAuthResult';
export const GOOGLE_SIGNUP_BROADCAST_CHANNEL = 'google-signup-oauth';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const POPUP_POLL_MS = 150;
const POPUP_CLOSE_GRACE_MS = 3000;

function isAllowedOAuthMessageOrigin(origin) {
  if (typeof window === 'undefined') return false;
  if (origin === window.location.origin) return true;
  try {
    return origin === new URL(getApiBaseUrl()).origin;
  } catch {
    return false;
  }
}

function parseOAuthResultPayload(data) {
  if (!data || data.type !== GOOGLE_SIGNUP_OAUTH_MESSAGE_TYPE) return null;
  return data;
}

export function persistGoogleSignupEmail(email) {
  if (typeof window === 'undefined') return;
  const normalized = String(email || '').trim().toLowerCase();
  if (!EMAIL_PATTERN.test(normalized)) return;
  try {
    sessionStorage.setItem(GOOGLE_SIGNUP_EMAIL_STORAGE_KEY, normalized);
  } catch {
    // ignore
  }
}

export function persistGoogleSignupToken(token) {
  if (typeof window === 'undefined') return;
  const raw = String(token || '').trim();
  if (!raw) return;
  try {
    sessionStorage.setItem(GOOGLE_SIGNUP_TOKEN_STORAGE_KEY, raw);
  } catch {
    // ignore
  }
}

export function clearGoogleSignupToken() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(GOOGLE_SIGNUP_TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function readStoredGoogleSignupEmail() {
  if (typeof window === 'undefined') return '';
  try {
    const raw = String(sessionStorage.getItem(GOOGLE_SIGNUP_EMAIL_STORAGE_KEY) || '')
      .trim()
      .toLowerCase();
    return EMAIL_PATTERN.test(raw) ? raw : '';
  } catch {
    return '';
  }
}

export function readStoredGoogleSignupToken() {
  if (typeof window === 'undefined') return '';
  try {
    return String(sessionStorage.getItem(GOOGLE_SIGNUP_TOKEN_STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

function readOAuthResultFromLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(GOOGLE_SIGNUP_OAUTH_RESULT_KEY);
    if (!raw) return null;
    return parseOAuthResultPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clearOAuthResultLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(GOOGLE_SIGNUP_OAUTH_RESULT_KEY);
  } catch {
    // ignore
  }
}

function sendAckToPopup(popup, sourceWindow) {
  const ack = { type: GOOGLE_SIGNUP_OAUTH_ACK_TYPE, received: true };
  const origin = window.location.origin;
  try {
    if (popup && !popup.closed) popup.postMessage(ack, origin);
  } catch {
    // ignore
  }
  try {
    if (sourceWindow && sourceWindow !== window && !sourceWindow.closed) {
      sourceWindow.postMessage(ack, origin);
    }
  } catch {
    // ignore
  }
}

function closePopupQuietly(popup) {
  try {
    if (popup && !popup.closed) popup.close();
  } catch {
    // ignore
  }
}

function normalizeOAuthSuccess(parsed) {
  const email = String(parsed?.email || '')
    .trim()
    .toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return null;
  const action = String(parsed?.action || '').trim().toLowerCase();
  const signupToken = String(parsed?.signupToken || '').trim();
  return {
    email,
    action: action === 'login' || action === 'register' ? action : 'register',
    signupToken: action === 'register' ? signupToken : ''
  };
}

/**
 * Opens Google OAuth popup.
 * Resolves with { email, action: 'login'|'register', signupToken }.
 * Cookie is already set when action is 'login'.
 */
export function openGoogleSignupPopup() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google sign-up is only available in the browser.'));
      return;
    }

    clearOAuthResultLocalStorage();

    const width = 520;
    const height = 640;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const returnOrigin = encodeURIComponent(window.location.origin);
    const url = `${getApiBaseUrl()}/api/auth/google/signup/start?popup=1&returnOrigin=${returnOrigin}`;
    const popup = window.open(
      url,
      'googleSignupOAuth',
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Allow popups for this site and try again.'));
      return;
    }

    let settled = false;
    let pollTimer = null;
    let closeGraceTimer = null;
    let broadcastChannel = null;
    let lastSourceWindow = null;

    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
      if (broadcastChannel) {
        try {
          broadcastChannel.close();
        } catch {
          // ignore
        }
        broadcastChannel = null;
      }
      if (pollTimer != null) clearInterval(pollTimer);
      if (closeGraceTimer != null) clearTimeout(closeGraceTimer);
    };

    const finishResolve = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      clearOAuthResultLocalStorage();
      sendAckToPopup(popup, lastSourceWindow);
      window.setTimeout(() => closePopupQuietly(popup), 50);
      persistGoogleSignupEmail(result.email);
      if (result.action === 'register' && result.signupToken) {
        persistGoogleSignupToken(result.signupToken);
      } else {
        clearGoogleSignupToken();
      }
      resolve(result);
    };

    const finishReject = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      clearOAuthResultLocalStorage();
      sendAckToPopup(popup, lastSourceWindow);
      window.setTimeout(() => closePopupQuietly(popup), 50);
      reject(new Error(message || 'Google sign-up failed'));
    };

    const handleOAuthResult = (data, sourceWindow) => {
      const parsed = parseOAuthResultPayload(data);
      if (!parsed) return false;
      if (sourceWindow) lastSourceWindow = sourceWindow;
      if (parsed.email && EMAIL_PATTERN.test(String(parsed.email).trim().toLowerCase())) {
        persistGoogleSignupEmail(parsed.email);
      }
      if (parsed.success) {
        const result = normalizeOAuthSuccess(parsed);
        if (result) {
          finishResolve(result);
          return true;
        }
      }
      if (parsed.error) {
        finishReject(parsed.error);
        return true;
      }
      return false;
    };

    const tryConsumePendingResult = () => {
      const fromLocal = readOAuthResultFromLocalStorage();
      if (fromLocal && handleOAuthResult(fromLocal, null)) return true;
      return false;
    };

    const onMessage = (event) => {
      if (!isAllowedOAuthMessageOrigin(event.origin)) return;
      if (event.data?.type === GOOGLE_SIGNUP_OAUTH_ACK_TYPE) return;
      handleOAuthResult(event.data, event.source);
    };

    const onStorage = (event) => {
      if (event.key !== GOOGLE_SIGNUP_OAUTH_RESULT_KEY || !event.newValue) return;
      try {
        handleOAuthResult(JSON.parse(event.newValue), null);
      } catch {
        // ignore
      }
    };

    try {
      broadcastChannel = new BroadcastChannel(GOOGLE_SIGNUP_BROADCAST_CHANNEL);
      broadcastChannel.onmessage = (event) => handleOAuthResult(event.data, null);
    } catch {
      broadcastChannel = null;
    }

    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);

    let popupWasOpen = true;
    pollTimer = window.setInterval(() => {
      if (tryConsumePendingResult()) return;
      const isClosed = popup.closed;
      if (popupWasOpen && isClosed) {
        popupWasOpen = false;
        if (closeGraceTimer != null) return;
        closeGraceTimer = window.setTimeout(() => {
          if (tryConsumePendingResult()) return;
          finishReject('Google sign-up was closed before completion.');
        }, POPUP_CLOSE_GRACE_MS);
      }
    }, POPUP_POLL_MS);
  });
}

export function readGoogleSignupEmailFromLocation(searchParams) {
  const raw = String(searchParams?.get('email') || '').trim().toLowerCase();
  if (!raw || !EMAIL_PATTERN.test(raw)) return '';
  return raw;
}

export function resolveGoogleSignupPrefillEmail(searchParams) {
  return readGoogleSignupEmailFromLocation(searchParams) || readStoredGoogleSignupEmail();
}
