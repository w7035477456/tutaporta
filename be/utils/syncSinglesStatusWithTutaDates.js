import { recordAuditRegistrationSinglesStatusChange } from './insertAuditRegistration.js';

/**
 * Mall enrollment TutaDates checkbox → singles.status (Primary).
 * Unchecked: active → inactive. Checked: inactive → active.
 * Other statuses (blank, suspend, cancel, pause, under18, …) are admin / registration
 * states and are never changed by this toggle.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} client
 * @param {number} singlesId
 * @param {boolean} tutaDatesEnabled
 * @returns {Promise<boolean>} true when status changed
 */
export async function syncSinglesStatusWithTutaDates(client, singlesId, tutaDatesEnabled) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;

  const fromStatus = tutaDatesEnabled ? 'inactive' : 'active';
  const toStatus = tutaDatesEnabled ? 'active' : 'inactive';

  const { rows } = await client.query(
    `UPDATE outdateddbsnapshotoct2024.singles
     SET status = $2::outdateddbsnapshotoct2024.singles_status,
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1
       AND status = $3::outdateddbsnapshotoct2024.singles_status
     RETURNING singles_id, email, phone, status`,
    [id, toStatus, fromStatus]
  );

  const row = rows[0];
  if (!row) return false;

  await recordAuditRegistrationSinglesStatusChange(client, {
    singlesId: id,
    singlesStatus: row.status,
    email: row.email,
    phone: row.phone
  });

  return true;
}
