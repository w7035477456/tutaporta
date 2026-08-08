import PropTypes from 'prop-types';
import Link from '@mui/material/Link';
import { colorTemplate12UnderlineSx } from 'config/colorTemplate12Underline';

/**
 * Underlined text control — inverse-daynight color; hover magnify from HOVER_MAGNIFY_FACTOR.
 * Default: button-styled link (page instruction trigger).
 */
export default function ColorTemplate12Underline({ children, onClick, sx, ...props }) {
  return (
    <Link
      component="button"
      type="button"
      onClick={onClick}
      underline="always"
      sx={{ ...colorTemplate12UnderlineSx(), ...(sx || {}) }}
      {...props}
    >
      {children}
    </Link>
  );
}

ColorTemplate12Underline.propTypes = {
  children: PropTypes.node,
  onClick: PropTypes.func,
  sx: PropTypes.object
};
