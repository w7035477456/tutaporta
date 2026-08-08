import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import ProfilePhotoUploadQrPanel from 'components/ProfilePhotoUploadQrPanel';
import { photoAlbumsPopupCloseSx } from './photoAlbumsPopupCloseSx';

const MOBILE_UPLOAD_DIALOG_MAX_WIDTH = 'min(96vw, 560px)';
const MOBILE_UPLOAD_QR_SIZE = 312;

/** Full-viewport centered QR popup (not pinned to top/bottom half). */
export default function PhotoAlbumsMobileUploadDialog({
  open,
  onClose,
  onPhoneUploadComplete,
  disabled
}) {
  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close mobile upload"
      maxWidth={MOBILE_UPLOAD_DIALOG_MAX_WIDTH}
      centerInWindow
      closeButtonSx={photoAlbumsPopupCloseSx}
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1}>
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            py: 1
          }}
        >
          <ProfilePhotoUploadQrPanel
            variant="inline"
            purpose="photo_albums"
            disabled={disabled}
            qrSize={MOBILE_UPLOAD_QR_SIZE}
            onPhoneUploadComplete={onPhoneUploadComplete}
            sx={{ maxWidth: MOBILE_UPLOAD_QR_SIZE + 48 }}
          />
        </Box>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

PhotoAlbumsMobileUploadDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onPhoneUploadComplete: PropTypes.func,
  disabled: PropTypes.bool
};
