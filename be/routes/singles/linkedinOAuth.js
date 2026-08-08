import crypto from 'crypto';
import pool from '../../db/connection.js';
import { getPublicAppUrl } from '../../utils/publicAppUrl.js';
import { getAuthTokenFromCookies } from '../../utils/authCookie.js';
import { getPublicKey } from '../../jwtKeys.js';
import jwt from 'jsonwebtoken';
import {
  loadTableColumns,
  resolveBioSchema,
  sqlIdent,
  upsertBioRow
} from './checkrBioReviewDb.js';
import { setVetBioVerificationStatus } from '../../utils/vetBioVerificationServices.js';

const OAUTH_RESULT_STORAGE_KEY = 'linkedinOAuthResult';
const OAUTH_BROADCAST_CHANNEL = 'linkedin-oauth';
const OAUTH_ACK_TYPE = 'linkedin-oauth-ack';
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';
// Member positions (job title + company). Only reachable with LinkedIn Partner Program approval.
const LINKEDIN_POSITIONS_URL =
  'https://api.linkedin.com/v2/me?projection=(id,positions:(elements*(title,companyName,company~(localizedName),isCurrent,timePeriod)))';
const LINKEDIN_PROFILE_URL_MAX_CHARS = 255;

/**
 * Auto-verifying self-reported job title / company against LinkedIn requires the positions API,
 * which is gated behind LinkedIn Partner Program approval. Off by default so the standard
 * Sign In with LinkedIn (OpenID Connect) flow keeps working without partner access.
 * Enable in ~/.ssh/be/.env once approved: LINKEDIN_PARTNER_POSITIONS=true
 */
function isLinkedInPartnerPositionsEnabled() {
  return String(process.env.LINKEDIN_PARTNER_POSITIONS || '').trim().toLowerCase() === 'true';
}

/** Extra OAuth scope needed to read positions; only requested when partner mode is on. */
function getLinkedInPositionsScope() {
  return String(process.env.LINKEDIN_POSITIONS_SCOPE || 'r_member_position').trim();
}

function getLinkedInClientId() {
  return String(process.env.LINKEDIN_CLIENT_ID || process.env.ClientId || '').trim();
}

function getLinkedInClientSecret() {
  return String(process.env.LINKEDIN_CLIENT_SECRET || process.env.PrimaryClientSecret || '').trim();
}

export function isLinkedInOAuthConfigured() {
  return Boolean(getLinkedInClientId() && getLinkedInClientSecret());
}

function getLinkedInOAuthConfig() {
  if (!isLinkedInOAuthConfigured()) return null;
  const redirectUri =
    String(process.env.LINKEDIN_REDIRECT_URI || '').trim() ||
    `${getPublicAppUrl()}/api/auth/linkedin/callback`;
  return {
    clientId: getLinkedInClientId(),
    clientSecret: getLinkedInClientSecret(),
    redirectUri
  };
}

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
  const secret = getLinkedInClientSecret();
  if (!secret) throw new Error('LinkedIn OAuth is not configured on this server.');
  return secret;
}

function createOAuthState(payload) {
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
    return payload;
  } catch {
    return null;
  }
}

function normalizeLinkedInProfileUrl(raw) {
  let value = String(raw ?? '')
    .trim()
    .slice(0, LINKEDIN_PROFILE_URL_MAX_CHARS);
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, '')}`;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'linkedin.com') return '';
    const path = url.pathname.replace(/\/+$/, '');
    if (!/^\/in\/[^/]+$/i.test(path)) return '';
    return `https://www.linkedin.com${path.toLowerCase()}`;
  } catch {
    return '';
  }
}

function normalizeNamePart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, ' ');
}

function namesRoughlyMatch(linkedInProfile, firstName, lastName) {
  const liFirst = normalizeNamePart(linkedInProfile?.given_name);
  const liLast = normalizeNamePart(linkedInProfile?.family_name);
  const formFirst = normalizeNamePart(firstName);
  const formLast = normalizeNamePart(lastName);
  if (!liFirst || !liLast || !formFirst || !formLast) return false;
  const firstOk = liFirst === formFirst || liFirst.startsWith(formFirst) || formFirst.startsWith(liFirst);
  const lastOk = liLast === formLast || liLast.startsWith(formLast) || formLast.startsWith(liLast);
  return firstOk && lastOk;
}

