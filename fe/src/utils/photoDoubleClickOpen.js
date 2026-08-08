import { useCallback, useRef } from 'react';

/** Desktop double-click + mobile double-tap to open fullscreen media. */
export function usePhotoDoubleClickOpen(onOpen) {
  const lastClickAtRef = useRef(0);
  const lastFiredAtRef = useRef(0);

  const handleOpen = useCallback(() => {
    if (typeof onOpen !== 'function') return;
    const now = Date.now();
    if (now - lastFiredAtRef.current < 450) return;
    lastFiredAtRef.current = now;
    onOpen();
  }, [onOpen]);

  const handleDoubleClick = useCallback(
    (event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      handleOpen();
    },
    [handleOpen]
  );

  const handleClick = useCallback(() => {
    const now = Date.now();
    const elapsed = now - lastClickAtRef.current;
    lastClickAtRef.current = now;
    if (elapsed > 0 && elapsed <= 350) {
      handleOpen();
    }
  }, [handleOpen]);

  const doubleClickSx = typeof onOpen === 'function' ? { cursor: 'zoom-in' } : {};

  return { handleClick, handleDoubleClick, doubleClickSx };
}
