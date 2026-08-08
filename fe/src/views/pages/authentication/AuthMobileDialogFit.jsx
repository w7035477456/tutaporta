import { useCallback, useEffect, useRef, useState } from 'react';

import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

import { getMobileScrollbarVertical, getMobileScrollbarHorizontal } from 'config/authDialogEnv';
import { getAuthDialogWidthVwMobile } from 'config/standardAuthDialogEnv';

/** Legacy fallback only; mobile width target from DIALOG_WIDTH_MOBILE. */
const MOBILE_DIALOG_TARGET_WIDTH_FRAC = 0.96; //by ANDREWTON, DO NOT REMOVE THIS CODE
/** Max visible height before vertical scroll (96% VH → 2% top + 2% bottom margin). */
const MOBILE_DIALOG_MAX_VISIBLE_HEIGHT_FRAC = 0.96; //by ANDREWTON, DO NOT REMOVE THIS CODE

/**
 * Mobile only: scale down only when content is wider than the auth dialog column (DIALOG_WIDTH_MOBILE).
 * Do not use --app-dialog-scale here: on narrow viewports it is ~0.73 and forced the card to look ~60% VW wide.
 * Desktop: children unchanged.
 * See 83_tryMakeCardGreenAlwaysFullsizeAuthInnerStackLarger.
 */
export default function AuthMobileDialogFit({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const viewportRef = useRef(null);
  const contentRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState('auto');
  const [needsVerticalScroll, setNeedsVerticalScroll] = useState(false);

  const updateScale = useCallback(() => {
    if (!isMobile) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const vw = typeof window !== 'undefined' ? window.innerWidth : viewport.clientWidth;
    const vh = typeof window !== 'undefined' ? window.innerHeight : viewport.clientHeight;
    const nw = content.scrollWidth;
    const nh = content.scrollHeight;
    if (!vw || !vh || !nw || !nh) return;

    const dw = getAuthDialogWidthVwMobile();
    const dialogWidthFrac = Number.isFinite(dw) && dw > 0 ? dw / 100 : MOBILE_DIALOG_TARGET_WIDTH_FRAC;
    const targetWidthPx = dialogWidthFrac * vw;
    const rawScale = targetWidthPx / Math.max(nw, 1);
    const scaleForWidth = Math.min(1, rawScale);
    const scaledContentHeight = nh * scaleForWidth;
    // Prefer the real scroll viewport height (area above fixed footer); before layout, reserve space for footer + padding
    const viewportLaidOut = viewport.clientHeight > 48;
    const maxVisiblePx = viewportLaidOut
      ? viewport.clientHeight
      : Math.min(MOBILE_DIALOG_MAX_VISIBLE_HEIGHT_FRAC * vh, Math.max(120, vh - 168));
    const scroll = scaledContentHeight > maxVisiblePx + 1;

    setScale(scaleForWidth);
    setScaledHeight(`${scaledContentHeight}px`);
    setNeedsVerticalScroll(scroll);
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) return;
    updateScale();
    const ro = new ResizeObserver(updateScale);
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (contentRef.current) ro.observe(contentRef.current);
    window.addEventListener('resize', updateScale);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [isMobile, updateScale]);

  if (!isMobile) {
    return children;
  }

  const ovX = getMobileScrollbarHorizontal() ? 'auto' : 'hidden';
  const ovY = needsVerticalScroll
    ? 'auto'
    : getMobileScrollbarVertical()
      ? 'auto'
      : 'hidden';

  return (
    <Box
      sx={{
        flex: '1 1 0',
        minHeight: 0,
        width: '100%',
        maxWidth: '100%',
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        alignSelf: 'stretch',
        boxSizing: 'border-box',
        // Top of dialog stays inside the real viewport (not “above” the red safe area)
        pt: { xs: 'max(8px, env(safe-area-inset-top, 0px))', md: 0 }
      }}
    >
      <Box
        ref={viewportRef}
        sx={{
          width: '100%',
          maxWidth: '100%',
          flex: needsVerticalScroll ? '1 1 0' : '0 1 auto',
          // Use parent height (area above footer), not a fraction of full dvh — avoids clipping vs fixed footer
          ...(needsVerticalScroll ? { minHeight: 0, maxHeight: '100%' } : {}),
          overflowX: ovX,
          overflowY: ovY,
          WebkitOverflowScrolling: 'touch',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          boxSizing: 'border-box',
          px: { xs: 0.5, sm: 0 }
        }}
      >
        <Box
          sx={{
            width: '100%',
            maxWidth: '100%',
            minHeight: 0,
            height: scaledHeight,
            overflow: 'hidden'
          }}
        >
          <Box
            ref={contentRef}
            sx={{
              transform: `scale(${scale})`,
              transformOrigin: 'top center',
              width: '100%',
              maxWidth: '100%'
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
