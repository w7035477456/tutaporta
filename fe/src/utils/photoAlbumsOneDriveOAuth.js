import { getApiBaseUrl } from 'config/apiBaseUrl';
import { fetchPhotoAlbumsOneDriveStatus } from 'api/photoAlbumsFe';
import { rvCloudError, rvCloudLog, rvCloudWarn } from 'utils/photoAlbumsCloudDebugLog';

export const PHOTO_ALBUMS_ONEDRIVE_OAUTH_MESSAGE_TYPE = 'photo-albums-onedrive-oauth';
export const PHOTO_ALBUMS_ONEDRIVE_OAUTH_ACK_TYPE = 'photo-albums-onedrive-oauth-ack';
export const PHOTO_ALBUMS_ONEDRIVE_OAUTH_RESULT_KEY = 'photoAlbumsOneDriveOAuthResult';
export const PHOTO_ALBUMS_ONEDRIVE_BROADCAST_CHANNEL = 'photo-albums-onedrive-oauth';

const POPUP_POLL_MS = 150;
const POPUP_CLOSE_GRACE_MS = 3000;
const STATUS_POLL_MS = 1000;

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
  if (!data || data.type !== PHOTO_ALBUMS_ONEDRIVE_OAUTH_MESSAGE_TYPE) return null;
  return data;
}

function readOAuthResultFromLocalStorage() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PHOTO_ALBUMS_ONEDRIVE_OAUTH_RESULT_KEY);
    if (!raw) return null;
    return parseOAuthResultPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function clearOAuthResultLocalStorage() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PHOTO_ALBUMS_ONEDRIVE_OAUTH_RESULT_KEY);
  } catch {
    // ignore
  }
}

