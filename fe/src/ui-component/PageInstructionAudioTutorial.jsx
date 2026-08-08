import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import imgSora from 'assets/images/AISora.png';
import imgJessica from 'assets/images/AIJessica.png';
import imgMichael from 'assets/images/AIMichael.png';
import {
  AI_VOICE_CHANGE_EVENT,
  AI_VOICE_DEFAULT,
  getAiVoice
} from 'utils/themeConfig';
import { ENV_MAIN_FONT_FAMILY } from 'config/mainFontEnv';

const FONT_MIN = 12;
const FONT_MAX = 28;
const FONT_STEP = 2;
const SEEK_SEC = 5;
const HIGHLIGHT_GREEN = '#60C446';

const IMG_BY_VOICE = {
  Sora: typeof imgSora === 'string' ? imgSora : imgSora?.default || '',
  Jessica: typeof imgJessica === 'string' ? imgJessica : imgJessica?.default || '',
  Michael: typeof imgMichael === 'string' ? imgMichael : imgMichael?.default || ''
};

const IMG_FRAME = {
  objectPosition: 'center 62%',
  scale: 0.88
};

function imgForVoice(voice) {
  const key = String(voice || '').trim();
  return IMG_BY_VOICE[key] || IMG_BY_VOICE[AI_VOICE_DEFAULT];
}

/**
 * Audio readout chrome for page-instruction popups (avatar + transport + voice label).
 * Plays baked m4a for the current Tutorial Voice (Sora / Jessica / Michael).
 */
