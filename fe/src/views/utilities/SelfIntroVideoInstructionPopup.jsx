import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { SELF_INTRO_VIDEO_POPUP_TITLE } from 'constants/selfIntroVideoFavoriteFields';

const selfIntroPopupActionRowSx = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  pt: 0.5
};

/** Instructional popup before favorites form. */
export default function SelfIntroVideoInstructionPopup({ open, onClose, onReady }) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      bodyTextAlignLeft
      closeButtonAriaLabel="Close self intro video instructions"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>{SELF_INTRO_VIDEO_POPUP_TITLE}</ColorTemplate7PopupLargeDark.Title>

        <ColorTemplate7PopupLargeDark.BodyText>
          Want to stand out with a video intro? It&apos;s easy, fun, and takes just a few minutes:
        </ColorTemplate7PopupLargeDark.BodyText>

        <Box component="ol" sx={{ pl: 2.5, m: 0, '& li': { mb: 1 } }}>
          <li>
            <strong>Share your vibe:</strong> Tell us a few favorite things about yourself.
          </li>
          <li>
            <strong>Pick your script:</strong> We&apos;ll generate 20 fun, short intro paragraphs—just choose the one you like best.
          </li>
          <li>
            <strong>Hit record:</strong> Comb your hair, click record, and read along. Voila!
          </li>
        </Box>

        <ColorTemplate7PopupLargeDark.BodyText>
          Not crazy about your first take? Re-record as often as you like. We&apos;ll save your latest three versions so you can pick
          your primary video today and swap it out anytime.
        </ColorTemplate7PopupLargeDark.BodyText>

        <Box sx={selfIntroPopupActionRowSx}>
          <GreenButton type="button" onClick={onReady}>
            I am ready
          </GreenButton>
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

SelfIntroVideoInstructionPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onReady: PropTypes.func.isRequired
};
