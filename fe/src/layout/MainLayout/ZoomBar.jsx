import PropTypes from 'prop-types';

// material-ui
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';

// assets
import { IconMinus, IconPlus } from '@tabler/icons-react';

const ZOOM_MIN = 50;
const ZOOM_MAX = 200;
const ZOOM_STEP = 5;

export default function ZoomBar({ value, onChange }) {
  const handleSliderChange = (_event, newValue) => {
    onChange(newValue);
  };

  const handleZoomOut = () => {
    onChange(Math.max(ZOOM_MIN, value - ZOOM_STEP));
  };

  const handleZoomIn = () => {
    onChange(Math.min(ZOOM_MAX, value + ZOOM_STEP));
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 1200,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1.5,
        py: 1,
        bgcolor: 'background.paper',
        borderRadius: 1,
        boxShadow: 2,
        border: '1px solid',
        borderColor: 'divider',
        minWidth: 200
      }}
    >
      <IconButton size="small" onClick={handleZoomOut} aria-label="Zoom out" disabled={value <= ZOOM_MIN}>
        <IconMinus size={18} />
      </IconButton>
      <Slider
        value={value}
        onChange={handleSliderChange}
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={ZOOM_STEP}
        size="small"
        sx={{
          color: 'primary.main',
          flex: 1,
          '& .MuiSlider-thumb': {
            width: 16,
            height: 16
          }
        }}
        valueLabelDisplay="auto"
        valueLabelFormat={(v) => `${v}%`}
        aria-label="Page zoom"
      />
      <IconButton size="small" onClick={handleZoomIn} aria-label="Zoom in" disabled={value >= ZOOM_MAX}>
        <IconPlus size={18} />
      </IconButton>
      <Typography variant="caption" sx={{ minWidth: 36, textAlign: 'right', fontWeight: 600 }}>
        {value}%
      </Typography>
    </Box>
  );
}

ZoomBar.propTypes = {
  value: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired
};
