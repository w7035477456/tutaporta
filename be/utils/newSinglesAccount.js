import { DEFAULT_NEW_USER_THEME } from '../lib/defaultNewUserPreferences.js';
import { referCodeFromMemberId } from './referCodeFromMemberId.js';
import { resolveReferByCode } from './referByCode.js';
import { allocateMemberIdForCategory, allocateNextSinglesId } from './allocateMemberId.js';
import { recordAuditRegistrationNew } from './insertAuditRegistration.js';
import { resolveSignupMemberCategory } from './signupMemberCategory.js';
import { resolvePhoneForNewSinglesAccount } from './duplicatePhonePolicy.js';
import {
  COMPLIMENTARY_NEW_MEMBER_DATA_MB,
  grantComplimentaryNewMemberVaultData
} from './complimentaryNewMemberVaultData.js';
import { seedDefaultBillScheduleForNewMember } from './defaultBillScheduleForNewMember.js';

/**
 * Insert a new singles row after phone/password signup (status = active).
 * emailNorm should be lowercase (see normalizeEmailForDb); stored as text on singles.email.
 * Also grants 10GB complimentary TutaNotes Tx/Rx data + Balance History row,
 * and preloads sample Monthly / Yearly Bill Schedule rows (once per account).
 * @returns {Promise<{ singlesId: number, memberId: number }>}
 */
export async function insertNewSinglesAccount(client, { emailNorm, passwordHash, formattedPhone, referByCode, memberCategory }) {
  const resolvedCategory = memberCategory ?? resolveSignupMemberCategory(emailNorm);
  const newSinglesId = await allocateNextSinglesId(client);
  const memberId = await allocateMemberIdForCategory(client, { memberCategory: resolvedCategory, singlesId: newSinglesId });
  const myReferCode = referCodeFromMemberId(memberId);
  const resolvedReferByCode = resolveReferByCode(referByCode);
  const phoneForInsert = await resolvePhoneForNewSinglesAccount(client, formattedPhone, resolvedCategory);

  await client.query('BEGIN');
  try {
    await client.query(
      `INSERT INTO helloworldjunktest.singles (
         singles_id, member_id, email, password_hash, phone, status, theme,
         my_refer_code, refer_by_code, member_category, refill_remain_mb, refill_bought_mb,
         created_at, updated_at
       )
       VALUES (
         $1, $2, $3, $4, $5, 'active'::helloworldjunktest.singles_status, $6,
         $7, $8, $9, $10, $10,
         CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
       )`,
      [
        newSinglesId,
        memberId,
        emailNorm,
        passwordHash,
        phoneForInsert,
        DEFAULT_NEW_USER_THEME,
        myReferCode,
        resolvedReferByCode,
        resolvedCategory,
        COMPLIMENTARY_NEW_MEMBER_DATA_MB
      ]
    );
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
