import pool from '../../db/connection.js';
import { getDBSchema } from '../../config/envConfig.js';
import { PASSWORD_ATTEMPT_EPOCH } from '../../utils/passwordAttemptTracking.js';
import {
  hashPassword,
  looksLikeArgon2id,
  looksLikeBcrypt,
  verifyPassword
} from '../../utils/passwordHash.js';
import { normalizeEmailForDb } from '../../utils/normalizeEmailForDb.js';

async function passwordMatchesStored(storedHash, plainPassword) {
  return verifyPassword(storedHash, plainPassword);
}

function parsePasswordHashFromBody(body) {
  const hash = String(body?.passwordHash ?? body?.password_hash ?? '').trim();
  if (!looksLikeArgon2id(hash) && !looksLikeBcrypt(hash)) {
    return {
      ok: false,
      error: 'New Hash must be an Argon2id (or legacy bcrypt) string — enter Password or click Generate first'
    };
  }
  return { ok: true, hash };
}

function schemaTables() {
  const schemaName = String(getDBSchema() || 'helloworldjunktest').replace(/"/g, '');
  return {
    schemaName,
    singlesTable: `"${schemaName}"."singles"`,
    globalTable: `"${schemaName}"."global"`
  };
}

const SINGLES_LOOKUP_SELECT = `SELECT singles_id, email, alias, member_id, password_hash`;

async function findSinglesRowForPasswordCheck({ singlesId, email, alias }) {
  const { singlesTable } = schemaTables();
  const orderBy = `ORDER BY COALESCE(updated_at, created_at) DESC LIMIT 1`;

  const id = Number(singlesId);
  if (Number.isFinite(id) && id >= 1) {
    const result = await pool.query(
      `${SINGLES_LOOKUP_SELECT}
       FROM ${singlesTable}
       WHERE singles_id = $1
       ${orderBy}`,
      [id]
    );
    if (result.rows[0]) {
      return { row: result.rows[0], lookupBy: 'singles_id' };
    }
  }

  const emailNorm = normalizeEmailForDb(email);
  if (emailNorm) {
    const result = await pool.query(
      `${SINGLES_LOOKUP_SELECT}
       FROM ${singlesTable}
       WHERE email = $1
       ${orderBy}`,
      [emailNorm]
    );
    if (result.rows[0]) {
      return { row: result.rows[0], lookupBy: 'email' };
    }
  }

  const aliasNorm = String(alias ?? '').trim().toLowerCase();
  if (aliasNorm) {
    const result = await pool.query(
      `${SINGLES_LOOKUP_SELECT}
       FROM ${singlesTable}
       WHERE LOWER(TRIM(alias)) = $1
       ${orderBy}`,
      [aliasNorm]
    );
    if (result.rows[0]) {
      return { row: result.rows[0], lookupBy: 'alias' };
    }
  }

  return { row: null, lookupBy: null };
}

function hasPasswordCheckLookup(body) {
  const singlesId = Number(body?.singlesId ?? body?.singles_id);
  const hasId = Number.isFinite(singlesId) && singlesId >= 1;
  const hasEmail = String(body?.email ?? '').trim().length > 0;
  const hasAlias = String(body?.alias ?? '').trim().length > 0;
  return hasId || hasEmail || hasAlias;
}

/**
 * POST /api/admin/password-check/hash
 * Body: { password } — Argon2id hash for New Hash display (no DB lookup).
 */
export async function postAdminPasswordHashPreview(req, res) {
  try {
    const plain = String(req.body?.password ?? '').trim();
    if (!plain) {
      return res.status(400).json({ error: 'Password is required' });
    }
    const passwordHashFromInput = await hashPassword(plain);
    return res.json({ passwordHashFromInput });
  } catch (err) {
    console.error('[postAdminPasswordHashPreview]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to hash password' });
  }
}

/**
 * POST /api/admin/password-check/lookup
 * Body: { singlesId?, email?, alias? } — load DB hashes without password.
 */
export async function postAdminPasswordCheckLookup(req, res) {
  try {
    if (!hasPasswordCheckLookup(req.body)) {
      return res.status(400).json({ error: 'Enter Single Id, Email, or Alias' });
    }

    const { globalTable } = schemaTables();
    const found = await findSinglesRowForPasswordCheck({
      singlesId: req.body?.singlesId ?? req.body?.singles_id,
      email: req.body?.email,
      alias: req.body?.alias
    });

    const globalResult = await pool.query(`SELECT password_hash FROM ${globalTable} WHERE id = 1 LIMIT 1`);
    const globalPasswordHash = String(globalResult.rows[0]?.password_hash ?? '');

    if (!found.row) {
      return res.status(404).json({ error: 'Could not find any of given', globalPasswordHash });
    }

    const row = found.row;

    return res.json({
      singlesId: row.singles_id,
      lookupBy: found.lookupBy,
      email: row.email ?? null,
      alias: row.alias ?? null,
      memberId: row.member_id ?? null,
      singlesPasswordHash: String(row.password_hash ?? ''),
      globalPasswordHash
    });
  } catch (err) {
    console.error('[postAdminPasswordCheckLookup]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to load password hashes' });
  }
}

/**
 * POST /api/admin/password-check
 * Body: { singlesId?, email?, alias?, password } — at least one lookup field required.
 * Admin only — returns Argon2id hash of entered password plus DB hashes for singles + global.
 */
