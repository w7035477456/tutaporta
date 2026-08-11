import pool from '../../db/connection.js';
import { resolveRequestsAppSchema } from './resolveRequestsAppSchema.js';
import { sqlInterestedIsTrue } from './interestedSql.js';
import {
  briefBioApprovalSelectExpr,
  fullBioApprovalSelectExpr
} from './requestApprovalSql.js';
import { logMyStoryPhotos, logMyStoryPhotosAlways, myStoryPhotoDebugEnabled } from '../../utils/myStoryPhotoDebug.js';
import { sanitizePostingCommentText } from '../../utils/postingCommentContactSanitizer.js';
import { withSchemaCache } from '../../utils/dbSchemaMetadataCache.js';
import { buildSinglesActiveStatusWhereSql } from './memberVisibility.js';
import { sqlBooleanEnumIsTrue } from '../../utils/booleanEnum.js';
import { ensurePostingQuarterlyPartitionsBeforeWrite } from '../../utils/ensureQuarterlyPartitions.js';
import { normalizeApprovalStatus } from '../../utils/approvalStatusEnum.js';
import { sqlGalleryVideoIdsSubquery } from '../../utils/galleryMediaSql.js';
import { isToolsOnlyAdminAuth } from '../../utils/adminAuth.js';

let notificationDismissSchemaPromise = null;

async function ensureNotificationDismissSchemaReady() {
  if (notificationDismissSchemaPromise) return notificationDismissSchemaPromise;
  notificationDismissSchemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS helloworldjunktest.user_post_notification_dismissed (
        singles_id bigint NOT NULL,
        post_id bigint NOT NULL,
        dismissed_at timestamptz NOT NULL DEFAULT NOW(),
        PRIMARY KEY (singles_id, post_id)
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_post_notification_dismissed_singles
      ON helloworldjunktest.user_post_notification_dismissed (singles_id, dismissed_at DESC)
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS helloworldjunktest.user_post_notification_read_state (
        singles_id bigint PRIMARY KEY,
        last_read_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
  })().catch((err) => {
    notificationDismissSchemaPromise = null;
    throw err;
  });
  return notificationDismissSchemaPromise;
}

function normalizeBool(value) {
  if (value === true || value === 1) return true;
  const text = String(value ?? '').trim().toLowerCase();
  return text === 'true' || text === '1' || text === 't' || text === 'yes' || text === 'y';
}

export async function relationExists(schemaName, tableName) {
  return withSchemaCache(`relationExists:${schemaName}:${tableName}`, async () => {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_name = $2
       LIMIT 1`,
      [schemaName, tableName]
    );
    return result.rows.length > 0;
  });
}

function normalizeRequestState(value) {
  const text = String(value ?? '')
    .trim()
    .toLowerCase();
  return text === 'requested' ? 'requested' : 'notrequested';
}

async function requestColumns(schemaName) {
  return withSchemaCache(`requestColumns:${schemaName}`, async () => {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'requests'`,
      [schemaName]
    );
    return new Set(result.rows.map((r) => r.column_name));
  });
}

async function singlesColumns(schemaName) {
  return withSchemaCache(`singlesColumns:${schemaName}`, async () => {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'singles'`,
      [schemaName]
    );
    return new Set(result.rows.map((r) => r.column_name));
  });
}

function firstExistingColumnExpr(columnsSet, aliases, tableAlias = 's') {
  for (const col of aliases) {
    if (columnsSet.has(col)) return `${tableAlias}.${col}`;
  }
  return 'NULL';
}

function normalizeApprovalValue(value) {
  return normalizeApprovalStatus(value) ?? normalizeApprovalStatus(null);
}

function pickFullBioExpr(columns) {
  if (columns.has('full_bio_request')) return `LOWER(BTRIM(COALESCE(r.full_bio_request::text, 'notrequested')))`;
  return `'notrequested'`;
}

function pickBriefBioExpr(columns) {
  if (columns.has('brief_bio_request')) return `LOWER(BTRIM(COALESCE(r.brief_bio_request::text, 'notrequested')))`;
  return `'notrequested'`;
}

function requestIsRequestedExpr(expr) {
  return `LOWER(BTRIM(COALESCE((${expr})::text, 'notrequested'))) = 'requested'`;
}

function normalizePostingVisibility(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === 'friends') return 'friends';
  if (raw === 'myself' || raw === 'me_only' || raw === 'me-only' || raw === 'private') return 'mySelf';
  return 'public';
}

/** API-normalized visibility -> DB enum/text (posting_visibility_enum uses me_only, not mySelf). */
function postingVisibilityForDb(value) {
  const normalized = normalizePostingVisibility(value);
  if (normalized === 'mySelf') return 'me_only';
  return normalized;
}

function sanitizeTextForPublicView(value) {
  const text = String(value ?? '');
  if (!text) return '';
  return sanitizePostingCommentText(text);
}

/** Persist path-only URLs so posting rows work on every host (avoids http://localhost:… in DB). */
function normalizePostingPhotoUrlForStorage(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const absPhoto = raw.match(/^https?:\/\/[^/]+(\/api\/photo\/\d+)/i);
  if (absPhoto) return absPhoto[1];
  const absVideo = raw.match(/^https?:\/\/[^/]+(\/api\/video\/\d+)/i);
  if (absVideo) return absVideo[1];
  const pathOnly = raw.split('?')[0];
  if (pathOnly.startsWith('/api/photo/')) return pathOnly;
  if (pathOnly.startsWith('/api/video/')) return pathOnly;
  if (/^api\/photo\/\d+$/i.test(pathOnly)) return `/${pathOnly}`;
  if (/^api\/video\/\d+$/i.test(pathOnly)) return `/${pathOnly}`;
  return raw;
}

/** When drag-drop stored photos_id as /api/video/:id, rewrite to /api/photo/:id for this owner. */
async function correctPostingMediaUrlForOwner(client, singlesId, url) {
  const normalized = normalizePostingPhotoUrlForStorage(url);
  const videoMatch = normalized.match(/^\/api\/video\/(\d+)$/i);
  if (!videoMatch) return normalized;
  const mediaId = Number(videoMatch[1]);
  if (!Number.isFinite(mediaId) || mediaId < 1) return normalized;

  const videoCheck = await client.query(
    `SELECT 1
     FROM helloworldjunktest.videos
     WHERE video_id = $1 AND singles_id = $2
     LIMIT 1`,
    [mediaId, singlesId]
  );
  if (videoCheck.rows.length > 0) return normalized;

  const photoCheck = await client.query(
    `SELECT 1
     FROM helloworldjunktest.photos
     WHERE photos_id = $1 AND singles_id = $2
     LIMIT 1`,
    [mediaId, singlesId]
  );
  if (photoCheck.rows.length > 0) {
    return `/api/photo/${mediaId}`;
  }
  return normalized;
}

async function buildPostingMediaUrlCorrections(client, singlesId, urls) {
  const videoIds = new Set();
  for (const url of urls) {
    const normalized = normalizePostingPhotoUrlForStorage(url);
    const match = normalized.match(/^\/api\/video\/(\d+)$/i);
    if (match) videoIds.add(Number(match[1]));
  }
  if (!videoIds.size) return new Map();

  const ids = [...videoIds];
  const [videoRows, photoRows] = await Promise.all([
    client.query(
      `SELECT video_id
       FROM helloworldjunktest.videos
       WHERE singles_id = $1 AND video_id = ANY($2::bigint[])`,
      [singlesId, ids]
    ),
    client.query(
      `SELECT photos_id
       FROM helloworldjunktest.photos
       WHERE singles_id = $1 AND photos_id = ANY($2::bigint[])`,
      [singlesId, ids]
    )
  ]);
  const videoSet = new Set(videoRows.rows.map((row) => Number(row.video_id)));
  const photoSet = new Set(photoRows.rows.map((row) => Number(row.photos_id)));
  const corrections = new Map();
  for (const id of ids) {
    if (!videoSet.has(id) && photoSet.has(id)) {
      corrections.set(id, `/api/photo/${id}`);
    }
  }
  return corrections;
}

function applyPostingMediaUrlCorrection(url, corrections) {
  const normalized = normalizePostingPhotoUrlForStorage(url);
  const match = normalized.match(/^\/api\/video\/(\d+)$/i);
  if (!match) return normalized;
  const id = Number(match[1]);
  return corrections.get(id) || normalized;
}

export function postingVisibilityExpr(postingVisibilityColumn, alias = 'p') {
  if (!postingVisibilityColumn) return "'public'";
  if (postingVisibilityColumn === 'is_private') {
    return `CASE WHEN ${sqlBooleanEnumIsTrue(alias, 'is_private')} THEN 'mySelf' ELSE 'public' END`;
  }
  if (postingVisibilityColumn === 'is_public') {
    return `CASE WHEN ${sqlBooleanEnumIsTrue(alias, 'is_public')} THEN 'public' ELSE 'mySelf' END`;
  }
  return `CASE
    WHEN LOWER(COALESCE(${alias}.${postingVisibilityColumn}::text, 'public')) = 'public' THEN 'public'
    WHEN LOWER(COALESCE(${alias}.${postingVisibilityColumn}::text, 'public')) = 'friends' THEN 'friends'
    WHEN LOWER(COALESCE(${alias}.${postingVisibilityColumn}::text, 'public')) IN ('myself', 'me_only', 'me-only', 'private') THEN 'mySelf'
    ELSE 'public'
  END`;
}

async function resolvePostingsOwnerColumn(postingsSchema) {
  return withSchemaCache(`postingsOwnerColumn:${postingsSchema}`, async () => {
    const cols = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'postings'
         AND column_name IN ('singles_id', 'user_id')`,
      [postingsSchema]
    );
    const names = new Set(cols.rows.map((r) => r.column_name));
    if (names.has('singles_id')) return 'singles_id';
    if (names.has('user_id')) return 'user_id';
    return 'singles_id';
  });
}

