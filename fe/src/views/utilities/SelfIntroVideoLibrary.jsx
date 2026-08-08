import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import ThumbnailDeleteXButton from 'ui-component/ThumbnailDeleteXButton';
import { selfIntroVideoUrl, videoThumbnailUrl } from 'api/selfIntroVideoFe';
import { getDesktopButtonFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { SELF_INTRO_VIDEO_LIMITS_MESSAGE } from 'constants/selfIntroVideoLimits';
import { BUTTON_TEMPLATE_THICK_BLACK_BORDER } from 'config/selectedUnselectedButtonTemplate';
import { getHoverEnlargeTransform } from 'config/hoverEnlargeEnv';
import api from 'api/axios';
import videoIconImg from 'assets/images/videoIcon.png';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

const slotButtonFontSize = { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() };

/** Play icon overlay — bottom-left on video thumbnails (differentiate from photos). */
export function VideoThumbnailIconOverlay({ sx } = {}) {
  return (
    <Box
      component="img"
      src={videoIconImg}
      alt=""
      aria-hidden
      draggable={false}
      sx={{
        position: 'absolute',
        zIndex: 4,
        bottom: '6%',
        left: '6%',
        width: '32%',
        maxWidth: 40,
        height: 'auto',
        pointerEvents: 'none',
        userSelect: 'none',
        ...sx
      }}
    />
  );
}

VideoThumbnailIconOverlay.propTypes = {
  sx: PropTypes.object
};

const slotThumbSx = {
  border: `${BUTTON_TEMPLATE_THICK_BLACK_BORDER}`,
  borderRadius: 1,
  width: '100%',
  aspectRatio: '1 / 1',
  overflow: 'hidden',
  bgcolor: '#111',
  cursor: 'grab',
  transformOrigin: 'center center',
  '&:active': {
    cursor: 'grabbing'
  },
  '@media (hover: hover)': {
    '&:hover': {
      transform: getHoverEnlargeTransform()
    }
  }
};

/** JPEG thumbnail from videos.video_thumbnail (play icon baked in on save). */
export function SelfIntroVideoFrameThumbnail({ videoId, mediaExtension, sx }) {
  const src = videoThumbnailUrl(videoId);
  const ext = String(mediaExtension || '').toLowerCase();
  const isAudio = ext === 'mp3';

  if (!src) {
    if (!isAudio) return null;
    return (
      <Box
        sx={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#111',
          color: '#ffd84d',
          fontWeight: 900,
          fontSize: '0.75rem',
          ...sx
        }}
      >
        MP3
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      onError={(e) => {
        if (!isAudio) return;
        e.currentTarget.style.display = 'none';
      }}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        pointerEvents: 'none',
        ...sx
      }}
    />
  );
}

SelfIntroVideoFrameThumbnail.propTypes = {
  videoId: PropTypes.number,
  mediaExtension: PropTypes.string,
  sx: PropTypes.object
};

const emptySlotSx = {
  border: '2px dashed var(--theme-primary-color)',
  borderRadius: 1,
  minHeight: { xs: 44, sm: 48 },
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--theme-primary-color)',
  opacity: 0.65,
  fontWeight: 700,
  fontSize: slotButtonFontSize
};

export const SELF_INTRO_VIDEO_ID_MIME = 'application/x-vsingles-self-intro-video-id';

