/**
 * Parse TutaNotes search box input into the vault search API shape (q1/q2/q3 + op1/op2).
 *
 * Operators (with optional surrounding spaces):
 *   word1 & word2  → AND (both terms must match)
 *   word1 | word2  → OR  (either term may match)
 *
 * Up to three terms (API limit). No & / | → whole string is one phrase (legacy).
 * Left-to-right: term1 (op1 term2) (op2 term3).
 */

const EMPTY = Object.freeze({
  q1: '',
  q2: '',
  q3: '',
  op1: 'and',
  op2: 'and',
  terms: Object.freeze([])
});

function normalizeOpToken(raw) {
  const t = String(raw ?? '').trim();
  if (t === '|') return 'or';
  if (t === '&') return 'and';
  return null;
}

/**
 * @param {string} raw
 * @returns {{ q1: string, q2: string, q3: string, op1: 'and'|'or', op2: 'and'|'or', terms: string[] }}
 */
export function parseRecordVaultSearchQuery(raw) {
  const input = String(raw ?? '').trim();
  if (!input) return { ...EMPTY, terms: [] };

  if (!/[&|]/.test(input)) {
    return {
      q1: input,
      q2: '',
      q3: '',
      op1: 'and',
      op2: 'and',
      terms: [input]
    };
  }

  const chunks = input.split(/(\s*[&|]\s*)/);
  const terms = [];
  const ops = [];

  for (const chunk of chunks) {
    if (chunk === '') continue;
    const op = normalizeOpToken(chunk);
    if (op) {
      // Leading / doubled operators: ignore until we have a left-hand term.
      if (!terms.length) continue;
      // Extra op before the next term — keep the latest.
      if (ops.length >= terms.length) {
        ops[ops.length - 1] = op;
      } else {
        ops.push(op);
      }
      continue;
    }
    const term = String(chunk).trim();
    if (!term) continue;
    // Term without a preceding op (e.g. after a skipped leading |) — if we
    // already have a term and ops are short one, default the missing op to and.
    if (terms.length > 0 && ops.length < terms.length) {
      ops.push('and');
    }
    terms.push(term);
  }

  // Drop a trailing operator with no right-hand term.
  while (ops.length >= terms.length && ops.length) ops.pop();

  const cappedTerms = terms.slice(0, 3);
  const cappedOps = ops.slice(0, Math.max(0, cappedTerms.length - 1));

  return {
    q1: cappedTerms[0] || '',
    q2: cappedTerms[1] || '',
    q3: cappedTerms[2] || '',
    op1: cappedOps[0] === 'or' ? 'or' : 'and',
    op2: cappedOps[1] === 'or' ? 'or' : 'and',
    terms: cappedTerms
  };
}

/** True when haystack matches the parsed AND/OR chain (case-insensitive substring). */
export function haystackMatchesRecordVaultSearchQuery(haystack, parsed) {
  const hay = String(haystack ?? '').toLowerCase();
  const terms = Array.isArray(parsed?.terms)
    ? parsed.terms
    : [parsed?.q1, parsed?.q2, parsed?.q3].filter(Boolean);
  const cleaned = terms.map((t) => String(t ?? '').trim().toLowerCase()).filter(Boolean);
  if (!cleaned.length) return false;

  let result = hay.includes(cleaned[0]);
  for (let i = 1; i < cleaned.length; i += 1) {
    const op = i === 1 ? parsed?.op1 : parsed?.op2;
    const next = hay.includes(cleaned[i]);
    result = String(op || 'and').toLowerCase() === 'or' ? result || next : result && next;
  }
  return result;
}
