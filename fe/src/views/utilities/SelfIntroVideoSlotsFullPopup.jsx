import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { SELF_INTRO_VIDEO_SLOTS_FULL_MESSAGE } from 'utils/selfIntroVideoSlotHelpers';

/** Shown when all three self intro video slots are already filled. */
export default function SelfIntroVideoSlotsFullPopup({ open, onClose }) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close self intro video slots full message"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontWeight: 700 }}>
          {SELF_INTRO_VIDEO_SLOTS_FULL_MESSAGE}
        </ColorTemplate7PopupLargeDark.BodyText>
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 0.5 }}>
          <GreenButton type="button" onClick={onClose}>
            OK
          </GreenButton>
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

SelfIntroVideoSlotsFullPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
