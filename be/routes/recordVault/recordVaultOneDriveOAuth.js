import crypto from 'crypto';
import { getPublicAppUrl } from '../../utils/publicAppUrl.js';
import {
  ensureVaultRootFolder,
  exchangeOneDriveOAuthCode,
  fetchOneDriveUserEmail,
  getMicrosoftOAuthConfig,
  isOneDriveVaultOAuthConfigured,
  resolveOneDriveOAuthRedirectUri
} from '../../utils/recordVaultOneDrive/oneDriveApi.js';
import { saveOneDriveConnection } from '../../utils/recordVaultOneDrive/oneDriveTokenStore.js';
import { formatEmptyOneDriveVaultFolderIfNeeded } from '../../utils/recordVaultOneDrive/oneDriveVaultSync.js';
import { rvCloudDebug, rvCloudError, rvCloudLog, rvCloudWarn } from '../../utils/recordVaultCloudDebugLog.js';
import {
  formatMicrosoftOAuthProviderError,
  formatOAuthSaveError,
  formatOAuthTokenExchangeError,
  sanitizeOAuthCallbackQuery
} from '../../utils/recordVaultCloudOAuthErrors.js';
import { isVaultOneDriveOffered } from '../../utils/recordVaultStorageFlags.js';

const OAUTH_RESULT_STORAGE_KEY = 'recordVaultOneDriveOAuthResult';
const OAUTH_BROADCAST_CHANNEL = 'record-vault-onedrive-oauth';
const OAUTH_ACK_TYPE = 'record-vault-onedrive-oauth-ack';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

function normalizeOrigin(value) {
  try {
    return new URL(String(value || '').trim()).origin;
  } catch {
    return '';
  }
}

function resolveOAuthReturnOrigin(req) {
  const fromQuery = normalizeOrigin(req.query?.returnOrigin);
  if (fromQuery) return fromQuery;
  const fromHeader = normalizeOrigin(req?.headers?.origin);
  if (fromHeader) return fromHeader;
  const referer = String(req?.headers?.referer || req?.headers?.referrer || '').trim();
  if (referer) {
    const fromReferer = normalizeOrigin(referer);
    if (fromReferer) return fromReferer;
  }
  return getPublicAppUrl();
}

function getOAuthStateSecret() {
  const secret = String(process.env.MICROSOFT_OAUTH_CLIENT_SECRET || '').trim();
  if (!secret) throw new Error('OneDrive is not configured on this server.');
  return secret;
}

