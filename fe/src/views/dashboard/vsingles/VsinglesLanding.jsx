import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import { useAuth } from 'contexts/AuthContext';
import { useBackgroundMusic } from 'contexts/BackgroundMusicContext';
import { MY_STORY_PATH, needsProfilePhotoSetup } from 'utils/profilePhotoSetup';
import { FIRST_LOGIN_AUTO_POPUPS_ENABLED } from 'config/firstLoginAutoPopupsEnv';
import { LYRIC_CAPTION_CUES, LYRIC_TRACK_SRC } from 'config/soundPreference';
import {
  VSINGLES_TOUR_PAUSE_MEDIA_EVENT,
  consumePendingVsinglesTourStart
} from 'utils/vsinglesTour';
import { isTutaDatesLandingPath } from 'constants/tutaDatesRoute';

import video1_couple1 from 'assets/images/video1_couple1.mp4';
import video2_couple5 from 'assets/images/video2_couple5.mp4';
import video3_couple2 from 'assets/images/video3_couple2.mp4';
import video4_couple6 from 'assets/images/video4_couple6.mp4';
import video5_couple3 from 'assets/images/video5_couple3.mp4';
import video6_couple4 from 'assets/images/video6_couple4.mp4';

const VIDEO_SOURCES = [video1_couple1, video2_couple5, video3_couple2, video4_couple6, video5_couple3, video6_couple4];

