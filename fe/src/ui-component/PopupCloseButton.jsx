import PropTypes from 'prop-types';
import ColorTemplate5CloseX from 'ui-component/ColorTemplate5CloseX';

/** @deprecated Use `iconSx` only as extra `sx` merge for legacy callers. */
export default function PopupCloseButton({
  onClose,
  sx,
  iconSx,
  positionSx,
  'aria-label': ariaLabel = 'Close popup',
  ...props
}) {
  return (
    <ColorTemplate5CloseX
      aria-label={ariaLabel}
      onClose={onClose}
      positionSx={positionSx}
      sx={{ ...(iconSx || {}), ...(sx || {}) }}
      {...props}
    />
  );
}

PopupCloseButton.propTypes = {
  onClose: PropTypes.func.isRequired,
  sx: PropTypes.object,
  iconSx: PropTypes.object,
  positionSx: PropTypes.object,
  'aria-label': PropTypes.string
};
