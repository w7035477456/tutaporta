import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import allowPopupImg from 'assets/images/allowpopup.png';

/** True when the message is the browser popup-blocker / allow-popups error. */
export function isPopupBlockedErrorMessage(message) {
  const text = String(message || '');
  return /popup blocked|allow popups|pop-?ups? blocked/i.test(text);
}

/**
 * Visual guide for “Popup blocked. Allow popups…” errors —
 * shows assets/images/allowpopup.png (Chrome address-bar allow steps).
 */
export default function PopupBlockedAllowHelp({ sx }) {
  return (
    <Box
      component="img"
      src={typeof allowPopupImg === 'string' ? allowPopupImg : allowPopupImg?.default || ''}
      alt="How to allow pop-ups: click the blocked-popups icon in the address bar, then Always allow pop-ups for this site"
      sx={{
        display: 'block',
        width: '100%',
        maxWidth: { xs: '100%', sm: 420 },
        height: 'auto',
        mx: 'auto',
        border: '2px solid #000',
        borderRadius: 1,
        boxSizing: 'border-box',
        bgcolor: '#fff',
        ...(sx || {})
      }}
    />
  );
}

PopupBlockedAllowHelp.propTypes = {
  sx: PropTypes.object
};