function formatLinkedInLocale(locale) {
  if (locale == null || locale === '') return '';
  if (typeof locale === 'string') return locale.trim();
  if (typeof locale === 'object') {
    const country = String(locale.country ?? locale.COUNTRY ?? '').trim();
    const language = String(locale.language ?? locale.LANGUAGE ?? '').trim();
    if (country && language) return `${language}_${country}`;
    return country || language;
  }
  return '';
}

function buildProfileFields(linkedInProfile, profileUrl, { jobTitle = '', currentCompany = '' } = {}) {
  const localeLabel = formatLinkedInLocale(linkedInProfile?.locale);
  return {
    userId: String(linkedInProfile?.sub ?? '').trim(),
    names: String(linkedInProfile?.name ?? '').trim(),
    firstName: String(linkedInProfile?.given_name ?? '').trim(),
    lastName: String(linkedInProfile?.family_name ?? '').trim(),
    city: localeLabel ? `Locale: ${localeLabel}` : '',
    jobTitle: String(jobTitle ?? '').trim(),
    profileUrl: profileUrl || '',
    posts: '',
    currentCompany: String(currentCompany ?? '').trim(),
    workExperience: '',
    email: String(linkedInProfile?.email ?? '').trim(),
    picture: String(linkedInProfile?.picture ?? '').trim()
  };
}

function buildOAuthResultPayload({ success, intent, profile = null, error = '', sharePostId = '' }) {
  return {
    type: 'linkedin-oauth',
    success: Boolean(success),
    intent: String(intent || 'verify'),
    profile: profile || null,
    error: success ? '' : String(error || 'LinkedIn sign-in failed'),
    sharePostId: String(sharePostId || '').trim()
  };
}

function renderPopupResultHtml(payload) {
  const json = JSON.stringify(payload);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LinkedIn</title>
</head>
<body>
  <p id="status" style="font-family:sans-serif;text-align:center;margin-top:2rem;">Completing LinkedIn sign-in…</p>
  <script>
    (function () {
      var payload = ${json};
      var storageKey = ${JSON.stringify(OAUTH_RESULT_STORAGE_KEY)};
      var channelName = ${JSON.stringify(OAUTH_BROADCAST_CHANNEL)};
      var ackType = ${JSON.stringify(OAUTH_ACK_TYPE)};
      var targetOrigin = window.location.origin;
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
          try { window.opener.postMessage(payload, targetOrigin); } catch (e) {}
        }
      }

      function closePopup() {
        if (closed) return;
        closed = true;
        try { window.opener && window.opener.focus(); } catch (e) {}
        window.close();
        setTimeout(function () {
          if (!window.closed) setStatus('LinkedIn sign-in complete. You can close this window.');
        }, 300);
      }

      function onAck(event) {
        if (event.origin !== targetOrigin) return;
        if (!event.data || event.data.type !== ackType) return;
        window.removeEventListener('message', onAck);
        clearInterval(retryTimer);
        setStatus('Returning…');
        closePopup();
      }

      window.addEventListener('message', onAck);

      if (!window.opener || window.opener.closed) {
        deliverToMainPage();
        setStatus('LinkedIn sign-in complete. Return to the previous page.');
        return;
      }

      setStatus(payload.success ? 'LinkedIn sign-in succeeded. Returning…' : 'LinkedIn sign-in failed. Returning…');
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
  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.warn('[linkedinOAuth] token exchange failed', {
      status: response.status,
      error: data?.error,
      errorDescription: data?.error_description,
      redirectUri: config.redirectUri,
      clientId: config.clientId
    });
    throw new Error(data?.error_description || data?.error || 'Failed to exchange LinkedIn authorization code');
  }
  return data;
}

async function fetchLinkedInUserInfo(accessToken) {
  const response = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Failed to load LinkedIn profile');
  }
  return data;
}

