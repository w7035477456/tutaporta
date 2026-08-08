import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  clampColorTemplate11PostingPhotoHeightPx,
  getColorTemplate11PostingPhotoDefaultHeightPx,
  readColorTemplate11PostingFeedInitialPhotoHeightPx,
  readColorTemplate11PostingPhotoHeightsMap,
  writeColorTemplate11PostingFeedPhotoHeightPx,
  writeColorTemplate11PostingPhotoHeight,
  writeColorTemplate11PostingPhotoHeightsForPostIds
} from 'config/colorTemplate11Posting';

const ColorTemplate11PostingPhotoHeightContext = createContext(null);

function readInitialHeightPx(postId) {
  const map = readColorTemplate11PostingPhotoHeightsMap();
  const stored = map[String(postId)];
  if (Number.isFinite(stored) && stored > 0) {
    return clampColorTemplate11PostingPhotoHeightPx(stored);
  }
  return getColorTemplate11PostingPhotoDefaultHeightPx();
}

function useStartPhotoHeightResize(heightPx, setHeightPx) {
  return useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startHeight = heightPx;

      const onMove = (moveEvent) => {
        const next = clampColorTemplate11PostingPhotoHeightPx(startHeight + (moveEvent.clientY - startY));
        setHeightPx(next);
      };

      const onUp = () => {
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ns-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [heightPx, setHeightPx]
  );
}

export function ColorTemplate11PostingPhotoHeightProvider({ postIds, children }) {
  const stablePostIds = useMemo(
    () => (Array.isArray(postIds) ? postIds.map((id) => String(id)).filter(Boolean) : []),
    [postIds]
  );
  const postIdsKey = stablePostIds.join(',');

  const [heightPx, setHeightPxState] = useState(() => readColorTemplate11PostingFeedInitialPhotoHeightPx(stablePostIds));

  const setHeightPx = useCallback(
    (next) => {
      setHeightPxState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        const clamped = clampColorTemplate11PostingPhotoHeightPx(resolved);
        writeColorTemplate11PostingFeedPhotoHeightPx(clamped);
        writeColorTemplate11PostingPhotoHeightsForPostIds(stablePostIds, clamped);
        return clamped;
      });
    },
    [stablePostIds]
  );

  useEffect(() => {
    if (!stablePostIds.length) return;
    writeColorTemplate11PostingPhotoHeightsForPostIds(stablePostIds, heightPx);
  }, [postIdsKey, heightPx, stablePostIds]);

  const startResize = useStartPhotoHeightResize(heightPx, setHeightPx);

  const value = useMemo(
    () => ({
      heightPx,
      setHeightPx,
      startResize
    }),
    [heightPx, setHeightPx, startResize]
  );

  return (
    <ColorTemplate11PostingPhotoHeightContext.Provider value={value}>{children}</ColorTemplate11PostingPhotoHeightContext.Provider>
  );
}

export function useColorTemplate11PostingPhotoHeight(postId) {
  const feedContext = useContext(ColorTemplate11PostingPhotoHeightContext);
  const [heightPx, setHeightPxState] = useState(() => readInitialHeightPx(postId));

  const setHeightPxLocal = useCallback(
    (next) => {
      setHeightPxState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        const clamped = clampColorTemplate11PostingPhotoHeightPx(resolved);
        writeColorTemplate11PostingPhotoHeight(postId, clamped);
        return clamped;
      });
    },
    [postId]
  );

  const startResizeLocal = useStartPhotoHeightResize(heightPx, setHeightPxLocal);

  if (feedContext) {
    return feedContext;
  }

  return { heightPx, setHeightPx: setHeightPxLocal, startResize: startResizeLocal };
}
