import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import zoomIconImg from 'assets/images/zoom.png';
import { SLIDER_CONTROL_TRUE_YELLOW } from 'ui-component/SliderControlButton';
import { LIGHT_SURFACE_CLASS } from 'utils/themeContrast';

/**
 * Toggle workspace focus view — hide sidebars/toolbars and use the red letterbox shell.
 */
export default function VaultWorkspaceFocusToggleButton({ active = false, onToggle, disabled = false }) {
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      onClick={() => onToggle?.()}
      aria-label={active ? 'Unzoom — show menus, sidebars, and site footer' : 'Zoom — hide menus and sidebars'}
      title={active ? 'Restore full workspace (Esc)' : 'Show note only — hide sidebars and toolbars (Esc to restore)'}
      aria-pressed={active}
      className={LIGHT_SURFACE_CLASS}
      sx={{
        flexShrink: 0,
        p: 0,
        m: 0,
        border: '2px solid #000 !important',
        borderRadius: 0.5,
        bgcolor: `${SLIDER_CONTROL_TRUE_YELLOW} !important`,
        backgroundImage: 'none !important',
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 0,
        opacity: disabled ? 0.45 : 1,
        '&:hover': disabled ? undefined : { filter: 'brightness(1.06)' },
        '&:active': disabled ? undefined : { transform: 'scale(0.96)' }
      }}
    >
      <Box component="img" src={zoomIconImg} alt="" sx={{ width: 32, height: 32, display: 'block', filter: 'brightness(0)' }} />
    </Box>
  );
}

VaultWorkspaceFocusToggleButton.propTypes = {
  active: PropTypes.bool,
  onToggle: PropTypes.func,
  disabled: PropTypes.bool
};
