import PropTypes from 'prop-types';

import Typography from '@mui/material/Typography';

import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import {
  ONENOTE_USB_UPGRADE_NOTIFICATION_BODY,
  ONENOTE_USB_UPGRADE_NOTIFICATION_ETA,
  ONENOTE_USB_UPGRADE_NOTIFICATION_TITLE
} from 'constants/onenoteUsbUpgradeNotificationText';

/**
 * Mall gate when ONENOTE_USB_UPGRADE=true — blocks Tuta Albums / Tuta Notes navigation.
 */
export default function TutaOnenoteUsbUpgradePopup({ open, onClose }) {
  return (
    <ColorTemplate16PopupCenterWide open={open} onClose={onClose} closeOnBackdrop>
      <ColorTemplate16PopupCenterWide.Title>{ONENOTE_USB_UPGRADE_NOTIFICATION_TITLE}</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={2} sx={{ textAlign: 'left' }}>
        <Typography component="p" sx={{ m: 0, fontSize: 'inherit', lineHeight: 1.55 }}>
          {ONENOTE_USB_UPGRADE_NOTIFICATION_BODY}
        </Typography>
        <Typography
          component="p"
          sx={{
            m: 0,
            mt: 1,
            fontSize: 'inherit',
            fontWeight: 700,
            letterSpacing: '0.02em',
            textAlign: 'center'
          }}
        >
          {ONENOTE_USB_UPGRADE_NOTIFICATION_ETA}
        </Typography>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

TutaOnenoteUsbUpgradePopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
