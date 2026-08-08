/**
 * Site-wide font stack from MAIN_FONT (comma-separated names).
 * Example: MAIN_FONT=Comic Neue, Comic Sans MS
 *   → "Comic Neue", "Comic Sans MS", cursive
 * Source of truth: ~/.ssh/be/.env MAIN_FONT (mirrored in vite.config.mjs);
 * fe/.env MAIN_FONT is the fallback when be is unset.
 * Requires vite envPrefix MAIN_ (see vite.config.mjs).
 *
 * Runtime override: set CSS var --main-font-family (profile menu / config).
 * Components use MAIN_FONT_FAMILY so they follow the override.
 * Use ENV_MAIN_FONT_FAMILY when a surface must always match env MAIN_FONT.
 */

const DEFAULT_MAIN_FONT = 'Comic Neue, Comic Sans MS';
const DEFAULT_TERTIARY_FALLBACK = 'cursive';

export const MAIN_FONT_CSS_VAR = '--main-font-family';

function quoteFontName(name) {
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return '';
  return /\s/.test(trimmed) ? `"${trimmed}"` : trimmed;
}

/** @param {string | undefined} raw */
export function buildMainFontFamily(raw, tertiaryFallback = DEFAULT_TERTIARY_FALLBACK) {
  const parts = String(raw ?? DEFAULT_MAIN_FONT)
    .split(',')
    .map((part) => quoteFontName(part))
    .filter(Boolean);
  if (!parts.length) {
    return buildMainFontFamily(DEFAULT_MAIN_FONT, tertiaryFallback);
  }
  if (tertiaryFallback) parts.push(tertiaryFallback);
  return parts.join(', ');
}

/** Concrete stack from fe/.env MAIN_FONT (no CSS var). */
export const ENV_MAIN_FONT_FAMILY = buildMainFontFamily(import.meta.env.MAIN_FONT);

export function getMainFontFamily() {
  return ENV_MAIN_FONT_FAMILY;
}

/**
 * CSS font-family for body, nav, dialogs, buttons.
 * Follows runtime override via --main-font-family; falls back to env MAIN_FONT.
 */
export const MAIN_FONT_FAMILY = `var(${MAIN_FONT_CSS_VAR}, ${ENV_MAIN_FONT_FAMILY})`;

/** Apply stack on :root so MAIN_FONT_FAMILY (CSS var) updates site-wide. */
export function applyMainFontFamily(fontFamilyStack) {
  if (typeof document === 'undefined') return;
  const stack = String(fontFamilyStack || '').trim() || ENV_MAIN_FONT_FAMILY;
  document.documentElement.style.setProperty(MAIN_FONT_CSS_VAR, stack);
}

/**
 * Curated website fonts for the profile “Main Font for website” picker.
 * System names use platform fallbacks; google: loads that family when selected.
 */
/** Recommended / reset target — Comic Neue (matches fe/.env MAIN_FONT default). */
export const RECOMMENDED_MAIN_FONT_STACK = '"Comic Neue", "Comic Sans MS", cursive';

export const MAIN_FONT_OPTIONS = [
  {
    id: 'recommend-comic-neue',
    label: 'Default/Recommend (Comic Neue)',
    stack: RECOMMENDED_MAIN_FONT_STACK,
    google: 'Comic+Neue:wght@400;700',
    /** Yellow label in the profile font menu. */
    recommend: true
  },
  { id: 'comic-sans', label: 'Comic Sans MS', stack: '"Comic Sans MS", "Comic Sans", cursive' },
  { id: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'arial-black', label: 'Arial Black', stack: '"Arial Black", Gadget, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', stack: 'Helvetica, Arial, sans-serif' },
  { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
  { id: 'trebuchet', label: 'Trebuchet MS', stack: '"Trebuchet MS", Helvetica, sans-serif' },
  { id: 'calibri', label: 'Calibri', stack: 'Calibri, "Segoe UI", Candara, sans-serif' },
  { id: 'segoe', label: 'Segoe UI', stack: '"Segoe UI", Calibri, Tahoma, sans-serif' },
  { id: 'bahnschrift', label: 'Bahnschrift', stack: 'Bahnschrift, "Segoe UI", sans-serif' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'times', label: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
  { id: 'palatino', label: 'Palatino', stack: '"Palatino Linotype", Palatino, serif' },
  { id: 'garamond', label: 'Garamond', stack: 'Garamond, "Times New Roman", serif' },
  { id: 'courier', label: 'Courier New', stack: '"Courier New", Courier, monospace' },
  { id: 'impact', label: 'Impact', stack: 'Impact, Charcoal, sans-serif' },
  { id: 'algerian', label: 'Algerian', stack: 'Algerian, fantasy' },
  { id: 'inter', label: 'Inter', stack: '"Inter", system-ui, sans-serif', google: 'Inter:wght@400;600;700' },
  { id: 'poppins', label: 'Poppins', stack: '"Poppins", Helvetica, sans-serif', google: 'Poppins:wght@400;600;700' },
  { id: 'roboto', label: 'Roboto', stack: '"Roboto", Helvetica, Arial, sans-serif', google: 'Roboto:wght@400;500;700' }
];

const loadedGoogleFonts = new Set();

/** Ensure a Google Fonts stylesheet is present for options that need one. */
export function ensureMainFontStylesheet(optionOrStack) {
  if (typeof document === 'undefined') return;
  let google = null;
  if (optionOrStack && typeof optionOrStack === 'object') {
    google = optionOrStack.google || null;
  } else {
    const stack = String(optionOrStack || '');
    const match = MAIN_FONT_OPTIONS.find((o) => o.stack === stack);
    google = match?.google || null;
  }
  if (!google || loadedGoogleFonts.has(google)) return;
  loadedGoogleFonts.add(google);
  const id = `main-font-google-${google.replace(/[^a-zA-Z0-9]+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${google}&display=swap`;
  document.head.appendChild(link);
}

export function findMainFontOptionByStack(fontFamilyStack) {
  const stack = String(fontFamilyStack || '').trim();
  if (!stack) return MAIN_FONT_OPTIONS[0];
  return MAIN_FONT_OPTIONS.find((o) => o.stack === stack) || MAIN_FONT_OPTIONS[0];
}

/** Apply persisted override as early as this module loads (avoids MAIN_FONT flash). */
if (typeof document !== 'undefined') {
  try {
    const raw = window.localStorage.getItem('vsingles-config-vite-js');
    const parsed = raw ? JSON.parse(raw) : null;
    const stack = parsed?.fontFamily || ENV_MAIN_FONT_FAMILY;
    const option = findMainFontOptionByStack(stack);
    ensureMainFontStylesheet(option);
    applyMainFontFamily(option.stack);
  } catch {
    applyMainFontFamily(ENV_MAIN_FONT_FAMILY);
  }
}
