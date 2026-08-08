import pool from '../../db/connection.js';

const ROW_TO_PREFIXES = {
  name: ['name'],
  photo: ['profilephoto'],
  age: ['age'],
  city: ['current_city'],
  education: ['education', 'job'],
  career: ['career', 'job'],
  children: ['children'],
  homeCity: ['home_city', 'current_city'],
  country: ['countryofbirth', 'country_of_birth'],
  religion: ['religion'],
  hobbies: ['hobbies']
};

function readByPrefix(row, prefix) {
  const hasAny =
    `${prefix}_vetted` in row ||
    `${prefix}_vetted_note` in row ||
    `${prefix}_vetted_date` in row ||
    `${prefix}_vetted_by_userid` in row;
  if (!hasAny) return null;
  return {
    verificationStatus: row[`${prefix}_vetted`] ?? null,
    vettedNote: row[`${prefix}_vetted_note`] ?? null,
    vettedDate: row[`${prefix}_vetted_date`] ?? null,
    vettedByUserid: row[`${prefix}_vetted_by_userid`] ?? null
  };
}

function readByPrefixes(row, prefixes) {
  for (const prefix of prefixes) {
    const found = readByPrefix(row, prefix);
    if (found) return found;
  }
  return {
    verificationStatus: null,
    vettedNote: null,
    vettedDate: null,
    vettedByUserid: null
  };
}

function buildVerifySelfPayload(row) {
  const rowDataById = {};
  for (const [rowId, prefixes] of Object.entries(ROW_TO_PREFIXES)) {
    rowDataById[rowId] = readByPrefixes(row, prefixes);
  }
  return {
    verificationStatus: rowDataById.photo?.verificationStatus ?? null,
    vettedDate: rowDataById.photo?.vettedDate ?? null,
    vettedByUserid: rowDataById.photo?.vettedByUserid ?? null,
    vettedNote: rowDataById.photo?.vettedNote ?? null,
    nameVerificationStatus: rowDataById.name?.verificationStatus ?? null,
    nameVettedDate: rowDataById.name?.vettedDate ?? null,
    nameVettedByUserid: rowDataById.name?.vettedByUserid ?? null,
    nameVettedNote: rowDataById.name?.vettedNote ?? null,
    ageVerificationStatus: rowDataById.age?.verificationStatus ?? null,
    ageVettedDate: rowDataById.age?.vettedDate ?? null,
    ageVettedByUserid: rowDataById.age?.vettedByUserid ?? null,
    ageVettedNote: rowDataById.age?.vettedNote ?? null,
    cityVerificationStatus: rowDataById.city?.verificationStatus ?? null,
    cityVettedDate: rowDataById.city?.vettedDate ?? null,
    cityVettedByUserid: rowDataById.city?.vettedByUserid ?? null,
    cityVettedNote: rowDataById.city?.vettedNote ?? null,
    careerVerificationStatus: rowDataById.career?.verificationStatus ?? null,
    careerVettedDate: rowDataById.career?.vettedDate ?? null,
    careerVettedByUserid: rowDataById.career?.vettedByUserid ?? null,
    careerVettedNote: rowDataById.career?.vettedNote ?? null,
    countryVerificationStatus: rowDataById.country?.verificationStatus ?? null,
    countryVettedDate: rowDataById.country?.vettedDate ?? null,
    countryVettedByUserid: rowDataById.country?.vettedByUserid ?? null,
    countryVettedNote: rowDataById.country?.vettedNote ?? null,
    educationVerificationStatus: rowDataById.education?.verificationStatus ?? null,
    educationVettedDate: rowDataById.education?.vettedDate ?? null,
    educationVettedByUserid: rowDataById.education?.vettedByUserid ?? null,
    educationVettedNote: rowDataById.education?.vettedNote ?? null,
    childrenVerificationStatus: rowDataById.children?.verificationStatus ?? null,
    childrenVettedDate: rowDataById.children?.vettedDate ?? null,
    childrenVettedByUserid: rowDataById.children?.vettedByUserid ?? null,
    childrenVettedNote: rowDataById.children?.vettedNote ?? null,
    homeCityVerificationStatus: rowDataById.homeCity?.verificationStatus ?? null,
    homeCityVettedDate: rowDataById.homeCity?.vettedDate ?? null,
    homeCityVettedByUserid: rowDataById.homeCity?.vettedByUserid ?? null,
    homeCityVettedNote: rowDataById.homeCity?.vettedNote ?? null,
    religionVerificationStatus: rowDataById.religion?.verificationStatus ?? null,
    religionVettedDate: rowDataById.religion?.vettedDate ?? null,
    religionVettedByUserid: rowDataById.religion?.vettedByUserid ?? null,
    religionVettedNote: rowDataById.religion?.vettedNote ?? null,
    hobbiesVerificationStatus: rowDataById.hobbies?.verificationStatus ?? null,
    hobbiesVettedDate: rowDataById.hobbies?.vettedDate ?? null,
    hobbiesVettedByUserid: rowDataById.hobbies?.vettedByUserid ?? null,
    hobbiesVettedNote: rowDataById.hobbies?.vettedNote ?? null,
    rowsById: rowDataById,
    vettedBasicStatus: row.vetted_basic_status ?? null,
    vettedDetailStatus: row.vetted_detail_status ?? null
  };
}

