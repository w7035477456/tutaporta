import PropTypes from 'prop-types';
import SliderControlButton, { SLIDER_CONTROL_BUTTON_HOVER_SCALE_15 } from 'ui-component/SliderControlButton';

/** Red hover like sidebar / profile-menu Exit to Mall. Replaces SliderControlButton's hover block, so it repeats the scale. */
const exitToMallRedHoverSx = {
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: 'var(--theme-error-color) !important',
      backgroundColor: 'var(--theme-error-color) !important',
      backgroundImage: 'none !important',
      color: 'var(--theme-white-color, #ffffff) !important',
      WebkitTextFillColor: 'var(--theme-white-color, #ffffff) !important',
      transform: `scale(${SLIDER_CONTROL_BUTTON_HOVER_SCALE_15})`,
      position: 'relative',
      zIndex: 1
    }
  }
};

/**
 * TutaNotes / TutaPhotoAlbums header Exit to Mall — same SliderControlButton chrome as File / Close Menu.
 */
export default function VaultExitToMallToolbarButton({
  onClick,
  disabled = false,
  compact = false,
  usePaneLogOff = false,
  logOffPaneLabel = 'Log off',
  sx,
  ...rest
}) {
  const exitLabel = usePaneLogOff ? logOffPaneLabel : 'Exit to Mall';

  return (
    <SliderControlButton
      type="button"
      variant="yellow"
      hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
      singleLineLabel
      disabled={disabled}
      onClick={onClick}
      aria-label={exitLabel}
      title={exitLabel}
      sx={[...(Array.isArray(sx) ? sx : sx ? [sx] : []), exitToMallRedHoverSx]}
      {...rest}
    >
      {compact ? (usePaneLogOff ? logOffPaneLabel.charAt(0) : 'Exit') : exitLabel}
    </SliderControlButton>
  );
}

VaultExitToMallToolbarButton.propTypes = {
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  compact: PropTypes.bool,
  usePaneLogOff: PropTypes.bool,
  logOffPaneLabel: PropTypes.string,
  sx: PropTypes.object
};
