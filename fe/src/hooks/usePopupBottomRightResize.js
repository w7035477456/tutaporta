import { useCallback, useEffect, useState } from 'react';

function viewportSizeToPx(value, axis = 'width') {
  const viewport = axis === 'height' ? window.innerHeight : window.innerWidth;
  const vwMatch = String(value).match(/^([\d.]+)vw$/);
  if (vwMatch) return Math.round((Number(vwMatch[1]) / 100) * window.innerWidth);
  const vhMatch = String(value).match(/^([\d.]+)vh$/);
  if (vhMatch) return Math.round((Number(vhMatch[1]) / 100) * window.innerHeight);
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Bottom-right drag resize for viewport-centered popups.
 * Returns pixel width/height while open; resets when closed.
 */
export default function usePopupBottomRightResize({
  open,
  enabled = false,
  defaultWidth = '75vw',
  defaultHeight = '70vh',
  minWidth = 320,
  minHeight = 240,
  maxWidth = '95vw',
  maxHeight = '92vh'
} = {}) {
  const [panelSize, setPanelSize] = useState(null);

  useEffect(() => {
    if (!open) {
      setPanelSize(null);
      return;
    }
    if (!enabled) return;

    setPanelSize((current) => {
      if (current) return current;
      const width = viewportSizeToPx(defaultWidth, 'width') ?? Math.round(window.innerWidth * 0.75);
      const height = viewportSizeToPx(defaultHeight, 'height') ?? Math.round(window.innerHeight * 0.7);
      return { width, height };
    });
  }, [open, enabled, defaultWidth, defaultHeight]);

  const onResizeStart = useCallback(
    (event) => {
      if (!enabled || !panelSize) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = panelSize.width;
      const startHeight = panelSize.height;
      const maxWidthPx = viewportSizeToPx(maxWidth, 'width') ?? Math.round(window.innerWidth * 0.95);
      const maxHeightPx = viewportSizeToPx(maxHeight, 'height') ?? Math.round(window.innerHeight * 0.92);

      const onMove = (moveEvent) => {
        const width = Math.min(maxWidthPx, Math.max(minWidth, startWidth + (moveEvent.clientX - startX)));
        const height = Math.min(maxHeightPx, Math.max(minHeight, startHeight + (moveEvent.clientY - startY)));
        setPanelSize({ width, height });
      };

      const onUp = () => {
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'nwse-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [enabled, panelSize, minWidth, minHeight, maxWidth, maxHeight]
  );

  return { panelSize, onResizeStart };
}
