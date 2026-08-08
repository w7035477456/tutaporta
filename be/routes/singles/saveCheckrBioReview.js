import pool from '../../db/connection.js';
import {
  MISC_BIO_FIELD_KEYS,
  VET_BIO_BRIEF_FIELD_KEYS,
  VET_BIO_FULL_FIELD_KEYS,
  loadTableColumns,
  resolveBioSchema,
  upsertBioRow
} from './checkrBioReviewDb.js';

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

function partitionDraft(draft) {
  const vetBio = {};
  const miscBio = {};

  if (!draft || typeof draft !== 'object') {
    return { vetBio, miscBio };
  }

  for (const [draftKey, rawValue] of Object.entries(draft)) {
    if (draftKey.startsWith('briefBio.')) {
      const field = draftKey.slice('briefBio.'.length);
      if (field === 'age') {
        vetBio.age = asNullableSmallint(rawValue);
      } else if (VET_BIO_BRIEF_FIELD_KEYS.has(field)) {
        vetBio[field] = asNullableVarchar(rawValue);
      }
      continue;
    }
    if (draftKey.startsWith('fullBio.')) {
      const field = draftKey.slice('fullBio.'.length);
      if (VET_BIO_FULL_FIELD_KEYS.has(field)) {
        if (field === 'credit_score_grade') {
          vetBio.credit_score_grade = asNullableVarchar(rawValue);
        } else {
          vetBio[field] = asNullableVarchar(rawValue);
        }
      } else if (MISC_BIO_FIELD_KEYS.has(field)) {
        miscBio[field] = asNullableVarchar(rawValue);
      }
      continue;
    }
    if (draftKey.startsWith('miscBio.')) {
      const field = draftKey.slice('miscBio.'.length);
      if (MISC_BIO_FIELD_KEYS.has(field)) {
        miscBio[field] = asNullableVarchar(rawValue);
      }
    }
  }

  return { vetBio, miscBio };
}

/**
 * POST /api/checkr/bio-review/save
 * Persists member-edited bio responses from Submit for Verification.
 */
export async function saveCheckrBioReview(req, res) {
  const singlesId = Number(req.auth?.singles_id);
  if (!Number.isFinite(singlesId) || singlesId < 1) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const { vetBio, miscBio } = partitionDraft(req.body?.draft);
  const hasVetBio = Object.keys(vetBio).length > 0;
  const hasMiscBio = Object.keys(miscBio).length > 0;

  if (!hasVetBio && !hasMiscBio) {
    return res.status(400).json({ error: 'No bio fields to save' });
  }

  try {
    const schemaName = await resolveBioSchema();
    const vetColumns = await loadTableColumns(schemaName, 'vet_bio');
    const miscColumns = await loadTableColumns(schemaName, 'misc_bio');

    await pool.query('BEGIN');

    if (hasVetBio) {
      await upsertBioRow(pool, schemaName, 'vet_bio', singlesId, vetBio, vetColumns);
    }

    if (hasMiscBio) {
      await upsertBioRow(pool, schemaName, 'misc_bio', singlesId, miscBio, miscColumns);
    }

    await pool.query('COMMIT');

    return res.json({
      success: true,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    try {
      await pool.query('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    console.error('[checkr:saveBioReview]', error?.message || error);
    return res.status(500).json({ error: 'Failed to save bio review data' });
  }
}
