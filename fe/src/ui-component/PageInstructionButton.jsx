import PropTypes from 'prop-types';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import {
  ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS,
  orangeUnSelectedInstructionButtonSx
} from 'config/orangeInstructionButton';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';

const INSTRUCTION_LABEL = 'Instruction for this page';

/** Orange instruction button — matches VsinglesTourButton styling (fe/.env HOVER_MAGNIFY_FACTOR on hover). */
export default function PageInstructionButton({ onClick }) {
  return (
    <UnSelectedButtonTemplate
      type="button"
      fitLabelWidth
      {...ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS}
      {...guestDemoAllowProps()}
      onClick={onClick}
      aria-label={INSTRUCTION_LABEL}
      sx={{
        ...orangeUnSelectedInstructionButtonSx({ transformOrigin: 'center center' }),
        whiteSpace: 'nowrap'
      }}
    >
      {INSTRUCTION_LABEL}
    </UnSelectedButtonTemplate>
  );
}

PageInstructionButton.propTypes = {
  onClick: PropTypes.func
};
