import PropTypes from 'prop-types';
import PageInstructionPopup from 'ui-component/PageInstructionPopup';
import PageInstructionAudioTutorial from 'ui-component/PageInstructionAudioTutorial';
import { ALL_SINGLES_INSTRUCTION_POPUP_TEXT } from 'constants/allSinglesInstructionText';
import {
  PROFILES_RECORDS_INSTRUCTION_CONTEXT_STEP,
  PROFILES_RECORDS_INSTRUCTION_CONTEXT_TITLE
} from 'constants/profilesRecordsInstructionText';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw } from 'config/singlesMemberCardFontEnv';
import audioProfilesRecordsSora from 'assets/sound/profiles_records_instruction_Sora.m4a';
import audioProfilesRecordsJessica from 'assets/sound/profiles_records_instruction_Jessica.m4a';
import audioProfilesRecordsMichael from 'assets/sound/profiles_records_instruction_Michael.m4a';

const PROFILES_RECORDS_INSTRUCTION_AUDIO_BY_VOICE = {
  Sora:
    typeof audioProfilesRecordsSora === 'string'
      ? audioProfilesRecordsSora
      : audioProfilesRecordsSora?.default || '',
  Jessica:
    typeof audioProfilesRecordsJessica === 'string'
      ? audioProfilesRecordsJessica
      : audioProfilesRecordsJessica?.default || '',
  Michael:
    typeof audioProfilesRecordsMichael === 'string'
      ? audioProfilesRecordsMichael
      : audioProfilesRecordsMichael?.default || ''
};

function InstructionSection({ title, children }) {
  return (
    <>
      <PageInstructionPopup.SectionLabel>{title}</PageInstructionPopup.SectionLabel>
      <PageInstructionPopup.BodyText>{children}</PageInstructionPopup.BodyText>
    </>
  );
}

InstructionSection.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired
};

export function ProfilesRecordsInstructionBody() {
  return (
    <>
      <PageInstructionPopup.SectionTitle leadLine>Welcome to Your Dashboard! ✨</PageInstructionPopup.SectionTitle>
      <InstructionSection title="Profile Tab:">
        You can update your alias, email and password, profile, and mailing address. Your safety matters: if a member ID has not been
        claimed, we recommend only providing first name / alias and general location, not full name / mailing address. However, once a Member
        ID is claimed, you can complete full name and address for account recovery. We highly recommend using a nickname for anonymity.
      </InstructionSection>
      <InstructionSection title="Buy Tokens Tab:">
        This is where you can reload your token balance anytime. To view another member&apos;s Brief Bio, it costs 1 token. For the Full Bio,
        it costs 2 tokens. For a 30-day &ldquo;All Access Pass,&rdquo; it costs 2 extra tokens (4 total instead of 2). We recommend using
        the Full Bio option—it provides a complete picture.
      </InstructionSection>
      <InstructionSection title="Balance History Tab:">
        This is your go-to spot to review all your past token transactions, balance refills, and referral credits.
      </InstructionSection>
      <InstructionSection title="Consent Tab:">
        This is your personal archive where you can view a history of the members you have approved, as well as take a look at the
        self-reported bio snapshots you&apos;ve submitted in the past.
      </InstructionSection>
    </>
  );
}

export function ProfilesRecordsInstructionPopup({ open, onClose }) {
  return (
    <PageInstructionPopup open={open} onClose={onClose} closeOnBackdrop bodyTextAlignLeft centeredLeadLines={2}>
      <PageInstructionPopup.Body>
        <PageInstructionPopup.Title>{PROFILES_RECORDS_INSTRUCTION_CONTEXT_TITLE}</PageInstructionPopup.Title>
        <PageInstructionAudioTutorial
          active={open}
          audioByVoice={PROFILES_RECORDS_INSTRUCTION_AUDIO_BY_VOICE}
          contextStep={PROFILES_RECORDS_INSTRUCTION_CONTEXT_STEP}
        />
        <ProfilesRecordsInstructionBody />
      </PageInstructionPopup.Body>
    </PageInstructionPopup>
  );
}

ProfilesRecordsInstructionPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export function AllSinglesInstructionPopup({ open, onClose }) {
  return (
    <PageInstructionPopup open={open} onClose={onClose} closeOnBackdrop bodyTextAlignLeft centeredLeadLines={1}>
      <PageInstructionPopup.Body>
        <PageInstructionPopup.Title>Instruction for this page</PageInstructionPopup.Title>
        <PageInstructionPopup.BodyText sx={{ whiteSpace: 'pre-line' }}>
          {ALL_SINGLES_INSTRUCTION_POPUP_TEXT}
        </PageInstructionPopup.BodyText>
      </PageInstructionPopup.Body>
    </PageInstructionPopup>
  );
}

AllSinglesInstructionPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};

export const profilesRecordsInstructionTriggerButtonSx = {
  textTransform: 'none',
  fontWeight: 700,
  fontSize: {
    xs: `calc(${getMobileSinglesButtonFontSizeVw()} * 0.5)`,
    sm: `calc(${getDesktopTextFontSizeVw()} * 0.5)`
  },
  px: 0.75,
  py: 0.175,
  whiteSpace: 'nowrap'
};