export async function resolvePostingVisibilityColumn(postingsSchema) {
  return withSchemaCache(`postingVisibilityColumn:${postingsSchema}`, async () => {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'postings'
         AND column_name IN ('is_private', 'posting_visibility', 'post_visibility', 'visibility', 'audience', 'is_public')
       ORDER BY CASE column_name
        WHEN 'posting_visibility' THEN 0
        WHEN 'is_private' THEN 1
         WHEN 'post_visibility' THEN 2
         WHEN 'visibility' THEN 3
         WHEN 'audience' THEN 4
         ELSE 5
       END
       LIMIT 1`,
      [postingsSchema]
    );
    return result.rows[0]?.column_name || null;
  });
}

/** Nullable repost attribution columns on postings (added via addPostingsRepostedFromSinglesId.sql). */
export async function resolvePostingRepostColumns(postingsSchema) {
  return withSchemaCache(`postingRepostColumns:${postingsSchema}`, async () => {
    const result = await pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = $1
         AND table_name = 'postings'
         AND column_name IN ('reposted_from_singles_id', 'reposted_from_post_id')`,
      [postingsSchema]
    );
    const names = new Set(result.rows.map((row) => row.column_name));
    return {
      repostedFromSinglesId: names.has('reposted_from_singles_id') ? 'reposted_from_singles_id' : null,
      repostedFromPostId: names.has('reposted_from_post_id') ? 'reposted_from_post_id' : null
    };
  });
}

function anyApprovedExpr(columns) {
  const checks = [];
  const basicApprovalColumns = ['brief_bio_request_approval'];
  const detailApprovalColumns = ['full_bio_request_approval'];
  const boolApprovalColumns = ['full_bio_request'];

  for (const col of basicApprovalColumns) {
    if (columns.has(col)) {
      checks.push(`LOWER(COALESCE(r.${col}::text, '')) IN ('approve','approved','true','1','t','yes','y')`);
    }
  }
  for (const col of detailApprovalColumns) {
    if (columns.has(col)) {
      checks.push(`LOWER(COALESCE(r.${col}::text, '')) IN ('approve','approved','true','1','t','yes','y')`);
    }
  }
  for (const col of boolApprovalColumns) {
    if (columns.has(col)) {
      checks.push(`LOWER(BTRIM(COALESCE(r.${col}::text, 'notrequested'))) = 'requested'`);
    }
  }
  return checks.length ? checks.join(' OR ') : 'false';
}

export async function resolvePostingsSchema() {
  return withSchemaCache('resolvePostingsSchema:v1', async () => {
    const candidates = ['helloworldjunktest'];
    for (const schemaName of candidates) {
      const hasPostings = await relationExists(schemaName, 'postings');
      const hasPostingPhotos = await relationExists(schemaName, 'posting_photos');
      const hasPostingComments = await relationExists(schemaName, 'posting_comments');
      if (hasPostings && hasPostingPhotos) return schemaName;
    }
    return 'helloworldjunktest';
  });
}

async function resolveCheckrSchema() {
  return withSchemaCache('resolveCheckrSchema:v1', async () => {
    const candidates = ['helloworldjunktest'];
    for (const schemaName of candidates) {
      if (await relationExists(schemaName, 'singles_checkr')) return schemaName;
    }
    return 'helloworldjunktest';
  });
}

export async function canViewTargetFullBio(requestSchema, me, targetSinglesId) {
  if (me === targetSinglesId) return true;
  const cols = await requestColumns(requestSchema);
  const approvalExpr = anyApprovedExpr(cols);
  const result = await pool.query(
    `SELECT
       COALESCE(MAX(CASE WHEN (${approvalExpr}) THEN 1 ELSE 0 END), 0) AS has_approved
     FROM ${requestSchema}.requests r
     WHERE (r.singles_id_from = $1 AND r.singles_id_to = $2)
        OR (r.singles_id_from = $2 AND r.singles_id_to = $1)`,
    [me, targetSinglesId]
  );
  return Number(result.rows[0]?.has_approved ?? 0) > 0;
}

