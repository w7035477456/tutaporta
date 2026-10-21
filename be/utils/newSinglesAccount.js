import { DEFAULT_NEW_USER_THEME } from '../lib/defaultNewUserPreferences.js';
import { SQL_NEW_MY_REFER_CODE } from './signupReferCode.js';
import { isRewardEligibleReferByCode, resolveReferByCode } from './referByCode.js';
import { ANYMEMBER_SIGNUP_REFER, normalizeMemberCategoryEnum } from './memberCategory.js';
import { allocateMemberIdForCategory, allocateNextSinglesId } from './allocateMemberId.js';
import { recordAuditRegistrationNew } from './insertAuditRegistration.js';
import { resolveSignupMemberCategory } from './signupMemberCategory.js';
import { resolvePhoneForNewSinglesAccount } from './duplicatePhonePolicy.js';
import {
  COMPLIMENTARY_NEW_MEMBER_DATA_MB,
  grantComplimentaryNewMemberVaultData
} from './complimentaryNewMemberVaultData.js';
import { seedDefaultBillScheduleForNewMember } from './defaultBillScheduleForNewMember.js';
import { OPTINOUT_DEFAULT_BITMAP } from './optinoutBitmap.js';

/**
 * `SET status = …` when signup completes on an existing email row: under18 stays under18,
 * an already age-verified row is active, everything else restarts as `new` (ID scan required).
 * Opts the member into all three mall apps (singles.optinout_bitmap).
 */
export const SQL_SIGNUP_STATUS_FOR_EXISTING_ROW = `status = CASE
                 WHEN status = 'under18'::outdateddbsnapshotoct2024.singles_status
                   THEN status
                 WHEN over_18_verified IS TRUE
                   THEN 'active'::outdateddbsnapshotoct2024.singles_status
                 ELSE 'new'::outdateddbsnapshotoct2024.singles_status
               END,
               optinout_bitmap = ${OPTINOUT_DEFAULT_BITMAP}`;

/** Public signup with a Signup Refer Code owned by an existing member → ANYMEMBER-S. */
async function applySignupReferCategory(client, category, referByCode) {
  if (normalizeMemberCategoryEnum(category) !== 'ANYMEMBER' || !isRewardEligibleReferByCode(referByCode)) {
    return category;
  }
  const { rows } = await client.query(
    'SELECT 1 FROM outdateddbsnapshotoct2024.singles WHERE my_refer_code = $1 LIMIT 1',
    [referByCode]
  );
  return rows.length ? ANYMEMBER_SIGNUP_REFER : category;
}

/**
 * Insert a new singles row after phone/password signup (status = new until the ID scan sets active / under18).
 * emailNorm should be lowercase (see normalizeEmailForDb); stored as text on singles.email.
 * Also grants 10GB complimentary TutaNotes Tx/Rx data + Balance History row,
 * and preloads sample Monthly / Yearly Bill Schedule rows (once per account).
 * @returns {Promise<{ singlesId: number, memberId: number }>}
 */
export async function insertNewSinglesAccount(client, { emailNorm, passwordHash, formattedPhone, referByCode, memberCategory }) {
  const resolvedReferByCode = resolveReferByCode(referByCode);
  const resolvedCategory = await applySignupReferCategory(
    client,
    memberCategory ?? resolveSignupMemberCategory(emailNorm),
    resolvedReferByCode
  );
  const newSinglesId = await allocateNextSinglesId(client);
  const memberId = await allocateMemberIdForCategory(client, { memberCategory: resolvedCategory, singlesId: newSinglesId });
  const phoneForInsert = await resolvePhoneForNewSinglesAccount(client, formattedPhone, resolvedCategory);
  let myReferCode = '';

  await client.query('BEGIN');
  try {
    const { rows: insertedRows } = await client.query(
      `INSERT INTO outdateddbsnapshotoct2024.singles (
         singles_id, member_id, email, password_hash, phone, status, optinout_bitmap, theme,
         my_refer_code, refer_by_code, member_category, refill_remain_mb, refill_bought_mb,
         created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, 'new'::outdateddbsnapshotoct2024.singles_status, ${OPTINOUT_DEFAULT_BITMAP}, $6,
         ${SQL_NEW_MY_REFER_CODE}, $7, $8, $9, $9,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )
       RETURNING my_refer_code`,
      [
        newSinglesId,
        memberId,
        emailNorm,
        passwordHash,
        phoneForInsert,
        DEFAULT_NEW_USER_THEME,
        resolvedReferByCode,
        resolvedCategory,
        COMPLIMENTARY_NEW_MEMBER_DATA_MB
      ]
    );
    myReferCode = String(insertedRows[0]?.my_refer_code ?? '');
    await recordAuditRegistrationNew(client, {
      singlesId: newSinglesId,
      email: emailNorm,
      phone: phoneForInsert
    });
    await grantComplimentaryNewMemberVaultData(client, newSinglesId);
    await seedDefaultBillScheduleForNewMember(client, newSinglesId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }

  return { singlesId: newSinglesId, memberId, myReferCode, referByCode: resolvedReferByCode };
}
