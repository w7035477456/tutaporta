import { formatAliasWithMemberCode } from 'utils/memberLabel';

function normalizeSender(row) {
  if (!row || typeof row !== 'object') return null;
  const singlesId = Number(row.singles_id ?? row.singlesId);
  return {
    singlesId: Number.isFinite(singlesId) && singlesId > 0 ? singlesId : null,
    prefix: row.prefix,
    memberId: row.member_id ?? row.memberId,
    alias: row.alias ?? ''
  };
}

function formatSenderClause({ alias, prefix, memberId, singlesId }) {
  return formatAliasWithMemberCode({ alias, prefix, memberId, singlesId });
}

/** Bell badge hover: "You have chat message from Billy_1 (M100236)" */
export function formatUnreadChatBellTooltip(senders) {
  const rows = (Array.isArray(senders) ? senders : []).map(normalizeSender).filter(Boolean);
  if (!rows.length) return '';

  const clauses = rows.map(formatSenderClause);
  if (clauses.length === 1) {
    return `You have chat message from ${clauses[0]}`;
  }
  if (clauses.length === 2) {
    return `You have chat message from ${clauses[0]} and ${clauses[1]}`;
  }
  return `You have chat message from ${clauses.slice(0, -1).join(', ')} and ${clauses[clauses.length - 1]}`;
}
