import PropTypes from 'prop-types';
import Button from '@mui/material/Button';
import {
  buttonTemplateContrastFlipTextColor,
  buttonTemplateFitLabelOnResizeSx,
  buttonTemplateIconSizeResponsive,
  buttonTemplateIconSx,
  buttonTemplateSelectedLabelScaleSx,
  buttonTemplateSingleLineLabelSx,
  SELECTED_BUTTON_TEMPLATE_BG,
  SELECTED_BUTTON_TEMPLATE_BORDER,
  SELECTED_BUTTON_TEMPLATE_TEXT,
  SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  baseButtonSx,
  SELECTED_UNSELECTED_BUTTON_FONT_SIZE
} from 'config/selectedUnselectedButtonTemplate';
import useFitButtonLabelOnResize from 'hooks/useFitButtonLabelOnResize';
import ButtonTemplateIcon from 'ui-component/ButtonTemplateIcon';

/** Selected sidebar-style button — secondary bg, inverse-daynight text + border. Label: DESKTOP_FONT_SIZE_BUTTON (sm+). */
export function selectedButtonTemplateSx({
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  fitLabelWidth = false,
  sizeButtonToLabel = false,
  shrinkLabelToFit = false,
  shrinkLabelMaxFontSize,
  selectedLabelScale,
  thickBlackBorder = false
} = {}) {
  return {
    ...baseButtonSx(SELECTED_BUTTON_TEMPLATE_BG, SELECTED_BUTTON_TEMPLATE_TEXT, SELECTED_BUTTON_TEMPLATE_BORDER, hoverScale, {
      fitLabelWidth,
      sizeButtonToLabel,
      shrinkLabelToFit,
      shrinkLabelMaxFontSize,
      thickBlackBorder
    }),
    ...buttonTemplateSelectedLabelScaleSx(selectedLabelScale)
  };
}

export default function SelectedButtonTemplate({
  hoverScale = SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  fitLabelWidth = true,
  sizeButtonToLabel = false,
  shrinkLabelToFit = false,
  fitLabelOnResize = false,
  singleLineLabel = false,
  shrinkLabelMaxFontSize,
  selectedLabelScale,
  thickBlackBorder = false,
  fullWidth = false,
  sx,
  children,
  ...rest
}) {
  const fitLabelRef = useFitButtonLabelOnResize(fitLabelOnResize, children);
  const effectiveFullWidth = fullWidth && !singleLineLabel;

  const mergedSx = (theme) => {
    const base = selectedButtonTemplateSx({
      hoverScale,
      fitLabelWidth:
        fitLabelWidth && !effectiveFullWidth && !singleLineLabel && !shrinkLabelToFit && !sizeButtonToLabel && !fitLabelOnResize,
      sizeButtonToLabel: sizeButtonToLabel && !singleLineLabel,
      shrinkLabelToFit: shrinkLabelToFit && !fitLabelOnResize && !singleLineLabel,
      shrinkLabelMaxFontSize,
      selectedLabelScale,
      thickBlackBorder
    });
    const extra = typeof sx === 'function' ? sx(theme) : sx || {};
    return {
      ...base,
      ...(fitLabelOnResize ? buttonTemplateFitLabelOnResizeSx() : null),
      ...(singleLineLabel ? buttonTemplateSingleLineLabelSx() : null),
      ...extra
    };
  };

  return (
    <Button fullWidth={effectiveFullWidth} {...rest} ref={fitLabelRef} sx={mergedSx}>
      {children}
    </Button>
  );
}

SelectedButtonTemplate.propTypes = {
  hoverScale: PropTypes.number,
  fitLabelWidth: PropTypes.bool,
  sizeButtonToLabel: PropTypes.bool,
  shrinkLabelToFit: PropTypes.bool,
  fitLabelOnResize: PropTypes.bool,
  singleLineLabel: PropTypes.bool,
  shrinkLabelMaxFontSize: PropTypes.object,
  selectedLabelScale: PropTypes.number,
  thickBlackBorder: PropTypes.bool,
  fullWidth: PropTypes.bool,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.func]),
  children: PropTypes.node
};

SelectedButtonTemplate.sx = selectedButtonTemplateSx;
SelectedButtonTemplate.fontSize = SELECTED_UNSELECTED_BUTTON_FONT_SIZE;
SelectedButtonTemplate.contrastFlipTextColor = buttonTemplateContrastFlipTextColor;
SelectedButtonTemplate.Icon = ButtonTemplateIcon;
SelectedButtonTemplate.iconSize = buttonTemplateIconSizeResponsive;
SelectedButtonTemplate.iconSx = buttonTemplateIconSx;
