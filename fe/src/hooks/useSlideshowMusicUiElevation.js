import { useEffect } from 'react';
import { useBackgroundMusic } from 'contexts/BackgroundMusicContext';
import { PHOTO_ALBUMS_SLIDESHOW_BASE_Z } from 'config/photoAlbumsLayout';

/** Raise Track dialog + mini YouTube player above album/photo slideshow layers. */
export function useSlideshowMusicUiElevation(active = true, slideshowBaseZ = PHOTO_ALBUMS_SLIDESHOW_BASE_Z) {
  const { registerSlideshowMusicUi } = useBackgroundMusic();

  useEffect(() => {
    if (!active || typeof registerSlideshowMusicUi !== 'function') return undefined;
    return registerSlideshowMusicUi(slideshowBaseZ);
  }, [active, registerSlideshowMusicUi, slideshowBaseZ]);
}
