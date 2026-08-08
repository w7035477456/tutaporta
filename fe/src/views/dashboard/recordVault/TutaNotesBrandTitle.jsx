import PropTypes from 'prop-types';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

const MIN_FONT_PX = 12;
const MAX_FONT_PX = 64;

const titleRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  minWidth: 0,
  width: '100%',
  maxWidth: '100%',
  flexWrap: 'nowrap',
  boxSizing: 'border-box'
};

const logoSx = {
  width: 36,
  height: 36,
  objectFit: 'contain',
  flexShrink: 0,
  display: 'block',
  borderRadius: 0.5,
  border: 'none'
};

const labelBaseSx = {
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 800,
  lineHeight: 1.1,
  minWidth: 0,
  flex: '1 1 auto',
  whiteSpace: 'nowrap',
  overflow: 'hidden'
};

function largestFontSizeThatFits(labelEl, minPx, maxPx) {
  if (!labelEl || labelEl.clientWidth <= 0) return minPx;

  let lo = minPx;
  let hi = maxPx;
  let best = minPx;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    labelEl.style.fontSize = `${mid}px`;
    const overflows = labelEl.scrollWidth > labelEl.clientWidth + 1;
    if (overflows) {
      hi = mid - 1;
    } else {
      best = mid;
      lo = mid + 1;
    }
  }

  return best;
}

/** Logo + title label used in TutaNotes Cloud / USB headers. */
export default function TutaNotesBrandTitle({
  logoSrc,
  title,
  logoSize = 36,
  sx = null,
  labelSx: labelSxOverride = null,
  fitWidth = false
}) {
  const rowRef = useRef(null);
  const labelRef = useRef(null);
  const [fontPx, setFontPx] = useState(null);

  const refit = useCallback(() => {
    if (!fitWidth) return;
    const labelEl = labelRef.current;
    if (!labelEl) return;
    const next = largestFontSizeThatFits(labelEl, MIN_FONT_PX, MAX_FONT_PX);
    labelEl.style.fontSize = `${next}px`;
    setFontPx(next);
  }, [fitWidth, title, logoSize]);

  useLayoutEffect(() => {
    if (!fitWidth) {
      setFontPx(null);
      if (labelRef.current) labelRef.current.style.fontSize = '';
      return undefined;
    }

    refit();
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === 'undefined') return undefined;

    const ro = new ResizeObserver(() => {
      window.requestAnimationFrame(refit);
    });
    ro.observe(row);
    window.addEventListener('resize', refit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', refit);
    };
  }, [fitWidth, refit]);

  return (
    <Box ref={rowRef} sx={{ ...titleRowSx, ...(sx || null) }}>
      {logoSrc ? (
        <Box
          component="img"
          src={logoSrc}
          alt=""
          aria-hidden
          sx={{ ...logoSx, width: logoSize, height: logoSize }}
        />
      ) : null}
      <Box
        ref={labelRef}
        component="span"
        sx={{
          ...labelBaseSx,
          ...(labelSxOverride || null),
          ...(fitWidth
            ? {
                fontSize: fontPx != null ? `${fontPx}px` : `${MIN_FONT_PX}px`,
                overflow: 'hidden',
                textOverflow: 'clip'
              }
            : null)
        }}
      >
        {title}
      </Box>
    </Box>
  );
}

TutaNotesBrandTitle.propTypes = {
  logoSrc: PropTypes.string,
  title: PropTypes.node.isRequired,
  logoSize: PropTypes.number,
  sx: PropTypes.object,
  labelSx: PropTypes.object,
  fitWidth: PropTypes.bool
};
