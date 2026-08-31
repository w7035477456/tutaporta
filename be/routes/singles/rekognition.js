import pool from '../../db/connection.js';
import {
  compareFaces,
  createFaceLivenessSession,
  detectSingleFace,
  evaluateLivenessSession,
  getFaceLivenessSessionResults,
  getRekognitionConfig,
  isRekognitionConfigured,
  isLivenessEnforcedForVerification
} from '../../lib/rekognitionClient.js';
import { loadProfilePhotoBytes } from '../../utils/loadProfilePhotoBytes.js';
import { prepareGovIdImageBytes } from '../../utils/prepareGovIdImageBytes.js';
import {
  compareConsentNameToIdOcr,
  computeAgeFromDob,
  formatDlDobCapture,
  formatDlSexCapture,
  formatPpDobCapture,
  formatPpNationalityCapture,
  formatPpPlaceOfBirthCapture,
  formatPpSexCapture,
  mergeIdCardParsed
} from '../../utils/idCardOcrParse.js';
import { formatGovIdDocumentLabel, readCitizenshipDisplayValue, readPlaceOfBirthDisplayValue } from '../../utils/govIdDocumentLabels.js';
import { ocrParseIdCardFromImage } from '../../utils/idCardOcrPipeline.js';
import { resolveBioSchema, sqlIdent, loadTableColumns, upsertBioRow } from './checkrBioReviewDb.js';
import { saveConsentMediaFile } from '../photos/saveConsentMediaFile.js';
import { cropIdFaceFromImage } from '../../utils/cropIdFaceFromImage.js';
import { trackUserSearchEvent } from '../../utils/userActivityStats.js';
import { sqlBooleanColumnLiteral, loadColumnUdtName } from '../../utils/booleanEnum.js';
import {
  adminImpersonationMatchCapture,
  buildMockIdCardParsedForAdminBypass,
  isAdminImpersonationRekognitionBypass,
  loadMemberBasicsForRekognitionBypass
} from '../../utils/adminImpersonationRekognitionBypass.js';

const CHECKR_SCHEMA = 'helloworldjunktest';

/** Product copy when government ID OCR age is under 18. */
export const UNDER18_ID_VERIFY_MESSAGE = 'Sorry you must be over 18 years of age';

/**
 * Persist age gate from OCR DOB:
 * — age &lt; 18 → over_18_verified = false, status = under18
 * — age ≥ 18 → over_18_verified = true
 * @returns {{ age: number | null, underage: boolean, over18Verified: boolean | null }}
 */
async function applyUnder18StatusFromDob(client, singlesId, dateOfBirth) {
  const age = computeAgeFromDob(dateOfBirth);
  const underage = Number.isFinite(age) && age < 18;
  const over18 = Number.isFinite(age) && age >= 18;
  if (underage) {
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET status = 'under18'::helloworldjunktest.singles_status,
           over_18_verified = false,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $1`,
      [singlesId]
    );
    console.log('[rekognition:idCapture] under18 from OCR DOB', {
      singlesId,
      age,
      dob: dateOfBirth
    });
    return { age, underage: true, over18Verified: false };
  }
  if (over18) {
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET over_18_verified = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $1`,
      [singlesId]
    );
    console.log('[rekognition:idCapture] over_18_verified from OCR DOB', {
      singlesId,
      age,
      dob: dateOfBirth
    });
    return { age, underage: false, over18Verified: true };
  }
  return { age, underage: false, over18Verified: null };
}

let checkrTableReady = false;

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
  checkrTableReady = true;
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function decodeDataUrlImage(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') {
    throw new Error('Missing image');
  }
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  const contentType = (match ? match[1] : 'image/jpeg').trim().toLowerCase();
  const base64 = match ? match[2] : dataUrl;
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Image must be JPEG, PNG, or WebP');
  }
  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length) {
    throw new Error('Invalid image data');
  }
  if (buffer.length > 8 * 1024 * 1024) {
    throw new Error('Image exceeds 8 MB limit');
  }
  return buffer;
}

async function decodeAndPrepareGovIdImage(dataUrl) {
  const buffer = decodeDataUrlImage(dataUrl);
  return prepareGovIdImageBytes(buffer);
}

async function loadNormalizedProfilePhotoBytes(singlesId) {
  const raw = await loadProfilePhotoBytes(singlesId);
  return prepareGovIdImageBytes(raw);
}

