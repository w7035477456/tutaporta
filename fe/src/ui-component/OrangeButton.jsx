import PropTypes from 'prop-types';
import GreenButton from 'ui-component/GreenButton';
import { orangeButtonColorSx } from 'config/orangeButton';

/**
 * Orange action button — GreenButton with orange background override.
 */
export default function OrangeButton({ sx, children, ...rest }) {
  const mergedSx = (theme) => {
    const base = orangeButtonColorSx();
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    return { ...base, ...extra };
  };

  return (
    <GreenButton sx={mergedSx} {...rest}>
      {children}
    </GreenButton>
  );
}

OrangeButton.propTypes = {
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  children: PropTypes.node
};

OrangeButton.sx = orangeButtonColorSx;
