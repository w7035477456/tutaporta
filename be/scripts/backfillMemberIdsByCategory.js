/**
 * Backfill member_id for existing singles rows using category rules:
 * - DemoUser: (1000 + singles_id) + random 2 digits
 * - Public: random 100000–999999, no duplicates
 *
 * Usage (Mac dev):
 *   node be/scripts/backfillMemberIdsByCategory.js
 */
import pool from '../db/connection.js';
import { allocateMemberIdForCategory } from '../utils/allocateMemberId.js';
import { formatMemberDisplayCode } from '../utils/memberDisplayCode.js';
import { normalizeMemberCategoryEnum } from '../utils/memberCategory.js';

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `SELECT singles_id, member_id, member_category, email
       FROM helloworldjunktest.singles
       ORDER BY singles_id`
    );

    await client.query('BEGIN');

    const updates = [];
    for (const row of rows) {
      const category = normalizeMemberCategoryEnum(row.member_category) ?? 'PUBLIC';
      const newMemberId = await allocateMemberIdForCategory(client, {
        memberCategory: category,
        singlesId: row.singles_id
      });
      await client.query(
        `UPDATE helloworldjunktest.singles
         SET member_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE singles_id = $2`,
        [newMemberId, row.singles_id]
      );
      updates.push({
        singles_id: row.singles_id,
        email: row.email,
        member_category: category,
        old_member_id: row.member_id,
        new_member_id: newMemberId,
        display: formatMemberDisplayCode(newMemberId)
      });
    }

    await client.query('COMMIT');

    console.log('member_id backfill complete:');
    for (const row of updates) {
      console.log(
        `  singles_id=${row.singles_id} ${row.member_category} ${row.email}: ${row.old_member_id} -> ${row.new_member_id} (${row.display})`
      );
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Backfill failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
