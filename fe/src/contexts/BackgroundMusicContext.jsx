import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';

import { useAuth } from 'contexts/AuthContext';
import { fetchUserCustomization, saveUserCustomization, loadDefaultCustomMusicUrls as fetchDefaultCustomMusicUrlsApi, emptyCustomMusicUrlSlots, CUSTOM_MUSIC_URL_SLOT_COUNT } from 'api/userCustomizationFe';
import {
  BACKGROUND_TRACK_SRC,
  normalizeSoundPreference,
  normalizeVsinglesLyric,
  volumeFromDb
} from 'config/soundPreference';
import { consumeSecretLoginDemoVolume } from 'utils/secretLoginDemoVolume';
import { normalizeYoutubeMusicUrl } from 'utils/normalizeYoutubeMusicUrl';
import {
  photoAlbumsSlideshowMiniPlayerZ
} from 'config/photoAlbumsLayout';

const BackgroundMusicContext = createContext(null);

function isVsinglesPath(pathname) {
  return /(^|\/)vsingles(\/|$)/.test(String(pathname ?? ''));
}

function isVsinglesMyStoryPath(pathname) {
  return /(^|\/)(?:vsingles\/(?:myStory|myStore)|myStory|myStore)(\/|$)/.test(String(pathname ?? ''));
}

function isMusicSuppressedPath(pathname) {
  return /^\/pages\/login(?:\/|$)/.test(String(pathname ?? ''));
}

function buildEmbeddedYoutubeSrc(src, loopEnabled, { startMuted = false } = {}) {
  const normalized = normalizeYoutubeMusicUrl(src);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const videoId = parts[0] === 'embed' ? parts[1] ?? '' : '';
    if (!videoId) return normalized;

    const embed = new URL(`https://www.youtube.com/embed/${videoId}`);
    embed.searchParams.set('autoplay', '1');
    embed.searchParams.set('rel', '0');
    embed.searchParams.set('enablejsapi', '1');
    embed.searchParams.set('playsinline', '1');
    if (startMuted) {
      embed.searchParams.set('mute', '1');
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      embed.searchParams.set('origin', window.location.origin);
    }
    if (loopEnabled) {
      embed.searchParams.set('loop', '1');
      embed.searchParams.set('playlist', videoId);
    }
    return embed.toString();
  } catch {
    return normalized;
  }
}

function youtubeEmbedVideoId(src) {
  const normalized = normalizeYoutubeMusicUrl(src);
  if (!normalized) return String(src ?? '');
  try {
    const parts = new URL(normalized).pathname.split('/').filter(Boolean);
    return parts[0] === 'embed' ? parts[1] ?? normalized : normalized;
  } catch {
    return normalized;
  }
}

/** Site-wide piano / flute / rain — never on /vsingles (lyric is separate). */
function GlobalBackgroundPlayer({ soundPreference, volume, vsinglesMediaPaused, pathname, customMusicUrl }) {
  const audioRef = useRef(null);
  const onVsingles = isVsinglesPath(pathname);
  const onVsinglesMyStory = isVsinglesMyStoryPath(pathname);
  const useVsinglesLyricAudio = onVsingles && !onVsinglesMyStory;
  const volumeGain = volumeFromDb(volume);
  const isSilent = soundPreference === 'mute';
  const pausedOnVsingles = useVsinglesLyricAudio && vsinglesMediaPaused;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const shouldPlay = !useVsinglesLyricAudio && !customMusicUrl && !isSilent && volume > 0 && !pausedOnVsingles;

    if (!shouldPlay) {
      audio.pause();
      return undefined;
    }

    const src = BACKGROUND_TRACK_SRC[soundPreference];
    if (!src) {
      audio.pause();
      return undefined;
    }

    if (audio.getAttribute('data-track-key') !== soundPreference) {
      audio.src = src;
      audio.setAttribute('data-track-key', soundPreference);
      audio.currentTime = 0;
    }

    audio.loop = true;
    audio.volume = volumeGain;

    const playPromise = audio.play();
    if (playPromise?.catch) {
      playPromise.catch(() => {});
    }

    return undefined;
  }, [soundPreference, volume, volumeGain, useVsinglesLyricAudio, customMusicUrl, isSilent, pausedOnVsingles]);

  return (
    <audio
      ref={audioRef}
      loop
      preload="auto"
      style={{ display: 'none' }}
      aria-hidden
    />
  );
}

