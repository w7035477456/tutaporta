import { getSidebarDrawerClosedWidthPx } from 'config/menuNavFontEnv';

// theme constant
export const gridSpacing = 3;

/** Collapsed rail width — wide enough for left-aligned menu icons */
export const drawerWidthClosed = getSidebarDrawerClosedWidthPx();

/** Before client-side measure runs, or if measure fails */
export const drawerWidthFallback = 300;

/** Clamp floor for open-drawer width (30vw via measureNavDrawerOpenWidthPx) */
export const drawerWidthMinPx = 220;

export const appDrawerWidth = 320;
