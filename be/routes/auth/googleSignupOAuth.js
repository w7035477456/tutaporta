import crypto from 'crypto';
import pool from '../../db/connection.js';
import { getPublicAppUrl } from '../../utils/publicAppUrl.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';

const EMAIL_EXISTS_ERROR =
  'This email already exist in out system. Please double check your email.';
const OAUTH_RESULT_STORAGE_KEY = 'googleSignupOAuthResult';
const OAUTH_BROADCAST_CHANNEL = 'google-signup-oauth';
const OAUTH_ACK_TYPE = 'google-signup-oauth-ack';
const GOOGLE_SIGNUP_EMAIL_STORAGE_KEY = 'googleSignupEmail';
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
  const secret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  if (!secret) throw new Error('Google sign-up is not configured on this server.');
  return secret;
}

function createOAuthState(returnOrigin) {
  const payload = {
    n: crypto.randomBytes(16).toString('hex'),
    t: Date.now(),
    o: normalizeOrigin(returnOrigin) || getPublicAppUrl()
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getOAuthStateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyOAuthState(stateRaw) {
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
    if (!Number.isFinite(ts) || Date.now() - ts > OAUTH_STATE_MAX_AGE_MS) return null;
    const returnOrigin = normalizeOrigin(payload?.o);
    if (!returnOrigin) return null;
    return { returnOrigin };
  } catch {
    return null;
  }
}

export function isGoogleSignupOAuthConfigured() {
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET || '').trim();
  return Boolean(clientId && clientSecret);
}

function getGoogleOAuthConfig() {
  if (!isGoogleSignupOAuthConfigured()) return null;
  const clientId = String(process.env.GOOGLE_OAUTH_CLIENT_ID).trim();
  const clientSecret = String(process.env.GOOGLE_OAUTH_CLIENT_SECRET).trim();
  const redirectUri =
    String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim() ||
    `${getPublicAppUrl()}/api/auth/google/signup/callback`;
  return { clientId, clientSecret, redirectUri };
}

function buildOAuthResultPayload({ success, email = '', error = '' }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return {
    type: 'google-signup-oauth',
    success: Boolean(success),
    email: normalizedEmail,
    error: success ? '' : String(error || 'Google sign-up failed')
  };
}

function renderPopupResultHtml({ success, email = '', error = '' }) {
  const payload = JSON.stringify(buildOAuthResultPayload({ success, email, error }));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Google sign-up</title>
</head>
<body>
  <p id="status" style="font-family:sans-serif;text-align:center;margin-top:2rem;">Completing Google sign-in…</p>
  <script>
    (function () {
      var payload = ${payload};
      var storageKey = ${JSON.stringify(OAUTH_RESULT_STORAGE_KEY)};
      var emailStorageKey = ${JSON.stringify(GOOGLE_SIGNUP_EMAIL_STORAGE_KEY)};
      var channelName = ${JSON.stringify(OAUTH_BROADCAST_CHANNEL)};
      var ackType = ${JSON.stringify(OAUTH_ACK_TYPE)};
      var targetOrigin = window.location.origin;
      var statusEl = document.getElementById('status');
      var closed = false;

      function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
      }

      function deliverToMainPage() {
        try {
          localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch (e) {}
        try {
          var channel = new BroadcastChannel(channelName);
          channel.postMessage(payload);
          channel.close();
        } catch (e) {}
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(payload, targetOrigin);
          } catch (e) {}
          if (payload.email) {
            try {
              window.opener.sessionStorage.setItem(emailStorageKey, payload.email);
            } catch (e) {}
          }
        }
      }

      function closePopup() {
        if (closed) return;
        closed = true;
        try {
          window.opener && window.opener.focus();
        } catch (e) {}
        window.close();
        setTimeout(function () {
          if (!window.closed) {
            setStatus('Google sign-in complete. You can close this window.');
          }
        }, 300);
      }

      function onAck(event) {
        if (event.origin !== targetOrigin) return;
        if (!event.data || event.data.type !== ackType) return;
        window.removeEventListener('message', onAck);
        clearInterval(retryTimer);
        setStatus('Returning to sign-up…');
        closePopup();
      }

      window.addEventListener('message', onAck);

      if (!window.opener || window.opener.closed) {
        deliverToMainPage();
        setStatus('Google sign-in complete. Return to the sign-up page.');
        return;
      }

      setStatus(payload.success ? 'Google sign-in succeeded. Returning…' : 'Google sign-in failed. Returning…');
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

async function exchangeCodeForTokens(code, config) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Failed to exchange Google authorization code');
  }
  return data;
}

