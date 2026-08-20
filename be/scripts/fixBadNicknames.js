/**
 * Rebuild nicknames that break the Adj + real first name + same-first-letter rules.
 * When allocating, prefer adjectives not already used by other members.
 *
 * Usage (Mac tunnel DB):
 *   node be/scripts/fixBadNicknames.js           # dry-run
 *   node be/scripts/fixBadNicknames.js --apply  # write updates
 *
 * Protected demo aliases (seed female/male demo friends) are never changed:
 *   JazzyJeff, BrainyBobby, LuckyLuke, RapidRuth, GiddyGail, SillySue
 */
import pool from '../db/connection.js';
import {
  isValidRhymingNickname,
  listNicknameAdjectives,
  listNicknameFirstNames
} from '../utils/aliasValidation.js';
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

    const adjectives = listNicknameAdjectives();
    const firstNames = listNicknameFirstNames();
    const bad = rows.filter((row) => {
      const alias = String(row.alias ?? '').trim();
      if (PROTECTED_ALIASES.has(alias.toLowerCase())) return false;
      return !isValidRhymingNickname(alias, {
        adjectives,
        firstNames,
        excludeFirstName: row.first_name
      });
    });

    if (!bad.length) {
      console.log('No invalid nicknames found (all match Adj + real first name + same first letter).');
      return;
    }

    console.log(`Found ${bad.length} invalid nickname(s). Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
    const planned = [];
    const usedAdjectives = await loadUsedAdjectives(client);

    if (APPLY) await client.query('BEGIN');

    for (const row of bad) {
      const allocated = await allocateRhymingNicknamePreferUniqueAdjective(client, {
        sex: row.sex,
        excludeFirstName: row.first_name,
        singlesId: row.singles_id,
        usedAdjectives
      });
      planned.push({
        singles_id: row.singles_id,
        member_id: row.member_id,
        email: row.email,
        old_alias: row.alias,
        first_name: row.first_name,
        new_alias: allocated.alias,
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
        `  ${row.old_alias} -> ${row.new_alias}  (singles_id=${row.singles_id} member_id=${row.member_id} legal=${row.first_name || '-'}${row.reused_adjective ? ' [reused adj]' : ''})`
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
    console.error('fixBadNicknames failed:', err?.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end().catch(() => {});
    process.exit(process.exitCode || 0);
  }
}

main();
