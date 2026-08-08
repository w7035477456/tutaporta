import pool from '../../db/connection.js';
import { parseBooleanEnumRaw, sqlBooleanEnumLiteral, sqlBooleanEnumParam, toBooleanEnumLabel } from '../../utils/booleanEnum.js';

const CHECKR_SCHEMA = 'helloworldjunktest';
const FALSE_ENUM = sqlBooleanEnumLiteral(false, CHECKR_SCHEMA);

const DEFAULT_SANDBOX_BASE_URL = 'https://api.sandbox.checkr.com/v1';
const DEFAULT_PRODUCTION_BASE_URL = 'https://api.checkr.com/v1';

let checkrTableReady = false;

function toTrimmedText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function getCheckrConfig() {
  const env = String(process.env.CHECKR_ENV || process.env.NODE_ENV || '').trim().toLowerCase();
  const isProduction = env === 'production' || env === 'prod' || env === 'live';
  const baseUrl = toTrimmedText(process.env.CHECKR_BASE_URL) || (isProduction ? DEFAULT_PRODUCTION_BASE_URL : DEFAULT_SANDBOX_BASE_URL);
  return {
    apiKey: toTrimmedText(process.env.CHECKR_API_KEY),
    baseUrl: String(baseUrl).replace(/\/+$/, ''),
    packageSlug: toTrimmedText(process.env.CHECKR_PACKAGE) || 'driver_pro',
    node: toTrimmedText(process.env.CHECKR_NODE),
    workLocationCountry: String(toTrimmedText(process.env.CHECKR_WORK_LOCATION_COUNTRY) || 'US').toUpperCase(),
    workLocationState: String(toTrimmedText(process.env.CHECKR_WORK_LOCATION_STATE) || 'CA').toUpperCase(),
    workLocationCity: toTrimmedText(process.env.CHECKR_WORK_LOCATION_CITY)
  };
}

async function ensureCheckrTable(client) {
  if (checkrTableReady) return;
  await client.query(
    `CREATE TABLE IF NOT EXISTS helloworldjunktest.singles_checkr (
      singles_checkr_id BIGSERIAL PRIMARY KEY,
      singles_id BIGINT NOT NULL,
      checkr_candidate_id TEXT,
      checkr_report_id TEXT,
      vetting_status TEXT NOT NULL DEFAULT 'unverified',
      education_verified helloworldjunktest.boolean_enum NOT NULL DEFAULT 'false'::helloworldjunktest.boolean_enum,
      employment_verified helloworldjunktest.boolean_enum NOT NULL DEFAULT 'false'::helloworldjunktest.boolean_enum,
      identity_verified helloworldjunktest.boolean_enum NOT NULL DEFAULT 'false'::helloworldjunktest.boolean_enum,
      credit_verified helloworldjunktest.boolean_enum NOT NULL DEFAULT 'false'::helloworldjunktest.boolean_enum,
      license_verified helloworldjunktest.boolean_enum NOT NULL DEFAULT 'false'::helloworldjunktest.boolean_enum,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_vetted_at TIMESTAMPTZ
    )`
  );
  await client.query('CREATE UNIQUE INDEX IF NOT EXISTS ux_singles_checkr_singles_id ON helloworldjunktest.singles_checkr (singles_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_singles_checkr_report_id ON helloworldjunktest.singles_checkr (checkr_report_id)');
  checkrTableReady = true;
}

function getAuthHeader(apiKey) {
  const token = Buffer.from(`${apiKey}:`, 'utf8').toString('base64');
  return `Basic ${token}`;
}

