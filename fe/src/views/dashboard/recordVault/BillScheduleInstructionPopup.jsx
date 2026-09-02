import PropTypes from 'prop-types';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import PageInstructionAudioTutorial from 'ui-component/PageInstructionAudioTutorial';
import {
  PAGE_INSTRUCTION_TOOLTIP_BG,
  PAGE_INSTRUCTION_TOOLTIP_TEXT
} from 'config/pageInstructionEnv';
import {
  BILL_SCHEDULE_INSTRUCTION_CONTEXT_STEP,
  BILL_SCHEDULE_INSTRUCTION_CONTEXT_TITLE
} from 'constants/billScheduleInstructionText';

const BILL_SCHEDULE_INSTRUCTION_AUDIO_BY_VOICE = {
  Sora: '',
  Jessica: '',
  Michael: ''
};

function InstructionSection({ title, children }) {
  return (
    <>
      <ColorTemplate16PopupCenterWide.SectionLabel>{title}</ColorTemplate16PopupCenterWide.SectionLabel>
      <ColorTemplate16PopupCenterWide.BodyText>{children}</ColorTemplate16PopupCenterWide.BodyText>
    </>
  );
}

InstructionSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
};

export function BillScheduleInstructionBody() {
  return (
    <>
      <ColorTemplate16PopupCenterWide.SectionTitle leadLine>
        Bill Schedule
      </ColorTemplate16PopupCenterWide.SectionTitle>
      <InstructionSection title="Monthly:">
        The <strong>Monthly</strong> tab lists bills whose <strong>Due Date</strong> falls in the calendar month
        you are viewing. Use the large calendar to see when each bill is due. Navigate months with the arrows.
      </InstructionSection>
      <InstructionSection title="Yearly:">
        The <strong>Yearly</strong> tab lists bills due at any time during the year you are viewing. Set{' '}
        <strong>Due Date</strong> as month + day. Twelve mini-calendars highlight due dates across the year.
      </InstructionSection>
      <InstructionSection title="Color legend:">
        <strong>Today Date</strong> — red outline.
        <br />
        <strong>Manual Pay Note Due yet</strong> — black circle (manual, not paid, not overdue).
        <br />
        <strong>Auto pay</strong> — yellow (<strong>Type</strong> = Auto).
        <br />
        <strong>Manual Paid</strong> — green (<strong>Action</strong> = Paid).
        <br />
        <strong>Manual Not Paid Overdue/Late</strong> — red (past due, not paid).
      </InstructionSection>
      <InstructionSection title="Rows &amp; receipts:">
        Click the <strong>Bill</strong> column to open <strong>Bills / Receipts</strong> (upload or scan from
        phone). Use <strong>Add</strong> for a new row, the red <strong>×</strong> after Description to remove a
        row, and <strong>SAVE</strong> to store your changes.
      </InstructionSection>
    </>
  );
}

export default function BillScheduleInstructionPopup({ open, onClose }) {
  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={onClose}
      closeOnBackdrop
      bodyTextAlignLeft
      centeredLeadLines={2}
      panelBg={PAGE_INSTRUCTION_TOOLTIP_BG}
      textColor={PAGE_INSTRUCTION_TOOLTIP_TEXT}
    >
      <ColorTemplate16PopupCenterWide.Body>
        <PageInstructionAudioTutorial
          active={open}
          audioByVoice={BILL_SCHEDULE_INSTRUCTION_AUDIO_BY_VOICE}
          title={BILL_SCHEDULE_INSTRUCTION_CONTEXT_TITLE}
          contextStep={BILL_SCHEDULE_INSTRUCTION_CONTEXT_STEP}
        />
        <BillScheduleInstructionBody />
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

BillScheduleInstructionPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
