import pool from '../db/connection.js';
import { BIO_SINGLES_FK_COLUMN, loadTableColumns, resolveBioSchema, sqlIdent } from './singles/checkrBioReviewDb.js';

const ALLOWED_STATUSES = new Set([
  'info_matches',
  'verification_in_progress',
  'info_not_matches',
  'verification_not_started',
  'verifcation_not_started',
  'unable_find_info'
]);

const ROW_VET_COLUMN = {
  profilePhoto: 'profilephoto_vetted',
  profileDlPhoto: 'profilephoto_vetted',
  profileLivePhoto: 'profilephoto_vetted',
  profilePpPhoto: 'profilephoto_vetted',
  firstname: 'firstname_vetted',
  middlename: 'middlename_vetted',
  lastname: 'lastname_vetted',
  age: 'age_vetted',
  height: 'height_vetted',
  gender: 'official_gender_vetted',
  current_city: 'current_city_vetted',
  citizenship: 'countryofcitizenship_vetted',
  placeOfBirth: 'countryofbirth_vetted',
  job_title: 'job_title_vetted',
  linkedin_url: 'linkedin_url_vetted',
  credit_score_grade: 'credit_score_grade_vetted',
  college_name: 'college_name_vetted',
  current_company: 'current_company_vetted',
  highest_degree_completed: 'highest_degree_completed_vetted',
  degree_graduation_date: 'degree_graduation_date_vetted',
  company_domain_name: 'company_domain_name_vetted',
  countryofcitizenship: 'countryofcitizenship_vetted',
  professional_license: 'professional_license_vetted'
};

function resolveVetColumn(rowKey) {
  return ROW_VET_COLUMN[String(rowKey ?? '').trim()] ?? null;
}

function normalizeStatusForDb(raw) {
  const s = String(raw ?? '').trim().toLowerCase();
  if (!ALLOWED_STATUSES.has(s)) return null;
  // PostgreSQL vetting_status enum uses the typo verifcation_not_started (missing "i").
  if (s === 'verification_not_started' || s === 'verifcation_not_started') {
    return 'verifcation_not_started';
  }
  return s;
}

/**
 * POST /api/admin/vet-bio/matching-status
 * Admin only: cycle/save a vet_bio *_vetted value for a member bio row.
 */
export async function updateAdminVetBioMatchingStatus(req, res) {
  const memberId = Number(req.body?.memberId);
  const rowKey = String(req.body?.rowKey ?? '').trim();
  const vettedStatus = normalizeStatusForDb(req.body?.vettedStatus);

  if (!Number.isFinite(memberId) || memberId < 1) {
    return res.status(400).json({ error: 'memberId is required' });
  }
  if (!vettedStatus) {
    return res.status(400).json({ error: 'Invalid vettedStatus' });
  }

  const vettedColumn = resolveVetColumn(rowKey);
  if (!vettedColumn) {
    return res.status(400).json({ error: 'This row does not have a matching status field' });
  }

  try {
    const schemaName = await resolveBioSchema();
    const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
    if (!vetColumns.has(vettedColumn)) {
      return res.status(400).json({ error: `Column ${vettedColumn} is not available` });
    }

    const schema = sqlIdent(schemaName);
    const fk = sqlIdent(BIO_SINGLES_FK_COLUMN);
    const vettedDateColumn = `${vettedColumn.replace(/_vetted$/, '')}_vetted_date`;
    const hasVettedDate = vetColumns.has(vettedDateColumn);
    const vettedDateIdent = hasVettedDate ? sqlIdent(vettedDateColumn) : null;

    const insertColumns = [fk, sqlIdent(vettedColumn)];
    const insertValues = ['$1', '$2'];
    const updateSets = [`${sqlIdent(vettedColumn)} = EXCLUDED.${sqlIdent(vettedColumn)}`];
    if (hasVettedDate) {
      insertColumns.push(vettedDateIdent);
      insertValues.push('CURRENT_TIMESTAMP');
      updateSets.push(`${vettedDateIdent} = CURRENT_TIMESTAMP`);
    }

    const result = await pool.query(
      `INSERT INTO ${schema}.vet_bio (${insertColumns.join(', ')})
       VALUES (${insertValues.join(', ')})
       ON CONFLICT (${fk}) DO UPDATE SET ${updateSets.join(', ')}
       RETURNING ${sqlIdent(vettedColumn)} AS vetted_status${hasVettedDate ? `, ${vettedDateIdent} AS vetted_date` : ''}`,
      [memberId, vettedStatus]
    );

    return res.json({
      success: true,
      memberId,
      rowKey,
      vettedColumn,
      vettedStatus: result.rows[0]?.vetted_status ?? vettedStatus,
      vettedDate: result.rows[0]?.vetted_date ?? null
    });
  } catch (error) {
    console.error('[admin:vetBioMatchingStatus]', error?.message || error);
    return res.status(500).json({ error: 'Failed to update matching status' });
  }
}
