import { buildMockAcademicSummaryResponse } from './measureoneMockData.js';

const DEFAULT_STAGING_API_URL = 'https://api-stg.measureone.com';
const DEFAULT_STAGING_HOST = 'api-stg.measureone.com';
const DEFAULT_LINK_SCRIPT = 'https://api-stg.measureone.com/v3/js/m1-link-2021042000.js';
const API_VERSION = 3;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function toTrimmedText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function hostNameFromApiUrl(apiUrl) {
  return String(apiUrl ?? '')
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
}

export function getMeasureOneConfig() {
  const env = String(process.env.MEASUREONE_ENV || process.env.NODE_ENV || '').trim().toLowerCase();
  const isProduction = env === 'production' || env === 'prod' || env === 'live';
  const apiUrl =
    toTrimmedText(process.env.MEASUREONE_API_URL) ||
    toTrimmedText(process.env.M1_API_URL) ||
    (isProduction ? 'https://api.measureone.com' : DEFAULT_STAGING_API_URL);
  const normalizedApiUrl = String(apiUrl).replace(/\/+$/, '');
  const hostName =
    toTrimmedText(process.env.MEASUREONE_HOST_NAME) ||
    hostNameFromApiUrl(normalizedApiUrl) ||
    (isProduction ? 'api.measureone.com' : DEFAULT_STAGING_HOST);
  const linkScriptUrl = toTrimmedText(process.env.MEASUREONE_LINK_SCRIPT_URL) || DEFAULT_LINK_SCRIPT;
  const mockFlag = String(process.env.MEASUREONE_MOCK ?? '').trim().toLowerCase();
  const clientId = toTrimmedText(process.env.MEASUREONE_CLIENT_ID) || toTrimmedText(process.env.M1_CLIENT_ID);
  const clientSecret = toTrimmedText(process.env.MEASUREONE_CLIENT_SECRET) || toTrimmedText(process.env.M1_CLIENT_SECRET);
  const hasCredentials = Boolean(clientId && clientSecret);
  const mockEnabled =
    mockFlag === 'true' || (mockFlag !== 'false' && !hasCredentials && !isProduction);

  return {
    clientId,
    clientSecret,
    apiUrl: normalizedApiUrl,
    hostName,
    linkScriptUrl,
    mockEnabled
  };
}

export function isMeasureOneConfigured() {
  const config = getMeasureOneConfig();
  return Boolean(config.mockEnabled || (config.clientId && config.clientSecret));
}

function basicAuthHeader(clientId, clientSecret) {
  const token = Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function parseMeasureOneResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message =
      toTrimmedText(data?.error_message) ||
      toTrimmedText(data?.message) ||
      toTrimmedText(data?.error) ||
      `MeasureOne API error (${response.status})`;
    const err = new Error(message);
    err.statusCode = response.status;
    err.responseBody = data ?? raw;
    throw err;
  }
  return data;
}

export function formatMeasureOneError(error) {
  const message = toTrimmedText(error?.message) || 'MeasureOne request failed';
  if (error?.statusCode === 401 || /unauthorized|invalid client/i.test(message)) {
    return (
      'MeasureOne rejected your API credentials. Register at https://www.measureone.com/dev-account, ' +
      'then set MEASUREONE_CLIENT_ID and MEASUREONE_CLIENT_SECRET (or M1_CLIENT_ID / M1_CLIENT_SECRET) in ~/.ssh/be/.env. ' +
      'For staging use MEASUREONE_API_URL=https://api-stg.measureone.com.'
    );
  }
  return message;
}

