import { createContext, useContext, useMemo, useState } from 'react';

/** When the Screen Orientation API cannot lock, we simulate layout via CSS rotation. */
export function computeEffectiveLandscape(physLandscape, simulation) {
  if (simulation === 'landscape') return true;
  if (simulation === 'portrait') return false;
  return physLandscape;
}

const MobileOrientationSimContext = createContext(null);

export function MobileOrientationSimProvider({ children }) {
  const [simulation, setSimulation] = useState(null);
  const value = useMemo(() => ({ simulation, setSimulation }), [simulation]);
  return <MobileOrientationSimContext.Provider value={value}>{children}</MobileOrientationSimContext.Provider>;
}

export function useMobileOrientationSim() {
  const ctx = useContext(MobileOrientationSimContext);
  if (!ctx) {
    throw new Error('useMobileOrientationSim must be used within MobileOrientationSimProvider');
  }
  return ctx;
}
