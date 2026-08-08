import { formatAliasWithMemberCode } from 'utils/memberLabel';

function normalizeRequester(row) {
  if (!row || typeof row !== 'object') return null;
  const singlesId = Number(row.requester_singles_id ?? row.requesterSinglesId);
  return {
    singlesId: Number.isFinite(singlesId) && singlesId > 0 ? singlesId : null,
    prefix: row.prefix,
    memberId: row.member_id ?? row.memberId,
    alias: row.alias ?? ''
  };
}

function uniqueRequesters(notifications) {
  const seen = new Set();
  const unique = [];
  for (const row of Array.isArray(notifications) ? notifications : []) {
    const normalized = normalizeRequester(row);
    if (!normalized) continue;
    if (normalized.singlesId && seen.has(normalized.singlesId)) continue;
    if (normalized.singlesId) seen.add(normalized.singlesId);
    unique.push(normalized);
  }
  return unique;
}

/** Sidebar Received Bio Req badge hover. */
export function formatReceivedBioPendingBadgeTooltip(pendingCount, notifications) {
  const count = Number(pendingCount);
  if (!Number.isFinite(count) || count < 1) return '';

  const requestLabel = count === 1 ? 'bio request' : 'bio requests';
  const requesters = uniqueRequesters(notifications);
  if (!requesters.length) {
    return `You still have ${count} ${requestLabel} need response`;
  }

  const clauses = requesters.map((row) =>
    formatAliasWithMemberCode({
      alias: row.alias,
      prefix: row.prefix,
      memberId: row.memberId,
      singlesId: row.singlesId
    })
  );

  if (clauses.length === 1) {
    return `You still have ${count} ${requestLabel} need response from ${clauses[0]}`;
  }
  if (clauses.length === 2) {
    return `You still have ${count} ${requestLabel} need response from ${clauses[0]} and ${clauses[1]}`;
  }
  return `You still have ${count} ${requestLabel} need response from ${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`;
}