async function fetchGoogleUserInfo(accessToken) {
  const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error_description || data?.error || 'Failed to load Google profile');
  }
  return data;
}

async function emailAlreadyRegistered(email) {
  const { rows } = await pool.query('SELECT 1 FROM helloworldjunktest.singles WHERE email = $1 LIMIT 1', [
    normalizeEmailForDb(email)
  ]);
  return rows.length > 0;
}

/** Task 1 start → Tasks 2–3 Google account/consent UI in popup. */
export function googleSignupStart(req, res) {
  const config = getGoogleOAuthConfig();
  if (!config) {
    return res.status(503).send('Google sign-up is not configured on this server.');
  }

  let state;
  try {
    const returnOrigin = resolveOAuthReturnOrigin(req);
    state = createOAuthState(returnOrigin);
  } catch (err) {
    console.error('[googleSignupOAuth] start failed:', err?.message ?? err);
    return res.status(503).send('Google sign-up is not configured on this server.');
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account'
  });

  console.log(
    '[googleSignupOAuth] authorize — copy redirect_uri into Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs:'
  );
  console.log('[googleSignupOAuth]   redirect_uri:', config.redirectUri);
  console.log('[googleSignupOAuth]   client_id:', config.clientId);
  if (String(process.env.GOOGLE_OAUTH_REDIRECT_URI || '').trim()) {
    console.log('[googleSignupOAuth]   redirect source: GOOGLE_OAUTH_REDIRECT_URI env');
  } else if (String(process.env.PUBLIC_APP_URL || '').trim()) {
    console.log('[googleSignupOAuth]   redirect source: PUBLIC_APP_URL =', String(process.env.PUBLIC_APP_URL).trim());
  } else {
    console.log('[googleSignupOAuth]   redirect source: getPublicAppUrl() default');
  }

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/** Task 4 — return email to opener; user completes phone sign-up on register page. */
export async function googleSignupCallback(req, res) {
  const config = getGoogleOAuthConfig();
  const verifiedState = verifyOAuthState(req.query?.state);
  const returnOrigin = verifiedState?.returnOrigin || getPublicAppUrl();

  if (!config) {
    return res.status(503).send(
      renderPopupResultHtml({ success: false, error: 'Google sign-up is not configured.' })
    );
  }

  const oauthError = String(req.query?.error || '').trim();
  if (oauthError) {
    const message =
      oauthError === 'access_denied'
        ? 'Google sign-up was cancelled.'
        : `Google sign-up failed (${oauthError}).`;
    return res.status(200).send(renderPopupResultHtml({ success: false, error: message }));
  }

  const code = String(req.query?.code || '').trim();
  const state = String(req.query?.state || '').trim();

  if (!code || !state || !verifiedState) {
    console.warn('[googleSignupOAuth] invalid state on callback', {
      hasCode: Boolean(code),
      hasState: Boolean(state),
      stateValid: Boolean(verifiedState)
    });
    return res.status(200).send(
      renderPopupResultHtml({
        success: false,
        error: 'Invalid Google sign-up session. Please try again.'
      })
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, config);
    const accessToken = String(tokens?.access_token || '').trim();
    if (!accessToken) {
      throw new Error('Google did not return an access token');
    }

    const profile = await fetchGoogleUserInfo(accessToken);
    const email = String(profile?.email || '')
      .trim()
      .toLowerCase();
    const emailVerified = profile?.email_verified === true || profile?.email_verified === 'true';

    if (!email) {
      throw new Error('Google did not share an email address for this account.');
    }
    if (!emailVerified) {
      throw new Error('Please verify your Google email address before signing up.');
    }

    if (await emailAlreadyRegistered(email)) {
      console.warn('[googleSignupOAuth] email already registered:', email);
      return res.status(200).send(
        renderPopupResultHtml({ success: false, email, error: EMAIL_EXISTS_ERROR })
      );
    }

    console.log('[googleSignupOAuth] success — returning email to register page:', email);
    return res.status(200).send(renderPopupResultHtml({ success: true, email }));
  } catch (err) {
    console.error('[googleSignupOAuth] callback failed:', err?.message ?? err);
    return res.status(200).send(
      renderPopupResultHtml({
        success: false,
        error: err?.message || 'Google sign-up failed. Please try again.'
      })
    );
  }
}