/**
 * GET /api/verifyself/photo — vetting data for the logged-in user.
 */
export async function getVerifySelfPhotoValue(req, res) {
  const authSinglesId = req.auth?.singles_id;
  if (!authSinglesId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const trimmedEmail = req.query?.email != null ? String(req.query.email).trim() : '';
  if (trimmedEmail) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  try {
    const result = await pool.query(
      `SELECT *
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [authSinglesId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const row = result.rows[0];
    return res.json(buildVerifySelfPayload(row));
  } catch (error) {
    console.error('[getVerifySelfPhotoValue]', error.message);
    return res.status(500).json({ error: 'Failed to read verify-self photo value' });
  }
}

function asNullableText(raw) {
  const s = String(raw ?? '').trim();
  if (!s || s.toLowerCase() === 'not available' || s.toLowerCase() === 'n/a') return null;
  return s;
}

function asNullableInt(raw) {
  const s = asNullableText(raw);
  if (s == null) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

const VETTED_DISPLAY_MONTH = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11
};

/** Parses ISO or UI format Mon DD, YYYY at HH12:MI AM (PostgreSQL to_char style). */
function asNullableTimestamp(raw) {
  const s = asNullableText(raw);
  if (s == null) return null;
  const t = Date.parse(s);
  if (!Number.isNaN(t)) return new Date(t);
  const m = s.match(/^([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    const mon = VETTED_DISPLAY_MONTH[m[1].slice(0, 3).toLowerCase()];
    if (mon == null) return null;
    const day = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    let hour = parseInt(m[4], 10);
    const minute = parseInt(m[5], 10);
    const ap = m[6].toUpperCase();
    if (ap === 'PM' && hour < 12) hour += 12;
    if (ap === 'AM' && hour === 12) hour = 0;
    const d = new Date(year, mon, day, hour, minute, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const relaxed = Date.parse(String(s).replace(/\s+at\s+/i, ' '));
  return Number.isNaN(relaxed) ? null : new Date(relaxed);
}

function normalizeStatusForDb(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower === 'not available' || lower === 'n/a') return 'n/a';
  return s;
}

/**
 * POST /api/verifyself/save — persist editable verify-self table rows for the logged-in user.
 */
export async function saveVerifySelfRows(req, res) {
  const authSinglesId = req.auth?.singles_id;
  if (!authSinglesId) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  console.log('[saveVerifySelfRows] request start', {
    authSinglesId,
    section: req.body?.section ?? null,
    rowsCount: rows.length,
    targetSinglesIdBody: req.body?.targetSinglesId ?? null
  });
  console.log('[saveVerifySelfRows] request rows payload', JSON.stringify(rows));
  if (!rows.length) {
    return res.status(400).json({ error: 'rows is required' });
  }

  try {
    const rawTarget = req.body?.targetSinglesId;
    if (rawTarget != null && rawTarget !== '') {
      const tid = parseInt(String(rawTarget), 10);
      if (!Number.isFinite(tid) || tid < 1 || tid !== authSinglesId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
    }
    const saveTargetId = authSinglesId;

    const savedIds = [];
    const skippedIds = [];
    const shapeResult = await pool.query(
      `SELECT *
       FROM helloworldjunktest.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [saveTargetId]
    );
    const columnSet = new Set(Object.keys(shapeResult.rows[0] || {}));
    console.log('[saveVerifySelfRows] discovered columns from row shape', {
      count: columnSet.size,
      has_profilephoto_vetted: columnSet.has('profilephoto_vetted'),
      has_profilephoto_vetted_note: columnSet.has('profilephoto_vetted_note')
    });

    for (const row of rows) {
      const id = String(row?.id ?? '').trim();
      const prefixes = ROW_TO_PREFIXES[id] ?? [];
      let prefix = null;
      for (const candidate of prefixes) {
        if (
          columnSet.has(`${candidate}_vetted`) ||
          columnSet.has(`${candidate}_vetted_note`) ||
          columnSet.has(`${candidate}_vetted_date`) ||
          columnSet.has(`${candidate}_vetted_by_userid`)
        ) {
          prefix = candidate;
          break;
        }
      }
      console.log('[saveVerifySelfRows] row mapping', {
        id,
        prefixes,
        chosenPrefix: prefix
      });
      if (!prefix) {
        skippedIds.push(id || '(unknown)');
        console.log('[saveVerifySelfRows] row skipped no prefix', { id });
        continue;
      }

      const updates = [];
      const values = [];
      if (Object.prototype.hasOwnProperty.call(row, 'verificationStatus') && columnSet.has(`${prefix}_vetted`)) {
        values.push(normalizeStatusForDb(row.verificationStatus));
        updates.push(`${prefix}_vetted = $${values.length}`);
      }
      if (Object.prototype.hasOwnProperty.call(row, 'vettedResult') && columnSet.has(`${prefix}_vetted_note`)) {
        values.push(asNullableText(row.vettedResult));
        updates.push(`${prefix}_vetted_note = $${values.length}`);
      }
      if (Object.prototype.hasOwnProperty.call(row, 'vettedDate') && columnSet.has(`${prefix}_vetted_date`)) {
        values.push(asNullableTimestamp(row.vettedDate));
        updates.push(`${prefix}_vetted_date = $${values.length}`);
      }
      if (Object.prototype.hasOwnProperty.call(row, 'vettedBy') && columnSet.has(`${prefix}_vetted_by_userid`)) {
        values.push(asNullableInt(row.vettedBy));
        updates.push(`${prefix}_vetted_by_userid = $${values.length}`);
      }
      if (!updates.length) {
        skippedIds.push(id || '(unknown)');
        console.log('[saveVerifySelfRows] row skipped no updatable columns', {
          id,
          prefix,
          rowPayload: row
        });
        continue;
      }
      const previewValues = [...values];
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(saveTargetId);
      const sql = `UPDATE helloworldjunktest.singles
         SET ${updates.join(', ')}
         WHERE singles_id = $${values.length}
         RETURNING
           ${prefix}_vetted AS updated_vetted,
           ${prefix}_vetted_note AS updated_vetted_note,
           ${prefix}_vetted_date AS updated_vetted_date,
           ${prefix}_vetted_by_userid AS updated_vetted_by_userid`;
      console.log('[saveVerifySelfRows] update row begin', {
        id,
        prefix,
        updates,
        valuesPreviewWithoutSinglesId: previewValues
      });
      const updateResult = await pool.query(sql, values);
      console.log('[saveVerifySelfRows] update row affected', {
        id,
        prefix,
        rowCount: updateResult.rowCount
      });
      const verify = await pool.query(
        `SELECT
           ${prefix}_vetted AS verify_vetted,
           ${prefix}_vetted_note AS verify_vetted_note,
           ${prefix}_vetted_date AS verify_vetted_date,
           ${prefix}_vetted_by_userid AS verify_vetted_by_userid
         FROM helloworldjunktest.singles
         WHERE singles_id = $1
         LIMIT 1`,
        [saveTargetId]
      );
      console.log('[saveVerifySelfRows] update row done', {
        id,
        prefix,
        verifyRow: verify.rows[0] ?? null
      });
      savedIds.push(id);
    }

    console.log('[saveVerifySelfRows] request done', { saveTargetId, authSinglesId, savedIds, skippedIds });
    return res.json({ success: true, savedIds, skippedIds });
  } catch (error) {
    console.error('[saveVerifySelfRows]', error.message);
    console.error('[saveVerifySelfRows] stack', error.stack);
    return res.status(500).json({ error: 'Failed to save verify-self rows' });
  }
}
