/**
 * colorTemplate1
 * Reusable menu-style color template (selected + unselected), powered by theme CSS vars
 * so it automatically follows light/dark ("bright/dark") series.
 */
import {
  buttonHoverMagnifyFontSx,
  buttonHoverMagnifyTransitionSx,
  buttonSelectedMagnifyFontSx
} from 'config/hoverMagnifyEnv';

export const COLOR_TEMPLATE1_BG_UNSELECTED = 'var(--theme-secondary-color)';
export const COLOR_TEMPLATE1_TEXT_UNSELECTED = 'var(--theme-primary-color)';
export const COLOR_TEMPLATE1_BORDER_UNSELECTED = '1px solid var(--theme-primary-color)';

export const COLOR_TEMPLATE1_BG_SELECTED = 'var(--theme-primary-color)';
export const COLOR_TEMPLATE1_TEXT_SELECTED = 'var(--theme-daynight-color)';
export const COLOR_TEMPLATE1_BORDER_SELECTED = '6px double var(--theme-primary-color)';
export const COLOR_TEMPLATE1_WALL_COLOR_LIGHT = '#ffffff';
export const COLOR_TEMPLATE1_WALL_COLOR_DARK = '#000000';

/**
 * "Wall color" behind ColorTemplate1 buttons:
 * - white for light series
 * - black for dark series
 */
export function colorTemplate1WallColorByTheme(theme) {
  if (typeof document !== 'undefined') {
    const cssDaynight = String(getComputedStyle(document.documentElement).getPropertyValue('--theme-daynight-color') || '')
      .trim()
      .toLowerCase();
    if (cssDaynight) {
      if (cssDaynight === '#000' || cssDaynight === '#000000' || cssDaynight === 'black') {
        return COLOR_TEMPLATE1_WALL_COLOR_DARK;
      }
      if (cssDaynight === '#fff' || cssDaynight === '#ffffff' || cssDaynight === 'white') {
        return COLOR_TEMPLATE1_WALL_COLOR_LIGHT;
      }
      const rgb = cssDaynight.match(/\d+(\.\d+)?/g);
      if (rgb && rgb.length >= 3) {
        const [r, g, b] = rgb.slice(0, 3).map((n) => Number(n));
        if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) {
          const isDark = r < 20 && g < 20 && b < 20;
          const isLight = r > 235 && g > 235 && b > 235;
          if (isDark) return COLOR_TEMPLATE1_WALL_COLOR_DARK;
          if (isLight) return COLOR_TEMPLATE1_WALL_COLOR_LIGHT;
        }
      }
    }
  }
  const mode = String(theme?.palette?.mode ?? '').toLowerCase();
  return mode === 'dark' ? COLOR_TEMPLATE1_WALL_COLOR_DARK : COLOR_TEMPLATE1_WALL_COLOR_LIGHT;
}

/**
 * Generic button sx template (works with MUI Button/ButtonBase-like components).
 */
export function colorTemplate1ButtonSx({ selected = false, hoverScale = null } = {}) {
  const bg = selected ? COLOR_TEMPLATE1_BG_SELECTED : COLOR_TEMPLATE1_BG_UNSELECTED;
  const text = selected ? COLOR_TEMPLATE1_TEXT_SELECTED : COLOR_TEMPLATE1_TEXT_UNSELECTED;
  const border = selected ? COLOR_TEMPLATE1_BORDER_SELECTED : COLOR_TEMPLATE1_BORDER_UNSELECTED;

  const magnifyOpts = { hoverScale };
  return {
    bgcolor: bg,
    color: text,
    border,
    ...buttonHoverMagnifyTransitionSx,
    ...(selected ? buttonSelectedMagnifyFontSx(magnifyOpts) : {}),
    '& .MuiListItemIcon-root': { color: text },
    '& .MuiTypography-root': { color: `${text} !important` },
    '& img': selected ? { filter: 'brightness(0) invert(1)' } : undefined,
    '@media (hover: hover)': {
      '&:hover': {
        bgcolor: bg,
        color: text,
        border,
        filter: 'brightness(0.96)',
        ...buttonHoverMagnifyFontSx(magnifyOpts),
        '& .MuiListItemIcon-root': { color: text },
        '& .MuiTypography-root': { color: `${text} !important` }
      }
    }
  };
}

/** Popup / dialog shell — same bg, text, and border as ColorTemplate1Button selected. */
export function colorTemplate1SelectedPanelSx() {
  return {
    bgcolor: COLOR_TEMPLATE1_BG_SELECTED,
    color: COLOR_TEMPLATE1_TEXT_SELECTED,
    border: COLOR_TEMPLATE1_BORDER_SELECTED,
    boxSizing: 'border-box'
  };
}

/**
 * Nav ListItemButton sx template (handles `.Mui-selected` state exactly like menu rows).
 */
export function colorTemplate1MenuItemSx({ hoverScale = 1, hoverZIndex } = {}) {
  return {
    ...colorTemplate1ButtonSx({ selected: false, hoverScale }),
    '&.Mui-selected': {
      ...colorTemplate1ButtonSx({ selected: true }),
      ...(Number.isFinite(Number(hoverZIndex)) ? { zIndex: Number(hoverZIndex), isolation: 'isolate' } : null)
    },
    '@media (hover: hover)': {
      '&:hover': {
        ...colorTemplate1ButtonSx({ selected: false, hoverScale })['@media (hover: hover)']['&:hover'],
        ...(Number.isFinite(Number(hoverZIndex)) ? { zIndex: Number(hoverZIndex), isolation: 'isolate' } : null)
      },
      '&.Mui-selected': {
        '&:hover': {
          ...colorTemplate1ButtonSx({ selected: true, hoverScale })['@media (hover: hover)']['&:hover'],
          ...(Number.isFinite(Number(hoverZIndex)) ? { zIndex: Number(hoverZIndex), isolation: 'isolate' } : null)
        }
      }
    }
  };
}