/** Buddy access: Full Bio approved (brief-only does not qualify). */
export async function canViewTargetFriendsPosts(requestSchema, me, targetSinglesId) {
  if (Number(me) === Number(targetSinglesId)) return true;
  const cols = await requestColumns(requestSchema);
  if (!cols.has('full_bio_request_approval')) return false;
  const result = await pool.query(
    `SELECT 1
     FROM ${requestSchema}.requests r
     WHERE (
       (r.singles_id_from = $1 AND r.singles_id_to = $2)
       OR (r.singles_id_from = $2 AND r.singles_id_to = $1)
     )
       AND LOWER(COALESCE(r.full_bio_request_approval::text, '')) IN ('approve','approved','true','1','t','yes','y')
     LIMIT 1`,
    [me, targetSinglesId]
  );
  return result.rows.length > 0;
}

export async function getMyPicksList(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (isToolsOnlyAdminAuth(req.auth)) {
    return res.json([]);
  }

  try {
    const requestSchema = await resolveRequestsAppSchema();
    const checkrSchema = await resolveCheckrSchema();
    const reqCols = await requestColumns(requestSchema);
    const singlesCols = await singlesColumns(requestSchema);
    const briefExpr = pickBriefBioExpr(reqCols);
    const fullExpr = pickFullBioExpr(reqCols);
    const basicApprovalExpr = briefBioApprovalSelectExpr(reqCols, 'r');
    const fullApprovalExpr = fullBioApprovalSelectExpr(reqCols, 'r');
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

    const activeStatusSql = buildSinglesActiveStatusWhereSql('s');
    const rows = await pool.query(
      `WITH latest_requests AS (
         SELECT DISTINCT ON (r.singles_id_to)
           r.singles_id_to,
           r.brief_bio_request,
           r.full_bio_request,
           ${basicApprovalExpr} AS brief_bio_request_approval,
           ${fullApprovalExpr} AS full_bio_request_approval,
           COALESCE(r.updated_at, r.created_at) AS request_ts
         FROM ${requestSchema}.requests r
         WHERE r.singles_id_from = $1
           AND ${sqlInterestedIsTrue('r')}
         ORDER BY
           r.singles_id_to,
           COALESCE(r.updated_at, r.created_at) DESC,
           r.requests_id DESC
       )
       SELECT
         s.singles_id,
         s.prefix,
         s.member_id,
         s.alias,
         s.profile_image_fk,
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
         COALESCE(
           (SELECT array_agg(p.photos_id ORDER BY p.display_order NULLS LAST, p.photos_id)
            FROM ${requestSchema}.photos p
            WHERE p.singles_id = s.singles_id
              AND LOWER(COALESCE(TRIM(p.type::text), '')) = 'public'),
           ARRAY[]::bigint[]
         ) AS gallery_photo_ids,
         ${sqlGalleryVideoIdsSubquery(requestSchema, 's.singles_id', { albumType: 'public' })} AS gallery_video_ids,
         LOWER(BTRIM(COALESCE(lr.brief_bio_request::text, 'notrequested'))) AS brief_bio_request,
         LOWER(BTRIM(COALESCE(lr.full_bio_request::text, 'notrequested'))) AS full_bio_request,
         lr.brief_bio_request_approval,
         lr.full_bio_request_approval,
         COALESCE(sc.vetting_status, 'unverified') AS vetting_status,
         EXISTS (
           SELECT 1
           FROM ${requestSchema}.requests rb
           WHERE (
             (rb.singles_id_from = $1 AND rb.singles_id_to = s.singles_id)
             OR (rb.singles_id_from = s.singles_id AND rb.singles_id_to = $1)
           )
           AND ${requestIsRequestedExpr(fullExpr.replaceAll('r.', 'rb.'))}
         ) AS can_view_full_bio
       FROM latest_requests lr
       JOIN ${requestSchema}.singles s ON s.singles_id = lr.singles_id_to
       LEFT JOIN ${checkrSchema}.singles_checkr sc ON sc.singles_id = s.singles_id
       WHERE ${activeStatusSql}
       ORDER BY lr.request_ts DESC, s.singles_id ASC`,
      [me]
    );

    return res.json(
      rows.rows.map((row) => ({
        singles_id: Number(row.singles_id),
        prefix: row.prefix ?? null,
        member_id: row.member_id ?? null,
        alias: row.alias ?? null,
        profile_image_fk: row.profile_image_fk ?? null,
        first_name: row.first_name ?? null,
        last_name: row.last_name ?? null,
        age: row.age ?? null,
        current_city: row.current_city ?? null,
        education: row.education ?? null,
        career: row.career ?? null,
        children: row.children ?? null,
        home_city: row.home_city ?? null,
        country_of_birth: row.country_of_birth ?? null,
        religion: row.religion ?? null,
        hobbies: row.hobbies ?? null,
        name_verification_status: row.name_verification_status ?? null,
        name_vetted_note: row.name_vetted_note ?? null,
        name_vetted_date: row.name_vetted_date ?? null,
        photo_verification_status: row.photo_verification_status ?? null,
        photo_vetted_note: row.photo_vetted_note ?? null,
        photo_vetted_date: row.photo_vetted_date ?? null,
        age_verification_status: row.age_verification_status ?? null,
        age_vetted_note: row.age_vetted_note ?? null,
        age_vetted_date: row.age_vetted_date ?? null,
        current_city_verification_status: row.current_city_verification_status ?? null,
        current_city_vetted_note: row.current_city_vetted_note ?? null,
        current_city_vetted_date: row.current_city_vetted_date ?? null,
        education_verification_status: row.education_verification_status ?? null,
        education_vetted_note: row.education_vetted_note ?? null,
        education_vetted_date: row.education_vetted_date ?? null,
        career_verification_status: row.career_verification_status ?? null,
        career_vetted_note: row.career_vetted_note ?? null,
        career_vetted_date: row.career_vetted_date ?? null,
        children_verification_status: row.children_verification_status ?? null,
        children_vetted_note: row.children_vetted_note ?? null,
        children_vetted_date: row.children_vetted_date ?? null,
        home_city_verification_status: row.home_city_verification_status ?? null,
        home_city_vetted_note: row.home_city_vetted_note ?? null,
        home_city_vetted_date: row.home_city_vetted_date ?? null,
        country_of_birth_verification_status: row.country_of_birth_verification_status ?? null,
        country_of_birth_vetted_note: row.country_of_birth_vetted_note ?? null,
        country_of_birth_vetted_date: row.country_of_birth_vetted_date ?? null,
        religion_verification_status: row.religion_verification_status ?? null,
        religion_vetted_note: row.religion_vetted_note ?? null,
        religion_vetted_date: row.religion_vetted_date ?? null,
        hobbies_verification_status: row.hobbies_verification_status ?? null,
        hobbies_vetted_note: row.hobbies_vetted_note ?? null,
        hobbies_vetted_date: row.hobbies_vetted_date ?? null,
        gallery_photo_ids: Array.isArray(row.gallery_photo_ids) ? row.gallery_photo_ids : [],
        gallery_video_ids: Array.isArray(row.gallery_video_ids) ? row.gallery_video_ids : [],
        brief_bio_request: normalizeRequestState(row.brief_bio_request),
        full_bio_request: normalizeRequestState(row.full_bio_request),
        brief_bio_request_approval: normalizeApprovalValue(row.brief_bio_request_approval),
        full_bio_request_approval: normalizeApprovalValue(row.full_bio_request_approval),
        vetting_status: String(row.vetting_status ?? 'unverified').trim().toLowerCase(),
        can_view_full_bio: normalizeBool(row.can_view_full_bio)
      }))
    );
  } catch (error) {
    console.error('getMyPicksList error:', error);
    return res.status(500).json({ error: 'Failed to load My Picks list' });
  }
}

