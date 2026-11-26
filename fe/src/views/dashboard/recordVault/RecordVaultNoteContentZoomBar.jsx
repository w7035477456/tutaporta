import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';

export const NOTE_CONTENT_ZOOM_MIN = 50;
export const NOTE_CONTENT_ZOOM_MAX = 200;
export const NOTE_CONTENT_ZOOM_STEP = 5;
export const NOTE_CONTENT_ZOOM_DEFAULT = 100;
/** Per-image zoom (vault image header): can shrink further than note text. */
export const IMAGE_ZOOM_MIN = 25;
export const IMAGE_ZOOM_MAX = 200;
export const IMAGE_ZOOM_DEFAULT = 100;

/**
 * Compact yellow slider for the note title row — zooms text and images
 * inside the TipTap note body (TutaNotes).
 */
export default function RecordVaultNoteContentZoomBar({
  value = NOTE_CONTENT_ZOOM_DEFAULT,
  onChange,
  onChangeCommitted,
  min = NOTE_CONTENT_ZOOM_MIN,
  max = NOTE_CONTENT_ZOOM_MAX,
  ariaLabel = 'Note content zoom',
  sx
}) {
  const zoom = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : NOTE_CONTENT_ZOOM_DEFAULT;

  return (
    <Box
      className="rv-editor__note-content-zoom-bar"
      sx={{
        flex: '0 0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        minWidth: 140,
        maxWidth: 220,
        width: '28%',
        px: 1,
        py: 0.35,
        bgcolor: 'var(--theme-yellow-color, #ffd700)',
        border: '2px solid #000',
        borderRadius: 1,
        ...sx
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: '0.7rem',
          fontWeight: 800,
          color: '#000',
          userSelect: 'none',
          flexShrink: 0
        }}
      >
        Zoom
      </Typography>
      <Slider
        value={zoom}
        min={min}
        max={max}
        step={NOTE_CONTENT_ZOOM_STEP}
        onChange={(_e, next) => onChange?.(next)}
        onChangeCommitted={onChangeCommitted ? (_e, next) => onChangeCommitted(next) : undefined}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${v}%`}
        aria-label={ariaLabel}
        sx={{
          flex: 1,
          mx: 0.25,
          color: '#c62828',
          padding: '6px 0',
          '& .MuiSlider-rail': {
            opacity: 0.45,
            bgcolor: '#000'
          },
          '& .MuiSlider-track': {
            bgcolor: '#c62828',
            border: 'none'
          },
          '& .MuiSlider-thumb': {
            width: 14,
            height: 14,
            bgcolor: '#c62828',
            border: '2px solid #000',
            '&:hover, &.Mui-focusVisible': {
              boxShadow: '0 0 0 6px rgba(198, 40, 40, 0.25)'
            }
          }
        }}
      />
      <Typography
        component="span"
        sx={{
          fontSize: '0.7rem',
          fontWeight: 800,
          color: '#000',
          minWidth: 34,
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

RecordVaultNoteContentZoomBar.propTypes = {
  value: PropTypes.number,
  onChange: PropTypes.func,
  /** Fires once when the drag ends (use for saving). */
  onChangeCommitted: PropTypes.func,
  min: PropTypes.number,
  max: PropTypes.number,
  ariaLabel: PropTypes.string,
  sx: PropTypes.object
};
