import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';

/**
 * colorTemplate4Titles
 * Sidebar decorative cursive phrase (MenuList) — primary text on day/night panel.
 * Reuse via COLOR_TEMPLATE4_TITLES_* or colorTemplate4TitlesMatchSx().
 *
 * Match css color to ColorTemplate4Titles:
 *   sx={{ ...colorTemplate4TitlesMatchSx(), ...yourLayout }}
 */

/** Panel / block background (sidebar nav panel, site footer). */
export const COLOR_TEMPLATE4_TITLES_BG = 'var(--theme-daynight-color)';

/** Phrase / footer text color. */
export const COLOR_TEMPLATE4_TITLES_TEXT = 'var(--theme-primary-color)';

export const COLOR_TEMPLATE4_TITLES_FONT_FAMILY = 'Zapfino, "Snell Roundhand", cursive';

/** Only bgcolor + color — spread into any sx to match the sidebar phrase / footer. */
export function colorTemplate4TitlesMatchSx() {
  return {
    bgcolor: COLOR_TEMPLATE4_TITLES_BG,
    color: COLOR_TEMPLATE4_TITLES_TEXT,
    '& .MuiTypography-root': { color: COLOR_TEMPLATE4_TITLES_TEXT },
    '& a': { color: COLOR_TEMPLATE4_TITLES_TEXT },
    '& button': { color: COLOR_TEMPLATE4_TITLES_TEXT }
  };
}

/** Container for sidebar phrase — height comes from leftover flex space below the menu. */
export function colorTemplate4TitlesPhraseBoxSx(overrides = {}) {
  return {
    ...colorTemplate4TitlesMatchSx(),
    width: '100%',
    height: '100%',
    boxSizing: 'border-box',
    px: { xs: 1.5, sm: 2 },
    mt: { xs: 1, sm: 1.25 },
    mb: { xs: 0.75, sm: 1 },
    py: { xs: 0.75, sm: 1 },
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    minWidth: 0,
    ...overrides
  };
}

/** Phrase copy — fontSize set dynamically by ColorTemplate4TitlesPhrase. */
export function colorTemplate4TitlesPhraseTextSx(overrides = {}) {
  return {
    color: COLOR_TEMPLATE4_TITLES_TEXT,
    WebkitTextFillColor: COLOR_TEMPLATE4_TITLES_TEXT,
    textAlign: 'center',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    fontFamily: COLOR_TEMPLATE4_TITLES_FONT_FAMILY,
    lineHeight: 1.35,
    width: '100%',
    ...overrides
  };
}

/** @deprecated Use colorTemplate4TitlesPhraseBoxSx + ColorTemplate4TitlesPhrase */
export function colorTemplate4TitlesPhraseSx() {
  return {
    ...colorTemplate4TitlesPhraseBoxSx(),
    ...colorTemplate4TitlesPhraseTextSx(),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() }
  };
}