function createOneDriveOAuthState(returnOrigin, singlesId) {
  const payload = {
    n: crypto.randomBytes(16).toString('hex'),
    t: Date.now(),
    o: normalizeOrigin(returnOrigin) || getPublicAppUrl(),
    s: Number(singlesId),
    p: 'notes'
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getOAuthStateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyOneDriveOAuthState(stateRaw) {
  const raw = String(stateRaw || '').trim();
  if (!raw) return null;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', getOAuthStateSecret()).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const ts = Number(payload?.t);
    const singlesId = Number(payload?.s);
    if (!Number.isFinite(ts) || Date.now() - ts > OAUTH_STATE_MAX_AGE_MS) return null;
    if (!Number.isFinite(singlesId) || singlesId < 1) return null;
    const returnOrigin = normalizeOrigin(payload?.o);
    if (!returnOrigin) return null;
    const product = String(payload?.p || 'notes').trim() || 'notes';
    return { returnOrigin, singlesId, product };
  } catch {
    return null;
  }
}

function buildOAuthResultPayload({ success, email = '', error = '', errorSecondary = '', debug = null }) {
  return {
    type: 'record-vault-onedrive-oauth',
    success: Boolean(success),
    email: String(email || '').trim().toLowerCase(),
    error: success ? '' : String(error || 'OneDrive connection failed'),
    errorSecondary: success ? '' : String(errorSecondary || ''),
    debug: success ? null : debug || null
  };
}

function renderPopupResultHtml({ success, email = '', error = '', errorSecondary = '', returnOrigin = '' }) {
  const payload = JSON.stringify(buildOAuthResultPayload({ success, email, error, errorSecondary }));
  const failDetail = [error, errorSecondary].filter(Boolean).join('\n\n');
  const openerOriginJson = JSON.stringify(normalizeOrigin(returnOrigin) || '');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>OneDrive</title>
</head>
<body>
  <p id="status" style="font-family:sans-serif;text-align:center;margin-top:2rem;max-width:520px;margin-left:auto;margin-right:auto;padding:0 12px;white-space:pre-wrap;">Connecting OneDrive…</p>
  <script>
    (function () {
      var payload = ${payload};
      var storageKey = ${JSON.stringify(OAUTH_RESULT_STORAGE_KEY)};
      var channelName = ${JSON.stringify(OAUTH_BROADCAST_CHANNEL)};
      var ackType = ${JSON.stringify(OAUTH_ACK_TYPE)};
      var openerOrigin = ${openerOriginJson} || window.location.origin;
      var statusEl = document.getElementById('status');
      var closed = false;

      function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
      }

      function deliverToMainPage() {
        try { localStorage.setItem(storageKey, JSON.stringify(payload)); } catch (e) {}
        try {
          var channel = new BroadcastChannel(channelName);
          channel.postMessage(payload);
          channel.close();
        } catch (e) {}
        if (window.opener && !window.opener.closed) {
          try { window.opener.postMessage(payload, openerOrigin); } catch (e) {}
        }
      }

      function closePopup() {
        if (closed) return;
        closed = true;
        try { window.opener && window.opener.focus(); } catch (e) {}
        window.close();
        setTimeout(function () {
          if (!window.closed) setStatus('OneDrive connected. You can close this window.');
        }, 300);
      }

      function onAck(event) {
        if (event.origin !== openerOrigin) return;
        if (!event.data || event.data.type !== ackType) return;
        window.removeEventListener('message', onAck);
        clearInterval(retryTimer);
        setStatus('Returning to Record Vault…');
        closePopup();
      }

      window.addEventListener('message', onAck);

      if (!window.opener || window.opener.closed) {
        deliverToMainPage();
        var noOpenerRetryTimer = setInterval(deliverToMainPage, 120);
        setTimeout(function () { clearInterval(noOpenerRetryTimer); }, 10000);
        var returnUrl = openerOrigin ? (openerOrigin + '/myNote') : '/myNote';
        setStatus(
          payload.success
            ? 'OneDrive connected. Return to MyNote — if it does not update automatically, close this window or open: ' + returnUrl
            : (${JSON.stringify(failDetail)} || 'OneDrive connection failed. Return to Record Vault.')
        );
        return;
      }

      setStatus(payload.success ? 'OneDrive connected. Returning…' : (${JSON.stringify(failDetail)} || 'OneDrive connection failed. Returning…'));
      deliverToMainPage();
      var retryTimer = setInterval(deliverToMainPage, 120);
      setTimeout(function () {
        clearInterval(retryTimer);
        window.removeEventListener('message', onAck);
        if (!closed) closePopup();
      }, 10000);
    })();
  </script>
</body>
</html>`;
}

export { isOneDriveVaultOAuthConfigured };

/** GET /api/recordVault/onedrive/oauth/start */
export function recordVaultOneDriveOAuthStart(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  rvCloudLog('OneDrive', 'connect oauth/start hit', {
    singlesId,
    returnOriginQuery: req.query?.returnOrigin || null
  });
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    rvCloudWarn('OneDrive', 'connect oauth/start rejected — not authenticated');
    return res.status(401).send('Authentication required');
  }

  if (!isVaultOneDriveOffered()) {
    rvCloudWarn('OneDrive', 'connect oauth/start rejected — not offered (NOTES_ONE_DRIVE=false)');
    return res.status(404).send('OneDrive vault is not offered on this server.');
  }

  const config = getMicrosoftOAuthConfig();
  if (!config) {
    rvCloudWarn('OneDrive', 'connect oauth/start rejected — not configured', {
      hasClientId: Boolean(process.env.MICROSOFT_OAUTH_CLIENT_ID),
      hasClientSecret: Boolean(process.env.MICROSOFT_OAUTH_CLIENT_SECRET)
    });
    return res.status(503).send(
      'OneDrive is not configured on this server. Set real MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET in ~/.ssh/be/.env (copy from production Ubuntu), add localhost redirect URI in Azure, then restart the backend.'
    );
  }

  let state;
  let returnOrigin;
  let redirectUri;
  try {
    returnOrigin = resolveOAuthReturnOrigin(req);
    redirectUri = resolveOneDriveOAuthRedirectUri(returnOrigin);
    state = createOneDriveOAuthState(returnOrigin, singlesId);
    rvCloudLog('OneDrive', 'connect oauth/start redirecting to Microsoft', {
      singlesId,
      redirectUri,
      returnOrigin,
      clientIdPrefix: String(config.clientId || '').slice(0, 8),
      scope: 'openid profile email offline_access User.Read Files.ReadWrite'
    });
  } catch (err) {
    rvCloudError('OneDrive', 'connect oauth/start failed', err);
    return res.status(503).send('OneDrive is not configured on this server.');
  }

  const loginHint = String(req.query?.loginHint || '').trim().toLowerCase();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email offline_access User.Read Files.ReadWrite',
    state,
    response_mode: 'query',
    prompt: loginHint ? 'login' : 'select_account'
  });
  if (loginHint) {
    params.set('login_hint', loginHint);
  }

  rvCloudLog('OneDrive', 'connect oauth/start Microsoft authorize params', {
    singlesId,
    loginHint: loginHint || null,
    prompt: params.get('prompt')
  });

  return res.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`);
}

