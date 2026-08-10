import PropTypes from 'prop-types';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import PageInstructionAudioTutorial from 'ui-component/PageInstructionAudioTutorial';
import {
  PAGE_INSTRUCTION_TOOLTIP_BG,
  PAGE_INSTRUCTION_TOOLTIP_TEXT
} from 'config/pageInstructionEnv';
import {
  TUTANOTES_WELCOME_TUTORIAL_CONTEXT_STEP,
  TUTANOTES_WELCOME_TUTORIAL_CONTEXT_TITLE,
  TUTANOTES_WELCOME_TUTORIAL_INTRO,
  TUTANOTES_WELCOME_TUTORIAL_ITEMS
} from 'constants/tutaNotesWelcomeTutorialText';
import audioTutaNotesWelcomeSora from 'assets/sound/tuta_notes_welcome_tutorial_Sora.m4a';
import audioTutaNotesWelcomeJessica from 'assets/sound/tuta_notes_welcome_tutorial_Jessica.m4a';
import audioTutaNotesWelcomeMichael from 'assets/sound/tuta_notes_welcome_tutorial_Michael.m4a';

const TUTANOTES_WELCOME_TUTORIAL_AUDIO_BY_VOICE = {
  Sora:
    typeof audioTutaNotesWelcomeSora === 'string'
      ? audioTutaNotesWelcomeSora
      : audioTutaNotesWelcomeSora?.default || '',
  Jessica:
    typeof audioTutaNotesWelcomeJessica === 'string'
      ? audioTutaNotesWelcomeJessica
      : audioTutaNotesWelcomeJessica?.default || '',
  Michael:
    typeof audioTutaNotesWelcomeMichael === 'string'
      ? audioTutaNotesWelcomeMichael
      : audioTutaNotesWelcomeMichael?.default || ''
};

export function TutaNotesWelcomeTutorialBody() {
  return (
    <>
      <ColorTemplate16PopupCenterWide.SectionTitle leadLine>
        Welcome!
      </ColorTemplate16PopupCenterWide.SectionTitle>
      <ColorTemplate16PopupCenterWide.BodyText>{TUTANOTES_WELCOME_TUTORIAL_INTRO}</ColorTemplate16PopupCenterWide.BodyText>
      {TUTANOTES_WELCOME_TUTORIAL_ITEMS.map((item) => (
        <ColorTemplate16PopupCenterWide.BodyText key={item.label}>
          <strong>{item.label}</strong> {item.body}
        </ColorTemplate16PopupCenterWide.BodyText>
      ))}
    </>
  );
}

export default function TutaNotesWelcomeTutorialPopup({ open, onClose }) {
  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={onClose}
      closeOnBackdrop
      bodyTextAlignLeft
      centeredLeadLines={1}
      panelBg={PAGE_INSTRUCTION_TOOLTIP_BG}
      textColor={PAGE_INSTRUCTION_TOOLTIP_TEXT}
    >
      <ColorTemplate16PopupCenterWide.Body>
        <PageInstructionAudioTutorial
          active={open}
          audioByVoice={TUTANOTES_WELCOME_TUTORIAL_AUDIO_BY_VOICE}
          title={TUTANOTES_WELCOME_TUTORIAL_CONTEXT_TITLE}
          contextStep={TUTANOTES_WELCOME_TUTORIAL_CONTEXT_STEP}
        />
        <TutaNotesWelcomeTutorialBody />
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

TutaNotesWelcomeTutorialPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