export async function getMyPicksFeed(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const targetSinglesId = Number(req.params.targetSinglesId);
  if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) {
    return res.status(400).json({ error: 'Invalid target singles id' });
  }
  if (isToolsOnlyAdminAuth(req.auth)) {
    return res.json({
      target_singles_id: targetSinglesId,
      can_view_full_bio: false,
      can_view_private_posts: false,
      message: '',
      has_more: false,
      next_cursor: null,
      posts: []
    });
  }
  const queryLimitRaw = Number(req.query?.limit);
  const queryLimit = Number.isFinite(queryLimitRaw) ? Math.max(1, Math.min(50, Math.trunc(queryLimitRaw))) : null;
  const beforeCreatedAtRaw = String(req.query?.beforeCreatedAt ?? '').trim();
  const beforeCreatedAt = beforeCreatedAtRaw ? new Date(beforeCreatedAtRaw) : null;
  const beforeCreatedAtIso = beforeCreatedAt && !Number.isNaN(beforeCreatedAt.getTime()) ? beforeCreatedAt.toISOString() : null;
  const beforePostIdRaw = Number(req.query?.beforePostId);
  const beforePostId = Number.isFinite(beforePostIdRaw) && beforePostIdRaw > 0 ? Math.trunc(beforePostIdRaw) : null;
  const visibilityFeedRaw = String(req.query?.visibilityFeed ?? '').trim().toLowerCase();
  const visibilityFeed = visibilityFeedRaw === 'friends' ? 'friends' : visibilityFeedRaw === 'public' ? 'public' : null;

  try {
    logMyStoryPhotos('[getMyPicksFeed] request', { me, targetSinglesId });
    const isSelfFeed = me === targetSinglesId;
    if (!isSelfFeed) {
      const activeCheck = await pool.query(
        `SELECT 1
         FROM helloworldjunktest.singles s
         WHERE s.singles_id = $1
           AND ${buildSinglesActiveStatusWhereSql('s')}
         LIMIT 1`,
        [targetSinglesId]
      );
      if (!activeCheck.rows.length) {
        return res.json({
          target_singles_id: targetSinglesId,
          can_view_full_bio: false,
          can_view_private_posts: false,
          message: '',
          has_more: false,
          next_cursor: null,
          posts: []
        });
      }
    }
    const requestSchema = await resolveRequestsAppSchema();
    const postingsSchema = await resolvePostingsSchema();
    logMyStoryPhotos('[getMyPicksFeed] schemas', { requestSchema, postingsSchema });
    const [canViewPrivatePosts, canViewFriendsPosts, postingVisibilityColumn, postingRepostColumns] = await Promise.all([
      canViewTargetFullBio(requestSchema, me, targetSinglesId),
      canViewTargetFriendsPosts(requestSchema, me, targetSinglesId),
      resolvePostingVisibilityColumn(postingsSchema),
      resolvePostingRepostColumns(postingsSchema)
    ]);
    const visibilityExpr = postingVisibilityExpr(postingVisibilityColumn, 'p');
    let privateVisibilityFilter = '';
    if (!isSelfFeed) {
      if (visibilityFeed === 'public') {
        privateVisibilityFilter = `AND (${visibilityExpr}) = 'public'`;
      } else if (visibilityFeed === 'friends') {
        privateVisibilityFilter = canViewFriendsPosts
          ? `AND (${visibilityExpr}) = 'friends'`
          : 'AND false';
      } else if (canViewPrivatePosts) {
        privateVisibilityFilter = `AND (${visibilityExpr}) <> 'mySelf'`;
      } else if (canViewFriendsPosts) {
        privateVisibilityFilter = `AND (${visibilityExpr}) IN ('public','friends')`;
      } else {
        privateVisibilityFilter = `AND (${visibilityExpr}) = 'public'`;
      }
    }

    const hasPostingComments = await relationExists(postingsSchema, 'posting_comments');
    const ownerColumn = hasPostingComments ? await resolvePostingsOwnerColumn(postingsSchema) : null;
    const postingCommentCountExpr = hasPostingComments
      ? `COALESCE((
           SELECT COUNT(*)::int
           FROM ${postingsSchema}.posting_comments pc
           JOIN ${postingsSchema}.posting_photos pp ON pp.photo_id = pc.photo_id
           WHERE pp.post_id = p.post_id
             AND NOT ${sqlBooleanEnumIsTrue('pc', 'is_liked')}
         ), 0)`
      : '0';
    const postingLikeCountExpr = hasPostingComments
      ? `COALESCE((
           SELECT COUNT(*)::int
           FROM ${postingsSchema}.posting_comments pc
           JOIN ${postingsSchema}.posting_photos pp ON pp.photo_id = pc.photo_id
           WHERE pp.post_id = p.post_id
             AND ${sqlBooleanEnumIsTrue('pc', 'is_liked')}
         ), 0)`
      : '0';
    const photoCommentCountExpr = hasPostingComments
      ? `COALESCE((
           SELECT COUNT(*)::int
           FROM ${postingsSchema}.posting_comments pc
           WHERE pc.photo_id = pp.photo_id
             AND NOT ${sqlBooleanEnumIsTrue('pc', 'is_liked')}
         ), 0)`
      : '0';
    const photoLikeCountExpr = hasPostingComments
      ? `COALESCE((
           SELECT COUNT(*)::int
           FROM ${postingsSchema}.posting_comments pc
           WHERE pc.photo_id = pp.photo_id
             AND ${sqlBooleanEnumIsTrue('pc', 'is_liked')}
         ), 0)`
      : '0';
    const viewerHasLikedExpr =
      hasPostingComments && ownerColumn
        ? `EXISTS (
           SELECT 1
           FROM ${postingsSchema}.posting_comments pc
           JOIN ${postingsSchema}.posting_photos pp ON pp.photo_id = pc.photo_id
           WHERE pp.post_id = p.post_id
             AND pc.author_id = $2
             AND ${sqlBooleanEnumIsTrue('pc', 'is_liked')}
         )`
        : 'false';
    const postOwnerExpr = ownerColumn ? `p.${ownerColumn}` : 'NULL';
    const repostFromSinglesExpr = postingRepostColumns.repostedFromSinglesId
      ? `p.${postingRepostColumns.repostedFromSinglesId}`
      : 'NULL::bigint';
    const repostFromAliasExpr = postingRepostColumns.repostedFromSinglesId
      ? 'repost_src.alias'
      : 'NULL::varchar';
    const repostFromMemberIdExpr = postingRepostColumns.repostedFromSinglesId
      ? 'repost_src.member_id'
      : 'NULL::bigint';
    const repostFromPrefixExpr = postingRepostColumns.repostedFromSinglesId
      ? 'repost_src.prefix'
      : 'NULL::varchar';
    const repostJoinSql = postingRepostColumns.repostedFromSinglesId
      ? `LEFT JOIN helloworldjunktest.singles repost_src
         ON repost_src.singles_id = p.${postingRepostColumns.repostedFromSinglesId}`
      : '';

    const posts = await pool.query(
      `SELECT
         p.post_id,
         p.content,
         p.created_at,
         ${postOwnerExpr} AS post_owner_id,
         ${repostFromSinglesExpr} AS reposted_from_singles_id,
         ${repostFromAliasExpr} AS reposted_from_alias,
         ${repostFromMemberIdExpr} AS reposted_from_member_id,
         ${repostFromPrefixExpr} AS reposted_from_prefix,
         ${postingCommentCountExpr} AS posting_comment_count,
         ${postingLikeCountExpr} AS posting_like_count,
         ${viewerHasLikedExpr} AS viewer_has_liked,
         ${visibilityExpr} AS posting_visibility,
         COALESCE((
           SELECT json_agg(
             json_build_object(
               'photo_id', pp.photo_id,
               'photo_url', pp.photo_url,
               'sort_order', pp.sort_order,
               'comment_count', ${photoCommentCountExpr},
               'like_count', ${photoLikeCountExpr}
             )
             ORDER BY pp.sort_order ASC, pp.photo_id ASC
           )
           FROM ${postingsSchema}.posting_photos pp
           WHERE pp.post_id = p.post_id
             AND (
               ${isSelfFeed ? 'TRUE' : `pp.photo_url !~ '/api/photo/[0-9]+'
               OR EXISTS (
                 SELECT 1
                 FROM helloworldjunktest.photos ap
                 WHERE ap.singles_id = p.singles_id
                   AND ap.photos_id = (regexp_match(pp.photo_url, '/api/photo/([0-9]+)'))[1]::bigint
               )`}
             )
         ), '[]'::json) AS photos
       FROM ${postingsSchema}.postings p
       ${repostJoinSql}
       WHERE p.singles_id = $1
         ${privateVisibilityFilter}
         AND (
           $3::timestamptz IS NULL
           OR $4::bigint IS NULL
           OR (p.created_at, p.post_id) < ($3::timestamptz, $4::bigint)
         )
       ORDER BY p.created_at DESC, p.post_id DESC
       LIMIT COALESCE($5::int, 1000000)`,
      [targetSinglesId, me, beforeCreatedAtIso, beforePostId, queryLimit ? queryLimit + 1 : null]
    );

    const hasMore = queryLimit != null ? posts.rows.length > queryLimit : false;
    const visibleRows = queryLimit != null ? posts.rows.slice(0, queryLimit) : posts.rows;
    const lastRow = visibleRows.length ? visibleRows[visibleRows.length - 1] : null;
    const nextCursor = hasMore && lastRow
      ? {
          created_at: lastRow.created_at,
          post_id: Number(lastRow.post_id)
        }
      : null;

    if (myStoryPhotoDebugEnabled()) {
      logMyStoryPhotos('[getMyPicksFeed] row count', visibleRows.length, 'visibilityColumn', postingVisibilityColumn);
      for (const row of visibleRows) {
        const ph = row.photos;
        const urls = Array.isArray(ph) ? ph.map((p) => p?.photo_url) : ph;
        logMyStoryPhotos('[getMyPicksFeed] post row', {
          post_id: row.post_id,
          posting_visibility: row.posting_visibility,
          photo_count: Array.isArray(ph) ? ph.length : null,
          photo_urls_from_db: urls
        });
      }
    } else if (visibleRows.length > 0) {
      const hint = visibleRows.some((row) => {
        const ph = row.photos;
        if (!Array.isArray(ph)) return false;
        return ph.some((p) => /localhost|127\.0\.0\.1/i.test(String(p?.photo_url ?? '')));
      });
      if (hint) {
        logMyStoryPhotosAlways(
          '[getMyPicksFeed] WARNING: at least one posting_photos.photo_url looks like localhost; browsers on production cannot load it. Normalize URLs or re-save posts. Set VSINGLES_DEBUG_MYSTORY_PHOTOS=1 for full dump.'
        );
      }
    }

    const restrictedMessage =
      !isSelfFeed
        ? canViewPrivatePosts
          ? ''
          : canViewFriendsPosts
            ? 'Buddies Posts and Public Posts are visible. Myself-only posts remain hidden.'
            : 'Only public posts are visible until Full Bio is approved (Buddies).'
        : '';

    const feedClient = await pool.connect();
    let mediaUrlCorrections = new Map();
    try {
      const allPostingUrls = visibleRows.flatMap((row) =>
        (Array.isArray(row.photos) ? row.photos : []).map((photo) => photo?.photo_url)
      );
      mediaUrlCorrections = await buildPostingMediaUrlCorrections(feedClient, targetSinglesId, allPostingUrls);
    } finally {
      feedClient.release();
    }

    return res.json({
      target_singles_id: targetSinglesId,
      can_view_full_bio: canViewPrivatePosts,
      can_view_private_posts: canViewPrivatePosts,
      message: restrictedMessage,
      has_more: hasMore,
      next_cursor: nextCursor,
      posts: visibleRows.map((row) => ({
        content: isSelfFeed ? (row.content ?? '') : sanitizeTextForPublicView(row.content),
        comments: [],
        post_id: Number(row.post_id),
        created_at: row.created_at,
        post_owner_id: row.post_owner_id == null ? null : Number(row.post_owner_id),
        reposted_from_singles_id:
          row.reposted_from_singles_id == null ? null : Number(row.reposted_from_singles_id),
        reposted_from_alias: row.reposted_from_alias ?? null,
        reposted_from_member_id:
          row.reposted_from_member_id == null ? null : Number(row.reposted_from_member_id),
        reposted_from_prefix: row.reposted_from_prefix ?? null,
        posting_comment_count: Number(row.posting_comment_count ?? 0),
        posting_like_count: Number(row.posting_like_count ?? 0),
        viewer_has_liked: row.viewer_has_liked === true || row.viewer_has_liked === 't',
        posting_visibility: normalizePostingVisibility(row.posting_visibility),
        photos: (Array.isArray(row.photos) ? row.photos : []).map((photo) => ({
          ...photo,
          photo_url: applyPostingMediaUrlCorrection(photo?.photo_url, mediaUrlCorrections)
        }))
      }))
    });
  } catch (error) {
    console.error('getMyPicksFeed error:', error);
    return res.status(500).json({ error: 'Failed to load My Picks feed' });
  }
}

