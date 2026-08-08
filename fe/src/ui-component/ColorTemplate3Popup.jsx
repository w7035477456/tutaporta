import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import AuthCardWrapper from 'views/pages/authentication/AuthCardWrapper';
import useColorTemplate3PopupLayout from 'hooks/useColorTemplate3PopupLayout';
import {
  COLOR_TEMPLATE3_POPUP_DEFAULT_MAX_WIDTH,
  COLOR_TEMPLATE3_POPUP_PANEL_BG,
  colorTemplate3PopupBodySx
} from 'config/colorTemplate3Popup';
import ColorTemplate5CloseX from 'ui-component/ColorTemplate5CloseX';

/**
 * Reusable compact gallery-centered popup template (ColorTemplate3Popup).
 * Secondary-color background, theme text, shrink-wrap height, vertically centered in gallery.
 *
 * Usage:
 *   <ColorTemplate3Popup open onClose={handleClose}>
 *     <ColorTemplate3Popup.Body spacing={1.5}>...</ColorTemplate3Popup.Body>
 *   </ColorTemplate3Popup>
 */
function ColorTemplate3PopupBody({ children, spacing = 1, sx }) {
  return (
    <Stack spacing={spacing} sx={{ alignItems: 'flex-start', textAlign: 'left', ...colorTemplate3PopupBodySx(), ...(sx || {}) }}>
      {children}
    </Stack>
  );
}

function ColorTemplate3PopupCloseButton({ onClose, sx }) {
  return (
    <ColorTemplate5CloseX
      onClose={onClose}
      positionSx={{ top: 0, right: 0, zIndex: 1 }}
      sx={sx}
    />
  );
}

export default function ColorTemplate3Popup({
  open,
  onClose,
  children,
  maxWidth = COLOR_TEMPLATE3_POPUP_DEFAULT_MAX_WIDTH,
  closeOnBackdrop = false,
  showCloseButton = true,
  closeButtonSx,
  panelShellSx: panelShellSxOverride,
  overlaySx: overlaySxOverride,
  cardSx
}) {
  const { overlaySx, panelShellSx } = useColorTemplate3PopupLayout({ maxWidth });

  if (!open) return null;

  return (
    <Box
      sx={{ ...overlaySx, ...(overlaySxOverride || {}) }}
      onClick={closeOnBackdrop ? onClose : undefined}
      role="presentation"
    >
      <Box
        sx={{ ...panelShellSx, ...(panelShellSxOverride || {}) }}
        onClick={(event) => event.stopPropagation()}
      >
        <AuthCardWrapper
          tight
          fullWidth
          disableMobileFit
          sx={{
            width: '100%',
            maxWidth: '100%',
            my: 0,
            bgcolor: COLOR_TEMPLATE3_POPUP_PANEL_BG,
            ...(cardSx || {})
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '100%',
              ...(showCloseButton && onClose
                ? { pt: { xs: 2.5, sm: 3 }, pr: { xs: 4.5, sm: 5 } }
                : {})
            }}
          >
            {showCloseButton && onClose ? (
              <ColorTemplate3PopupCloseButton onClose={onClose} sx={closeButtonSx} />
            ) : null}
            {children}
          </Box>
        </AuthCardWrapper>
      </Box>
    </Box>
  );
}

ColorTemplate3Popup.Body = ColorTemplate3PopupBody;
ColorTemplate3Popup.CloseButton = ColorTemplate3PopupCloseButton;

ColorTemplate3Popup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node,
  maxWidth: PropTypes.string,
  closeOnBackdrop: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  closeButtonSx: PropTypes.object,
  panelShellSx: PropTypes.object,
  overlaySx: PropTypes.object,
  cardSx: PropTypes.object
};

ColorTemplate3PopupBody.propTypes = {
  children: PropTypes.node,
  spacing: PropTypes.number,
  sx: PropTypes.object
};

ColorTemplate3PopupCloseButton.propTypes = {
  onClose: PropTypes.func.isRequired,
  sx: PropTypes.object
};
