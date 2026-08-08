import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ColorTemplate3Popup from 'ui-component/ColorTemplate3Popup';
import GreenButton from 'ui-component/GreenButton';
import Logo from 'ui-component/Logo';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';

const SESSION_END_NOTICE_TEXT_COLOR = '#d32f2f';

export default function SessionEndNoticeDialog({ open, message, onClose }) {
  return (
    <ColorTemplate3Popup open={open} onClose={onClose} showCloseButton={Boolean(onClose)}>
      <ColorTemplate3Popup.Body
        spacing={2}
        sx={{
          alignItems: 'center',
          textAlign: 'center',
          width: '100%'
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
          <Logo authBranding />
        </Box>
        <Typography
          variant="body1"
          sx={{
            color: `${SESSION_END_NOTICE_TEXT_COLOR} !important`,
            textAlign: 'center',
            width: '100%',
            fontWeight: 600,
            lineHeight: 1.45,
            fontSize: {
              xs: '1.8rem',
              sm: `calc(${getDesktopTextFontSizeVw()} * 2)`
            }
          }}
        >
          {message}
        </Typography>
        <Stack direction="row" justifyContent="center" sx={{ width: '100%', pt: 0.5 }}>
          <GreenButton type="button" onClick={onClose}>
            Close
          </GreenButton>
        </Stack>
      </ColorTemplate3Popup.Body>
    </ColorTemplate3Popup>
  );
}

SessionEndNoticeDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  message: PropTypes.string.isRequired,
  onClose: PropTypes.func.isRequired
};
