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
        ...colorTemplate6CloseXPositionSx(positionSx),
        ...colorTemplate6CloseXSx(),
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
  'aria-label': PropTypes.string
};
