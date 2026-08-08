import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { createPortal } from 'react-dom';
import {
  ENV_MAIN_FONT_FAMILY,
  MAIN_FONT_OPTIONS,
  findMainFontOptionByStack
} from 'config/mainFontEnv';
import { ORANGE_BUTTON_ENABLED_BG } from 'config/orangeButton';
import imgSora from 'assets/images/AISora.png';
import imgJessica from 'assets/images/AIJessica.png';
import imgMichael from 'assets/images/AIMichael.png';
import audioIdleSora from 'assets/sound/pa_context_tutorial_idle_Sora.m4a';
import audioViewSora from 'assets/sound/pa_context_tutorial_view_Sora.m4a';
import audioEditSora from 'assets/sound/pa_context_tutorial_edit_Sora.m4a';
import audioEditPanZoomSora from 'assets/sound/pa_context_tutorial_editPanZoom_Sora.m4a';
import audioIdleJessica from 'assets/sound/pa_context_tutorial_idle_Jessica.m4a';
import audioViewJessica from 'assets/sound/pa_context_tutorial_view_Jessica.m4a';
import audioEditJessica from 'assets/sound/pa_context_tutorial_edit_Jessica.m4a';
import audioEditPanZoomJessica from 'assets/sound/pa_context_tutorial_editPanZoom_Jessica.m4a';
import audioIdleMichael from 'assets/sound/pa_context_tutorial_idle_Michael.m4a';
import audioViewMichael from 'assets/sound/pa_context_tutorial_view_Michael.m4a';
import audioEditMichael from 'assets/sound/pa_context_tutorial_edit_Michael.m4a';
import audioEditPanZoomMichael from 'assets/sound/pa_context_tutorial_editPanZoom_Michael.m4a';
import {
  AI_VOICE_CHANGE_EVENT,
  AI_VOICE_DEFAULT,
  getAiVoice
} from 'utils/themeConfig';
import {
  PHOTO_ALBUMS_CONTEXT_TUTORIAL_COPY,
  PHOTO_ALBUMS_CONTEXT_TUTORIAL_HIGHLIGHT_BG,
  buildPhotoAlbumsContextTutorialPopoutHtml,
  cancelPhotoAlbumsContextTutorialSpeech,
  getPhotoAlbumsContextTutorialMode,
  isPhotoAlbumsContextTutorialPaused,
  isPhotoAlbumsContextTutorialPlaying,
  pausePhotoAlbumsContextTutorialSpeech,
  photoAlbumsContextTutorialMode,
  publishPhotoAlbumsContextTutorialMode,
  registerPhotoAlbumsContextTutorialPopoutOpener,
  resolvePhotoAlbumsContextTutorialAssetUrl,
  resumePhotoAlbumsContextTutorialSpeech,
  seekPhotoAlbumsContextTutorialSpeech,
  speakPhotoAlbumsContextTutorial,
  splitPhotoAlbumsContextTutorialPhrases
} from './photoAlbumsContextTutorialSync';

const FONT_KEY = 'pa-context-tutorial-font-px';
const FONT_MIN = 12;
const FONT_MAX = 36;
const FONT_STEP = 2;
const OUTSIDE_RIGHT_PX = 10;
const POPOUT_NAME = 'pa-context-tutorial-popout';
const SEEK_SEC = 5;

function viteAssetUrl(mod) {
  if (typeof mod === 'string') return mod;
  if (mod && typeof mod === 'object' && typeof mod.default === 'string') return mod.default;
  return '';
}

/** Circular persona portraits — selection: themeConfig AI_VOICE. */
const CONTEXT_TUTORIAL_IMG_BY_VOICE = {
  Sora: viteAssetUrl(imgSora),
  Jessica: viteAssetUrl(imgJessica),
  Michael: viteAssetUrl(imgMichael)
};

