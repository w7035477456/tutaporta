/** Safe snapshot of OAuth callback query params for PM2 logs (never includes code/state secrets). */
export function sanitizeOAuthCallbackQuery(query) {
  const q = query && typeof query === 'object' ? query : {};
  return {
    error: q.error ? String(q.error) : null,
    error_description: q.error_description ? String(q.error_description).slice(0, 500) : null,
    error_uri: q.error_uri ? String(q.error_uri) : null,
    hasCode: Boolean(q.code),
    hasState: Boolean(q.state),
    stateLength: q.state ? String(q.state).length : 0
  };
}

function hintLines(lines) {
  return lines.filter(Boolean).join(' ');
}

export function formatMicrosoftOAuthProviderError({
  oauthError,
  errorDescription = '',
  errorUri = '',
  redirectUri = '',
  clientId = ''
}) {
  const code = String(oauthError || 'unknown').trim();
  const desc = String(errorDescription || '').trim();
  const uri = String(errorUri || '').trim();
  const clientHint = clientId ? `Client ID starts with ${String(clientId).slice(0, 8)}…` : '';

  const hintsByCode = {
    server_error: hintLines([
      'Microsoft returned server_error (their login service failed or rejected the request).',
      'Common fixes: (1) Azure → Authentication → redirect URI must exactly match ONEDRIVE_VAULT_REDIRECT_URI in ~/.ssh/be/.env.',
      '(2) Certificates & secrets → create a client secret and set MICROSOFT_OAUTH_CLIENT_SECRET.',
      '(3) API permissions → Microsoft Graph delegated: User.Read, Files.ReadWrite, offline_access, openid, profile, email → Grant admin consent.',
      '(4) Supported account types must include personal Microsoft accounts.',
      '(5) Wait a few minutes and retry — can be a transient Microsoft outage.',
      clientHint
    ]),
    access_denied: 'You cancelled OneDrive login or declined permissions on the Microsoft consent screen.',
    invalid_client: hintLines([
      'Azure app client ID or client secret is wrong or expired.',
      'Regenerate the secret under Certificates & secrets, update MICROSOFT_OAUTH_CLIENT_SECRET, pm2 restart onlinemallwebsite.',
      clientHint
    ]),
    invalid_request: hintLines([
      'Microsoft rejected the authorize request (malformed redirect URI, scope, or client_id).',
      `Check redirect URI in Azure matches: ${redirectUri || '(ONEDRIVE_VAULT_REDIRECT_URI not set)'}.`,
      clientHint
    ]),
    temporarily_unavailable: 'Microsoft login is temporarily unavailable. Retry in a few minutes.',
    interaction_required: 'Microsoft requires you to sign in again. Click Connect One Drive and complete login.',
    consent_required: hintLines([
      'Microsoft requires admin or user consent for Graph permissions.',
      'Azure → API permissions → Grant admin consent, or sign in again and accept all requested permissions.'
    ]),
    unauthorized_client: hintLines([
      'This Azure app is not allowed to use this OAuth flow.',
      'Mac dev: copy MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET from production ~/.ssh/be/.env (not the placeholder your_azure_app_* values).',
      'Azure → App registrations → Authentication → add Web redirect URI for localhost: http://localhost:3000/api/recordVault/onedrive/oauth/callback',
      'Azure → Authentication → Supported account types must include personal Microsoft accounts (consumers).',
      'Azure → Authentication → ensure "Web" platform redirect URI is registered and client secret exists.'
    ])
  };

  const primary =
    code === 'access_denied'
      ? hintsByCode.access_denied
      : `OneDrive connection failed (Microsoft error: ${code}).`;

  const secondary = hintsByCode[code] || hintLines([
    desc || 'No error_description from Microsoft.',
    uri ? `Microsoft docs: ${uri}` : '',
    `Redirect URI sent to Microsoft: ${redirectUri || '(default from PUBLIC_APP_URL)'}.`,
    clientHint
  ]);

  return { primary, secondary, oauthError: code, errorDescription: desc, errorUri: uri };
}

export function formatOAuthTokenExchangeError(provider, data, redirectUri) {
  const err = String(data?.error || 'token_exchange_failed');
  const desc = String(data?.error_description || data?.error?.message || '').trim();
  const codes = String(data?.error_codes || '').trim();
  const trace = String(data?.correlation_id || data?.trace_id || '').trim();

  const primary = `${provider} token exchange failed (${err}).`;
  const secondary = hintLines([
    desc,
    codes ? `Microsoft error_codes: ${codes}.` : '',
    trace ? `correlation_id: ${trace} (include in Azure support ticket).` : '',
    err === 'invalid_client'
      ? 'Check MICROSOFT_OAUTH_CLIENT_ID and MICROSOFT_OAUTH_CLIENT_SECRET in ~/.ssh/be/.env.'
      : '',
    err === 'invalid_grant'
      ? 'Authorization code expired or redirect URI mismatch. Click Connect One Drive again immediately after Microsoft redirects.'
      : '',
    `redirect_uri used: ${redirectUri || '(not set)'}.`
  ]);

  return { primary, secondary, raw: { err, desc, codes, trace } };
}

export function formatOAuthSaveError(provider, err, { singlesId, columnHint = '' } = {}) {
  const message = String(err?.message || err || 'unknown');
  const isMissingColumn = /does not exist/i.test(message);
  const primary = `${provider} connected at Microsoft but saving the token on our server failed.`;
  const secondary = isMissingColumn
    ? hintLines([
        `Database error: ${message}.`,
        columnHint ||
          'Run be/db/addSinglesRecordVaultCloud.sql on Postgres Primary, then pm2 restart onlinemallwebsite.'
      ])
    : hintLines([
        `Server error: ${message}.`,
        singlesId ? `singles_id=${singlesId}.` : '',
        'Check PM2 logs for [RecordVaultCloud:OneDrive] connect oauth/callback failed.'
      ]);
  return { primary, secondary };
}
