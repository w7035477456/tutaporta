import { DEFAULT_THEME_NAME } from '../config/defaultThemeEnv';

/** Display name — matches theme dropdown labels and findThemeByName(). From fe/.env DEFAULT_THEME. */
export const DEFAULT_NEW_USER_THEME_NAME = DEFAULT_THEME_NAME;

/**
 * Global palette mode for the profile Color Theme picker.
 * true  → Full Paletes (all theme families)
 * false → Minimal Palete (curated subset)
 * Persisted in localStorage; mutate via setColorFullPalete().
 */
export let COLOR_FULL_PALETE = false;

const COLOR_FULL_PALETE_LS_KEY = 'vsingles:color-full-palete';

/** Curated subset shown when COLOR_FULL_PALETE is false. */
const MINIMAL_THEME_ROWS = [
  'Gold Light, #B5A002,#F6E358,#FFFFFF,#F0F0F0,#000000',
  'Lavender Light, #A849EF,#C5BAE2,#FFFFFF,#F0F0F0,#000000',
  'Flamingo Light, #CC1160,#FFB8EC,#FFFFFF,#F0F0F0,#000000',
  'Turquoise Light, #00CED1,#B3FFFF,#FFFFFF,#F0F0F0,#000000',
  'Coffey light, #9F211E,#A8807F,#FFFFFF,#F0F0F0,#000000',
  'Ocean light, #155181,#86D9FE,#FFFFFF,#F0F0F0,#000000',
  'Chrome Light, #000000,#C4C9CB,#FFFFFF,#F0F0F0,#000000',

  'Gold Dark, #F6E358,#B5A002,#000000,#282727,#FFFFFF',
  'Lavender Dark, #C5BAE2,#A849EF,#000000,#282727,#FFFFFF',
  'Flamingo Dark, #FFB8EC,#CC1160,#000000,#282727,#FFFFFF',
  'Turquoise Dark, #B3FFFF,#00CED1,#000000,#282727,#FFFFFF',
  'Coffey Dark, #A8807F,#9F211E,#000000,#282727,#FFFFFF',
  'Ocean Dark, #86D9FE,#155181,#000000,#282727,#FFFFFF',
  'Chrome Dark, #C4C9CB,#63686A,#000000,#282727,#FFFFFF'
];

/** Full palette — minimal families plus extra Light/Dark pairs. */
const FULL_THEME_ROWS = [
  'Yellow Light, #E78C28,#FBF4B5,#FFFFFF,#F0F0F0,#000000',
  'Gold Light, #B5A002,#F6E358,#FFFFFF,#F0F0F0,#000000',
  'Lavender Light, #A849EF,#C5BAE2,#FFFFFF,#F0F0F0,#000000',
  'Flamingo Light, #CC1160,#FFB8EC,#FFFFFF,#F0F0F0,#000000',
  'Turquoise Light, #00CED1,#B3FFFF,#FFFFFF,#F0F0F0,#000000',
  'Red light, #E80808,#F2B3B3,#FFFFFF,#F0F0F0,#000000',
  'Coffey light, #9F211E,#A8807F,#FFFFFF,#F0F0F0,#000000',
  'Ocean light, #155181,#86D9FE,#FFFFFF,#F0F0F0,#000000',
  'Chrome Light, #000000,#C4C9CB,#FFFFFF,#F0F0F0,#000000',

  'Yellow Dark, #FBF4B5,#E78C28,#000000,#282727,#FFFFFF',
  'Gold Dark, #F6E358,#B5A002,#000000,#282727,#FFFFFF',
  'Lavender Dark, #C5BAE2,#A849EF,#000000,#282727,#FFFFFF',
  'Flamingo Dark, #FFB8EC,#CC1160,#000000,#282727,#FFFFFF',
  'Turquoise Dark, #B3FFFF,#00CED1,#000000,#282727,#FFFFFF',
  'Red Dark, #F2B3B3,#E80808,#000000,#282727,#FFFFFF',
  'Coffey Dark, #A8807F,#9F211E,#000000,#282727,#FFFFFF',
  'Ocean Dark, #86D9FE,#155181,#000000,#282727,#FFFFFF',
  'Chrome Dark, #C4C9CB,#63686A,#000000,#282727,#FFFFFF',
  'Silver Dark, #63686A,#C4C9CB,#000000,#282727,#FFFFFF'
];

/** @deprecated Use getThemeOptionsFromEnv() — kept as alias of the active row set. */
const DEFAULT_THEME_ROWS = MINIMAL_THEME_ROWS;

function readStoredColorFullPalete() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(COLOR_FULL_PALETE_LS_KEY);
    if (raw == null) return false;
    return raw === '1' || String(raw).toLowerCase() === 'true';
  } catch {
    return false;
  }
}

