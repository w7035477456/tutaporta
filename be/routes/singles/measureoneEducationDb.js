import pool from '../../db/connection.js';
import { parseBooleanEnumRaw, sqlBooleanEnumParam, toBooleanEnumLabel } from '../../utils/booleanEnum.js';

const EDU_SCHEMA = 'helloworldjunktest';

let tableReady = false;

export async function ensureUserEducationVerificationsTable() {
  if (tableReady) return;
  await pool.query(
    `CREATE TABLE IF NOT EXISTS helloworldjunktest.user_education_verifications (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      measureone_individual_id VARCHAR(64),
      measureone_datarequest_id VARCHAR(64),
      raw_academic_record JSONB,
      digest_record JSONB,
      academic_summary_response JSONB,
      is_verified helloworldjunktest.boolean_enum NOT NULL DEFAULT 'false'::helloworldjunktest.boolean_enum,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT user_education_verifications_user_id_key UNIQUE (user_id)
    )`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_edu_measureone_individual
     ON helloworldjunktest.user_education_verifications (measureone_individual_id)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_edu_measureone_datarequest
     ON helloworldjunktest.user_education_verifications (measureone_datarequest_id)`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_edu_gpa
     ON helloworldjunktest.user_education_verifications ((digest_record->'verification_summary'->>'cumulative_gpa'))`
  );
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_user_edu_school
     ON helloworldjunktest.user_education_verifications ((digest_record->'verification_summary'->>'verified_institution_name'))`
  );
  await pool.query(
    `CREATE OR REPLACE VIEW helloworldjunktest.user_education_verifications_summary AS
     SELECT
       u.id,
       u.user_id,
       u.is_verified,
       COALESCE(
         u.digest_record->'verification_summary'->>'verified_institution_name',
         u.raw_academic_record->'institution'->>'name'
       ) AS college_name,
       COALESCE(
         u.digest_record->'verification_summary'->>'highest_degree_earned',
         u.raw_academic_record->'degrees'->0->>'title'
       ) AS degree,
       COALESCE(
         u.digest_record->'verification_summary'->>'primary_major',
         u.raw_academic_record->'degrees'->0->>'major'
       ) AS major,
       COALESCE(
         u.digest_record->'verification_summary'->>'graduation_date',
         u.raw_academic_record->'degrees'->0->>'confer_date'
       ) AS graduation_date,
       u.digest_record->'verification_summary'->>'cumulative_gpa' AS cumulative_gpa,
       u.measureone_individual_id,
       u.measureone_datarequest_id,
       u.updated_at
     FROM helloworldjunktest.user_education_verifications u`
  );
  tableReady = true;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    measureoneIndividualId: row.measureone_individual_id,
    measureoneDatarequestId: row.measureone_datarequest_id,
    rawAcademicRecord: row.raw_academic_record,
    digestRecord: row.digest_record,
    academicSummaryResponse: row.academic_summary_response,
    isVerified: parseBooleanEnumRaw(row.is_verified),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function loadUserEducationVerification(userId) {
  await ensureUserEducationVerificationsTable();
  const result = await pool.query(
    `SELECT *
     FROM helloworldjunktest.user_education_verifications
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );
  return mapRow(result.rows[0]);
}

export async function loadUserEducationVerificationByDatarequestId(datarequestId) {
  const id = String(datarequestId ?? '').trim();
  if (!id) return null;
  await ensureUserEducationVerificationsTable();
  const result = await pool.query(
    `SELECT *
     FROM helloworldjunktest.user_education_verifications
     WHERE measureone_datarequest_id = $1
     LIMIT 1`,
    [id]
  );
  return mapRow(result.rows[0]);
}

/**
 * Returns stored academic summary when verified (skips MeasureOne API).
 */
export async function getCachedAcademicSummaryResponse(userId, datarequestId = null) {
  const row = await loadUserEducationVerification(userId);
  if (!row?.isVerified || !row.academicSummaryResponse) return null;

  const requestedId = String(datarequestId ?? '').trim();
  if (
    requestedId &&
    row.measureoneDatarequestId &&
    row.measureoneDatarequestId !== requestedId
  ) {
    // Member already has verified data from a prior request — reuse to avoid another API charge.
    return row.academicSummaryResponse;
  }

  return row.academicSummaryResponse;
}

export async function upsertUserEducationVerification({
  userId,
  measureoneIndividualId = null,
  measureoneDatarequestId = null,
  rawAcademicRecord = null,
  digestRecord = null,
  academicSummaryResponse = null,
  isVerified = false
}) {
  await ensureUserEducationVerificationsTable();
  const result = await pool.query(
    `INSERT INTO helloworldjunktest.user_education_verifications (
       user_id,
       measureone_individual_id,
       measureone_datarequest_id,
       raw_academic_record,
       digest_record,
       academic_summary_response,
       is_verified,
       updated_at
     )
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, ${sqlBooleanEnumParam('$7', EDU_SCHEMA)}, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE SET
       measureone_individual_id = COALESCE(EXCLUDED.measureone_individual_id, helloworldjunktest.user_education_verifications.measureone_individual_id),
       measureone_datarequest_id = COALESCE(EXCLUDED.measureone_datarequest_id, helloworldjunktest.user_education_verifications.measureone_datarequest_id),
       raw_academic_record = COALESCE(EXCLUDED.raw_academic_record, helloworldjunktest.user_education_verifications.raw_academic_record),
       digest_record = COALESCE(EXCLUDED.digest_record, helloworldjunktest.user_education_verifications.digest_record),
       academic_summary_response = COALESCE(EXCLUDED.academic_summary_response, helloworldjunktest.user_education_verifications.academic_summary_response),
       is_verified = EXCLUDED.is_verified OR helloworldjunktest.user_education_verifications.is_verified,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      userId,
      measureoneIndividualId,
      measureoneDatarequestId,
      rawAcademicRecord ?? null,
      digestRecord ?? null,
      academicSummaryResponse ?? null,
      toBooleanEnumLabel(isVerified)
    ]
  );
  return mapRow(result.rows[0]);
}
