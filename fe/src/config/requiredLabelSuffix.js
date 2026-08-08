import { COLOR_TEMPLATE7_POPUP_INPUT_TEXT } from 'config/colorTemplate7PopupLargeDark';

/** Black text outline for "(Required)" / "(Optional)" suffix labels site-wide. */
export const REQUIRED_LABEL_TEXT_STROKE = '1px #000000';

export const requiredLabelSuffixSx = {
  color: `${COLOR_TEMPLATE7_POPUP_INPUT_TEXT} !important`,
  WebkitTextFillColor: `${COLOR_TEMPLATE7_POPUP_INPUT_TEXT} !important`,
  fontWeight: 700,
  WebkitTextStroke: REQUIRED_LABEL_TEXT_STROKE,
  paintOrder: 'stroke fill'
};
