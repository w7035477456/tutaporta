import PropTypes from 'prop-types';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import {
  colorTemplate4TitlesPhraseBoxSx,
  colorTemplate4TitlesPhraseTextSx
} from 'config/colorTemplate4Titles';

const MIN_FONT_PX = 9;
const MAX_FONT_PX = 72;

function largestFontSizeThatFits(container, textEl, minPx, maxPx) {
  if (!container || !textEl || container.clientWidth <= 0 || container.clientHeight <= 0) {
    return minPx;
  }

  let lo = minPx;
  let hi = maxPx;
  let best = minPx;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    textEl.style.fontSize = `${mid}px`;
    const overflows =
      textEl.scrollHeight > container.clientHeight + 1 || textEl.scrollWidth > container.clientWidth + 1;
    if (overflows) {
      hi = mid - 1;
    } else {
      best = mid;
      lo = mid + 1;
    }
  }

  return best;
}

/**
 * Sidebar cursive phrase — scales font to the largest size that stays inside the phrase box.
 */
export default function ColorTemplate4TitlesPhrase({ children, sx, textSx }) {
  const containerRef = useRef(null);
  const textRef = useRef(null);
  const [fontPx, setFontPx] = useState(null);

  const refit = useCallback(() => {
    const container = containerRef.current;
    const textEl = textRef.current;
    if (!container || !textEl) return;

    const next = largestFontSizeThatFits(container, textEl, MIN_FONT_PX, MAX_FONT_PX);
    textEl.style.fontSize = `${next}px`;
    setFontPx(next);
  }, [children]);

  useLayoutEffect(() => {
    refit();
    const container = containerRef.current;
    if (!container) return undefined;

    const ro = new ResizeObserver(() => refit());
    ro.observe(container);
    window.addEventListener('resize', refit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', refit);
    };
  }, [refit]);

  return (
    <Box
      ref={containerRef}
      sx={{ ...colorTemplate4TitlesPhraseBoxSx(), height: '100%', ...(sx || {}) }}
    >
      <Box
        ref={textRef}
        component="span"
        sx={{
          ...colorTemplate4TitlesPhraseTextSx(),
          ...(textSx || {}),
          fontSize: fontPx != null ? `${fontPx}px` : `${MIN_FONT_PX}px`,
          visibility: fontPx != null ? 'visible' : 'hidden'
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

ColorTemplate4TitlesPhrase.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object,
  textSx: PropTypes.object
};
