/**
 * Load member identities and append request/approve hard-copy lines.
 * Never throws — bio request/approve must succeed even if logging fails.
 */
import pool from '../db/connection.js';
import { getRequestClientIp } from './adminIpConfig.js';
import { formatMemberDisplayCode } from './memberDisplayCode.js';
import { appendBioApproveHardCopy, appendBioRequestHardCopy } from './hardCopyAuthLog.js';

const SCHEMA = 'helloworldjunktest';

async function loadParty(singlesId) {
  const id = Number(singlesId);
  if (!Number.isFinite(id) || id < 1) {
    return { alias: '-', member: '-', email: '-', phone: '-' };
  }
  try {
    const { rows } = await pool.query(
      `SELECT member_id, alias, email, phone
       FROM ${SCHEMA}.singles
       WHERE singles_id = $1
       LIMIT 1`,
      [id]
    );
    const row = rows[0] ?? {};
    return {
      alias: String(row.alias ?? '').trim() || '-',
      member: formatMemberDisplayCode(row.member_id) || String(row.member_id ?? '').trim() || '-',
      email: String(row.email ?? '').trim() || '-',
      phone: String(row.phone ?? '').trim() || '-'
    };
  } catch (err) {
    console.error('[hardCopyBioRequestLog] loadParty failed:', err?.message ?? err);
    return { alias: '-', member: '-', email: '-', phone: '-' };
  }
}

function normalizeBioKind(bioKind) {
  const t = String(bioKind ?? '').trim().toLowerCase();
  if (t === 'full' || t === 'details' || t === 'full_bio') return 'full';
  return 'brief';
}

export async function appendBioRequestHardCopyFromIds(req, { requesterId, requesteeId, bioKind } = {}) {
  try {
    const [requester, requestee] = await Promise.all([loadParty(requesterId), loadParty(requesteeId)]);
    appendBioRequestHardCopy({
      clientIp: req ? getRequestClientIp(req) : null,
      bioKind: normalizeBioKind(bioKind),
      requester,
      requestee
    });
  } catch (err) {
    console.error('[hardCopyBioRequestLog] request append failed:', err?.message ?? err);
  }
}

export async function appendBioApproveHardCopyFromIds(
  req,
  { approverId, requesterId, requesteeId, bioKind } = {}
) {
  try {
    const requesteeKey = requesteeId ?? approverId;
    const [approver, requester, requestee] = await Promise.all([
      loadParty(approverId),
      loadParty(requesterId),
      loadParty(requesteeKey)
    ]);
    appendBioApproveHardCopy({
      clientIp: req ? getRequestClientIp(req) : null,
      bioKind: normalizeBioKind(bioKind),
      approver,
      requester,
      requestee
    });
  } catch (err) {
    console.error('[hardCopyBioRequestLog] approve append failed:', err?.message ?? err);
  }
}
