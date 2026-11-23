import { useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import PropTypes from 'prop-types';
import { BILL_SCHEDULE_INK } from './billScheduleTheme';

const STORAGE_KEY = 'billScheduleDescColumnWidthPx_v1';
const MIN_WIDTH_PX = 120;
const MAX_WIDTH_PX = 900;
const DEFAULT_WIDTH_PX = 280;

function clampWidthPx(n) {
  return Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, Math.trunc(n)));
}

function readStoredWidthPx() {
  if (typeof window === 'undefined') return DEFAULT_WIDTH_PX;
  try {
    const n = Math.trunc(Number(window.localStorage.getItem(STORAGE_KEY)));
    if (Number.isFinite(n) && n >= MIN_WIDTH_PX && n <= MAX_WIDTH_PX) return n;
  } catch {
    // ignore quota / private mode
  }
  return DEFAULT_WIDTH_PX;
}

function writeStoredWidthPx(widthPx) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(widthPx));
  } catch {
    // ignore quota / private mode
  }
}

function clearStoredWidthPx() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Persistable Bill Description column width + drag handlers. */
export function useBillScheduleDescColumnWidth() {
  const [widthPx, setWidthPx] = useState(readStoredWidthPx);

  const startResize = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const th = event.currentTarget.closest('th');
      const measured = th ? Math.round(th.getBoundingClientRect().width) : 0;
      const startWidth =
        Number.isFinite(measured) && measured > 0 ? measured : widthPx || DEFAULT_WIDTH_PX;
      let latest = startWidth;
      const prevCursor = document.body.style.cursor;
      const prevUserSelect = document.body.style.userSelect;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (moveEvent) => {
        latest = clampWidthPx(startWidth + moveEvent.clientX - startX);
        setWidthPx(latest);
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        document.body.style.cursor = prevCursor;
        document.body.style.userSelect = prevUserSelect;
        writeStoredWidthPx(latest);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [widthPx]
  );

  const resetWidth = useCallback(() => {
    setWidthPx(DEFAULT_WIDTH_PX);
    clearStoredWidthPx();
  }, []);

  const columnStyle = {
    width: widthPx,
    minWidth: widthPx,
    maxWidth: widthPx
  };

  return { widthPx, columnStyle, startResize, resetWidth };
}

/** Drag handle on the right edge of the Bill Description header (double-click resets). */
export function BillScheduleDescColumnResizeHandle({ onPointerDown, onReset }) {
  return (
    <Box
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Bill Description column"
      title="Drag left / right to resize · double-click to reset"
      onPointerDown={onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onReset();
      }}
      onClick={(e) => e.stopPropagation()}
      sx={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        right: -5,
        width: 12,
        cursor: 'col-resize',
        touchAction: 'none',
        zIndex: 3,
        '&::after': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: 3,
          transform: 'translateX(-50%)',
          bgcolor: BILL_SCHEDULE_INK,
          opacity: 0.55
        },
        '&:hover::after, &:active::after': {
          opacity: 1,
          width: 5,
          bgcolor: '#1976d2'
        }
      }}
    />
  );
}

BillScheduleDescColumnResizeHandle.propTypes = {
  onPointerDown: PropTypes.func.isRequired,
  onReset: PropTypes.func.isRequired
};
