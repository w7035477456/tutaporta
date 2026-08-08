import { useCallback, useRef, useState } from 'react';

import { readPressHoldToZoomEnabled } from 'config/pressHoldZoomEnv';

/** After this many ms with pointer down, treat as “press and hold” for zoom suppression. */
const HOLD_MS = 400;

/**
 * When PRESS_HOLD_TO_ZOOM is false: after HOLD_MS with pointer down, suppress scale zoom until release.
 * Quick taps stay under HOLD_MS so :active zoom still shows. When env is true, no suppression (legacy behavior).
 */
export default function usePressHoldZoomSuppression() {
  const pressHoldToZoom = readPressHoldToZoomEnabled();
  const [suppressPressHoldZoom, setSuppressPressHoldZoom] = useState(false);
  const holdTimerRef = useRef(null);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current != null) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  const onPointerDown = useCallback(() => {
    if (pressHoldToZoom) return;
    clearHoldTimer();
    setSuppressPressHoldZoom(false);
    holdTimerRef.current = window.setTimeout(() => {
      setSuppressPressHoldZoom(true);
      holdTimerRef.current = null;
    }, HOLD_MS);
  }, [pressHoldToZoom, clearHoldTimer]);

  const endPointer = useCallback(() => {
    clearHoldTimer();
    setSuppressPressHoldZoom(false);
  }, [clearHoldTimer]);

  const pointerProps = pressHoldToZoom
    ? {}
    : {
        onPointerDown,
        onPointerUp: endPointer,
        onPointerCancel: endPointer,
        onPointerLeave: endPointer
      };

  return { suppressPressHoldZoom, pressHoldToZoom, pointerProps };
}
