function toNonNegativeInteger(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.trunc(n);
}

/** Six-digit member_id (prefix ignored — display uses M + member_id only). */
export function formatMemberNumber(_prefix, memberId) {
  const member = toNonNegativeInteger(memberId);
  if (member == null) return null;
  return String(member).padStart(6, '0');
}

/** M + six-digit member_id display code (no "Member " prefix). */
export function formatMemberCode({ prefix, memberId, singlesId } = {}) {
  const number = formatMemberNumber(prefix, memberId);
  if (number) return `M${number}`;
  const fallbackId = toNonNegativeInteger(singlesId);
  if (fallbackId == null) return null;
  return `M${String(fallbackId).padStart(6, '0')}`;
}

/**
 * Standard member display: "Alias (M######)" or "M######" when alias is blank.
 */
export function formatAliasWithMemberCode({ alias, prefix, memberId, singlesId, memberCode, fallback = 'Member' } = {}) {
  const aliasText = String(alias ?? '').trim();
  const code = String(memberCode ?? '').trim() || formatMemberCode({ prefix, memberId, singlesId });
  if (aliasText && code) return `${aliasText} (${code})`;
  if (aliasText) return aliasText;
  return code || fallback;
}

/** @deprecated alias for formatMemberCode — prefer formatMemberCode. */
export function formatRequesterMemberCode(prefix, memberId) {
  return formatMemberCode({ prefix, memberId }) || '';
}

/**
 * Member label for cards, chat, alt text, etc.
 * Pass alias when available so UI shows "Alias (M######)".
 */
export function formatMemberLabel({ alias, prefix, memberId, singlesId, fallback = 'Member' } = {}) {
  return formatAliasWithMemberCode({ alias, prefix, memberId, singlesId, fallback });
}

/** Gallery card lines — single primary line "Alias (M######)" or "M######". */
export function getMemberDisplayLines({ alias, prefix, memberId, singlesId }) {
  const primary = formatAliasWithMemberCode({ alias, prefix, memberId, singlesId });
  return {
    primary,
    secondary: ''
  };
}

/** Page banner and headings — alias + member code, else full name, else fallback. */
export function formatSmilesBannerName({ alias, prefix, memberId, singlesId, fullName, fallback = 'you' }) {
  const line = formatAliasWithMemberCode({ alias, prefix, memberId, singlesId, fallback: null });
  if (line) return line;
  const name = String(fullName ?? '').trim();
  if (name) return name;
  return fallback;
}
