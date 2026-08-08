/**
 * myNote menu / toolbar button font size — yellow slider on /myNote.
 * Default from NOTES_DEFAULT_BUTTON_FONT_SIZE_REM; user value in user_customization.mynote_font_size.
 */
import { getVaultDefaultButtonFontSizeRem } from 'config/vaultDefaultButtonFontSizeEnv';

export const RECORD_VAULT_MENU_BUTTON_FONT_REM_VAR = '--rv-menu-btn-font-rem';
export const RECORD_VAULT_MENU_BUTTON_FONT_REM_MIN_FACTOR = 0.25;
export const RECORD_VAULT_MENU_BUTTON_FONT_REM_MAX_FACTOR = 2;
export const RECORD_VAULT_MENU_BUTTON_FONT_REM_STEP = 0.05;

/** @deprecated localStorage cache key — prefer user_customization.mynote_font_size */
export const RECORD_VAULT_MENU_BUTTON_FONT_SCALE_LS_KEY = 'recordVaultMenuButtonFontScale';

export function recordVaultMenuButtonFontRemBounds(defaultRem = getVaultDefaultButtonFontSizeRem()) {
  const base = Number.isFinite(defaultRem) && defaultRem > 0 ? defaultRem : getVaultDefaultButtonFontSizeRem();
  return {
    min: base * RECORD_VAULT_MENU_BUTTON_FONT_REM_MIN_FACTOR,
    max: base * RECORD_VAULT_MENU_BUTTON_FONT_REM_MAX_FACTOR,
    defaultRem: base
  };
}

export function clampRecordVaultMenuButtonFontRem(value, defaultRem = getVaultDefaultButtonFontSizeRem()) {
  const { min, max } = recordVaultMenuButtonFontRemBounds(defaultRem);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultRem;
  return Math.min(max, Math.max(min, parsed));
}

/** DB smallint tenths-of-rem → slider rem (null → env default). */
export function recordVaultMenuButtonFontRemFromTenths(tenths, defaultRem = getVaultDefaultButtonFontSizeRem()) {
  if (tenths == null || tenths === '') return clampRecordVaultMenuButtonFontRem(defaultRem, defaultRem);
  const n = Number(tenths);
  if (!Number.isFinite(n) || n <= 0) return clampRecordVaultMenuButtonFontRem(defaultRem, defaultRem);
  return clampRecordVaultMenuButtonFontRem(n / 10, defaultRem);
}

/** Slider rem → DB smallint tenths-of-rem. */
export function recordVaultMenuButtonFontRemToTenths(rem) {
  const clamped = clampRecordVaultMenuButtonFontRem(rem);
  return Math.round(clamped * 10);
}

export function recordVaultMenuButtonFontRemVarSx(rem) {
  return {
    [RECORD_VAULT_MENU_BUTTON_FONT_REM_VAR]: clampRecordVaultMenuButtonFontRem(rem)
  };
}

/** Shell sx: set CSS var + force all myNote buttons to use it (beats GreenButton bsize vw @media). */
export function recordVaultMenuButtonFontShellSx(rem) {
  const fontSize = `${menuButtonRemExpr()}rem !important`;
  const labelRule = { fontSize, lineHeight: '1.15 !important' };
  const buttonRule = {
    fontSize,
    lineHeight: '1.15 !important',
    '& .MuiButton-label': labelRule
  };
  const descendantRules = {
    '&& .MuiButton-root': buttonRule,
    '&& .MuiButton-root.MuiButton-sizeSmall': buttonRule,
    '&& .MuiButton-label': labelRule,
    '&& [role="button"]': labelRule,
    '&& [role="button"] > span': labelRule,
    '&& button': labelRule
  };
  return {
    ...recordVaultMenuButtonFontRemVarSx(rem),
    ...descendantRules,
    '@media (min-width: 600px)': descendantRules,
    '@media (max-width: 599.95px)': descendantRules
  };
}

