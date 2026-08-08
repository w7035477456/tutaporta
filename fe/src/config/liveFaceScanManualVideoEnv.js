/**
 * fe/.env — manual live face scan video UI (Step 7B) sized vs ColorTemplate7 popup.
 *
 * YELLOW_TEXT_BANNER_TO_VH_RATIO — yellow instruction banner height as a fraction of popup vh (default 0.25)
 * RECORD_VIDEO_TO_VW_RATIO — record / replay / video frame width as a fraction of popup content width (default 0.5)
 */

/** Upper vh bound from COLOR_TEMPLATE7_POPUP_MAX_HEIGHT (min(92vh, 100vh - 24px)). */
const POPUP_VH_REFERENCE = '92vh';
const POPUP_VH_MAX_REFERENCE = 'calc(100vh - 24px)';

function readRatio(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 1);
}

export function getYellowTextBannerToVhRatio() {
  return readRatio(import.meta.env.YELLOW_TEXT_BANNER_TO_VH_RATIO, 0.25);
}

export function getRecordVideoToVwRatio() {
  return readRatio(import.meta.env.RECORD_VIDEO_TO_VW_RATIO, 0.5);
}

/** Banner spans full popup content width (ratio 1.0). */
export function getLiveFaceScanScriptBannerFrameSx(overrides = {}) {
  const vhRatio = getYellowTextBannerToVhRatio();
  return {
    width: '100%',
    height: `min(calc(${vhRatio} * ${POPUP_VH_REFERENCE}), calc(${vhRatio} * ${POPUP_VH_MAX_REFERENCE}))`,
    mx: 'auto',
    borderRadius: 1,
    overflow: 'hidden',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...overrides
  };
}

export function getLiveFaceScanRecordVideoWidthCss() {
  return `${getRecordVideoToVwRatio() * 100}%`;
}

export function getLiveFaceScanRecordVideoControlWidthSx() {
  return {
    width: getLiveFaceScanRecordVideoWidthCss(),
    maxWidth: '100%',
    mx: 'auto',
    alignSelf: 'center'
  };
}

export function getLiveFaceScanRecordVideoFrameSx(overrides = {}) {
  return {
    ...getLiveFaceScanRecordVideoControlWidthSx(),
    aspectRatio: '4 / 5',
    borderRadius: 1,
    overflow: 'hidden',
    boxSizing: 'border-box',
    position: 'relative',
    bgcolor: '#000000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...overrides
  };
}
