/**
 * Allocate Adj + real first name nicknames that “rhyme” (same first letter).
 * Prefer adjectives not already used in helloworldjunktest.singles.alias;
 * if none left for that letter, try other first names; reuse an adjective only as last resort.
 */
import {
  buildRhymingNickname,
  listNicknameAdjectives,
  listNicknameFirstNames,
  nicknameFirstLetterKey,
  parseNicknameParts,
  titleCaseNicknameWord
} from './aliasValidation.js';

function pickRandom(list) {
  if (!list.length) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function genderKeyFromSex(sex) {
  const s = String(sex ?? '')
    .trim()
    .toUpperCase();
  if (s === 'F' || s === 'FEMALE') return 'female';
  if (s === 'M' || s === 'MALE') return 'male';
  return 'any';
}

/** Collect adjective stems already used by other members (and optional in-memory set). */
export async function loadUsedAdjectives(client, { excludeSinglesId = null, extraUsed = null } = {}) {
  const used = new Set();
  if (extraUsed instanceof Set) {
    for (const a of extraUsed) used.add(String(a).toLowerCase());
  }
  const adjectives = listNicknameAdjectives();
  const { rows } = await client.query(
    `SELECT alias
     FROM helloworldjunktest.singles
     WHERE alias IS NOT NULL
       AND BTRIM(alias) <> ''
       AND ($1::bigint IS NULL OR singles_id <> $1)`,
    [excludeSinglesId]
  );
  for (const row of rows) {
    const parts = parseNicknameParts(row.alias, adjectives);
    if (parts?.adjective) used.add(parts.adjective.toLowerCase());
  }
  return used;
}

async function aliasTaken(client, alias, excludeSinglesId) {
  const { rows } = await client.query(
    `SELECT 1
     FROM helloworldjunktest.singles
     WHERE LOWER(TRIM(alias)) = LOWER(TRIM($1))
       AND singles_id <> $2
     LIMIT 1`,
    [alias, excludeSinglesId]
  );
  return rows.length > 0;
}

async function tryCandidate(client, adj, name, singlesId) {
  let candidate = buildRhymingNickname(adj, name);
  if (!(await aliasTaken(client, candidate, singlesId))) return candidate;
  candidate = buildRhymingNickname(adj, name, String(Math.floor(10 + Math.random() * 90)));
  if (!(await aliasTaken(client, candidate, singlesId))) return candidate;
  return null;
}

/**
 * @param {import('pg').PoolClient} client
 * @param {{
 *   sex?: string,
 *   excludeFirstName?: string,
 *   singlesId: number,
 *   usedAdjectives?: Set<string>,
 * }} opts
 * @returns {Promise<{ alias: string, adjective: string, reusedAdjective: boolean }>}
 */
export async function allocateRhymingNicknamePreferUniqueAdjective(client, opts) {
  const singlesId = Number(opts.singlesId);
  const adjectives = listNicknameAdjectives();
  const names = listNicknameFirstNames({ gender: genderKeyFromSex(opts.sex) });
  const exclude = titleCaseNicknameWord(opts.excludeFirstName).toLowerCase();
  const usedAdjectives =
    opts.usedAdjectives instanceof Set
      ? opts.usedAdjectives
      : await loadUsedAdjectives(client, { excludeSinglesId: singlesId });

  const namePoolFor = (letter, adjLower) =>
    names.filter((n) => {
      const key = n.toLowerCase();
      return nicknameFirstLetterKey(n) === letter && key !== exclude && key !== adjLower;
    });

  // Pass 1: unused adjectives only (prefer unique adjective).
  for (const adj of shuffle(adjectives)) {
    const adjLower = adj.toLowerCase();
    if (usedAdjectives.has(adjLower)) continue;
    const letter = nicknameFirstLetterKey(adj);
    const namePool = shuffle(namePoolFor(letter, adjLower));
    for (const name of namePool) {
      const alias = await tryCandidate(client, adj, name, singlesId);
      if (alias) {
        usedAdjectives.add(adjLower);
        return { alias, adjective: adj, reusedAdjective: false };
      }
    }
  }

  // Pass 2/3: reuse adjectives only when no unused adjective can form a free alias.
  // Prefer trying different first names under already-used adjectives.
  for (const adj of shuffle(adjectives)) {
    const adjLower = adj.toLowerCase();
    const letter = nicknameFirstLetterKey(adj);
    const namePool = shuffle(namePoolFor(letter, adjLower));
    for (const name of namePool) {
      const alias = await tryCandidate(client, adj, name, singlesId);
      if (alias) {
        const wasUsed = usedAdjectives.has(adjLower);
        usedAdjectives.add(adjLower);
        return { alias, adjective: adj, reusedAdjective: wasUsed };
      }
    }
  }

  // Absolute fallback.
  const fallback = `SunnySam${singlesId}`.slice(0, 80);
  return { alias: fallback, adjective: 'Sunny', reusedAdjective: true };
}
