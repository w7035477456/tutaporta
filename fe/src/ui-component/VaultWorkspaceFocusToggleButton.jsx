import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import zoomIconImg from 'assets/images/zoom.png';

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
      aria-label={
        active ? 'Unzoom — show menus, sidebars, and site footer' : 'Zoom — hide menus and sidebars'
      }
      title={
        active
          ? 'Restore full workspace (Esc)'
          : 'Show note only — hide sidebars and toolbars (Esc to restore)'
      }
      aria-pressed={active}
      sx={{
        flexShrink: 0,
        p: 0,
        m: 0,
        border: '2px solid #000',
        borderRadius: 0.5,
        bgcolor: active ? 'var(--theme-yellow-color, #ffd700)' : '#fff',
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 0,
        opacity: disabled ? 0.45 : 1,
        '&:hover': disabled ? undefined : { filter: 'brightness(1.06)' },
        '&:active': disabled ? undefined : { transform: 'scale(0.96)' }
      }}
    >
      <Box component="img" src={zoomIconImg} alt="" sx={{ width: 32, height: 32, display: 'block' }} />
    </Box>
  );
}

VaultWorkspaceFocusToggleButton.propTypes = {
  active: PropTypes.bool,
  onToggle: PropTypes.func,
  disabled: PropTypes.bool
};
