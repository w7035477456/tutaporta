import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { colorTemplate6CloseXSx, colorTemplate6CloseXPositionSx } from 'config/colorTemplate6CloseX';

/**
 * Top-right close “X” — red square, black X, black border (ColorTemplate6Popup).
 */
export default function ColorTemplate6CloseX({
  onClose,
  sx,
  positionSx,
  label = 'X',
  disabled = false,
  'aria-label': ariaLabel = 'Close popup',
  ...props
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={disabled ? undefined : onClose}
      sx={{
        ...colorTemplate6CloseXPositionSx(positionSx),
        ...colorTemplate6CloseXSx(),
        ...(disabled
          ? {
              opacity: 0.55,
              cursor: 'not-allowed',
              pointerEvents: 'none'
            }
          : null),
        ...(sx || {})
      }}
      {...props}
    >
      {label}
    </Box>
  );
}

ColorTemplate6CloseX.propTypes = {
  onClose: PropTypes.func.isRequired,
  sx: PropTypes.object,
  positionSx: PropTypes.object,
  label: PropTypes.string,
  disabled: PropTypes.bool,
  'aria-label': PropTypes.string
};
