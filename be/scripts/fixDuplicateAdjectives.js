/**
 * Find members that share the same adjective stem (e.g. WackyWillie + WackyWanda)
 * and reassign later duplicates to a free adjective when possible.
 *
 * Usage:
 *   node be/scripts/fixDuplicateAdjectives.js           # dry-run
 *   node be/scripts/fixDuplicateAdjectives.js --apply  # write updates
 */
import pool from '../db/connection.js';
import { listNicknameAdjectives, parseNicknameParts } from '../utils/aliasValidation.js';
import {
  allocateRhymingNicknamePreferUniqueAdjective,
  loadUsedAdjectives
} from '../utils/allocateRhymingNickname.js';

const APPLY = process.argv.includes('--apply');

const PROTECTED_ALIASES = new Set(
  ['Admin', 'JazzyJeff', 'BrainyBobby', 'LuckyLuke', 'RapidRuth', 'GiddyGail', 'SillySue'].map((a) =>
    a.toLowerCase()
  )
);

async function main() {
  const client = await pool.connect();
  try {
    const adjectives = listNicknameAdjectives();
    const { rows } = await client.query(
      `SELECT
         s.singles_id,
         s.alias,
         s.member_id,
         s.email,
         COALESCE(NULLIF(BTRIM(s.gender_self_report::text), ''), NULLIF(BTRIM(s.dl_sex::text), '')) AS sex,
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

    const byAdj = new Map();
    for (const row of rows) {
      const alias = String(row.alias ?? '').trim();
      if (PROTECTED_ALIASES.has(alias.toLowerCase())) continue;
      const parts = parseNicknameParts(alias, adjectives);
      if (!parts?.adjective) continue;
      const key = parts.adjective.toLowerCase();
      if (!byAdj.has(key)) byAdj.set(key, []);
      byAdj.get(key).push({ ...row, adjective: parts.adjective });
    }

    const duplicates = [];
    for (const [, group] of byAdj) {
      if (group.length < 2) continue;
      // Keep the earliest singles_id; reassign the rest.
      const sorted = [...group].sort((a, b) => Number(a.singles_id) - Number(b.singles_id));
      duplicates.push(...sorted.slice(1));
    }

    if (!duplicates.length) {
      console.log('No duplicate adjectives found.');
      return;
    }

    console.log(
      `Found ${duplicates.length} nickname(s) reusing an adjective. Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`
    );
    const usedAdjectives = await loadUsedAdjectives(client);
    const planned = [];

    if (APPLY) await client.query('BEGIN');

    for (const row of duplicates) {
      // Free this row's current adjective from the "keep" set so we don't block others incorrectly;
      // keepers already occupy usedAdjectives via loadUsedAdjectives.
      const allocated = await allocateRhymingNicknamePreferUniqueAdjective(client, {
        sex: row.sex,
        excludeFirstName: row.first_name,
        singlesId: row.singles_id,
        usedAdjectives
      });
      planned.push({
        singles_id: row.singles_id,
        member_id: row.member_id,
        old_alias: row.alias,
        new_alias: allocated.alias,
        old_adjective: row.adjective,
        new_adjective: allocated.adjective,
        reused_adjective: allocated.reusedAdjective
      });
      if (APPLY) {
        await client.query(
          `UPDATE helloworldjunktest.singles
           SET alias = $1, updated_at = CURRENT_TIMESTAMP
           WHERE singles_id = $2`,
          [allocated.alias, row.singles_id]
        );
      }
    }

    if (APPLY) await client.query('COMMIT');

    for (const row of planned) {
      console.log(
        `  ${row.old_alias} -> ${row.new_alias}  (was ${row.old_adjective}, now ${row.new_adjective}${row.reused_adjective ? ' [reused adj]' : ''})`
      );
    }
    console.log(
      APPLY
        ? `Updated ${planned.length} nickname(s).`
        : `Dry-run complete (${planned.length} would update). Re-run with --apply to write.`
    );
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    console.error('fixDuplicateAdjectives failed:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

main();
