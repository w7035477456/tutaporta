import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { COLOR_TEMPLATE7_POPUP_Z_INDEX } from 'config/colorTemplate7PopupLargeDark';
import { STORAGE_PERMISSION_USER_MESSAGE } from 'utils/storagePermissionError';

export default function StoragePermissionFailDialog({ open, onClose, message = STORAGE_PERMISSION_USER_MESSAGE }) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      centerInWindow
      overlaySx={{ zIndex: COLOR_TEMPLATE7_POPUP_Z_INDEX + 20 }}
      closeButtonAriaLabel="Close folder permission error dialog"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.Title>Upload failed</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>{message}</ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton onClick={onClose}>OK</ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

StoragePermissionFailDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  message: PropTypes.string
};
