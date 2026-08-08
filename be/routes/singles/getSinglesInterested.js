import pool from '../../db/connection.js';
import { buildSinglesVisibilityWhereSql } from './memberVisibility.js';
import { sqlInterestedIsTrue } from './interestedSql.js';
import { sqlGalleryVideoIdsSubquery } from '../../utils/galleryMediaSql.js';

async function resolveAppSchema() {
  const result = await pool.query(
    `SELECT table_schema
     FROM information_schema.tables
     WHERE table_name = 'requests'
       AND table_schema IN ('helloworldjunktest', 'public')
     ORDER BY CASE WHEN table_schema = 'helloworldjunktest' THEN 0 ELSE 1 END
     LIMIT 1`
  );
  return result.rows[0]?.table_schema || 'public';
}

async function buildSinglesVettedExpr(schemaName) {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'singles'
       AND column_name IN ('vetted_basic_status')`,
    [schemaName]
  );
  const has = new Set(cols.rows.map((r) => r.column_name));
  if (has.has('vetted_basic_status')) {
    return 's.vetted_basic_status AS vetted_basic_status';
  }
  if (has.has('vetted_basic_status')) {
    return "LOWER(COALESCE(s.vetted_basic_status::text, '')) = 'vetted' AS vetted_basic_status";
  }
  return 'false AS vetted_basic_status';
}

async function getSinglesColumns(schemaName) {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'singles'`,
    [schemaName]
  );
  return new Set(cols.rows.map((r) => r.column_name));
}

function firstExistingColumnExpr(columnsSet, aliases, tableAlias = 's') {
  for (const col of aliases) {
    if (columnsSet.has(col)) return `${tableAlias}.${col}`;
  }
  return 'NULL';
}

async function relationExists(schemaName, relationName) {
  const r = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = $1
       AND table_name = $2
     LIMIT 1`,
    [schemaName, relationName]
  );
  return r.rows.length > 0;
}

async function getColumnsForRelation(schemaName, relationName) {
  const r = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = $2`,
    [schemaName, relationName]
  );
  return new Set(r.rows.map((row) => row.column_name));
}

function firstColumnInSet(columnSet, candidates) {
  for (const c of candidates) {
    if (columnSet.has(c)) return c;
  }
  return null;
}

/** Views may use singles_id, singlesid, member_id, etc. */
const VIEW_JOIN_KEY_CANDIDATES = ['singles_id', 'fk_singles_id', 'singlesid', 'single_id', 'member_id'];

