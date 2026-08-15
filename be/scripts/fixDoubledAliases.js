/**
 * Find aliases that are the same word twice (e.g. SillySilly, QuirkyQuirky)
 * and rebuild as Adjective (from nicknameSuggestions.js) + real first name.
 *
 * Usage (Mac tunnel DB):
 *   node be/scripts/fixDoubledAliases.js           # dry-run (list only)
 *   node be/scripts/fixDoubledAliases.js --apply  # write updates
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../db/connection.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NICKNAME_JS = path.resolve(__dirname, '../../fe/src/config/nicknameSuggestions.js');
const APPLY = process.argv.includes('--apply');

const FALLBACK_ADJECTIVES = [
  'Bubbly',
  'Sunny',
  'Clever',
  'Goofy',
  'Flash',
  'Turbo',
  'Merry',
  'Witty',
  'Cheeky',
  'Cosmic',
  'Neon',
  'Echo',
  'Rogue',
  'Frosty',
  'Alpha',
  'Gentle',
  'Honest',
  'Rapid',
  'Happy',
  'Kind'
];

function titleCaseWord(word) {
  const w = String(word ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function loadAdjectives() {
  try {
    const text = fs.readFileSync(NICKNAME_JS, 'utf8');
    const words = [...text.matchAll(/word:\s*'([^']+)'/g)].map((m) => m[1]).filter(Boolean);
    const unique = [...new Set(words.map((w) => titleCaseWord(w)).filter(Boolean))];
    return unique.length ? unique : FALLBACK_ADJECTIVES;
  } catch {
    return FALLBACK_ADJECTIVES;
  }
}

/** True when alias is WordWord with identical halves (SillySilly). */
function isDoubledWordAlias(alias) {
  const s = String(alias ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (s.length < 4 || s.length % 2 !== 0) return false;
  const half = s.length / 2;
  return s.slice(0, half).toLowerCase() === s.slice(half).toLowerCase();
}

function pickAdjective(adjectives, firstNameLower, usedLower) {
  const pool = adjectives.filter((adj) => {
    const a = adj.toLowerCase();
    return a && a !== firstNameLower && !usedLower.has(a);
  });
  const list = pool.length ? pool : adjectives.filter((adj) => adj.toLowerCase() !== firstNameLower);
  if (!list.length) return 'Sunny';
  return list[Math.floor(Math.random() * list.length)];
}

function buildAlias(adjective, firstName) {
  return `${titleCaseWord(adjective)}${titleCaseWord(firstName)}`.slice(0, 80);
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

async function allocateUniqueAlias(client, adjectives, firstName, singlesId) {
  const firstClean = titleCaseWord(firstName);
  const firstLower = firstClean.toLowerCase();
  if (!firstClean) {
    throw new Error(`singles_id=${singlesId} has empty first name`);
  }

  const used = new Set();
  for (let i = 0; i < 80; i += 1) {
    const adj = pickAdjective(adjectives, firstLower, used);
    used.add(adj.toLowerCase());
    let candidate = buildAlias(adj, firstClean);
    if (!(await aliasTaken(client, candidate, singlesId))) {
      return candidate;
    }
    candidate = `${buildAlias(adj, firstClean)}${Math.floor(10 + Math.random() * 90)}`.slice(0, 80);
    if (!(await aliasTaken(client, candidate, singlesId))) {
      return candidate;
    }
  }
  return `Alias${singlesId}`.slice(0, 80);
}

async function main() {
  const adjectives = loadAdjectives();
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT
         s.singles_id,
         s.alias,
         s.member_id,
         s.email,
         COALESCE(
           NULLIF(BTRIM(s.mailing_firstname), ''),
           NULLIF(BTRIM(s.dl_firstname), ''),
           NULLIF(BTRIM(v.firstname), '')
         ) AS first_name
       FROM helloworldjunktest.singles s
       LEFT JOIN helloworldjunktest.vet_bio v ON v.singles_id = s.singles_id
       WHERE s.alias IS NOT NULL
         AND BTRIM(s.alias) <> ''
       ORDER BY s.singles_id`
    );

    const doubled = rows.filter((row) => isDoubledWordAlias(row.alias));
    if (!doubled.length) {
      console.log('No doubled-word aliases found.');
      return;
    }

    console.log(`Found ${doubled.length} doubled-word alias(es). Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
    const planned = [];

    if (APPLY) await client.query('BEGIN');

    for (const row of doubled) {
      const firstName = String(row.first_name ?? '').trim();
      if (!firstName) {
        console.warn(
          `  SKIP singles_id=${row.singles_id} alias=${row.alias} — no mailing/dl/vet first name`
        );
        continue;
      }
      const nextAlias = await allocateUniqueAlias(client, adjectives, firstName, row.singles_id);
      planned.push({
        singles_id: row.singles_id,
        member_id: row.member_id,
        email: row.email,
        old_alias: row.alias,
        first_name: firstName,
        new_alias: nextAlias
      });
      if (APPLY) {
        await client.query(
          `UPDATE helloworldjunktest.singles
           SET alias = $1, updated_at = CURRENT_TIMESTAMP
           WHERE singles_id = $2`,
          [nextAlias, row.singles_id]
        );
      }
    }

    if (APPLY) await client.query('COMMIT');

    for (const row of planned) {
      console.log(
        `  ${row.old_alias} -> ${row.new_alias}  (singles_id=${row.singles_id} member_id=${row.member_id} first=${row.first_name})`
      );
    }
    console.log(
      APPLY
        ? `Updated ${planned.length} alias(es).`
        : `Dry-run complete (${planned.length} would update). Re-run with --apply to write.`
    );
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('fixDoubledAliases failed:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

main();