/** Last 10 visible posts from members on the viewer's Picks & Posts list (newest first). */
export async function getMyPicksPostNotifications(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (isToolsOnlyAdminAuth(req.auth)) {
    return res.json({ notifications: [] });
  }

  try {
    await ensureNotificationDismissSchemaReady();
    const requestSchema = await resolveRequestsAppSchema();
    const postingsSchema = await resolvePostingsSchema();
    const postingVisibilityColumn = await resolvePostingVisibilityColumn(postingsSchema);
    const visibilityExpr = postingVisibilityExpr(postingVisibilityColumn, 'p');
    const interestedExpr = sqlInterestedIsTrue('r_pick');

    const friendsVisibleExpr = `EXISTS (
      SELECT 1
      FROM ${requestSchema}.requests r_fr
      WHERE (
        (r_fr.singles_id_from = $1 AND r_fr.singles_id_to = p.singles_id)
        OR (r_fr.singles_id_from = p.singles_id AND r_fr.singles_id_to = $1)
      )
      AND LOWER(COALESCE(r_fr.full_bio_request_approval::text, '')) IN ('approve','approved','true','1','t','yes','y')
    )`;

    const rows = await pool.query(
      `SELECT
         p.post_id,
         p.content,
         p.created_at,
         s.singles_id AS author_singles_id,
         s.prefix,
         s.member_id,
         s.alias
       FROM ${postingsSchema}.postings p
       JOIN ${requestSchema}.singles s ON s.singles_id = p.singles_id
       WHERE EXISTS (
         SELECT 1
         FROM ${requestSchema}.requests r_pick
         WHERE r_pick.singles_id_from = $1
           AND r_pick.singles_id_to = p.singles_id
           AND ${interestedExpr}
       )
         AND p.singles_id <> $1
         AND p.created_at > COALESCE(
           (SELECT rs.last_read_at FROM helloworldjunktest.user_post_notification_read_state rs WHERE rs.singles_id = $1),
           TIMESTAMPTZ '1970-01-01'
         )
         AND NOT EXISTS (
           SELECT 1
           FROM helloworldjunktest.user_post_notification_dismissed d
           WHERE d.singles_id = $1
             AND d.post_id = p.post_id
         )
         AND (${visibilityExpr}) <> 'mySelf'
         AND (
           (${visibilityExpr}) = 'public'
           OR ((${visibilityExpr}) = 'friends' AND ${friendsVisibleExpr})
         )
       ORDER BY p.created_at DESC, p.post_id DESC
       LIMIT 10`,
      [me]
    );

    return res.json({
      notifications: rows.rows.map((row) => ({
        post_id: Number(row.post_id),
        content: row.content ?? '',
        created_at: row.created_at,
        author_singles_id: Number(row.author_singles_id),
        prefix: row.prefix ?? null,
        member_id: row.member_id ?? null,
        alias: row.alias ?? null
      }))
    });
  } catch (error) {
    console.error('getMyPicksPostNotifications error:', error);
    return res.status(500).json({ error: 'Failed to load post notifications' });
  }
}

