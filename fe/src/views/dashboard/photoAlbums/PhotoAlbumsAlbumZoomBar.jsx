import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { IconMinus, IconPlus } from '@tabler/icons-react';

export const PHOTO_ALBUMS_ZOOM_MIN = 0;
export const PHOTO_ALBUMS_ZOOM_MAX = 100;
export const PHOTO_ALBUMS_ZOOM_STEP = 1;

/**
 * Horizontal top scrollbar-style control to zoom the entire album binder
 * page from 0%–100% (TutaPhotoAlbums only).
 */
export default function PhotoAlbumsAlbumZoomBar({ value = 100, onChange }) {
  const zoom = Number.isFinite(value)
    ? Math.min(PHOTO_ALBUMS_ZOOM_MAX, Math.max(PHOTO_ALBUMS_ZOOM_MIN, value))
    : 100;

  return (
    <Box
      className="rv-editor__album-zoom-bar"
      sx={{
        flex: '0 0 auto',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 1,
        px: 1.25,
        py: 0.5,
        bgcolor: '#eceff1',
        borderBottom: '1px solid #cfd8dc',
        zIndex: 8
      }}
    >
      <Typography
        component="span"
        sx={{ fontSize: '0.75rem', fontWeight: 800, userSelect: 'none', flexShrink: 0 }}
      >
        Zoom
      </Typography>
      <Typography
        component="span"
        sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#546e7a', userSelect: 'none', flexShrink: 0 }}
      >
        0%
      </Typography>
      <IconButton
        size="small"
        aria-label="Zoom album out"
        disabled={zoom <= PHOTO_ALBUMS_ZOOM_MIN}
        onClick={() => onChange?.(Math.max(PHOTO_ALBUMS_ZOOM_MIN, zoom - PHOTO_ALBUMS_ZOOM_STEP))}
        sx={{ p: 0.25 }}
      >
        <IconMinus size={16} />
      </IconButton>
      <Slider
        value={zoom}
        min={PHOTO_ALBUMS_ZOOM_MIN}
        max={PHOTO_ALBUMS_ZOOM_MAX}
        step={PHOTO_ALBUMS_ZOOM_STEP}
        onChange={(_e, next) => onChange?.(next)}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${v}%`}
        aria-label="Album zoom"
        sx={{
          flex: 1,
          mx: 0.5,
          color: '#2e7d32',
          '& .MuiSlider-thumb': { width: 16, height: 16 }
        }}
      />
      <IconButton
        size="small"
        aria-label="Zoom album in"
        disabled={zoom >= PHOTO_ALBUMS_ZOOM_MAX}
        onClick={() => onChange?.(Math.min(PHOTO_ALBUMS_ZOOM_MAX, zoom + PHOTO_ALBUMS_ZOOM_STEP))}
        sx={{ p: 0.25 }}
      >
        <IconPlus size={16} />
      </IconButton>
      <Typography
        component="span"
        sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#546e7a', userSelect: 'none', flexShrink: 0 }}
      >
        100%
      </Typography>
      <Typography
        component="span"
        sx={{
          fontSize: '0.75rem',
          fontWeight: 800,
          minWidth: 40,
          textAlign: 'right',
          userSelect: 'none',
          flexShrink: 0
        }}
      >
        {zoom}%
      </Typography>
    </Box>
  );
}

PhotoAlbumsAlbumZoomBar.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func
};