/**
 * Read the member's positions (job title + company) from LinkedIn.
 * Returns null when partner mode is off, the call is unauthorized (403 — no partner approval),
 * or the payload has no usable position — callers treat null as "could not verify", never an error.
 */
async function fetchLinkedInPositions(accessToken) {
  if (!isLinkedInPartnerPositionsEnabled()) return null;
  try {
    const response = await fetch(LINKEDIN_POSITIONS_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn('[linkedinOAuth] positions fetch not available', {
        status: response.status,
        error: data?.message || data?.error
      });
      return null;
    }
    const elements = Array.isArray(data?.positions?.elements) ? data.positions.elements : [];
    if (!elements.length) return null;
    const current = elements.find((p) => p?.isCurrent === true) || elements[0];
    if (!current) return null;
    const companyName =
      String(current.companyName ?? '').trim() ||
      String(current['company~']?.localizedName ?? '').trim();
    return {
      jobTitle: String(current.title ?? '').trim(),
      currentCompany: companyName
    };
  } catch (err) {
    console.warn('[linkedinOAuth] positions fetch failed:', err?.message ?? err);
    return null;
  }
}

/** Loose equality for free-text fields: case/whitespace-insensitive, allows prefix overlap. */
function textRoughlyMatches(reported, fromLinkedIn) {
  const a = normalizeNamePart(reported);
  const b = normalizeNamePart(fromLinkedIn);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a) || a.includes(b) || b.includes(a);
}

async function createLinkedInSharePost(accessToken, personUrn, { text, url }) {
  const shareText = String(text ?? '').trim();
  if (!shareText) throw new Error('Share text is required.');

  const specificContent = {
    'com.linkedin.ugc.ShareContent': {
      shareCommentary: { text: shareText },
      shareMediaCategory: url ? 'ARTICLE' : 'NONE'
    }
  };

  if (url) {
    specificContent['com.linkedin.ugc.ShareContent'].media = [
      {
        status: 'READY',
        originalUrl: String(url).trim()
      }
    ];
  }

  const response = await fetch(LINKEDIN_UGC_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0'
    },
    body: JSON.stringify({
      author: personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent,
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
      }
    })
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || 'Failed to share on LinkedIn');
  }

  return response.headers.get('X-RestLi-Id') || response.headers.get('x-restli-id') || '';
}

async function upsertVetBioFields(singlesId, fields) {
  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
  return upsertBioRow(pool, schemaName, 'vet_bio', singlesId, fields, vetColumns);
}

/** Save the member-entered LinkedIn profile URL onto singles.linkedin_url (Primary). */
async function saveSinglesLinkedInUrl(singlesId, profileUrl) {
  const url = String(profileUrl ?? '').trim();
  if (!url || !Number.isFinite(singlesId) || singlesId < 1) return;
  try {
    await pool.query(
      'UPDATE helloworldjunktest.singles SET linkedin_url = $1 WHERE singles_id = $2',
      [url, singlesId]
    );
  } catch (err) {
    console.warn(
      '[linkedinOAuth] could not save singles.linkedin_url (run be/db/addSinglesLinkedinUrlColumn.sql):',
      err?.message ?? err
    );
  }
}

/** Set <base>_vetted (+ date/note) on vet_bio if those columns exist. */
function applyVettedFields(updateFields, vetColumns, base, status, note, now) {
  if (vetColumns.has(`${base}_vetted`)) updateFields[`${base}_vetted`] = status;
  if (vetColumns.has(`${base}_vetted_date`)) updateFields[`${base}_vetted_date`] = now;
  if (vetColumns.has(`${base}_vetted_note`)) updateFields[`${base}_vetted_note`] = note;
}