function referenceImageDataUrlFromBytes(bytes) {
  if (!bytes?.length) return null;
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString('base64')}`;
}

/** Persist AWS liveness reference frame for Profile&Live bio row (album type deleted). */
async function persistLiveScanReferencePhoto(client, singlesId, livenessSessionId) {
  const sessionId = toTrimmedText(livenessSessionId);
  if (!sessionId) return null;
  try {
    const results = await getFaceLivenessSessionResults(sessionId);
    const dataUrl = referenceImageDataUrlFromBytes(results.referenceImageBytes);
    if (!dataUrl) return null;
    return await saveConsentMediaFile(client, singlesId, dataUrl, {
      fileNamePrefix: 'live_scan_ref_'
    });
  } catch (err) {
    console.warn('[rekognition] could not save live scan reference photo:', err?.message ?? err);
    return null;
  }
}

/** Persist cropped ID face for Profile&DL / Profile&PP bio rows (album type deleted). */
async function persistIdFaceCropPhoto(client, singlesId, idBytes, fileNamePrefix) {
  if (!idBytes?.length) return null;
  try {
    const cropBytes = await cropIdFaceFromImage(idBytes);
    if (!cropBytes?.length) return null;
    const dataUrl = `data:image/jpeg;base64,${Buffer.from(cropBytes).toString('base64')}`;
    return await saveConsentMediaFile(client, singlesId, dataUrl, { fileNamePrefix });
  } catch (err) {
    console.warn(`[rekognition] could not save ${fileNamePrefix} face crop:`, err?.message ?? err);
    return null;
  }
}

function toTrimmedText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function buildAwsFriendlyError(error) {
  const message = String(error?.message || '');
  const awsCode = String(error?.name || error?.Code || '').trim();
  const combined = `${awsCode} ${message}`.toLowerCase();
  const isSignature =
    combined.includes('signaturedoesnotmatch') ||
    combined.includes('request signature we calculated does not match');
  const isInvalidToken =
    combined.includes('invalidclienttokenid') ||
    combined.includes('unrecognizedclientexception') ||
    combined.includes('security token included in the request is invalid');
  const isExpiredToken = combined.includes('expiredtoken');

  if (isSignature || isInvalidToken || isExpiredToken) {
    return {
      status: 502,
      message:
        'Identity verification could not authenticate on the server. Please try again later or contact support.'
    };
  }
  return null;
}

async function assertLivenessSession(sessionId, minConfidence) {
  const id = toTrimmedText(sessionId);
  if (!id) {
    throw new Error('Face liveness session is required');
  }
  const results = await getFaceLivenessSessionResults(id);
  const evaluation = evaluateLivenessSession(results, minConfidence);
  if (!evaluation.passed) {
    throw new Error(evaluation.passFailReason || 'Face liveness did not pass.');
  }
  return { results, evaluation };
}

const DL_PHOTO_MATCH_THRESHOLD = 90;

function resolveLiveScanProfileCapture({ liveScanSkipped, similarity }) {
  if (liveScanSkipped) {
    return { percentMatch: null };
  }
  const pct = Number.isFinite(Number(similarity)) ? Math.round(Number(similarity)) : null;
  return { percentMatch: pct };
}

function resolveDlPhotoScanCapture({ liveScanSkipped, similarity }) {
  if (liveScanSkipped) {
    return { percentMatch: null, scanResult: 'Not Match' };
  }
  const pct = Number.isFinite(Number(similarity)) ? Math.round(Number(similarity)) : null;
  const scanResult = pct != null && pct >= DL_PHOTO_MATCH_THRESHOLD ? 'Match' : 'Not Match';
  return { percentMatch: pct, scanResult };
}

function resolveProfileIdMatchCapture({ similarity, threshold = DL_PHOTO_MATCH_THRESHOLD }) {
  const pct = Number.isFinite(Number(similarity)) ? Math.round(Number(similarity)) : null;
  const scanResult = pct != null && pct >= threshold ? 'Match' : 'Not Match';
  return { percentMatch: pct, scanResult };
}

function profilePhotoVettedFromScanResult(scanResult, percentMatch) {
  const matched = scanResult === 'Match';
  const note =
    percentMatch != null
      ? `Live scan face match ${percentMatch}%`
      : scanResult === 'Not Match'
        ? 'Live face scan skipped or not matched'
        : 'Live scan face match not available';
  return {
    profilephoto_vetted: matched ? 'info_matches' : 'info_not_matches',
    profilephoto_vetted_note: note
  };
}

async function computeLiveScanProfileMatch(livenessSessionId, profileBytes) {
  const sessionId = toTrimmedText(livenessSessionId);
  if (!sessionId) {
    return { liveScanSkipped: true, similarity: null };
  }
  const results = await getFaceLivenessSessionResults(sessionId);
  const referenceImageBytes = results.referenceImageBytes;
  if (!referenceImageBytes) {
    return { liveScanSkipped: false, similarity: null, noFaceOnReference: true };
  }
  const refFaces = await detectSingleFace(referenceImageBytes);
  if (refFaces.faceCount < 1) {
    return { liveScanSkipped: false, similarity: null, noFaceOnReference: true };
  }
  const match = await compareFaces(referenceImageBytes, profileBytes, 0);
  return { liveScanSkipped: false, similarity: match.similarity, noFaceOnReference: false };
}

async function updateSinglesLiveScanProfileMatch(client, singlesId, capture) {
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'singles'`
  );
  const columnSet = new Set(colRes.rows.map((row) => row.column_name));
  const updates = [];
  const values = [];
  if (columnSet.has('live_scan_percent_match')) {
    values.push(capture.percentMatch);
    updates.push(`live_scan_percent_match = $${values.length}`);
  }
  if (!updates.length) return capture;
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(singlesId);
  await client.query(
    `UPDATE helloworldjunktest.singles SET ${updates.join(', ')} WHERE singles_id = $${values.length}`,
    values
  );
  return capture;
}

async function updateSinglesDlProfileMatch(client, singlesId, capture) {
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'singles'`
  );
  const columnSet = new Set(colRes.rows.map((row) => row.column_name));
  const updates = [];
  const values = [];
  if (columnSet.has('dl_profile_percent_match')) {
    values.push(capture.percentMatch);
    updates.push(`dl_profile_percent_match = $${values.length}`);
  }
  if (columnSet.has('dl_profile_scan_result')) {
    values.push(capture.scanResult);
    updates.push(`dl_profile_scan_result = $${values.length}`);
  }
  if (!updates.length) return capture;
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(singlesId);
  await client.query(
    `UPDATE helloworldjunktest.singles SET ${updates.join(', ')} WHERE singles_id = $${values.length}`,
    values
  );
  return capture;
}

async function updateSinglesPpProfileMatch(client, singlesId, capture) {
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'singles'`
  );
  const columnSet = new Set(colRes.rows.map((row) => row.column_name));
  const updates = [];
  const values = [];
  if (columnSet.has('pp_profile_percent_match')) {
    values.push(capture.percentMatch);
    updates.push(`pp_profile_percent_match = $${values.length}`);
  }
  if (columnSet.has('pp_profile_scan_result')) {
    values.push(capture.scanResult);
    updates.push(`pp_profile_scan_result = $${values.length}`);
  }
  if (!updates.length) return capture;
  updates.push('updated_at = CURRENT_TIMESTAMP');
  values.push(singlesId);
  await client.query(
    `UPDATE helloworldjunktest.singles SET ${updates.join(', ')} WHERE singles_id = $${values.length}`,
    values
  );
  return capture;
}

async function updateVetBioAfterVerification(
  client,
  singlesId,
  parsed,
  dlPhotoCapture,
  passportParsed = null
) {
  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
  const now = new Date();
  const profilePhotoVetted = profilePhotoVettedFromScanResult(dlPhotoCapture.scanResult, dlPhotoCapture.percentMatch);

  const applyVettedField = (columns, field, value, note) => {
    if (value == null || value === '' || !vetColumns.has(field)) return;
    columns[field] = value;
    const vettedKey = `${field}_vetted`;
    if (vetColumns.has(vettedKey)) {
      columns[vettedKey] = 'info_matches';
      columns[`${field}_vetted_date`] = now;
      columns[`${field}_vetted_note`] = note;
    }
  };

  const columns = {
    profilephoto_vetted: profilePhotoVetted.profilephoto_vetted,
    profilephoto_vetted_date: now,
    profilephoto_vetted_note: profilePhotoVetted.profilephoto_vetted_note
  };
  const age = computeAgeFromDob(parsed.dateOfBirth);
  if (age != null && vetColumns.has('age')) {
    columns.age = age;
  }
  if (age != null && vetColumns.has('age_vetted')) {
    columns.age_vetted = 'info_matches';
    columns.age_vetted_date = now;
    columns.age_vetted_note = `DOB from ID OCR (${parsed.dateOfBirth})`;
  }
  if (parsed.city && vetColumns.has('current_city')) {
    columns.current_city = parsed.city;
  }
  if (parsed.city && vetColumns.has('current_city_vetted')) {
    columns.current_city_vetted = 'info_matches';
    columns.current_city_vetted_date = now;
    columns.current_city_vetted_note = `City from ID OCR address (${parsed.address || parsed.city})`;
  }
  if (vetColumns.has('id_verification')) {
    columns.id_verification = 'completed';
  }

  applyVettedField(columns, 'firstname', parsed.firstName, 'First name from driver license OCR');
  applyVettedField(columns, 'middlename', parsed.middleName, 'Middle name from driver license OCR');
  applyVettedField(columns, 'lastname', parsed.lastName, 'Last name from driver license OCR');
  applyVettedField(columns, 'official_gender', parsed.sex, 'Sex from driver license OCR');
  applyVettedField(columns, 'height', parsed.height, 'Height from driver license OCR');

  if (passportParsed) {
    applyVettedField(columns, 'countryofcitizenship', passportParsed.countryOfCitizenship, 'Nationality from passport OCR');
    applyVettedField(columns, 'countryofbirth', passportParsed.countryOfBirth, 'Place of birth from passport OCR');
  }

  await upsertBioRow(client, schemaName, 'vet_bio', singlesId, columns, vetColumns);
}