/**
 * Circle crop framing for studio portraits (mic + name badge at bottom).
 * objectPosition y > 50% shifts photo up (chin nearer circle center);
 * scale < 1 zooms out inside the clipped circle.
 */
const CONTEXT_TUTORIAL_IMG_FRAME = {
  objectPosition: 'center 62%',
  scale: 0.88
};

/** Baked TTS clips — 3 personas × 4 modes. Selection: themeConfig AI_VOICE. */
const CONTEXT_TUTORIAL_AUDIO_BY_VOICE = {
  Sora: {
    idle: audioIdleSora,
    view: audioViewSora,
    edit: audioEditSora,
    editPanZoom: audioEditPanZoomSora
  },
  Jessica: {
    idle: audioIdleJessica,
    view: audioViewJessica,
    edit: audioEditJessica,
    editPanZoom: audioEditPanZoomJessica
  },
  Michael: {
    idle: audioIdleMichael,
    view: audioViewMichael,
    edit: audioEditMichael,
    editPanZoom: audioEditPanZoomMichael
  }
};

function audioByModeForVoice(voice) {
  return CONTEXT_TUTORIAL_AUDIO_BY_VOICE[voice] || CONTEXT_TUTORIAL_AUDIO_BY_VOICE[AI_VOICE_DEFAULT];
}

function imgForVoice(voice) {
  const key = String(voice || '').trim();
  return CONTEXT_TUTORIAL_IMG_BY_VOICE[key] || CONTEXT_TUTORIAL_IMG_BY_VOICE[AI_VOICE_DEFAULT];
}

function absoluteImgForVoice(voice) {
  if (typeof window === 'undefined') return imgForVoice(voice);
  return resolvePhotoAlbumsContextTutorialAssetUrl(imgForVoice(voice), window.location.origin);
}

/** Always env MAIN_FONT (not profile override). Used by docked + pop-out tutorial. */
const TUTORIAL_FONT_FAMILY = ENV_MAIN_FONT_FAMILY;