export async function dismissMyPicksPostNotification(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const postId = Number(req.body?.postId);
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ error: 'Invalid post id' });
  }
  try {
    await ensureNotificationDismissSchemaReady();
    await pool.query(
      `INSERT INTO helloworldjunktest.user_post_notification_dismissed (singles_id, post_id, dismissed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (singles_id, post_id)
       DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
      [me, postId]
    );
    return res.json({ ok: true });
  } catch (error) {
    console.error('dismissMyPicksPostNotification error:', error);
    return res.status(500).json({ error: 'Failed to dismiss notification' });
  }
}

export async function dismissAllMyPicksPostNotifications(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const postIdsRaw = Array.isArray(req.body?.postIds) ? req.body.postIds : [];
  const postIds = [...new Set(postIdsRaw.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0))];
  try {
    await ensureNotificationDismissSchemaReady();
    await pool.query(
      `INSERT INTO helloworldjunktest.user_post_notification_read_state (singles_id, last_read_at)
       VALUES ($1, NOW())
       ON CONFLICT (singles_id)
       DO UPDATE SET last_read_at = EXCLUDED.last_read_at`,
      [me]
    );
    if (postIds.length) {
      await pool.query(
        `INSERT INTO helloworldjunktest.user_post_notification_dismissed (singles_id, post_id, dismissed_at)
         SELECT $1::bigint, x::bigint, NOW()
         FROM unnest($2::bigint[]) x
         ON CONFLICT (singles_id, post_id)
         DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
        [me, postIds]
      );
    }
    return res.json({ ok: true, dismissed: postIds.length, marked_all_read: true });
  } catch (error) {
    console.error('dismissAllMyPicksPostNotifications error:', error);
    return res.status(500).json({ error: 'Failed to dismiss notifications' });
  }
}