async function checkrRequest(config, method, routePath, body) {
  const url = `${config.baseUrl}${routePath}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: getAuthHeader(config.apiKey),
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const msg = toTrimmedText(data?.error || data?.message) || `3rd-Party API error (${response.status})`;
    const err = new Error(msg);
    err.statusCode = response.status;
    err.responseBody = data ?? raw;
    throw err;
  }

  return data ?? {};
}

function normalizeVettingStatus(rawStatus) {
  const s = String(rawStatus ?? '').trim().toLowerCase();
  if (!s) return 'unverified';
  if (s === 'complete' || s === 'completed' || s === 'clear') return 'verified';
  if (s === 'pending' || s === 'in_progress' || s === 'processing') return 'pending';
  if (s === 'expired') return 'expired';
  return s;
}

function isCheckrResultPositive(value) {
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'clear' || s === 'complete' || s === 'completed' || s === 'verified' || s === 'eligible' || s === 'suspended_pending_clear';
}

function isTruthyTime(value) {
  const text = toTrimmedText(value);
  if (!text) return false;
  const t = Date.parse(text);
  return !Number.isNaN(t);
}

function isVerifiedEntity(entity) {
  if (!entity || typeof entity !== 'object') return false;
  if (isCheckrResultPositive(entity.result) || isCheckrResultPositive(entity.status)) return true;
  if (isTruthyTime(entity.completed_at) || isTruthyTime(entity.processed_at)) return true;
  return false;
}

function hasVerifiedItem(listOrItem) {
  if (Array.isArray(listOrItem)) return listOrItem.some((x) => isVerifiedEntity(x));
  return isVerifiedEntity(listOrItem);
}

function deriveFlagsFromReport(report) {
  const identityVerified =
    hasVerifiedItem(report?.identity_document_validation) ||
    hasVerifiedItem(report?.identity_document_validations) ||
    hasVerifiedItem(report?.ssn_trace) ||
    hasVerifiedItem(report?.ssn_traces);
  const employmentVerified =
    hasVerifiedItem(report?.employment_verification) ||
    hasVerifiedItem(report?.employment_verifications) ||
    hasVerifiedItem(report?.international_employment_verification) ||
    hasVerifiedItem(report?.international_employment_verifications);
  const educationVerified =
    hasVerifiedItem(report?.education_verification) ||
    hasVerifiedItem(report?.education_verifications) ||
    hasVerifiedItem(report?.international_education_verification) ||
    hasVerifiedItem(report?.international_education_verifications);
  const licenseVerified =
    hasVerifiedItem(report?.professional_license_verification) ||
    hasVerifiedItem(report?.professional_license_verifications);
  const creditVerified = hasVerifiedItem(report?.credit_report);

  return {
    identityVerified,
    employmentVerified,
    educationVerified,
    licenseVerified,
    creditVerified
  };
}

async function getOrCreateCandidate(config, existingCandidateId, userProfile) {
  if (existingCandidateId) return existingCandidateId;
  const firstName = toTrimmedText(userProfile?.firstname) || 'Member';
  const lastName = toTrimmedText(userProfile?.lastname) || 'User';
  const email = toTrimmedText(userProfile?.email);
  const candidate = await checkrRequest(config, 'POST', '/candidates', {
    first_name: firstName,
    last_name: lastName,
    email,
    custom_id: String(userProfile?.singles_id)
  });
  return toTrimmedText(candidate?.id);
}

async function loadSinglesCheckrRow(client, singlesId) {
  const result = await client.query(
    `SELECT *
     FROM helloworldjunktest.singles_checkr
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return result.rows[0] || null;
}

function toPublicStatusPayload(row) {
  if (!row) {
    return {
      hasCheckrRecord: false,
      status: 'unverified',
      educationVerified: false,
      employmentVerified: false,
      identityVerified: false,
      licenseVerified: false,
      creditVerified: false,
      candidateId: null,
      reportId: null,
      lastVettedAt: null,
      invitationStatus: null,
      invitationExpiresAt: null,
      invitationUrl: null
    };
  }
  return {
    hasCheckrRecord: true,
    status: normalizeVettingStatus(row.vetting_status),
    educationVerified: parseBooleanEnumRaw(row.education_verified),
    employmentVerified: parseBooleanEnumRaw(row.employment_verified),
    identityVerified: parseBooleanEnumRaw(row.identity_verified),
    licenseVerified: parseBooleanEnumRaw(row.license_verified),
    creditVerified: parseBooleanEnumRaw(row.credit_verified),
    candidateId: row.checkr_candidate_id ?? null,
    reportId: row.checkr_report_id ?? null,
    lastVettedAt: row.last_vetted_at ?? null,
    invitationStatus: row.invitation_status ?? null,
    invitationExpiresAt: row.invitation_expires_at ?? null,
    invitationUrl: row.invitation_url ?? null
  };
}

async function ensureOptionalInvitationColumns(client) {
  await client.query('ALTER TABLE helloworldjunktest.singles_checkr ADD COLUMN IF NOT EXISTS invitation_status TEXT');
  await client.query('ALTER TABLE helloworldjunktest.singles_checkr ADD COLUMN IF NOT EXISTS invitation_expires_at TIMESTAMPTZ');
  await client.query('ALTER TABLE helloworldjunktest.singles_checkr ADD COLUMN IF NOT EXISTS invitation_url TEXT');
}

