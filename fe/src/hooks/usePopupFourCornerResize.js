import { useCallback, useEffect, useState } from 'react';

function viewportSizeToPx(value, axis = 'width') {
  const vwMatch = String(value).match(/^([\d.]+)vw$/);
  if (vwMatch) return Math.round((Number(vwMatch[1]) / 100) * window.innerWidth);
  const vhMatch = String(value).match(/^([\d.]+)vh$/);
  if (vhMatch) return Math.round((Number(vhMatch[1]) / 100) * window.innerHeight);
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

/**
 * Four-corner drag resize for viewport-centered popups.
 * Returns pixel width/height plus center offset while open.
 */
export default function usePopupFourCornerResize({
  open,
  enabled = false,
  defaultWidth = '75vw',
  defaultHeight = '70vh',
  minWidth = 320,
  minHeight = 280,
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
      return { width, height, offsetX: 0, offsetY: 0 };
    });
  }, [open, enabled, defaultWidth, defaultHeight]);

  const onCornerResizeStart = useCallback(
    (corner) => (event) => {
      if (!enabled || !panelSize) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const startWidth = panelSize.width;
      const startHeight = panelSize.height;
      const startOffsetX = panelSize.offsetX || 0;
      const startOffsetY = panelSize.offsetY || 0;
      const maxWidthPx = viewportSizeToPx(maxWidth, 'width') ?? Math.round(window.innerWidth * 0.95);
      const maxHeightPx = viewportSizeToPx(maxHeight, 'height') ?? Math.round(window.innerHeight * 0.92);

      const cursorForCorner = {
        nw: 'nwse-resize',
        ne: 'nesw-resize',
        sw: 'nesw-resize',
        se: 'nwse-resize'
      };

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        let deltaW = 0;
        let deltaH = 0;
        if (corner === 'se') {
          deltaW = dx;
          deltaH = dy;
        } else if (corner === 'sw') {
          deltaW = -dx;
          deltaH = dy;
        } else if (corner === 'ne') {
          deltaW = dx;
          deltaH = -dy;
        } else if (corner === 'nw') {
          deltaW = -dx;
          deltaH = -dy;
        }

        const width = Math.min(maxWidthPx, Math.max(minWidth, startWidth + deltaW));
        const height = Math.min(maxHeightPx, Math.max(minHeight, startHeight + deltaH));
        const appliedDx = width - startWidth;
        const appliedDy = height - startHeight;

        setPanelSize({
          width,
          height,
          offsetX: startOffsetX + appliedDx / 2,
          offsetY: startOffsetY + appliedDy / 2
        });
      };

      const onUp = () => {
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = cursorForCorner[corner] || 'nwse-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [enabled, panelSize, minWidth, minHeight, maxWidth, maxHeight]
  );

  return { panelSize, onCornerResizeStart };
}
