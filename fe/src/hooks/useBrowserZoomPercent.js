import { useEffect, useState } from 'react';
import { BROWSER_ZOOM_TOLERANCE_PCT, estimateBrowserZoomPercent } from 'utils/estimateBrowserZoomPercent';

const CONFIRM_NON_DEFAULT_MS = 200;

function isDefaultZoom(pct) {
  return pct == null || Math.abs(pct - 100) <= BROWSER_ZOOM_TOLERANCE_PCT;
}

/** Live browser page-zoom estimate — layout outer/inner (not Retina DPR). */
export default function useBrowserZoomPercent() {
  const [browserZoomPct, setBrowserZoomPct] = useState(100);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let mediaCleanup = null;
    let confirmTimer = null;

    const publish = (pct) => {
      setBrowserZoomPct(pct == null ? 100 : pct);
    };

    const update = () => {
      const pct = estimateBrowserZoomPercent();
      if (isDefaultZoom(pct)) {
        if (confirmTimer) {
          clearTimeout(confirmTimer);
          confirmTimer = null;
        }
        publish(pct);
        return;
      }

      if (confirmTimer) return;
      confirmTimer = setTimeout(() => {
        confirmTimer = null;
        const again = estimateBrowserZoomPercent();
        publish(isDefaultZoom(again) ? 100 : again);
      }, CONFIRM_NON_DEFAULT_MS);
    };

    const bindDprMediaQuery = () => {
      mediaCleanup?.();
      if (typeof window.matchMedia !== 'function') return;
      const mqString = `(resolution: ${window.devicePixelRatio}dppx)`;
      const media = window.matchMedia(mqString);
      const onChange = () => {
        update();
        bindDprMediaQuery();
      };
      media.addEventListener('change', onChange);
      mediaCleanup = () => media.removeEventListener('change', onChange);
    };

    update();
    bindDprMediaQuery();

    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      mediaCleanup?.();
      if (confirmTimer) clearTimeout(confirmTimer);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return browserZoomPct;
}
