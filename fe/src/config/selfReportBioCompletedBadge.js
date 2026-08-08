import { buttonFontSizeResponsive } from 'config/buttonFontEnv';

/** Black label on solid green chip — My Self-Report-Bio sidebar completion %. */
export const SELF_REPORT_BIO_COMPLETED_BADGE_BG = '#60C446';
export const SELF_REPORT_BIO_COMPLETED_BADGE_COLOR = '#000000';
export const SELF_REPORT_BIO_COMPLETED_BADGE_CLASS = 'self-report-bio-completed-badge';

/**
 * Short green chip, flush bottom-right — thin enough that "Bio" stays readable above it.
 * Use a non-Typography element (Box/span) — selected ColorTemplate10Menu applies
 * `& .MuiTypography-root { fontSize: … !important }` which blew up the badge.
 * Fixed #60C446 (not --theme-action-green-color) so Minimal Palete cannot remap it.
 */
export function selfReportBioCompletedBadgeSx(overrides = {}) {
  return {
    position: 'absolute !important',
    right: '2px !important',
    bottom: '2px !important',
    left: 'auto !important',
    top: 'auto !important',
    m: '0 !important',
    px: '0.28em !important',
    py: '0 !important',
    lineHeight: '1 !important',
    height: 'auto !important',
    minHeight: '0 !important',
    fontSize: `calc(${buttonFontSizeResponsive.xs} * 0.45) !important`,
    '@media (min-width: 600px)': {
      fontSize: `calc(${buttonFontSizeResponsive.sm} * 0.45) !important`
    },
    fontWeight: '800 !important',
    letterSpacing: '0 !important',
    color: `${SELF_REPORT_BIO_COMPLETED_BADGE_COLOR} !important`,
    WebkitTextFillColor: `${SELF_REPORT_BIO_COMPLETED_BADGE_COLOR} !important`,
    WebkitTextStroke: '0 !important',
    textShadow: 'none !important',
    background: `${SELF_REPORT_BIO_COMPLETED_BADGE_BG} !important`,
    backgroundColor: `${SELF_REPORT_BIO_COMPLETED_BADGE_BG} !important`,
    bgcolor: `${SELF_REPORT_BIO_COMPLETED_BADGE_BG} !important`,
    borderRadius: '3px',
    boxSizing: 'border-box',
    pointerEvents: 'none',
    zIndex: 3,
    whiteSpace: 'nowrap',
    display: 'inline-block',
    transform: 'none !important',
    maxWidth: 'none',
    ...overrides
  };
}
