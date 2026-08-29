import crypto from 'crypto';
import pool from '../../db/connection.js';
import { getPublicAppUrl } from '../../utils/publicAppUrl.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';
import { issueUserLoginSession } from '../../utils/issueUserLoginSession.js';
import { isSinglesStatusLoginAllowed } from '../../utils/singlesStatus.js';
import { normalizeMemberCategoryEnum } from '../../utils/memberCategory.js';
import { insertNewSinglesAccount } from '../../utils/newSinglesAccount.js';
import { hashPassword } from '../../utils/passwordHash.js';
import {
  formatPhoneForDuplicateCheck,
  isDuplicatePhoneAllowed,
  respondIfDuplicatePhone
} from '../../utils/duplicatePhonePolicy.js';
import { getUsSignupPhoneValidationMessage, validateUsSignupPhone } from '../../utils/usPhoneValidation.js';
import { resolveSignupMemberCategory } from '../../utils/signupMemberCategory.js';
import { resolveReferByCodeForSignup } from '../../utils/referByCode.js';
import { processReferralSignupReward } from '../../utils/referralSignupReward.js';
import { attachOrInsertSignupLoginLog } from '../../utils/loginLog.js';

const OAUTH_RESULT_STORAGE_KEY = 'googleSignupOAuthResult';
const OAUTH_BROADCAST_CHANNEL = 'google-signup-oauth';
const OAUTH_ACK_TYPE = 'google-signup-oauth-ack';
const GOOGLE_SIGNUP_EMAIL_STORAGE_KEY = 'googleSignupEmail';
const GOOGLE_SIGNUP_TOKEN_STORAGE_KEY = 'googleSignupToken';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;
const SIGNUP_TOKEN_MAX_AGE_MS = 10 * 60 * 1000;

const USER_SELECT = `SELECT singles_id, prefix, member_id, alias, email, profile_image_fk, password_hash, member_category, status,
                seeded_demo_buddies_boolean, gender_self_report
         FROM helloworldjunktest.singles s`;

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

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', getOAuthStateSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySignedPayload(raw, maxAgeMs) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = value.slice(0, dot);
  const sig = value.slice(dot + 1);
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
    if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) return null;
    return payload;
  } catch {
    return null;
  }
}

function createOAuthState(returnOrigin) {
  return signPayload({
    n: crypto.randomBytes(16).toString('hex'),
    t: Date.now(),
    o: normalizeOrigin(returnOrigin) || getPublicAppUrl()
  });
}

function verifyOAuthState(stateRaw) {
  const payload = verifySignedPayload(stateRaw, OAUTH_STATE_MAX_AGE_MS);
  if (!payload) return null;
  const returnOrigin = normalizeOrigin(payload?.o);
  if (!returnOrigin) return null;
  return { returnOrigin };
}

/** Short-lived proof that Google verified this email for signup completion. */
export function createGoogleSignupToken(email) {
  return signPayload({
    n: crypto.randomBytes(16).toString('hex'),
    t: Date.now(),
    e: normalizeEmailForDb(email),
    k: 'google_signup'
  });
}

export function verifyGoogleSignupToken(tokenRaw, email) {
  const payload = verifySignedPayload(tokenRaw, SIGNUP_TOKEN_MAX_AGE_MS);
  if (!payload || payload.k !== 'google_signup') return null;
  const tokenEmail = normalizeEmailForDb(payload.e);
  if (!tokenEmail || tokenEmail !== normalizeEmailForDb(email)) return null;
  return { email: tokenEmail };
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

function buildOAuthResultPayload({ success, email = '', error = '', action = '', signupToken = '' }) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  return {
    type: 'google-signup-oauth',
    success: Boolean(success),
    email: normalizedEmail,
    action: success ? String(action || '') : '',
    signupToken: success && action === 'register' ? String(signupToken || '') : '',
    error: success ? '' : String(error || 'Google sign-up failed')
  };
}