export async function measureOneRequest(config, routePath, { method = 'POST', accessToken, body, includeVersionHeader = true } = {}) {
  const url = `${config.apiUrl}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  };
  if (includeVersionHeader) {
    headers.version = String(API_VERSION);
  }
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  } else if (config.clientId && config.clientSecret) {
    headers.Authorization = basicAuthHeader(config.clientId, config.clientSecret);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });
  return parseMeasureOneResponse(response);
}

export async function getMeasureOneAccessToken(config = getMeasureOneConfig()) {
  if (config.mockEnabled) {
    return 'mock-measureone-access-token';
  }
  if (!config.clientId || !config.clientSecret) {
    throw new Error('MeasureOne is not configured');
  }

  const now = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 30_000) {
    return cachedAccessToken;
  }

  let data;
  try {
    data = await measureOneRequest(config, '/v3/auth/generate_access_token', {
      body: {},
      includeVersionHeader: false
    });
  } catch (error) {
    cachedAccessToken = null;
    cachedAccessTokenExpiresAt = 0;
    const err = new Error(formatMeasureOneError(error));
    err.statusCode = error?.statusCode;
    err.responseBody = error?.responseBody;
    throw err;
  }

  const accessToken = toTrimmedText(data?.access_token);
  if (!accessToken) {
    throw new Error('MeasureOne access token missing from auth response');
  }

  const expiresInSeconds = Number(data?.expires_in);
  cachedAccessToken = accessToken;
  cachedAccessTokenExpiresAt =
    Number.isFinite(expiresInSeconds) && expiresInSeconds > 0
      ? now + expiresInSeconds * 1000
      : now + 55 * 60 * 1000;

  return accessToken;
}

export async function generateMeasureOnePublicToken(config, accessToken, { individualId, datarequestId }) {
  if (config.mockEnabled) {
    return 'mock-measureone-public-token';
  }

  const scopes = ['WIDGET', 'ENTERPRISE_WIDGET'];
  let lastError = null;
  for (const scope of scopes) {
    try {
      const data = await measureOneRequest(config, '/v3/auth/generate_public_token', {
        accessToken,
        body: {
          scope,
          policy: {
            individual_id: individualId,
            datarequest_id: datarequestId
          }
        }
      });
      const publicToken = toTrimmedText(data?.access_token) || toTrimmedText(data?.public_token);
      if (publicToken) return publicToken;
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) throw lastError;
  return accessToken;
}

export async function createMeasureOneIndividual(config, accessToken, individual) {
  if (config.mockEnabled) {
    return { id: `idv_mock_${individual.external_id}` };
  }
  return measureOneRequest(config, '/v3/individuals/new', {
    accessToken,
    body: individual
  });
}

export async function createMeasureOneDataRequest(config, accessToken, { individualId, type = 'ACADEMIC_SUMMARY' }) {
  if (config.mockEnabled) {
    return { id: `dr_mock_${individualId}` };
  }
  return measureOneRequest(config, '/v3/datarequests/new', {
    accessToken,
    body: {
      individual_id: individualId,
      type
    }
  });
}

export async function fetchMeasureOneAcademicSummary(config, accessToken, datarequestId) {
  if (config.mockEnabled) {
    return buildMockAcademicSummaryResponse(datarequestId);
  }

  return measureOneRequest(config, '/v3/services/get_academic_summary', {
    accessToken,
    body: { datarequest_id: datarequestId }
  });
}

function normalizeCompareText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function pickPrimaryDegree(degrees) {
  if (!Array.isArray(degrees) || !degrees.length) return null;
  const ranked = [...degrees].sort((a, b) => {
    const aDate = Date.parse(String(a?.awarded_date ?? '')) || 0;
    const bDate = Date.parse(String(b?.awarded_date ?? '')) || 0;
    return bDate - aDate;
  });
  const awarded =
    ranked.find((degree) => String(degree?.status ?? '').trim().toUpperCase() === 'AWARDED') ||
    ranked.find((degree) => degree?.awarded_date) ||
    ranked[0];
  return awarded || null;
}

export function extractEducationFromAcademicSummary(summaryResponse) {
  const summaries = Array.isArray(summaryResponse?.academic_summary) ? summaryResponse.academic_summary : [];
  if (!summaries.length) return null;

  const summary = summaries[0];
  const degree = pickPrimaryDegree(summary.degrees);
  const collegeName =
    toTrimmedText(summary.teaching_institution?.name) ||
    toTrimmedText(summary.degree_awarding_institution?.name) ||
    toTrimmedText(summary.datasource?.name);

  const highestDegree =
    toTrimmedText(degree?.description) ||
    toTrimmedText(degree?.type)?.replace(/_/g, ' ') ||
    null;
  const graduationDate = toTrimmedText(degree?.awarded_date) || toTrimmedText(summary.attendance?.[0]?.end_date);

  if (!collegeName && !highestDegree && !graduationDate) {
    return null;
  }

  return {
    collegeName,
    highestDegree,
    graduationDate,
    institutionLabel: collegeName || toTrimmedText(summary.datasource?.name)
  };
}

export function compareEducationField(reportedValue, verifiedValue) {
  const reported = normalizeCompareText(reportedValue);
  const verified = normalizeCompareText(verifiedValue);
  if (!verified) return null;
  if (!reported) return 'info_matches';
  return reported === verified ? 'info_matches' : 'info_not_matches';
}

export async function waitForCompletedAcademicSummary(config, accessToken, datarequestId, options = {}) {
  const maxAttempts = Number(options.maxAttempts) || 20;
  const delayMs = Number(options.delayMs) || 3000;
  let lastResponse = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    lastResponse = await fetchMeasureOneAcademicSummary(config, accessToken, datarequestId);
    const status = String(lastResponse?.processing_status ?? '').trim().toUpperCase();
    if (status === 'COMPLETED') {
      return lastResponse;
    }
    if (status !== 'ACQUIRING' && status !== 'IN_PROGRESS') {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const err = new Error('MeasureOne academic summary is not ready yet');
  err.responseBody = lastResponse;
  throw err;
}