export async function createMyPosting(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    const [postingVisibilityColumn, postingRepostColumns] = await Promise.all([
      resolvePostingVisibilityColumn(postingsSchema),
      resolvePostingRepostColumns(postingsSchema)
    ]);
    const content = String(req.body?.content ?? '').trim();
    const postingVisibility = normalizePostingVisibility(req.body?.posting_visibility ?? req.body?.visibility);
    const repostedFromSinglesIdRaw = Number(req.body?.reposted_from_singles_id);
    const repostedFromPostIdRaw = Number(req.body?.reposted_from_post_id);
    const repostedFromSinglesId =
      Number.isFinite(repostedFromSinglesIdRaw) && repostedFromSinglesIdRaw > 0
        ? Math.trunc(repostedFromSinglesIdRaw)
        : null;
    const repostedFromPostId =
      Number.isFinite(repostedFromPostIdRaw) && repostedFromPostIdRaw > 0
        ? Math.trunc(repostedFromPostIdRaw)
        : null;
    const photoUrlsRaw = Array.isArray(req.body?.photo_urls) ? req.body.photo_urls : [];
    const photoUrls = photoUrlsRaw
      .map((url) => normalizePostingPhotoUrlForStorage(url))
      .filter(Boolean)
      .slice(0, 20);

    if (myStoryPhotoDebugEnabled()) {
      logMyStoryPhotos('[createMyPosting] raw photo_urls count', photoUrlsRaw.length, 'normalized', photoUrls);
    }

    if (!content && photoUrls.length === 0) {
      return res.status(400).json({ error: 'Please add a message or at least one photo or video' });
    }

    if (repostedFromSinglesId != null || repostedFromPostId != null) {
      if (!postingRepostColumns.repostedFromSinglesId) {
        return res.status(503).json({
          error: 'Repost is unavailable until addPostingsRepostedFromSinglesId.sql is applied on Primary.'
        });
      }
      if (repostedFromSinglesId == null || repostedFromPostId == null) {
        return res.status(400).json({ error: 'Repost requires reposted_from_singles_id and reposted_from_post_id' });
      }
      if (repostedFromSinglesId === me) {
        return res.status(400).json({ error: 'Cannot repost from yourself' });
      }
      const sourceCheck = await pool.query(
        `SELECT 1
         FROM ${postingsSchema}.postings
         WHERE post_id = $1
           AND singles_id = $2
         LIMIT 1`,
        [repostedFromPostId, repostedFromSinglesId]
      );
      if (!sourceCheck.rows.length) {
        return res.status(404).json({ error: 'Source posting not found' });
      }
      const authorCheck = await pool.query(
        `SELECT 1
         FROM helloworldjunktest.singles s
         WHERE s.singles_id = $1
           AND ${buildSinglesActiveStatusWhereSql('s')}
         LIMIT 1`,
        [repostedFromSinglesId]
      );
      if (!authorCheck.rows.length) {
        return res.status(404).json({ error: 'Original author not found' });
      }
    }

    await ensurePostingQuarterlyPartitionsBeforeWrite();

    const correctedPhotoUrls = [];
    for (const url of photoUrls) {
      correctedPhotoUrls.push(await correctPostingMediaUrlForOwner(pool, me, url));
    }

    // Must use one pooled client for BEGIN/INSERT/COMMIT — pool.query('BEGIN') does not bind a session.
    const client = await pool.connect();
    let postId = null;
    try {
      await client.query('BEGIN');
      const insertColumns = ['singles_id', 'content'];
      const insertValues = [me, content || null];
      const placeholders = ['$1', '$2'];
      if (postingVisibilityColumn) {
        insertColumns.push(postingVisibilityColumn);
        if (postingVisibilityColumn === 'is_private') {
          insertValues.push(postingVisibility !== 'public');
        } else if (postingVisibilityColumn === 'is_public') {
          insertValues.push(postingVisibility === 'public');
        } else {
          insertValues.push(postingVisibilityForDb(postingVisibility));
        }
        placeholders.push(`$${insertValues.length}`);
      }
      if (repostedFromSinglesId != null && postingRepostColumns.repostedFromSinglesId) {
        insertColumns.push(postingRepostColumns.repostedFromSinglesId);
        insertValues.push(repostedFromSinglesId);
        placeholders.push(`$${insertValues.length}`);
      }
      if (repostedFromPostId != null && postingRepostColumns.repostedFromPostId) {
        insertColumns.push(postingRepostColumns.repostedFromPostId);
        insertValues.push(repostedFromPostId);
        placeholders.push(`$${insertValues.length}`);
      }
      const postResult = await client.query(
        `INSERT INTO ${postingsSchema}.postings (${insertColumns.join(', ')})
         VALUES (${placeholders.join(', ')})
         RETURNING post_id`,
        insertValues
      );
      postId = Number(postResult.rows[0]?.post_id);

      if (!Number.isFinite(postId) || postId < 1) {
        throw new Error('Failed to create posting');
      }

      for (let i = 0; i < correctedPhotoUrls.length; i += 1) {
        await client.query(
          `INSERT INTO ${postingsSchema}.posting_photos (post_id, post_created_at, photo_url, sort_order)
           SELECT $1, p.created_at, $2, $3
           FROM ${postingsSchema}.postings p
           WHERE p.post_id = $1`,
          [postId, correctedPhotoUrls[i], i]
        );
      }

      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      console.error('createMyPosting error:', error);
      return res.status(500).json({ error: 'Failed to create posting' });
    } finally {
      client.release();
    }
    return res.status(201).json({ ok: true, post_id: postId });
  } catch (error) {
    console.error('createMyPosting error:', error);
    return res.status(500).json({ error: 'Failed to create posting' });
  }
}

export async function deleteMyPosting(req, res) {
  const me = Number(req.auth?.singles_id);
  const postId = Number(req.params.postId);
  console.info('[be][deleteMyPosting] request:start', { me, postId, rawPostId: req.params.postId });
  if (!Number.isFinite(me) || me < 1) {
    console.warn('[be][deleteMyPosting] auth invalid', { me });
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(postId) || postId < 1) {
    console.warn('[be][deleteMyPosting] invalid post id', { postId, rawPostId: req.params.postId });
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    console.info('[be][deleteMyPosting] schema:resolved', { postingsSchema, me, postId });
    const owner = await pool.query(
      `SELECT p.post_id
       FROM ${postingsSchema}.postings p
       WHERE p.post_id = $1
         AND p.singles_id = $2
       LIMIT 1`,
      [postId, me]
    );
    console.info('[be][deleteMyPosting] owner:lookup', { me, postId, ownerRowCount: owner.rows.length });
    if (!owner.rows.length) {
      console.warn('[be][deleteMyPosting] owner:not-found', { me, postId });
      return res.status(404).json({ error: 'Posting not found' });
    }

    const client = await pool.connect();
    let photosDeleted = 0;
    let postsDeleted = 0;
    try {
      await client.query('BEGIN');
      const photosDelete = await client.query(`DELETE FROM ${postingsSchema}.posting_photos WHERE post_id = $1`, [postId]);
      const postDelete = await client.query(`DELETE FROM ${postingsSchema}.postings WHERE post_id = $1`, [postId]);
      await client.query('COMMIT');
      photosDeleted = photosDelete.rowCount;
      postsDeleted = postDelete.rowCount;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback errors
      }
      throw error;
    } finally {
      client.release();
    }
    console.info('[be][deleteMyPosting] delete:success', {
      me,
      postId,
      photosDeleted,
      postsDeleted
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[be][deleteMyPosting] delete:error', {
      me,
      postId,
      message: error?.message,
      stack: error?.stack
    });
    return res.status(500).json({ error: 'Failed to delete posting' });
  }
}

