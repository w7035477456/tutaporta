import PropTypes from 'prop-types';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { greenButtonSx, GREEN_BUTTON_HOVER_SCALE } from 'config/greenButton';

/**
 * Green action button — UnSelectedButtonTemplate + BSIZE label, black border/text,
 * green when enabled / grey when disabled, single-line label width, 25% hover scale.
 */
export default function GreenButton({ sx, singleLineLabel = true, children, ...rest }) {
  const mergedSx = (theme) => {
    const base = greenButtonSx();
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    return { ...base, ...extra };
  };

  return (
    <UnSelectedButtonTemplate
      greenGreyStates
      hoverScale={GREEN_BUTTON_HOVER_SCALE}
      fitLabelWidth={false}
      singleLineLabel={singleLineLabel}
      transformOrigin="center center"
      sx={mergedSx}
      {...rest}
    >
      {children}
    </UnSelectedButtonTemplate>
  );
}

GreenButton.propTypes = {
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  singleLineLabel: PropTypes.bool,
  children: PropTypes.node
};

GreenButton.sx = greenButtonSx;
