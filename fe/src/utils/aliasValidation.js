export const ALIAS_ALNUM_ONLY_MESSAGE =
  'Nick name may only contain letters and numbers (no spaces or symbols).';

function titleCaseWord(word) {
  const w = String(word ?? '').trim();
  if (!w) return '';
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

export const titleCaseWordForAlias = titleCaseWord;

/** Remove spaces and punctuation; keep letters, digits, and user casing. */
export function sanitizeAliasForSave(value) {
  return String(value ?? '')
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, 80);
}

/** Append a suggestion click onto the current nickname text. */
export function appendAliasSuggestionClick(currentValue, word) {
  const piece = String(word ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (!piece) return String(currentValue ?? '');
  return (String(currentValue ?? '') + titleCaseWord(piece)).slice(0, 80);
}

/** Combine two suggestion clicks: "bubbly" + "bob" -> "BubblyBob". */
export function formatAliasFromClickPair(word1, word2) {
  const w1 = String(word1 ?? '').replace(/[^A-Za-z0-9]/g, '');
  const w2 = String(word2 ?? '').replace(/[^A-Za-z0-9]/g, '');
  if (!w1 || !w2) return titleCaseWord(w1 || w2);
  return (titleCaseWord(w1) + titleCaseWord(w2)).slice(0, 80);
}

/** Format nickname built from suggestion clicks (one or two words). */
export function formatAliasFromClicks(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  const words = trimmed
    .split(/\s+/)
    .map((part) => String(part).replace(/[^A-Za-z0-9]/g, ''))
    .filter(Boolean);
  if (words.length === 0) return '';
  if (words.length >= 2) {
    return formatAliasFromClickPair(words[0], words[1]);
  }
  return titleCaseWord(words[0]).slice(0, 80);
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

/** True when raw input can be formatted into a valid alias (allows spaces between words). */
export function isValidAliasInput(value) {
  const formatted = sanitizeAliasForSave(value);
  return formatted.length > 0 && isValidAliasFormat(formatted);
}

export function formatAliasTakenMessage(alias) {
  const name = String(alias ?? '').trim();
  return `The alias ${name} is taken. Please add a number or choose different combinations`;
}
