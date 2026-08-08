import { recordAuditRegistrationSinglesStatusChange } from './insertAuditRegistration.js';

/**
 * After profile photo is set, mark registration complete users as active.
 * Requires email, phone, password_hash, and profile_image_fk on the row.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} client
 * @param {number} singlesId
 */
export async function activateSinglesStatusOnProfilePhoto(client, singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) return false;

  const { rows } = await client.query(
    `UPDATE helloworldjunktest.singles
     SET status = 'active'::helloworldjunktest.singles_status,
         updated_at = CURRENT_TIMESTAMP
     WHERE singles_id = $1
       AND profile_image_fk IS NOT NULL
       AND email IS NOT NULL
       AND BTRIM(email::text) <> ''
       AND phone IS NOT NULL
       AND BTRIM(phone) <> ''
       AND password_hash IS NOT NULL
       AND BTRIM(password_hash) <> ''
       AND status IS DISTINCT FROM 'active'::helloworldjunktest.singles_status
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