async function updateVetBioPassportFieldsFromCapture(client, singlesId, parsed) {
  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
  const now = new Date();
  const columns = {};

  const applyVettedField = (field, value, note) => {
    if (value == null || value === '' || !vetColumns.has(field)) return;
    columns[field] = value;
    const vettedKey = `${field}_vetted`;
    if (vetColumns.has(vettedKey)) {
      columns[vettedKey] = 'info_matches';
      columns[`${field}_vetted_date`] = now;
      columns[`${field}_vetted_note`] = note;
    }
  };

  applyVettedField(
    'countryofcitizenship',
    readCitizenshipDisplayValue(formatPpNationalityCapture(parsed.ppNationality)),
    'Nationality from passport OCR'
  );
  applyVettedField(
    'countryofbirth',
    readPlaceOfBirthDisplayValue(formatPpPlaceOfBirthCapture(parsed.countryOfBirth)),
    'Place of birth from passport OCR'
  );

  if (Object.keys(columns).length) {
    await upsertBioRow(client, schemaName, 'vet_bio', singlesId, columns, vetColumns);
  }
}

async function updateSinglesMailingFromId(client, singlesId, parsed) {
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'singles'`
  );
  const columnSet = new Set(colRes.rows.map((row) => row.column_name));

  const updates = [];
  const values = [];
  const setIf = (column, value) => {
    if (!columnSet.has(column) || value == null || value === '') return;
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  };

  setIf('mailing_firstname', parsed.firstName);
  setIf('mailing_middlename', parsed.middleInitial);
  setIf('mailing_lastname', parsed.lastName);

  if (parsed.address && columnSet.has('mailing_street')) {
    setIf('mailing_street', parsed.address);
  }

  if (updates.length) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(singlesId);
    await client.query(
      `UPDATE helloworldjunktest.singles SET ${updates.join(', ')} WHERE singles_id = $${values.length}`,
      values
    );
  }
}

const GOV_ID_SLOT_TYPES = new Set(['driver_license', 'passport']);

function normalizeGovIdSlotType(value) {
  const text = String(value ?? '').trim();
  return GOV_ID_SLOT_TYPES.has(text) ? text : null;
}

function buildDriverLicenseCaptureFields(parsed) {
  const middleName = toTrimmedText(parsed.middleName) || toTrimmedText(parsed.middleInitial);
  return {
    dl_firstname: toTrimmedText(parsed.firstName),
    dl_middlename: middleName,
    dl_lastname: toTrimmedText(parsed.lastName),
    dl_dob: formatDlDobCapture(parsed.dateOfBirth),
    dl_sex: formatDlSexCapture(parsed.sex),
    dl_height: toTrimmedText(parsed.height),
    dl_city: toTrimmedText(parsed.city)
  };
}

function buildPassportCaptureFields(parsed) {
  return {
    pp_nationality: formatPpNationalityCapture(parsed.ppNationality),
    pp_dob: formatPpDobCapture(parsed.dateOfBirth),
    pp_place_of_birth: formatPpPlaceOfBirthCapture(parsed.countryOfBirth),
    pp_sex: formatPpSexCapture(parsed.sex)
  };
}

function buildDlCaptureFields(parsed, slotDocumentType = null) {
  const slotType = normalizeGovIdSlotType(slotDocumentType) || normalizeGovIdSlotType(parsed.documentType);
  if (slotType === 'passport') {
    return buildPassportCaptureFields(parsed);
  }
  if (slotType === 'driver_license') {
    return buildDriverLicenseCaptureFields(parsed);
  }
  const middleName = toTrimmedText(parsed.middleName) || toTrimmedText(parsed.middleInitial);
  return {
    dl_firstname: toTrimmedText(parsed.firstName),
    dl_middlename: middleName,
    dl_lastname: toTrimmedText(parsed.lastName),
    dl_dob: formatDlDobCapture(parsed.dateOfBirth),
    dl_sex: formatDlSexCapture(parsed.sex),
    dl_height: toTrimmedText(parsed.height),
    dl_city: toTrimmedText(parsed.city),
    pp_nationality: formatPpNationalityCapture(parsed.ppNationality)
  };
}

async function appendGovIdDocumentType(client, singlesId, documentType, columnSet, parsed = null) {
  if (!columnSet.has('gov_id_array')) return;
  const label = formatGovIdDocumentLabel(documentType, {
    state: documentType === 'driver_license' ? parsed?.state : null,
    nationalityCode: documentType === 'passport' ? parsed?.ppNationality : null
  });
  if (!label) return;
  await client.query(
    `UPDATE helloworldjunktest.singles
     SET gov_id_array = CASE
       WHEN gov_id_array IS NULL THEN ARRAY[$2]::text[]
       WHEN NOT ($2 = ANY(gov_id_array)) THEN array_append(gov_id_array, $2)
       ELSE gov_id_array
     END,
     updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1`,
    [singlesId, label]
  );
}

async function updateSinglesDlCaptureFromId(client, singlesId, parsed, slotDocumentType = null) {
  const colRes = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'helloworldjunktest'
       AND table_name = 'singles'`
  );
  const columnSet = new Set(colRes.rows.map((row) => row.column_name));
  const capture = buildDlCaptureFields(parsed, slotDocumentType);

  const updates = [];
  const values = [];
  for (const [column, value] of Object.entries(capture)) {
    if (!columnSet.has(column)) continue;
    values.push(value);
    updates.push(`${column} = $${values.length}`);
  }

  if (updates.length) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(singlesId);
    await client.query(
      `UPDATE helloworldjunktest.singles SET ${updates.join(', ')} WHERE singles_id = $${values.length}`,
      values
    );
  }

  const govIdType =
    normalizeGovIdSlotType(slotDocumentType) ||
    normalizeGovIdSlotType(parsed.documentType);
  await appendGovIdDocumentType(client, singlesId, govIdType, columnSet, parsed);
  return capture;
}

async function markIdentityVerified(client, singlesId) {
  await ensureCheckrTable(client);
  const identityVerifiedUdt = await loadColumnUdtName(client, CHECKR_SCHEMA, 'singles_checkr', 'identity_verified');
  const identityVerifiedTrue = sqlBooleanColumnLiteral(true, identityVerifiedUdt, CHECKR_SCHEMA);
  await client.query(
    `INSERT INTO helloworldjunktest.singles_checkr
     (singles_id, vetting_status, identity_verified, last_vetted_at)
     VALUES ($1, 'verified', ${identityVerifiedTrue}, CURRENT_TIMESTAMP)
     ON CONFLICT (singles_id) DO UPDATE SET
       identity_verified = ${identityVerifiedTrue},
       vetting_status = CASE
         WHEN helloworldjunktest.singles_checkr.vetting_status IN ('verified', 'pending') THEN helloworldjunktest.singles_checkr.vetting_status
         ELSE 'verified'
       END,
       last_vetted_at = CURRENT_TIMESTAMP`,
    [singlesId]
  );
}

