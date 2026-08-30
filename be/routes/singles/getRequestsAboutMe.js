import pool from '../../db/connection.js';
import {
  briefBioApprovalSelectExpr,
  briefBioRequestSelectExpr,
  fullBioApprovalSelectExpr,
  fullBioRequestSelectExpr
} from './requestApprovalSql.js';
import { getDBSchema } from '../../config/envConfig.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { parseApprovedViewingDurationMonths } from '../../utils/approvedViewingDurationConfig.js';
import { parseApprovalStayDurationDays } from '../../utils/approvalStayDurationConfig.js';
import { expireElapsedApprovedViewing } from '../../utils/requestApprovedViewingExpiry.js';
import { expireElapsedRequestApprovals } from '../../utils/requestApprovalStay.js';
import { buildSinglesActiveStatusWhereSql } from './memberVisibility.js';
import { sqlGalleryVideoIdsSubquery } from '../../utils/galleryMediaSql.js';
import { loadMemberCategoryForSinglesId } from '../../utils/regularMemberActivityTimestamp.js';
import {
  enforceRegularMemberBioRequestApprovalsInDb,
  sanitizeIncomingBioRequestApprovalRow
} from '../../utils/regularMemberBioRequestApprovalLock.js';

async function getRequestColumns(schemaName) {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'
       AND column_name IN (
         'brief_bio_request',
         'full_bio_request',
         'brief_bio_request_approval',
         'full_bio_request_approval',
         'brief_approval_date',
         'full_approval_date',
         'block_user'
       )`,
    [schemaName]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

const VET_BIO_MATCH_COLUMNS = [
  'profilephoto_vetted',
  'firstname_vetted',
  'middlename_vetted',
  'lastname_vetted',
  'age_vetted',
  'current_city_vetted',
  'job_title_vetted',
  'countryofcitizenship_vetted',
  'college_name_vetted',
  'current_company_vetted',
  'highest_degree_completed_vetted',
  'professional_license_vetted',
  'degree_graduation_date_vetted',
  'credit_score_grade_vetted',
  'company_domain_name_vetted',
  'linkedin_url_vetted'
];

async function getVetBioColumns(schemaName) {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'vet_bio'
       AND column_name = ANY($2::text[])`,
    [schemaName, VET_BIO_MATCH_COLUMNS]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

function vetBioSelectExprs(vetBioCols) {
  return VET_BIO_MATCH_COLUMNS.map((column) =>
    vetBioCols.has(column) ? `vb_to.${column}` : 'NULL::text'
  ).map((expr, index) => `${expr} AS ${VET_BIO_MATCH_COLUMNS[index]}`);
}

async function hasVetBioTable(schemaName) {
  const result = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_name = 'vet_bio'
     LIMIT 1`,
    [schemaName]
  );
  return result.rows.length > 0;
}

export async function getRequestsAboutMe(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const memberCategory = await loadMemberCategoryForSinglesId(pool, me);
    const resolvedSchema = await resolveRequestsAppSchema();
    const schemaCandidates = [...new Set([resolvedSchema, getDBSchema(), 'helloworldjunktest', 'public'].filter(Boolean))];
    let fallbackRows = [];

    for (const schemaName of schemaCandidates) {
      const has = await getRequestColumns(schemaName);
      if (has.size === 0) continue;

      await expireElapsedRequestApprovals(pool, schemaName, has, me, parseApprovalStayDurationDays());
      await expireElapsedApprovedViewing(pool, schemaName, me, parseApprovedViewingDurationMonths());
      await enforceRegularMemberBioRequestApprovalsInDb(pool, schemaName, me, memberCategory);

      const basicRequestExpr = briefBioRequestSelectExpr(has);
      const fullBioRequestExpr = fullBioRequestSelectExpr(has);
      const basicApprovalExpr = briefBioApprovalSelectExpr(has);
      const fullBioApprovalExpr = fullBioApprovalSelectExpr(has);

      const vetBioTableExists = await hasVetBioTable(schemaName);
      const vetBioCols = vetBioTableExists ? await getVetBioColumns(schemaName) : new Set();
      const vetBioJoin = vetBioTableExists
        ? `LEFT JOIN ${schemaName}.vet_bio vb_to ON vb_to.singles_id = s_to.singles_id`
        : '';
      const vetBioSelectSql = vetBioSelectExprs(vetBioCols).join(',\n         ');

      const result = await pool.query(
        `SELECT
         r.requests_id,
         r.singles_id_from,
         r.singles_id_to,
         ${basicRequestExpr} AS brief_bio_request,
         ${fullBioRequestExpr} AS full_bio_request,
         ${basicApprovalExpr} AS brief_bio_request_approval,
         ${fullBioApprovalExpr} AS full_bio_request_approval,
         ${has.has('brief_approval_date') ? 'r.brief_approval_date,' : 'NULL::date AS brief_approval_date,'}
         ${has.has('full_approval_date') ? 'r.full_approval_date,' : 'NULL::date AS full_approval_date,'}
         ${
           has.has('block_user')
             ? `COALESCE(
         (SELECT ${sqlBooleanEnumIsTrue('r_other', 'block_user')}
          FROM ${schemaName}.requests r_other
          WHERE r_other.singles_id_from = r.singles_id_to
            AND r_other.singles_id_to = r.singles_id_from
          LIMIT 1),
         false
       ) AS block_user,`
             : 'false AS block_user,'
         }
         ${vetBioSelectSql ? `${vetBioSelectSql},` : ''}
         r.created_at,
         r.updated_at,
         s_from.prefix,
         s_from.member_id,
         s_from.profile_image_fk,
         s_from.alias,
         s_from.vetted_basic_status,
         COALESCE(
           (SELECT array_agg(p.photos_id ORDER BY p.display_order NULLS LAST, p.photos_id)
            FROM ${schemaName}.photos p
            WHERE p.singles_id = s_from.singles_id),
           ARRAY[]::bigint[]
         ) AS gallery_photo_ids,
         ${sqlGalleryVideoIdsSubquery(schemaName, 's_from.singles_id')} AS gallery_video_ids
       FROM ${schemaName}.singles s_to
       JOIN ${schemaName}.requests r
         ON r.singles_id_to = s_to.singles_id
       JOIN ${schemaName}.singles s_from
         ON r.singles_id_from = s_from.singles_id
       ${vetBioJoin}
       WHERE s_to.singles_id = $1
         AND ${buildSinglesActiveStatusWhereSql('s_from')}
         AND (${basicRequestExpr} = 'requested' OR ${fullBioRequestExpr} = 'requested')
        ORDER BY COALESCE(r.updated_at, r.created_at) DESC`,
        [me]
      );

      if (result.rows.length > 0) {
        return res.json(
          result.rows.map((row) => sanitizeIncomingBioRequestApprovalRow(row, memberCategory))
        );
      }
      if (fallbackRows.length === 0) {
        fallbackRows = result.rows;
      }
    }

    return res.json(fallbackRows.map((row) => sanitizeIncomingBioRequestApprovalRow(row, memberCategory)));
  } catch (error) {
    console.error('Error fetching requests about me:', error);
    return res.status(500).json({ error: 'Failed to fetch requests from database' });
  }
}
