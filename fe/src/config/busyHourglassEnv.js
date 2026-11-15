import hourglassImage from 'assets/images/hourglass4.png';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';

/** Shared busy / loading hourglass asset — full-color 3D PNG (hourglass4.png). */
export const BUSY_HOURGLASS_IMAGE = hourglassImage;

/** Bright yellow countdown % — black outline, ~3× prior title size (all hourglass overlays). */
export const BUSY_HOURGLASS_PERCENT_COLOR = '#FFEB3B';

export const busyHourglassPercentSx = {
  m: 0,
  fontFamily: 'inherit',
  fontWeight: 900,
  fontSize: {
    xs: '4.05rem',
    sm: `calc(3 * ${getDesktopTitleFontSizeVw()})`
  },
  lineHeight: 1.05,
  color: BUSY_HOURGLASS_PERCENT_COLOR,
  WebkitTextFillColor: BUSY_HOURGLASS_PERCENT_COLOR,
  WebkitTextStroke: '3px #000',
  paintOrder: 'stroke fill',
  textAlign: 'left',
  textShadow: '0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
  whiteSpace: 'nowrap'
};

/**
 * Site-wide centered busy hourglass — half of prior overlay size (6rem / 8rem).
 * Used for every loading overlay on the site.
 */
export const BUSY_HOURGLASS_SIZE = {
  xs: '6rem',
  sm: '8rem'
};

/** Above ColorTemplate7 (1400) and ColorTemplate16 (1500) Full Disk Encryption. */
export const BUSY_HOURGLASS_OVERLAY_Z_INDEX = 1600;

/** Centered on modal / gate busy states (Connecting…, Working…). */
export const BUSY_HOURGLASS_MODAL_SIZE = {
  xs: '9rem',
  sm: '12rem'
};

/** /myNote full-page loading — colorful hourglass over myNoteBackground.png. */
export const BUSY_HOURGLASS_MY_NOTE_SIZE = {
  xs: '7rem',
  sm: '9rem'
};

/** /myPhotos full-page loading — same sizing as Notes hourglass. */
export const BUSY_HOURGLASS_MY_PHOTO_ALBUMS_SIZE = BUSY_HOURGLASS_MY_NOTE_SIZE;

export const busyHourglassSpinSx = {
  display: 'inline-block',
  flexShrink: 0,
  objectFit: 'contain',
  opacity: 1,
  filter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.72))',
  WebkitFilter: 'drop-shadow(0 8px 32px rgba(0, 0, 0, 0.72))',
  mixBlendMode: 'normal',
  '@keyframes busyHourglassSpin': {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' }
  },
  animation: 'busyHourglassSpin 1.4s linear infinite'
};

/**
 * Indeterminate busy overlays (no progressPercent): visual remaining-% countdown
 * approaches 0 over this many ms, then holds at BUSY_HOURGLASS_COUNTDOWN_FLOOR
 * until the parent closes the overlay (real "done").
 */
export const BUSY_HOURGLASS_COUNTDOWN_MS = 15000;

/** Lowest remaining % while still busy with no real progress (never fake-finish). */
export const BUSY_HOURGLASS_COUNTDOWN_FLOOR = 3;

/** Fixed viewport overlay — hourglass always centered on screen. */
export const busyHourglassOverlayRootSx = {
  position: 'fixed',
  inset: 0,
  zIndex: BUSY_HOURGLASS_OVERLAY_Z_INDEX,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'all',
  cursor: 'wait',
  bgcolor: 'rgba(0, 0, 0, 0.28)'
};