async function memberHasProfilePhoto(singlesId) {
  const { rows } = await pool.query(
    `SELECT profile_image_fk FROM helloworldjunktest.singles WHERE singles_id = $1 LIMIT 1`,
    [singlesId]
  );
  const fk = Number(rows[0]?.profile_image_fk);
  return Number.isFinite(fk) && fk > 0;
}

async function runAdminImpersonationIdCapture(client, singlesId, slotDocumentType, idBytes, cfg) {
  const member = await loadMemberBasicsForRekognitionBypass(client, singlesId);
  const parsed = buildMockIdCardParsedForAdminBypass({ slotDocumentType, member });
  const matchCapture = adminImpersonationMatchCapture(cfg.faceMatchThreshold);

  await client.query('BEGIN');
  const captured = await updateSinglesDlCaptureFromId(client, singlesId, parsed, slotDocumentType);
  if (slotDocumentType === 'passport') {
    await updateVetBioPassportFieldsFromCapture(client, singlesId, parsed);
  }

  try {
    if (idBytes?.length) {
      const prefix = slotDocumentType === 'driver_license' ? 'dl_face_ref_' : 'pp_face_ref_';
      await persistIdFaceCropPhoto(client, singlesId, idBytes, prefix);
    }
  } catch (faceCropError) {
    console.warn('[rekognition:idCapture:adminBypass] face crop skipped', faceCropError?.message || faceCropError);
  }

  if (slotDocumentType === 'driver_license') {
    await updateSinglesDlProfileMatch(client, singlesId, matchCapture);
  } else if (slotDocumentType === 'passport') {
    await updateSinglesPpProfileMatch(client, singlesId, matchCapture);
  }

  await client.query('COMMIT');

  return {
    captured,
    parsed,
    profileMatch: matchCapture
  };
}

async function runAdminImpersonationIdentityVerify(client, singlesId, cfg, { passportBytes = null, idBytes = null } = {}) {
  const member = await loadMemberBasicsForRekognitionBypass(client, singlesId);
  const dlParsed = buildMockIdCardParsedForAdminBypass({ slotDocumentType: 'driver_license', member });
  const passportParsed = passportBytes
    ? buildMockIdCardParsedForAdminBypass({ slotDocumentType: 'passport', member })
    : null;
  const parsed = passportParsed ? mergeIdCardParsed(dlParsed, passportParsed) : dlParsed;

  const matchCapture = adminImpersonationMatchCapture(cfg.faceMatchThreshold);
  const liveScanProfileCapture = { percentMatch: matchCapture.percentMatch };
  const dlPhotoCapture = { percentMatch: matchCapture.percentMatch, scanResult: matchCapture.scanResult };

  await client.query('BEGIN');
  if (idBytes?.length) {
    await persistIdFaceCropPhoto(client, singlesId, idBytes, 'dl_face_ref_');
  }
  if (passportBytes?.length) {
    await persistIdFaceCropPhoto(client, singlesId, passportBytes, 'pp_face_ref_');
  }
  await updateSinglesLiveScanProfileMatch(client, singlesId, liveScanProfileCapture);
  await updateSinglesDlProfileMatch(client, singlesId, dlPhotoCapture);
  if (passportParsed) {
    await updateSinglesPpProfileMatch(client, singlesId, matchCapture);
  }
  await updateVetBioAfterVerification(client, singlesId, dlParsed, dlPhotoCapture, passportParsed);
  await updateSinglesMailingFromId(client, singlesId, parsed);
  await updateSinglesDlCaptureFromId(client, singlesId, dlParsed, 'driver_license');
  if (passportParsed) {
    await updateSinglesDlCaptureFromId(client, singlesId, passportParsed, 'passport');
  }
  await markIdentityVerified(client, singlesId);
  await client.query('COMMIT');

  return { parsed, dlPhotoCapture, liveScanProfileCapture, matchCapture };
}

export async function getRekognitionStatus(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  const cfg = getRekognitionConfig();
  const livenessRequiredEffective = isLivenessEnforcedForVerification(cfg);
  const hasProfilePhoto =
    Number.isFinite(singlesId) && singlesId > 0 ? await memberHasProfilePhoto(singlesId) : false;
  return res.json({
    configured: isRekognitionConfigured(),
    region: cfg.region,
    faceMatchThreshold: cfg.faceMatchThreshold,
    livenessMinConfidence: cfg.livenessMinConfidence,
    requireLiveness: cfg.requireLiveness,
    skipLiveFaceScan: cfg.skipLiveFaceScan,
    skipDlPassportCheck: cfg.skipDlPassportCheck,
    requireLivenessEffective: livenessRequiredEffective,
    livenessConfigured: cfg.livenessConfigured,
    identityPoolId: cfg.identityPoolId,
    rekognitionDebugUi: cfg.rekognitionDebugUi,
    liveScanCooldownMinutes: cfg.liveScanCooldownMinutes,
    hasProfilePhoto,
    useProfilePhotoAsSelfie: true
  });
}

export async function createRekognitionLivenessSession(req, res) {
  if (!isRekognitionConfigured()) {
    return res.status(503).json({ error: 'Identity verification is not available on the server' });
  }
  const cfg = getRekognitionConfig();
  if (!cfg.livenessConfigured) {
    return res.status(503).json({
      error:
        'Face liveness is not configured on the server. Contact support.'
    });
  }
  try {
    const session = await createFaceLivenessSession();
    if (!session.sessionId) {
      return res.status(502).json({ error: 'Failed to create face liveness session' });
    }
    if (cfg.rekognitionDebugUi) {
      console.log('[rekognition:livenessSession] created', {
        sessionId: session.sessionId,
        region: cfg.region,
        identityPoolId: cfg.identityPoolId
      });
    }
    return res.status(201).json({
      sessionId: session.sessionId,
      region: cfg.region,
      identityPoolId: cfg.identityPoolId,
      minConfidenceRequired: cfg.livenessMinConfidence
    });
  } catch (error) {
    console.error('[rekognition:livenessSession]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to create liveness session' });
  }
}

