import PropTypes from 'prop-types';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import {
  PAGE_INSTRUCTION_TOOLTIP_BG,
  PAGE_INSTRUCTION_TOOLTIP_TEXT
} from 'config/pageInstructionEnv';

/** Instruction tooltip popup — orange panel, black copy; same API as ColorTemplate7PopupLargeDark. */
function PageInstructionPopup({
  panelBg = PAGE_INSTRUCTION_TOOLTIP_BG,
  textColor = PAGE_INSTRUCTION_TOOLTIP_TEXT,
  ...rest
}) {
  return <ColorTemplate7PopupLargeDark panelBg={panelBg} textColor={textColor} {...rest} />;
}

PageInstructionPopup.Title = ColorTemplate7PopupLargeDark.Title;
PageInstructionPopup.BodyText = ColorTemplate7PopupLargeDark.BodyText;
PageInstructionPopup.Body = ColorTemplate7PopupLargeDark.Body;
PageInstructionPopup.Input = ColorTemplate7PopupLargeDark.Input;
PageInstructionPopup.ActionButton = ColorTemplate7PopupLargeDark.ActionButton;
PageInstructionPopup.Slider = ColorTemplate7PopupLargeDark.Slider;
PageInstructionPopup.Checkbox = ColorTemplate7PopupLargeDark.Checkbox;
PageInstructionPopup.Radio = ColorTemplate7PopupLargeDark.Radio;
PageInstructionPopup.SectionTitle = ColorTemplate7PopupLargeDark.SectionTitle;
PageInstructionPopup.SectionLabel = ColorTemplate7PopupLargeDark.SectionLabel;
PageInstructionPopup.SectionDescription = ColorTemplate7PopupLargeDark.SectionDescription;
PageInstructionPopup.Link = ColorTemplate7PopupLargeDark.Link;
PageInstructionPopup.LinkExample = ColorTemplate7PopupLargeDark.LinkExample;
PageInstructionPopup.ErrorBar = ColorTemplate7PopupLargeDark.ErrorBar;
PageInstructionPopup.FormRows = ColorTemplate7PopupLargeDark.FormRows;
PageInstructionPopup.FormRow = ColorTemplate7PopupLargeDark.FormRow;
PageInstructionPopup.FormRowLabel = ColorTemplate7PopupLargeDark.FormRowLabel;
PageInstructionPopup.FormRowControls = ColorTemplate7PopupLargeDark.FormRowControls;
PageInstructionPopup.Close = ColorTemplate7PopupLargeDark.Close;
PageInstructionPopup.ClearX = ColorTemplate7PopupLargeDark.ClearX;

PageInstructionPopup.propTypes = {
  panelBg: PropTypes.string,
  textColor: PropTypes.string,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node
};

export default PageInstructionPopup;
