import {
  SELF_INTRO_VIDEO_FAVORITE_EXTRA_KEYS,
  SELF_INTRO_VIDEO_FAVORITE_FORM_FIELDS
} from 'constants/selfIntroVideoFavoriteFields';
import { LIVE_FACE_SCAN_FAVORITE_BIO_SCRIPT_PHRASES } from 'constants/liveFaceScanFavoriteBioScriptPhrases';

const PLACEHOLDER_ALIASES = {
  '[Favorite drink]': '[Favorite drinks]',
  '[Favorite dessert]': '[Favorite desserts]',
  '[Favorite book(s)]': '[Favorite books]'
};

const PLACEHOLDER_BY_KEY = [
  ...SELF_INTRO_VIDEO_FAVORITE_FORM_FIELDS.filter((field) => field.placeholderKey).map(
    ({ key, placeholderKey, label }) => ({ key, placeholderKey, label })
  ),
  ...SELF_INTRO_VIDEO_FAVORITE_EXTRA_KEYS.map(({ key, placeholderKey }) => ({
    key,
    placeholderKey,
    label: placeholderKey.slice(1, -1)
  }))
];

function normalizeFavoriteValue(raw) {
  return String(raw ?? '').trim();
}

/** e.g. favorite_hobbies + "Tennis" → "Favorite hobbies Tennis" */
function formatLabeledFavoriteInsert(label, rawValue) {
  const value = normalizeFavoriteValue(rawValue);
  if (!value) return '';
  return `${String(label ?? '').trim()} ${value}`;
}

/** Build placeholder → value map from favorites keyed by misc_bio field names. */
export function buildSelfIntroPlaceholderMap(favorites = {}) {
  const map = {};
  for (const { key, placeholderKey, label } of PLACEHOLDER_BY_KEY) {
    map[placeholderKey] = formatLabeledFavoriteInsert(label, favorites[key]);
  }
  for (const [alias, target] of Object.entries(PLACEHOLDER_ALIASES)) {
    if (!map[alias] && map[target]) {
      map[alias] = map[target];
    }
  }
  return map;
}

export function fillSelfIntroScriptPhrase(body, favorites = {}) {
  const placeholders = buildSelfIntroPlaceholderMap(favorites);
  let filled = String(body ?? '');
  for (const [token, value] of Object.entries(placeholders)) {
    filled = filled.split(token).join(value || token);
  }
  return filled;
}

/**
 * @param {Record<string, string>} favorites
 * @returns {{ id: number, title: string, body: string, filledText: string }[]}
 */
export function buildFilledSelfIntroScriptPhrases(favorites = {}) {
  const highlightTerms = getSelfIntroFavoriteHighlightTerms(favorites);
  return LIVE_FACE_SCAN_FAVORITE_BIO_SCRIPT_PHRASES.map((phrase) => ({
    ...phrase,
    filledText: fillSelfIntroScriptPhrase(phrase.body, favorites),
    highlightTerms
  }));
}

export function pickRandomSelfIntroScriptPhrase(favorites = {}) {
  const phrases = buildFilledSelfIntroScriptPhrases(favorites);
  if (!phrases.length) return null;
  const index = Math.floor(Math.random() * phrases.length);
  return phrases[index];
}

export function validateSelfIntroFavoriteForm(favorites = {}) {
  const missing = SELF_INTRO_VIDEO_FAVORITE_FORM_FIELDS.filter(
    ({ key }) => !normalizeFavoriteValue(favorites[key])
  ).map(({ label }) => label);
  return { ok: missing.length === 0, missingLabels: missing };
}

/** Labeled favorite inserts in script phrases — longest first for highlighting. */
export function getSelfIntroFavoriteHighlightTerms(favorites = {}) {
  const placeholders = buildSelfIntroPlaceholderMap(favorites);
  const terms = [];
  const seen = new Set();
  for (const value of Object.values(placeholders)) {
    const normalized = normalizeFavoriteValue(value);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    terms.push(normalized);
  }
  return terms.sort((a, b) => b.length - a.length);
}
