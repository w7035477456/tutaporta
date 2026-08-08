import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import GreenButton from 'ui-component/GreenButton';
import BusyHourglass from 'ui-component/BusyHourglass';
import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import { fetchPhotoAlbumsSharedAlbumAttachmentBlob } from 'api/photoAlbumsInviteFe';
import { trimSolidImageBorder } from 'utils/trimSolidImageBorder';
import { useSlideShowMusicPlayback } from 'hooks/useSlideShowMusicPlayback';
import SlideShowMusicControls from './SlideShowMusicControls';
import {
  PHOTO_ALBUMS_PHOTO_SLIDESHOW_BASE_Z,
  PHOTO_ALBUMS_PHOTO_SLIDESHOW_MUSIC_CONTROLS_Z
} from 'config/photoAlbumsLayout';

const SLIDE_MS = 5000;
const HOURGLASS = '2rem';

function readViewerChromeBackground() {
  try {
    const surface = String(document.documentElement.getAttribute('data-theme-surface') || '')
      .trim()
      .toLowerCase();
    if (surface === 'dark') return '#000000';
    if (surface === 'light') return '#ffffff';

    const stored = String(localStorage.getItem('vsingles:theme-choice') || '').trim();
    if (/\bdark$/i.test(stored)) return '#000000';
    if (/\blight$/i.test(stored)) return '#ffffff';

    const raw = String(
      getComputedStyle(document.documentElement).getPropertyValue('--theme-daynight-color') || ''
    )
      .trim()
      .toLowerCase();
    if (raw === '#000' || raw === '#000000' || raw === 'black') return '#000000';
    if (raw === '#fff' || raw === '#ffffff' || raw === 'white') return '#ffffff';
    const nums = raw.match(/\d+(\.\d+)?/g);
    if (nums && nums.length >= 3) {
      const [r, g, b] = nums.slice(0, 3).map((n) => Number(n));
      if ([r, g, b].every((n) => Number.isFinite(n))) {
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance < 0.5 ? '#000000' : '#ffffff';
      }
    }
  } catch {
    // ignore
  }
  return '#000000';
}

function isDarkChrome(bg) {
  const raw = String(bg || '').trim().toLowerCase();
  return raw === '#000' || raw === '#000000' || raw === 'black';
}

function blobWithMime(blob, mime) {
  if (!mime || blob?.type === mime) return blob;
  return new Blob([blob], { type: mime });
}

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jif: 'image/jpeg',
  jfif: 'image/jpeg',
  jfi: 'image/jpeg',
  png: 'image/png',
  apng: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  bmp: 'image/bmp',
  dib: 'image/bmp',
  svg: 'image/svg+xml',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ico: 'image/x-icon',
  heic: 'image/heic',
  heif: 'image/heif',
  svgz: 'image/svg+xml'
};

/**
 * Full-page photo viewer + optional slideshow (5s, loop, Pause/Resume, theme arrows).
 */
