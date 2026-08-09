import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import audioOnImg from 'assets/images/audioOn.png';
import audioOffImg from 'assets/images/audioOff.png';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { clickableTextHoverMagnifySx, getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
import { useBackgroundMusic } from 'contexts/BackgroundMusicContext';
import EmbeddedYoutubePlayerPopup from 'ui-component/EmbeddedYoutubePlayerPopup';
import { normalizeYoutubeMusicUrl } from 'utils/normalizeYoutubeMusicUrl';
import { OPEN_EMBEDDED_YOUTUBE_PLAYER_EVENT } from 'utils/embeddedYoutubePlayerEvents';
import { INVERSE_DAYNIGHT_VAR } from 'utils/themeConfig';
import { themedAlert } from 'utils/themedDialog';
import { CUSTOM_MUSIC_URL_SLOT_COUNT } from 'api/userCustomizationFe';

const LABEL_FONT_SIZE = buttonFontSizeResponsive;
const ICON_BASE_PX = 32;
const VSINGLES_TOOLBAR_RED = '#d32f2f';
const VSINGLES_SLIDER_RAIL = 'rgba(255, 255, 255, 0.45)';

function volumeAccent(v) {
  if (v <= 0) return '#9e9e9e';
  if (v < 34) return '#1e88e5';
  if (v < 67) return '#43a047';
  return '#e53935';
}

function volumeLabelHoverSx() {
  return {
    ...clickableTextHoverMagnifySx({ baseFontSize: LABEL_FONT_SIZE, clickable: true })
  };
}

function speakerIconSizePx(magnified) {
  const factor = getHoverMagnifyFactor();
  return magnified ? ICON_BASE_PX * factor : ICON_BASE_PX;
}

function VolumeControlLabel({ children, onClick, disabled, align = 'left', underline = false, color }) {
  return (
    <Typography
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      sx={{
        m: 0,
        p: 0,
        border: 'none',
        background: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontWeight: 600,
        fontSize: LABEL_FONT_SIZE,
        color: color || `var(${INVERSE_DAYNIGHT_VAR})`,
        textAlign: align,
        textDecoration: underline && !disabled ? 'underline' : 'none',
        textDecorationColor: color || `var(${INVERSE_DAYNIGHT_VAR})`,
        opacity: disabled ? 0.6 : 1,
        ...volumeLabelHoverSx()
      }}
    >
      {children}
    </Typography>
  );
}

VolumeControlLabel.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  align: PropTypes.oneOf(['left', 'right', 'center']),
  underline: PropTypes.bool,
  color: PropTypes.string
};

/**
 * Bottom-right / sidebar music: Mute + Track labels; mute + slider + max; DB save on slider release.
 */
