import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import useBrowserZoomPercent from 'hooks/useBrowserZoomPercent';

/** Fixed lower-left: viewport px + optional browser zoom estimate. Gated by `VITE_SHOW_VIEWPORT_SIZE`. */
export default function ViewportSizeReadout() {
  const theme = useTheme();
  const isMobileBreakpoint = useMediaQuery(theme.breakpoints.down('md'));
  const browserZoomPct = useBrowserZoomPercent();

  const [dims, setDims] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0
  }));

  useEffect(() => {
    const update = () => {
      setDims({ w: window.innerWidth, h: window.innerHeight });
    };
    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  const mode = isMobileBreakpoint ? 'M' : 'B';
  const browserZoomLabel =
    browserZoomPct == null ? null : browserZoomPct === 100 ? '100% zoom' : `${browserZoomPct}% zoom`;

  return (
    <Box
      component="output"
      aria-live="polite"
      aria-label={`Viewport ${dims.w} by ${dims.h} pixels${browserZoomLabel ? `, browser ${browserZoomLabel}` : ''}, ${mode === 'M' ? 'mobile' : 'browser'} breakpoint`}
      sx={{
        position: 'fixed',
        left: '0.5vw',
        bottom: '0.5vh',
        zIndex: 10000,
        px: '0.5vw',
        py: '0.35vh',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: { xs: '2.5vw', sm: '0.75vw' },
        lineHeight: 1.25,
        color: 'rgba(255,255,255,0.95)',
        bgcolor: 'rgba(0,0,0,0.58)',
        borderRadius: 1,
        pointerEvents: 'none',
        userSelect: 'none',
        boxShadow: '0 1px 4px rgba(0,0,0,0.35)'
      }}
    >
      <Box component="span" sx={{ fontWeight: 700, mr: 0.75 }}>
        {mode}
      </Box>
      {dims.w}px w x {dims.h}px h
      {browserZoomLabel ? (
        <Box component="span" sx={{ display: 'block', mt: 0.25 }}>
          {browserZoomLabel}
        </Box>
      ) : null}
    </Box>
  );
}