async function persistLinkedInVerification(
  singlesId,
  { profileUrl, linkedInProfile, linkedInPositions = null, firstName, lastName, jobTitle = '', currentCompany = '' }
) {
  const fields = buildProfileFields(linkedInProfile, profileUrl, { jobTitle, currentCompany });
  const nameMatches = namesRoughlyMatch(linkedInProfile, firstName, lastName);
  const now = new Date();

  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');

  const updateFields = {};
  if (profileUrl) {
    updateFields.linkedin_url = profileUrl;
  }
  const trimmedJobTitle = String(jobTitle ?? '').trim();
  const trimmedCurrentCompany = String(currentCompany ?? '').trim();
  if (trimmedJobTitle) {
    updateFields.job_title = trimmedJobTitle;
  }
  if (trimmedCurrentCompany) {
    updateFields.current_company = trimmedCurrentCompany;
  }

  // Compare self-reported job title / company against LinkedIn positions (partner mode only).
  // When positions are unavailable (no approval), leave vetting untouched — the member still
  // self-reports, it is simply not auto-verified against LinkedIn.
  if (linkedInPositions) {
    if (trimmedJobTitle) {
      const jobMatch = textRoughlyMatches(trimmedJobTitle, linkedInPositions.jobTitle);
      applyVettedFields(
        updateFields,
        vetColumns,
        'job_title',
        jobMatch ? 'info_matches' : 'info_not_matched',
        jobMatch
          ? `Matches LinkedIn position "${linkedInPositions.jobTitle}"`
          : `Did not match LinkedIn position "${linkedInPositions.jobTitle || 'unknown'}"`,
        now
      );
    }
    if (trimmedCurrentCompany) {
      const companyMatch = textRoughlyMatches(trimmedCurrentCompany, linkedInPositions.currentCompany);
      applyVettedFields(
        updateFields,
        vetColumns,
        'current_company',
        companyMatch ? 'info_matches' : 'info_not_matched',
        companyMatch
          ? `Matches LinkedIn company "${linkedInPositions.currentCompany}"`
          : `Did not match LinkedIn company "${linkedInPositions.currentCompany || 'unknown'}"`,
        now
      );
    }
  }
  if (nameMatches) {
    updateFields.linkedin_url_vetted = 'info_matches';
    updateFields.linkedin_url_vetted_date = now;
    updateFields.linkedin_url_vetted_note = `LinkedIn OAuth verified member ${fields.userId}`;
  } else {
    updateFields.linkedin_url_vetted = 'info_not_matched';
    updateFields.linkedin_url_vetted_date = now;
    updateFields.linkedin_url_vetted_note = 'LinkedIn name did not match entered name';
  }

  if (vetColumns.has('linkedin_member_id')) {
    updateFields.linkedin_member_id = fields.userId || null;
  }
  if (vetColumns.has('linkedin_profile_json')) {
    updateFields.linkedin_profile_json = JSON.stringify({
      ...fields,
      raw: linkedInProfile,
      verifiedAt: now.toISOString()
    });
  }

  await upsertVetBioFields(singlesId, updateFields);
  const statusOk = await setVetBioVerificationStatus(singlesId, 'linkedin', nameMatches ? 'completed' : 'error');
  if (!statusOk) {
    throw new Error(
      'LinkedIn verification status could not be saved. Run be/db/addVetBioLinkedInVerificationColumns.sql.'
    );
  }

  return { fields, nameMatches };
}

function resolveSinglesIdFromRequest(req) {
  const fromAuth = Number(req.auth?.singles_id);
  if (Number.isFinite(fromAuth) && fromAuth > 0) return fromAuth;

  const token = getAuthTokenFromCookies(req.cookies);
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] });
    const singlesId = Number(decoded?.singles_id);
    return Number.isFinite(singlesId) && singlesId > 0 ? singlesId : null;
  } catch {
    return null;
  }
}

function scopesForIntent(intent) {
  if (intent === 'share') return 'openid profile w_member_social';
  // Only append the positions scope when partner mode is on; requesting an unapproved
  // scope makes LinkedIn reject the whole authorization request and breaks sign-in.
  if (intent === 'verify' && isLinkedInPartnerPositionsEnabled()) {
    return `openid profile email ${getLinkedInPositionsScope()}`.trim();
  }
  return 'openid profile email';
}

