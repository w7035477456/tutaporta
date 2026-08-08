import { buttonFontSizeHalfResponsive } from 'config/buttonFontEnv';

/** Red circle + black numeral — Received Bio Requests pending-count puckers (2× prior size). */
export const RECEIVED_BIO_PENDING_BADGE_BG = '#e53935';
export const RECEIVED_BIO_PENDING_BADGE_TEXT = '#000000';
export const RECEIVED_BIO_PENDING_BADGE_BORDER = '2px solid #000000';

const BADGE_SIZE_PX = 44;
const BADGE_FONT_REM = '1.5rem';

export function receivedBioPendingBadgeSx(overrides = {}) {
  return {
    minWidth: BADGE_SIZE_PX,
    height: BADGE_SIZE_PX,
    borderRadius: '50%',
    bgcolor: RECEIVED_BIO_PENDING_BADGE_BG,
    color: RECEIVED_BIO_PENDING_BADGE_TEXT,
    WebkitTextFillColor: RECEIVED_BIO_PENDING_BADGE_TEXT,
    fontWeight: 700,
    fontSize: BADGE_FONT_REM,
    lineHeight: `${BADGE_SIZE_PX - 8}px`,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: RECEIVED_BIO_PENDING_BADGE_BORDER,
    boxSizing: 'border-box',
    pointerEvents: 'none',
    flexShrink: 0,
    ...overrides
  };
}

/** MUI Chip wrapper for sidebar nav pending counts. */
export function receivedBioPendingBadgeChipSx(overrides = {}) {
  return {
    flexShrink: 0,
    minWidth: BADGE_SIZE_PX,
    height: BADGE_SIZE_PX,
    borderRadius: '50%',
    bgcolor: `${RECEIVED_BIO_PENDING_BADGE_BG} !important`,
    color: `${RECEIVED_BIO_PENDING_BADGE_TEXT} !important`,
    border: RECEIVED_BIO_PENDING_BADGE_BORDER,
    boxShadow: 'none',
    '& .MuiChip-label': {
      px: 0.75,
      fontWeight: 700,
      fontSize: BADGE_FONT_REM,
      color: `${RECEIVED_BIO_PENDING_BADGE_TEXT} !important`,
      WebkitTextFillColor: `${RECEIVED_BIO_PENDING_BADGE_TEXT} !important`,
      lineHeight: 1
    },
    ...overrides
  };
}

/** Yellow tooltip — half MOBILE_/DESKTOP_FONT_SIZE_BUTTON, black text. */
export const RECEIVED_BIO_PENDING_TOOLTIP_BG = 'var(--theme-yellow-color, #FFEB3B)';
export const RECEIVED_BIO_PENDING_TOOLTIP_TEXT = '#000000';

/** MUI Tooltip slotProps for sidebar Received Bio Req pending-count hover. */
export function receivedBioPendingBadgeTooltipSlotProps(overrides = {}) {
  const half = buttonFontSizeHalfResponsive;
  const tooltipSx = {
    fontWeight: 600,
    bgcolor: RECEIVED_BIO_PENDING_TOOLTIP_BG,
    color: RECEIVED_BIO_PENDING_TOOLTIP_TEXT,
    WebkitTextFillColor: RECEIVED_BIO_PENDING_TOOLTIP_TEXT,
    border: '2px solid #000000',
    boxShadow: 'none',
    maxWidth: 360,
    fontSize: half.xs,
    '@media (min-width: 600px)': {
      fontSize: half.sm
    },
    ...(overrides.tooltipSx || {})
  };
  return {
    tooltip: { sx: tooltipSx },
    arrow: {
      sx: {
        color: RECEIVED_BIO_PENDING_TOOLTIP_BG,
        '&::before': {
          border: '2px solid #000000'
        },
        ...(overrides.arrowSx || {})
      }
    }
  };
}