/** GET /api/recordVault/onedrive/oauth/callback */
export async function recordVaultOneDriveOAuthCallback(req, res) {
  // Photo Albums reuses this Azure-registered redirect; demux via OAuth state.p.
  const verifiedStateEarly = verifyOneDriveOAuthState(req.query?.state);
  if (verifiedStateEarly?.product === 'photoAlbums') {
    const { photoAlbumsOneDriveOAuthCallback } = await import('../photoAlbums/photoAlbumsOneDriveOAuth.js');
    return photoAlbumsOneDriveOAuthCallback(req, res);
  }

  const config = getMicrosoftOAuthConfig();
  const verifiedState = verifiedStateEarly;
  const returnOrigin = verifiedState?.returnOrigin || getPublicAppUrl();
  const redirectUri = resolveOneDriveOAuthRedirectUri(returnOrigin) || config?.redirectUri || null;
  const querySnapshot = sanitizeOAuthCallbackQuery(req.query);
  rvCloudLog('OneDrive', 'connect oauth/callback hit', {
    hasConfig: Boolean(config),
    query: querySnapshot,
    stateValid: Boolean(verifiedState),
    singlesId: verifiedState?.singlesId ?? null,
    redirectUri,
    returnOrigin,
    clientIdPrefix: config?.clientId ? String(config.clientId).slice(0, 8) : null
  });

  if (!config) {
    rvCloudWarn('OneDrive', 'connect oauth/callback — not configured');
    return res.status(503).send(
      renderPopupResultHtml({
        success: false,
        error: 'OneDrive is not configured on this server.',
        errorSecondary:
          'Set MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET in ~/.ssh/be/.env, then pm2 restart onlinemallwebsite.',
        returnOrigin
      })
    );
  }

  const oauthError = String(req.query?.error || '').trim();
  const errorDescription = String(req.query?.error_description || '').trim();
  const errorUri = String(req.query?.error_uri || '').trim();
  if (oauthError) {
    const formatted = formatMicrosoftOAuthProviderError({
      oauthError,
      errorDescription,
      errorUri,
      redirectUri,
      clientId: config.clientId
    });
    rvCloudWarn('OneDrive', 'connect oauth/callback Microsoft provider error', {
      ...formatted,
      query: querySnapshot,
      redirectUri,
      singlesId: verifiedState?.singlesId ?? null
    });
    return res.status(200).send(
      renderPopupResultHtml({
        success: false,
        error: formatted.primary,
        errorSecondary: formatted.secondary,
        returnOrigin
      })
    );
  }

  const code = String(req.query?.code || '').trim();
  const state = String(req.query?.state || '').trim();
  if (!code || !state || !verifiedState) {
    rvCloudWarn('OneDrive', 'connect oauth/callback invalid session', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      stateValid: Boolean(verifiedState),
      query: querySnapshot
    });
    return res.status(200).send(
      renderPopupResultHtml({
        success: false,
        error: 'Invalid OneDrive session. Please try again.',
        errorSecondary: hintInvalidSession({ redirectUri }),
        returnOrigin
      })
    );
  }

  try {
    rvCloudDebug('OneDrive', 'connect oauth/callback exchanging code', {
      singlesId: verifiedState.singlesId,
      redirectUri
    });
    let tokens;
    try {
      tokens = await exchangeOneDriveOAuthCode(code, redirectUri);
    } catch (exchangeErr) {
      rvCloudError('OneDrive', 'connect oauth/callback token exchange failed', exchangeErr, {
        singlesId: verifiedState.singlesId,
        redirectUri
      });
      const formatted = formatOAuthTokenExchangeError('OneDrive', parseTokenExchangeBody(exchangeErr), redirectUri);
      return res.status(200).send(
        renderPopupResultHtml({
          success: false,
          error: formatted.primary,
          errorSecondary: formatted.secondary,
          returnOrigin: verifiedState.returnOrigin
        })
      );
    }
    const refreshToken = String(tokens?.refresh_token || '').trim();
    const accessToken = String(tokens?.access_token || '').trim();
    const scope = String(tokens?.scope || '').trim();
    rvCloudDebug('OneDrive', 'connect oauth/callback token exchange ok', {
      hasRefreshToken: Boolean(refreshToken),
      hasAccessToken: Boolean(accessToken),
      scope: scope || null
    });
    if (!refreshToken) {
      throw new Error('Microsoft did not return a refresh token. Try disconnecting and connecting again.');
    }
    if (!accessToken) {
      throw new Error('Microsoft did not return an access token');
    }

    let email;
    try {
      email = await fetchOneDriveUserEmail(accessToken);
      rvCloudLog('OneDrive', 'connect oauth/callback profile loaded', { email });
    } catch (profileErr) {
      rvCloudError('OneDrive', 'connect oauth/callback profile fetch failed', profileErr, { singlesId: verifiedState.singlesId });
      return res.status(200).send(
        renderPopupResultHtml({
          success: false,
          error: 'OneDrive login succeeded but loading your Microsoft profile failed.',
          errorSecondary: String(profileErr?.message || profileErr),
          returnOrigin: verifiedState.returnOrigin
        })
      );
    }

    let folderId;
    try {
      folderId = await ensureVaultRootFolder(accessToken);
      try {
        await formatEmptyOneDriveVaultFolderIfNeeded(verifiedState.singlesId, accessToken, folderId, null);
      } catch (formatErr) {
        rvCloudError('OneDrive', 'connect oauth/callback vault format failed (continuing)', formatErr, {
          singlesId: verifiedState.singlesId,
          folderId
        });
      }
      rvCloudLog('OneDrive', 'connect oauth/callback vault folder ready', { folderId });
    } catch (folderErr) {
      rvCloudError('OneDrive', 'connect oauth/callback vault folder failed (continuing)', folderErr, {
        singlesId: verifiedState.singlesId
      });
      folderId = null;
    }

    try {
      await saveOneDriveConnection(verifiedState.singlesId, { refreshToken, folderId, email });
    } catch (saveErr) {
      rvCloudError('OneDrive', 'connect oauth/callback save connection failed', saveErr, {
        singlesId: verifiedState.singlesId
      });
      const formatted = formatOAuthSaveError('OneDrive', saveErr, {
        singlesId: verifiedState.singlesId,
        columnHint: 'Run be/db/addSinglesRecordVaultCloud.sql on Postgres Primary, then pm2 restart onlinemallwebsite.'
      });
      return res.status(200).send(
        renderPopupResultHtml({
          success: false,
          error: formatted.primary,
          errorSecondary: formatted.secondary,
          returnOrigin: verifiedState.returnOrigin
        })
      );
    }

    rvCloudLog('OneDrive', 'connect oauth/callback saved connection', {
      singlesId: verifiedState.singlesId,
      email,
      folderId
    });

    return res.status(200).send(
      renderPopupResultHtml({ success: true, email, returnOrigin: verifiedState.returnOrigin })
    );
  } catch (err) {
    rvCloudError('OneDrive', 'connect oauth/callback failed', err, {
      singlesId: verifiedState?.singlesId ?? null,
      redirectUri,
      query: querySnapshot
    });
    return res.status(200).send(
      renderPopupResultHtml({
        success: false,
        error: err?.message || 'OneDrive connection failed. Please try again.',
        errorSecondary:
          'Check PM2 logs for [RecordVaultCloud:OneDrive] connect oauth/callback. Verify Azure redirect URI, client secret, and Graph API permissions (User.Read, Files.ReadWrite).',
        returnOrigin: verifiedState?.returnOrigin || returnOrigin
      })
    );
  }
}

function hintInvalidSession({ redirectUri } = {}) {
  return [
    'The OAuth state or authorization code was missing or expired.',
    'Click Connect One Drive again and complete Microsoft login within a few minutes.',
    redirectUri ? `Expected redirect URI: ${redirectUri}` : ''
  ]
    .filter(Boolean)
    .join(' ');
}

function parseTokenExchangeBody(err) {
  const message = String(err?.message || '');
  const match = message.match(/Microsoft token exchange failed \(([^)]+)\)(?:: (.+))?/);
  if (!match) return { error: 'token_exchange_failed', error_description: message };
  return { error: match[1], error_description: match[2] || '' };
}
