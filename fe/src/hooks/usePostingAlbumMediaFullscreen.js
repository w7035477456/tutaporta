import { useCallback, useState } from 'react';

export function usePostingAlbumMediaFullscreen() {
  const [state, setState] = useState(null);

  const openFullscreenMedia = useCallback((mediaUrl, overlayLines = []) => {
    const url = String(mediaUrl ?? '').trim();
    if (!url) return;
    const lines = (Array.isArray(overlayLines) ? overlayLines : [overlayLines])
      .map((line) => String(line ?? '').trim())
      .filter(Boolean);
    setState({ mediaUrl: url, overlayLines: lines });
  }, []);

  const closeFullscreenMedia = useCallback(() => {
    setState(null);
  }, []);

  return {
    fullscreenOpen: Boolean(state?.mediaUrl),
    fullscreenMediaUrl: state?.mediaUrl ?? '',
    fullscreenOverlayLines: state?.overlayLines ?? [],
    openFullscreenMedia,
    closeFullscreenMedia
  };
}
