import pool from '../../db/connection.js';
import { loadTableColumns, resolveBioSchema, sqlIdent, upsertBioRow } from './checkrBioReviewDb.js';
import { setVetBioVerificationStatus } from '../../utils/vetBioVerificationServices.js';
import {
  compareEducationField,
  createMeasureOneDataRequest,
  createMeasureOneIndividual,
  extractEducationFromAcademicSummary,
  formatMeasureOneError,
  getMeasureOneAccessToken,
  getMeasureOneConfig,
  isMeasureOneConfigured,
  waitForCompletedAcademicSummary
} from './measureoneClient.js';
import { buildMockAcademicSummaryResponse, buildMockWebhookEvent, loadMockTranscript } from './measureoneMockData.js';
import {
  getCachedAcademicSummaryResponse,
  loadUserEducationVerification,
  upsertUserEducationVerification
} from './measureoneEducationDb.js';
import { trackUserSearchEvent } from '../../utils/userActivityStats.js';

async function loadMemberProfile(singlesId) {
  const result = await pool.query(
    `SELECT
       singles_id,
       email,
       alias,
       mailing_firstname,
       mailing_lastname
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return result.rows[0] ?? null;
}

async function loadCurrentEducationValues(schemaName, singlesId) {
  const schema = sqlIdent(schemaName);
  const result = await pool.query(
    `SELECT college_name, highest_degree_completed, degree_graduation_date
     FROM ${schema}.vet_bio
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return result.rows[0] ?? {};
}

async function applyEducationVerificationToVetBio(singlesId, education, existingValues = {}) {
  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
  const now = new Date();
  const institutionLabel = education.institutionLabel || education.collegeName || 'college account';

  const columns = {};

  if (education.collegeName && vetColumns.has('college_name')) {
    columns.college_name = education.collegeName;
  }
  if (education.highestDegree && vetColumns.has('highest_degree_completed')) {
    columns.highest_degree_completed = education.highestDegree;
  }
  if (education.graduationDate && vetColumns.has('degree_graduation_date')) {
    columns.degree_graduation_date = education.graduationDate;
  }

  const fieldPairs = [
    ['college_name', 'college_name_vetted', 'college_name_vetted_date', 'college_name_vetted_note', education.collegeName],
    [
      'highest_degree_completed',
      'highest_degree_completed_vetted',
      'highest_degree_completed_vetted_date',
      'highest_degree_completed_vetted_note',
      education.highestDegree
    ],
    [
      'degree_graduation_date',
      'degree_graduation_date_vetted',
      'degree_graduation_date_vetted_date',
      'degree_graduation_date_vetted_note',
      education.graduationDate
    ]
  ];

  for (const [valueKey, vettedKey, vettedDateKey, vettedNoteKey, verifiedValue] of fieldPairs) {
    if (!verifiedValue || !vetColumns.has(vettedKey)) continue;
    const reportedValue = existingValues[valueKey];
    columns[vettedKey] = compareEducationField(reportedValue, verifiedValue) ?? 'info_matches';
    if (vetColumns.has(vettedDateKey)) columns[vettedDateKey] = now;
    if (vetColumns.has(vettedNoteKey)) {
      columns[vettedNoteKey] = `MeasureOne verified ${institutionLabel}`;
    }
  }

  const entries = Object.entries(columns).filter(([column]) => vetColumns.has(column));
  if (!entries.length) {
    throw new Error('vet_bio education columns are unavailable');
  }

  await upsertBioRow(pool, schemaName, 'vet_bio', singlesId, columns, vetColumns);

  await setVetBioVerificationStatus(singlesId, 'education', 'completed');

  return {
    collegeName: education.collegeName ?? null,
    highestDegree: education.highestDegree ?? null,
    graduationDate: education.graduationDate ?? null,
    institutionLabel
  };
}

function splitNameParts(profile) {
  const first =
    String(profile?.mailing_firstname ?? '').trim() ||
    String(profile?.alias ?? '').trim() ||
    'Member';
  const last = String(profile?.mailing_lastname ?? '').trim() || 'Member';
  return { first, last };
}

/**
 * GET /api/measureone/education/status
 */
export async function getMeasureOneEducationStatus(req, res) {
  const config = getMeasureOneConfig();
  const singlesId = Number(req.auth?.singles_id);
  let cachedVerification = null;
  if (Number.isFinite(singlesId) && singlesId >= 1) {
    cachedVerification = await loadUserEducationVerification(singlesId);
  }
  return res.json({
    configured: isMeasureOneConfigured(),
    mockEnabled: config.mockEnabled,
    hostName: config.hostName,
    linkScriptUrl: config.linkScriptUrl,
    docsUrl: 'https://docs.measureone.com/quickstart/how_it_works',
    hasCachedVerification: Boolean(cachedVerification?.isVerified),
    cachedDatarequestId: cachedVerification?.measureoneDatarequestId ?? null
  });
}

async function persistAndSyncEducationVerification(
  singlesId,
  summaryResponse,
  { measureoneIndividualId = null, measureoneDatarequestId = null, rawAcademicRecord = null, digestRecord = null } = {}
) {
  await upsertUserEducationVerification({
    userId: singlesId,
    measureoneIndividualId,
    measureoneDatarequestId,
    rawAcademicRecord,
    digestRecord,
    academicSummaryResponse: summaryResponse,
    isVerified: true
  });

  const education = extractEducationFromAcademicSummary(summaryResponse);
  if (!education) {
    const err = new Error('MeasureOne did not return college verification data');
    err.statusCode = 422;
    throw err;
  }

  const schemaName = await resolveBioSchema();
  const existingValues = await loadCurrentEducationValues(schemaName, singlesId);
  return applyEducationVerificationToVetBio(singlesId, education, existingValues);
}

async function resolveAcademicSummaryForUser(config, accessToken, singlesId, datarequestId) {
  const cached = await getCachedAcademicSummaryResponse(singlesId, datarequestId);
  if (cached) {
    return { summaryResponse: cached, fromCache: true };
  }

  const summaryResponse = await waitForCompletedAcademicSummary(config, accessToken, datarequestId);
  return { summaryResponse, fromCache: false };
}

/**
 * POST /api/measureone/education/start
 * Creates Individual + ACADEMIC_SUMMARY data request and returns widget config.
 */
export async function startMeasureOneEducationVerification(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isMeasureOneConfigured()) {
    return res.status(503).json({
      error: 'MeasureOne is not configured. Set MEASUREONE_CLIENT_ID and MEASUREONE_CLIENT_SECRET in ~/.ssh/be/.env'
    });
  }

  try {
    await trackUserSearchEvent(singlesId, 'academic_record_search');
    const profile = await loadMemberProfile(singlesId);
    if (!profile?.email) {
      return res.status(400).json({ error: 'Member email is required for MeasureOne verification' });
    }

    const config = getMeasureOneConfig();
    const accessToken = await getMeasureOneAccessToken(config);
    const existing = await loadUserEducationVerification(singlesId);
    if (existing?.isVerified && existing.measureoneIndividualId && existing.measureoneDatarequestId) {
      return res.json({
        individualId: existing.measureoneIndividualId,
        datarequestId: existing.measureoneDatarequestId,
        cached: true,
        widget: {
          accessKey: accessToken,
          hostName: config.hostName,
          datarequestId: existing.measureoneDatarequestId,
          scriptUrl: config.linkScriptUrl
        }
      });
    }

    const { first, last } = splitNameParts(profile);

    const individual = await createMeasureOneIndividual(config, accessToken, {
      first_name: first,
      last_name: last,
      email: profile.email,
      external_id: String(singlesId)
    });
    const individualId = individual?.id;
    if (!individualId) {
      return res.status(502).json({ error: 'MeasureOne did not return an individual id' });
    }

    const dataRequest = await createMeasureOneDataRequest(config, accessToken, {
      individualId,
      type: 'ACADEMIC_SUMMARY'
    });
    const datarequestId = dataRequest?.id;
    if (!datarequestId) {
      return res.status(502).json({ error: 'MeasureOne did not return a data request id' });
    }

    await upsertUserEducationVerification({
      userId: singlesId,
      measureoneIndividualId: individualId,
      measureoneDatarequestId: datarequestId,
      isVerified: false
    });

    // MeasureOne docs + quickstart pass the enterprise access token as widget access_key.
    return res.json({
      individualId,
      datarequestId,
      widget: {
        accessKey: accessToken,
        hostName: config.hostName,
        datarequestId,
        scriptUrl: config.linkScriptUrl
      }
    });
  } catch (error) {
    console.error('[measureone:startEducation]', error?.message || error);
    return res.status(error?.statusCode === 401 ? 502 : 500).json({
      error: formatMeasureOneError(error) || 'Failed to start MeasureOne education verification'
    });
  }
}

