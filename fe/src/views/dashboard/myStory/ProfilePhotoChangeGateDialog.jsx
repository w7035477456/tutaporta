import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import {
  PROFILE_PHOTO_CHANGE_CONFIRM_MESSAGE,
  PROFILE_PHOTO_CHANGE_WAIT_MESSAGE
} from 'utils/profilePhotoChangeGate';

export function ProfilePhotoChangeWaitDialog({ open, onClose, message }) {
  return (
    <ColorTemplate7PopupLargeDark open={open} onClose={onClose} closeOnBackdrop closeButtonAriaLabel="Close">
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>Profile photo change</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>{message ?? PROFILE_PHOTO_CHANGE_WAIT_MESSAGE}</ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton type="button" onClick={onClose}>
            OK
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

ProfilePhotoChangeWaitDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  message: PropTypes.string
};

export function ProfilePhotoChangeConfirmDialog({
  open,
  onClose,
  onConfirm,
  onSkip,
  showSkip = false,
  busy = false,
  message,
  title = 'Profile photo change',
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm Change',
  skipLabel = 'Skip'
}) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={!busy}
      showCloseButton={!busy}
      closeButtonAriaLabel="Close profile photo change confirmation"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>{title}</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>{message ?? PROFILE_PHOTO_CHANGE_CONFIRM_MESSAGE}</ColorTemplate7PopupLargeDark.BodyText>
        <Stack
          direction="row"
          spacing={1.5}
          justifyContent={showSkip ? 'space-between' : 'flex-end'}
          alignItems="center"
          flexWrap="wrap"
          sx={{ width: '100%' }}
        >
          {showSkip ? (
            <ColorTemplate7PopupLargeDark.ActionButton
              type="button"
              disabled={busy}
              onClick={onSkip}
              aria-label="Skip live facial verification"
            >
              {skipLabel}
            </ColorTemplate7PopupLargeDark.ActionButton>
          ) : null}
          <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ ml: showSkip ? 'auto' : 0 }}>
            <ColorTemplate7PopupLargeDark.ActionButton type="button" disabled={busy} onClick={onClose}>
              {cancelLabel}
            </ColorTemplate7PopupLargeDark.ActionButton>
            <ColorTemplate7PopupLargeDark.ActionButton type="button" disabled={busy} onClick={onConfirm}>
              {busy ? 'Saving…' : confirmLabel}
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Stack>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

ProfilePhotoChangeConfirmDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onSkip: PropTypes.func,
  showSkip: PropTypes.bool,
  busy: PropTypes.bool,
  message: PropTypes.string,
  title: PropTypes.string,
  cancelLabel: PropTypes.string,
  confirmLabel: PropTypes.string,
  skipLabel: PropTypes.string
};
