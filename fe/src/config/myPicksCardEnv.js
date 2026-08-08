import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';
import { PAGE_INSTRUCTION_TOOLTIP_BG, PAGE_INSTRUCTION_TOOLTIP_TEXT } from 'config/pageInstructionEnv';
import { SELECTED_UNSELECTED_BUTTON_HOVER_SCALE } from 'config/selectedUnselectedButtonTemplate';

/**
 * fe/.env — My Picks left-column member cards scale with viewport (vw / vh).
 * MY_PICKS_COLUMN_VW / MY_PICKS_COLUMN_VH — column width on sm+ (min of the two)
 * MY_PICKS_AVATAR_VW / MY_PICKS_AVATAR_VH — desktop avatar (sm+)
 * MY_PICKS_AVATAR_MOBILE_VW — mobile avatar width/height
 * MY_PICKS_REMOVE_X_SCALE — fraction of half DESKTOP_ICON_SIZE (see desktopFontEnv.js)
 * Typography inside cards uses MOBILE_/DESKTOP_FONT_SIZE_* via singlesMemberCardFontEnv / desktopFontEnv.
 */

import { getMyPicksRemoveXScale } from 'config/desktopFontEnv';

function readUnitNumber(value, fallback, max = 50) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

/** @returns {string} e.g. "min(21vw, 32vh)" */
export function getMyPicksColumnWidth() {
  const vw = readUnitNumber(import.meta.env.MY_PICKS_COLUMN_VW, 21);
  const vh = readUnitNumber(import.meta.env.MY_PICKS_COLUMN_VH, 32);
  return { xs: '100%', sm: `min(${vw}vw, ${vh}vh)` };
}

/** Avatar width/height — square */
export function getMyPicksAvatarSize() {
  const mobileVw = readUnitNumber(import.meta.env.MY_PICKS_AVATAR_MOBILE_VW, 28);
  const desktopVw = readUnitNumber(import.meta.env.MY_PICKS_AVATAR_VW, 9.2);
  const desktopVh = readUnitNumber(import.meta.env.MY_PICKS_AVATAR_VH, 12);
  return {
    xs: `min(${mobileVw}vw, 26vh)`,
    sm: `min(${desktopVw}vw, ${desktopVh}vh)`
  };
}

/** Inner photo panel border */
export function getMyPicksInnerBorderWidth() {
  return { xs: 'max(2px, 0.5vw)', sm: 'max(3px, 0.28vw)' };
}

/** Outer pick card border */
export function getMyPicksOuterBorderWidth() {
  return { xs: 'max(3px, 0.55vw)', sm: 'max(4px, 0.28vw)' };
}

/** Selected avatar ring */
export function getMyPicksAvatarBorderWidth() {
  return { xs: 'max(3px, 0.5vw)', sm: 'max(4px, 0.28vw)' };
}

export function getMyPicksUnselectedAvatarBorderWidth() {
  return { xs: 'max(2px, 0.35vw)', sm: 'max(2px, 0.18vw)' };
}

/** Remove-pick X icon (DESKTOP_ICON_SIZE / 2 × MY_PICKS_REMOVE_X_SCALE) */
export function getMyPicksRemoveIconSize() {
  const iconN = readUnitNumber(import.meta.env.DESKTOP_ICON_SIZE, 6, 25);
  const sizeVw = (iconN / 2) * getMyPicksRemoveXScale();
  return {
    xs: `${sizeVw * 1.35}vw`,
    sm: `${sizeVw}vw`
  };
}

/** Shift remove X inward from the card corner (px). */
const MY_PICKS_REMOVE_X_SHIFT_LEFT_PX = 10;
const MY_PICKS_REMOVE_X_SHIFT_DOWN_PX = 10;

export function getMyPicksRemoveButtonInset() {
  const down = MY_PICKS_REMOVE_X_SHIFT_DOWN_PX;
  const left = MY_PICKS_REMOVE_X_SHIFT_LEFT_PX;
  return {
    top: { xs: `calc(1.4vw + ${down}px)`, sm: `calc(0.55vh + ${down}px)` },
    right: { xs: `calc(1.4vw + ${left}px)`, sm: `calc(0.55vw + ${left}px)` }
  };
}

/** My Picks bio request / cancel — UnSelectedButtonTemplate with yellow background. */
export const MY_PICKS_BIO_YELLOW_BUTTON_BG = 'var(--theme-yellow-color)';

/** Green Acquaintance / Friend request buttons on Picks & Posts. */
export const MY_PICKS_BIO_GREEN_REQUEST_BUTTON_BG = '#43a047';

