import { normalizeEmailForDb } from './normalizeEmailForDb.js';
import { formatPhoneForDuplicateCheck } from './duplicatePhonePolicy.js';

export function hasWildcard(raw) {
  return String(raw ?? '').includes('*');
}

/** User `*` wildcards → SQL LIKE pattern (`%`); escape `\`, `%`, `_`. */
export function wildcardToLikePattern(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed || !hasWildcard(trimmed)) return null;
  return trimmed
    .split('*')
    .map((part) => part.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_'))
    .join('%');
}

/**
 * @returns {{ mode: 'exact', value: number } | { mode: 'like', pattern: string } | null}
 */
export function parseSinglesIdLookup(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const digitToken = trimmed.replace(/[^\d*]/g, '');
  if (hasWildcard(digitToken)) {
    const pattern = wildcardToLikePattern(digitToken) ?? (digitToken === '*' ? '%' : null);
    return pattern ? { mode: 'like', pattern } : null;
  }
  const n = Number(digitToken);
  return Number.isFinite(n) && n >= 1 ? { mode: 'exact', value: n } : null;
}

/**
 * @returns {{ mode: 'exact', value: number } | { mode: 'like', pattern: string } | null}
 */
export function parseMemberIdLookup(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  const token = trimmed.replace(/^M/i, '').replace(/[^\d*]/g, '');
  if (hasWildcard(token)) {
    const pattern = wildcardToLikePattern(token) ?? (token === '*' ? '%' : null);
    return pattern ? { mode: 'like', pattern } : null;
  }
  const n = Number(token);
  return Number.isFinite(n) && n >= 1 ? { mode: 'exact', value: n } : null;
}

/**
 * @returns {{ mode: 'exact', value: string } | { mode: 'like', pattern: string } | null}
 */
export function parseEmailLookup(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (hasWildcard(trimmed)) {
    const pattern = wildcardToLikePattern(trimmed.toLowerCase()) ?? (trimmed === '*' ? '%' : null);
    return pattern ? { mode: 'like', pattern } : null;
  }
  const normalized = normalizeEmailForDb(trimmed);
  return normalized ? { mode: 'exact', value: normalized } : null;
}

/**
 * @returns {{ mode: 'exact', value: string } | { mode: 'like', pattern: string } | null}
 */
export function parseAliasLookup(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (hasWildcard(trimmed)) {
    const pattern = wildcardToLikePattern(trimmed.toLowerCase()) ?? (trimmed === '*' ? '%' : null);
    return pattern ? { mode: 'like', pattern } : null;
  }
  return { mode: 'exact', value: trimmed.toLowerCase() };
}

function normalizePhoneExact(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  const tenDigit = formatPhoneForDuplicateCheck(trimmed);
  if (tenDigit) return tenDigit;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return trimmed;
}

/**
 * @returns {{ mode: 'exact', value: string } | { mode: 'like', pattern: string } | null}
 */
export function parsePhoneLookup(raw) {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;
  if (hasWildcard(trimmed)) {
    const digitToken = trimmed.replace(/[^\d*]/g, '');
    const pattern = wildcardToLikePattern(digitToken) ?? (digitToken === '*' ? '%' : null);
    return pattern ? { mode: 'like', pattern } : null;
  }
  const normalized = normalizePhoneExact(trimmed);
  return normalized ? { mode: 'exact', value: normalized } : null;
}

export function hasAdminLookupInput(body) {
  return Boolean(
    parseSinglesIdLookup(body?.singlesId ?? body?.singles_id) ||
      parseEmailLookup(body?.email) ||
      parseAliasLookup(body?.alias) ||
      parseMemberIdLookup(body?.memberId ?? body?.member_id) ||
      parsePhoneLookup(body?.phone)
  );
}

export function lookupUsesWildcard(body) {
  return (
    parseSinglesIdLookup(body?.singlesId ?? body?.singles_id)?.mode === 'like' ||
    parseEmailLookup(body?.email)?.mode === 'like' ||
    parseAliasLookup(body?.alias)?.mode === 'like' ||
    parseMemberIdLookup(body?.memberId ?? body?.member_id)?.mode === 'like' ||
    parsePhoneLookup(body?.phone)?.mode === 'like'
  );
}

const LIKE_ESCAPE = ` ESCAPE '\\'`;

export function appendSinglesIdCondition(conditions, params, lookup, paramIndexRef) {
  if (!lookup) return paramIndexRef;
  if (lookup.mode === 'exact') {
    conditions.push(`s.singles_id = $${paramIndexRef}`);
    params.push(lookup.value);
    return paramIndexRef + 1;
  }
  conditions.push(`s.singles_id::text LIKE $${paramIndexRef}${LIKE_ESCAPE}`);
  params.push(lookup.pattern);
  return paramIndexRef + 1;
}

export function appendMemberIdCondition(conditions, params, lookup, paramIndexRef) {
  if (!lookup) return paramIndexRef;
  if (lookup.mode === 'exact') {
    conditions.push(`s.member_id = $${paramIndexRef}`);
    params.push(lookup.value);
    return paramIndexRef + 1;
  }
  conditions.push(`s.member_id::text LIKE $${paramIndexRef}${LIKE_ESCAPE}`);
  params.push(lookup.pattern);
  return paramIndexRef + 1;
}

export function appendEmailCondition(conditions, params, lookup, paramIndexRef, columnExpr = 's.email') {
  if (!lookup) return paramIndexRef;
  if (lookup.mode === 'exact') {
    conditions.push(`${columnExpr} = $${paramIndexRef}`);
    params.push(lookup.value);
    return paramIndexRef + 1;
  }
  conditions.push(`LOWER(COALESCE(${columnExpr}, '')) LIKE $${paramIndexRef}${LIKE_ESCAPE}`);
  params.push(lookup.pattern);
  return paramIndexRef + 1;
}

export function appendAliasCondition(conditions, params, lookup, paramIndexRef) {
  if (!lookup) return paramIndexRef;
  if (lookup.mode === 'exact') {
    conditions.push(`LOWER(TRIM(s.alias)) = $${paramIndexRef}`);
    params.push(lookup.value);
    return paramIndexRef + 1;
  }
  conditions.push(`LOWER(TRIM(COALESCE(s.alias, ''))) LIKE $${paramIndexRef}${LIKE_ESCAPE}`);
  params.push(lookup.pattern);
  return paramIndexRef + 1;
}

export function appendPhoneCondition(conditions, params, lookup, paramIndexRef, columnExpr = 's.phone') {
  if (!lookup) return paramIndexRef;
  if (lookup.mode === 'exact') {
    conditions.push(`${columnExpr} = $${paramIndexRef}`);
    params.push(lookup.value);
    return paramIndexRef + 1;
  }
  conditions.push(
    `regexp_replace(COALESCE(${columnExpr}, ''), '[^0-9]', '', 'g') LIKE $${paramIndexRef}${LIKE_ESCAPE}`
  );
  params.push(lookup.pattern);
  return paramIndexRef + 1;
}
