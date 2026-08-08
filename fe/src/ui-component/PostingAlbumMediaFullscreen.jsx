import PropTypes from 'prop-types';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ColorTemplate6CloseX from 'ui-component/ColorTemplate6CloseX';
import { isSelfIntroVideoPostingUrl } from 'api/selfIntroVideoFe';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';

function resolvePostingAlbumMediaSrc(mediaUrl) {
  const raw = String(mediaUrl ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('/api/video/') || raw.startsWith('/api/photo/')) return `${getApiBaseUrl()}${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('api/video/') || raw.startsWith('api/photo/')) return `${getApiBaseUrl()}/${raw}`;
  return raw;
}

const overlayTextSx = {
  color: '#ffffff',
  WebkitTextFillColor: '#ffffff',
  fontWeight: 700,
  textAlign: 'center',
  lineHeight: 1.2,
  fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
  WebkitTextStroke: '1px #000000',
  paintOrder: 'stroke fill',
  textShadow: '0 0 2px #000, 0 0 2px #000, 1px 1px 0 #000, -1px -1px 0 #000'
};

export default function PostingAlbumMediaFullscreen({ open, mediaUrl, overlayLines = [], onClose }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open || !mediaUrl) return null;

  const isVideo = isSelfIntroVideoPostingUrl(mediaUrl);
  const mediaSrc = resolvePostingAlbumMediaSrc(mediaUrl);
  const lines = (Array.isArray(overlayLines) ? overlayLines : []).map((line) => String(line ?? '').trim()).filter(Boolean);

  return createPortal(
    <Box
      role="dialog"
      aria-modal="true"
      aria-label={isVideo ? 'Fullscreen video' : 'Fullscreen photo'}
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        bgcolor: '#000000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
      onClick={() => onClose?.()}
    >
      <ColorTemplate6CloseX onClose={onClose} aria-label="Close photo or video" />
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: { xs: 0.5, sm: 1.5 },
          py: { xs: 3, sm: 2 }
        }}
        onClick={(event) => event.stopPropagation()}
      >
        {isVideo ? (
          <Box
            component="video"
            src={mediaSrc}
            controls
            autoPlay
            playsInline
            sx={{
              display: 'block',
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
              bgcolor: '#000000'
            }}
          />
        ) : (
          <Box
            component="img"
            src={mediaUrl}
            alt=""
            sx={{
              display: 'block',
              width: '100%',
              height: '100%',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain'
            }}
          />
        )}
        {lines.length > 0 ? (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 2,
              px: 1.5,
              py: 1.25,
              pointerEvents: 'none'
            }}
          >
            {lines.map((line) => (
              <Typography key={line} component="div" sx={overlayTextSx}>
                {line}
              </Typography>
            ))}
          </Box>
        ) : null}
      </Box>
    </Box>,
    document.body
  );
}

PostingAlbumMediaFullscreen.propTypes = {
  open: PropTypes.bool.isRequired,
  mediaUrl: PropTypes.string,
  overlayLines: PropTypes.arrayOf(PropTypes.string),
  onClose: PropTypes.func.isRequired
};