export default function BackgroundMusicFooterControls({
  variant = 'footer',
  showTrackLink = true,
  overlayZIndex,
  centerInWindow = false
}) {
  const {
    volume,
    preferenceLoaded,
    isFooterMuted,
    customMusicUrls,
    loadDefault,
    saveCustomMusicUrlSlot,
    loadDefaultCustomMusicUrls,
    playCustomMusicFromSlot,
    setVolume,
    muteFromFooter,
    maxFromFooter
  } = useBackgroundMusic();

  const [youtubeDialogOpen, setYoutubeDialogOpen] = useState(false);
  const [loadDefaultBusy, setLoadDefaultBusy] = useState(false);
  const [autoLoadDefaultTried, setAutoLoadDefaultTried] = useState(false);
  const isFixed = variant === 'fixed';
  const isSidebar = variant === 'sidebar';
  const isFooterBar = variant === 'footer';
  const isVsinglesToolbar = variant === 'vsinglesToolbar';
  const accent = isVsinglesToolbar ? VSINGLES_TOOLBAR_RED : volumeAccent(volume);
  const trackVisible = showTrackLink;
  const muteIconSize = speakerIconSizePx(isFooterMuted);
  const maxIconSize = speakerIconSizePx(!isFooterMuted);

  const handleSliderChange = (_e, value) => {
    const v = Array.isArray(value) ? value[0] : value;
    void setVolume(v, { localOnly: true });
  };

  const handleSliderCommitted = (_e, value) => {
    const v = Array.isArray(value) ? value[0] : value;
    void setVolume(v, { flush: true });
  };

  const handleLoadDefault = async () => {
    if (loadDefaultBusy) return;
    setLoadDefaultBusy(true);
    try {
      await loadDefaultCustomMusicUrls();
    } catch (err) {
      await themedAlert(err?.response?.data?.error || err?.message || 'Could not load default music URLs.');
    } finally {
      setLoadDefaultBusy(false);
    }
  };

  const openYoutubeDialog = () => {
    if (!preferenceLoaded) return;
    setYoutubeDialogOpen(true);
  };

  const closeYoutubeDialog = () => setYoutubeDialogOpen(false);

  useEffect(() => {
    const onOpenRequest = (event) => {
      if (!preferenceLoaded) return;
      setYoutubeDialogOpen(true);
      const slotIndex = Number(event?.detail?.slotIndex);
      if (!Number.isFinite(slotIndex) || slotIndex < 0 || slotIndex >= CUSTOM_MUSIC_URL_SLOT_COUNT) return;
      if (event?.detail?.play === true) {
        void playCustomMusicFromSlot(slotIndex);
      }
    };
    window.addEventListener(OPEN_EMBEDDED_YOUTUBE_PLAYER_EVENT, onOpenRequest);
    return () => window.removeEventListener(OPEN_EMBEDDED_YOUTUBE_PLAYER_EVENT, onOpenRequest);
  }, [preferenceLoaded, playCustomMusicFromSlot]);

  // First Track open: if load_default=false, apply global defaults once.
  useEffect(() => {
    if (!youtubeDialogOpen || !preferenceLoaded) return;
    if (autoLoadDefaultTried || loadDefault !== false || loadDefaultBusy) return;
    setAutoLoadDefaultTried(true);
    void handleLoadDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot when dialog opens
  }, [youtubeDialogOpen, preferenceLoaded, loadDefault, loadDefaultBusy, autoLoadDefaultTried]);

  const handleMemorizeSlot = async (slotIndex, rawUrl) => {
    try {
      return await saveCustomMusicUrlSlot(slotIndex, rawUrl);
    } catch (err) {
      const apiMessage = err?.response?.data?.error;
      await themedAlert(
        apiMessage ||
          (err?.isInvalidYoutubeUrl ? err.message : null) ||
          'Could not save this URL. Please try again.'
      );
      throw err;
    }
  };

  const handlePlaySlot = async (slotIndex, draftUrl) => {
    const trimmed = String(draftUrl ?? '').trim();
    const normalized = trimmed ? normalizeYoutubeMusicUrl(trimmed) : customMusicUrls[slotIndex];
    if (!normalized) {
      await themedAlert(
        'Please enter a full YouTube link or 11-character video ID (watch, youtu.be, shorts, or embed).'
      );
      return;
    }

    const started = playCustomMusicFromSlot(slotIndex, normalized);
    if (!started) {
      await themedAlert(`No memorized URL found in slot ${slotIndex + 1} yet.`);
      return;
    }
    closeYoutubeDialog();

    if (trimmed) {
      try {
        await saveCustomMusicUrlSlot(slotIndex, trimmed);
      } catch (err) {
        const apiMessage = err?.response?.data?.error;
        const message =
          apiMessage ||
          (err?.isInvalidYoutubeUrl ? err.message : null) ||
          'Could not save this URL to your profile. Playback started anyway.';
        console.warn('[BackgroundMusicFooterControls] memorize after play failed', err);
        await themedAlert(message);
      }
    }
  };

  return (
    <Box
      data-no-click-sound
      sx={
        isFixed
          ? {
              position: 'fixed',
              bottom: 16,
              right: 16,
              zIndex: 1300,
              maxWidth: { xs: 'min(100vw - 20px, 420px)', sm: 520 },
              bgcolor: 'var(--theme-daynight-color)',
              border: '1px solid var(--theme-primary-color)',
              borderRadius: 1,
              p: 1
            }
          : isSidebar
            ? {
                maxWidth: '100%',
                minWidth: 0,
                width: '100%',
                '& .MuiSlider-root': {
                  minWidth: { xs: 72, sm: 96 }
                }
              }
            : isFooterBar
              ? {
                  maxWidth: { xs: '100%', sm: 520 },
                  minWidth: 0,
                  width: 'auto',
                  flex: '1 1 auto',
                  '& .MuiSlider-root': {
                    minWidth: { xs: 56, sm: 88 }
                  }
                }
              : isVsinglesToolbar
                ? {
                    width: 'auto',
                    minWidth: 0,
                    flex: '1 1 auto',
                    maxWidth: { xs: '100%', sm: 360 },
                    '& .MuiSlider-root': {
                      minWidth: { xs: 96, sm: 140 }
                    }
                  }
              : {
                  maxWidth: { xs: 320, sm: 460 },
                  minWidth: 0,
                  width: '100%'
                }
      }
    >
      {isVsinglesToolbar ? (
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0, width: '100%' }}>
          <VolumeControlLabel
            underline
            disabled={!preferenceLoaded}
            color={VSINGLES_TOOLBAR_RED}
            onClick={() => {
              if (!preferenceLoaded) return;
              void muteFromFooter();
            }}
          >
            Mute
          </VolumeControlLabel>
          <IconButton
            type="button"
            size="small"
            onClick={() => void muteFromFooter()}
            disabled={!preferenceLoaded}
            aria-label="Mute music"
            sx={{
              flexShrink: 0,
              p: 0.5,
              width: muteIconSize + 8,
              height: muteIconSize + 8,
              border: isFooterMuted ? `2px solid ${VSINGLES_TOOLBAR_RED}` : '2px solid transparent',
              borderRadius: 1
            }}
          >
            <Box
              component="img"
              src={audioOffImg}
              alt=""
              sx={{ width: muteIconSize, height: muteIconSize, display: 'block', objectFit: 'contain' }}
            />
          </IconButton>
          <Slider
            value={volume}
            onChange={handleSliderChange}
            onChangeCommitted={handleSliderCommitted}
            min={0}
            max={100}
            step={1}
            size="small"
            disabled={!preferenceLoaded}
            aria-label="Music volume"
            valueLabelDisplay="off"
            sx={{
              flex: 1,
              minWidth: { xs: 96, sm: 140 },
              color: VSINGLES_TOOLBAR_RED,
              '& .MuiSlider-track': { border: 'none', backgroundColor: VSINGLES_TOOLBAR_RED },
              '& .MuiSlider-rail': { opacity: 1, backgroundColor: VSINGLES_SLIDER_RAIL },
              '& .MuiSlider-thumb': {
                width: 14,
                height: 14,
                backgroundColor: VSINGLES_TOOLBAR_RED,
                border: '2px solid #fff'
              }
            }}
          />
          <Typography
            component="span"
            aria-live="polite"
            sx={{
              flexShrink: 0,
              fontWeight: 700,
              fontSize: LABEL_FONT_SIZE,
              color: VSINGLES_TOOLBAR_RED,
              lineHeight: 1,
              minWidth: '3.5ch',
              textAlign: 'center'
            }}
          >
            {volume}%
          </Typography>
          <IconButton
            type="button"
            size="small"
            onClick={() => void maxFromFooter()}
            disabled={!preferenceLoaded}
            aria-label="Maximum music volume"
            sx={{ flexShrink: 0, p: 0.5, width: maxIconSize + 8, height: maxIconSize + 8 }}
          >
            <Box
              component="img"
              src={audioOnImg}
              alt=""
              sx={{ width: maxIconSize, height: maxIconSize, display: 'block', objectFit: 'contain' }}
            />
          </IconButton>
        </Stack>
      ) : isFooterBar ? (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0, width: '100%' }}>
          <VolumeControlLabel
            underline
            disabled={!preferenceLoaded}
            onClick={() => {
              if (!preferenceLoaded) return;
              void muteFromFooter();
            }}
          >
            Mute
          </VolumeControlLabel>
          <IconButton
            type="button"
            size="small"
            onClick={() => void muteFromFooter()}
            disabled={!preferenceLoaded}
            aria-label="Mute music"
            sx={{
              flexShrink: 0,
              p: 0.25,
              width: muteIconSize + 4,
              height: muteIconSize + 4,
              border: isFooterMuted ? '2px solid var(--theme-error-color)' : '2px solid transparent',
              borderRadius: 1
            }}
          >
            <Box
              component="img"
              src={audioOffImg}
              alt=""
              sx={{ width: muteIconSize, height: muteIconSize, display: 'block', objectFit: 'contain' }}
            />
          </IconButton>
          <Slider
            value={volume}
            onChange={handleSliderChange}
            onChangeCommitted={handleSliderCommitted}
            min={0}
            max={100}
            step={1}
            size="small"
            disabled={!preferenceLoaded}
            aria-label="Music volume"
            valueLabelDisplay="off"
            sx={{
              flex: 1,
              minWidth: { xs: 56, sm: 88 },
              color: accent,
              '& .MuiSlider-track': { border: 'none', backgroundColor: accent },
              '& .MuiSlider-rail': { opacity: 0.35, backgroundColor: isFooterMuted ? '#bdbdbd' : accent },
              '& .MuiSlider-thumb': {
                width: 12,
                height: 12,
                backgroundColor: accent,
                border: '2px solid #fff'
              }
            }}
          />
          <Typography
            component="span"
            aria-live="polite"
            sx={{
              flexShrink: 0,
              fontWeight: 700,
              fontSize: LABEL_FONT_SIZE,
              color: `var(${INVERSE_DAYNIGHT_VAR})`,
              lineHeight: 1,
              minWidth: '3.5ch',
              textAlign: 'center'
            }}
          >
            {volume}%
          </Typography>
          {trackVisible ? (
            <VolumeControlLabel
              underline
              align="right"
              disabled={!preferenceLoaded}
              onClick={openYoutubeDialog}
            >
              Track
            </VolumeControlLabel>
          ) : null}
        </Stack>
      ) : (
      <Stack spacing={0.5} sx={{ minWidth: 0 }}>
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 1,
            minWidth: 0,
            width: '100%'
          }}
        >
          <VolumeControlLabel
            underline
            disabled={!preferenceLoaded}
            onClick={() => {
              if (!preferenceLoaded) return;
              void muteFromFooter();
            }}
          >
            Mute
          </VolumeControlLabel>
          {trackVisible ? (
            <VolumeControlLabel
              underline
              align="right"
              disabled={!preferenceLoaded}
              onClick={openYoutubeDialog}
            >
              Track
            </VolumeControlLabel>
          ) : (
            <Box sx={{ flex: '0 0 auto', width: 0 }} aria-hidden />
          )}
        </Box>

        <Box sx={{ position: 'relative', minWidth: 0, pt: 2 }}>
          <Typography
            component="span"
            aria-live="polite"
            sx={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              fontWeight: 700,
              fontSize: LABEL_FONT_SIZE,
              color: `var(${INVERSE_DAYNIGHT_VAR})`,
              lineHeight: 1.2,
              pointerEvents: 'none',
              whiteSpace: 'nowrap'
            }}
          >
            {volume}%
          </Typography>

          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ minWidth: 0 }}>
            <IconButton
              type="button"
              size="small"
              onClick={() => void muteFromFooter()}
              disabled={!preferenceLoaded}
              aria-label="Mute music"
              sx={{
                flexShrink: 0,
                p: 0.5,
                width: muteIconSize + 8,
                height: muteIconSize + 8,
                border: isFooterMuted ? '2px solid var(--theme-error-color)' : '2px solid transparent',
                borderRadius: 1,
                transition: 'width 0.15s ease, height 0.15s ease'
              }}
            >
              <Box
                component="img"
                src={audioOffImg}
                alt=""
                sx={{
                  width: muteIconSize,
                  height: muteIconSize,
                  display: 'block',
                  objectFit: 'contain',
                  transition: 'width 0.15s ease, height 0.15s ease'
                }}
              />
            </IconButton>

            <Slider
              value={volume}
              onChange={handleSliderChange}
              onChangeCommitted={handleSliderCommitted}
              min={0}
              max={100}
              step={1}
              size="small"
              disabled={!preferenceLoaded}
              aria-label="Music volume"
              valueLabelDisplay="off"
              sx={{
                flex: 1,
                minWidth: { xs: 110, sm: 180 },
                color: accent,
                '& .MuiSlider-track': { border: 'none', backgroundColor: accent },
                '& .MuiSlider-rail': { opacity: 0.35, backgroundColor: isFooterMuted ? '#bdbdbd' : accent },
                '& .MuiSlider-thumb': {
                  width: 14,
                  height: 14,
                  backgroundColor: accent,
                  border: '2px solid #fff'
                }
              }}
            />

            <IconButton
              type="button"
              size="small"
              onClick={() => void maxFromFooter()}
              disabled={!preferenceLoaded}
              aria-label="Maximum music volume"
              sx={{
                flexShrink: 0,
                p: 0.5,
                width: maxIconSize + 8,
                height: maxIconSize + 8,
                transition: 'width 0.15s ease, height 0.15s ease'
              }}
            >
              <Box
                component="img"
                src={audioOnImg}
                alt=""
                sx={{
                  width: maxIconSize,
                  height: maxIconSize,
                  display: 'block',
                  objectFit: 'contain',
                  transition: 'width 0.15s ease, height 0.15s ease'
                }}
              />
            </IconButton>
          </Stack>
        </Box>
      </Stack>
      )}

      <EmbeddedYoutubePlayerPopup
        open={youtubeDialogOpen}
        onClose={closeYoutubeDialog}
        slotValues={customMusicUrls}
        onMemorizeSlot={handleMemorizeSlot}
        onPlaySlot={handlePlaySlot}
        onLoadDefault={handleLoadDefault}
        loadDefaultBusy={loadDefaultBusy}
        overlayZIndex={overlayZIndex}
        centerInWindow={centerInWindow}
      />
    </Box>
  );
}

BackgroundMusicFooterControls.propTypes = {
  variant: PropTypes.oneOf(['footer', 'fixed', 'sidebar', 'vsinglesToolbar']),
  showTrackLink: PropTypes.bool,
  overlayZIndex: PropTypes.number,
  centerInWindow: PropTypes.bool
};
