import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import useColorTemplate6PopupLayout from 'hooks/useColorTemplate6PopupLayout';
import ColorTemplate6CloseX from 'ui-component/ColorTemplate6CloseX';
import {
  COLOR_TEMPLATE6_POPUP_CONTENT_PADDING,
  colorTemplate6PopupActionButtonSx,
  colorTemplate6PopupBodySx,
  colorTemplate6PopupInputSx,
  colorTemplate6PopupPanelShellSx,
  colorTemplate6PopupTitleSx
} from 'config/colorTemplate6Popup';

/**
 * Viewport-centered popup: ColorTemplate1 selected panel, white copy, optional top X.
 * Use ColorTemplate6Popup.Input (white field, red text) and ColorTemplate6Popup.ActionButton (secondary bg, primary text/border).
 *
 * Usage:
 *   <ColorTemplate6Popup open onClose={handleClose} showFooterClose>
 *     <ColorTemplate6Popup.Title>...</ColorTemplate6Popup.Title>
 *     <ColorTemplate6Popup.Body>...</ColorTemplate6Popup.Body>
 *   </ColorTemplate6Popup>
 */
function ColorTemplate6PopupTitle({ children, sx }) {
  return (
    <Typography component="h2" sx={{ ...colorTemplate6PopupTitleSx(), ...(sx || {}) }}>
      {children}
    </Typography>
  );
}

function ColorTemplate6PopupBody({ children, spacing = 1.25, sx }) {
  return (
    <Stack spacing={spacing} sx={{ ...colorTemplate6PopupBodySx(), ...(sx || {}) }}>
      {children}
    </Stack>
  );
}

function ColorTemplate6PopupInput({ sx, ...props }) {
  return <TextField sx={{ ...colorTemplate6PopupInputSx(), ...(sx || {}) }} {...props} />;
}

function ColorTemplate6PopupActionButton({ children, sx, ...props }) {
  return (
    <Button
      type="button"
      className="color-template6-popup-action"
      sx={{ ...colorTemplate6PopupActionButtonSx(), ...(sx || {}) }}
      {...props}
    >
      {children}
    </Button>
  );
}

function ColorTemplate6PopupActions({ children, sx }) {
  return (
    <Stack
      direction="row"
      spacing={1.5}
      justifyContent="flex-end"
      flexWrap="wrap"
      sx={{ width: '100%', pt: 0.5, ...(sx || {}) }}
    >
      {children}
    </Stack>
  );
}

function ColorTemplate6PopupFooter({ children, sx }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        pt: { xs: 0.5, sm: 0.75 },
        ...(sx || {})
      }}
    >
      {children}
    </Box>
  );
}

export default function ColorTemplate6Popup({
  open,
  onClose,
  children,
  closeOnBackdrop = false,
  showCloseButton = true,
  closeButtonComponent,
  showFooterClose = false,
  footerCloseLabel = 'Close',
  closeButtonAriaLabel = 'Close popup',
  closeButtonSx,
  panelShellSx,
  overlaySx: overlaySxOverride,
  contentSx
}) {
  const CloseButton = closeButtonComponent ?? ColorTemplate6CloseX;
  const { overlaySx } = useColorTemplate6PopupLayout();

  if (!open || typeof document === 'undefined') return null;

  const handleFooterClose = () => {
    if (typeof onClose === 'function') onClose();
  };

  return createPortal(
    <Box
      sx={{ ...overlaySx, ...(overlaySxOverride || {}) }}
      onClick={closeOnBackdrop ? handleFooterClose : undefined}
      role="presentation"
    >
      <Box
        sx={{
          ...colorTemplate6PopupPanelShellSx(),
          ...(panelShellSx || {})
        }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {showCloseButton && onClose ? (
          <CloseButton
            aria-label={closeButtonAriaLabel}
            onClose={onClose}
            sx={closeButtonSx}
          />
        ) : null}
        <Box
          sx={{
            ...COLOR_TEMPLATE6_POPUP_CONTENT_PADDING,
            ...(showCloseButton && onClose ? { pr: { xs: 6, sm: 7 } } : null),
            '& .MuiTextField-root': colorTemplate6PopupInputSx(),
            '& .color-template6-popup-action': colorTemplate6PopupActionButtonSx(),
            ...(contentSx || {})
          }}
        >
          {children}
          {showFooterClose && onClose ? (
            <ColorTemplate6PopupFooter>
              <ColorTemplate6PopupActionButton type="button" onClick={handleFooterClose}>
                {footerCloseLabel}
              </ColorTemplate6PopupActionButton>
            </ColorTemplate6PopupFooter>
          ) : null}
        </Box>
      </Box>
    </Box>,
    document.body
  );
}

ColorTemplate6Popup.Title = ColorTemplate6PopupTitle;
ColorTemplate6Popup.Body = ColorTemplate6PopupBody;
ColorTemplate6Popup.Input = ColorTemplate6PopupInput;
ColorTemplate6Popup.ActionButton = ColorTemplate6PopupActionButton;
ColorTemplate6Popup.Actions = ColorTemplate6PopupActions;
ColorTemplate6Popup.Footer = ColorTemplate6PopupFooter;
ColorTemplate6Popup.CloseX = ColorTemplate6CloseX;
ColorTemplate6Popup.CloseX6 = ColorTemplate6CloseX;

ColorTemplate6Popup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func,
  children: PropTypes.node,
  closeOnBackdrop: PropTypes.bool,
  showCloseButton: PropTypes.bool,
  closeButtonComponent: PropTypes.elementType,
  showFooterClose: PropTypes.bool,
  footerCloseLabel: PropTypes.string,
  closeButtonAriaLabel: PropTypes.string,
  closeButtonSx: PropTypes.object,
  panelShellSx: PropTypes.object,
  overlaySx: PropTypes.object,
  contentSx: PropTypes.object
};

ColorTemplate6PopupTitle.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate6PopupBody.propTypes = {
  children: PropTypes.node,
  spacing: PropTypes.number,
  sx: PropTypes.object
};

ColorTemplate6PopupInput.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  sx: PropTypes.object
};

ColorTemplate6PopupActionButton.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate6PopupActions.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};

ColorTemplate6PopupFooter.propTypes = {
  children: PropTypes.node,
  sx: PropTypes.object
};
