/**
 * colorTemplate10Menu — sidebar + tab rows.
 *
 * Unselected: theme-primary bg, theme-daynight text (+ border).
 * Selected: theme-secondary bg, theme-inverse-daynight text (+ border).
 */
import {
  SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  baseButtonSx,
  buttonTemplateSelectedLabelScaleSx,
  buttonTemplateSelectedLabelTextBoxSx
} from 'config/selectedUnselectedButtonTemplate';
import { getSidebarMenuIconSlotSx, SIDEBAR_MENU_ICON_LABEL_GAP_VW } from 'config/menuNavFontEnv';
import {
  DAYNIGHT_VAR,
  INVERSE_DAYNIGHT_VAR,
  PRIMARY_VAR,
  SECONDARY_VAR
} from 'utils/themeConfig';

/** @deprecated use env HOVER_MAGNIFY_FACTOR; pass hoverScale={1} to disable. */
export const COLOR_TEMPLATE10_MENU_HOVER_SCALE = null;

export function getColorTemplate10MenuHoverMagnifyFactor() {
  return SELECTED_UNSELECTED_BUTTON_HOVER_SCALE;
}

/** Outer shell border around the menu button group. */
export const COLOR_TEMPLATE10_MENU_SHELL_BORDER = `2px solid var(${PRIMARY_VAR})`;

export const COLOR_TEMPLATE10_MENU_UNSELECTED_BG = `var(${PRIMARY_VAR})`;
export const COLOR_TEMPLATE10_MENU_UNSELECTED_TEXT = `var(${DAYNIGHT_VAR})`;
export const COLOR_TEMPLATE10_MENU_UNSELECTED_BORDER = `1px solid var(${DAYNIGHT_VAR})`;

export const COLOR_TEMPLATE10_MENU_SELECTED_BG = `var(${SECONDARY_VAR})`;
export const COLOR_TEMPLATE10_MENU_SELECTED_TEXT = `var(${INVERSE_DAYNIGHT_VAR})`;
export const COLOR_TEMPLATE10_MENU_SELECTED_BORDER = `1px solid var(${INVERSE_DAYNIGHT_VAR})`;

/** Single menu/tab button — ColorTemplate10Menu selected vs unselected colors. */
export function colorTemplate10MenuItemButtonSx({
  selected = false,
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  hoverZIndex,
  fitLabelWidth = false,
  transformOrigin = 'left center'
} = {}) {
  const bg = selected ? COLOR_TEMPLATE10_MENU_SELECTED_BG : COLOR_TEMPLATE10_MENU_UNSELECTED_BG;
  const text = selected ? COLOR_TEMPLATE10_MENU_SELECTED_TEXT : COLOR_TEMPLATE10_MENU_UNSELECTED_TEXT;
  const border = selected ? COLOR_TEMPLATE10_MENU_SELECTED_BORDER : COLOR_TEMPLATE10_MENU_UNSELECTED_BORDER;
  const zIndexSx =
    Number.isFinite(Number(hoverZIndex)) && Number(hoverZIndex) > 0
      ? { zIndex: Number(hoverZIndex), isolation: 'isolate' }
      : null;

  return {
    ...baseButtonSx(bg, text, border, hoverScale, { fitLabelWidth, transformOrigin }),
    ...(selected ? buttonTemplateSelectedLabelScaleSx() : null),
    ...(selected
      ? {
          // Black box around label text only (sidebar + tab selected state).
          '& .MuiTypography-root': {
            color: `${text} !important`,
            WebkitTextFillColor: `${text} !important`,
            ...buttonTemplateSelectedLabelTextBoxSx({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              verticalAlign: 'middle'
            })
          }
        }
      : null),
    ...(zIndexSx || {})
  };
}

/** Default open-drawer menu button width — full gallery width, 3px side margin only. */
export function colorTemplate10MenuWidthSx(overrides = {}) {
  return {
    width: 'calc(100% - 6px)',
    mx: '3px',
    boxSizing: 'border-box',
    ...overrides
  };
}

/** Outer List shell — primary-color border wrapping all menu rows. */
export function colorTemplate10MenuShellSx(overrides = {}) {
  return {
    overflow: 'visible',
    position: 'relative',
    boxSizing: 'border-box',
    width: '100%',
    border: COLOR_TEMPLATE10_MENU_SHELL_BORDER,
    borderRadius: '12px',
    ...overrides
  };
}

/** Icon slot sizing — same as sidebar (env icon size on PNG via ButtonTemplateIcon). */
export function colorTemplate10MenuIconSlotSx(drawerOpen, { level = 1, downSM = false } = {}, overrides = {}) {
  return {
    color: 'inherit',
    ...getSidebarMenuIconSlotSx(drawerOpen, { level, downSM }),
    ...overrides
  };
}

/** ListItemButton sx merge — unselected base + `.Mui-selected` selected styling. */
export function colorTemplate10MenuItemSx({
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  hoverZIndex
} = {}) {
  const unselected = colorTemplate10MenuItemButtonSx({ selected: false, hoverScale, hoverZIndex });
  const selected = colorTemplate10MenuItemButtonSx({ selected: true, hoverScale, hoverZIndex });

  return {
    ...unselected,
    '&.Mui-selected': { ...selected },
    '@media (hover: hover)': {
      '&:hover': { ...unselected['@media (hover: hover)']['&:hover'] },
      '&.Mui-selected': {
        '&:hover': { ...selected['@media (hover: hover)']['&:hover'] }
      }
    }
  };
}

/** Flex row inside a menu button (icon + label). */
export function colorTemplate10MenuItemInnerSx(drawerOpen = true, overrides = {}) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: drawerOpen ? 'flex-start' : 'center',
    width: '100%',
    minWidth: 0,
    gap: drawerOpen ? `${SIDEBAR_MENU_ICON_LABEL_GAP_VW}vw` : 0,
    ...overrides
  };
}
