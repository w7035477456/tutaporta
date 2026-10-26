import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { IconPlus, IconMinus, IconRotate, IconRotateClockwise } from '@tabler/icons-react';
import YellowButtonTemplate from 'ui-component/YellowButtonTemplate';
import { getDesktopButtonFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { buttonHoverMagnifyFontSx, buttonHoverMagnifyTransitionSx } from 'config/hoverMagnifyEnv';
import { ALBUM_PHOTO_ROTATION_MAX, ALBUM_PHOTO_ROTATION_MIN, ALBUM_PHOTO_ZOOM_MAX, ALBUM_PHOTO_ZOOM_MIN } from './photoAlbumsPages';

/** Yellow photo editor chrome (zoom bar, rotate bar, Original / Pan / Crop) — same look as MyStory. */
const editorButtonFontSize = {
  xs: getMobileSinglesButtonFontSizeVw(),
  sm: getDesktopButtonFontSizeVw()
};

/** Zoom slider: −50 … +200 (percent) → multiplier 0.5 … 3 */
const ZOOM_PCT_MIN = -50;
const ZOOM_PCT_MAX = 200;

export function photoEditZoomFromPercent(pct) {
  const raw = 1 + pct / 100;
  return Math.min(ALBUM_PHOTO_ZOOM_MAX, Math.max(ALBUM_PHOTO_ZOOM_MIN, raw));
}

export function photoEditPercentFromZoom(z) {
  if (typeof z !== 'number' || Number.isNaN(z)) return 0;
  const pct = Math.round((z - 1) * 100);
  return Math.min(ZOOM_PCT_MAX, Math.max(ZOOM_PCT_MIN, pct));
}

export const EDITOR_CHROME_BG = '#FBDF1B';
export const EDITOR_CHROME_FG = '#000000';
const EDITOR_CHROME_BORDER = `1px solid ${EDITOR_CHROME_FG}`;

const editorSliderSx = {
  flex: 1,
  mx: 0.5,
  color: EDITOR_CHROME_FG,
  '& .MuiSlider-thumb': {
    width: 14,
    height: 14,
    bgcolor: EDITOR_CHROME_BG,
    border: EDITOR_CHROME_BORDER,
    '&:hover, &.Mui-focusVisible': { boxShadow: '0 0 0 4px rgba(0,0,0,0.12)' }
  },
  '& .MuiSlider-track': { bgcolor: '#000000', border: 'none' },
  '& .MuiSlider-rail': { bgcolor: 'rgba(0,0,0,0.22)' }
};

const editorSliderRowSx = {
  width: '100%',
  maxWidth: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: 0.75,
  flexShrink: 0,
  bgcolor: EDITOR_CHROME_BG,
  borderRadius: 1,
  px: 1,
  py: 0.75,
  border: EDITOR_CHROME_BORDER,
  boxSizing: 'border-box'
};

const editorValueSx = {
  minWidth: 44,
  textAlign: 'right',
  fontWeight: 700,
  color: `${EDITOR_CHROME_FG} !important`,
  WebkitTextFillColor: `${EDITOR_CHROME_FG} !important`,
  flexShrink: 0,
  fontSize: '0.75rem !important',
  lineHeight: 1.2
};

const editorActionBtnSx = {
  fontWeight: 700,
  fontSize: editorButtonFontSize,
  minWidth: 64,
  py: 0.5,
  flexShrink: 0,
  transformOrigin: 'center center',
  zIndex: 1,
  ...buttonHoverMagnifyTransitionSx,
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': buttonHoverMagnifyFontSx({ baseFontSize: editorButtonFontSize })
  }
};

/** Pan ON: error surface + white label. */
const panModeOnBtnSx = {
  bgcolor: 'var(--theme-error-color) !important',
  color: 'var(--theme-white-color) !important',
  WebkitTextFillColor: 'var(--theme-white-color) !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: 'var(--theme-error-color) !important',
      color: 'var(--theme-white-color) !important',
      WebkitTextFillColor: 'var(--theme-white-color) !important',
      ...buttonHoverMagnifyFontSx({ baseFontSize: editorButtonFontSize })
    }
  }
};

function signed(n, suffix) {
  const v = Math.round(Number(n) || 0);
  return `${v > 0 ? '+' : ''}${v}${suffix}`;
}