export default function PhotoAlbumsPhotoFullscreenOverlay({
  open,
  photos = [],
  startAttachmentId = null,
  slideshow = false,
  noteId = null,
  sharedAlbumId = null,
  storageType = null,
  onClose
}) {
  const chromeBg = useMemo(() => readViewerChromeBackground(), [open]);
  const dark = isDarkChrome(chromeBg);
  const arrowColor = dark ? '#ffffff' : 'var(--theme-yellow-color, #ffeb3b)';
  const arrowShadow = dark ? '0 0 4px rgba(0,0,0,0.85)' : '0 0 4px rgba(0,0,0,0.35)';

  const list = Array.isArray(photos) ? photos : [];
  const startIndex = useMemo(() => {
    const id = Number(startAttachmentId);
    if (!Number.isFinite(id) || id < 1) return 0;
    const idx = list.findIndex((p) => Number(p.attachmentId) === id);
    return idx >= 0 ? idx : 0;
  }, [list, startAttachmentId]);

  const [index, setIndex] = useState(startIndex);
  const [objectUrl, setObjectUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [slideshowActive, setSlideshowActive] = useState(Boolean(slideshow));
  const [paused, setPaused] = useState(false);
  const resumeAtRef = useRef(0);
  const timerRef = useRef(null);
  const objectUrlRef = useRef('');

  useSlideShowMusicPlayback(Boolean(open && slideshowActive));

  useEffect(() => {
    if (!open) return undefined;
    setIndex(startIndex);
    setSlideshowActive(Boolean(slideshow));
    setPaused(false);
    resumeAtRef.current = 0;
    return undefined;
  }, [open, startIndex, slideshow]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goRelative = useCallback(
    (delta, { fromUser = false } = {}) => {
      if (!list.length) return;
      setIndex((prev) => {
        const next = (prev + delta + list.length) % list.length;
        return next;
      });
      if (fromUser && slideshowActive) {
        setPaused(false);
        resumeAtRef.current = Date.now() + SLIDE_MS;
      }
    },
    [list.length, slideshowActive]
  );

  // Advance timer for slideshow
  useEffect(() => {
    clearTimer();
    if (!open || !slideshowActive || paused || list.length < 1) return undefined;

    const delay = Math.max(0, resumeAtRef.current - Date.now()) || SLIDE_MS;
    timerRef.current = setTimeout(() => {
      resumeAtRef.current = 0;
      goRelative(1);
    }, delay);

    return () => clearTimer();
  }, [open, slideshowActive, paused, index, list.length, goRelative, clearTimer]);

  // Load + trim current photo
  useEffect(() => {
    if (!open) return undefined;
    const photo = list[index];
    const attachmentId = Number(photo?.attachmentId);
    const nid = Number(noteId);
    const sharedId = Number(sharedAlbumId);
    const hasShared = Number.isFinite(sharedId) && sharedId > 0;
    if (
      !photo ||
      !Number.isFinite(attachmentId) ||
      attachmentId < 1 ||
      (!hasShared && (!Number.isFinite(nid) || nid < 1))
    ) {
      setError('No photo to display');
      setObjectUrl('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const ext = String(photo.fileExtension || '')
          .trim()
          .toLowerCase()
          .replace(/^\./, '');
        const mime = MIME_BY_EXT[ext] || 'image/jpeg';
        const blob = hasShared
          ? await fetchPhotoAlbumsSharedAlbumAttachmentBlob(sharedId, attachmentId, { inline: true })
          : await fetchPhotoAlbumsNoteAttachmentBlob(nid, attachmentId, {
              storageType
            });
        const trimmed = await trimSolidImageBorder(blobWithMime(blob, mime));
        if (cancelled) return;
        const url = URL.createObjectURL(blobWithMime(trimmed, mime));
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;
        setObjectUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not load photo');
          setObjectUrl('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, index, list, noteId, sharedAlbumId, storageType]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    },
    []
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose?.();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goRelative(-1, { fromUser: true });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goRelative(1, { fromUser: true });
      } else if (event.key === ' ' && slideshowActive) {
        event.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, goRelative, slideshowActive]);

  if (!open || typeof document === 'undefined') return null;

  const arrowSx = {
    color: arrowColor,
    filter: `drop-shadow(${arrowShadow})`,
    bgcolor: 'transparent',
    '&:hover': { bgcolor: 'rgba(128,128,128,0.25)' },
    width: { xs: 48, sm: 64 },
    height: { xs: 48, sm: 64 }
  };

  return createPortal(
    <Box
      role="dialog"
      aria-modal="true"
      aria-label={slideshowActive ? 'Photo slideshow' : 'Full page photo'}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 15000,
        bgcolor: chromeBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      <IconButton
        type="button"
        onClick={() => onClose?.()}
        aria-label="Close"
        sx={{
          position: 'absolute',
          top: 8,
          right: 8,
          zIndex: 2,
          color: arrowColor,
          filter: `drop-shadow(${arrowShadow})`
        }}
      >
        <CloseIcon fontSize="large" />
      </IconButton>

      {list.length > 1 ? (
        <IconButton
          type="button"
          onClick={() => goRelative(-1, { fromUser: true })}
          aria-label="Previous photo"
          sx={{ position: 'absolute', left: { xs: 4, sm: 16 }, top: '50%', transform: 'translateY(-50%)', zIndex: 2, ...arrowSx }}
        >
          <ChevronLeftIcon sx={{ fontSize: { xs: 40, sm: 56 } }} />
        </IconButton>
      ) : null}

      {list.length > 1 ? (
        <IconButton
          type="button"
          onClick={() => goRelative(1, { fromUser: true })}
          aria-label="Next photo"
          sx={{ position: 'absolute', right: { xs: 4, sm: 16 }, top: '50%', transform: 'translateY(-50%)', zIndex: 2, ...arrowSx }}
        >
          <ChevronRightIcon sx={{ fontSize: { xs: 40, sm: 56 } }} />
        </IconButton>
      ) : null}

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 6, sm: 10 },
          py: 6,
          boxSizing: 'border-box',
          bgcolor: chromeBg
        }}
      >
        {loading ? (
          <BusyHourglass fontSize={HOURGLASS} />
        ) : error ? (
          <Box sx={{ color: dark ? '#fff' : '#000', fontWeight: 700, px: 2, textAlign: 'center' }}>{error}</Box>
        ) : objectUrl ? (
          <Box
            component="img"
            src={objectUrl}
            alt={list[index]?.fileName || 'Photo'}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              display: 'block',
              bgcolor: chromeBg,
              userSelect: 'none',
              pointerEvents: 'none'
            }}
          />
        ) : null}
      </Box>

      {slideshowActive ? (
        <SlideShowMusicControls
          zIndex={PHOTO_ALBUMS_PHOTO_SLIDESHOW_MUSIC_CONTROLS_Z}
          slideshowBaseZ={PHOTO_ALBUMS_PHOTO_SLIDESHOW_BASE_Z}
        />
      ) : null}
      {slideshowActive ? (
        <Box
          sx={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 2,
            display: 'flex',
            gap: 1.5,
            alignItems: 'center'
          }}
        >
          <GreenButton
            type="button"
            onClick={() => {
              setPaused(true);
              clearTimer();
            }}
            disabled={paused}
            aria-label="Pause slideshow"
            sx={{ minWidth: 0, px: 2.5, py: 0.75, fontWeight: 800 }}
          >
            Pause
          </GreenButton>
          <GreenButton
            type="button"
            onClick={() => {
              setPaused(false);
              resumeAtRef.current = Date.now() + SLIDE_MS;
            }}
            disabled={!paused}
            aria-label="Resume slideshow"
            sx={{ minWidth: 0, px: 2.5, py: 0.75, fontWeight: 800 }}
          >
            Resume
          </GreenButton>
        </Box>
      ) : null}
    </Box>,
    document.body
  );
}

PhotoAlbumsPhotoFullscreenOverlay.propTypes = {
  open: PropTypes.bool,
  photos: PropTypes.arrayOf(
    PropTypes.shape({
      attachmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      fileName: PropTypes.string,
      fileExtension: PropTypes.string
    })
  ),
  startAttachmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  slideshow: PropTypes.bool,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sharedAlbumId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  onClose: PropTypes.func
};
