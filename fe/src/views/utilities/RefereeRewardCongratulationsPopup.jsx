import PropTypes from 'prop-types';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';

const bodyTextSx = { textAlign: 'left', lineHeight: 1.45 };

export default function RefereeRewardCongratulationsPopup({ open, onClose }) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close congratulations popup"
    >
      <ColorTemplate7PopupLargeDark.Body>
        <ColorTemplate7PopupLargeDark.Title>Congratulations!</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText sx={bodyTextSx}>
          You&apos;ve earned 1 free token for signing up with a referral code.
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText sx={{ ...bodyTextSx, mt: 1.5 }}>
          You can use this token to unlock the Basic Bio of any profile. Want to earn more? Share your referral link
          with friends—as soon as they sign up, your new tokens will instantly appear right here in your Balance History
          tab!
        </ColorTemplate7PopupLargeDark.BodyText>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

RefereeRewardCongratulationsPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
