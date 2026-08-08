import pool from '../../db/connection.js';
import {
  MISC_BIO_FIELD_KEYS,
  VET_BIO_BRIEF_FIELD_KEYS,
  VET_BIO_FULL_FIELD_KEYS,
  loadTableColumns,
  resolveBioSchema,
  sqlIdent,
  upsertBioRow
} from './checkrBioReviewDb.js';
import { parseGovIdArrayFromEdit } from '../../utils/govIdDocumentLabels.js';
import { normalizePassportPlaceOfBirthDisplay } from '../../utils/idCardOcrParse.js';
import { isAdminAuth, isAdminImpersonationSession } from '../../utils/adminAuth.js';

function asNullableVarchar(raw) {
  const s = String(raw ?? '').trim();
  return s === '' ? null : s;
}

function asNullableSmallint(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

const VETTED_NOT_STARTED = 'verifcation_not_started';
const VETTED_NOTE_RESET = 'n/a';

const ROW_VET_COLUMN = {
  profilePhoto: 'profilephoto_vetted',
  profileDlPhoto: 'profilephoto_vetted',
  firstname: 'firstname_vetted',
  middlename: 'middlename_vetted',
  lastname: 'lastname_vetted',
  age: 'age_vetted',
  height: 'height_vetted',
  gender: 'official_gender_vetted',
  current_city: 'current_city_vetted',
  citizenship: 'countryofcitizenship_vetted',
  placeOfBirth: 'countryofbirth_vetted',
  company_domain_name: 'company_domain_name_vetted',
  current_company: 'current_company_vetted',
  job_title: 'job_title_vetted',
  linkedin_url: 'linkedin_url_vetted',
  college_name: 'college_name_vetted',
  highest_degree_completed: 'highest_degree_completed_vetted',
  degree_graduation_date: 'degree_graduation_date_vetted',
  countryofcitizenship: 'countryofcitizenship_vetted',
  professional_license: 'professional_license_vetted'
};

function resolveVetColumn(draftKey) {
  if (draftKey.startsWith('briefBio.')) {
    const field = draftKey.slice('briefBio.'.length);
    if (field === 'age') return 'age_vetted';
    if (field === 'height') return 'height_vetted';
    if (field === 'gender') return 'official_gender_vetted';
    if (field === 'firstname') return 'firstname_vetted';
    if (field === 'middlename') return 'middlename_vetted';
    if (field === 'lastname') return 'lastname_vetted';
    if (field === 'current_city') return 'current_city_vetted';
    if (field === 'citizenship') return 'countryofcitizenship_vetted';
    if (field === 'placeOfBirth') return 'countryofbirth_vetted';
    return null;
  }
  if (draftKey.startsWith('fullBio.')) {
    const field = draftKey.slice('fullBio.'.length);
    return ROW_VET_COLUMN[field] ?? null;
  }
  if (draftKey.startsWith('miscBio.')) {
    const field = draftKey.slice('miscBio.'.length);
    return ROW_VET_COLUMN[field] ?? null;
  }
  return null;
}

function partitionSingleDraftKey(draftKey, rawValue) {
  const vetBio = {};
  const miscBio = {};

  if (draftKey.startsWith('briefBio.')) {
    const field = draftKey.slice('briefBio.'.length);
    if (field === 'age') vetBio.age = asNullableSmallint(rawValue);
    else if (field === 'height') vetBio.height = asNullableVarchar(rawValue);
    else if (field === 'gender') vetBio.official_gender = asNullableVarchar(rawValue);
    else if (VET_BIO_BRIEF_FIELD_KEYS.has(field)) vetBio[field] = asNullableVarchar(rawValue);
    return { vetBio, miscBio };
  }

  if (draftKey.startsWith('fullBio.')) {
    const field = draftKey.slice('fullBio.'.length);
    if (VET_BIO_FULL_FIELD_KEYS.has(field)) {
      vetBio[field] = asNullableVarchar(rawValue);
    } else if (MISC_BIO_FIELD_KEYS.has(field)) {
      miscBio[field] = asNullableVarchar(rawValue);
    }
    return { vetBio, miscBio };
  }

  if (draftKey.startsWith('miscBio.')) {
    const field = draftKey.slice('miscBio.'.length);
    if (MISC_BIO_FIELD_KEYS.has(field)) {
      miscBio[field] = asNullableVarchar(rawValue);
    }
    return { vetBio, miscBio };
  }

  return { vetBio, miscBio };
}

function vettedResetFields(vetColumn, vetColumns) {
  if (!vetColumn || !vetColumns.has(vetColumn)) return {};
  const base = vetColumn.replace(/_vetted$/, '');
  const out = { [vetColumn]: VETTED_NOT_STARTED };
  if (vetColumns.has(`${base}_vetted_date`)) out[`${base}_vetted_date`] = null;
  if (vetColumns.has(`${base}_vetted_by_userid`)) out[`${base}_vetted_by_userid`] = null;
  if (vetColumns.has(`${base}_vetted_note`)) out[`${base}_vetted_note`] = VETTED_NOTE_RESET;
  return out;
}

/**
 * POST /api/checkr/bio-review/field-save
 * Body: { draftKey: string, value: string, resetVetting?: boolean }
 */
export async function saveCheckrBioReviewField(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const draftKey = String(req.body?.draftKey ?? '').trim();
  const rawValue = req.body?.value;
  const resetVettingRequested = req.body?.resetVetting !== false;
  const adminFieldEdit = isAdminAuth(req.auth);
  const resetVetting = adminFieldEdit ? false : resetVettingRequested;

  if (!draftKey) {
    return res.status(400).json({ error: 'draftKey is required' });
  }

  if (draftKey === 'briefBio.profilePhotoVettingReset' && isAdminImpersonationSession(req.auth)) {
    return res.status(403).json({ error: 'Profile photo vetting cannot be reset during admin impersonation' });
  }

  try {
    const schemaName = await resolveBioSchema();
    const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
    const miscColumns = await loadTableColumns(schemaName, 'misc_bio');
    const singlesColumns = await loadTableColumns(schemaName, 'singles');

    if (draftKey === 'briefBio.profilePhotoVettingReset') {
      const vetBio = vettedResetFields('profilephoto_vetted', vetColumns);
      if (!Object.keys(vetBio).length) {
        return res.status(400).json({ error: 'Profile photo vetting columns not available' });
      }
      await pool.query('BEGIN');
      await upsertBioRow(pool, schemaName, 'vet_bio', singlesId, vetBio, vetColumns);
      await pool.query('COMMIT');
      return res.json({
        success: true,
        draftKey,
        resetVetting: true,
        savedAt: new Date().toISOString()
      });
    }

    const { vetBio, miscBio } = partitionSingleDraftKey(draftKey, rawValue);

    const vetColumn = resolveVetColumn(draftKey);
    if (resetVetting && vetColumn) {
      Object.assign(vetBio, vettedResetFields(vetColumn, vetColumns));
    }

    await pool.query('BEGIN');

    const hasVet = Object.keys(vetBio).length > 0;
    const hasMisc = Object.keys(miscBio).length > 0;
    const isHeightEdit = draftKey === 'briefBio.height';
    const isGenderEdit = draftKey === 'briefBio.gender';
    const isCitizenshipEdit = draftKey === 'briefBio.citizenship';
    const isPlaceOfBirthEdit = draftKey === 'briefBio.placeOfBirth';
    const isGovIdEdit = draftKey === 'briefBio.govId';
    const schema = sqlIdent(schemaName);

    if (isHeightEdit && singlesColumns.has('dl_height')) {
      await pool.query(
        `UPDATE ${schema}.singles SET dl_height = $1, updated_at = CURRENT_TIMESTAMP WHERE singles_id = $2`,
        [asNullableVarchar(rawValue), singlesId]
      );
    }

    if (isGenderEdit && singlesColumns.has('dl_sex')) {
      await pool.query(
        `UPDATE ${schema}.singles SET dl_sex = $1, updated_at = CURRENT_TIMESTAMP WHERE singles_id = $2`,
        [asNullableVarchar(rawValue), singlesId]
      );
    }

    if (isCitizenshipEdit && singlesColumns.has('pp_nationality')) {
      await pool.query(
        `UPDATE ${schema}.singles SET pp_nationality = $1, updated_at = CURRENT_TIMESTAMP WHERE singles_id = $2`,
        [asNullableVarchar(rawValue), singlesId]
      );
    }

    if (isPlaceOfBirthEdit && singlesColumns.has('pp_place_of_birth')) {
      const normalizedPlace = normalizePassportPlaceOfBirthDisplay(rawValue);
      await pool.query(
        `UPDATE ${schema}.singles SET pp_place_of_birth = $1, updated_at = CURRENT_TIMESTAMP WHERE singles_id = $2`,
        [asNullableVarchar(normalizedPlace ?? rawValue), singlesId]
      );
    }

    if (isGovIdEdit && singlesColumns.has('gov_id_array')) {
      await pool.query(
        `UPDATE ${schema}.singles SET gov_id_array = $1, updated_at = CURRENT_TIMESTAMP WHERE singles_id = $2`,
        [parseGovIdArrayFromEdit(rawValue), singlesId]
      );
    }

    if (hasVet) {
      await upsertBioRow(pool, schemaName, 'vet_bio', singlesId, vetBio, vetColumns);
    }
    if (hasMisc) {
      await upsertBioRow(pool, schemaName, 'misc_bio', singlesId, miscBio, miscColumns);
    }

    if (!hasVet && !hasMisc && !isHeightEdit && !isGenderEdit && !isCitizenshipEdit && !isPlaceOfBirthEdit && !isGovIdEdit) {
      await pool.query('ROLLBACK');
      return res.status(400).json({ error: 'Unknown or unsupported field' });
    }

    await pool.query('COMMIT');

    return res.json({
      success: true,
      draftKey,
      resetVetting: Boolean(resetVetting && vetColumn),
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    try {
      await pool.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('[checkr:saveBioReviewField]', error?.message || error);
    return res.status(500).json({ error: 'Failed to save field' });
  }
}
