import pool from '../../db/connection.js';
import { getDBSchema } from '../../config/envConfig.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import {
  briefBioApprovalSelectExpr,
  briefBioRequestSelectExpr,
  fullBioApprovalSelectExpr,
  fullBioRequestSelectExpr
} from './requestApprovalSql.js';
import { parseApprovedViewingDurationMonths } from '../../utils/approvedViewingDurationConfig.js';
import { expireElapsedApprovedViewingForSender } from '../../utils/requestApprovedViewingExpiry.js';
import { withSchemaCache } from '../../utils/dbSchemaMetadataCache.js';
import { sqlBooleanEnumIsTrue, sqlBooleanEnumSelectAsBool } from '../../utils/booleanEnum.js';
import { sqlGalleryVideoIdsSubquery } from '../../utils/galleryMediaSql.js';
import {
  REQUESTS_BRIEF_PAID_COLUMN,
  REQUESTS_FULL_PAID_COLUMN
} from '../../utils/requestsPaidColumns.js';
import { buildSinglesActiveStatusWhereSql } from './memberVisibility.js';
import { isToolsOnlyAdminAuth } from '../../utils/adminAuth.js';

/** Same cache keys as getMyPicks.js `requestColumns` / `singlesColumns`. */
async function getRequestColumns(schemaName) {
  return withSchemaCache(`requestColumns:${schemaName}`, async () => {
    const cols = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'requests'`,
      [schemaName]
    );
    return new Set(cols.rows.map((r) => r.column_name));
  });
}

async function getSinglesColumns(schemaName) {
  return withSchemaCache(`singlesColumns:${schemaName}`, async () => {
    const cols = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'singles'`,
      [schemaName]
    );
    return new Set(cols.rows.map((r) => r.column_name));
  });
}

function firstExistingColumnExpr(columnsSet, aliases, tableAlias = 's_to') {
  for (const col of aliases) {
    if (columnsSet.has(col)) return `${tableAlias}.${col}`;
  }
  return 'NULL';
}

/** True when request status enum is 'requested'. */
function requestFlagIsTrue(expr) {
  return `LOWER(BTRIM(COALESCE((${expr})::text, 'notrequested'))) = 'requested'`;
}

/** True when approval_status_enum is approve (Brief or Full bio response). */
function approvalIsApprove(expr) {
  return `LOWER(BTRIM(COALESCE((${expr})::text, 'noresponse'))) IN ('approve', 'approved', 'true', 'yes', '1')`;
}

/**
 * Outgoing info requests: rows where JWT user is `singles_id_from` (sender).
 * Recipient profile (`s_to`) is the member card shown (e.g. singles_id_to 31, 2, 3).
 */