export const MY_PICKS_ACQUAINTANCE_REQUEST_TOOLTIP =
  "Instruction: Click to Send 'Acquaintance Request' to mutually share your Basic Bios. Once approved, you'll both have access to each other's Basic Bio. As Acquaintance, go to the 'Acquaint. & Buddies' menu for privilege access/activities there.";

export const MY_PICKS_FRIEND_REQUEST_TOOLTIP =
  "Instruction: Click to Send 'Friend Request' to mutually share your Full Bios (including Basic Bios). Once they approved your request, you'll both have access to each other's Basic and Full Bio. As mutual Friends, go to the 'Acquaint. & Buddies' menu for privileged access/activities there.";

/** Hover tooltip — wide, rounded, orange fill (#F65B0C), red border, black text. */
export function myPicksBioRequestTooltipSlotProps() {
  return {
    popper: {
      sx: { zIndex: 1400 }
    },
    tooltip: {
      sx: {
        bgcolor: PAGE_INSTRUCTION_TOOLTIP_BG,
        color: PAGE_INSTRUCTION_TOOLTIP_TEXT,
        border: '2px solid #d32f2f',
        borderRadius: '18px',
        fontWeight: 700,
        fontSize: buttonFontSizeResponsive,
        lineHeight: 1.4,
        width: '30ch',
        minWidth: '30ch',
        maxWidth: '30ch',
        boxShadow: 'none',
        p: { xs: 1.25, sm: 1.5 },
        textAlign: 'left',
        whiteSpace: 'normal'
      }
    },
    arrow: {
      sx: {
        color: PAGE_INSTRUCTION_TOOLTIP_BG,
        '&::before': {
          border: '1px solid #d32f2f'
        }
      }
    }
  };
}

/** UnSelectedButtonTemplate sx — green bg, black border for Acquaintance / Friend request buttons. */
export function myPicksBioGreenRequestButtonSx({
  transformOrigin = 'center center',
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  ...overrides
} = {}) {
  const green = MY_PICKS_BIO_GREEN_REQUEST_BUTTON_BG;
  return {
    bgcolor: `${green} !important`,
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    border: '2px solid #000000 !important',
    transformOrigin,
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: '#388e3c !important',
        color: '#000000 !important',
        WebkitTextFillColor: '#000000 !important',
        border: '2px solid #000000 !important',
        ...buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeResponsive, hoverScale })
      }
    },
    ...overrides
  };
}

/** UnSelectedButtonTemplate sx — yellow bg override for Req / Cancel bio buttons. */
export function myPicksBioYellowUnSelectedButtonSx({
  transformOrigin = 'center center',
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  ...overrides
} = {}) {
  const yellow = MY_PICKS_BIO_YELLOW_BUTTON_BG;
  return {
    bgcolor: `${yellow} !important`,
    transformOrigin,
    ...buttonHoverMagnifyTransitionSx,
    '@media (hover: hover)': {
      '&:hover:not(.Mui-disabled)': {
        bgcolor: `${yellow} !important`,
        ...buttonHoverMagnifyFontSx({ baseFontSize: buttonFontSizeResponsive, hoverScale })
      }
    },
    ...overrides
  };
}

/** Scales with button width so labels like "Brief Bio Requested" stay on one line. */
export function getMyPicksBioButtonFontSize() {
  return 'clamp(0.45rem, 7.25cqw, 1.75vw)';
}

export function getMyPicksBioButtonMinHeight() {
  return {
    xs: 'clamp(1.5rem, 8vw, 2.6rem)',
    sm: 'clamp(1.6rem, min(3.4vw, 4.2vh), 2.75rem)'
  };
}

export function getMyPicksCardSpacing() {
  return {
    cardPy: { xs: '2.5vw', sm: '1.1vh' },
    cardPx: { xs: '2vw', sm: '0.85vw' },
    cardMy: { xs: '1.4vw', sm: '0.85vh' },
    cardMl: { xs: '1.2vw', sm: '0.6vw' },
    cardMrSelected: { xs: '1.6vw', sm: '0.9vw' },
    cardMr: { xs: '1.2vw', sm: '0.6vw' },
    innerPx: { xs: '1.4vw', sm: '0.55vw' },
    innerPt: { xs: '0.8vw', sm: '0.3vh' },
    innerPb: { xs: '1.4vw', sm: '0.55vh' },
    innerMb: { xs: '1.2vw', sm: '0.7vh' },
    bioGridGap: { xs: '0.9vw', sm: '0.45vw' },
    bioMt: { xs: '1vw', sm: '0.6vh' }
  };
}

export function getMyPicksColumnMinHeight() {
  return { xs: '28vh', sm: 0 };
}