export function PhotoEditZoomBar({ zoom, onZoomChange, disabled = false }) {
  return (
    <Box sx={editorSliderRowSx}>
      <IconMinus size={18} stroke={2.5} color={EDITOR_CHROME_FG} style={{ flexShrink: 0 }} aria-hidden />
      <Slider
        size="small"
        value={photoEditPercentFromZoom(zoom)}
        min={ZOOM_PCT_MIN}
        max={ZOOM_PCT_MAX}
        step={1}
        disabled={disabled}
        onChange={(_, v) => onZoomChange?.(photoEditZoomFromPercent(Array.isArray(v) ? v[0] : v))}
        aria-label="Zoom"
        valueLabelDisplay="off"
        sx={editorSliderSx}
      />
      <Typography variant="caption" component="span" sx={editorValueSx}>
        {signed(photoEditPercentFromZoom(zoom), '%')}
      </Typography>
      <IconPlus size={18} stroke={2.5} color={EDITOR_CHROME_FG} style={{ flexShrink: 0 }} aria-hidden />
    </Box>
  );
}

PhotoEditZoomBar.propTypes = {
  zoom: PropTypes.number.isRequired,
  onZoomChange: PropTypes.func,
  disabled: PropTypes.bool
};

export function PhotoEditRotateBar({ rotationDeg, onRotationChange, disabled = false }) {
  return (
    <Box sx={editorSliderRowSx}>
      <IconRotate size={18} stroke={2.5} color={EDITOR_CHROME_FG} style={{ flexShrink: 0 }} aria-hidden />
      <Slider
        size="small"
        value={rotationDeg}
        min={ALBUM_PHOTO_ROTATION_MIN}
        max={ALBUM_PHOTO_ROTATION_MAX}
        step={1}
        disabled={disabled}
        onChange={(_, v) => onRotationChange?.(Array.isArray(v) ? v[0] : v)}
        aria-label="Rotate"
        valueLabelDisplay="off"
        sx={editorSliderSx}
      />
      <Typography variant="caption" component="span" sx={editorValueSx}>
        {signed(rotationDeg, '°')}
      </Typography>
      <IconRotateClockwise size={18} stroke={2.5} color={EDITOR_CHROME_FG} style={{ flexShrink: 0 }} aria-hidden />
    </Box>
  );
}

PhotoEditRotateBar.propTypes = {
  rotationDeg: PropTypes.number.isRequired,
  onRotationChange: PropTypes.func,
  disabled: PropTypes.bool
};

export function PhotoEditActionButtons({ panEnabled, onOriginal, onTogglePan, onCrop, disabled = false }) {
  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 0.5,
        flexWrap: 'nowrap'
      }}
    >
      <YellowButtonTemplate
        type="button"
        size="small"
        onClick={() => onOriginal?.()}
        disabled={disabled}
        aria-label="Show the original photo (undo zoom, pan, rotate and crop)"
        sx={editorActionBtnSx}
      >
        Original
      </YellowButtonTemplate>
      <YellowButtonTemplate
        type="button"
        size="small"
        onClick={() => onTogglePan?.()}
        disabled={disabled}
        aria-pressed={panEnabled}
        sx={{ ...editorActionBtnSx, ...(panEnabled ? panModeOnBtnSx : null) }}
      >
        Pan
      </YellowButtonTemplate>
      <YellowButtonTemplate
        type="button"
        size="small"
        onClick={() => onCrop?.()}
        disabled={disabled}
        aria-label="Crop the photo on the album page to this view"
        sx={editorActionBtnSx}
      >
        Crop
      </YellowButtonTemplate>
    </Box>
  );
}

PhotoEditActionButtons.propTypes = {
  panEnabled: PropTypes.bool,
  onOriginal: PropTypes.func,
  onTogglePan: PropTypes.func,
  onCrop: PropTypes.func,
  disabled: PropTypes.bool
};

/** Four yellow arrows shown over the photo while Pan is on. */
export function PhotoEditPanArrows() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <Box component="svg" viewBox="0 0 100 100" sx={{ width: { xs: 100, sm: 120 }, height: 'auto', opacity: 0.92 }}>
        <g fill="#FFEB3B" stroke="#C9A000" strokeWidth={1.5}>
          <path d="M 50 6 L 64 30 L 36 30 Z" />
          <path d="M 50 94 L 36 70 L 64 70 Z" />
          <path d="M 6 50 L 30 36 L 30 64 Z" />
          <path d="M 94 50 L 70 36 L 70 64 Z" />
        </g>
      </Box>
    </Box>
  );
}
