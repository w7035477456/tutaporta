import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import { colorTemplate13UsableGreenButtonSx } from 'config/colorTemplate13UsableGreenButton';

/** Green when enabled (default active). Grey when disabled. */
export default function ColorTemplate13UsableGreenButton({ sx, disabled = false, hoverEnlargeFont = false, children, ...rest }) {
  const mergedSx = (theme) => {
    const base = colorTemplate13UsableGreenButtonSx({ disabled, hoverEnlargeFont });
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    return { ...base, ...extra };
  };

  return (
    <Button disableElevation type="button" variant="contained" disabled={disabled} sx={mergedSx} {...rest}>
      {children}
    </Button>
  );
}

ColorTemplate13UsableGreenButton.propTypes = {
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  disabled: PropTypes.bool,
  hoverEnlargeFont: PropTypes.bool,
  children: PropTypes.node
};

ColorTemplate13UsableGreenButton.sx = colorTemplate13UsableGreenButtonSx;
