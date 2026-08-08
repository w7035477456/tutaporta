import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AuthCardWrapper from 'views/pages/authentication/AuthCardWrapper';
import useColorTemplate2PopupLayout from 'hooks/useColorTemplate2PopupLayout';
import {
  COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_HEIGHT,
  COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_WIDTH,
  colorTemplate2PopupBodySx,
  colorTemplate2PopupLinkSx,
  colorTemplate2PopupTitleSx
} from 'config/colorTemplate2Popup';

/**
 * Reusable gallery-centered popup template (ColorTemplate2Popup).
 *
 * Usage:
 *   <ColorTemplate2Popup open onClose={handleClose}>
 *     <ColorTemplate2Popup.Title>My Popup Title</ColorTemplate2Popup.Title>
 *     <ColorTemplate2Popup.Body spacing={1}>
 *       <Typography variant="body1" paragraph>...</Typography>
 *     </ColorTemplate2Popup.Body>
 *   </ColorTemplate2Popup>
 */
function ColorTemplate2PopupTitle({ children, sx }) {
  return (
    <Typography variant="h4" sx={{ ...colorTemplate2PopupTitleSx(), ...(sx || {}) }}>
      {children}
    </Typography>
  );
}

function ColorTemplate2PopupBody({ children, spacing = 1, sx }) {
  return (
    <Stack spacing={spacing} sx={{ alignItems: 'flex-start', textAlign: 'left', ...colorTemplate2PopupBodySx(), ...(sx || {}) }}>
      {children}
    </Stack>
  );
}

function ColorTemplate2PopupLink(props) {
  return (
    <Typography
      component="a"
      {...props}
      sx={{ ...colorTemplate2PopupLinkSx(), ...(props.sx || {}) }}
    />
  );
}

export default function ColorTemplate2Popup({
  open,
  onClose,
  children,
  maxWidth = COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_WIDTH,
  maxHeight = COLOR_TEMPLATE2_POPUP_DEFAULT_MAX_HEIGHT,
  fitContent = false,
  closeOnBackdrop = false,
  panelShellSx: panelShellSxOverride,
  overlaySx: overlaySxOverride,
  cardSx,
  panelCaptureRef = null
}) {
  const { overlaySx, panelShellSx } = useColorTemplate2PopupLayout({ maxWidth, maxHeight, fitContent });

  if (!open) return null;

  return (
    <Box
      sx={{ ...overlaySx, ...(overlaySxOverride || {}) }}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <Box
        ref={panelCaptureRef}
        sx={{ ...panelShellSx, ...(panelShellSxOverride || {}) }}
        onClick={(event) => event.stopPropagation()}
      >
        <AuthCardWrapper
          tight
          fullWidth
          disableMobileFit
          sx={{ width: '100%', maxWidth: '100%', my: 0, ...(cardSx || {}) }}
        >
          {children}
        </AuthCardWrapper>
      </Box>
    </Box>
  );
}

ColorTemplate2Popup.Title = ColorTemplate2PopupTitle;
ColorTemplate2Popup.Body = ColorTemplate2PopupBody;
ColorTemplate2Popup.Link = ColorTemplate2PopupLink;

ColorTemplate2Popup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node,
  maxWidth: PropTypes.string,
  maxHeight: PropTypes.string,
  fitContent: PropTypes.bool,
  closeOnBackdrop: PropTypes.bool,
  panelShellSx: PropTypes.object,
  overlaySx: PropTypes.object,
  cardSx: PropTypes.object,
  panelCaptureRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })])
};

ColorTemplate2PopupTitle.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate2PopupBody.propTypes = {
  children: PropTypes.node,
  spacing: PropTypes.number,
  sx: PropTypes.object
};
