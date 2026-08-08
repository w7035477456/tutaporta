import { useEffect, useState } from 'react';
import { estimateBrowserZoomPercent } from 'utils/estimateBrowserZoomPercent';

/** Live browser page-zoom estimate — DPR / pinch only; resize re-baselines to 100%. */
export default function useBrowserZoomPercent() {
  const [browserZoomPct, setBrowserZoomPct] = useState(() => estimateBrowserZoomPercent());

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let mediaCleanup = null;

    const update = () => {
      setBrowserZoomPct(estimateBrowserZoomPercent());
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

    // Resize only re-baselines viewport metrics (returns 100%) — never blocks on geometry drift.
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);

    return () => {
      mediaCleanup?.();
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);

  return browserZoomPct;
}