GlobalBackgroundPlayer.propTypes = {
  soundPreference: PropTypes.string.isRequired,
  volume: PropTypes.number.isRequired,
  vsinglesMediaPaused: PropTypes.bool.isRequired,
  pathname: PropTypes.string.isRequired,
  customMusicUrl: PropTypes.string
};

function GlobalCustomMusicPlayer({
  customMusicUrl,
  pathname,
  customMusicLoop,
  volume,
  onToggleLoop,
  onClose,
  slideshowMusicUiElevated = false,
  slideshowMusicUiBaseZ = 0,
  customMusicStartMuted = false
}) {
  const onVsingles = isVsinglesPath(pathname);
  const onVsinglesMyStory = isVsinglesMyStoryPath(pathname);
  const useVsinglesLyricAudio = onVsingles && !onVsinglesMyStory;
  const containerRef = useRef(null);
  const iframeRef = useRef(null);
  const dragStartRef = useRef(null);
  const [position, setPosition] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);

  const handleDragStart = useCallback((event) => {
    if (event.button !== 0) return;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    dragStartRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height
    };
    setPosition({ left: rect.left, top: rect.top });
    setIsDragging(true);
    event.preventDefault();
  }, []);

  useEffect(() => {
    if (!isDragging) return undefined;

    const onMouseMove = (event) => {
      const dragData = dragStartRef.current;
      if (!dragData) return;
      const maxLeft = Math.max(0, window.innerWidth - dragData.width);
      const maxTop = Math.max(0, window.innerHeight - dragData.height);
      const nextLeft = Math.min(maxLeft, Math.max(0, event.clientX - dragData.offsetX));
      const nextTop = Math.min(maxTop, Math.max(0, event.clientY - dragData.offsetY));
      setPosition({ left: nextLeft, top: nextTop });
    };

    const onMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    setIframeReady(false);
  }, [customMusicUrl, customMusicLoop, customMusicStartMuted]);

  useEffect(() => {
    if (!iframeReady) return undefined;
    const iframeWindow = iframeRef.current?.contentWindow;
    if (!iframeWindow) return undefined;
    const nextVolume = Math.min(100, Math.max(0, Math.trunc(Number(volume))));
    try {
      iframeWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: 'setVolume',
          args: [nextVolume]
        }),
        '*'
      );
      iframeWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func: nextVolume <= 0 ? 'mute' : 'unMute',
          args: []
        }),
        '*'
      );
    } catch {
      // Ignore postMessage failures for non-YouTube iframes.
    }
    return undefined;
  }, [iframeReady, volume, customMusicUrl, customMusicLoop, customMusicStartMuted]);

  if (!customMusicUrl || useVsinglesLyricAudio) return null;
  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'fixed',
        ...(position ? { left: position.left, top: position.top } : { left: 12, bottom: 12 }),
        zIndex: slideshowMusicUiElevated
          ? photoAlbumsSlideshowMiniPlayerZ(slideshowMusicUiBaseZ)
          : 1400,
        width: { xs: 220, sm: 320 },
        bgcolor: '#000',
        border: '1px solid var(--theme-primary-color)',
        borderRadius: 1,
        overflow: 'hidden'
      }}
    >
      <Box
        onMouseDown={handleDragStart}
        sx={{
          height: 24,
          px: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'rgba(0,0,0,0.8)',
          color: '#fff',
          fontSize: '0.72rem',
          fontWeight: 700,
          letterSpacing: 0.2,
          userSelect: 'none',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <Box component="span">Drag</Box>
        <Box
          component="button"
          type="button"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onToggleLoop();
          }}
          sx={{
            border: 'none',
            background: 'none',
            p: 0,
            m: 0,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.72rem',
            color: customMusicLoop ? '#43a047' : '#fff'
          }}
        >
          Loop
        </Box>
        <Box
          component="button"
          type="button"
          onMouseDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          sx={{
            border: 'none',
            background: 'none',
            color: '#fff',
            p: 0,
            m: 0,
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.72rem'
          }}
        >
          Close
        </Box>
      </Box>
      <Box sx={{ width: '100%', aspectRatio: '16 / 9' }}>
      <Box
        component="iframe"
        key={youtubeEmbedVideoId(customMusicUrl)}
        ref={iframeRef}
        src={buildEmbeddedYoutubeSrc(customMusicUrl, customMusicLoop, {
          startMuted: customMusicStartMuted
        })}
        title="Embedded Youtube Player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={() => setIframeReady(true)}
        sx={{ width: '100%', height: '100%', border: 0 }}
      />
      </Box>
    </Box>
  );
}