export async function getRequestedSingles(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (isToolsOnlyAdminAuth(req.auth)) {
    return res.json([]);
  }

  try {
    const resolvedSchema = await resolveRequestsAppSchema();
    const schemaCandidates = [...new Set([resolvedSchema, 'helloworldjunktest', getDBSchema(), 'public'].filter(Boolean))];
    let bestRows = [];

    for (const schemaName of schemaCandidates) {
      const has = await getRequestColumns(schemaName);
      if (has.size === 0) continue;
      await expireElapsedApprovedViewingForSender(pool, schemaName, me, parseApprovedViewingDurationMonths());
      const singlesCols = await getSinglesColumns(schemaName);

      const basicRequestExpr = briefBioRequestSelectExpr(has);
      const fullBioRequestExpr = fullBioRequestSelectExpr(has);
      const briefPaidExpr = has.has(REQUESTS_BRIEF_PAID_COLUMN)
        ? sqlBooleanEnumSelectAsBool('r', REQUESTS_BRIEF_PAID_COLUMN, 'brief_paid')
        : 'false AS brief_paid';
      const fullPaidExpr = has.has(REQUESTS_FULL_PAID_COLUMN)
        ? sqlBooleanEnumSelectAsBool('r', REQUESTS_FULL_PAID_COLUMN, 'full_paid')
        : 'false AS full_paid';
      const basicApprovalExpr = briefBioApprovalSelectExpr(has);
      const fullBioApprovalExpr = fullBioApprovalSelectExpr(has);
      const firstNameExpr = firstExistingColumnExpr(singlesCols, ['firstname', 'first_name']);
      const lastNameExpr = firstExistingColumnExpr(singlesCols, ['lastname', 'last_name']);
      const ageExpr = firstExistingColumnExpr(singlesCols, ['age']);
      const currentCityExpr = firstExistingColumnExpr(singlesCols, ['current_city', 'city']);
      const educationExpr = firstExistingColumnExpr(singlesCols, ['education']);
      const careerExpr = firstExistingColumnExpr(singlesCols, ['career', 'job']);
      const childrenExpr = firstExistingColumnExpr(singlesCols, ['children']);
      const homeCityExpr = firstExistingColumnExpr(singlesCols, ['home_city']);
      const countryExpr = firstExistingColumnExpr(singlesCols, ['countryofbirth', 'country_of_birth']);
      const religionExpr = firstExistingColumnExpr(singlesCols, ['religion']);
      const hobbiesExpr = firstExistingColumnExpr(singlesCols, ['hobbies']);

      const nameStatusExpr = firstExistingColumnExpr(singlesCols, ['name_vetted']);
      const nameNoteExpr = firstExistingColumnExpr(singlesCols, ['name_vetted_note']);
      const nameDateExpr = firstExistingColumnExpr(singlesCols, ['name_vetted_date']);
      const photoStatusExpr = firstExistingColumnExpr(singlesCols, ['profilephoto_vetted']);
      const photoNoteExpr = firstExistingColumnExpr(singlesCols, ['profilephoto_vetted_note']);
      const photoDateExpr = firstExistingColumnExpr(singlesCols, ['profilephoto_vetted_date']);
      const ageStatusExpr = firstExistingColumnExpr(singlesCols, ['age_vetted']);
      const ageNoteExpr = firstExistingColumnExpr(singlesCols, ['age_vetted_note']);
      const ageDateExpr = firstExistingColumnExpr(singlesCols, ['age_vetted_date']);
      const currentCityStatusExpr = firstExistingColumnExpr(singlesCols, ['current_city_vetted', 'city_vetted']);
      const currentCityNoteExpr = firstExistingColumnExpr(singlesCols, ['current_city_vetted_note', 'city_vetted_note']);
      const currentCityDateExpr = firstExistingColumnExpr(singlesCols, ['current_city_vetted_date', 'city_vetted_date']);

      const educationStatusExpr = firstExistingColumnExpr(singlesCols, ['education_vetted', 'job_vetted']);
      const educationNoteExpr = firstExistingColumnExpr(singlesCols, ['education_vetted_note', 'job_vetted_note']);
      const educationDateExpr = firstExistingColumnExpr(singlesCols, ['education_vetted_date', 'job_vetted_date']);
      const careerStatusExpr = firstExistingColumnExpr(singlesCols, ['career_vetted', 'job_vetted']);
      const careerNoteExpr = firstExistingColumnExpr(singlesCols, ['career_vetted_note', 'job_vetted_note']);
      const careerDateExpr = firstExistingColumnExpr(singlesCols, ['career_vetted_date', 'job_vetted_date']);
      const childrenStatusExpr = firstExistingColumnExpr(singlesCols, ['children_vetted']);
      const childrenNoteExpr = firstExistingColumnExpr(singlesCols, ['children_vetted_note']);
      const childrenDateExpr = firstExistingColumnExpr(singlesCols, ['children_vetted_date']);
      const homeCityStatusExpr = firstExistingColumnExpr(singlesCols, ['home_city_vetted', 'current_city_vetted', 'city_vetted']);
      const homeCityNoteExpr = firstExistingColumnExpr(singlesCols, ['home_city_vetted_note', 'current_city_vetted_note', 'city_vetted_note']);
      const homeCityDateExpr = firstExistingColumnExpr(singlesCols, ['home_city_vetted_date', 'current_city_vetted_date', 'city_vetted_date']);
      const countryStatusExpr = firstExistingColumnExpr(singlesCols, ['countryofbirth_vetted', 'country_of_birth_vetted']);
      const countryNoteExpr = firstExistingColumnExpr(singlesCols, ['countryofbirth_vetted_note', 'country_of_birth_vetted_note']);
      const countryDateExpr = firstExistingColumnExpr(singlesCols, ['countryofbirth_vetted_date', 'country_of_birth_vetted_date']);
      const religionStatusExpr = firstExistingColumnExpr(singlesCols, ['religion_vetted']);
      const religionNoteExpr = firstExistingColumnExpr(singlesCols, ['religion_vetted_note']);
      const religionDateExpr = firstExistingColumnExpr(singlesCols, ['religion_vetted_date']);
      const hobbiesStatusExpr = firstExistingColumnExpr(singlesCols, ['hobbies_vetted']);
      const hobbiesNoteExpr = firstExistingColumnExpr(singlesCols, ['hobbies_vetted_note']);
      const hobbiesDateExpr = firstExistingColumnExpr(singlesCols, ['hobbies_vetted_date']);
      const activeStatusSql = buildSinglesActiveStatusWhereSql('s_to');
      const result = await pool.query(
        `SELECT
         r.requests_id,
         r.singles_id_from,
         r.singles_id_to,
         ${basicRequestExpr} AS brief_bio_request,
         ${fullBioRequestExpr} AS full_bio_request,
         ${briefPaidExpr},
         ${fullPaidExpr},
         ${basicApprovalExpr} AS brief_bio_request_approval,
         ${fullBioApprovalExpr} AS full_bio_request_approval,
         ${has.has('block_user') ? `${sqlBooleanEnumSelectAsBool('r', 'block_user')},` : 'false AS block_user,'}
         r.created_at,
         r.updated_at,
         s_to.prefix,
         s_to.member_id,
         s_to.profile_image_fk,
         s_to.alias,
         ${firstNameExpr} AS first_name,
         ${lastNameExpr} AS last_name,
         ${ageExpr} AS age,
         ${currentCityExpr} AS current_city,
         ${educationExpr} AS education,
         ${careerExpr} AS career,
         ${childrenExpr} AS children,
         ${homeCityExpr} AS home_city,
         ${countryExpr} AS country_of_birth,
         ${religionExpr} AS religion,
         ${hobbiesExpr} AS hobbies,
         ${nameStatusExpr} AS name_verification_status,
         ${nameNoteExpr} AS name_vetted_note,
         ${nameDateExpr} AS name_vetted_date,
         ${photoStatusExpr} AS photo_verification_status,
         ${photoNoteExpr} AS photo_vetted_note,
         ${photoDateExpr} AS photo_vetted_date,
         ${ageStatusExpr} AS age_verification_status,
         ${ageNoteExpr} AS age_vetted_note,
         ${ageDateExpr} AS age_vetted_date,
         ${currentCityStatusExpr} AS current_city_verification_status,
         ${currentCityNoteExpr} AS current_city_vetted_note,
         ${currentCityDateExpr} AS current_city_vetted_date,
         ${educationStatusExpr} AS education_verification_status,
         ${educationNoteExpr} AS education_vetted_note,
         ${educationDateExpr} AS education_vetted_date,
         ${careerStatusExpr} AS career_verification_status,
         ${careerNoteExpr} AS career_vetted_note,
         ${careerDateExpr} AS career_vetted_date,
         ${childrenStatusExpr} AS children_verification_status,
         ${childrenNoteExpr} AS children_vetted_note,
         ${childrenDateExpr} AS children_vetted_date,
         ${homeCityStatusExpr} AS home_city_verification_status,
         ${homeCityNoteExpr} AS home_city_vetted_note,
         ${homeCityDateExpr} AS home_city_vetted_date,
         ${countryStatusExpr} AS country_of_birth_verification_status,
         ${countryNoteExpr} AS country_of_birth_vetted_note,
         ${countryDateExpr} AS country_of_birth_vetted_date,
         ${religionStatusExpr} AS religion_verification_status,
         ${religionNoteExpr} AS religion_vetted_note,
         ${religionDateExpr} AS religion_vetted_date,
         ${hobbiesStatusExpr} AS hobbies_verification_status,
         ${hobbiesNoteExpr} AS hobbies_vetted_note,
         ${hobbiesDateExpr} AS hobbies_vetted_date,
         s_to.vetted_basic_status,
         COALESCE(
           (SELECT array_agg(p.photos_id ORDER BY p.display_order NULLS LAST, p.photos_id)
            FROM ${schemaName}.photos p
            WHERE p.singles_id = s_to.singles_id),
           ARRAY[]::bigint[]
         ) AS gallery_photo_ids,
         COALESCE(
           (SELECT array_agg(p.photos_id ORDER BY p.display_order NULLS LAST, p.photos_id)
            FROM ${schemaName}.photos p
            WHERE p.singles_id = s_to.singles_id
              AND LOWER(BTRIM(COALESCE(p.type::text, ''))) = 'public'),
           ARRAY[]::bigint[]
         ) AS public_gallery_photo_ids,
         ${sqlGalleryVideoIdsSubquery(schemaName, 's_to.singles_id', { albumType: 'public' })} AS public_gallery_video_ids,
         COALESCE(
           (SELECT array_agg(p.photos_id ORDER BY p.display_order NULLS LAST, p.photos_id)
            FROM ${schemaName}.photos p
            WHERE p.singles_id = s_to.singles_id
              AND LOWER(BTRIM(COALESCE(p.type::text, ''))) = 'private'),
           ARRAY[]::bigint[]
         ) AS private_gallery_photo_ids,
         ${sqlGalleryVideoIdsSubquery(schemaName, 's_to.singles_id', { albumType: 'private' })} AS private_gallery_video_ids
       FROM ${schemaName}.requests r
       JOIN ${schemaName}.singles s_to
         ON r.singles_id_to = s_to.singles_id
       WHERE r.singles_id_from = $1
        AND ${activeStatusSql}
        AND (
          ${requestFlagIsTrue(basicRequestExpr)}
          OR ${requestFlagIsTrue(fullBioRequestExpr)}
        )
        AND (
          ${approvalIsApprove(basicApprovalExpr)}
          OR ${approvalIsApprove(fullBioApprovalExpr)}
        )
        ${
          has.has('block_user')
            ? `AND NOT EXISTS (
          SELECT 1
          FROM ${schemaName}.requests r_other
          WHERE r_other.singles_id_from = r.singles_id_to
            AND r_other.singles_id_to = r.singles_id_from
            AND ${sqlBooleanEnumIsTrue('r_other', 'block_user')}
        )`
            : ''
        }
       ORDER BY COALESCE(r.updated_at, r.created_at) DESC, r.singles_id_to ASC`,
        [me]
      );

      if (result.rows.length > bestRows.length) {
        bestRows = result.rows;
      }
    }

    return res.json(bestRows);
  } catch (error) {
    console.error('Error fetching requested singles (outgoing requests):', error);
    return res.status(500).json({ error: 'Failed to fetch requests from database' });
  }
}