/** Sync module-level COLOR_FULL_PALETE from localStorage (call once on app load). */
export function hydrateColorFullPalete() {
  COLOR_FULL_PALETE = readStoredColorFullPalete();
  return COLOR_FULL_PALETE;
}

if (typeof window !== 'undefined') {
  hydrateColorFullPalete();
}

/**
 * Tutorial persona / AI readout voice (photo-albums context tutorial).
 * Display personas: Sora, Jessica, Michael. Baked m4a: pa_context_tutorial_{mode}_{Persona}.m4a
 * Legacy Gemini TTS ids (Sulafat/Achernar/Enceladus) map to the personas above.
 * Persisted in localStorage; mutate via setAiVoice().
 */
export const AI_VOICE_OPTIONS = ['Sora', 'Jessica', 'Michael'];
export const AI_VOICE_DEFAULT = 'Sora';
export let AI_VOICE = AI_VOICE_DEFAULT;

/** Old Gemini TTS voice ids → display personas (localStorage / BroadcastChannel migration). */
const AI_VOICE_LEGACY_MAP = {
  Sulafat: 'Sora',
  Achernar: 'Jessica',
  Enceladus: 'Michael'
};

const AI_VOICE_LS_KEY = 'vsingles:ai-voice';
export const AI_VOICE_CHANGE_EVENT = 'vsingles:ai-voice';

function normalizeAiVoice(value) {
  const name = String(value || '').trim();
  if (AI_VOICE_OPTIONS.includes(name)) return name;
  if (AI_VOICE_LEGACY_MAP[name]) return AI_VOICE_LEGACY_MAP[name];
  return AI_VOICE_DEFAULT;
}

function readStoredAiVoice() {
  if (typeof window === 'undefined') return AI_VOICE_DEFAULT;
  try {
    const raw = localStorage.getItem(AI_VOICE_LS_KEY);
    const next = normalizeAiVoice(raw);
    // Persist migrated persona when an old Gemini id was stored.
    if (raw && next !== raw) {
      try {
        localStorage.setItem(AI_VOICE_LS_KEY, next);
      } catch {
        // ignore
      }
    }
    return next;
  } catch {
    return AI_VOICE_DEFAULT;
  }
}

/** Sync module-level AI_VOICE from localStorage (call once on app load). */
export function hydrateAiVoice() {
  AI_VOICE = readStoredAiVoice();
  return AI_VOICE;
}

if (typeof window !== 'undefined') {
  hydrateAiVoice();
}

export function getAiVoice() {
  return normalizeAiVoice(AI_VOICE);
}

export function setAiVoice(voice) {
  AI_VOICE = normalizeAiVoice(voice);
  if (typeof window === 'undefined') return AI_VOICE;
  try {
    localStorage.setItem(AI_VOICE_LS_KEY, AI_VOICE);
  } catch {
    // ignore quota / private mode
  }
  try {
    window.dispatchEvent(new CustomEvent(AI_VOICE_CHANGE_EVENT, { detail: { voice: AI_VOICE } }));
  } catch {
    // ignore
  }
  // Keep photo-albums tutorial pop-out in sync (same channel as mode).
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('pa-context-tutorial');
      ch.postMessage({ type: 'voice', voice: AI_VOICE });
      ch.close();
    }
  } catch {
    // ignore
  }
  return AI_VOICE;
}

export const PRIMARY_VAR = '--theme-primary-color';
export const SECONDARY_VAR = '--theme-secondary-color';
export const DAYNIGHT_VAR = '--theme-daynight-color';
export const DAYNIGHT2_VAR = '--theme-daynight2-color';
export const INVERSE_DAYNIGHT_VAR = '--theme-inverse-daynight-color';
export const DAYLIGHT_VAR = '--theme-daylight-color';
export const INVERSE_DAYLIGHT_VAR = '--theme-inverse-daylight-color';

