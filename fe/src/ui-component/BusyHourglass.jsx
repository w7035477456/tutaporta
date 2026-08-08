import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { BUSY_HOURGLASS_IMAGE, BUSY_HOURGLASS_SIZE, busyHourglassSpinSx } from 'config/busyHourglassEnv';

/**
 * Site-wide busy / loading hourglass image — hourglass4.png, full color, 360° spin.
 * Prefer BusyHourglassOverlay for on-screen loading; this is the centered image asset.
 */
export default function BusyHourglass({ sx, fontSize = BUSY_HOURGLASS_SIZE, ...rest }) {
  const sizeSx = fontSize
    ? {
        width: fontSize,
        height: fontSize,
        minWidth: fontSize,
        minHeight: fontSize,
        maxWidth: 'none'
      }
    : null;

  return (
    <Box
      component="img"
      src={BUSY_HOURGLASS_IMAGE}
      alt=""
      aria-hidden
      draggable={false}
      sx={{
        ...busyHourglassSpinSx,
        ...sizeSx,
        ...(sx || {})
      }}
      {...rest}
    />
  );
}

/** @deprecated Use BusyHourglass — kept for existing imports. */
export const IdvBusyHourglass = BusyHourglass;

BusyHourglass.propTypes = {
  sx: PropTypes.object,
  fontSize: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object])
};

IdvBusyHourglass.propTypes = BusyHourglass.propTypes;
