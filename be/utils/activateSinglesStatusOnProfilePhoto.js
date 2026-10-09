import { recordAuditRegistrationSinglesStatusChange } from './insertAuditRegistration.js';

/**
 * After profile photo is set, mark registration complete users as active.
 * Requires email, phone, password_hash, and profile_image_fk on the row.
 * Never touches `new` (only the Driver License / Passport scan moves new → active) or `under18`.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} client
 * @param {number} singlesId
 */
export async function activateSinglesStatusOnProfilePhoto(client, singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;

  const { rows } = await client.query(
    `UPDATE outdateddbsnapshotoct2024.singles
     SET status = 'active'::outdateddbsnapshotoct2024.singles_status,
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1
       AND profile_image_fk IS NOT NULL
       AND email IS NOT NULL
       AND BTRIM(email::text) <> ''
       AND phone IS NOT NULL
       AND BTRIM(phone) <> ''
       AND password_hash IS NOT NULL
       AND BTRIM(password_hash) <> ''
       AND (
         status IS NULL
         OR status NOT IN (
           'active'::outdateddbsnapshotoct2024.singles_status,
           'new'::outdateddbsnapshotoct2024.singles_status,
           'under18'::outdateddbsnapshotoct2024.singles_status
         )
       )
     RETURNING singles_id, email, phone, status`,
    [id]
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