/** Current `--theme-daylight-color` from the document root (editor letterbox / crop fill). */
export function readThemeDaylightColor(fallback = '#FFFFFF') {
  if (typeof document === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(DAYLIGHT_VAR).trim();
  return raw || fallback;
}

export const ERROR_VAR = '--theme-error-color';
const ERROR_COLOR_VALUE = '#c62828';

export const GREEN_VAR = '--theme-green-color';
const GREEN_COLOR_VALUE = '#C8E6C9';

export const WHITE_VAR = '--theme-white-color';
const WHITE_COLOR_VALUE = '#FFFFFF';

export const YELLOW_VAR = '--theme-yellow-color';
const YELLOW_COLOR_VALUE = '#FFEB3B';
/** Green action buttons (Template, Search, Add Album, GreenButton, etc.). */
export const ACTION_GREEN_VAR = '--theme-action-green-color';
const ACTION_GREEN_COLOR_VALUE = '#60C446';
export const ON_LIGHT_SURFACE_VAR = '--theme-on-light-surface-color';
export const TEXT_ON_LIGHT_BG_VAR = '--theme-text-on-light-bg';

/**
 * Palette chrome CSS vars:
 * - Full Paletes → fixed yellow + green action colors
 * - Minimal Palete → both track `var(--theme-secondary-color)`
 *   (File / staging yellow; Add Album / Search / Template / Invite greens).
 */
export function applyYellowChromeColor(_secondaryColor = null) {
  if (typeof document === 'undefined') return;
  const chrome = COLOR_FULL_PALETE ? null : `var(${SECONDARY_VAR})`;
  document.documentElement.style.setProperty(YELLOW_VAR, chrome || YELLOW_COLOR_VALUE);
  document.documentElement.style.setProperty(ACTION_GREEN_VAR, chrome || ACTION_GREEN_COLOR_VALUE);
  document.documentElement.setAttribute('data-color-palete', COLOR_FULL_PALETE ? 'full' : 'minimal');
}

/** Set Full vs Minimal palette mode and persist. Refreshes chrome colors immediately. */
export function setColorFullPalete(full) {
  COLOR_FULL_PALETE = Boolean(full);
  if (typeof window === 'undefined') return COLOR_FULL_PALETE;
  try {
    localStorage.setItem(COLOR_FULL_PALETE_LS_KEY, COLOR_FULL_PALETE ? '1' : '0');
  } catch {
    // ignore quota / private mode
  }
  applyYellowChromeColor();
  return COLOR_FULL_PALETE;
}

export function getColorFullPalete() {
  return Boolean(COLOR_FULL_PALETE);
}

export function isBlackColor(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === '#000' || raw === '#000000' || raw === 'black') return true;
  const nums = raw.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 3) return false;
  const [r, g, b] = nums.slice(0, 3).map((n) => Number(n));
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && r === 0 && g === 0 && b === 0;
}

export function isWhiteColor(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase();
  if (raw === '#fff' || raw === '#ffffff' || raw === 'white') return true;
  const nums = raw.match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 3) return false;
  const [r, g, b] = nums.slice(0, 3).map((n) => Number(n));
  return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) && r === 255 && g === 255 && b === 255;
}

/**
 * Yellow chrome (sidebar menu / Exit, My Story editor): default white labels on yellow.
 * Silver Dark exception: use theme primary (gray) for readable contrast on yellow.
 */
export function yellowChromeForeground(themeName) {
  if (themeName != null && String(themeName).trim().toLowerCase() === 'silver dark') {
    return 'var(--theme-primary-color)';
  }
  return 'var(--theme-white-color)';
}

/** Use for sx color/bgcolor: follows selected theme from .env */
export const PRIMARY_COLOR_CSS = `var(${PRIMARY_VAR})`;
/** Use for sx: fixed error red */
export const ERROR_COLOR_CSS = `var(${ERROR_VAR})`;
/** Use for sx: fixed green */
export const GREEN_COLOR_CSS = `var(${GREEN_VAR})`;

function parseThemeRow(row, fallbackName) {
  if (!row || typeof row !== 'string') return null;
  const [nameRaw, primaryRaw, secondaryRaw, dayNightRaw, dayNight2Raw, inverseDayNightRaw] = row
    .split(',')
    .map((p) => p?.trim());
  if (!nameRaw || !primaryRaw || !secondaryRaw) return null;
  const dayNightColor = dayNightRaw || '#FFFFFF';
  const dayNight2Color = dayNight2Raw || dayNightColor;
  const inverseDayNightColor =
    inverseDayNightRaw || (isBlackColor(dayNightColor) ? '#FFFFFF' : '#000000');
  return {
    name: nameRaw || fallbackName,
    primaryColor: primaryRaw,
    secondaryColor: secondaryRaw,
    dayNightColor,
    dayNight2Color,
    inverseDayNightColor
  };
}

export function getThemeOptionsFromEnv() {
  const rowsToParse = COLOR_FULL_PALETE ? FULL_THEME_ROWS : MINIMAL_THEME_ROWS;
  const parsed = rowsToParse
    .map((row, index) => parseThemeRow(row, `Theme ${index + 1}`))
    .filter(Boolean);

  return parsed.length > 0
    ? parsed
    : DEFAULT_THEME_ROWS.map((row, index) => parseThemeRow(row, `Theme ${index + 1}`)).filter(Boolean);
}

export function findThemeByName(name, options = getThemeOptionsFromEnv()) {
  if (!name) return null;
  return options.find((theme) => theme.name.toLowerCase() === String(name).toLowerCase()) || null;
}

/** True for themes in the dark series (e.g. Purple Dark, Yellow Dark). */
export function isDarkThemeName(name) {
  return /\bdark$/i.test(String(name ?? '').trim());
}

/** True for themes in the light series (e.g. Purple Light, Blue Light). */
export function isLightThemeName(name) {
  return /\blight$/i.test(String(name ?? '').trim());
}

