import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

import Box from '@mui/material/Box';

/**
 * Uniformly shrinks children so their visual height fits maxHeightPx while the
 * scaled result still spans the full container width (layout width = width / scale).
 * Disabled: renders children unchanged.
 */
export default function ScaleToFitHeightBox({ enabled = true, maxHeightPx, minScale = 0.4, children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const measuringRef = useRef(false);
  const [fit, setFit] = useState({ scale: 1, width: 0, height: 0 });

  const measure = useCallback(() => {
    if (!enabled || measuringRef.current) return;
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || !maxHeightPx) return;
    const width = outer.clientWidth;
    if (!width) return;

    measuringRef.current = true;
    const prevWidth = inner.style.width;
    const prevTransform = inner.style.transform;
    const heightAt = (scale) => {
      inner.style.width = `${width / scale}px`;
      inner.style.transform = 'none';
      return inner.scrollHeight * scale;
    };
    let scale = 1;
    let height = heightAt(1);
    if (height > maxHeightPx + 1) {
      let lo = minScale;
      let hi = 1;
      scale = minScale;
      height = heightAt(minScale);
      for (let i = 0; i < 8; i += 1) {
        const mid = (lo + hi) / 2;
        const h = heightAt(mid);
        if (h <= maxHeightPx) {
          scale = mid;
          height = h;
          lo = mid;
        } else {
          hi = mid;
        }
      }
    }
    inner.style.width = prevWidth;
    inner.style.transform = prevTransform;
    measuringRef.current = false;

    const next = { scale, width, height: Math.ceil(height) };
    setFit((prev) =>
      Math.abs(prev.scale - next.scale) < 0.005 && prev.width === next.width && Math.abs(prev.height - next.height) < 2
        ? prev
        : next
    );
  }, [enabled, maxHeightPx, minScale]);

  useLayoutEffect(() => {
    if (!enabled) return undefined;
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => measure());
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, [enabled, measure, children]);

  if (!enabled) return children;

  const { scale, width, height } = fit;
  const overflows = maxHeightPx && height > maxHeightPx + 1;

  return (
    <Box
      ref={outerRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: height ? `${overflows ? maxHeightPx : height}px` : 'auto',
        overflowX: 'hidden',
        overflowY: overflows ? 'auto' : 'hidden'
      }}
    >
      <Box
        ref={innerRef}
        sx={{
          position: height ? 'absolute' : 'static',
          top: 0,
          left: 0,
          width: width ? `${width / scale}px` : '100%',
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

ScaleToFitHeightBox.propTypes = {
  enabled: PropTypes.bool,
  maxHeightPx: PropTypes.number,
  minScale: PropTypes.number,
  children: PropTypes.node
};
