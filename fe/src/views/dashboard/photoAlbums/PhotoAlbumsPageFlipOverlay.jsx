import { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { toPng } from 'html-to-image';

const DEFAULT_DURATION_MS = 700;
const PAPER_FALLBACK = 'var(--theme-daynight-color, #f5f0e6)';

/**
 * Capture left/right page halves of an open album spread (binder strip excluded).
 * Returns nulls on failure so the caller can still show a paper-colored flip.
 */
export async function captureAlbumSpreadPageHalves(
  spreadEl,
  { pageWidthPx, binderWidthPx, pixelRatio } = {}
) {
  if (!spreadEl || !(spreadEl instanceof HTMLElement)) {
    return { leftDataUrl: null, rightDataUrl: null };
  }
  const rect = spreadEl.getBoundingClientRect();
  const cssW = Math.max(1, Math.round(rect.width || spreadEl.offsetWidth || 0));
  const cssH = Math.max(1, Math.round(rect.height || spreadEl.offsetHeight || 0));
  if (cssW < 2 || cssH < 2) {
    return { leftDataUrl: null, rightDataUrl: null };
  }

  const pw = Math.max(1, Math.round(Number(pageWidthPx) || (cssW - Math.max(0, binderWidthPx || 0)) / 2));
  const bw = Math.max(0, Math.round(Number(binderWidthPx) || Math.max(0, cssW - pw * 2)));
  const dpr = Math.min(1.5, Math.max(1, Number(pixelRatio) || window.devicePixelRatio || 1));

  let fullDataUrl;
  try {
    fullDataUrl = await toPng(spreadEl, {
      cacheBust: true,
      pixelRatio: dpr,
      width: cssW,
      height: cssH,
      style: {
        transform: 'none',
        zoom: '1'
      },
      filter: (node) => {
        if (!(node instanceof HTMLElement)) return true;
        if (node.dataset?.albumPageFlipSkip === 'true') return false;
        if (node.classList?.contains('rv-album-page-flip-overlay')) return false;
        if (node.classList?.contains('rv-album-page-resize-e')) return false;
        return true;
      }
    });
  } catch {
    return { leftDataUrl: null, rightDataUrl: null };
  }

  try {
    const img = await loadImage(fullDataUrl);
    const scaleX = img.naturalWidth / cssW;
    const scaleY = img.naturalHeight / cssH;
    const leftDataUrl = cropToDataUrl(img, 0, 0, pw * scaleX, cssH * scaleY);
    const rightLeft = (pw + bw) * scaleX;
    const rightDataUrl = cropToDataUrl(img, rightLeft, 0, pw * scaleX, cssH * scaleY);
    return { leftDataUrl, rightDataUrl };
  } catch {
    return { leftDataUrl: null, rightDataUrl: null };
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

function cropToDataUrl(img, sx, sy, sw, sh) {
  const w = Math.max(1, Math.round(sw));
  const h = Math.max(1, Math.round(sh));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, Math.round(sx), Math.round(sy), w, h, 0, 0, w, h);
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

export function prefersAlbumPageFlipReducedMotion() {
  try {
    return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
  } catch {
    return false;
  }
}

/**
 * Absolute 3D page-turn overlay hinged at the binder.
 * `direction: 'next'` — right page rotates left (rotateY 0 → -180).
 * `direction: 'prev'` — left page rotates right (rotateY 0 → +180).
 * `direction: 'cover-open'` — full-width cover rotates from left hinge.
 */
export default function PhotoAlbumsPageFlipOverlay({
  open,
  direction = 'next',
  frontSrc = null,
  backSrc = null,
  durationMs = DEFAULT_DURATION_MS,
  binderLeftPx = 0,
  pageWidthPx = 0,
  fullWidth = false,
  onMidpoint,
  onDone
}) {
  const midFiredRef = useRef(false);
  const doneFiredRef = useRef(false);
  const onMidpointRef = useRef(onMidpoint);
  const onDoneRef = useRef(onDone);
  onMidpointRef.current = onMidpoint;
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!open) {
      midFiredRef.current = false;
      doneFiredRef.current = false;
      return undefined;
    }
    midFiredRef.current = false;
    doneFiredRef.current = false;
    const dur = Math.max(200, Number(durationMs) || DEFAULT_DURATION_MS);
    const midAt = dur * 0.5;
    const midTimer = window.setTimeout(() => {
      if (midFiredRef.current) return;
      midFiredRef.current = true;
      onMidpointRef.current?.();
    }, midAt);
    const doneTimer = window.setTimeout(() => {
      if (doneFiredRef.current) return;
      doneFiredRef.current = true;
      if (!midFiredRef.current) {
        midFiredRef.current = true;
        onMidpointRef.current?.();
      }
      onDoneRef.current?.();
    }, dur);
    return () => {
      window.clearTimeout(midTimer);
      window.clearTimeout(doneTimer);
    };
  }, [open, durationMs, direction, frontSrc, backSrc]);

  if (!open) return null;

  const isPrev = direction === 'prev';
  const isCoverOpen = direction === 'cover-open';
  const leafWidth = Math.max(1, Math.round(Number(pageWidthPx) || 0));
  const leafLeft = isCoverOpen || fullWidth ? 0 : isPrev ? 0 : Math.max(0, Math.round(Number(binderLeftPx) || 0));
  const origin = isPrev ? 'right center' : 'left center';
  const endRotate = isPrev ? 180 : -180;
  const dur = Math.max(200, Number(durationMs) || DEFAULT_DURATION_MS);

  return (
    <Box
      className="rv-album-page-flip-overlay"
      data-album-page-flip-skip="true"
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 95,
        pointerEvents: 'none',
        perspective: '2200px',
        perspectiveOrigin: isPrev ? '30% 50%' : '70% 50%',
        overflow: 'hidden',
        transformStyle: 'preserve-3d'
      }}
    >
      <Box
        key={`flip-${direction}-${dur}-${frontSrc ? 'img' : 'paper'}`}
        className="rv-album-page-flip-leaf"
        sx={{
          position: 'absolute',
          top: 0,
          left: `${leafLeft}px`,
          width: isCoverOpen || fullWidth ? '100%' : `${leafWidth}px`,
          height: '100%',
          transformStyle: 'preserve-3d',
          transformOrigin: origin,
          willChange: 'transform',
          animation: `rvAlbumPageFlipTurn ${dur}ms ease-in-out forwards`,
          '@keyframes rvAlbumPageFlipTurn': {
            from: { transform: 'rotateY(0deg)' },
            to: { transform: `rotateY(${endRotate}deg)` }
          },
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            pointerEvents: 'none',
            background: isPrev
              ? 'linear-gradient(to left, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.08) 35%, transparent 70%)'
              : 'linear-gradient(to right, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.08) 35%, transparent 70%)',
            opacity: 0.85,
            mixBlendMode: 'multiply'
          }
        }}
      >
        <Box
          className="rv-album-page-flip-face rv-album-page-flip-face--front"
          sx={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            bgcolor: PAPER_FALLBACK,
            backgroundImage: frontSrc ? `url(${frontSrc})` : 'none',
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            boxShadow: isPrev
              ? 'inset -10px 0 24px rgba(0,0,0,0.12)'
              : 'inset 10px 0 24px rgba(0,0,0,0.12)'
          }}
        />
        <Box
          className="rv-album-page-flip-face rv-album-page-flip-face--back"
          sx={{
            position: 'absolute',
            inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            bgcolor: PAPER_FALLBACK,
            backgroundImage: backSrc ? `url(${backSrc})` : 'none',
            backgroundSize: '100% 100%',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            boxShadow: isPrev
              ? 'inset 10px 0 24px rgba(0,0,0,0.12)'
              : 'inset -10px 0 24px rgba(0,0,0,0.12)'
          }}
        />
      </Box>
    </Box>
  );
}

PhotoAlbumsPageFlipOverlay.propTypes = {
  open: PropTypes.bool,
  direction: PropTypes.oneOf(['next', 'prev', 'cover-open']),
  frontSrc: PropTypes.string,
  backSrc: PropTypes.string,
  durationMs: PropTypes.number,
  binderLeftPx: PropTypes.number,
  pageWidthPx: PropTypes.number,
  fullWidth: PropTypes.bool,
  onMidpoint: PropTypes.func,
  onDone: PropTypes.func
};
