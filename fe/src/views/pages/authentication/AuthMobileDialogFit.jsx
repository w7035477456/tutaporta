import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

/** Mobile auth card width as a fraction of the viewport (red-box target). */
export const MOBILE_DIALOG_TARGET_WIDTH_FRAC = 0.96; //by ANDREWTON, DO NOT REMOVE THIS CODE
/** Share of the viewport height the card may occupy before content must shrink. */
export const MOBILE_DIALOG_MAX_VISIBLE_HEIGHT_FRAC = 0.96; //by ANDREWTON, DO NOT REMOVE THIS CODE

const MIN_CONTENT_SCALE = 0.4;

/**
 * Phone / tablet (below md): the black card already fills the viewport box.
 * Shrink the form inside it, keeping the scaled result the full card width,
 * so sign-in and registration fit without scrolling.
 * Desktop: children unchanged.
 */
export default function AuthMobileDialogFit({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const measuringRef = useRef(false);
  const [scale, setScale] = useState(1);

  const updateScale = useCallback(() => {
    if (!isMobile || measuringRef.current) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const availH = viewport.clientHeight;
    if (!availH) return;

    measuringRef.current = true;
    const prevWidth = content.style.width;
    const prevTransform = content.style.transform;
    const heightAt = (width) => {
      content.style.width = width;
      content.style.transform = 'none';
      return content.scrollHeight;
    };
    const budget = availH * MOBILE_DIALOG_MAX_VISIBLE_HEIGHT_FRAC;
    const heightAtFull = heightAt('100%');
    let next = 1;
    if (heightAtFull > budget + 1) {
      let lo = MIN_CONTENT_SCALE;
      let hi = 1;
      next = MIN_CONTENT_SCALE;
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) / 2;
        const visualH = heightAt(`${100 / mid}%`) * mid;
        if (visualH <= budget) {
          next = mid;
          lo = mid;
        } else {
          hi = mid;
        }
      }
    }
    content.style.width = prevWidth;
    content.style.transform = prevTransform;
    measuringRef.current = false;
    setScale((prev) => (Math.abs(prev - next) < 0.008 ? prev : next));
  }, [isMobile]);

  useLayoutEffect(() => {
    if (!isMobile) return undefined;
    updateScale();
    const ro = new ResizeObserver(() => updateScale());
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    window.addEventListener('resize', updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [isMobile, updateScale, children]);

  if (!isMobile) {
    return children;
  }

  const layoutWidth = scale < 0.999 ? `${100 / scale}%` : '100%';

  return (
    <Box
      ref={viewportRef}
      sx={{
        flex: '1 1 auto',
        minHeight: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      <Box
        ref={contentRef}
        sx={{
          width: layoutWidth,
          maxWidth: 'none',
          position: 'absolute',
          left: '50%',
          top: 0,
          transform: `translateX(-50%) scale(${scale})`,
          transformOrigin: 'top center'
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
