import { ENV_MAIN_FONT_FAMILY } from 'config/mainFontEnv';

export const DASHBOARD_PATH = '/allSingles';
export const DEFAULT_THEME_MODE = 'system';

export const CSS_VAR_PREFIX = '';

const config = {
  /** Concrete stack; runtime override of fe/.env MAIN_FONT (profile menu). */
  fontFamily: ENV_MAIN_FONT_FAMILY,
  borderRadius: 8,
  pageZoom: 100
};

export default config;