/**
 * POST /api/measureone/education/sync
 * Pulls academic summary from MeasureOne and writes college fields into vet_bio.
 */
export async function syncMeasureOneEducationVerification(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isMeasureOneConfigured()) {
    return res.status(503).json({ error: 'MeasureOne is not configured' });
  }

  const datarequestId = String(req.body?.datarequestId ?? '').trim();
  if (!datarequestId) {
    return res.status(400).json({ error: 'datarequestId is required' });
  }

  try {
    const config = getMeasureOneConfig();
    const accessToken = await getMeasureOneAccessToken(config);
    const { summaryResponse, fromCache } = await resolveAcademicSummaryForUser(
      config,
      accessToken,
      singlesId,
      datarequestId
    );

    const existing = await loadUserEducationVerification(singlesId);
    const saved = await persistAndSyncEducationVerification(singlesId, summaryResponse, {
      measureoneIndividualId: existing?.measureoneIndividualId ?? null,
      measureoneDatarequestId: datarequestId,
      rawAcademicRecord: existing?.rawAcademicRecord ?? null,
      digestRecord: existing?.digestRecord ?? null
    });

    return res.json({
      success: true,
      fromCache,
      message: saved.institutionLabel
        ? `Your ${saved.institutionLabel} account is successfully connected.`
        : 'College verification completed.',
      education: saved,
      processingStatus: summaryResponse?.processing_status ?? 'COMPLETED'
    });
  } catch (error) {
    console.error('[measureone:syncEducation]', error?.message || error);
    const statusCode = String(error?.message ?? '').includes('not ready') ? 409 : 500;
    return res.status(statusCode).json({
      error: error?.message || 'Failed to sync MeasureOne education verification',
      processingStatus: error?.responseBody?.processing_status ?? null
    });
  }
}

