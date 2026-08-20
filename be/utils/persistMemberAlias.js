import {
  ALIAS_ALNUM_ONLY_MESSAGE,
  ALIAS_DOUBLED_WORD_MESSAGE,
  ALIAS_RHYME_NAME_MESSAGE,
  cleanAlias,
  isDoubledWordAlias,
  isValidAliasFormat,
  isValidRhymingAliasFormat,
  normalizeAliasKey,
  formatAliasTakenMessage
} from './aliasValidation.js';

/** Case-insensitive: another member already has this alias in helloworldjunktest.singles.alias. */
async function isSinglesAliasTakenByOther(client, alias, excludeSinglesId) {
  const trimmed = cleanAlias(alias);
  if (!trimmed) return false;
  const { rows } = await client.query(
    `SELECT 1
     FROM helloworldjunktest.singles
     WHERE alias IS NOT NULL
       AND btrim(alias) <> ''
       AND lower(btrim(alias)) = lower($1)
       AND singles_id <> $2
     LIMIT 1`,
    [trimmed, excludeSinglesId]
  );
  return rows.length > 0;
}

async function loadLegalFirstName(client, singlesId) {
  const { rows } = await client.query(
    `SELECT COALESCE(
       NULLIF(BTRIM(s.mailing_firstname), ''),
       NULLIF(BTRIM(s.dl_firstname), ''),
       NULLIF(BTRIM(v.firstname), '')
     ) AS first_name
     FROM helloworldjunktest.singles s
     LEFT JOIN helloworldjunktest.vet_bio v ON v.singles_id = s.singles_id
     WHERE s.singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  return String(rows[0]?.first_name ?? '').trim();
}

/**
 * Save or clear helloworldjunktest.singles.alias.
 * Uniqueness: SELECT from singles.alias (case-insensitive), excluding the current member.
 * @returns {{ ok: true, alias: string, message: string } | { ok: false, status: number, error: string }}
 */
export async function persistMemberAlias(client, singlesId, rawAlias) {
  const nickname = cleanAlias(rawAlias);

  const currentResult = await client.query(
    `SELECT alias
     FROM helloworldjunktest.singles
     WHERE singles_id = $1
     LIMIT 1`,
    [singlesId]
  );
  if (!currentResult.rows.length) {
    return { ok: false, status: 404, error: 'User profile not found' };
  }

  if (!nickname) {
    await client.query(
      `UPDATE helloworldjunktest.singles
       SET alias = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE singles_id = $1`,
      [singlesId]
    );
    return { ok: true, alias: '', message: 'Nickname removed.' };
  }

  if (!isValidAliasFormat(nickname)) {
    return { ok: false, status: 400, error: ALIAS_ALNUM_ONLY_MESSAGE };
  }

  if (isDoubledWordAlias(nickname)) {
    return { ok: false, status: 400, error: ALIAS_DOUBLED_WORD_MESSAGE };
  }

  const legalFirst = await loadLegalFirstName(client, singlesId);
  if (!isValidRhymingAliasFormat(nickname, legalFirst)) {
    return { ok: false, status: 400, error: ALIAS_RHYME_NAME_MESSAGE };
  }

  const currentNickname = cleanAlias(currentResult.rows[0]?.alias);
  const nicknameKey = normalizeAliasKey(nickname);
  const currentKey = normalizeAliasKey(currentNickname);

  if (nicknameKey !== currentKey && (await isSinglesAliasTakenByOther(client, nickname, singlesId))) {
    return { ok: false, status: 409, error: formatAliasTakenMessage(nickname) };
  }

  await client.query(
    `UPDATE helloworldjunktest.singles
     SET alias = $1,
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $2`,
    [nickname, singlesId]
  );

  return { ok: true, alias: nickname, message: 'Nickname saved.' };
}
