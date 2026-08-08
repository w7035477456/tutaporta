/**
 * Default theme display name from fe/.env DEFAULT_THEME (logged-out users + fallbacks).
 * Must match a theme row name in themeConfig (case-insensitive via findThemeByName).
 * Example: DEFAULT_THEME=Ocean light
 * Requires vite envPrefix DEFAULT_ (see vite.config.mjs).
 */

const HARDCODED_FALLBACK = 'Coffey Dark';

/** @returns {string} */
export function getDefaultThemeName() {
  const trimmed = String(import.meta.env.DEFAULT_THEME ?? '').trim();
  return trimmed || HARDCODED_FALLBACK;
}

export const DEFAULT_THEME_NAME = getDefaultThemeName();