function resolveViewJoinKeyColumn(viewCols) {
  const direct = firstColumnInSet(viewCols, VIEW_JOIN_KEY_CANDIDATES);
  if (direct) return direct;
  const lowerToActual = new Map([...viewCols].map((c) => [c.toLowerCase(), c]));
  for (const want of VIEW_JOIN_KEY_CANDIDATES) {
    const hit = lowerToActual.get(want.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

/**
 * Prefer `singles` columns when present; otherwise read from a per-member view
 * (e.g. viewname / viewphoto) so counts match DBeaver when vetting lives in views.
 */
async function coalesceSinglesOrViewExpr(schemaCandidates, singlesCols, singlesAliases, viewName, viewColumnCandidates) {
  const singlesExpr = firstExistingColumnExpr(singlesCols, singlesAliases, 's');
  let viewSchema = null;
  for (const sch of schemaCandidates) {
    if (await relationExists(sch, viewName)) {
      viewSchema = sch;
      break;
    }
  }
  if (!viewSchema) {
    return singlesExpr;
  }
  const viewCols = await getColumnsForRelation(viewSchema, viewName);
  const joinKey = resolveViewJoinKeyColumn(viewCols);
  const viewCol = firstColumnInSet(viewCols, viewColumnCandidates);
  if (!joinKey || !viewCol) {
    return singlesExpr;
  }
  const subq = `(SELECT v.${viewCol} FROM ${viewSchema}.${viewName} v WHERE v.${joinKey} = s.singles_id LIMIT 1)`;
  if (singlesExpr === 'NULL') {
    return subq;
  }
  return `COALESCE(${singlesExpr}, ${subq})`;
}

async function buildRequestInfoColumnsSelect(schemaName) {
  const cols = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1
       AND table_name = 'requests'
      AND column_name IN ('brief_bio_request', 'full_bio_request')`,
    [schemaName]
  );
  const has = new Set(cols.rows.map((r) => r.column_name));
  const basicExpr = has.has('brief_bio_request') ? `LOWER(BTRIM(COALESCE(r.brief_bio_request::text, 'notrequested')))` : `'notrequested'`;
  const fullBioExpr = has.has('full_bio_request') ? `LOWER(BTRIM(COALESCE(r.full_bio_request::text, 'notrequested')))` : `'notrequested'`;
  return {
    basic: `${basicExpr} AS brief_bio_request`,
    details: `${fullBioExpr} AS full_bio_request`
  };
}

export async function getSinglesInterested(req, res) {
  const me = Number(req.auth?.singles_id);
  if (!Number.isFinite(me) || me < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const schemaName = await resolveAppSchema();
    const visibility = buildSinglesVisibilityWhereSql('s', 2);
    const vettedExpr = await buildSinglesVettedExpr(schemaName);
    const requestCols = await buildRequestInfoColumnsSelect(schemaName);
    const singlesCols = await getSinglesColumns(schemaName);
    const schemaCandidates = [...new Set([schemaName, 'public'].filter(Boolean))];

    const nameVettedExpr = await coalesceSinglesOrViewExpr(schemaCandidates, singlesCols, ['name_vetted'], 'viewname', ['name_vetted']);
    const photoVettedExpr = await coalesceSinglesOrViewExpr(
      schemaCandidates,
      singlesCols,
      ['profilephoto_vetted'],
      'viewphoto',
      ['profilephoto_vetted']
    );
    const ageVettedExpr = await coalesceSinglesOrViewExpr(schemaCandidates, singlesCols, ['age_vetted'], 'viewage', ['age_vetted']);
    const cityVettedExpr = await coalesceSinglesOrViewExpr(
      schemaCandidates,
      singlesCols,
      ['current_city_vetted', 'city_vetted'],
      'viewcurrentcity',
      ['current_city_vetted', 'city_vetted']
    );
    const educationVettedExpr = await coalesceSinglesOrViewExpr(
      schemaCandidates,
      singlesCols,
      ['education_vetted', 'job_vetted'],
      'vieweducation',
      ['education_vetted', 'job_vetted']
    );
    const careerVettedExpr = await coalesceSinglesOrViewExpr(
      schemaCandidates,
      singlesCols,
      ['career_vetted', 'job_vetted'],
      'viewcareer',
      ['career_vetted', 'job_vetted']
    );
    const childrenVettedExpr = await coalesceSinglesOrViewExpr(
      schemaCandidates,
      singlesCols,
      ['children_vetted'],
      'viewchildren',
      ['children_vetted']
    );
    const homeCityVettedExpr = await coalesceSinglesOrViewExpr(
      schemaCandidates,
      singlesCols,
      ['home_city_vetted'],
      'viewhomecity',
      ['home_city_vetted', 'current_city_vetted', 'city_vetted']
    );
    const religionVettedExpr = await coalesceSinglesOrViewExpr(
      schemaCandidates,
      singlesCols,
      ['religion_vetted'],
      'viewreligion',
      ['religion_vetted']
    );
    const hobbiesVettedExpr = await coalesceSinglesOrViewExpr(
      schemaCandidates,
      singlesCols,
      ['hobbies_vetted'],
      'viewhobbies',
      ['hobbies_vetted']
    );

    const result = await pool.query(
      `
      SELECT r.singles_id_to, s.singles_id, s.prefix, s.member_id, s.profile_image_fk, s.alias, ${vettedExpr},
        ${requestCols.basic},
        ${requestCols.details},
        ${nameVettedExpr} AS name_vetted,
        ${photoVettedExpr} AS photo_vetted,
        ${ageVettedExpr} AS age_vetted,
        ${cityVettedExpr} AS city_vetted,
        ${educationVettedExpr} AS education_vetted,
        ${careerVettedExpr} AS career_vetted,
        ${childrenVettedExpr} AS children_vetted,
        ${homeCityVettedExpr} AS home_city_vetted,
        ${religionVettedExpr} AS religion_vetted,
        ${hobbiesVettedExpr} AS hobbies_vetted,
        COALESCE(
          (SELECT array_agg(p.photos_id ORDER BY p.display_order NULLS LAST, p.photos_id)
           FROM ${schemaName}.photos p
           WHERE p.singles_id = s.singles_id),
          ARRAY[]::bigint[]
        ) AS gallery_photo_ids,
        ${sqlGalleryVideoIdsSubquery(schemaName, 's.singles_id')} AS gallery_video_ids
      FROM ${schemaName}.requests r
      JOIN ${schemaName}.singles s ON r.singles_id_to = s.singles_id
      WHERE r.singles_id_from = $1 AND ${sqlInterestedIsTrue('r')}
        AND ${visibility.whereSql}
      ORDER BY s.created_at DESC
    `,
      [me, ...visibility.params]
    );

    const processedRows = result.rows.map((row) => {
      const idValue = row.singles_id_to ?? row.singles_id;
      return {
        singles_id_to: idValue != null ? String(idValue) : null,
        prefix: row.prefix ?? null,
        member_id: row.member_id ?? null,
        profile_image_fk: row.profile_image_fk ?? null,
        alias: row.alias ?? null,
        gallery_photo_ids: Array.isArray(row.gallery_photo_ids) ? row.gallery_photo_ids : [],
        gallery_video_ids: Array.isArray(row.gallery_video_ids) ? row.gallery_video_ids : [],
        brief_bio_request: String(row.brief_bio_request ?? 'notrequested').trim().toLowerCase() === 'requested' ? 'requested' : 'notrequested',
        full_bio_request: String(row.full_bio_request ?? 'notrequested').trim().toLowerCase() === 'requested' ? 'requested' : 'notrequested',
        vetted_basic_status: row.vetted_basic_status === true || row.vetted_basic_status === 'true' || row.vetted_basic_status === 1,
        name_vetted: row.name_vetted ?? null,
        photo_vetted: row.photo_vetted ?? null,
        age_vetted: row.age_vetted ?? null,
        city_vetted: row.city_vetted ?? null,
        education_vetted: row.education_vetted ?? null,
        career_vetted: row.career_vetted ?? null,
        children_vetted: row.children_vetted ?? null,
        home_city_vetted: row.home_city_vetted ?? null,
        religion_vetted: row.religion_vetted ?? null,
        hobbies_vetted: row.hobbies_vetted ?? null
      };
    }).filter((row) => row.singles_id_to != null);

    res.json(processedRows);
  } catch (error) {
    console.error('Error fetching interested:', error);
    res.status(500).json({ error: 'Failed to fetch singles from database' });
  }
}