/** Matching light-series name for a dark theme (e.g. Purple Dark → Purple Light, Red Dark → Red light). */
export function getLightThemeCounterpart(darkName, options = getThemeOptionsFromEnv()) {
  if (!isDarkThemeName(darkName)) return null;
  const family = String(darkName)
    .replace(/\s*dark\s*$/i, '')
    .trim();
  if (!family) return null;
  const candidates = [`${family} Light`, `${family} light`];
  for (const candidate of candidates) {
    const match = findThemeByName(candidate, options);
    if (match) return match.name;
  }
  const familyLower = family.toLowerCase();
  const fallback = options.find(
    (theme) => theme.name.toLowerCase().startsWith(familyLower) && !isDarkThemeName(theme.name)
  );
  return fallback?.name ?? null;
}

export function isFlowerShopPath(pathname) {
  return pathname === '/send-flower' || pathname === '/eMarketPlace/flowerShop';
}

export function applyThemeColors(
  primaryColor,
  secondaryColor,
  dayNightColor = '#FFFFFF',
  dayNight2Color = null,
  inverseDayNightColor = null
) {
  if (typeof document === 'undefined') return;
  const dn = (dayNightColor != null && String(dayNightColor).trim()) || '#FFFFFF';
  const dn2 = (dayNight2Color != null && String(dayNight2Color).trim()) || dn;
  const inverseDn =
    (inverseDayNightColor != null && String(inverseDayNightColor).trim()) ||
    (isBlackColor(dn) ? '#FFFFFF' : '#000000');
  document.documentElement.style.setProperty(PRIMARY_VAR, primaryColor);
  document.documentElement.style.setProperty(SECONDARY_VAR, secondaryColor);
  document.documentElement.style.setProperty(DAYNIGHT_VAR, dn);
  document.documentElement.style.setProperty(DAYNIGHT2_VAR, dn2);
  document.documentElement.style.setProperty(INVERSE_DAYNIGHT_VAR, inverseDn);
  document.documentElement.style.setProperty(DAYLIGHT_VAR, dn2);
  document.documentElement.style.setProperty(
    INVERSE_DAYLIGHT_VAR,
    isBlackColor(dn2) ? '#FFFFFF' : '#000000'
  );
  document.documentElement.style.setProperty(ERROR_VAR, ERROR_COLOR_VALUE);
  document.documentElement.style.setProperty(GREEN_VAR, GREEN_COLOR_VALUE);
  document.documentElement.style.setProperty(WHITE_VAR, WHITE_COLOR_VALUE);
  // Minimal Palete: yellow chrome areas use theme secondary; Full keeps fixed yellow.
  applyYellowChromeColor(secondaryColor);
  const onLightSurfaceColor = isWhiteColor(primaryColor) ? secondaryColor : primaryColor;
  document.documentElement.style.setProperty(ON_LIGHT_SURFACE_VAR, onLightSurfaceColor);
  const textOnLightBg = isBlackColor(dn) ? '#000000' : inverseDn;
  document.documentElement.style.setProperty(TEXT_ON_LIGHT_BG_VAR, textOnLightBg);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta && primaryColor) meta.setAttribute('content', primaryColor);
  document.documentElement.setAttribute('data-theme-surface', isBlackColor(dn) ? 'dark' : 'light');
}

export function applyThemeByName(name, options = getThemeOptionsFromEnv()) {
  const selected = findThemeByName(name, options) || options[0];
  if (!selected) return null;
  applyThemeColors(
    selected.primaryColor,
    selected.secondaryColor,
    selected.dayNightColor,
    selected.dayNight2Color,
    selected.inverseDayNightColor
  );
  return selected;
}

const THEME_CHOICE_LS_KEY = 'vsingles:theme-choice';

/** Last theme chosen in-session — survives menu navigation before SWR refetch. */
export function readStoredThemeChoice(options = getThemeOptionsFromEnv()) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(THEME_CHOICE_LS_KEY);
    if (!raw?.trim()) return null;
    return findThemeByName(raw.trim(), options)?.name ?? null;
  } catch {
    return null;
  }
}

export function persistThemeChoice(name) {
  if (typeof window === 'undefined') return;
  const trimmed = String(name ?? '').trim();
  if (!trimmed) return;
  try {
    localStorage.setItem(THEME_CHOICE_LS_KEY, trimmed);
  } catch {
    // ignore quota / private mode
  }
}

/** Map DB/local theme string to a known theme option name. */
export function resolveThemePreferenceName(name, options = getThemeOptionsFromEnv()) {
  const match = findThemeByName(name, options);
  if (match) return match.name;
  return findThemeByName(DEFAULT_NEW_USER_THEME_NAME, options)?.name || DEFAULT_NEW_USER_THEME_NAME;
}

