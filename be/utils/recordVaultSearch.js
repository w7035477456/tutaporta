const NOTE_BODY_V2_PREFIX = '\u2063RV2';

function stripRecordVaultHtmlForSearch(text) {
  return String(text ?? '').replace(/<[^>]+>/g, ' ');
}

/**
 * Lowercase / collapse whitespace for full-note search haystacks.
 * Unlike normalizeRecordVaultKeyword, this must NOT truncate — otherwise body
 * matches past the first ~80 characters are missed, and (worse) raw HTML/base64
 * fragments in that window can produce false positives (e.g. PNG `...goAAAA...`).
 */
function normalizeRecordVaultSearchHaystack(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** Plain text from note body for substring search (unwraps v2 JSON segments). */
export function expandRecordVaultBodyTextForSearch(bodyText) {
  const raw = String(bodyText ?? '');
  if (raw.startsWith(NOTE_BODY_V2_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(NOTE_BODY_V2_PREFIX.length));
      return [parsed.before, parsed.afterTop, parsed.afterCenter, parsed.afterBottom]
        .map((part) => stripRecordVaultHtmlForSearch(part).trim())
        .filter(Boolean)
        .join(' ');
    } catch {
      // fall through to legacy body text
    }
  }
  // Always strip tags so data:image/...;base64,... in <img src> is not searchable.
  return stripRecordVaultHtmlForSearch(raw);
}

/** Evaluate left-to-right: term1 (op1 term2) (op2 term3). Empty terms are skipped. */
export function evaluateRecordVaultSearchChain(chain, noteMatchesTerm) {
  const parts = Array.isArray(chain) ? chain.filter((p) => String(p?.term ?? '').trim()) : [];
  if (!parts.length) return true;
  let result = noteMatchesTerm(parts[0].term);
  for (let i = 1; i < parts.length; i += 1) {
    const op = String(parts[i].op ?? 'and').toLowerCase() === 'or' ? 'or' : 'and';
    const next = noteMatchesTerm(parts[i].term);
    result = op === 'or' ? result || next : result && next;
  }
  return result;
}

export function noteMatchesRecordVaultSearchTerm(note, notebookName, term) {
  const normalized = normalizeRecordVaultKeyword(term);
  if (!normalized) return true;
  const keywords = Array.isArray(note?.keywords) ? note.keywords : [];
  if (keywords.some((kw) => normalizeRecordVaultKeyword(kw) === normalized)) return true;
  if (keywords.some((kw) => normalizeRecordVaultKeyword(kw).includes(normalized))) return true;
  // Search only the note itself — title, body, and keywords. Notebook names are
  // intentionally excluded so a notebook-name match never surfaces its notes.
  const hay = normalizeRecordVaultSearchHaystack(
    [
      stripRecordVaultHtmlForSearch(note?.note_name),
      expandRecordVaultBodyTextForSearch(note?.body_text),
      ...keywords
    ]
      .filter(Boolean)
      .join(' ')
  );
  return hay.includes(normalized);
}

export function buildRecordVaultSearchChain(q1, q2, q3, op1, op2) {
  const t1 = String(q1 ?? '').trim();
  const t2 = String(q2 ?? '').trim();
  const t3 = String(q3 ?? '').trim();
  const chain = [];
  if (t1) chain.push({ term: t1 });
  if (t2) {
    chain.push({ term: t2, op: op1 });
    if (t3) chain.push({ term: t3, op: op2 });
  } else if (t3) {
    chain.push({ term: t3, op: op1 });
  }
  return chain;
}

/** Normalize keyword for dedupe + search. */
export function normalizeRecordVaultKeyword(raw) {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}
