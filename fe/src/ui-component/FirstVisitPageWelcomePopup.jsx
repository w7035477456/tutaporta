import PropTypes from 'prop-types';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { PAGE_INSTRUCTION_TOOLTIP_BG, PAGE_INSTRUCTION_TOOLTIP_TEXT } from 'config/pageInstructionEnv';
import { FIRST_VISIT_INTRO_BOLD_PREFIX, FIRST_VISIT_PAGE_WELCOME_COPY } from 'constants/firstVisitPageWelcomeText';

export default function FirstVisitPageWelcomePopup({ pageKey, open, onClose }) {
  const copy = FIRST_VISIT_PAGE_WELCOME_COPY[pageKey];
  if (!copy) return null;

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
        <ColorTemplate16PopupCenterWide.SectionTitle leadLine>
          {copy.title}
        </ColorTemplate16PopupCenterWide.SectionTitle>
        <ColorTemplate16PopupCenterWide.BodyText>
          <strong>{FIRST_VISIT_INTRO_BOLD_PREFIX}</strong>
          {copy.introBody}
        </ColorTemplate16PopupCenterWide.BodyText>
        {copy.bullets.map((bullet) => (
          <ColorTemplate16PopupCenterWide.BodyText key={bullet}>
            {bullet}
          </ColorTemplate16PopupCenterWide.BodyText>
        ))}
        {copy.closing ? (
          <ColorTemplate16PopupCenterWide.BodyText>{copy.closing}</ColorTemplate16PopupCenterWide.BodyText>
        ) : null}
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

FirstVisitPageWelcomePopup.propTypes = {
  pageKey: PropTypes.oneOf(['picksPosts', 'acquaintBuddies', 'recBioRequest']).isRequired,
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
