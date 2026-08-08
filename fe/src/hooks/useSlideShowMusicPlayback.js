import { useEffect, useRef } from 'react';
import { useBackgroundMusic } from 'contexts/BackgroundMusicContext';
import { SLIDE_SHOW_MUSIC_SLOT_INDEX } from 'api/userCustomizationFe';
import { SLIDE_SHOW_MUSIC_URL } from 'config/slideShowMusicUrl';
import { normalizeYoutubeMusicUrl } from 'utils/normalizeYoutubeMusicUrl';

/**
 * Photo / Album slideshow: auto-play Slide Show Music (Track → Play 10 URL).
 * Manual Track → Play 1…9 still works and is not overwritten after pick.
 */
export function useSlideShowMusicPlayback(active) {
  const {
    volume,
    preferenceLoaded,
    customMusicUrls,
    playCustomMusicFromSlot,
    stopCustomMusicPlayback,
    setVolume,
    resetSlideshowMusicAutoStart
  } = useBackgroundMusic();
  const autoStartedRef = useRef(false);
  const wasActiveRef = useRef(false);
  const customMusicUrlsRef = useRef(customMusicUrls);
  customMusicUrlsRef.current = customMusicUrls;

  useEffect(() => {
    if (!active) {
      if (wasActiveRef.current) {
        resetSlideshowMusicAutoStart?.();
        stopCustomMusicPlayback();
      }
      wasActiveRef.current = false;
      autoStartedRef.current = false;
      return undefined;
    }

    if (!wasActiveRef.current) {
      resetSlideshowMusicAutoStart?.();
      autoStartedRef.current = false;
    }
    wasActiveRef.current = true;

    if (!preferenceLoaded) return undefined;

    if (!(Number(volume) > 0)) {
      void setVolume(50, { localOnly: true });
    }

    if (autoStartedRef.current) return undefined;

    const memorized = normalizeYoutubeMusicUrl(
      customMusicUrlsRef.current?.[SLIDE_SHOW_MUSIC_SLOT_INDEX]
    );
    const slideShowUrl = memorized || SLIDE_SHOW_MUSIC_URL;
    const ok = playCustomMusicFromSlot(SLIDE_SHOW_MUSIC_SLOT_INDEX, slideShowUrl, {
      auto: true,
      userInitiated: false,
      startMuted: false
    });
    if (ok) {
      autoStartedRef.current = true;
    }

    return undefined;
  }, [
    active,
    preferenceLoaded,
    playCustomMusicFromSlot,
    stopCustomMusicPlayback,
    resetSlideshowMusicAutoStart,
    setVolume
  ]);
}
