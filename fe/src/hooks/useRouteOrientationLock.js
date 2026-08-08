import { useEffect, useRef } from 'react';

import { useLocation } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';

/** My photo album, All Singles, My Picks — portrait on mobile/narrow only */
const PORTRAIT_PATHS = new Set(['/myStory', '/vsingles/myStory', '/vsingles/myStore', '/allSingles', '/myPicks', '/interestedSingles']);

/** My Vetting Info, Received Requests, Outgoing Requests — landscape on mobile/narrow only */
export const LANDSCAPE_PATHS = new Set(['/verifyself', RECEIVED_BIO_REQUESTS_PATH, '/vettedFriends']);

function lockModeForPath(pathname) {
  if (PORTRAIT_PATHS.has(pathname)) return 'portrait';
  if (LANDSCAPE_PATHS.has(pathname)) return 'landscape';
  if (pathname.startsWith('/vettedFriends')) return 'landscape';
  if (pathname.startsWith('/request-ive-sent')) return 'landscape';
  return null;
}

/**
 * Sub-lg viewports only: lock screen orientation per dating menu routes.
 * Portrait: My photo album, All Singles, My Picks.
 * Landscape: My Vetting Info, Received Requests, Outgoing Requests.
 * Uses Screen Orientation API. Portrait routes: retried on pointer/touch (often needs a user gesture).
 * Landscape routes: initial lock only — use the floating orientation control to lock after a tap.
 * Desktop (lg+) unchanged. Unlocks when leaving these routes.
 */
export default function useRouteOrientationLock() {
  const { pathname } = useLocation();
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('lg'));
  const lockedRef = useRef(false);

  const lockMode = isNarrow ? lockModeForPath(pathname) : null;

  useEffect(() => {
    if (!lockMode || typeof window === 'undefined') return undefined;

    const orient = window.screen?.orientation;
    if (!orient || typeof orient.lock !== 'function' || typeof orient.unlock !== 'function') {
      return undefined;
    }

    let cancelled = false;

    const tryLock = async () => {
      try {
        await orient.lock(lockMode);
        if (!cancelled) lockedRef.current = true;
      } catch {
        // NotAllowedError, NotSupportedError, etc.
      }
    };

    void tryLock();

    const onGesture = () => {
      void tryLock();
    };
    if (lockMode === 'portrait') {
      window.addEventListener('pointerdown', onGesture, { passive: true });
      window.addEventListener('touchend', onGesture, { passive: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('touchend', onGesture);
      if (lockedRef.current) {
        try {
          orient.unlock();
        } catch {
          //
        }
        lockedRef.current = false;
      }
    };
  }, [lockMode]);
}
