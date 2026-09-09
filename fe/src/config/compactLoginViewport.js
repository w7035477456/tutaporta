import { useEffect, useState } from 'react';

/**
 * Compact / phone viewports (same rule as login mobile detect on onlinemall.website).
 * - Portrait phones: max-width 600px (stable width).
 * - Landscape phones: short viewports that are still phone-wide, not a shrink-tall desktop window.
 *
 * Avoid a bare max-height rule: mobile browsers change the layout viewport when the URL bar
 * hides, which can flip (max-height: 667px) off after a dialog closes.
 */
export const COMPACT_LOGIN_MEDIA = '(max-width: 600px), ((max-width: 926px) and (max-height: 540px))';

export function compactLoginMatches() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return Boolean(window.matchMedia(COMPACT_LOGIN_MEDIA).matches);
}

/** Subscribe to compact viewport changes (width/height media query). */
export function useCompactLoginViewport() {
  const [compact, setCompact] = useState(() => compactLoginMatches());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const mq = window.matchMedia(COMPACT_LOGIN_MEDIA);
    const sync = () => setCompact(Boolean(mq.matches));
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return compact;
}
