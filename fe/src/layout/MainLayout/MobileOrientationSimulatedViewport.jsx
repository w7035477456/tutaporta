import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';

import { useMobileOrientationSim } from 'contexts/MobileOrientationSimContext';

/**
 * When simulation disagrees with the real viewport aspect ratio, rotate the app
 * so narrow portrait viewports can show a landscape layout (and vice versa) without the Orientation API.
 */
export default function MobileOrientationSimulatedViewport({ downLG, children }) {
  const { simulation } = useMobileOrientationSim();
  const [size, setSize] = useState(() =>
    typeof window !== 'undefined' ? { w: window.innerWidth, h: window.innerHeight } : { w: 0, h: 0 }
  );

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const update = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  const portraitViewport = size.w <= size.h;
  const needLandscapeSim = downLG && simulation === 'landscape' && portraitViewport;
  const needPortraitSim = downLG && simulation === 'portrait' && !portraitViewport;

  if (!needLandscapeSim && !needPortraitSim) {
    return children;
  }

  if (needLandscapeSim) {
    return (
      <Box
        sx={{
          position: 'fixed',
          inset: 0,
          overflow: 'hidden',
          zIndex: 1,
          bgcolor: 'background.default'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100vh',
            height: '100vw',
            transform: 'rotate(90deg)',
            transformOrigin: 'top left',
            marginLeft: '100vw',
            overflow: 'auto',
            WebkitOverflowScrolling: 'touch',
            bgcolor: 'background.default'
          }}
        >
          {children}
        </Box>
      </Box>
    );
  }

  /* simulation === 'portrait' on a landscape viewport */
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        overflow: 'hidden',
        zIndex: 1,
        bgcolor: 'background.default'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: '100%',
          left: 0,
          width: '100vh',
          height: '100vw',
          transform: 'rotate(-90deg)',
          transformOrigin: 'left top',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          bgcolor: 'background.default'
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