export default function PageInstructionAudioTutorial({
  audioByVoice,
  contextStep = '',
  active = true
}) {
  const [aiVoice, setAiVoiceState] = useState(() => getAiVoice());
  const [fontPx, setFontPx] = useState(15);
  const audioRef = useRef(null);
  const [, setTick] = useState(0);

  const bumpUi = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const onVoice = () => setAiVoiceState(getAiVoice());
    window.addEventListener(AI_VOICE_CHANGE_EVENT, onVoice);
    return () => window.removeEventListener(AI_VOICE_CHANGE_EVENT, onVoice);
  }, []);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // ignore
    }
    bumpUi();
  }, [bumpUi]);

  useEffect(() => {
    if (!active) stopAudio();
    return () => stopAudio();
  }, [active, stopAudio]);

  useEffect(() => {
    // Voice change mid-playback — stop so next Play uses the new clip.
    stopAudio();
  }, [aiVoice, stopAudio]);

  const audioUrl = audioByVoice?.[aiVoice] || audioByVoice?.[AI_VOICE_DEFAULT] || '';
  const clickForAudioLabel = `Click for audio by ${aiVoice}`;
  const audio = audioRef.current;
  const isPlaying = !!(audio && !audio.paused && !audio.ended);
  const isPaused = !!(audio && audio.paused && audio.currentTime > 0 && !audio.ended);

  const startPlay = useCallback(async () => {
    if (!audioUrl || typeof Audio === 'undefined') return;
    stopAudio();
    const next = new Audio(audioUrl);
    audioRef.current = next;
    next.addEventListener('ended', () => {
      if (audioRef.current === next) audioRef.current = null;
      bumpUi();
    });
    next.addEventListener('pause', bumpUi);
    next.addEventListener('play', bumpUi);
    try {
      await next.play();
    } catch {
      if (audioRef.current === next) audioRef.current = null;
    }
    bumpUi();
  }, [audioUrl, bumpUi, stopAudio]);

  const pausePlay = useCallback(() => {
    const cur = audioRef.current;
    if (!cur || cur.paused) return;
    try {
      cur.pause();
    } catch {
      // ignore
    }
    bumpUi();
  }, [bumpUi]);

  const resumePlay = useCallback(async () => {
    const cur = audioRef.current;
    if (!cur || !cur.paused || cur.ended) return;
    try {
      await cur.play();
    } catch {
      // ignore
    }
    bumpUi();
  }, [bumpUi]);

  const seekBy = useCallback(
    (deltaSec) => {
      const cur = audioRef.current;
      if (!cur) return;
      try {
        const dur = Number.isFinite(cur.duration) && cur.duration > 0 ? cur.duration : null;
        let next = cur.currentTime + deltaSec;
        if (next < 0) next = 0;
        if (dur != null && next > dur) next = dur;
        cur.currentTime = next;
      } catch {
        // ignore
      }
      bumpUi();
    },
    [bumpUi]
  );

  const playOrResume = useCallback(() => {
    if (isPaused) {
      void resumePlay();
      return;
    }
    if (!isPlaying) void startPlay();
  }, [isPaused, isPlaying, resumePlay, startPlay]);

  const bumpFont = (delta) => {
    setFontPx((prev) => Math.min(FONT_MAX, Math.max(FONT_MIN, prev + delta)));
  };

  const headerBtnSx = {
    height: 28,
    minWidth: 28,
    border: '2px solid #111',
    borderRadius: 0.5,
    bgcolor: '#fff',
    color: '#111',
    fontWeight: 900,
    lineHeight: 1,
    cursor: 'pointer',
    p: 0,
    fontFamily: ENV_MAIN_FONT_FAMILY,
    flexShrink: 0
  };

  const transportBtns = [
    {
      key: 'rew',
      label: '⏪',
      title: 'Rewind 5 seconds',
      onClick: () => seekBy(-SEEK_SEC),
      gridColumn: '1'
    },
    {
      key: 'play',
      label: '▶',
      title: 'Play',
      onClick: playOrResume,
      play: true,
      gridColumn: '2'
    },
    {
      key: 'ff',
      label: '⏩',
      title: 'Fast forward 5 seconds',
      onClick: () => seekBy(SEEK_SEC),
      gridColumn: '3'
    },
    {
      key: 'pause',
      label: '⏸',
      title: 'Pause',
      onClick: pausePlay,
      gridColumn: '1 / 2',
      gridRow: '2'
    },
    {
      key: 'stop',
      label: '■',
      title: 'Stop',
      onClick: stopAudio,
      stop: true,
      gridColumn: '3 / 4',
      gridRow: '2'
    }
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        mb: 1.5,
        gap: 0.75,
        fontFamily: ENV_MAIN_FONT_FAMILY,
        color: '#111',
        WebkitTextFillColor: '#111'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
          width: '100%'
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, minWidth: 0 }}>
          <Box
            sx={{
              width: 72,
              height: 72,
              flexShrink: 0,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid #111',
              boxSizing: 'border-box',
              bgcolor: '#222',
              pointerEvents: 'none'
            }}
          >
            <Box
              component="img"
              src={imgForVoice(aiVoice)}
              alt={aiVoice}
              onError={(event) => {
                const fb = imgForVoice('Sora');
                if (fb && event.currentTarget.getAttribute('src') !== fb) {
                  event.currentTarget.setAttribute('src', fb);
                }
              }}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: IMG_FRAME.objectPosition,
                transform: `scale(${IMG_FRAME.scale})`,
                transformOrigin: 'center center',
                display: 'block'
              }}
            />
          </Box>
          <Box
            role="group"
            aria-label="Tutorial audio controls"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 32px)',
              gridTemplateRows: '32px 32px',
              gap: 0.5,
              justifyItems: 'center',
              alignItems: 'center'
            }}
          >
            {transportBtns.map((btn) => (
              <Box
                key={btn.key}
                component="button"
                type="button"
                title={btn.title}
                aria-label={btn.title}
                onClick={btn.onClick}
                sx={{
                  gridColumn: btn.gridColumn,
                  gridRow: btn.gridRow || '1',
                  width: 32,
                  height: 32,
                  border: '2px solid #111',
                  borderRadius: '50%',
                  bgcolor: btn.play ? HIGHLIGHT_GREEN : btn.stop ? 'var(--theme-error-color, #d32f2f)' : '#fff',
                  color: btn.stop ? '#fff' : '#111',
                  fontWeight: 900,
                  fontSize: btn.play || btn.stop ? '0.8rem' : '0.7rem',
                  lineHeight: 1,
                  cursor: 'pointer',
                  p: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: ENV_MAIN_FONT_FAMILY,
                  '&:hover': { filter: 'brightness(0.95)' }
                }}
              >
                {btn.label}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Box
            component="button"
            type="button"
            title="Zoom out font size"
            aria-label="Zoom out font size"
            onClick={() => bumpFont(-FONT_STEP)}
            sx={{ ...headerBtnSx, width: 28, fontSize: '1.1rem' }}
          >
            −
          </Box>
          <Box
            component="button"
            type="button"
            title="Zoom in font size"
            aria-label="Zoom in font size"
            onClick={() => bumpFont(FONT_STEP)}
            sx={{ ...headerBtnSx, width: 28, fontSize: '1.1rem' }}
          >
            +
          </Box>
        </Box>
      </Box>

      <Box
        component="button"
        type="button"
        title={clickForAudioLabel}
        aria-label={clickForAudioLabel}
        onClick={playOrResume}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          p: 0,
          fontFamily: ENV_MAIN_FONT_FAMILY,
          color: '#111',
          WebkitTextFillColor: '#111',
          textAlign: 'left'
        }}
      >
        <Typography
          component="span"
          sx={{
            fontWeight: 800,
            fontSize: `${Math.round(fontPx * 0.85)}px`,
            lineHeight: 1.25,
            fontFamily: ENV_MAIN_FONT_FAMILY,
            color: '#111',
            WebkitTextFillColor: '#111'
          }}
        >
          {clickForAudioLabel}
        </Typography>
        {contextStep ? (
          <Typography
            component="span"
            sx={{
              fontWeight: 800,
              fontSize: `${fontPx}px`,
              lineHeight: 1.3,
              mt: 0.25,
              fontFamily: ENV_MAIN_FONT_FAMILY,
              color: '#111',
              WebkitTextFillColor: '#111'
            }}
          >
            {contextStep}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

PageInstructionAudioTutorial.propTypes = {
  audioByVoice: PropTypes.shape({
    Sora: PropTypes.string,
    Jessica: PropTypes.string,
    Michael: PropTypes.string
  }).isRequired,
  contextStep: PropTypes.string,
  active: PropTypes.bool
};