/** Google Fonts CSS for the first family in env MAIN_FONT (blank pop-out has no index.html link). */
function tutorialGoogleFontsHref() {
  const first = String(ENV_MAIN_FONT_FAMILY)
    .split(',')[0]
    .replace(/['"]/g, '')
    .trim()
    .toLowerCase();
  if (!first) return '';
  const byFirst = MAIN_FONT_OPTIONS.find((o) => {
    const oFirst = String(o.stack || '')
      .split(',')[0]
      .replace(/['"]/g, '')
      .trim()
      .toLowerCase();
    return oFirst === first;
  });
  const option = byFirst || findMainFontOptionByStack(ENV_MAIN_FONT_FAMILY);
  if (!option?.google) return '';
  return `https://fonts.googleapis.com/css2?family=${option.google}&display=swap`;
}

function readFontPx() {
  try {
    const n = Number(localStorage.getItem(FONT_KEY));
    if (Number.isFinite(n) && n >= FONT_MIN && n <= FONT_MAX) return Math.round(n);
  } catch {
    // ignore
  }
  return 15;
}

function writeFontPx(px) {
  try {
    localStorage.setItem(FONT_KEY, String(px));
  } catch {
    // ignore
  }
}

/**
 * USB-lane reference for tutorial chrome.
 * Docked panel: lane width × half lane height (flush bottom-right).
 * Popout window: landscape rectangle (~2.25× lane wide × half lane tall).
 */
function measureDockGeom() {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector('[data-pa-right-swim-lane]');
  if (!(el instanceof HTMLElement)) return null;
  const rect = el.getBoundingClientRect();
  const width = Math.max(160, Math.round(rect.width));
  const fullH = Math.max(200, Math.round(rect.height));
  const height = Math.max(140, Math.round(fullH / 2));
  const bottom = Math.max(0, Math.round(window.innerHeight - rect.bottom));
  return { width, height, bottom };
}

/** Default Open Tutorial floating-window size — landscape, not a tall narrow strip. */
function measurePopoutWindowSize() {
  const lane = measureDockGeom();
  const laneW = lane?.width || 320;
  const laneHalfH = lane?.height || Math.max(140, Math.round((window.innerHeight - 160) / 2));
  // Wider than the USB lane; height stays ~half-lane (previous code used height*2 → too tall).
  const width = Math.max(520, Math.round(laneW * 2.25));
  const height = Math.max(300, Math.round(laneHalfH));
  return { width, height };
}

/**
 * Context tutorial opens in a floating browser window (right of the album tab).
 * Stays in sync via BroadcastChannel while the album editor is active.
 */
export default function PhotoAlbumsContextTutorial({
  active = true,
  photoEditActive = false,
  panZoomActive = false,
  hasPageContext = false,
  hasAlbumPhotos = false,
  openRequestKey = 0
}) {
  const mode = photoAlbumsContextTutorialMode({
    photoEditActive,
    panZoomActive,
    hasPageContext,
    hasAlbumPhotos
  });
  const copy = PHOTO_ALBUMS_CONTEXT_TUTORIAL_COPY[mode] || PHOTO_ALBUMS_CONTEXT_TUTORIAL_COPY.idle;
  const bodyPhrases = splitPhotoAlbumsContextTutorialPhrases(copy.body);
  const [open, setOpen] = useState(false);
  const [fontPx, setFontPx] = useState(() => readFontPx());
  const [geom, setGeom] = useState(null);
  const [poppedOut, setPoppedOut] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(-1);
  const [aiVoice, setAiVoiceState] = useState(() => getAiVoice());
  const clickForAudioLabel = `Click for audio by ${aiVoice}`;
  const lastOpenKeyRef = useRef(openRequestKey);
  const popoutWinRef = useRef(null);
  const popoutWatchRef = useRef(null);
  const bodyPhrasesRef = useRef(bodyPhrases);
  bodyPhrasesRef.current = bodyPhrases;
  const copyTitleRef = useRef(copy.title);
  copyTitleRef.current = copy.title;
  const speakingRef = useRef(false);
  const speakGenRef = useRef(0);

  const stopReadoutSpeech = useCallback(() => {
    speakGenRef.current += 1;
    speakingRef.current = false;
    cancelPhotoAlbumsContextTutorialSpeech();
    setPhraseIndex(-1);
  }, []);

  const startReadoutSpeech = useCallback(() => {
    if (typeof window === 'undefined') return;
    speakingRef.current = true;
    speakGenRef.current += 1;
    const genAtStart = speakGenRef.current;
    const map = audioByModeForVoice(aiVoice);
    const audioUrl = map?.[mode] || map?.idle || '';
    void speakPhotoAlbumsContextTutorial({
      title: copyTitleRef.current,
      phrases: bodyPhrasesRef.current,
      audioUrl,
      generation: speakGenRef,
      onPhraseIndex: (i) => {
        if (speakGenRef.current !== genAtStart) return;
        setPhraseIndex(i);
      }
    }).finally(() => {
      if (speakGenRef.current === genAtStart) {
        speakingRef.current = false;
      }
    });
  }, [aiVoice, mode]);

  const playReadoutSpeech = useCallback(() => {
    if (isPhotoAlbumsContextTutorialPaused()) {
      void resumePhotoAlbumsContextTutorialSpeech().then((ok) => {
        if (ok) speakingRef.current = true;
      });
      return;
    }
    if (isPhotoAlbumsContextTutorialPlaying() || speakingRef.current) {
      pausePhotoAlbumsContextTutorialSpeech();
      speakingRef.current = false;
      return;
    }
    startReadoutSpeech();
  }, [startReadoutSpeech]);

  const pauseReadoutSpeech = useCallback(() => {
    if (pausePhotoAlbumsContextTutorialSpeech()) {
      speakingRef.current = false;
    }
  }, []);

  const seekReadoutSpeech = useCallback((deltaSec) => {
    seekPhotoAlbumsContextTutorialSpeech(deltaSec);
  }, []);

  useEffect(() => {
    // Mode / copy changed — stop any in-progress readout of the old text.
    stopReadoutSpeech();
  }, [mode, copy.body, copy.title, stopReadoutSpeech]);

  useEffect(() => {
    const onVoice = (ev) => {
      const next = ev?.detail?.voice || getAiVoice();
      setAiVoiceState(next);
      stopReadoutSpeech();
    };
    window.addEventListener(AI_VOICE_CHANGE_EVENT, onVoice);
    return () => window.removeEventListener(AI_VOICE_CHANGE_EVENT, onVoice);
  }, [stopReadoutSpeech]);

  // Keep pop-out persona portrait in sync when Tutorial Voice changes in the mall menu.
  useEffect(() => {
    const w = popoutWinRef.current;
    if (!w || w.closed || !poppedOut || typeof window === 'undefined') return;
    try {
      const doc = w.document;
      const img = doc?.getElementById?.('personaImg');
      const label = doc?.getElementById?.('readoutLabel');
      const btn = doc?.getElementById?.('readoutBtn');
      const src = absoluteImgForVoice(aiVoice);
      if (img && src) {
        img.onerror = () => {
          const fb = absoluteImgForVoice('Sora');
          if (fb && img.getAttribute('src') !== fb) img.setAttribute('src', fb);
        };
        img.setAttribute('src', src);
        img.setAttribute('alt', aiVoice);
      }
      const text = `Click for audio by ${aiVoice}`;
      if (label) label.textContent = text;
      if (btn) {
        btn.setAttribute('title', text);
        btn.setAttribute('aria-label', text);
      }
    } catch {
      // ignore cross-window access errors
    }
  }, [aiVoice, poppedOut]);

  useEffect(() => () => stopReadoutSpeech(), [stopReadoutSpeech]);

  const syncGeom = useCallback(() => {
    setGeom(measureDockGeom());
  }, []);

  const stopPopoutWatch = useCallback(() => {
    if (popoutWatchRef.current != null) {
      window.clearInterval(popoutWatchRef.current);
      popoutWatchRef.current = null;
    }
  }, []);

  const closePopoutWindow = useCallback(() => {
    stopPopoutWatch();
    const w = popoutWinRef.current;
    popoutWinRef.current = null;
    try {
      if (w && !w.closed) w.close();
    } catch {
      // ignore
    }
    setPoppedOut(false);
  }, [stopPopoutWatch]);

  const openPopoutWindow = useCallback(() => {
    if (typeof window === 'undefined') return;
    const existing = popoutWinRef.current;
    if (existing && !existing.closed) {
      try {
        existing.focus();
      } catch {
        // ignore
      }
      setPoppedOut(true);
      return;
    }

    stopReadoutSpeech();

    const { width: w, height: h } = measurePopoutWindowSize();
    // Place fully outside the main browser window on the right when the OS allows.
    const left = Math.max(0, (window.screenX || window.screenLeft || 0) + window.outerWidth + 12);
    const top = Math.max(0, (window.screenY || window.screenTop || 0) + 48);
    const features = [
      `width=${w}`,
      `height=${h}`,
      `left=${left}`,
      `top=${top}`,
      'resizable=yes',
      'scrollbars=yes',
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no'
    ].join(',');

    let win = null;
    try {
      win = window.open('', POPOUT_NAME, features);
    } catch {
      win = null;
    }
    if (!win) return;

    try {
      win.document.open();
      win.document.write(
        buildPhotoAlbumsContextTutorialPopoutHtml(getPhotoAlbumsContextTutorialMode(), {
          readoutImgByVoice: CONTEXT_TUTORIAL_IMG_BY_VOICE,
          readoutImgUrl: absoluteImgForVoice(getAiVoice()),
          readoutAudioByVoiceMode: CONTEXT_TUTORIAL_AUDIO_BY_VOICE,
          initialAiVoice: getAiVoice(),
          mainFontFamily: TUTORIAL_FONT_FAMILY,
          googleFontsHref: tutorialGoogleFontsHref(),
          assetOrigin: window.location.origin
        })
      );
      win.document.close();
    } catch {
      try {
        win.close();
      } catch {
        // ignore
      }
      return;
    }

    popoutWinRef.current = win;
    setPoppedOut(true);
    setOpen(false);
    stopPopoutWatch();
    popoutWatchRef.current = window.setInterval(() => {
      const cur = popoutWinRef.current;
      if (!cur || cur.closed) {
        stopPopoutWatch();
        popoutWinRef.current = null;
        setPoppedOut(false);
      }
    }, 500);
  }, [stopPopoutWatch, stopReadoutSpeech]);

  useEffect(() => {
    if (!active) {
      registerPhotoAlbumsContextTutorialPopoutOpener(null);
      setOpen(false);
      closePopoutWindow();
      return undefined;
    }
    registerPhotoAlbumsContextTutorialPopoutOpener(openPopoutWindow);
    return () => {
      registerPhotoAlbumsContextTutorialPopoutOpener(null);
      closePopoutWindow();
      stopReadoutSpeech();
    };
  }, [active, openPopoutWindow, closePopoutWindow, stopReadoutSpeech]);

  useEffect(() => {
    if (!active) return;
    publishPhotoAlbumsContextTutorialMode(mode);
  }, [active, mode]);

  useEffect(() => {
    if (openRequestKey === lastOpenKeyRef.current) return;
    lastOpenKeyRef.current = openRequestKey;
    if (openRequestKey < 1 || !active) return;
    openPopoutWindow();
  }, [openRequestKey, active, openPopoutWindow]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    syncGeom();
    const onResize = () => syncGeom();
    window.addEventListener('resize', onResize);
    const el = document.querySelector('[data-pa-right-swim-lane]');
    let ro = null;
    if (el && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => syncGeom());
      ro.observe(el);
    }
    return () => {
      window.removeEventListener('resize', onResize);
      ro?.disconnect?.();
    };
  }, [open, syncGeom]);

  const bumpFont = (delta) => {
    setFontPx((prev) => {
      const next = Math.min(FONT_MAX, Math.max(FONT_MIN, prev + delta));
      writeFontPx(next);
      return next;
    });
  };

  // Docked panel hidden while popped out (floating window owns the tutorial).
  if (!active || !open || poppedOut || typeof document === 'undefined') return null;

  const box = geom || {
    bottom: 0,
    width: 280,
    height: Math.max(140, Math.round((window.innerHeight - 160) / 2))
  };

  const headerBtnSx = {
    height: 32,
    border: '2px solid #111',
    borderRadius: 0.75,
    bgcolor: '#fff',
    color: '#111',
    fontWeight: 900,
    lineHeight: 1,
    cursor: 'pointer',
    p: 0,
    fontFamily: TUTORIAL_FONT_FAMILY,
    flexShrink: 0
  };

  return createPortal(
    <Box
      role="complementary"
      aria-label="Album context tutorial"
      sx={{
        position: 'fixed',
        right: -OUTSIDE_RIGHT_PX,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        zIndex: 22000,
        bgcolor: ORANGE_BUTTON_ENABLED_BG,
        color: '#111',
        border: '3px solid #111',
        borderRadius: 1,
        boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
        fontFamily: TUTORIAL_FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.25,
          pt: 1,
          pb: 0.5,
          flexShrink: 0
        }}
      >
        <Box
          component="button"
          type="button"
          title="Pop out into a floating window (can drag to another monitor)"
          aria-label="Pop out context tutorial"
          onClick={openPopoutWindow}
          sx={{
            ...headerBtnSx,
            width: 'auto',
            px: 1,
            fontSize: '0.78rem',
            letterSpacing: 0.2
          }}
        >
          PopOut
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="button"
            type="button"
            title="Zoom out font size"
            aria-label="Zoom out font size"
            onClick={() => bumpFont(-FONT_STEP)}
            sx={{ ...headerBtnSx, width: 36, fontSize: '1.35rem' }}
          >
            −
          </Box>
          <Box
            component="button"
            type="button"
            title="Zoom in font size"
            aria-label="Zoom in font size"
            onClick={() => bumpFont(FONT_STEP)}
            sx={{ ...headerBtnSx, width: 36, fontSize: '1.35rem' }}
          >
            +
          </Box>
          <Box
            component="button"
            type="button"
            title="Close context tutorial"
            aria-label="Close context tutorial"
            onClick={() => setOpen(false)}
            sx={{
              width: 28,
              height: 28,
              border: '2px solid #111',
              borderRadius: 0.5,
              bgcolor: 'var(--theme-error-color, #d32f2f)',
              color: '#fff',
              fontWeight: 900,
              fontSize: '1.1rem',
              lineHeight: 1,
              cursor: 'pointer',
              p: 0
            }}
          >
            ×
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          flex: '1 1 auto',
          minHeight: 0,
          overflow: 'auto',
          px: 1.5,
          pb: 1.5,
          fontFamily: TUTORIAL_FONT_FAMILY
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            maxWidth: '100%',
            mb: 1.25,
            gap: 0.75
          }}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1,
              maxWidth: '100%'
            }}
          >
            <Box
              sx={{
                width: 96,
                height: 96,
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
                src={absoluteImgForVoice(aiVoice)}
                alt={aiVoice}
                onError={(event) => {
                  const fb = absoluteImgForVoice('Sora');
                  if (fb && event.currentTarget.getAttribute('src') !== fb) {
                    event.currentTarget.setAttribute('src', fb);
                  }
                }}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: CONTEXT_TUTORIAL_IMG_FRAME.objectPosition,
                  transform: `scale(${CONTEXT_TUTORIAL_IMG_FRAME.scale})`,
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
                gridTemplateColumns: 'repeat(3, 36px)',
                gridTemplateRows: '36px 36px',
                gap: 0.5,
                justifyItems: 'center',
                alignItems: 'center'
              }}
            >
              {[
                {
                  key: 'rew',
                  label: '⏪',
                  title: 'Rewind 5 seconds',
                  onClick: () => seekReadoutSpeech(-SEEK_SEC),
                  gridColumn: '1'
                },
                {
                  key: 'play',
                  label: '▶',
                  title: 'Play',
                  onClick: () => {
                    if (isPhotoAlbumsContextTutorialPaused()) {
                      void resumePhotoAlbumsContextTutorialSpeech().then((ok) => {
                        if (ok) speakingRef.current = true;
                      });
                      return;
                    }
                    if (!isPhotoAlbumsContextTutorialPlaying()) startReadoutSpeech();
                  },
                  play: true,
                  gridColumn: '2'
                },
                {
                  key: 'ff',
                  label: '⏩',
                  title: 'Fast forward 5 seconds',
                  onClick: () => seekReadoutSpeech(SEEK_SEC),
                  gridColumn: '3'
                },
                {
                  key: 'pause',
                  label: '⏸',
                  title: 'Pause',
                  onClick: pauseReadoutSpeech,
                  gridColumn: '1 / 2',
                  gridRow: '2'
                },
                {
                  key: 'stop',
                  label: '■',
                  title: 'Stop',
                  onClick: stopReadoutSpeech,
                  stop: true,
                  gridColumn: '3 / 4',
                  gridRow: '2'
                }
              ].map((btn) => (
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
                    width: 36,
                    height: 36,
                    border: '2px solid #111',
                    borderRadius: '50%',
                    bgcolor: btn.play
                      ? PHOTO_ALBUMS_CONTEXT_TUTORIAL_HIGHLIGHT_BG
                      : btn.stop
                        ? 'var(--theme-error-color, #d32f2f)'
                        : '#fff',
                    color: btn.stop ? '#fff' : '#111',
                    fontWeight: 900,
                    fontSize: btn.play || btn.stop ? '0.85rem' : '0.75rem',
                    lineHeight: 1,
                    cursor: 'pointer',
                    p: 0,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: TUTORIAL_FONT_FAMILY,
                    '&:hover': { filter: 'brightness(0.95)' }
                  }}
                >
                  {btn.label}
                </Box>
              ))}
            </Box>
          </Box>
          <Box
            component="button"
            type="button"
            title={clickForAudioLabel}
            aria-label={clickForAudioLabel}
            onClick={playReadoutSpeech}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              border: 0,
              bgcolor: 'transparent',
              cursor: 'pointer',
              p: 0,
              fontFamily: TUTORIAL_FONT_FAMILY,
              color: '#111',
              WebkitTextFillColor: '#111'
            }}
          >
            <Typography
              component="span"
              sx={{
                fontWeight: 800,
                fontSize: `${Math.round(fontPx * 0.8)}px`,
                lineHeight: 1.2,
                fontFamily: TUTORIAL_FONT_FAMILY,
                color: '#111',
                WebkitTextFillColor: '#111'
              }}
            >
              {clickForAudioLabel}
            </Typography>
          </Box>
        </Box>
        <Typography
          component="h2"
          sx={{
            m: 0,
            mb: 1,
            fontWeight: 800,
            fontSize: `${Math.round(fontPx * 1.1)}px`,
            lineHeight: 1.25,
            fontFamily: TUTORIAL_FONT_FAMILY,
            color: '#111',
            WebkitTextFillColor: '#111'
          }}
        >
          {copy.title}
        </Typography>
        <Typography
          component="p"
          sx={{
            m: 0,
            fontWeight: 700,
            fontSize: `${fontPx}px`,
            lineHeight: 1.45,
            fontFamily: TUTORIAL_FONT_FAMILY,
            color: '#111',
            WebkitTextFillColor: '#111',
            whiteSpace: 'pre-wrap'
          }}
        >
          {bodyPhrases.map((phrase, i) => (
            <Box
              component="span"
              key={`tut-phrase-${i}`}
              sx={{
                display: String(copy.body || '').includes('\n') ? 'block' : 'inline',
                borderRadius: '3px',
                px: '2px',
                boxDecorationBreak: 'clone',
                WebkitBoxDecorationBreak: 'clone',
                bgcolor: i === phraseIndex ? PHOTO_ALBUMS_CONTEXT_TUTORIAL_HIGHLIGHT_BG : 'transparent',
                color: '#111',
                WebkitTextFillColor: '#111',
                transition: 'background-color 80ms linear'
              }}
            >
              {phrase}
              {!String(copy.body || '').includes('\n') && i < bodyPhrases.length - 1 ? ' ' : ''}
            </Box>
          ))}
        </Typography>
        <Typography
          sx={{
            mt: 1.5,
            fontWeight: 600,
            fontSize: `${Math.round(fontPx * 0.85)}px`,
            lineHeight: 1.4,
            opacity: 0.85,
            fontFamily: TUTORIAL_FONT_FAMILY,
            color: '#111',
            WebkitTextFillColor: '#111'
          }}
        >
          Stays in sync with the album tab. Use PopOut to float outside this window.
        </Typography>
      </Box>
    </Box>,
    document.body
  );
}

PhotoAlbumsContextTutorial.propTypes = {
  active: PropTypes.bool,
  photoEditActive: PropTypes.bool,
  panZoomActive: PropTypes.bool,
  hasPageContext: PropTypes.bool,
  hasAlbumPhotos: PropTypes.bool,
  /** Increment to toggle the panel (same as Open Tutorial). */
  openRequestKey: PropTypes.number
};