function logLinkedInAuthorizeRequest({ intent, config, singlesId, returnOrigin }) {
  const scope = scopesForIntent(intent);
  const previewParams = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope
  });

  console.log('[linkedinOAuth] authorize — copy redirect_uri into LinkedIn Developer Portal → Auth → Authorized redirect URLs:');
  console.log('[linkedinOAuth]   redirect_uri:', config.redirectUri);
  console.log('[linkedinOAuth]   client_id:', config.clientId);
  console.log('[linkedinOAuth]   scope:', scope);
  console.log('[linkedinOAuth]   intent:', intent);
  console.log('[linkedinOAuth]   singlesId:', singlesId);
  console.log('[linkedinOAuth]   returnOrigin:', returnOrigin);
  if (String(process.env.LINKEDIN_REDIRECT_URI || '').trim()) {
    console.log('[linkedinOAuth]   redirect source: LINKEDIN_REDIRECT_URI env');
  } else if (String(process.env.PUBLIC_APP_URL || '').trim()) {
    console.log('[linkedinOAuth]   redirect source: PUBLIC_APP_URL =', String(process.env.PUBLIC_APP_URL).trim());
  } else {
    console.log('[linkedinOAuth]   redirect source: getPublicAppUrl() default');
  }
  console.log('[linkedinOAuth]   authorize URL (no state):', `${LINKEDIN_AUTH_URL}?${previewParams.toString()}`);
}

async function startLinkedInOAuth(req, res, intent) {
  const config = getLinkedInOAuthConfig();
  if (!config) {
    return res.status(503).send('LinkedIn OAuth is not configured on this server.');
  }

  const singlesId = resolveSinglesIdFromRequest(req);
  if (!singlesId) {
    return res.status(401).send('Authentication required. Log in and try again.');
  }

  const profileUrl = normalizeLinkedInProfileUrl(req.query?.profileUrl);
  const firstName = String(req.query?.firstName ?? '').trim().slice(0, 80);
  const lastName = String(req.query?.lastName ?? '').trim().slice(0, 80);
  const jobTitle = String(req.query?.jobTitle ?? '').trim().slice(0, 255);
  const currentCompany = String(req.query?.currentCompany ?? '').trim().slice(0, 255);
  const shareText = String(req.query?.shareText ?? '').trim().slice(0, 3000);
  const shareUrl = String(req.query?.shareUrl ?? '').trim().slice(0, LINKEDIN_PROFILE_URL_MAX_CHARS);

  if (intent === 'verify' && !profileUrl) {
    return res.status(400).send('LinkedIn profile URL is required.');
  }
  if (intent === 'verify' && String(req.query?.profileUrl ?? '').trim().length > LINKEDIN_PROFILE_URL_MAX_CHARS) {
    return res.status(400).send(`LinkedIn profile URL must be ${LINKEDIN_PROFILE_URL_MAX_CHARS} characters or fewer.`);
  }
  if (intent === 'verify' && (!firstName || !lastName)) {
    return res.status(400).send('First name and last name are required.');
  }
  if (intent === 'share' && !shareText) {
    return res.status(400).send('Share text is required.');
  }

  let state;
  let returnOrigin;
  try {
    returnOrigin = resolveOAuthReturnOrigin(req);
    state = createOAuthState({
      n: crypto.randomBytes(16).toString('hex'),
      t: Date.now(),
      o: returnOrigin,
      intent,
      singlesId,
      profileUrl,
      firstName,
      lastName,
      jobTitle,
      currentCompany,
      shareText,
      shareUrl
    });
  } catch (err) {
    console.error('[linkedinOAuth] start failed:', err?.message ?? err);
    return res.status(503).send('LinkedIn OAuth is not configured on this server.');
  }

  if (intent === 'verify' && profileUrl) {
    await saveSinglesLinkedInUrl(singlesId, profileUrl);
    const vetFields = {};
    if (jobTitle) vetFields.job_title = jobTitle;
    if (currentCompany) vetFields.current_company = currentCompany;
    if (Object.keys(vetFields).length) {
      await upsertVetBioFields(singlesId, vetFields);
    }
  }

  logLinkedInAuthorizeRequest({ intent, config, singlesId, returnOrigin });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    scope: scopesForIntent(intent)
  });

  return res.redirect(`${LINKEDIN_AUTH_URL}?${params.toString()}`);
}

