/** Shared slot photo zoom math + chrome styles (Add Text dialog + album tiles). */

export const SLOT_ZOOM_CHROME_BG = '#FBDF1B';
export const SLOT_ZOOM_CHROME_FG = '#000000';
export const SLOT_ZOOM_CHROME_BG_DISABLED = '#9e9e9e';
export const SLOT_ZOOM_CHROME_FG_DISABLED = '#616161';
export const SLOT_ZOOM_PCT_MIN = 0;
export const SLOT_ZOOM_PCT_MAX = 100;
export const SLOT_ZOOM_MAX_COVER_MULT = 4;
export const MIN_PHOTO_WIDTH = 80;

/** Cover-fit size: photo fully covers the slot window (may extend past edges). */
export function coverSizeForFrame(aspect, frameW, frameH) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const a = aspect > 0 ? aspect : 4 / 3;
  let w = fw;
  let h = w / a;
  if (h < fh) {
    h = fh;
    w = h * a;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

/** Contain-fit size: entire photo inside the slot (letterbox / pillarbox). */
export function containSizeForFrame(aspect, frameW, frameH) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const a = aspect > 0 ? aspect : 4 / 3;
  let w = fw;
  let h = w / a;
  if (h > fh) {
    h = fh;
    w = h * a;
  }
  return { width: Math.round(w), height: Math.round(h) };
}

export function fitSizeForFrame(aspect, frameW, frameH, mode) {
  return mode === 'contain'
    ? containSizeForFrame(aspect, frameW, frameH)
    : coverSizeForFrame(aspect, frameW, frameH);
}

export function centeredPan(photoW, photoH, frameW, frameH) {
  return clampPhotoPan(
    (frameW - photoW) / 2,
    (frameH - photoH) / 2,
    photoW,
    photoH,
    frameW,
    frameH
  );
}

export function clampPhotoPan(panX, panY, photoW, photoH, frameW, frameH) {
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const pw = Math.max(1, photoW);
  const ph = Math.max(1, photoH);
  const minOverlapX = Math.max(24, Math.min(64, Math.round(fw * 0.12)));
  const minOverlapY = Math.max(24, Math.min(64, Math.round(fh * 0.12)));
  const minX = minOverlapX - pw;
  const maxX = fw - minOverlapX;
  const minY = minOverlapY - ph;
  const maxY = fh - minOverlapY;
  return {
    panX: Math.round(Math.min(maxX, Math.max(minX, panX))),
    panY: Math.round(Math.min(maxY, Math.max(minY, panY)))
  };
}

/** Map framed photo width vs cover → 0…100% (0 = cover fill, 100 = max zoom). */
export function framedZoomPercentFromWidth(photoW, aspect, frameW, frameH) {
  const cover = coverSizeForFrame(aspect, frameW, frameH);
  if (!(cover.width > 0) || !(photoW > 0)) return 0;
  const minW = cover.width;
  const maxW = Math.round(cover.width * SLOT_ZOOM_MAX_COVER_MULT);
  if (maxW <= minW) return 0;
  const pct = Math.round(((photoW - minW) / (maxW - minW)) * 100);
  return Math.min(SLOT_ZOOM_PCT_MAX, Math.max(SLOT_ZOOM_PCT_MIN, pct));
}

export function framedWidthFromZoomPercent(pct, aspect, frameW, frameH) {
  const cover = coverSizeForFrame(aspect, frameW, frameH);
  const minW = Math.max(MIN_PHOTO_WIDTH, cover.width);
  const maxW = Math.round(cover.width * SLOT_ZOOM_MAX_COVER_MULT);
  const t = Math.min(SLOT_ZOOM_PCT_MAX, Math.max(SLOT_ZOOM_PCT_MIN, Number(pct) || 0)) / 100;
  return Math.round(minW + t * (maxW - minW));
}

/** Slider zoom 0…100% — keeps subject under frame center. */
export function computeFramedZoomPatch({
  pct,
  aspect,
  frameW,
  frameH,
  photoW,
  photoH,
  panX,
  panY
}) {
  const a = aspect > 0 ? aspect : 4 / 3;
  const fw = Math.max(1, frameW);
  const fh = Math.max(1, frameH);
  const cover = coverSizeForFrame(a, fw, fh);
  const nextW = framedWidthFromZoomPercent(pct, a, fw, fh);
  const nextH = Math.round(nextW / a);
  const cx = fw / 2;
  const cy = fh / 2;
  const startW = Math.max(1, Number(photoW) || cover.width);
  const startH = Math.max(1, Number(photoH) || Math.round(startW / a));
  const livePanX = Number.isFinite(Number(panX)) ? Number(panX) : (fw - startW) / 2;
  const livePanY = Number.isFinite(Number(panY)) ? Number(panY) : (fh - startH) / 2;
  const relX = (cx - livePanX) / startW;
  const relY = (cy - livePanY) / startH;
  const nextPan = clampPhotoPan(
    cx - relX * nextW,
    cy - relY * nextH,
    nextW,
    nextH,
    fw,
    fh
  );
  return {
    width: nextW,
    height: nextH,
    panX: nextPan.panX,
    panY: nextPan.panY,
    slotFit: 'cover'
  };
}

export const slotZoomSliderRowSx = (active) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 0.6,
  bgcolor: active ? SLOT_ZOOM_CHROME_BG : SLOT_ZOOM_CHROME_BG_DISABLED,
  px: 0.75,
  py: 0.4,
  boxSizing: 'border-box',
  pointerEvents: 'auto',
  borderTop: '2px solid #000000',
  flexShrink: 0,
  opacity: active ? 1 : 0.85,
  cursor: active ? 'default' : 'not-allowed'
});

export const slotZoomSliderSx = (active) => ({
  flex: 1,
  mx: 0.35,
  color: active ? SLOT_ZOOM_CHROME_FG : SLOT_ZOOM_CHROME_FG_DISABLED,
  '& .MuiSlider-thumb': {
    width: 18,
    height: 14,
    borderRadius: '2px',
    bgcolor: active ? '#000000' : '#757575',
    border: `1px solid ${active ? '#000000' : '#616161'}`,
    '&:hover, &.Mui-focusVisible': active
      ? { boxShadow: '0 0 0 4px rgba(0,0,0,0.12)' }
      : { boxShadow: 'none' }
  },
  '& .MuiSlider-track': {
    bgcolor: active ? '#000000' : '#757575',
    border: 'none',
    height: 3
  },
  '& .MuiSlider-rail': {
    bgcolor: active ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.18)',
    height: 3
  },
  '&.Mui-disabled': {
    color: SLOT_ZOOM_CHROME_FG_DISABLED,
    opacity: 1
  }
});

export const slotZoomPctLabelSx = (active) => ({
  minWidth: 36,
  textAlign: 'center',
  fontWeight: 900,
  color: active ? '#c62828' : '#757575',
  WebkitTextFillColor: active ? '#c62828' : '#757575',
  flexShrink: 0,
  fontSize: '0.78rem',
  lineHeight: 1.2,
  fontFamily: 'Algerian, fantasy'
});
