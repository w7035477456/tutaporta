/** Container with a white / light background inside a dark theme page. */
export const LIGHT_SURFACE_CLASS = 'theme-light-surface';

/** Container with a themed (e.g. secondary) background — keeps white copy on dark themes. */
export const DARK_SURFACE_CLASS = 'theme-on-dark-surface';

export const TEXT_ON_LIGHT_BG_VAR = '--theme-text-on-light-bg';

/** Black copy on white panels (dark themes). Set in themeConfig.applyThemeColors. */
export const TEXT_ON_LIGHT_BG_CSS = `var(${TEXT_ON_LIGHT_BG_VAR}, #000000)`;
