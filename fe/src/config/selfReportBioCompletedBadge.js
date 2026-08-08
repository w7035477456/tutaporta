import { buttonFontSizeResponsive } from 'config/buttonFontEnv';

/** Yellow label + black outline — My Self-Report-Bio sidebar completion %. */
export const SELF_REPORT_BIO_COMPLETED_BADGE_COLOR = '#FFEB3B';
export const SELF_REPORT_BIO_COMPLETED_BADGE_STROKE = '#000000';
export const SELF_REPORT_BIO_COMPLETED_BADGE_CLASS = 'self-report-bio-completed-badge';

/**
 * ~2/3 of menu button font (2× prior 1/3 size), flush bottom-right.
 * Use a non-Typography element (Box/span) — selected ColorTemplate10Menu applies
 * `& .MuiTypography-root { fontSize: … !important }` which blew up the badge.
 */
export function selfReportBioCompletedBadgeSx(overrides = {}) {
  return {
    position: 'absolute !important',
    right: '0 !important',
    bottom: '0 !important',
    left: 'auto !important',
    top: 'auto !important',
    m: '0 !important',
    p: '0 !important',
    lineHeight: '1 !important',
    fontSize: `calc(${buttonFontSizeResponsive.xs} * 2 / 3) !important`,
    '@media (min-width: 600px)': {
      fontSize: `calc(${buttonFontSizeResponsive.sm} * 2 / 3) !important`
    },
    fontWeight: '800 !important',
    letterSpacing: '0 !important',
    color: `${SELF_REPORT_BIO_COMPLETED_BADGE_COLOR} !important`,
    WebkitTextFillColor: `${SELF_REPORT_BIO_COMPLETED_BADGE_COLOR} !important`,
    WebkitTextStroke: `0.45px ${SELF_REPORT_BIO_COMPLETED_BADGE_STROKE}`,
    paintOrder: 'stroke fill',
    textShadow: `
      -0.5px -0.5px 0 ${SELF_REPORT_BIO_COMPLETED_BADGE_STROKE},
       0.5px -0.5px 0 ${SELF_REPORT_BIO_COMPLETED_BADGE_STROKE},
      -0.5px  0.5px 0 ${SELF_REPORT_BIO_COMPLETED_BADGE_STROKE},
       0.5px  0.5px 0 ${SELF_REPORT_BIO_COMPLETED_BADGE_STROKE}
    `,
    pointerEvents: 'none',
    zIndex: 3,
    whiteSpace: 'nowrap',
    display: 'block',
    transform: 'none !important',
    maxWidth: 'none',
    ...overrides
  };
}