export async function postAdminPasswordCheck(req, res) {
  try {
    const plain = String(req.body?.password ?? '').trim();

    if (!hasPasswordCheckLookup(req.body)) {
      return res.status(400).json({ error: 'Enter Single Id, Email, or Alias' });
    }
    if (!plain) {
      return res.status(400).json({ error: 'Password is required' });
    }

    const { globalTable } = schemaTables();
    const found = await findSinglesRowForPasswordCheck({
      singlesId: req.body?.singlesId ?? req.body?.singles_id,
      email: req.body?.email,
      alias: req.body?.alias
    });

    if (!found.row) {
      return res.status(404).json({ error: 'Could not find any of given' });
    }

    const globalResult = await pool.query(`SELECT password_hash FROM ${globalTable} WHERE id = 1 LIMIT 1`);

    const row = found.row;
    const singlesPasswordHash = String(row.password_hash ?? '');
    const globalPasswordHash = String(globalResult.rows[0]?.password_hash ?? '');
    const passwordHashFromInput = await hashPassword(plain);
    const singlesPasswordMatch = await passwordMatchesStored(singlesPasswordHash, plain);
    const globalPasswordMatch = await passwordMatchesStored(globalPasswordHash, plain);

    return res.json({
      singlesId: row.singles_id,
      lookupBy: found.lookupBy,
      email: row.email ?? null,
      alias: row.alias ?? null,
      memberId: row.member_id ?? null,
      passwordHashFromInput,
      singlesPasswordHash,
      globalPasswordHash,
      singlesPasswordMatch,
      globalPasswordMatch
    });
  } catch (err) {
    console.error('[postAdminPasswordCheck]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to check password' });
  }
}

/**
 * POST /api/admin/password-check/singles
 * Body: { singlesId, passwordHash } — writes Pwd Hash into singles.password_hash, returns read-back value.
 */
export async function postAdminPasswordCheckSetSingles(req, res) {
  try {
    const parsed = parsePasswordHashFromBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    let singlesId = Number(req.body?.singlesId ?? req.body?.singles_id);
    if (!Number.isFinite(singlesId) || singlesId < 1) {
      const found = await findSinglesRowForPasswordCheck({
        singlesId: req.body?.singlesId ?? req.body?.singles_id,
        email: req.body?.email,
        alias: req.body?.alias
      });
      if (!found.row) {
        return res.status(404).json({ error: 'Could not find any of given' });
      }
      singlesId = Number(found.row.singles_id);
    }

    if (!Number.isFinite(singlesId) || singlesId < 1) {
      return res.status(400).json({ error: 'Enter Single Id, Email, or Alias' });
    }

    const { singlesTable } = schemaTables();
    const update = await pool.query(
      `UPDATE ${singlesTable}
       SET password_hash = $1,
           password_attempt_count = 0,
           password_attempt_datetime = $3::timestamptz,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $2
       RETURNING password_hash`,
      [parsed.hash, singlesId, PASSWORD_ATTEMPT_EPOCH]
    );

    if (!update.rows.length) {
      return res.status(404).json({ error: `No singles row for singles_id ${singlesId}` });
    }

    return res.json({
      singlesId,
      singlesPasswordHash: String(update.rows[0].password_hash ?? '')
    });
  } catch (err) {
    console.error('[postAdminPasswordCheckSetSingles]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update singles.password_hash' });
  }
}

/**
 * POST /api/admin/password-check/member-category
 * Body: { passwordHash } — writes New Hash into singles.password_hash for DemoUser and PilotUser rows.
 */
export async function postAdminPasswordCheckSetMemberCategory(req, res) {
  try {
    const parsed = parsePasswordHashFromBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const { singlesTable } = schemaTables();
    const update = await pool.query(
      `UPDATE ${singlesTable}
       SET password_hash = $1,
           password_attempt_count = 0,
           password_attempt_datetime = $2::timestamptz,
           updated_at = CURRENT_TIMESTAMP
       WHERE member_category::text IN ('DEMOUSER', 'PILOTUSER')
       RETURNING singles_id`,
      [parsed.hash, PASSWORD_ATTEMPT_EPOCH]
    );

    return res.json({
      updatedCount: update.rowCount ?? 0,
      singlesIds: update.rows.map((row) => row.singles_id)
    });
  } catch (err) {
    console.error('[postAdminPasswordCheckSetMemberCategory]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update member category passwords' });
  }
}

/**
 * POST /api/admin/password-check/global
 * Body: { passwordHash } — writes Pwd Hash into global.password_hash, returns read-back value.
 */
export async function postAdminPasswordCheckSetGlobal(req, res) {
  try {
    const parsed = parsePasswordHashFromBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }

    const { globalTable } = schemaTables();
    const update = await pool.query(
      `UPDATE ${globalTable}
       SET password_hash = $1
       WHERE id = 1
       RETURNING password_hash`,
      [parsed.hash]
    );

    if (!update.rows.length) {
      return res.status(404).json({ error: 'global row id=1 not found' });
    }

    return res.json({
      globalPasswordHash: String(update.rows[0].password_hash ?? '')
    });
  } catch (err) {
    console.error('[postAdminPasswordCheckSetGlobal]', err?.message ?? err);
    return res.status(500).json({ error: 'Failed to update global.password_hash' });
  }
}
