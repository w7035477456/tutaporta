import { useCallback, useLayoutEffect, useState } from 'react';

import { drawerWidthFallback, drawerWidthMinPx } from 'store/constant';
import { measureNavDrawerOpenWidthPx } from 'utils/measureNavDrawerOpenWidth';

/** Sidebar width when open — 30% of viewport, updates on window resize. */
export default function useNavDrawerOpenWidthPx() {
  const compute = useCallback(() => {
    if (typeof window === 'undefined') return drawerWidthFallback;
    return measureNavDrawerOpenWidthPx(window.innerWidth, { minPx: drawerWidthMinPx });
  }, []);

  const [widthPx, setWidthPx] = useState(() => (typeof window !== 'undefined' ? compute() : drawerWidthFallback));

  useLayoutEffect(() => {
    setWidthPx(compute());
    const onResize = () => setWidthPx(compute());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [compute]);

  return widthPx;
}
