import PropTypes from 'prop-types';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import PageInstructionPopup from 'ui-component/PageInstructionPopup';
import PageInstructionAudioTutorial from 'ui-component/PageInstructionAudioTutorial';
import { ALL_SINGLES_INSTRUCTION_POPUP_TEXT } from 'constants/allSinglesInstructionText';
import {
  PROFILES_RECORDS_INSTRUCTION_CONTEXT_STEP,
  PROFILES_RECORDS_INSTRUCTION_CONTEXT_TITLE
} from 'constants/profilesRecordsInstructionText';
import {
  PAGE_INSTRUCTION_TOOLTIP_BG,
  PAGE_INSTRUCTION_TOOLTIP_TEXT
} from 'config/pageInstructionEnv';
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
      <ColorTemplate16PopupCenterWide.SectionLabel>{title}</ColorTemplate16PopupCenterWide.SectionLabel>
      <ColorTemplate16PopupCenterWide.BodyText>{children}</ColorTemplate16PopupCenterWide.BodyText>
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
      <ColorTemplate16PopupCenterWide.SectionTitle leadLine>
        Welcome to Profile &amp; Records
      </ColorTemplate16PopupCenterWide.SectionTitle>
      <ColorTemplate16PopupCenterWide.BodyText>
        This is your main dashboard for managing who you are on the site and how you interact with others.
      </ColorTemplate16PopupCenterWide.BodyText>
      <InstructionSection title="Profile:">
        This is where you maintain your identity. You can change your alias, email, password, and mailing address here. We only need your
        address for delivering flowers; other members <strong>NEVER</strong> see your real name or your street address (just your city!).
      </InstructionSection>
      <InstructionSection title="Buy Tokens:">
        Keep your token balance topped up! Tokens allow you to unlock member information. Viewing a Brief Bio costs 1 token, and viewing a
        Full Bio costs 2 tokens.
      </InstructionSection>
      <InstructionSection title="Balance History:">
        Your &ldquo;go-to&rdquo; spot to track every token you&apos;ve spent, refills you&apos;ve purchased, and credits you&apos;ve earned
        through referrals.
      </InstructionSection>
      <InstructionSection title="Posting on FB:">
        Want free tokens? Use this tab to easily generate a Facebook post featuring your unique sharing code. When friends sign up using your
        code, you get token credits you can use on any Tuta domain (Date, Notes, PhotoAlbum, ProfessionalNetworks, Buynbid, or Classified!).
      </InstructionSection>
      <InstructionSection title="Refer Email:">
        Prefer email? Generate a pre-written invitation to send to friends, including your unique sharing code. You get token credits (valid
        across all Tuta domains) for every successful sign-up using your code.
      </InstructionSection>
      <InstructionSection title="Consent:">
        Manage your sharing permissions. This tab shows you exactly which members you have approved and allows you to view past snapshots of
        your submitted self-reported biography.
      </InstructionSection>
    </>
  );
}

export function ProfilesRecordsInstructionPopup({ open, onClose }) {
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
          audioByVoice={PROFILES_RECORDS_INSTRUCTION_AUDIO_BY_VOICE}
          title={PROFILES_RECORDS_INSTRUCTION_CONTEXT_TITLE}
          contextStep={PROFILES_RECORDS_INSTRUCTION_CONTEXT_STEP}
        />
        <ProfilesRecordsInstructionBody />
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
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