/** Task — playback popup for a self intro library video. */
export default function SelfIntroVideoPlaybackPopup({ open, videoId, mediaExtension, onClose }) {
  const mediaRef = useRef(null);
  const [objectUrl, setObjectUrl] = useState('');
  const [mediaKind, setMediaKind] = useState('video');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !videoId) {
      setObjectUrl('');
      setMediaKind('video');
      setError('');
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    let blobUrl = '';

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get(`/api/video/${videoId}`, { responseType: 'blob' });
        if (cancelled) return;
        const ext = String(mediaExtension || '').toLowerCase();
        const isAudio =
          ext === 'mp3' || String(data.type || '').startsWith('audio/');
        setMediaKind(isAudio ? 'audio' : 'video');
        blobUrl = URL.createObjectURL(data);
        setObjectUrl(blobUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || 'Could not load video.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [open, videoId, mediaExtension]);

  const mediaLabel = mediaKind === 'audio' ? 'Public Vault Audio' : 'Self Intro Video';

  return (
    <ColorTemplate7PopupLargeDark open={open} onClose={onClose} closeOnBackdrop closeButtonAriaLabel="Close video playback">
      <ColorTemplate7PopupLargeDark.Body spacing={1}>
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontWeight: 700 }}>
          {mediaLabel}
        </ColorTemplate7PopupLargeDark.BodyText>
        {loading ? (
          <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center' }}>Loading…</ColorTemplate7PopupLargeDark.BodyText>
        ) : null}
        {error ? (
          <ColorTemplate7PopupLargeDark.ErrorBar sx={{ textAlign: 'center' }}>{error}</ColorTemplate7PopupLargeDark.ErrorBar>
        ) : null}
        {objectUrl && mediaKind === 'audio' ? (
          <Box
            component="audio"
            ref={mediaRef}
            src={objectUrl}
            controls
            autoPlay
            sx={{ width: '100%' }}
          />
        ) : null}
        {objectUrl && mediaKind === 'video' ? (
          <Box
            component="video"
            ref={mediaRef}
            src={objectUrl}
            controls
            autoPlay
            playsInline
            sx={{ width: '100%', maxHeight: '70vh', borderRadius: 1, bgcolor: '#000' }}
          />
        ) : null}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

SelfIntroVideoPlaybackPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  videoId: PropTypes.number,
  mediaExtension: PropTypes.string,
  onClose: PropTypes.func.isRequired
};

function SelfIntroVideoSlotButton({ slot, videoId, onPlay, onRemove, disabled }) {
  const handleDragStart = useCallback(
    (e) => {
      if (!videoId) return;
      e.dataTransfer.setData(SELF_INTRO_VIDEO_ID_MIME, String(videoId));
      e.dataTransfer.setData('text/plain', String(videoId));
      e.dataTransfer.effectAllowed = 'copy';
    },
    [videoId]
  );

  if (!videoId) {
    return (
      <Box sx={emptySlotSx} aria-label={`Self intro video slot ${slot} empty`}>
        Empty
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', overflow: 'visible' }}>
      <Box
        component="button"
        type="button"
        draggable
        onDragStart={handleDragStart}
        onClick={() => onPlay?.(videoId)}
        disabled={disabled}
        aria-label={`Self intro video ${slot}`}
        sx={{
          ...slotThumbSx,
          position: 'relative',
          display: 'block',
          width: '100%',
          p: 0,
          m: 0,
          opacity: disabled ? 0.55 : 1
        }}
      >
        <SelfIntroVideoFrameThumbnail videoId={videoId} />
      </Box>
      <ThumbnailDeleteXButton
        aria-label={`Remove video ${slot}`}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          onRemove?.(slot);
        }}
      />
    </Box>
  );
}

SelfIntroVideoSlotButton.propTypes = {
  slot: PropTypes.number.isRequired,
  videoId: PropTypes.number,
  onPlay: PropTypes.func,
  onRemove: PropTypes.func,
  disabled: PropTypes.bool
};

/** Three-slot library: drag to posting area; click to play. */
export function SelfIntroVideoLibrary({ slots = [], onPlay, onRemoveSlot, busy = false }) {
  return (
    <Box sx={{ width: '100%', mt: 1.5 }}>
      <ColorTemplate7PopupLargeDark.BodyText
        sx={{
          textAlign: 'center',
          fontWeight: 700,
          color: 'var(--theme-primary-color)',
          mb: 1,
          fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() }
        }}
      >
        Your Videos Intro Library: Drag down to the posting area to share with comments.
      </ColorTemplate7PopupLargeDark.BodyText>
      <ColorTemplate7PopupLargeDark.BodyText
        sx={{
          textAlign: 'center',
          fontWeight: 700,
          color: 'var(--theme-primary-color)',
          mb: 1,
          lineHeight: 1.35,
          fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() }
        }}
      >
        {SELF_INTRO_VIDEO_LIMITS_MESSAGE}
      </ColorTemplate7PopupLargeDark.BodyText>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
          gap: 1.25,
          width: '100%'
        }}
      >
        {(Array.isArray(slots) && slots.length ? slots : [{ slot: 1 }, { slot: 2 }, { slot: 3 }]).map((entry) => (
          <SelfIntroVideoSlotButton
            key={entry.slot}
            slot={entry.slot}
            videoId={entry.videoId}
            onPlay={onPlay}
            onRemove={onRemoveSlot}
            disabled={busy}
          />
        ))}
      </Box>
    </Box>
  );
}