export async function getRekognitionLivenessResults(req, res) {
  if (!isRekognitionConfigured()) {
    return res.status(503).json({ error: 'Identity verification is not available on the server' });
  }
  const sessionId = toTrimmedText(req.params?.sessionId || req.query?.sessionId);
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' });
  }
  try {
    const cfg = getRekognitionConfig();
    const results = await getFaceLivenessSessionResults(sessionId);
    const evaluation = evaluateLivenessSession(results, cfg.livenessMinConfidence);
    if (cfg.rekognitionDebugUi) {
      console.log('[rekognition:livenessResults]', { sessionId, ...evaluation });
    }
    return res.json({
      sessionId,
      status: results.status,
      confidence: results.confidence,
      passed: evaluation.passed,
      passFailLabel: evaluation.passFailLabel,
      passFailReason: evaluation.passFailReason,
      statusNormalized: evaluation.statusNormalized,
      minConfidenceRequired: evaluation.minConfidenceRequired,
      referenceImageDataUrl: referenceImageDataUrlFromBytes(results.referenceImageBytes),
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[rekognition:livenessResults]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Failed to read liveness results' });
  }
}

/**
 * POST /api/rekognition/verify
 * Body: { driverLicenseImage | idImage, passportImage, selfieImage?, livenessSessionId?, consentFullName? }
 * When selfieImage is omitted, the member's on-file profile photo is used for ID face matching.
 * Images are processed in memory only — raw ID/selfie bytes are not persisted.
 */
export async function verifyIdentityWithRekognition(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isRekognitionConfigured() && !isAdminImpersonationRekognitionBypass(req.auth)) {
    return res.status(503).json({ error: 'Identity verification is not available on the server' });
  }

  const cfg = getRekognitionConfig();
  const livenessSessionId = toTrimmedText(req.body?.livenessSessionId);

  const client = await pool.connect();
  try {
    await trackUserSearchEvent(singlesId, 'identification_search');
    const mustEnforceLiveness = isLivenessEnforcedForVerification(cfg);

    if (isAdminImpersonationRekognitionBypass(req.auth)) {
      let driverLicenseBytes = null;
      let passportBytes = null;
      try {
        const driverLicenseImage = req.body?.driverLicenseImage || req.body?.idImage;
        if (driverLicenseImage) {
          driverLicenseBytes = await decodeAndPrepareGovIdImage(driverLicenseImage);
        }
        if (req.body?.passportImage) {
          passportBytes = await decodeAndPrepareGovIdImage(req.body.passportImage);
        }
      } catch (imageError) {
        console.warn('[rekognition:verify:adminBypass] optional ID image decode skipped', imageError?.message);
      }

      const { parsed, dlPhotoCapture, liveScanProfileCapture } = await runAdminImpersonationIdentityVerify(
        client,
        singlesId,
        cfg,
        { idBytes: driverLicenseBytes, passportBytes }
      );

      console.log('[rekognition:verify] admin impersonation bypass completed', { singlesId });

      return res.json({
        success: true,
        adminImpersonationBypass: true,
        message: 'Identity verification completed (admin impersonation bypass)',
        profileMatchSimilarity: dlPhotoCapture.percentMatch,
        idMatchSimilarity: dlPhotoCapture.percentMatch,
        dlProfilePercentMatch: dlPhotoCapture.percentMatch,
        dlProfileScanResult: dlPhotoCapture.scanResult,
        liveScanPercentMatch: liveScanProfileCapture.percentMatch,
        livenessSummary: { passed: true, adminImpersonationBypass: true },
        livenessEnforced: mustEnforceLiveness,
        useProfilePhotoAsSelfie: true,
        extracted: {
          firstName: parsed.firstName,
          middleInitial: parsed.middleInitial,
          middleName: parsed.middleName,
          lastName: parsed.lastName,
          address: parsed.address,
          city: parsed.city,
          dateOfBirth: parsed.dateOfBirth,
          sex: parsed.sex,
          height: parsed.height,
          countryOfCitizenship: parsed.countryOfCitizenship,
          countryOfBirth: parsed.countryOfBirth,
          ppNationality: parsed.ppNationality,
          documentType: parsed.documentType
        }
      });
    }

    if (cfg.skipDlPassportCheck) {
      let livenessSummary = null;
      if (mustEnforceLiveness) {
        if (!livenessSessionId) {
          return res.status(422).json({ error: 'Face liveness session is required before verification.' });
        }
        const { evaluation } = await assertLivenessSession(livenessSessionId, cfg.livenessMinConfidence);
        livenessSummary = evaluation;
      } else if (livenessSessionId) {
        const { evaluation } = await assertLivenessSession(livenessSessionId, cfg.livenessMinConfidence);
        livenessSummary = evaluation;
      }

      const profileBytes = await loadNormalizedProfilePhotoBytes(singlesId);
      const profileFaces = await detectSingleFace(profileBytes);
      if (profileFaces.faceCount < 1) {
        return res.status(400).json({
          error: 'No face detected on your profile photo. Update your profile photo in My Story, then try again.'
        });
      }

      const liveScanProfileMatch = await computeLiveScanProfileMatch(livenessSessionId, profileBytes);
      const liveScanSkipped = cfg.skipLiveFaceScan || liveScanProfileMatch.liveScanSkipped;
      if (mustEnforceLiveness && !liveScanSkipped) {
        if (liveScanProfileMatch.noFaceOnReference) {
          return res.status(422).json({
            error: 'No face detected on live scan reference image. Center your face and try again.'
          });
        }
        const liveMatchCapture = resolveProfileIdMatchCapture({
          similarity: liveScanProfileMatch.similarity,
          threshold: cfg.faceMatchThreshold
        });
        if (liveMatchCapture.scanResult !== 'Match') {
          return res.status(422).json({
            error: `Live face scan does not match your profile photo (${liveMatchCapture.percentMatch ?? 'N/A'}%; need ${cfg.faceMatchThreshold}%).`,
            liveScanPercentMatch: liveMatchCapture.percentMatch
          });
        }
      }

      const liveScanProfileCapture = resolveLiveScanProfileCapture({
        liveScanSkipped,
        similarity: liveScanProfileMatch.similarity
      });

      await client.query('BEGIN');
      if (!liveScanSkipped && livenessSessionId) {
        await persistLiveScanReferencePhoto(client, singlesId, livenessSessionId);
      }
      await updateSinglesLiveScanProfileMatch(client, singlesId, liveScanProfileCapture);
      await markIdentityVerified(client, singlesId);
      await client.query('COMMIT');

      return res.json({
        success: true,
        message: 'Live face scan verification completed',
        skipDlPassportCheck: true,
        liveScanPercentMatch: liveScanProfileCapture.percentMatch,
        livenessSummary,
        livenessEnforced: mustEnforceLiveness,
        useProfilePhotoAsSelfie: true
      });
    }

    let driverLicenseBytes;
    let passportBytes = null;
    try {
      const driverLicenseImage = req.body?.driverLicenseImage || req.body?.idImage;
      driverLicenseBytes = await decodeAndPrepareGovIdImage(driverLicenseImage);
      if (req.body?.passportImage) {
        passportBytes = await decodeAndPrepareGovIdImage(req.body.passportImage);
      }
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const idBytes = driverLicenseBytes;

    const useProfilePhotoAsSelfie = !req.body?.selfieImage;
    let uploadedSelfieBytes = null;
    if (!useProfilePhotoAsSelfie) {
      try {
        uploadedSelfieBytes = decodeDataUrlImage(req.body?.selfieImage);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    let livenessSummary = null;
    if (mustEnforceLiveness) {
      if (!livenessSessionId) {
        return res.status(422).json({ error: 'Face liveness session is required before verification.' });
      }
      const { evaluation } = await assertLivenessSession(livenessSessionId, cfg.livenessMinConfidence);
      livenessSummary = evaluation;
    } else if (livenessSessionId) {
      const { evaluation } = await assertLivenessSession(livenessSessionId, cfg.livenessMinConfidence);
      livenessSummary = evaluation;
    }

    const profileBytes = await loadNormalizedProfilePhotoBytes(singlesId);

    const idFaces = await detectSingleFace(idBytes);
    if (idFaces.faceCount < 1) {
      return res.status(400).json({ error: 'No face detected on ID photo. Use a clear photo of your ID.' });
    }

    const profileFaces = await detectSingleFace(profileBytes);
    if (profileFaces.faceCount < 1) {
      return res.status(400).json({
        error: 'No face detected on your profile photo. Update your profile photo in My Story, then try again.'
      });
    }

    let profileMatch = { matched: true, similarity: 100 };
    const faceBytesForIdMatch = useProfilePhotoAsSelfie ? profileBytes : uploadedSelfieBytes;

    if (!useProfilePhotoAsSelfie) {
      const selfieFaces = await detectSingleFace(uploadedSelfieBytes);
      if (selfieFaces.faceCount < 1) {
        return res.status(400).json({ error: 'No face detected on selfie. Retake your selfie in good lighting.' });
      }
      profileMatch = await compareFaces(uploadedSelfieBytes, profileBytes, cfg.faceMatchThreshold);
      if (!profileMatch.matched) {
        return res.status(422).json({
          error: 'Selfie does not match your profile photo',
          profileMatchSimilarity: profileMatch.similarity
        });
      }
    }

    const idMatch = await compareFaces(faceBytesForIdMatch, idBytes, cfg.faceMatchThreshold);
    if (!idMatch.matched) {
      return res.status(422).json({
        error: useProfilePhotoAsSelfie
          ? 'Your profile photo does not match the face on your ID'
          : 'Selfie does not match the face on your ID',
        idMatchSimilarity: idMatch.similarity
      });
    }

    const consentFullName = toTrimmedText(req.body?.consentFullName);
    const dlOcr = await ocrParseIdCardFromImage(idBytes);
    const passportOcr = passportBytes
      ? await ocrParseIdCardFromImage(passportBytes)
      : {
          parsed: {},
          lines: [],
          dobSource: null,
          sexSource: null,
          dobOcrTrace: null,
          sexOcrTrace: null,
          passportFieldTrace: null
        };
    const parsed = mergeIdCardParsed(dlOcr.parsed, passportOcr.parsed);
    const nameCheck = compareConsentNameToIdOcr(parsed, consentFullName);
    if (!nameCheck.matched) {
      return res.status(422).json({
        error: nameCheck.message,
        nameMismatch: true,
        extracted: {
          firstName: parsed.firstName,
          middleInitial: parsed.middleInitial,
          middleName: parsed.middleName,
          lastName: parsed.lastName,
          fullName: nameCheck.extractedFullName,
          address: parsed.address,
          city: parsed.city,
          dateOfBirth: parsed.dateOfBirth,
          sex: parsed.sex,
          height: parsed.height,
          countryOfCitizenship: parsed.countryOfCitizenship,
          countryOfBirth: parsed.countryOfBirth,
          documentType: parsed.documentType
        },
        ocrLineCount: dlOcr.lines.length + passportOcr.lines.length,
        dobSource: dlOcr.dobSource,
        sexSource: dlOcr.sexSource,
        dobOcrTrace: dlOcr.dobOcrTrace,
        sexOcrTrace: dlOcr.sexOcrTrace
      });
    }

    const liveScanProfileMatch = await computeLiveScanProfileMatch(
      livenessSessionId,
      profileBytes
    );
    const liveScanSkipped = cfg.skipLiveFaceScan || liveScanProfileMatch.liveScanSkipped;
    if (mustEnforceLiveness && !liveScanSkipped) {
      if (liveScanProfileMatch.noFaceOnReference) {
        return res.status(422).json({
          error: 'No face detected on live scan reference image. Center your face and try again.'
        });
      }
      const liveMatchCapture = resolveProfileIdMatchCapture({
        similarity: liveScanProfileMatch.similarity,
        threshold: cfg.faceMatchThreshold
      });
      if (liveMatchCapture.scanResult !== 'Match') {
        return res.status(422).json({
          error: `Live face scan does not match your profile photo (${liveMatchCapture.percentMatch ?? 'N/A'}%; need ${cfg.faceMatchThreshold}%).`,
          liveScanPercentMatch: liveMatchCapture.percentMatch
        });
      }
    }
    const liveScanProfileCapture = resolveLiveScanProfileCapture({
      liveScanSkipped,
      similarity: liveScanProfileMatch.similarity
    });
    const dlPhotoCapture = resolveDlPhotoScanCapture({
      liveScanSkipped,
      similarity: liveScanProfileMatch.similarity
    });

    await client.query('BEGIN');
    await persistIdFaceCropPhoto(client, singlesId, idBytes, 'dl_face_ref_');
    if (passportBytes) {
      await persistIdFaceCropPhoto(client, singlesId, passportBytes, 'pp_face_ref_');
    }
    if (!liveScanSkipped && livenessSessionId) {
      await persistLiveScanReferencePhoto(client, singlesId, livenessSessionId);
    }
    await updateSinglesLiveScanProfileMatch(client, singlesId, liveScanProfileCapture);
    await updateSinglesDlProfileMatch(client, singlesId, dlPhotoCapture);
    await updateVetBioAfterVerification(
      client,
      singlesId,
      dlOcr.parsed,
      dlPhotoCapture,
      passportBytes ? passportOcr.parsed : null
    );
    await updateSinglesMailingFromId(client, singlesId, parsed);
    await updateSinglesDlCaptureFromId(client, singlesId, dlOcr.parsed, 'driver_license');
    if (passportBytes) {
      await updateSinglesDlCaptureFromId(client, singlesId, passportOcr.parsed, 'passport');
    }
    await markIdentityVerified(client, singlesId);
    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Identity verification completed',
      profileMatchSimilarity: profileMatch.similarity,
      idMatchSimilarity: idMatch.similarity,
      dlProfilePercentMatch: dlPhotoCapture.percentMatch,
      dlProfileScanResult: dlPhotoCapture.scanResult,
      liveScanPercentMatch: liveScanProfileCapture.percentMatch,
      livenessSummary,
      livenessEnforced: mustEnforceLiveness,
      useProfilePhotoAsSelfie,
      selfiePurpose: useProfilePhotoAsSelfie
        ? 'Your on-file profile photo was compared to the face on your ID (no separate selfie upload). Liveness proves you were live on camera.'
        : 'Selfie is compared to your profile photo and ID face (separate from liveness, which only proves you were live on camera).',
      extracted: {
        firstName: parsed.firstName,
        middleInitial: parsed.middleInitial,
        middleName: parsed.middleName,
        lastName: parsed.lastName,
        address: parsed.address,
        city: parsed.city,
        dateOfBirth: parsed.dateOfBirth,
        sex: parsed.sex,
        height: parsed.height,
        countryOfCitizenship: parsed.countryOfCitizenship,
        countryOfBirth: parsed.countryOfBirth,
        ppNationality: parsed.ppNationality,
        documentType: parsed.documentType,
        age: computeAgeFromDob(parsed.dateOfBirth)
      },
      driverLicenseExtracted: {
        firstName: dlOcr.parsed.firstName,
        middleInitial: dlOcr.parsed.middleInitial,
        middleName: dlOcr.parsed.middleName,
        lastName: dlOcr.parsed.lastName,
        dateOfBirth: dlOcr.parsed.dateOfBirth,
        sex: dlOcr.parsed.sex,
        height: dlOcr.parsed.height,
        city: dlOcr.parsed.city,
        documentType: 'driver_license'
      },
      passportExtracted: {
        firstName: passportOcr.parsed.firstName,
        middleInitial: passportOcr.parsed.middleInitial,
        middleName: passportOcr.parsed.middleName,
        lastName: passportOcr.parsed.lastName,
        dateOfBirth: passportOcr.parsed.dateOfBirth,
        sex: passportOcr.parsed.sex,
        ppNationality: passportOcr.parsed.ppNationality,
        nationality: passportOcr.parsed.countryOfCitizenship,
        documentType: 'passport'
      },
      passportFieldTrace: passportOcr.passportFieldTrace,
      ocrLineCount: dlOcr.lines.length + passportOcr.lines.length,
      dobSource: dlOcr.dobSource,
      sexSource: dlOcr.sexSource,
      dobOcrTrace: dlOcr.dobOcrTrace,
      sexOcrTrace: dlOcr.sexOcrTrace
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[rekognition:verify]', error?.message || error);
    const friendly = buildAwsFriendlyError(error);
    if (friendly) {
      return res.status(friendly.status).json({ error: friendly.message });
    }
    const status = error?.message?.includes('liveness') ? 422 : 500;
    return res.status(status).json({ error: error?.message || 'Verification failed' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/rekognition/live-scan-profile-match
 * Body: { livenessSessionId }
 * Compare AWS liveness reference image to on-file profile photo (no DB writes).
 */
export async function previewLiveScanProfileMatch(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isRekognitionConfigured() && !isAdminImpersonationRekognitionBypass(req.auth)) {
    return res.status(503).json({ error: 'Identity verification is not available on the server' });
  }

  const sessionId = toTrimmedText(req.body?.livenessSessionId);
  if (!sessionId && !isAdminImpersonationRekognitionBypass(req.auth)) {
    return res.status(400).json({ error: 'livenessSessionId is required' });
  }

  try {
    const cfg = getRekognitionConfig();
    if (isAdminImpersonationRekognitionBypass(req.auth)) {
      const capture = adminImpersonationMatchCapture(cfg.faceMatchThreshold);
      console.log('[rekognition:liveScanProfileMatch] admin impersonation bypass', { singlesId });
      return res.json({
        success: true,
        adminImpersonationBypass: true,
        matched: true,
        profileMatchSimilarity: capture.percentMatch,
        liveScanPercentMatch: capture.percentMatch,
        profileMatchScanResult: capture.scanResult,
        idMatchSimilarity: capture.percentMatch,
        faceMatchThreshold: capture.faceMatchThreshold,
        livenessSummary: { passed: true, adminImpersonationBypass: true }
      });
    }

    const { results, evaluation } = await assertLivenessSession(sessionId, cfg.livenessMinConfidence);
    const profileBytes = await loadNormalizedProfilePhotoBytes(singlesId);
    const referenceImageBytes = results.referenceImageBytes;
    if (!referenceImageBytes) {
      return res.status(422).json({
        error: 'Live scan reference image is not available yet. Complete the scan and try again.'
      });
    }

    const refFaces = await detectSingleFace(referenceImageBytes);
    if (refFaces.faceCount < 1) {
      return res.status(422).json({
        error: 'No face detected on live scan reference image. Center your face and try again.'
      });
    }

    const profileFaces = await detectSingleFace(profileBytes);
    if (profileFaces.faceCount < 1) {
      return res.status(400).json({
        error: 'No face detected on your profile photo. Update your profile photo in My Story, then try again.'
      });
    }

    const match = await compareFaces(referenceImageBytes, profileBytes, 0);
    const capture = resolveProfileIdMatchCapture({
      similarity: match.similarity,
      threshold: cfg.faceMatchThreshold
    });

    return res.json({
      success: true,
      matched: capture.scanResult === 'Match',
      profileMatchSimilarity: capture.percentMatch,
      liveScanPercentMatch: capture.percentMatch,
      profileMatchScanResult: capture.scanResult,
      idMatchSimilarity: capture.percentMatch,
      faceMatchThreshold: cfg.faceMatchThreshold,
      referenceImageDataUrl: referenceImageDataUrlFromBytes(referenceImageBytes),
      livenessSummary: evaluation
    });
  } catch (error) {
    console.error('[rekognition:liveScanProfileMatch]', error?.message || error);
    const friendly = buildAwsFriendlyError(error);
    if (friendly) {
      return res.status(friendly.status).json({ error: friendly.message });
    }
    const msg = error?.message || 'Live scan profile match failed';
    const status = msg.includes('liveness') ? 422 : 500;
    return res.status(status).json({ error: msg });
  }
}

/**
 * POST /api/rekognition/face-match-preview
 * Body: { idImage }
 * Compare on-file profile photo to face on government ID (no DB writes).
 */
export async function previewFaceMatchForIdImage(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isRekognitionConfigured()) {
    return res.status(503).json({ error: 'Identity verification is not available on the server' });
  }

  let idBytes;
  try {
    idBytes = await decodeAndPrepareGovIdImage(req.body?.idImage);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  try {
    const cfg = getRekognitionConfig();
    const profileBytes = await loadNormalizedProfilePhotoBytes(singlesId);

    const idFaces = await detectSingleFace(idBytes);
    if (idFaces.faceCount < 1) {
      return res.status(400).json({ error: 'No face detected on ID photo. Use a clear photo of your ID.' });
    }

    const profileFaces = await detectSingleFace(profileBytes);
    if (profileFaces.faceCount < 1) {
      return res.status(400).json({
        error: 'No face detected on your profile photo. Update your profile photo in My Story, then try again.'
      });
    }

    const idMatch = await compareFaces(profileBytes, idBytes, cfg.faceMatchThreshold);
    return res.json({
      success: true,
      matched: idMatch.matched,
      profileMatchSimilarity: idMatch.similarity,
      idMatchSimilarity: idMatch.similarity,
      faceMatchThreshold: cfg.faceMatchThreshold
    });
  } catch (error) {
    console.error('[rekognition:faceMatchPreview]', error?.message || error);
    const friendly = buildAwsFriendlyError(error);
    if (friendly) {
      return res.status(friendly.status).json({ error: friendly.message });
    }
    return res.status(500).json({ error: error?.message || 'Face match preview failed' });
  }
}

/**
 * POST /api/rekognition/id-capture
 * Body: { idImage, documentType?: 'driver_license' | 'passport' }
 * OCR one government ID slot and persist dl_* or pp_nationality on singles.
 */
export async function captureDriverLicenseFromIdImage(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isRekognitionConfigured() && !isAdminImpersonationRekognitionBypass(req.auth)) {
    return res.status(503).json({ error: 'Identity verification is not available on the server' });
  }

  const slotDocumentType = normalizeGovIdSlotType(req.body?.documentType);
  if (!slotDocumentType) {
    return res.status(400).json({ error: 'documentType must be driver_license or passport.' });
  }

  let idBytes = null;
  const rawImage = req.body?.idImage;
  const adminBypass = isAdminImpersonationRekognitionBypass(req.auth);
  if (rawImage) {
    try {
      idBytes = await decodeAndPrepareGovIdImage(rawImage);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  } else if (!adminBypass) {
    return res.status(400).json({ error: 'idImage is required' });
  }

  const client = await pool.connect();
  try {
    const cfg = getRekognitionConfig();

    if (isAdminImpersonationRekognitionBypass(req.auth)) {
      const { captured, parsed, profileMatch } = await runAdminImpersonationIdCapture(
        client,
        singlesId,
        slotDocumentType,
        idBytes,
        cfg
      );
      const { age, underage, over18Verified } = await applyUnder18StatusFromDob(client, singlesId, parsed.dateOfBirth);
      console.log('[rekognition:idCapture] admin impersonation bypass', { singlesId, slotDocumentType, age, underage, over18Verified });
      return res.json({
        success: true,
        adminImpersonationBypass: true,
        underage,
        age,
        over18Verified,
        over_18_verified: over18Verified,
        message: underage
          ? UNDER18_ID_VERIFY_MESSAGE
          : 'Government ID fields captured (admin impersonation bypass).',
        documentType: slotDocumentType,
        captured,
        extracted: {
          firstName: parsed.firstName,
          middleInitial: parsed.middleInitial,
          middleName: parsed.middleName,
          lastName: parsed.lastName,
          address: parsed.address,
          city: parsed.city,
          dateOfBirth: parsed.dateOfBirth,
          sex: parsed.sex,
          height: parsed.height,
          nationality: parsed.countryOfCitizenship,
          ppNationality: parsed.ppNationality,
          countryOfBirth: parsed.countryOfBirth,
          placeOfBirth: parsed.countryOfBirth,
          documentType: slotDocumentType,
          age
        },
        profileMatchPercentMatch: profileMatch.percentMatch,
        profileMatchScanResult: profileMatch.scanResult,
        profileMatchMatched: profileMatch.matched,
        idMatchSimilarity: profileMatch.percentMatch,
        matched: profileMatch.matched,
        faceMatchThreshold: profileMatch.faceMatchThreshold,
        passportFieldTrace: null,
        ocrLineCount: 0,
        dobSource: 'admin_impersonation_bypass',
        sexSource: 'admin_impersonation_bypass',
        dobOcrTrace: null,
        sexOcrTrace: null
      });
    }

    const { parsed, lines: ocrLines, dobSource, sexSource, dobOcrTrace, sexOcrTrace, passportFieldTrace } =
      await ocrParseIdCardFromImage(idBytes);

    let profileMatch = {
      percentMatch: null,
      scanResult: null,
      matched: false,
      faceMatchThreshold: cfg.faceMatchThreshold
    };

    await client.query('BEGIN');
    const captured = await updateSinglesDlCaptureFromId(client, singlesId, parsed, slotDocumentType);
    if (slotDocumentType === 'passport') {
      await updateVetBioPassportFieldsFromCapture(client, singlesId, parsed);
    }
    const { age, underage, over18Verified } = await applyUnder18StatusFromDob(client, singlesId, parsed.dateOfBirth);

    try {
      const profileBytes = await loadNormalizedProfilePhotoBytes(singlesId);
      const idFaces = await detectSingleFace(idBytes);
      const profileFaces = await detectSingleFace(profileBytes);
      if (idFaces.faceCount >= 1 && profileFaces.faceCount >= 1) {
        const prefix = slotDocumentType === 'driver_license' ? 'dl_face_ref_' : 'pp_face_ref_';
        await persistIdFaceCropPhoto(client, singlesId, idBytes, prefix);
        const cmp = await compareFaces(profileBytes, idBytes, cfg.faceMatchThreshold);
        const matchCapture = resolveProfileIdMatchCapture({
          similarity: cmp.similarity,
          threshold: cfg.faceMatchThreshold
        });
        profileMatch = {
          ...matchCapture,
          matched: cmp.matched,
          faceMatchThreshold: cfg.faceMatchThreshold
        };
        if (slotDocumentType === 'driver_license') {
          await updateSinglesDlProfileMatch(client, singlesId, matchCapture);
        } else if (slotDocumentType === 'passport') {
          await updateSinglesPpProfileMatch(client, singlesId, matchCapture);
        }
      }
    } catch (faceMatchError) {
      console.warn('[rekognition:idCapture] profile face match skipped', faceMatchError?.message || faceMatchError);
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      underage,
      age,
      over18Verified,
      over_18_verified: over18Verified,
      message: underage ? UNDER18_ID_VERIFY_MESSAGE : 'Government ID fields captured.',
      documentType: slotDocumentType,
      captured,
      extracted: {
        firstName: parsed.firstName,
        middleInitial: parsed.middleInitial,
        middleName: parsed.middleName,
        lastName: parsed.lastName,
        address: parsed.address,
        city: parsed.city,
        dateOfBirth: parsed.dateOfBirth,
        sex: parsed.sex,
        height: parsed.height,
        nationality: parsed.countryOfCitizenship,
        ppNationality: parsed.ppNationality,
        countryOfBirth: parsed.countryOfBirth,
        placeOfBirth: parsed.countryOfBirth,
        documentType: slotDocumentType,
        age
      },
      profileMatchPercentMatch: profileMatch.percentMatch,
      profileMatchScanResult: profileMatch.scanResult,
      profileMatchMatched: profileMatch.matched,
      idMatchSimilarity: profileMatch.percentMatch,
      matched: profileMatch.matched,
      faceMatchThreshold: profileMatch.faceMatchThreshold,
      passportFieldTrace,
      ocrLineCount: ocrLines.length,
      dobSource,
      sexSource,
      dobOcrTrace,
      sexOcrTrace
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[rekognition:idCapture]', error?.message || error);
    const friendly = buildAwsFriendlyError(error);
    if (friendly) {
      return res.status(friendly.status).json({ error: friendly.message });
    }
    return res.status(500).json({ error: error?.message || 'Failed to capture government ID fields' });
  } finally {
    client.release();
  }
}

/**
 * POST /api/rekognition/mark-over-18-verified
 * Dev/support bypass: set singles.over_18_verified = true for the authenticated member.
 */
export async function postMarkOver18Verified(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    await pool.query(
      `UPDATE helloworldjunktest.singles
       SET over_18_verified = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $1`,
      [singlesId]
    );
    console.log('[rekognition:mark-over-18-verified]', { singlesId });
    return res.json({ success: true, over_18_verified: true });
  } catch (err) {
    console.error('[rekognition:mark-over-18-verified]', err?.message || err);
    return res.status(500).json({ error: err?.message || 'Failed to mark over 18 verified' });
  }
}