export async function deleteMyPostingPhoto(req, res) {
  const me = Number(req.auth?.singles_id);
  const photoId = Number(req.params.photoId);
  console.info('[be][deleteMyPostingPhoto] request:start', { me, photoId, rawPhotoId: req.params.photoId });
  if (!Number.isFinite(me) || me < 1) {
    console.warn('[be][deleteMyPostingPhoto] auth invalid', { me });
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(photoId) || photoId < 1) {
    console.warn('[be][deleteMyPostingPhoto] invalid photo id', { photoId, rawPhotoId: req.params.photoId });
    return res.status(400).json({ error: 'Invalid posting photo id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    console.info('[be][deleteMyPostingPhoto] schema:resolved', { postingsSchema, me, photoId });
    const result = await pool.query(
      `DELETE FROM ${postingsSchema}.posting_photos pp
       USING ${postingsSchema}.postings p
       WHERE pp.photo_id = $1
         AND pp.post_id = p.post_id
         AND p.singles_id = $2
       RETURNING pp.photo_id`,
      [photoId, me]
    );
    console.info('[be][deleteMyPostingPhoto] delete:attempted', { me, photoId, deletedCount: result.rows.length });
    if (!result.rows.length) {
      console.warn('[be][deleteMyPostingPhoto] delete:not-found', { me, photoId });
      return res.status(404).json({ error: 'Posting photo not found' });
    }
    console.info('[be][deleteMyPostingPhoto] delete:success', { me, photoId });
    return res.json({ ok: true });
  } catch (error) {
    console.error('[be][deleteMyPostingPhoto] delete:error', {
      me,
      photoId,
      message: error?.message,
      stack: error?.stack
    });
    return res.status(500).json({ error: 'Failed to delete posting photo' });
  }
}

/**
 * POST /api/myPicks/posting/:postId/photos
 * Body: { photo_urls: string[] }
 * Attach more photos/videos to an existing posting owned by the caller.
 */
export async function addMyPostingPhotos(req, res) {
  const me = Number(req.auth?.singles_id);
  const postId = Number(req.params.postId);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    const photoUrlsRaw = Array.isArray(req.body?.photo_urls) ? req.body.photo_urls : [];
    const photoUrls = photoUrlsRaw
      .map((url) => normalizePostingPhotoUrlForStorage(url))
      .filter(Boolean)
      .slice(0, 20);

    if (photoUrls.length === 0) {
      return res.status(400).json({ error: 'Please add at least one photo or video' });
    }

    const owner = await pool.query(
      `SELECT p.post_id, p.created_at
       FROM ${postingsSchema}.postings p
       WHERE p.post_id = $1
         AND p.singles_id = $2
       LIMIT 1`,
      [postId, me]
    );
    if (!owner.rows.length) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    const existingCountResult = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM ${postingsSchema}.posting_photos
       WHERE post_id = $1`,
      [postId]
    );
    const existingCount = Number(existingCountResult.rows[0]?.n ?? 0);
    const remainingSlots = Math.max(0, 20 - (Number.isFinite(existingCount) ? existingCount : 0));
    if (remainingSlots < 1) {
      return res.status(400).json({ error: 'This posting already has the maximum number of photos.' });
    }

    const correctedPhotoUrls = [];
    for (const url of photoUrls.slice(0, remainingSlots)) {
      correctedPhotoUrls.push(await correctPostingMediaUrlForOwner(pool, me, url));
    }

    const sortBaseResult = await pool.query(
      `SELECT COALESCE(MAX(sort_order), -1)::int AS max_sort
       FROM ${postingsSchema}.posting_photos
       WHERE post_id = $1`,
      [postId]
    );
    let nextSort = Number(sortBaseResult.rows[0]?.max_sort ?? -1) + 1;
    if (!Number.isFinite(nextSort) || nextSort < 0) nextSort = 0;

    const inserted = [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const url of correctedPhotoUrls) {
        const result = await client.query(
          `INSERT INTO ${postingsSchema}.posting_photos (post_id, post_created_at, photo_url, sort_order)
           VALUES ($1, $2, $3, $4)
           RETURNING photo_id, photo_url, sort_order`,
          [postId, owner.rows[0].created_at, url, nextSort]
        );
        nextSort += 1;
        if (result.rows[0]) {
          inserted.push({
            photo_id: Number(result.rows[0].photo_id),
            photo_url: result.rows[0].photo_url,
            sort_order: Number(result.rows[0].sort_order)
          });
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      throw error;
    } finally {
      client.release();
    }

    return res.status(201).json({ ok: true, post_id: postId, photos: inserted });
  } catch (error) {
    console.error('addMyPostingPhotos error:', error);
    return res.status(500).json({ error: 'Failed to attach photos to posting' });
  }
}

export async function updateMyPostingVisibility(req, res) {
  const me = Number(req.auth?.singles_id);
  const postId = Number(req.params.postId);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    const postingVisibilityColumn = await resolvePostingVisibilityColumn(postingsSchema);
    if (!postingVisibilityColumn) {
      return res.status(400).json({ error: 'Posting visibility is not available on this server yet' });
    }
    const postingVisibility = normalizePostingVisibility(req.body?.posting_visibility ?? req.body?.visibility);
    const owner = await pool.query(
      `SELECT p.post_id
       FROM ${postingsSchema}.postings p
       WHERE p.post_id = $1
         AND p.singles_id = $2
       LIMIT 1`,
      [postId, me]
    );
    if (!owner.rows.length) {
      return res.status(404).json({ error: 'Posting not found' });
    }

    if (postingVisibilityColumn === 'is_private') {
      await pool.query(
        `UPDATE ${postingsSchema}.postings
         SET is_private = ${sqlBooleanEnumParam('$1', postingsSchema)}
         WHERE post_id = $2
           AND singles_id = $3`,
        [toBooleanEnumLabel(postingVisibility !== 'public'), postId, me]
      );
    } else if (postingVisibilityColumn === 'is_public') {
      await pool.query(
        `UPDATE ${postingsSchema}.postings
         SET is_public = $1
         WHERE post_id = $2
           AND singles_id = $3`,
        [postingVisibility === 'public', postId, me]
      );
    } else {
      await pool.query(
        `UPDATE ${postingsSchema}.postings
         SET ${postingVisibilityColumn} = $1
         WHERE post_id = $2
           AND singles_id = $3`,
        [postingVisibilityForDb(postingVisibility), postId, me]
      );
    }
    return res.json({ ok: true, posting_visibility: postingVisibility });
  } catch (error) {
    console.error('updateMyPostingVisibility error:', error);
    return res.status(500).json({ error: 'Failed to update posting visibility' });
  }
}

export async function updateMyPostingContent(req, res) {
  const me = Number(req.auth?.singles_id);
  const postId = Number(req.params.postId);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!Number.isFinite(postId) || postId < 1) {
    return res.status(400).json({ error: 'Invalid post id' });
  }

  try {
    const postingsSchema = await resolvePostingsSchema();
    const content = String(req.body?.content ?? '').trim();
    const owner = await pool.query(
      `SELECT p.post_id,
              (SELECT COUNT(*)::int
               FROM ${postingsSchema}.posting_photos pp
               WHERE pp.post_id = p.post_id) AS photo_count
       FROM ${postingsSchema}.postings p
       WHERE p.post_id = $1
         AND p.singles_id = $2
       LIMIT 1`,
      [postId, me]
    );
    if (!owner.rows.length) {
      return res.status(404).json({ error: 'Posting not found' });
    }
    const photoCount = Number(owner.rows[0]?.photo_count) || 0;
    if (!content && photoCount === 0) {
      return res.status(400).json({ error: 'Please add a message or keep at least one photo or video' });
    }

    await pool.query(
      `UPDATE ${postingsSchema}.postings
       SET content = $1
       WHERE post_id = $2
         AND singles_id = $3`,
      [content || null, postId, me]
    );
    return res.json({ ok: true, content: content || '' });
  } catch (error) {
    console.error('updateMyPostingContent error:', error);
    return res.status(500).json({ error: 'Failed to update posting content' });
  }
}
