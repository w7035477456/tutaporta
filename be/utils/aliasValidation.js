export const ALIAS_ALNUM_ONLY_MESSAGE =
  'Nick name may only contain letters and numbers (no spaces or symbols).';

export const ALIAS_DOUBLED_WORD_MESSAGE =
  'Nickname cannot use the same word twice (e.g. SillySilly). Pick an adjective plus a different name.';

/** True when alias is WordWord with identical halves (SillySilly / QuirkyQuirky). */
export function isDoubledWordAlias(value) {
  const s = String(value ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (s.length < 4 || s.length % 2 !== 0) return false;
  const half = s.length / 2;
  return s.slice(0, half).toLowerCase() === s.slice(half).toLowerCase();
}

/** Case-insensitive key for singles.alias uniqueness lookups. */
export function normalizeAliasKey(alias) {
  return String(alias ?? '').trim().toLowerCase();
}

function titleCaseWord(word) {
  const w = String(word ?? '').trim();
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/**
 * "bubbl bob" -> "BubblBob", "giggle coco" -> "GiggleCoco".
 * Multi-word: title-case each word and concatenate. Single token: capitalize first letter only.
 */
export function formatAliasForSave(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const words = trimmed
    .split(/\s+/)
    .map((part) => String(part).replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length >= 2) {
    return words.map(titleCaseWord).join('').slice(0, 80);
  }
  const single = words[0];
  return (single.charAt(0).toUpperCase() + single.slice(1)).slice(0, 80);
}

/** Letters and digits only (A–Z, a–z, 0–9). */
export function isValidAliasFormat(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return false;
  return /^[A-Za-z0-9]+$/.test(trimmed);
}

export function cleanAlias(value) {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 80);
}

export function formatAliasTakenMessage(alias) {
  const name = cleanAlias(alias) || String(alias ?? '').trim();
  return `The alias ${name} is taken. Please add a number or choose different combinations`;
}
