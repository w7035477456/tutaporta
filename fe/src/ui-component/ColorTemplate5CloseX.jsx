import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { colorTemplate5CloseXSx, colorTemplate5CloseXPositionSx } from 'config/colorTemplate5CloseX';

/**
 * Reusable top-right close control — red square, black “X”, black border (ColorTemplate5).
 */
export default function ColorTemplate5CloseX({
  onClose,
  sx,
  positionSx,
  label = 'X',
  'aria-label': ariaLabel = 'Close popup',
  ...props
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={ariaLabel}
      onClick={onClose}
      sx={{
        ...colorTemplate5CloseXPositionSx(positionSx),
        ...colorTemplate5CloseXSx(),
        ...(sx || {})
      }}
      {...props}
    >
      {label}
    </Box>
  );
}

ColorTemplate5CloseX.propTypes = {
  onClose: PropTypes.func.isRequired,
  sx: PropTypes.object,
  positionSx: PropTypes.object,
  label: PropTypes.string,
  'aria-label': PropTypes.string
};