/**
 * POST /api/measureone/education/simulate
 * Local demo: applies mock M1_ACADEMIC_RECORD / M1_DIGEST as if MeasureOne webhook + sync completed.
 */
export async function simulateMeasureOneEducationVerification(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const config = getMeasureOneConfig();
  if (!config.mockEnabled) {
    return res.status(403).json({
      error: 'MeasureOne mock mode is disabled. Set MEASUREONE_MOCK=true or omit API credentials in non-production.'
    });
  }

  try {
    const mock = await loadMockTranscript();
    const datarequestId = String(req.body?.datarequestId ?? mock.datarequest_id ?? '').trim() || 'dr_mock_demo_academic_summary';
    let summaryResponse = await getCachedAcademicSummaryResponse(singlesId, datarequestId);
    const fromCache = Boolean(summaryResponse);
    if (!summaryResponse) {
      summaryResponse = await buildMockAcademicSummaryResponse(datarequestId);
    }
    const saved = await persistAndSyncEducationVerification(singlesId, summaryResponse, {
      measureoneIndividualId: mock.individual_id,
      measureoneDatarequestId: datarequestId,
      rawAcademicRecord: mock.academic_record,
      digestRecord: mock.digest_record
    });

    return res.json({
      success: true,
      mock: true,
      fromCache,
      message: saved.institutionLabel
        ? `Your ${saved.institutionLabel} account is successfully connected (demo).`
        : 'College verification completed (demo).',
      education: saved,
      processingStatus: summaryResponse?.processing_status ?? 'COMPLETED',
      records: {
        academic_record: mock.academic_record,
        digest_record: mock.digest_record
      }
    });
  } catch (error) {
    console.error('[measureone:simulateEducation]', error?.message || error);
    const statusCode = error?.statusCode === 422 ? 422 : 500;
    return res.status(statusCode).json({
      error: error?.message || 'Failed to simulate MeasureOne education verification'
    });
  }
}

/**
 * POST /webhooks/measureone
 * Mock webhook listener for datasource.connected / datarequest.report_available events.
 */
export async function handleMeasureOneWebhook(req, res) {
  const config = getMeasureOneConfig();
  if (!config.mockEnabled) {
    return res.status(404).json({ error: 'Not found' });
  }

  const event = req.body && typeof req.body === 'object' ? req.body : {};
  const type = String(event.type ?? '').trim();

  switch (type) {
    case 'datasource.connected':
    case 'datasourceConnected':
      break;
    case 'datarequest.report_available':
      break;
    case 'datarequest.no_items':
      break;
    default:
      if (!type) {
        return res.status(400).json({ error: 'Webhook event type is required' });
      }
  }

  const mock = await loadMockTranscript();
  const echo = buildMockWebhookEvent(type || 'unknown', {
    individual_id: event.individual_id || mock.individual_id,
    datarequest_id: event.datarequest_id || mock.datarequest_id
  });

  return res.status(200).json({
    received: true,
    mock: true,
    event: echo
  });
}

/**
 * GET /api/dev/simulate-verification
 * Dev helper aligned with MeasureOne quickstart docs (mock transcript JSON).
 */
export async function devSimulateMeasureOneVerification(req, res) {
  const config = getMeasureOneConfig();
  if (!config.mockEnabled) {
    return res.status(403).json({ error: 'MeasureOne mock mode is disabled' });
  }

  try {
    const mock = await loadMockTranscript();
    const singlesId = Number(req.auth?.singles_id);
    let stored = null;
    if (Number.isFinite(singlesId) && singlesId >= 1) {
      stored = await loadUserEducationVerification(singlesId);
    }
    return res.json({
      mock: true,
      individual_id: stored?.measureoneIndividualId ?? mock.individual_id,
      datarequest_id: stored?.measureoneDatarequestId ?? mock.datarequest_id,
      raw_academic_record: stored?.rawAcademicRecord ?? mock.academic_record,
      digest_record: stored?.digestRecord ?? mock.digest_record,
      academic_summary_response: stored?.academicSummaryResponse ?? null,
      is_verified: Boolean(stored?.isVerified),
      note: 'POST /api/measureone/education/simulate while logged in to persist JSON and update vet_bio.'
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Failed to load mock transcript' });
  }
}
