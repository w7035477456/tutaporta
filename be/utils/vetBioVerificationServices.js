import pool from '../db/connection.js';
import { BIO_SINGLES_FK_COLUMN, loadTableColumns, resolveBioSchema, sqlIdent, upsertBioRow } from '../routes/singles/checkrBioReviewDb.js';

export const VERIFICATION_STATUS_VALUES = ['notstarted', 'completed', 'error'];

export const VERIFICATION_CHANNEL_COLUMNS = {
  id: 'id_verification',
  work: 'work_verification',
  education: 'education_verification',
  linkedin: 'linkedin_verification'
};

export const VERIFICATION_CHANNEL_DATE_COLUMNS = {
  id: 'id_verification_date',
  work: 'work_verification_date',
  education: 'education_verification_date',
  linkedin: 'linkedin_verification_date'
};

export function normalizeVerificationStatus(value) {
  const raw = String(value ?? 'notstarted').trim().toLowerCase();
  if (VERIFICATION_STATUS_VALUES.includes(raw)) return raw;
  return 'notstarted';
}

export function verificationStatusLabel(status) {
  const key = normalizeVerificationStatus(status);
  if (key === 'completed') return 'Completed';
  if (key === 'error') return 'Error';
  return 'Not Started';
}

async function upsertVetBioFields(singlesId, fields) {
  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
  return upsertBioRow(pool, schemaName, 'vet_bio', singlesId, fields, vetColumns);
}

/**
 * @param {number} singlesId
 * @param {'id'|'work'|'education'|string} channelOrColumn
 * @param {string} status
 */
export async function setVetBioVerificationStatus(singlesId, channelOrColumn, status) {
  const channelKey = Object.keys(VERIFICATION_CHANNEL_COLUMNS).find(
    (key) => VERIFICATION_CHANNEL_COLUMNS[key] === channelOrColumn
  );
  const column =
    VERIFICATION_CHANNEL_COLUMNS[channelOrColumn] ||
    VERIFICATION_CHANNEL_COLUMNS[channelKey] ||
    String(channelOrColumn ?? '').trim();
  if (!column) return false;

  const normalized = normalizeVerificationStatus(status);
  const fields = { [column]: normalized };
  const dateColumn =
    VERIFICATION_CHANNEL_DATE_COLUMNS[channelOrColumn] ||
    VERIFICATION_CHANNEL_DATE_COLUMNS[channelKey];
  // id_verification_date is set on Rekognition dialog Close (see finalizeIdVerificationDateOnClose).
  if (dateColumn && dateColumn !== 'id_verification_date' && normalized === 'completed') {
    fields[dateColumn] = new Date();
  }
  // Admin reset: clear cooldown date so the member can run Identification Search again.
  if (dateColumn && (normalized === 'notstarted' || normalized === 'error')) {
    fields[dateColumn] = null;
  }
  // Admin Id Search → notstarted: also clear profile-photo cooldown date (Make this Profile gate).
  if (column === 'id_verification' && normalized === 'notstarted') {
    fields.profilephoto_vetted_date = null;
  }
  return upsertVetBioFields(singlesId, fields);
}

function normalizeVettingStatusValue(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isVettingInfoMatches(value) {
  return normalizeVettingStatusValue(value) === 'info_matches';
}

/**
 * On Identification Verification Close: set id_verification_date when UI showed success
 * and vet_bio firstname_vetted + profilephoto_vetted are both info_matches; otherwise null.
 *
 * @param {number} singlesId
 * @param {{ verificationComplete: boolean }} options
 */
export async function finalizeIdVerificationDateOnClose(singlesId, { verificationComplete }) {
  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
  if (!vetColumns.has('id_verification_date')) {
    return { idVerificationDate: null, applied: false };
  }

  let nextDate = null;
  if (verificationComplete && vetColumns.has('firstname_vetted') && vetColumns.has('profilephoto_vetted')) {
    const schema = sqlIdent(schemaName);
    const result = await pool.query(
      `SELECT firstname_vetted, profilephoto_vetted
       FROM ${schema}.vet_bio
       WHERE singles_id = $1
       LIMIT 1`,
      [singlesId]
    );
    const row = result.rows[0] || {};
    if (isVettingInfoMatches(row.firstname_vetted) && isVettingInfoMatches(row.profilephoto_vetted)) {
      nextDate = new Date();
    }
  }

  const applied = await upsertVetBioFields(singlesId, { id_verification_date: nextDate });
  return { idVerificationDate: nextDate, applied };
}

export async function loadVetBioVerificationServices(singlesId) {
  const schemaName = await resolveBioSchema();
  const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
  const schema = sqlIdent(schemaName);

  const hasAny = Object.values(VERIFICATION_CHANNEL_COLUMNS).some((col) => vetColumns.has(col));
  const dateSelect = Object.values(VERIFICATION_CHANNEL_DATE_COLUMNS)
    .filter((col) => vetColumns.has(col))
    .map((col) => sqlIdent(col))
    .join(', ');
  const dateSql = dateSelect ? `, ${dateSelect}` : '';

  if (!hasAny) {
    return {
      id_verification: 'notstarted',
      work_verification: 'notstarted',
      education_verification: 'notstarted',
      linkedin_verification: 'notstarted',
      id_verification_date: null,
      work_verification_date: null,
      education_verification_date: null,
      linkedin_verification_date: null,
      columnsAvailable: false
    };
  }

  const linkedinSelect = vetColumns.has('linkedin_verification') ? ', linkedin_verification' : '';
  const result = await pool.query(
    `SELECT id_verification, work_verification, education_verification${linkedinSelect}${dateSql}
     FROM ${schema}.vet_bio
     WHERE ${sqlIdent(BIO_SINGLES_FK_COLUMN)} = $1
     LIMIT 1`,
    [singlesId]
  );

  const row = result.rows[0] || {};
  return {
    id_verification: normalizeVerificationStatus(row.id_verification),
    work_verification: normalizeVerificationStatus(row.work_verification),
    education_verification: normalizeVerificationStatus(row.education_verification),
    linkedin_verification: normalizeVerificationStatus(row.linkedin_verification),
    id_verification_date: row.id_verification_date ?? null,
    work_verification_date: row.work_verification_date ?? null,
    education_verification_date: row.education_verification_date ?? null,
    linkedin_verification_date: row.linkedin_verification_date ?? null,
    columnsAvailable: true
  };
}