function sendAckToPopup(popup, sourceWindow) {
  const ack = { type: PHOTO_ALBUMS_ONEDRIVE_OAUTH_ACK_TYPE, received: true };
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

/** Close an in-flight OneDrive OAuth popup (e.g. user clicked Skip OneDrive). */
export function closePhotoAlbumsOneDriveOAuthPopup() {
  if (typeof window === 'undefined') return;
  try {
    const popup = window.open('', 'photoAlbumsOneDriveOAuth');
    closePopupQuietly(popup);
  } catch {
    // ignore
  }
  clearOAuthResultLocalStorage();
}

export function openPhotoAlbumsOneDriveOAuthPopup(loginHint = '') {
  return new Promise((resolve, reject) => {
    const provider = 'OneDrive';
    if (typeof window === 'undefined') {
      rvCloudError(provider, 'FE oauth popup unavailable — no window', new Error('not in browser'));
      reject(new Error('OneDrive login is only available in the browser.'));
      return;
    }

    clearOAuthResultLocalStorage();

    const width = 520;
    const height = 640;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const returnOrigin = encodeURIComponent(window.location.origin);
    const loginHintValue = String(loginHint || '').trim().toLowerCase();
    const loginHintQuery = loginHintValue ? `&loginHint=${encodeURIComponent(loginHintValue)}` : '';
    const url = `${getApiBaseUrl()}/api/photoAlbums/onedrive/oauth/start?returnOrigin=${returnOrigin}${loginHintQuery}`;
    rvCloudLog(provider, 'FE oauth opening popup', {
      url,
      returnOrigin: window.location.origin,
      loginHint: loginHintValue || null
    });
    const popup = window.open(
      url,
      'photoAlbumsOneDriveOAuth',
      `popup=yes,width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      rvCloudError(provider, 'FE oauth popup blocked', new Error('popup blocked'));
      reject(new Error('Popup blocked. Allow popups for this site and try again.'));
      return;
    }
    rvCloudLog(provider, 'FE oauth popup opened');

    let settled = false;
    let pollTimer = null;
    let closeGraceTimer = null;
    let broadcastChannel = null;
    let lastSourceWindow = null;
    let statusPollInFlight = false;
    let lastStatusPollAt = 0;
    let statusSnapshotAtStart = { connected: false, email: '' };
    const expectedEmail = String(loginHint || '').trim().toLowerCase();

    void fetchPhotoAlbumsOneDriveStatus()
      .then((status) => {
        statusSnapshotAtStart = {
          connected: Boolean(status?.onedrive?.connected),
          email: String(status?.onedrive?.email || '').trim().toLowerCase()
        };
      })
      .catch(() => {
        statusSnapshotAtStart = { connected: false, email: '' };
      });

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

    const finishResolve = (email) => {
      if (settled) return;
      settled = true;
      rvCloudLog(provider, 'FE oauth popup resolved success', { email });
      cleanup();
      clearOAuthResultLocalStorage();
      sendAckToPopup(popup, lastSourceWindow);
      window.setTimeout(() => closePopupQuietly(popup), 50);
      resolve(String(email || '').trim().toLowerCase());
    };

    const finishReject = (message, errorSecondary = '') => {
      if (settled) return;
      settled = true;
      rvCloudWarn(provider, 'FE oauth popup rejected', { message, errorSecondary });
      cleanup();
      clearOAuthResultLocalStorage();
      sendAckToPopup(popup, lastSourceWindow);
      window.setTimeout(() => closePopupQuietly(popup), 50);
      const err = new Error(message || 'OneDrive connection failed');
      if (errorSecondary) err.errorSecondary = errorSecondary;
      reject(err);
    };

    const handleOAuthResult = (data, sourceWindow) => {
      const parsed = parseOAuthResultPayload(data);
      if (!parsed) return false;
      rvCloudLog(provider, 'FE oauth result received', {
        success: parsed.success,
        email: parsed.email || null,
        error: parsed.error || null,
        errorSecondary: parsed.errorSecondary || null,
        debug: parsed.debug || null,
        via: sourceWindow ? 'postMessage' : 'storage/broadcast'
      });
      if (sourceWindow) lastSourceWindow = sourceWindow;
      if (parsed.success && parsed.email) {
        finishResolve(String(parsed.email).trim().toLowerCase());
        return true;
      }
      if (parsed.error) {
        finishReject(parsed.error, parsed.errorSecondary || '');
        return true;
      }
      return false;
    };

    const tryConsumePendingResult = () => {
      const fromLocal = readOAuthResultFromLocalStorage();
      if (fromLocal && handleOAuthResult(fromLocal, null)) return true;
      return false;
    };

    const tryConsumeStatusPoll = async () => {
      if (statusPollInFlight || settled) return false;
      const now = Date.now();
      if (now - lastStatusPollAt < STATUS_POLL_MS) return false;
      lastStatusPollAt = now;
      statusPollInFlight = true;
      try {
        const status = await fetchPhotoAlbumsOneDriveStatus();
        const connected = Boolean(status?.onedrive?.connected);
        const email = String(status?.onedrive?.email || '').trim().toLowerCase();
        if (!connected || !email) return false;
        if (
          statusSnapshotAtStart.connected &&
          email === statusSnapshotAtStart.email
        ) {
          return false;
        }
        if (expectedEmail && email !== expectedEmail) return false;
        rvCloudLog(provider, 'FE oauth resolved via status poll', { email });
        finishResolve(email);
        return true;
      } catch (err) {
        rvCloudWarn(provider, 'FE oauth status poll failed', { message: err?.message || String(err) });
        return false;
      } finally {
        statusPollInFlight = false;
      }
    };

    const onMessage = (event) => {
      if (!isAllowedOAuthMessageOrigin(event.origin)) {
        rvCloudWarn(provider, 'FE oauth postMessage ignored — origin mismatch', {
          origin: event.origin,
          expected: window.location.origin
        });
        return;
      }
      if (event.data?.type === PHOTO_ALBUMS_ONEDRIVE_OAUTH_ACK_TYPE) return;
      handleOAuthResult(event.data, event.source);
    };

    const onStorage = (event) => {
      if (event.key !== PHOTO_ALBUMS_ONEDRIVE_OAUTH_RESULT_KEY || !event.newValue) return;
      try {
        handleOAuthResult(JSON.parse(event.newValue), null);
      } catch {
        // ignore
      }
    };

    try {
      broadcastChannel = new BroadcastChannel(PHOTO_ALBUMS_ONEDRIVE_BROADCAST_CHANNEL);
      broadcastChannel.onmessage = (event) => handleOAuthResult(event.data, null);
    } catch {
      broadcastChannel = null;
    }

    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);

    let popupWasOpen = true;
    pollTimer = window.setInterval(() => {
      if (tryConsumePendingResult()) return;
      void tryConsumeStatusPoll();
      const isClosed = popup.closed;
      if (popupWasOpen && isClosed) {
        popupWasOpen = false;
        if (closeGraceTimer != null) return;
        closeGraceTimer = window.setTimeout(() => {
          void (async () => {
            if (tryConsumePendingResult()) return;
            if (await tryConsumeStatusPoll()) return;
            rvCloudWarn(provider, 'FE oauth popup closed before result');
            finishReject('OneDrive login was closed before completion.');
          })();
        }, POPUP_CLOSE_GRACE_MS);
      }
    }, POPUP_POLL_MS);
  });
}