GlobalCustomMusicPlayer.propTypes = {
  customMusicUrl: PropTypes.string,
  pathname: PropTypes.string.isRequired,
  customMusicLoop: PropTypes.bool.isRequired,
  customMusicStartMuted: PropTypes.bool,
  volume: PropTypes.number.isRequired,
  onToggleLoop: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  slideshowMusicUiElevated: PropTypes.bool,
  slideshowMusicUiBaseZ: PropTypes.number
};

export function BackgroundMusicProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const { pathname } = useLocation();

  const [soundPreference, setSoundPreference] = useState('mute');
  const [vsinglesLyric, setVsinglesLyric] = useState('lyric');
  const [lyricMute, setLyricMute] = useState(true);
  const [lyricVolume, setLyricVolume] = useState(0);
  const [volume, setVolume] = useState(0);
  const [customMusicUrls, setCustomMusicUrls] = useState(emptyCustomMusicUrlSlots);
  /** false → first Track open should auto Load Default once. */
  const [loadDefault, setLoadDefault] = useState(true);
  const [customMusicUrl, setCustomMusicUrl] = useState(null);
  const [customMusicLoop, setCustomMusicLoop] = useState(true);
  const [customMusicStartMuted, setCustomMusicStartMuted] = useState(false);
  const [vsinglesMediaPaused, setVsinglesMediaPaused] = useState(false);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  const [slideshowMusicUiBaseZ, setSlideshowMusicUiBaseZ] = useState(0);
  const userPickedCustomMusicRef = useRef(false);

  const soundSaveSeqRef = useRef(0);
  const volumeSaveSeqRef = useRef(0);
  const lyricVolumeSaveSeqRef = useRef(0);
  const customMusicSaveSeqRef = useRef(0);
  const volumeSaveTimerRef = useRef(null);
  const lyricVolumeSaveTimerRef = useRef(null);

  const onVsingles = isVsinglesPath(pathname);
  const onVsinglesMyStory = isVsinglesMyStoryPath(pathname);
  const useVsinglesLyricAudio = onVsingles && !onVsinglesMyStory;
  const musicSuppressedPath = isMusicSuppressedPath(pathname);
  const volumeGain = volumeFromDb(soundPreference === 'mute' ? 0 : volume);
  const lyricVolumeGain = volumeFromDb(lyricMute ? 0 : lyricVolume);
  const musicReady = Boolean(user) && !authLoading && preferenceLoaded && !musicSuppressedPath;

  const applySavedCustomization = useCallback((saved) => {
    const demoVolume = consumeSecretLoginDemoVolume();
    setSoundPreference(saved.soundPreference);
    setVsinglesLyric(saved.vsinglesLyric);
    setLyricMute(saved.lyricMute);
    setLyricVolume(saved.lyricVolume ?? 1);
    setVolume(demoVolume ?? saved.volume);
    setCustomMusicUrls(saved.customMusicUrls ?? emptyCustomMusicUrlSlots());
    setLoadDefault(saved.loadDefault !== false);
  }, []);

  useEffect(() => {
    if (!useVsinglesLyricAudio) {
      setVsinglesMediaPaused(false);
    }
  }, [useVsinglesLyricAudio]);

  useEffect(
    () => () => {
      if (volumeSaveTimerRef.current) {
        clearTimeout(volumeSaveTimerRef.current);
      }
      if (lyricVolumeSaveTimerRef.current) {
        clearTimeout(lyricVolumeSaveTimerRef.current);
      }
    },
    []
  );

  const loadUserCustomization = useCallback(async () => {
    if (!user) return;
    try {
      const data = await fetchUserCustomization();
      applySavedCustomization(data);
    } catch (err) {
      console.warn('[BackgroundMusic] failed to load customization', err);
    } finally {
      setPreferenceLoaded(true);
    }
  }, [user, applySavedCustomization]);

  useEffect(() => {
    if (authLoading) return undefined;
    if (!user) {
      setPreferenceLoaded(false);
      setSoundPreference('mute');
      setVsinglesLyric('lyric');
      setLyricMute(true);
      setLyricVolume(0);
      setVolume(0);
      setCustomMusicUrls(emptyCustomMusicUrlSlots());
      setLoadDefault(true);
      setCustomMusicUrl(null);
      setVsinglesMediaPaused(false);
      return undefined;
    }

    const LEGACY_PARTIAL_IDS = ['c7u5tTO7bdE', 'g8J0GPXOA4U', 'TNZceXN8FWA'];
    const looksLikeLegacyPartial = (urls) => {
      const list = Array.isArray(urls) ? urls : [];
      const blob = list.map((u) => String(u || '')).join(' ');
      if (LEGACY_PARTIAL_IDS.some((id) => blob.includes(id))) return true;
      const filled = list.filter((u) => u && String(u).trim()).length;
      const midEmpty = [3, 4, 5, 6, 7, 8].every((i) => !list[i]);
      return filled > 0 && filled < CUSTOM_MUSIC_URL_SLOT_COUNT && midEmpty && Boolean(list[9]);
    };

    let cancelled = false;
    setPreferenceLoaded(false);
    (async () => {
      try {
        let data = await fetchUserCustomization();
        if (cancelled) return;
        // Belt-and-suspenders if BE hasn't healed yet: replace garbage/partial on login.
        if (data?.loadDefault === false || looksLikeLegacyPartial(data?.customMusicUrls)) {
          try {
            data = await fetchDefaultCustomMusicUrlsApi();
          } catch (healErr) {
            console.warn('[BackgroundMusic] auto Load Default on login failed', healErr);
          }
        }
        if (cancelled) return;
        applySavedCustomization(data);
      } catch (err) {
        if (!cancelled) console.warn('[BackgroundMusic] failed to load customization', err);
      } finally {
        if (!cancelled) setPreferenceLoaded(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.singles_id, authLoading, applySavedCustomization]);

  useEffect(() => {
    if (authLoading || !user) return;
    const demoVolume = consumeSecretLoginDemoVolume();
    if (demoVolume != null) {
      setVolume(demoVolume);
    }
  }, [user, authLoading, pathname]);

  useEffect(() => {
    if (!user) return undefined;
    const onReload = () => {
      void loadUserCustomization();
    };
    window.addEventListener('user-customization-reload', onReload);
    return () => window.removeEventListener('user-customization-reload', onReload);
  }, [user, loadUserCustomization]);

  const setSoundPreferenceAndSave = useCallback(
    async (next) => {
      const normalized = normalizeSoundPreference(next);
      setSoundPreference(normalized);
      if (!user) return normalized;
      const seq = ++soundSaveSeqRef.current;
      try {
        const saved = await saveUserCustomization({ soundPreference: normalized });
        if (seq === soundSaveSeqRef.current) {
          setSoundPreference(saved.soundPreference);
        }
        return saved.soundPreference;
      } catch (err) {
        console.warn('[BackgroundMusic] failed to save sound preference', err);
        return normalized;
      }
    },
    [user]
  );

  const setVsinglesLyricAndSave = useCallback(
    async (next) => {
      const normalized = normalizeVsinglesLyric(next);
      setVsinglesLyric(normalized);
      if (!user) return normalized;
      try {
        const saved = await saveUserCustomization({ vsinglesLyric: normalized });
        applySavedCustomization(saved);
        return saved.vsinglesLyric;
      } catch (err) {
        console.warn('[BackgroundMusic] failed to save vsingles lyric', err);
        return normalized;
      }
    },
    [user, applySavedCustomization]
  );

  const setLyricMuteAndSave = useCallback(
    async (nextMute) => {
      const muted = Boolean(nextMute);
      setLyricMute(muted);
      if (!user) return muted;
      try {
        const saved = await saveUserCustomization({ lyricMute: muted });
        applySavedCustomization(saved);
        return saved.lyricMute;
      } catch (err) {
        console.warn('[BackgroundMusic] failed to save lyric mute', err);
        return muted;
      }
    },
    [user, applySavedCustomization]
  );

  const toggleLyricMute = useCallback(() => setLyricMuteAndSave(!lyricMute), [lyricMute, setLyricMuteAndSave]);

  const persistLyricVolume = useCallback(
    async (v) => {
      if (!user) return v;
      const seq = ++lyricVolumeSaveSeqRef.current;
      try {
        const saved = await saveUserCustomization({ lyricVolume: v, lyricMute: v <= 0 });
        if (seq === lyricVolumeSaveSeqRef.current) {
          setLyricVolume(saved.lyricVolume ?? v);
          setLyricMute((saved.lyricVolume ?? v) <= 0);
        }
        return saved.lyricVolume ?? v;
      } catch (err) {
        console.warn('[BackgroundMusic] failed to save lyric volume', err);
        return v;
      }
    },
    [user]
  );

  const setLyricVolumeAndSave = useCallback(
    async (nextVolume, options = {}) => {
      const v = Math.min(100, Math.max(0, Math.trunc(Number(nextVolume))));
      const flush = Boolean(options?.flush);
      const localOnly = Boolean(options?.localOnly);
      setLyricVolume(v);
      if (!localOnly) {
        setLyricMute(v <= 0);
      }
      if (localOnly || !user) return v;
      if (!flush) return v;
      return persistLyricVolume(v);
    },
    [user, persistLyricVolume]
  );

  const persistVolume = useCallback(
    async (v, nextSoundPreference = null) => {
      if (!user) return v;
      const seq = ++volumeSaveSeqRef.current;
      try {
        const payload = nextSoundPreference ? { volume: v, soundPreference: nextSoundPreference } : { volume: v };
        const saved = await saveUserCustomization(payload);
        if (seq === volumeSaveSeqRef.current) {
          setVolume(saved.volume);
          if (nextSoundPreference && typeof saved.soundPreference === 'string') {
            setSoundPreference(saved.soundPreference);
          }
        }
        return saved.volume;
      } catch (err) {
        console.warn('[BackgroundMusic] failed to save volume', err);
        return v;
      }
    },
    [user]
  );

  const setVolumeAndSave = useCallback(
    async (nextVolume, options = {}) => {
      const v = Math.min(100, Math.max(0, Math.trunc(Number(nextVolume))));
      const flush = Boolean(options?.flush);
      const localOnly = Boolean(options?.localOnly);
      setVolume(v);
      if (localOnly || !user) return v;
      if (!flush) return v;
      // Local MP3 beds removed — volume slider never auto-launches a site bed.
      return persistVolume(v, null);
    },
    [user, persistVolume]
  );

  const playCustomMusicUrl = useCallback(
    async (nextUrl, { userInitiated = true, startMuted = false } = {}) => {
      const trimmed = String(nextUrl ?? '').trim();
      if (!trimmed) return false;
      const normalized = normalizeYoutubeMusicUrl(trimmed) ?? trimmed;
      if (userInitiated) {
        userPickedCustomMusicRef.current = true;
      }
      setCustomMusicStartMuted(Boolean(startMuted) && !userInitiated);
      setCustomMusicUrl(normalized);
      setSoundPreference('mute');
      if (!user) return true;
      try {
        const saved = await saveUserCustomization({ soundPreference: 'mute' });
        setSoundPreference(saved.soundPreference);
      } catch (err) {
        console.warn('[BackgroundMusic] failed to save sound preference for custom music', err);
      }
      return true;
    },
    [user]
  );

  const playCustomMusicFromSlot = useCallback(
    (slotIndex, urlOverride = null, { auto = false, userInitiated = true, startMuted = false } = {}) => {
      const index = Number(slotIndex);
      const raw = urlOverride ?? customMusicUrls[index];
      const url = normalizeYoutubeMusicUrl(raw) ?? raw;
      if (!url) return false;
      if (auto && userPickedCustomMusicRef.current) return false;
      void playCustomMusicUrl(url, {
        userInitiated: auto ? false : userInitiated,
        startMuted: auto ? true : startMuted
      });
      return true;
    },
    [customMusicUrls, playCustomMusicUrl]
  );

  const stopCustomMusicPlayback = useCallback(() => {
    setCustomMusicUrl(null);
    setCustomMusicStartMuted(false);
  }, []);

  const saveCustomMusicUrlSlot = useCallback(
    async (slotIndex, rawUrl) => {
      const index = Number(slotIndex);
      if (!Number.isInteger(index) || index < 0 || index >= CUSTOM_MUSIC_URL_SLOT_COUNT) {
        return customMusicUrls;
      }
      const trimmed = String(rawUrl ?? '').trim();
      if (!trimmed) {
        const next = [...customMusicUrls];
        next[index] = null;
        if (!user) {
          setCustomMusicUrls(next);
          return next;
        }
        const seq = ++customMusicSaveSeqRef.current;
        try {
          const saved = await saveUserCustomization({ customMusicUrls: next });
          if (seq === customMusicSaveSeqRef.current) {
            setCustomMusicUrls(saved.customMusicUrls ?? emptyCustomMusicUrlSlots());
          }
          return saved.customMusicUrls ?? next;
        } catch (err) {
          console.warn('[BackgroundMusic] failed to clear custom music URL slot', err);
          throw err;
        }
      }

      const normalized = normalizeYoutubeMusicUrl(trimmed);
      if (!normalized) {
        const err = new Error(
          'Please enter a full YouTube link or 11-character video ID (watch, youtu.be, shorts, or embed).'
        );
        err.isInvalidYoutubeUrl = true;
        throw err;
      }

      const next = [...customMusicUrls];
      next[index] = normalized;
      if (!user) {
        setCustomMusicUrls(next);
        return next;
      }
      const seq = ++customMusicSaveSeqRef.current;
      try {
        const saved = await saveUserCustomization({ customMusicUrls: next });
        if (seq === customMusicSaveSeqRef.current) {
          setCustomMusicUrls(saved.customMusicUrls ?? emptyCustomMusicUrlSlots());
        }
        return saved.customMusicUrls ?? next;
      } catch (err) {
        console.warn('[BackgroundMusic] failed to save custom music URL slot', err);
        throw err;
      }
    },
    [user, customMusicUrls]
  );

  const loadDefaultCustomMusicUrls = useCallback(async () => {
    if (!user) {
      setCustomMusicUrls(emptyCustomMusicUrlSlots());
      return emptyCustomMusicUrlSlots();
    }
    const saved = await fetchDefaultCustomMusicUrlsApi();
    setCustomMusicUrls(saved.customMusicUrls ?? emptyCustomMusicUrlSlots());
    setLoadDefault(saved.loadDefault !== false);
    return saved.customMusicUrls ?? emptyCustomMusicUrlSlots();
  }, [user]);

  const closeCustomMusicAndMute = useCallback(async () => {
    setCustomMusicUrl(null);
    setSoundPreference('mute');
    if (!user) return;
    try {
      const saved = await saveUserCustomization({ soundPreference: 'mute' });
      applySavedCustomization(saved);
    } catch (err) {
      console.warn('[BackgroundMusic] failed to close custom music and mute', err);
    }
  }, [user, applySavedCustomization]);

  /** Left speaker: mute or toggle unmute. */
  const muteFromFooter = useCallback(async () => {
    if (useVsinglesLyricAudio) {
      return setLyricMuteAndSave(true);
    }
    if (customMusicUrl) {
      return closeCustomMusicAndMute();
    }
    setSoundPreference('mute');
    if (!user) return;
    try {
      const saved = await saveUserCustomization({ soundPreference: 'mute' });
      applySavedCustomization(saved);
    } catch (err) {
      console.warn('[BackgroundMusic] failed to save mute preference', err);
    }
  }, [useVsinglesLyricAudio, setLyricMuteAndSave, customMusicUrl, closeCustomMusicAndMute, user, applySavedCustomization]);

  const unmuteFromFooter = useCallback(async () => {
    if (useVsinglesLyricAudio) {
      if (lyricVolume <= 0) {
        return setLyricVolumeAndSave(100, { flush: true });
      }
      return setLyricMuteAndSave(false);
    }
    const nextPref = 'piano';
    setSoundPreference(nextPref);
    const nextVolume = volume <= 0 ? 55 : volume;
    if (volume <= 0) {
      setVolume(nextVolume);
    }
    if (!user) return;
    try {
      const payload = volume <= 0 ? { soundPreference: nextPref, volume: nextVolume } : { soundPreference: nextPref };
      const saved = await saveUserCustomization(payload);
      applySavedCustomization(saved);
    } catch (err) {
      console.warn('[BackgroundMusic] failed to save unmute preference', err);
    }
  }, [
    useVsinglesLyricAudio,
    lyricVolume,
    setLyricVolumeAndSave,
    setLyricMuteAndSave,
    volume,
    user,
    applySavedCustomization
  ]);

  const toggleMuteFromFooter = useCallback(async () => {
    const mutedNow = useVsinglesLyricAudio ? lyricMute : customMusicUrl ? false : soundPreference === 'mute';
    if (mutedNow) {
      return unmuteFromFooter();
    }
    return muteFromFooter();
  }, [
    useVsinglesLyricAudio,
    lyricMute,
    customMusicUrl,
    soundPreference,
    unmuteFromFooter,
    muteFromFooter
  ]);

  /** Right speaker: max volume; on /vsingles sets lyric_volume 100. */
  const maxFromFooter = useCallback(async () => {
    if (useVsinglesLyricAudio) {
      setLyricMute(false);
      return setLyricVolumeAndSave(100, { flush: true });
    }
    // Local MP3 beds removed — max volume only; Track/YouTube supplies music.
    setVolume(100);
    if (!user) return;
    try {
      const saved = await saveUserCustomization({ volume: 100 });
      applySavedCustomization(saved);
    } catch (err) {
      console.warn('[BackgroundMusic] failed to save max volume', err);
    }
  }, [useVsinglesLyricAudio, user, applySavedCustomization, setLyricVolumeAndSave]);

  const isFooterMuted = useVsinglesLyricAudio ? lyricMute : customMusicUrl ? false : soundPreference === 'mute';
  const footerVolume = useVsinglesLyricAudio ? lyricVolume : volume;
  const setFooterVolume = useVsinglesLyricAudio ? setLyricVolumeAndSave : setVolumeAndSave;

  const resetSlideshowMusicAutoStart = useCallback(() => {
    userPickedCustomMusicRef.current = false;
  }, []);

  const registerSlideshowMusicUi = useCallback((baseZ = 0) => {
    const layerBase = Number(baseZ) || 0;
    setSlideshowMusicUiBaseZ((current) => Math.max(current, layerBase));
    return () => {
      setSlideshowMusicUiBaseZ((current) => (current === layerBase ? 0 : current));
    };
  }, []);

  const value = useMemo(
    () => ({
      soundPreference,
      vsinglesLyric,
      lyricMute,
      lyricVolume,
      volume: footerVolume,
      siteVolume: volume,
      volumeGain,
      lyricVolumeGain,
      preferenceLoaded,
      musicReady,
      onVsingles,
      isFooterMuted,
      vsinglesMediaPaused,
      setVsinglesMediaPaused,
      customMusicUrl,
      customMusicUrls,
      loadDefault,
      playCustomMusicFromSlot,
      stopCustomMusicPlayback,
      saveCustomMusicUrlSlot,
      loadDefaultCustomMusicUrls,
      setSoundPreference: setSoundPreferenceAndSave,
      setVsinglesLyric: setVsinglesLyricAndSave,
      setLyricMute: setLyricMuteAndSave,
      setLyricVolume: setLyricVolumeAndSave,
      toggleLyricMute,
      setVolume: setFooterVolume,
      muteFromFooter,
      unmuteFromFooter,
      toggleMuteFromFooter,
      maxFromFooter,
      registerSlideshowMusicUi,
      resetSlideshowMusicAutoStart,
      slideshowMusicUiElevated: slideshowMusicUiBaseZ > 0,
      slideshowMusicUiBaseZ
    }),
    [
      soundPreference,
      vsinglesLyric,
      lyricMute,
      lyricVolume,
      volume,
      footerVolume,
      volumeGain,
      lyricVolumeGain,
      preferenceLoaded,
      musicReady,
      onVsingles,
      isFooterMuted,
      vsinglesMediaPaused,
      customMusicUrl,
      customMusicUrls,
      loadDefault,
      playCustomMusicFromSlot,
      stopCustomMusicPlayback,
      saveCustomMusicUrlSlot,
      loadDefaultCustomMusicUrls,
      setSoundPreferenceAndSave,
      setVsinglesLyricAndSave,
      setLyricMuteAndSave,
      setLyricVolumeAndSave,
      toggleLyricMute,
      setFooterVolume,
      muteFromFooter,
      unmuteFromFooter,
      toggleMuteFromFooter,
      maxFromFooter,
      registerSlideshowMusicUi,
      resetSlideshowMusicAutoStart,
      slideshowMusicUiBaseZ
    ]
  );

  return (
    <BackgroundMusicContext.Provider value={value}>
      {children}
      {musicReady ? (
        <GlobalBackgroundPlayer
          soundPreference={soundPreference}
          volume={volume}
          vsinglesMediaPaused={vsinglesMediaPaused}
          pathname={pathname}
          customMusicUrl={customMusicUrl}
        />
      ) : null}
      {musicReady ? (
        <GlobalCustomMusicPlayer
          customMusicUrl={customMusicUrl}
          pathname={pathname}
          customMusicLoop={customMusicLoop}
          customMusicStartMuted={customMusicStartMuted}
          volume={volume}
          onToggleLoop={() => setCustomMusicLoop((prev) => !prev)}
          onClose={() => {
            void closeCustomMusicAndMute();
          }}
          slideshowMusicUiElevated={slideshowMusicUiBaseZ > 0}
          slideshowMusicUiBaseZ={slideshowMusicUiBaseZ}
        />
      ) : null}
    </BackgroundMusicContext.Provider>
  );
}

BackgroundMusicProvider.propTypes = {
  children: PropTypes.node
};

export function useBackgroundMusic() {
  const ctx = useContext(BackgroundMusicContext);
  if (!ctx) {
    throw new Error('useBackgroundMusic must be used within BackgroundMusicProvider');
  }
  return ctx;
}
