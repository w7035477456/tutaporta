/**
 * fe/.env — sidebar menu typography (nav rows, Close Menu, Exit to Mall).
 * MOBILE_FONT_SIZE_MENU (xs) / DESKTOP_FONT_SIZE_MENU (sm+), numeric → N vw.
 */

import { getDesktopMenuFontSizeVw } from 'config/desktopFontEnv';
import { getMobileMenuFontSizeVw } from 'config/singlesMemberCardFontEnv';

/** Menu labels 10% smaller than env MOBILE_/DESKTOP_FONT_SIZE_MENU. */
export const SIDEBAR_MENU_TEXT_SCALE = 0.9;

/** PNG / Tabler icon sizes — 50% larger than prior open 56 / collapsed 48 px defaults. */
export const SIDEBAR_MENU_IMG_ICON_PX = { drawerOpen: 84, collapsed: 72 };
export const SIDEBAR_MENU_TABLER_ICON_PX = { drawerOpen: 60, collapsed: 57 };

/** Scale factor applied vs previous sidebar PNG icon sizes (1.5 = 50% bigger). */
export const SIDEBAR_MENU_ICON_SIZE_SCALE = 1.5;

/** Collapsed menu horizontal gutter (MenuList mx) — each side, in px. */
export const SIDEBAR_MENU_COLLAPSED_GUTTER_PX = 2;

/** Extra padding around collapsed icon inside its slot (each side). */
export const SIDEBAR_MENU_COLLAPSED_ICON_PAD_PX = 2;

/** Open drawer: horizontal gap between icon column and label column (% of viewport width). */
export const SIDEBAR_MENU_ICON_LABEL_GAP_VW = 0.08;

/** Open drawer: icon slot width as a fraction of icon px (1 = tight to icon edge). */
export const SIDEBAR_MENU_ICON_SLOT_WIDTH_RATIO = 0.92;

function scaleVwString(vwValue, factor) {
  const match = /^([\d.]+)vw$/i.exec(String(vwValue ?? '').trim());
  if (!match) return vwValue;
  const scaled = Number(match[1]) * factor;
  return `${scaled}vw`;
}

function readSidebarMenuIconPx(drawerOpen) {
  return drawerOpen ? SIDEBAR_MENU_IMG_ICON_PX.drawerOpen : SIDEBAR_MENU_IMG_ICON_PX.collapsed;
}

function readSidebarMenuTablerPx(drawerOpen) {
  return drawerOpen ? SIDEBAR_MENU_TABLER_ICON_PX.drawerOpen : SIDEBAR_MENU_TABLER_ICON_PX.collapsed;
}

/** ListItemIcon slot — fits PNG icons; label column starts closer when drawer is open. */
export function getSidebarMenuIconSlotSx(drawerOpen, { level = 1, downSM = false } = {}) {
  const px = readSidebarMenuIconPx(drawerOpen);
  const slot = Math.ceil(px * SIDEBAR_MENU_ICON_SLOT_WIDTH_RATIO);
  if (!drawerOpen && level === 1) {
    const box = px + SIDEBAR_MENU_COLLAPSED_ICON_PAD_PX * 2;
    return {
      minWidth: box,
      borderRadius: '12px',
      width: box,
      height: box,
      alignItems: 'center',
      justifyContent: 'center'
    };
  }
  return {
    minWidth: downSM && drawerOpen ? (level === 1 ? slot : Math.ceil(slot / 2)) : level === 1 ? slot : Math.ceil(slot / 2),
    ...(drawerOpen && level === 1
      ? {
          width: slot,
          maxWidth: slot,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      : null)
  };
}

export function getSidebarMenuImgIconSize(drawerOpen) {
  return readSidebarMenuIconPx(drawerOpen);
}

export function getSidebarMenuTablerIconSize(drawerOpen) {
  const px = readSidebarMenuTablerPx(drawerOpen);
  return `${px}px`;
}

/** Exit to Mall button icon — scaled with SIDEBAR_MENU_ICON_SIZE_SCALE. */
export function getSidebarExitMenuIconPx(drawerOpen) {
  const base = drawerOpen ? 44 : 36;
  return Math.round(base * SIDEBAR_MENU_ICON_SIZE_SCALE);
}

/** Collapsed exit / hamburger square control size. */
export function getSidebarCollapsedControlSizePx() {
  const px = SIDEBAR_MENU_IMG_ICON_PX.collapsed;
  return px + SIDEBAR_MENU_COLLAPSED_ICON_PAD_PX * 2;
}

/** Minimized sidebar rail width — fits icon slot + padding + shell border + gutter. */
export function getSidebarDrawerClosedWidthPx() {
  const iconBox = getSidebarCollapsedControlSizePx();
  const shellBorder = 4;
  const buttonPadX = 8;
  const menuGutter = SIDEBAR_MENU_COLLAPSED_GUTTER_PX * 2;
  return iconBox + shellBorder + buttonPadX + menuGutter;
}

/** MUI breakpoint: xs = mobile vw, sm+ = desktop vw */
export function getSidebarMenuFontSizeResponsive() {
  const scale = SIDEBAR_MENU_TEXT_SCALE;
  return {
    xs: scaleVwString(getMobileMenuFontSizeVw(), scale),
    sm: scaleVwString(getDesktopMenuFontSizeVw(), scale)
  };
}
