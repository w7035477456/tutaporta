import { getApiBaseUrl } from 'config/apiBaseUrl';

export const LINKEDIN_OAUTH_MESSAGE_TYPE = 'linkedin-oauth';
export const LINKEDIN_OAUTH_ACK_TYPE = 'linkedin-oauth-ack';
export const LINKEDIN_OAUTH_RESULT_KEY = 'linkedinOAuthResult';
export const LINKEDIN_OAUTH_BROADCAST_CHANNEL = 'linkedin-oauth';

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
  if (!data || data.type !== LINKEDIN_OAUTH_MESSAGE_TYPE) return null;
  return data;
}

function readOAuthResultFromLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LINKEDIN_OAUTH_RESULT_KEY);
    if (!raw) return null;
    return parseOAuthResultPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clearOAuthResultLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LINKEDIN_OAUTH_RESULT_KEY);
  } catch {
    // ignore
  }
}

function sendAckToPopup(popup, sourceWindow) {
  const ack = { type: LINKEDIN_OAUTH_ACK_TYPE, received: true };
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

function buildLinkedInStartUrl(path, params) {
  const returnOrigin = encodeURIComponent(window.location.origin);
  const search = new URLSearchParams({ returnOrigin, ...params });
  return `${getApiBaseUrl()}${path}?${search.toString()}`;
}

/** Open a LinkedIn profile URL in a centered popup window (View LinkedIn). */
export function openLinkedInProfileWindow(url) {
  if (typeof window === 'undefined') return null;
  const target = String(url || '').trim();
  if (!target) return null;
  const width = 720;
  const height = 820;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  return window.open(
    target,
    'linkedinProfileView',
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

function openLinkedInOAuthPopup(url, windowName) {
  const width = 520;
  const height = 720;
  const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
  const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
  return window.open(
    url,
    windowName,
    `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
}

function waitForLinkedInOAuthResult(popup) {
  return new Promise((resolve, reject) => {
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

    const finishResolve = (payload) => {
      if (settled) return;
      settled = true;
      cleanup();
      clearOAuthResultLocalStorage();
      sendAckToPopup(popup, lastSourceWindow);
      window.setTimeout(() => closePopupQuietly(popup), 50);
      resolve(payload);
    };

    const finishReject = (message) => {
      if (settled) return;
      settled = true;
      cleanup();
      clearOAuthResultLocalStorage();
      sendAckToPopup(popup, lastSourceWindow);
      window.setTimeout(() => closePopupQuietly(popup), 50);
      reject(new Error(message || 'LinkedIn sign-in failed'));
    };

    const handleOAuthResult = (data, sourceWindow) => {
      const parsed = parseOAuthResultPayload(data);
      if (!parsed) return false;
      if (sourceWindow) lastSourceWindow = sourceWindow;
      if (parsed.success) {
        finishResolve(parsed);
        return true;
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
      if (event.data?.type === LINKEDIN_OAUTH_ACK_TYPE) return;
      handleOAuthResult(event.data, event.source);
    };

    const onStorage = (event) => {
      if (event.key !== LINKEDIN_OAUTH_RESULT_KEY || !event.newValue) return;
      try {
        handleOAuthResult(JSON.parse(event.newValue), null);
      } catch {
        // ignore
      }
    };

    try {
      broadcastChannel = new BroadcastChannel(LINKEDIN_OAUTH_BROADCAST_CHANNEL);
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
          finishReject('LinkedIn sign-in was closed before completion.');
        }, POPUP_CLOSE_GRACE_MS);
      }
    }, POPUP_POLL_MS);
  });
}

/** Sign in with LinkedIn (OpenID Connect profile + email) for vet bio Step 4. */
export function openLinkedInVerifyPopup({ profileUrl, firstName, lastName, jobTitle = '', currentCompany = '' }) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('LinkedIn sign-in is only available in the browser.'));
  }

  clearOAuthResultLocalStorage();
  const url = buildLinkedInStartUrl('/api/auth/linkedin/verify/start', {
    profileUrl: String(profileUrl || '').trim(),
    firstName: String(firstName || '').trim(),
    lastName: String(lastName || '').trim(),
    jobTitle: String(jobTitle || '').trim(),
    currentCompany: String(currentCompany || '').trim()
  });
  const popup = openLinkedInOAuthPopup(url, 'linkedinVerifyOAuth');
  if (!popup) {
    return Promise.reject(new Error('Popup blocked. Allow popups for this site and try again.'));
  }
  return waitForLinkedInOAuthResult(popup);
}

/** Share on LinkedIn (w_member_social). */
export function openLinkedInSharePopup({ text, url = '' }) {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Share on LinkedIn is only available in the browser.'));
  }

  clearOAuthResultLocalStorage();
  const startUrl = buildLinkedInStartUrl('/api/auth/linkedin/share/start', {
    shareText: String(text || '').trim(),
    shareUrl: String(url || '').trim()
  });
  const popup = openLinkedInOAuthPopup(startUrl, 'linkedinShareOAuth');
  if (!popup) {
    return Promise.reject(new Error('Popup blocked. Allow popups for this site and try again.'));
  }
  return waitForLinkedInOAuthResult(popup);
}
