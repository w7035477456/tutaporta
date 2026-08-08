import PropTypes from 'prop-types';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import {
  colorTemplate13DisableGreenButtonSx,
  colorTemplate13PrimaryEnabledBgSx
} from 'config/colorTemplate13DisableGreenButton';

/**
 * Green when enabled, grey when disabled — UnSelectedButtonTemplate + greenGreyStates.
 * Clear actions: activeVariant="primary". hoverEnlargeFont opts into env hover label magnify.
 */
export default function ColorTemplate13DisableGreenButton({
  activeVariant = 'green',
  hoverEnlargeFont = false,
  sx,
  disabled = false,
  children,
  ...rest
}) {
  const hoverScale = hoverEnlargeFont ? undefined : 1;

  const mergedSx = (theme) => {
    const primaryOverride =
      activeVariant === 'primary' && !disabled ? colorTemplate13PrimaryEnabledBgSx() : null;
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    return { ...(primaryOverride || null), ...extra };
  };

  return (
    <UnSelectedButtonTemplate
      greenGreyStates
      disabled={disabled}
      hoverScale={hoverScale}
      fitLabelWidth
      sx={mergedSx}
      {...rest}
    >
      {children}
    </UnSelectedButtonTemplate>
  );
}

ColorTemplate13DisableGreenButton.propTypes = {
  activeVariant: PropTypes.oneOf(['green', 'primary']),
  hoverEnlargeFont: PropTypes.bool,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  disabled: PropTypes.bool,
  children: PropTypes.node
};

ColorTemplate13DisableGreenButton.sx = colorTemplate13DisableGreenButtonSx;