SelfIntroVideoLibrary.propTypes = {
  slots: PropTypes.arrayOf(
    PropTypes.shape({
      slot: PropTypes.number,
      videoId: PropTypes.number
    })
  ),
  onPlay: PropTypes.func,
  onRemoveSlot: PropTypes.func,
  busy: PropTypes.bool
};

const recorderSlotThumbButtonSx = {
  ...slotThumbSx,
  position: 'relative',
  aspectRatio: '4 / 5',
  display: 'block',
  width: '100%',
  p: 0,
  m: 0,
  cursor: 'pointer',
  '@media (hover: hover)': {
    '&:hover': {
      transform: 'none'
    }
  }
};

/** Record popup strip — 3× the compact empty-slot baseline (36px → 108px tall). */
const RECORDER_STRIP_SLOT_HEIGHT_PX = 108;
const RECORDER_STRIP_SLOT_WIDTH_PX = RECORDER_STRIP_SLOT_HEIGHT_PX * (4 / 5);

/** Compact three-slot strip inside the record popup — click to load into main player. */
export function SelfIntroVideoRecorderSlotStrip({
  slots = [],
  activeVideoId,
  onSelectVideo,
  onRemoveSlot,
  disabled = false
}) {
  const normalized =
    Array.isArray(slots) && slots.length ? slots : [{ slot: 1 }, { slot: 2 }, { slot: 3 }];

  return (
    <Box
      {...guestDemoAllowProps()}
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${RECORDER_STRIP_SLOT_WIDTH_PX}px)`,
        gap: 2.25,
        width: 'fit-content',
        maxWidth: '100%',
        mx: 'auto',
        mt: 0.5
      }}
    >
      {normalized.map((entry) => {
        const videoId = entry.videoId;
        const isActive = videoId && activeVideoId === videoId;

        if (!videoId) {
          return (
            <Box
              key={entry.slot}
              sx={{
                ...emptySlotSx,
                width: RECORDER_STRIP_SLOT_WIDTH_PX,
                minHeight: RECORDER_STRIP_SLOT_HEIGHT_PX,
                aspectRatio: '4 / 5'
              }}
              aria-label={`Self intro video slot ${entry.slot} empty`}
            />
          );
        }

        return (
          <Box key={entry.slot} sx={{ position: 'relative', width: RECORDER_STRIP_SLOT_WIDTH_PX, overflow: 'visible' }}>
            <Box
              component="button"
              type="button"
              onClick={() => onSelectVideo?.(videoId)}
              disabled={disabled}
              aria-label={`Load self intro video ${entry.slot}`}
              aria-pressed={isActive}
              {...guestDemoAllowProps()}
              sx={{
                ...recorderSlotThumbButtonSx,
                cursor: disabled ? 'not-allowed' : 'pointer',
                border: isActive ? '3px solid #ffd84d' : slotThumbSx.border,
                opacity: disabled ? 0.55 : 1
              }}
            >
              <SelfIntroVideoFrameThumbnail videoId={videoId} />
            </Box>
            <ThumbnailDeleteXButton
              aria-label={`Delete self intro video ${entry.slot}`}
              disabled={disabled}
              {...guestDemoAllowProps()}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRemoveSlot?.(entry.slot);
              }}
            />
          </Box>
        );
      })}
    </Box>
  );
}

SelfIntroVideoRecorderSlotStrip.propTypes = {
  slots: PropTypes.arrayOf(
    PropTypes.shape({
      slot: PropTypes.number,
      videoId: PropTypes.number
    })
  ),
  activeVideoId: PropTypes.number,
  onSelectVideo: PropTypes.func,
  onRemoveSlot: PropTypes.func,
  disabled: PropTypes.bool
};

export { selfIntroVideoUrl };