function menuButtonRemExpr() {
  return `var(${RECORD_VAULT_MENU_BUTTON_FONT_REM_VAR}, ${getVaultDefaultButtonFontSizeRem()})`;
}

export function recordVaultMenuButtonRemFontSize(important = true) {
  const imp = important ? ' !important' : '';
  return `${menuButtonRemExpr()}rem${imp}`;
}

/** Spread font rules onto all selectors GreenButton bsize uses (!important), including sm+ media. */
export function recordVaultBeatGreenButtonFontSx(fontSx) {
  const fontSize = fontSx.fontSize;
  const lineHeight = fontSx.lineHeight ?? 1.15;
  const labelBlock = fontSx['& .MuiButton-label'];
  const labelFont = {
    fontSize,
    lineHeight,
    ...(labelBlock && typeof labelBlock === 'object' ? labelBlock : {})
  };
  const rootBlock = {
    fontSize,
    lineHeight,
    '& .MuiButton-label': labelFont,
    ...(fontSx['&.MuiButton-root'] && typeof fontSx['&.MuiButton-root'] === 'object'
      ? fontSx['&.MuiButton-root']
      : {})
  };
  const smMedia = {
    fontSize,
    lineHeight,
    '&.MuiButton-root': { ...rootBlock },
    '&.MuiButton-sizeSmall': { fontSize, lineHeight },
    '& .MuiButton-label': { ...labelFont }
  };
  return {
    ...fontSx,
    ...rootBlock,
    '&.MuiButton-root': { ...rootBlock, ...(fontSx['&.MuiButton-root'] || {}) },
    '&.MuiButton-sizeSmall': {
      fontSize,
      lineHeight,
      ...(fontSx['&.MuiButton-sizeSmall'] || {})
    },
    '& .MuiButton-label': labelFont,
    '@media (min-width: 600px)': {
      ...smMedia,
      ...(typeof fontSx['@media (min-width: 600px)'] === 'object'
        ? fontSx['@media (min-width: 600px)']
        : {})
    }
  };
}

/** Unified myNote button label font — all green / menu buttons use env rem + slider. */
export function recordVaultMenuButtonRemFontSx() {
  const fontSize = recordVaultMenuButtonRemFontSize();
  return recordVaultBeatGreenButtonFontSx({
    fontSize,
    lineHeight: 1.15,
    '& .MuiButton-label': {
      fontSize,
      lineHeight: 1.15
    }
  });
}

/** Selected/UnSelected template labels inside myNote menu rows. */
export function recordVaultMenuButtonTemplateFontSx() {
  return recordVaultMenuButtonRemFontSx();
}

const recordVaultFontSliderLayoutSx = {
  flex: '0 0 25vw',
  width: '25vw',
  maxWidth: '25vw',
  minWidth: 0,
  py: 0.5
};

function recordVaultFontSliderColorSx(accentColor, thumbGlowRgba) {
  return {
    ...recordVaultFontSliderLayoutSx,
    color: accentColor,
    '& .MuiSlider-rail': {
      opacity: 1,
      bgcolor: 'rgba(0,0,0,0.45)',
      height: 8,
      borderRadius: 4
    },
    '& .MuiSlider-track': {
      bgcolor: accentColor,
      border: 'none',
      height: 8,
      borderRadius: 4
    },
    '& .MuiSlider-thumb': {
      width: 20,
      height: 20,
      bgcolor: accentColor,
      border: '2px solid #000',
      '&:hover, &.Mui-focusVisible, &.Mui-active': {
        boxShadow: `0 0 0 8px ${thumbGlowRgba}`
      }
    }
  };
}

/** Yellow slider — menu button font size. */
export const recordVaultMenuButtonFontSliderSx = recordVaultFontSliderColorSx(
  'var(--theme-yellow-color)',
  'rgba(255, 235, 59, 0.22)'
);

/** Red slider — note / highlight font size (selected text + future typing). */
export const recordVaultNoteFontSliderSx = recordVaultFontSliderColorSx('#FF0000', 'rgba(255, 0, 0, 0.22)');
