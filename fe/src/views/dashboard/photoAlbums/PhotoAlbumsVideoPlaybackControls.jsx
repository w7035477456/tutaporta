import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import GreenButton from 'ui-component/GreenButton';
import { slotZoomSliderSx } from './photoAlbumsSlotZoom';

function formatVideoTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * Play / Pause + seek slider for video in Photo/Video Edit popup.
 */
export default function PhotoAlbumsVideoPlaybackControls({ videoRef, disabled = false }) {
  const [playing, setPlaying] = useState(false);
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);

  const syncFromVideo = useCallback(() => {
    const video = videoRef?.current;
    if (!video) return;
    setPlaying(!video.paused && !video.ended);
    setCurrentSec(Number.isFinite(video.currentTime) ? video.currentTime : 0);
    setDurationSec(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0);
  }, [videoRef]);

  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return undefined;
    const onTimeUpdate = () => setCurrentSec(video.currentTime || 0);
    const onDuration = () => setDurationSec(video.duration > 0 ? video.duration : 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrentSec(video.duration || 0);
    };
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onDuration);
    video.addEventListener('durationchange', onDuration);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    syncFromVideo();
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onDuration);
      video.removeEventListener('durationchange', onDuration);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, [videoRef, syncFromVideo]);

  const handlePlay = useCallback(() => {
    const video = videoRef?.current;
    if (!video || disabled) return;
    void video.play().catch(() => {});
  }, [videoRef, disabled]);

  const handlePause = useCallback(() => {
    videoRef?.current?.pause?.();
  }, [videoRef]);

  const handleSeek = useCallback(
    (_event, value) => {
      const video = videoRef?.current;
      if (!video || disabled) return;
      const next = Array.isArray(value) ? value[0] : value;
      const sec = Math.max(0, Number(next) || 0);
      video.currentTime = sec;
      setCurrentSec(sec);
    },
    [videoRef, disabled]
  );

  const maxSec = durationSec > 0 ? durationSec : Math.max(currentSec, 1);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1,
        py: 0.75,
        bgcolor: 'rgba(0,0,0,0.72)',
        borderTop: '2px solid var(--theme-yellow-color)',
        flexShrink: 0
      }}
    >
      <GreenButton
        type="button"
        disabled={disabled}
        onClick={handlePlay}
        sx={{ minWidth: 64, fontWeight: 800, flexShrink: 0 }}
      >
        Play
      </GreenButton>
      <Box sx={{ flex: '1 1 auto', minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Slider
          min={0}
          max={maxSec}
          step={0.1}
          value={Math.min(currentSec, maxSec)}
          disabled={disabled || maxSec <= 0}
          onChange={handleSeek}
          sx={{
            ...slotZoomSliderSx(true),
            flex: '1 1 auto',
            color: '#FFEB3B'
          }}
          aria-label="Video position"
        />
        <Box
          component="span"
          sx={{
            color: '#fff',
            fontWeight: 700,
            fontSize: '0.78rem',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            minWidth: '4.5rem',
            textAlign: 'right'
          }}
        >
          {formatVideoTime(currentSec)} / {formatVideoTime(durationSec)}
        </Box>
      </Box>
      <GreenButton
        type="button"
        disabled={disabled}
        onClick={handlePause}
        sx={{ minWidth: 64, fontWeight: 800, flexShrink: 0 }}
      >
        Pause
      </GreenButton>
    </Box>
  );
}

PhotoAlbumsVideoPlaybackControls.propTypes = {
  videoRef: PropTypes.shape({ current: PropTypes.object }),
  disabled: PropTypes.bool
};
