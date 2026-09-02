import { useState } from 'react';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import {
  ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS,
  orangeUnSelectedInstructionButtonSx
} from 'config/orangeInstructionButton';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { BILL_SCHEDULE_INSTRUCTION_BUTTON_LABEL } from 'constants/billScheduleInstructionText';
import BillScheduleInstructionPopup from './BillScheduleInstructionPopup';

/** Orange “Click Here for Tutorial” on Bill Schedule Monthly / Yearly panels. */
export default function BillScheduleTutorialTrigger() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <UnSelectedButtonTemplate
        type="button"
        fitLabelWidth
        {...ORANGE_INSTRUCTION_BUTTON_TEMPLATE_PROPS}
        {...guestDemoAllowProps()}
        onClick={() => setOpen(true)}
        aria-label={BILL_SCHEDULE_INSTRUCTION_BUTTON_LABEL}
        sx={{
          ...orangeUnSelectedInstructionButtonSx({ transformOrigin: 'center center' }),
          whiteSpace: 'nowrap'
        }}
      >
        {BILL_SCHEDULE_INSTRUCTION_BUTTON_LABEL}
      </UnSelectedButtonTemplate>
      <BillScheduleInstructionPopup open={open} onClose={() => setOpen(false)} />
    </>
  );
}