/** GET /api/auth/linkedin/verify/start — Sign in with LinkedIn (profile + email) for vet bio. */
export async function linkedInVerifyStart(req, res) {
  return startLinkedInOAuth(req, res, 'verify');
}

/** GET /api/auth/linkedin/share/start — Share on LinkedIn (w_member_social). */
export async function linkedInShareStart(req, res) {
  return startLinkedInOAuth(req, res, 'share');
}

/** GET /api/auth/linkedin/callback */
export async function linkedInOAuthCallback(req, res) {
  const config = getLinkedInOAuthConfig();
  const verifiedState = verifyOAuthState(req.query?.state);

  if (!config) {
    return res.status(200).send(
      renderPopupResultHtml(buildOAuthResultPayload({ success: false, intent: 'verify', error: 'LinkedIn OAuth is not configured.' }))
    );
  }

  const oauthError = String(req.query?.error || '').trim();
  if (oauthError) {
    console.warn('[linkedinOAuth] callback error from LinkedIn', {
      error: oauthError,
      errorDescription: String(req.query?.error_description || '').trim(),
      redirectUri: config.redirectUri,
      clientId: config.clientId
    });
    const message =
      oauthError === 'access_denied' ? 'LinkedIn sign-in was cancelled.' : `LinkedIn sign-in failed (${oauthError}).`;
    return res.status(200).send(
      renderPopupResultHtml(
        buildOAuthResultPayload({ success: false, intent: verifiedState?.intent || 'verify', error: message })
      )
    );
  }

  const code = String(req.query?.code || '').trim();
  const state = String(req.query?.state || '').trim();
  const intent = String(verifiedState?.intent || 'verify');

  if (!code || !state || !verifiedState) {
    return res.status(200).send(
      renderPopupResultHtml(
        buildOAuthResultPayload({ success: false, intent, error: 'Invalid LinkedIn session. Please try again.' })
      )
    );
  }

  const singlesId = Number(verifiedState?.singlesId);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(200).send(
      renderPopupResultHtml(buildOAuthResultPayload({ success: false, intent, error: 'Invalid member session.' }))
    );
  }

  try {
    const tokens = await exchangeCodeForTokens(code, config);
    const accessToken = String(tokens?.access_token || '').trim();
    if (!accessToken) throw new Error('LinkedIn did not return an access token');

    const linkedInProfile = await fetchLinkedInUserInfo(accessToken);
    const personUrn = linkedInProfile?.sub ? `urn:li:person:${linkedInProfile.sub}` : '';

    if (intent === 'share') {
      const sharePostId = await createLinkedInSharePost(accessToken, personUrn, {
        text: verifiedState.shareText,
        url: verifiedState.shareUrl
      });
      return res.status(200).send(
        renderPopupResultHtml(buildOAuthResultPayload({ success: true, intent: 'share', sharePostId }))
      );
    }

    const profileUrl = normalizeLinkedInProfileUrl(verifiedState.profileUrl);
    const linkedInPositions = await fetchLinkedInPositions(accessToken);
    const { fields, nameMatches } = await persistLinkedInVerification(singlesId, {
      profileUrl,
      linkedInProfile,
      linkedInPositions,
      firstName: verifiedState.firstName,
      lastName: verifiedState.lastName,
      jobTitle: verifiedState.jobTitle,
      currentCompany: verifiedState.currentCompany
    });

    if (!nameMatches) {
      return res.status(200).send(
        renderPopupResultHtml(
          buildOAuthResultPayload({
            success: false,
            intent: 'verify',
            profile: fields,
            error: 'LinkedIn name does not match the name you entered.'
          })
        )
      );
    }

    return res.status(200).send(
      renderPopupResultHtml(buildOAuthResultPayload({ success: true, intent: 'verify', profile: fields }))
    );
  } catch (err) {
    console.error('[linkedinOAuth] callback failed:', err?.message ?? err);
    return res.status(200).send(
      renderPopupResultHtml(
        buildOAuthResultPayload({
          success: false,
          intent,
          error: err?.message || 'LinkedIn sign-in failed. Please try again.'
        })
      )
    );
  }
}

