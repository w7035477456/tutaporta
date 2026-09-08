import PropTypes from 'prop-types';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { greenButtonSx, GREEN_BUTTON_HOVER_SCALE } from 'config/greenButton';

/**
 * Green action button — UnSelectedButtonTemplate + BSIZE label, black border/text,
 * green when enabled / grey when disabled, single-line label width, 25% hover scale.
 *
 * hoverTopmost (default true): on hover, raise z-index so the scaled button stays above neighbors.
 */
export default function GreenButton({
  sx,
  singleLineLabel = true,
  hoverTopmost = true,
  /** Default `button` so form actions (Send SMS, etc.) do not submit the parent form. Pass `type="submit"` when needed. */
  type = 'button',
  children,
  ...rest
}) {
  const mergedSx = (theme) => {
    const base = greenButtonSx({ hoverTopmost });
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
      type={type}
      {...rest}
    >
      {children}
    </UnSelectedButtonTemplate>
  );
}

GreenButton.propTypes = {
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  singleLineLabel: PropTypes.bool,
  hoverTopmost: PropTypes.bool,
  type: PropTypes.string,
  children: PropTypes.node
};

GreenButton.sx = greenButtonSx;