function shuffleVideoIndices(total) {
  if (!Number.isFinite(total) || total <= 0) return [0];
  const arr = Array.from({ length: total }, (_v, idx) => idx);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function captionIndexForTime(seconds, cues) {
  if (!cues.length || seconds < cues[0].at) return -1;
  let idx = 0;
  for (let i = cues.length - 1; i >= 0; i -= 1) {
    if (seconds >= cues[i].at) {
      idx = i;
      break;
    }
  }
  return idx;
}

const FADE_MS = 700;

const ZAPFINO_STACK = '"Zapfino", "Apple Chancery", "Snell Roundhand", "URW Chancery L", cursive';

export default function VsinglesLanding() {
  const { pathname } = useLocation();
  const { user, loading } = useAuth();
  const { lyricMute, lyricVolume, vsinglesMediaPaused, setVsinglesMediaPaused, lyricVolumeGain } = useBackgroundMusic();

  if (FIRST_LOGIN_AUTO_POPUPS_ENABLED && !loading && needsProfilePhotoSetup(user)) {
    return <Navigate to={MY_STORY_PATH} replace />;
  }

  const isLyricAudible = !lyricMute && lyricVolume > 0;

  const [playOrder, setPlayOrder] = useState(() => shuffleVideoIndices(VIDEO_SOURCES.length));
  const [playOrderPos, setPlayOrderPos] = useState(0);
  const activeIndex = playOrder[playOrderPos] ?? 0;
  const [captionIndex, setCaptionIndex] = useState(-1);

  const refs = useRef([]);
  const lyricAudioRef = useRef(null);
  const lastAudioTimeRef = useRef(0);

  const setRef = useCallback((el, i) => {
    refs.current[i] = el;
  }, []);

  useEffect(() => {
    if (isTutaDatesLandingPath(pathname)) {
      consumePendingVsinglesTourStart();
    }
  }, [pathname]);

  useEffect(() => {
    const onTourPauseMedia = () => setVsinglesMediaPaused(true);
    window.addEventListener(VSINGLES_TOUR_PAUSE_MEDIA_EVENT, onTourPauseMedia);
    return () => window.removeEventListener(VSINGLES_TOUR_PAUSE_MEDIA_EVENT, onTourPauseMedia);
  }, [setVsinglesMediaPaused]);

  useEffect(() => {
    return () => {
      const audio = lyricAudioRef.current;
      if (audio) {
        audio.pause();
        audio.currentTime = 0;
      }
    };
  }, []);

  useEffect(() => {
    refs.current.forEach((videoEl, i) => {
      if (!videoEl) return;
      if (i === activeIndex) {
        videoEl.muted = true;
        if (vsinglesMediaPaused) {
          videoEl.pause();
        } else {
          void videoEl.play().catch(() => {});
        }
      } else {
        videoEl.pause();
        videoEl.currentTime = 0;
      }
    });
  }, [activeIndex, vsinglesMediaPaused]);

  const syncCaptionToAudio = useCallback(() => {
    const audio = lyricAudioRef.current;
    if (!audio || !isLyricAudible) return;
    const t = audio.currentTime;
    if (t < lastAudioTimeRef.current - 0.5) {
      setCaptionIndex(-1);
    }
    lastAudioTimeRef.current = t;
    const next = captionIndexForTime(t, LYRIC_CAPTION_CUES);
    setCaptionIndex((prev) => (prev === next ? prev : next));
  }, [isLyricAudible]);

  useEffect(() => {
    const audio = lyricAudioRef.current;
    if (!audio) return undefined;

    if (!isLyricAudible || vsinglesMediaPaused) {
      audio.pause();
      if (!isLyricAudible) {
        setCaptionIndex(-1);
      }
      return undefined;
    }

    audio.volume = lyricVolumeGain;
    void audio.play().catch(() => {});

    return undefined;
  }, [isLyricAudible, vsinglesMediaPaused, lyricVolumeGain]);

  useEffect(() => {
    const audio = lyricAudioRef.current;
    if (!audio || !isLyricAudible) return undefined;
    const onTimeUpdate = () => syncCaptionToAudio();
    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => audio.removeEventListener('timeupdate', onTimeUpdate);
  }, [isLyricAudible, syncCaptionToAudio]);

  const handleVideoAreaClick = useCallback(() => {
    setVsinglesMediaPaused((prev) => !prev);
  }, [setVsinglesMediaPaused]);

  const handleVideoEnded = useCallback(
    (index) => {
      if (vsinglesMediaPaused) return;
      if (index !== activeIndex) return;
      setPlayOrderPos((prevPos) => {
        const nextPos = prevPos + 1;
        if (nextPos < VIDEO_SOURCES.length) return nextPos;
        const reshuffled = shuffleVideoIndices(VIDEO_SOURCES.length);
        // If possible, avoid repeating the same clip at cycle boundary.
        if (VIDEO_SOURCES.length > 1 && reshuffled[0] === index) {
          [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
        }
        setPlayOrder(reshuffled);
        return 0;
      });
    },
    [vsinglesMediaPaused, activeIndex]
  );

  const captionText = isLyricAudible && captionIndex >= 0 ? LYRIC_CAPTION_CUES[captionIndex]?.text ?? '' : '';

  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={vsinglesMediaPaused ? 'Play video' : 'Pause video'}
      onClick={handleVideoAreaClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleVideoAreaClick();
        }
      }}
      sx={{
        flex: '1 1 0%',
        minHeight: 0,
        height: '100%',
        width: '100%',
        minWidth: 0,
        alignSelf: 'stretch',
        position: 'relative',
        overflow: 'hidden',
        bgcolor: 'var(--theme-daynight-color)',
        cursor: 'pointer'
      }}
    >
      {VIDEO_SOURCES.map((src, i) => (
          <Box
            key={src}
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: activeIndex === i ? 1 : 0,
              transition: `opacity ${FADE_MS}ms ease-in-out`,
              pointerEvents: 'none'
            }}
          >
            <Box
              component="video"
              ref={(el) => setRef(el, i)}
              src={src}
              muted
              playsInline
              preload="auto"
              aria-hidden={activeIndex !== i}
              aria-label={activeIndex === i ? `Vetted singles clip ${i + 1} of ${VIDEO_SOURCES.length}` : undefined}
              onEnded={() => handleVideoEnded(i)}
              sx={{
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </Box>
        ))}

        <Typography
          component="p"
          role="status"
          aria-live="polite"
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '72%',
            transform: 'translateY(-50%)',
            zIndex: 3,
            pointerEvents: 'none',
            width: '100%',
            boxSizing: 'border-box',
            m: 0,
            px: { xs: 0.75, sm: 1.25 },
            py: { xs: 0.4, sm: 0.6 },
            textAlign: 'center',
            fontFamily: ZAPFINO_STACK,
            fontWeight: 900,
            lineHeight: 1.35,
            color: '#fff',
            WebkitTextStroke: '0',
            textShadow: 'none',
            fontSize: { xs: 'clamp(0.85rem, 3.4vw, 1.2rem)', sm: '3.2vw' },
            wordBreak: 'break-word',
            hyphens: 'auto',
            minHeight: '2.4em'
          }}
        >
          {captionText}
      </Typography>

      <audio ref={lyricAudioRef} src={LYRIC_TRACK_SRC} loop preload="auto" style={{ display: 'none' }} aria-hidden />
    </Box>
  );
}