const VETTED_NOT_STARTED = 'verifcation_not_started';

/**
 * POST /api/linkedin/save-employment
 * Persists self-reported job title and employer from the LinkedIn popup without OAuth.
 * Marks both fields verification_not_started when the member typed them manually.
 */
export async function saveSelfReportedEmployment(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const jobTitle = String(req.body?.jobTitle ?? '').trim().slice(0, 255);
  const currentCompany = String(req.body?.currentCompany ?? '').trim().slice(0, 255);
  if (!jobTitle && !currentCompany) {
    return res.status(400).json({ error: 'Enter a job title or employer name to save.' });
  }

  try {
    const schemaName = await resolveBioSchema();
    const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
    const now = new Date();
    const updateFields = {};

    if (jobTitle) {
      updateFields.job_title = jobTitle;
      applyVettedFields(updateFields, vetColumns, 'job_title', VETTED_NOT_STARTED, 'Self-reported', now);
    }
    if (currentCompany) {
      updateFields.current_company = currentCompany;
      applyVettedFields(updateFields, vetColumns, 'current_company', VETTED_NOT_STARTED, 'Self-reported', now);
    }

    await upsertVetBioFields(singlesId, updateFields);
    return res.json({ success: true, jobTitle: jobTitle || null, currentCompany: currentCompany || null });
  } catch (error) {
    console.error('[linkedinOAuth:saveSelfReportedEmployment]', error?.message || error);
    return res.status(500).json({ error: 'Failed to save employment details' });
  }
}

/**
 * POST /api/linkedin/save-url
 * Saves the member-entered LinkedIn profile URL to vet_bio.linkedin_url and singles.linkedin_url
 * (no OAuth). Used by the "View LinkedIn" button so the entered URL persists when viewed.
 */
export async function saveLinkedInProfileUrl(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const rawUrl = String(req.body?.profileUrl ?? '').trim();
  if (rawUrl.length > LINKEDIN_PROFILE_URL_MAX_CHARS) {
    return res.status(400).json({ error: `LinkedIn profile URL must be ${LINKEDIN_PROFILE_URL_MAX_CHARS} characters or fewer.` });
  }
  const profileUrl = normalizeLinkedInProfileUrl(rawUrl);
  if (!profileUrl) {
    return res.status(400).json({ error: 'Enter a valid LinkedIn profile URL (e.g. www.linkedin.com/in/your-profile).' });
  }

  try {
    await saveSinglesLinkedInUrl(singlesId, profileUrl);
    await upsertVetBioFields(singlesId, { linkedin_url: profileUrl });
    return res.json({ success: true, profileUrl });
  } catch (error) {
    console.error('[linkedinOAuth:saveLinkedInProfileUrl]', error?.message || error);
    return res.status(500).json({ error: 'Failed to save LinkedIn URL' });
  }
}

/** GET /api/linkedin/status */
export async function getLinkedInStatus(req, res) {
  const configured = isLinkedInOAuthConfigured();
  const redirectUri =
    String(process.env.LINKEDIN_REDIRECT_URI || '').trim() ||
    `${getPublicAppUrl()}/api/auth/linkedin/callback`;

  const partnerPositions = isLinkedInPartnerPositionsEnabled();

  return res.json({
    configured,
    redirectUri,
    partnerPositions,
    products: {
      signInOpenIdConnect: configured,
      shareOnLinkedIn: configured,
      positionsVerification: partnerPositions
    },
    openPermissions: ['openid', 'profile', 'email', 'w_member_social'],
    note: partnerPositions
      ? 'Partner mode on: self-reported job title and current company are auto-verified against the member\u2019s LinkedIn positions.'
      : 'Sign In with LinkedIn (OpenID Connect) returns name, email, photo, and member id. Auto-verifying job title and company against LinkedIn requires LinkedIn Partner Program approval (set LINKEDIN_PARTNER_POSITIONS=true once approved).'
  });
}