export async function createCheckrInvitation(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const requestedEmail = toTrimmedText(req.body?.email);
  if (!requestedEmail) {
    return res.status(400).json({ error: 'email is required' });
  }

  const config = getCheckrConfig();
  if (!config.apiKey) {
    return res.status(500).json({ error: 'CHECKR_API_KEY is not configured on the server' });
  }

  const client = await pool.connect();
  try {
    await ensureCheckrTable(client);
    await ensureOptionalInvitationColumns(client);

    const profileRes = await client.query(
      `SELECT singles_id, firstname, lastname, email, current_city
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    if (!profileRes.rows.length) {
      return res.status(404).json({ error: 'User profile not found' });
    }
    const profile = profileRes.rows[0];

    const profileEmail = String(profile.email ?? '').trim().toLowerCase();
    const requestEmail = String(requestedEmail).trim().toLowerCase();
    if (!profileEmail || profileEmail !== requestEmail) {
      return res.status(400).json({ error: 'Email must match your account email' });
    }

    const existing = await loadSinglesCheckrRow(client, singlesId);
    const candidateId = await getOrCreateCandidate(config, toTrimmedText(existing?.checkr_candidate_id), profile);

    if (!candidateId) {
      return res.status(502).json({ error: 'Failed to create candidate in 3rd-Party' });
    }

    const workLocation = {
      country: config.workLocationCountry,
      state: config.workLocationState
    };
    const city = toTrimmedText(config.workLocationCity) || toTrimmedText(profile.current_city);
    if (city) workLocation.city = city;

    const invitationPayload = {
      candidate_id: candidateId,
      package: config.packageSlug,
      work_locations: [workLocation]
    };
    if (config.node) invitationPayload.node = config.node;

    const invitation = await checkrRequest(config, 'POST', '/invitations', invitationPayload);

    const invitationStatus = normalizeVettingStatus(invitation?.status || 'pending');
    await client.query(
      `INSERT INTO helloworldjunktest.singles_checkr
       (
         singles_id,
         checkr_candidate_id,
         checkr_report_id,
         vetting_status,
         education_verified,
         employment_verified,
         identity_verified,
         credit_verified,
         license_verified,
         invitation_status,
         invitation_expires_at,
         invitation_url,
         last_vetted_at
       )
       VALUES
       ($1, $2, $3, $4, ${FALSE_ENUM}, ${FALSE_ENUM}, ${FALSE_ENUM}, ${FALSE_ENUM}, ${FALSE_ENUM}, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (singles_id) DO UPDATE SET
         checkr_candidate_id = EXCLUDED.checkr_candidate_id,
         checkr_report_id = EXCLUDED.checkr_report_id,
         vetting_status = EXCLUDED.vetting_status,
         education_verified = EXCLUDED.education_verified,
         employment_verified = EXCLUDED.employment_verified,
         identity_verified = EXCLUDED.identity_verified,
         credit_verified = EXCLUDED.credit_verified,
         license_verified = EXCLUDED.license_verified,
         invitation_status = EXCLUDED.invitation_status,
         invitation_expires_at = EXCLUDED.invitation_expires_at,
         invitation_url = EXCLUDED.invitation_url,
         last_vetted_at = CURRENT_TIMESTAMP`,
      [
        singlesId,
        candidateId,
        toTrimmedText(invitation?.report_id),
        invitationStatus,
        toTrimmedText(invitation?.status),
        toTrimmedText(invitation?.expires_at),
        toTrimmedText(invitation?.invitation_url)
      ]
    );

    return res.status(201).json({
      message: '3rd-Party invitation created',
      invitation: {
        id: invitation?.id ?? null,
        status: invitation?.status ?? 'pending',
        invitationUrl: invitation?.invitation_url ?? null,
        expiresAt: invitation?.expires_at ?? null,
        candidateId,
        reportId: invitation?.report_id ?? null
      }
    });
  } catch (error) {
    console.error('[checkr:createInvitation]', error?.message || error);
    return res.status(Number(error?.statusCode) || 500).json({
      error: error?.message || 'Failed to create 3rd-Party invitation'
    });
  } finally {
    client.release();
  }
}

async function syncCheckrStatusFromRemote(client, config, row) {
  const candidateId = toTrimmedText(row?.checkr_candidate_id);
  let reportId = toTrimmedText(row?.checkr_report_id);
  let invitationStatus = null;
  let invitationUrl = null;
  let invitationExpiresAt = null;
  let normalizedStatus = normalizeVettingStatus(row?.vetting_status);

  if (candidateId) {
    try {
      const invitationList = await checkrRequest(config, 'GET', `/invitations?candidate_id=${encodeURIComponent(candidateId)}`);
      const items = Array.isArray(invitationList?.data) ? invitationList.data : [];
      const latest = items
        .slice()
        .sort((a, b) => Date.parse(String(b?.created_at || '')) - Date.parse(String(a?.created_at || '')))[0];
      if (latest) {
        invitationStatus = toTrimmedText(latest.status);
        invitationUrl = toTrimmedText(latest.invitation_url);
        invitationExpiresAt = toTrimmedText(latest.expires_at);
        if (!reportId && toTrimmedText(latest.report_id)) {
          reportId = toTrimmedText(latest.report_id);
        }
        normalizedStatus = normalizeVettingStatus(latest.status || normalizedStatus);
      }
    } catch (err) {
      console.warn('[checkr:sync] invitation pull failed:', err?.message || err);
    }
  }

  let flags = {
    identityVerified: parseBooleanEnumRaw(row?.identity_verified),
    employmentVerified: parseBooleanEnumRaw(row?.employment_verified),
    educationVerified: parseBooleanEnumRaw(row?.education_verified),
    licenseVerified: parseBooleanEnumRaw(row?.license_verified),
    creditVerified: parseBooleanEnumRaw(row?.credit_verified)
  };

  if (reportId) {
    try {
      const includeFields = [
        'education_verification',
        'education_verifications',
        'employment_verification',
        'employment_verifications',
        'international_education_verification',
        'international_education_verifications',
        'international_employment_verification',
        'international_employment_verifications',
        'professional_license_verification',
        'professional_license_verifications',
        'identity_document_validation',
        'identity_document_validations',
        'ssn_trace',
        'ssn_traces',
        'credit_report'
      ].join(',');
      const report = await checkrRequest(
        config,
        'GET',
        `/reports/${encodeURIComponent(reportId)}?include=${encodeURIComponent(includeFields)}`
      );
      flags = deriveFlagsFromReport(report);
      normalizedStatus = normalizeVettingStatus(report?.status || normalizedStatus);
      if (
        normalizedStatus === 'verified' ||
        flags.identityVerified ||
        flags.employmentVerified ||
        flags.educationVerified ||
        flags.licenseVerified ||
        flags.creditVerified
      ) {
        normalizedStatus = 'verified';
      }
    } catch (err) {
      console.warn('[checkr:sync] report pull failed:', err?.message || err);
    }
  }

  const result = await client.query(
    `UPDATE helloworldjunktest.singles_checkr
     SET
       checkr_report_id = $2,
       vetting_status = $3,
       identity_verified = ${sqlBooleanEnumParam('$4', CHECKR_SCHEMA)},
       employment_verified = ${sqlBooleanEnumParam('$5', CHECKR_SCHEMA)},
       education_verified = ${sqlBooleanEnumParam('$6', CHECKR_SCHEMA)},
       license_verified = ${sqlBooleanEnumParam('$7', CHECKR_SCHEMA)},
       credit_verified = ${sqlBooleanEnumParam('$8', CHECKR_SCHEMA)},
       invitation_status = COALESCE($9, invitation_status),
       invitation_url = COALESCE($10, invitation_url),
       invitation_expires_at = COALESCE($11, invitation_expires_at),
       last_vetted_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1
     RETURNING *`,
    [
      row.singles_id,
      reportId,
      normalizedStatus,
      toBooleanEnumLabel(flags.identityVerified),
      toBooleanEnumLabel(flags.employmentVerified),
      toBooleanEnumLabel(flags.educationVerified),
      toBooleanEnumLabel(flags.licenseVerified),
      toBooleanEnumLabel(flags.creditVerified),
      invitationStatus,
      invitationUrl,
      invitationExpiresAt
    ]
  );
  return result.rows[0] || row;
}

export async function getCheckrStatus(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const refresh = String(req.query?.refresh ?? 'true').toLowerCase() !== 'false';
  const config = getCheckrConfig();

  const client = await pool.connect();
  try {
    await ensureCheckrTable(client);
    await ensureOptionalInvitationColumns(client);

    let row = await loadSinglesCheckrRow(client, singlesId);
    if (!row) {
      return res.json(toPublicStatusPayload(null));
    }

    if (refresh && config.apiKey && (row.checkr_candidate_id || row.checkr_report_id)) {
      row = await syncCheckrStatusFromRemote(client, config, row);
    }

    return res.json(toPublicStatusPayload(row));
  } catch (error) {
    console.error('[checkr:getStatus]', error?.message || error);
    return res.status(Number(error?.statusCode) || 500).json({
      error: error?.message || 'Failed to load 3rd-Party status'
    });
  } finally {
    client.release();
  }
}