function renderPopupResultHtml({ success, email = '', error = '', action = '', signupToken = '' }) {
  const payload = JSON.stringify(
    buildOAuthResultPayload({ success, email, error, action, signupToken })
  );

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
      var tokenStorageKey = ${JSON.stringify(GOOGLE_SIGNUP_TOKEN_STORAGE_KEY)};
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
          if (payload.signupToken) {
            try {
              window.opener.sessionStorage.setItem(tokenStorageKey, payload.signupToken);
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
        setStatus(payload.action === 'login' ? 'Signed in. Returning…' : 'Returning to sign-up…');
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

async function findSinglesByEmail(email) {
  const { rows } = await pool.query(
    `${USER_SELECT}
     WHERE LOWER(s.email) = $1
     ORDER BY COALESCE(s.updated_at, s.created_at) DESC
     LIMIT 1`,
    [normalizeEmailForDb(email)]
  );
  return rows[0] || null;
}

function isLockOutBlocking(user) {
  const lockOut = String(process.env.LOCK_OUT ?? '')
    .trim()
    .toLowerCase() === 'true';
  if (!lockOut) return false;
  const memberCategory = normalizeMemberCategoryEnum(user.member_category) ?? String(user.member_category ?? '').trim().toUpperCase();
  return memberCategory !== 'PILOTUSER' && memberCategory !== 'ADMIN';
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

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/**
 * Existing email → set auth cookie + action=login.
 * New email → action=register + signupToken (phone + Terms still required).
 */
export async function googleSignupCallback(req, res) {
  const config = getGoogleOAuthConfig();
  const verifiedState = verifyOAuthState(req.query?.state);

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

    const existing = await findSinglesByEmail(email);
    if (existing) {
      if (isLockOutBlocking(existing)) {
        return res.status(200).send(
          renderPopupResultHtml({
            success: false,
            email,
            error: 'Under construction. Please check back later.'
          })
        );
      }
      if (!isSinglesStatusLoginAllowed(existing.status, existing.member_category)) {
        return res.status(200).send(
          renderPopupResultHtml({
            success: false,
            email,
            error: 'Your account is not active. Please contact support.'
          })
        );
      }

      await issueUserLoginSession(res, existing, {
        rememberMe: false,
        log: (msg, data) => console.log('[googleSignupOAuth]', msg, data || '')
      });
      console.log('[googleSignupOAuth] login — existing account:', email);
      return res.status(200).send(
        renderPopupResultHtml({ success: true, email, action: 'login' })
      );
    }

    const signupToken = createGoogleSignupToken(email);
    console.log('[googleSignupOAuth] register — new email, returning token:', email);
    return res.status(200).send(
      renderPopupResultHtml({ success: true, email, action: 'register', signupToken })
    );
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

/**
 * POST /api/auth/google/signup/complete
 * body: { email, phone, signupToken, termsAccepted, ref?, referByCode?, token? }
 * Creates account with random password hash and logs the user in (no create-password email).
 */
export async function googleSignupComplete(req, res) {
  if (!isGoogleSignupOAuthConfigured()) {
    return res.status(503).json({ error: 'Google sign-up is not configured on this server.' });
  }

  const emailNorm = normalizeEmailForDb(req.body?.email);
  const signupToken = String(req.body?.signupToken || '').trim();
  const phoneRaw = req.body?.phone;
  const termsAccepted = req.body?.termsAccepted === true || req.body?.termsAccepted === 'true';

  if (!termsAccepted) {
    return res.status(400).json({ error: 'Please agree to the terms and conditions.' });
  }
  if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (!verifyGoogleSignupToken(signupToken, emailNorm)) {
    return res.status(400).json({
      error: 'Google sign-up session expired. Please click Sign up with Google again.'
    });
  }

  const phoneValidationMessage = getUsSignupPhoneValidationMessage(phoneRaw);
  if (!validateUsSignupPhone(phoneRaw).valid) {
    return res.status(400).json({ error: phoneValidationMessage || 'Please enter a valid US phone number.' });
  }

  const formattedPhone = formatPhoneForDuplicateCheck(phoneRaw);
  if (!formattedPhone) {
    return res.status(400).json({ error: 'Please enter a valid US phone number.' });
  }

  try {
    const existing = await findSinglesByEmail(emailNorm);
    if (existing) {
      if (isLockOutBlocking(existing)) {
        return res.status(403).json({ error: 'Under construction. Please check back later.' });
      }
      if (!isSinglesStatusLoginAllowed(existing.status, existing.member_category)) {
        return res.status(403).json({ error: 'Your account is not active. Please contact support.' });
      }
      const body = await issueUserLoginSession(res, existing, { rememberMe: false });
      return res.json(body);
    }

    const signupCategory = resolveSignupMemberCategory(emailNorm);
    if (!isDuplicatePhoneAllowed(signupCategory)) {
      if (await respondIfDuplicatePhone(res, formattedPhone, signupCategory)) return;
    }

    const resolvedReferByCode = resolveReferByCodeForSignup({
      referByCode: req.body?.referByCode,
      ref: req.body?.ref,
      token: req.body?.token
    });

    const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
    const account = await insertNewSinglesAccount(pool, {
      emailNorm,
      passwordHash,
      formattedPhone,
      referByCode: resolvedReferByCode
    });

    await processReferralSignupReward({
      newSinglesId: account.singlesId,
      newMemberId: account.memberId,
      newMemberEmail: emailNorm,
      referByCode: account.referByCode,
      isNewAccount: true
    });

    await attachOrInsertSignupLoginLog(req, {
      singlesId: account.singlesId,
      email: emailNorm,
      phone: formattedPhone
    });

    const user = await findSinglesByEmail(emailNorm);
    if (!user) {
      return res.status(500).json({ error: 'Account created but login failed. Please sign in with Google again.' });
    }

    console.log('[googleSignupOAuth] complete — account created:', {
      singlesId: account.singlesId,
      emailPrefix: `${emailNorm.slice(0, 3)}***`
    });

    const body = await issueUserLoginSession(res, user, { rememberMe: false });
    return res.json(body);
  } catch (err) {
    console.error('[googleSignupOAuth] complete failed:', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to complete Google sign-up. Please try again.' });
  }
}
