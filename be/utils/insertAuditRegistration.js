import { normalizeEmailForDb } from './normalizeEmailForDb.js';
import { mapSinglesStatusToAuditStatus } from './singlesStatus.js';

/** @typedef {'change' | 'new' | 'cancel' | 'suspend' | 'other'} AuditRegistrationStatus */

/**
 * Append-only audit row for helloworldjunktest.audit_registrations.
 * Never UPDATE or DELETE audit rows — only INSERT.
 *
 * @param {import('pg').Pool | import('pg').PoolClient} client
 * @param {{ singlesId?: number | null, email: string, phone: string, status: AuditRegistrationStatus }} params
 */
export async function insertAuditRegistration(client, { singlesId = null, email, phone, status }) {
  const singlesIdValue = Number(singlesId);
  await client.query(
    `INSERT INTO helloworldjunktest.audit_registrations (singles_id, email, phone, status, date_update)
     VALUES ($1, $2, $3, $4::helloworldjunktest.audit_registration_status, now())`,
    [
      Number.isFinite(singlesIdValue) && singlesIdValue >= 1 ? singlesIdValue : null,
      normalizeEmailForDb(email),
      String(phone ?? '').trim(),
      status
    ]
  );
}

/**
 * Record singles.status change in audit_registrations.
 * @param {import('pg').Pool | import('pg').PoolClient} client
 * @param {{ singlesId: number, singlesStatus: unknown, email: string, phone: string }} params
 */
export async function recordAuditRegistrationSinglesStatusChange(client, { singlesId, singlesStatus, email, phone }) {
  await insertAuditRegistration(client, {
    singlesId,
    email,
    phone,
    status: mapSinglesStatusToAuditStatus(singlesStatus)
  });
}

/**
 * Record a new registration snapshot (status = new).
 * @param {import('pg').Pool | import('pg').PoolClient} client
 * @param {{ singlesId: number, email: string, phone: string }} params
 */
export async function recordAuditRegistrationNew(client, params) {
  return insertAuditRegistration(client, { ...params, status: 'new' });
}

/**
 * Record an email or phone change snapshot (status = change).
 * @param {import('pg').Pool | import('pg').PoolClient} client
 * @param {{ singlesId: number, email: string, phone: string }} params
 */
export async function recordAuditRegistrationChange(client, params) {
  return insertAuditRegistration(client, { ...params, status: 'change' });
}
