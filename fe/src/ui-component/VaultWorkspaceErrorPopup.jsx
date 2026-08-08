import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';

/**
 * Immediate modal for vault workspace / panel errors (replaces silent top-bar / inline text).
 */
export default function VaultWorkspaceErrorPopup({
  error,
  onClose,
  title = 'Error',
  closeButtonAriaLabel = 'Close error dialog'
}) {
  const message = String(error || '').trim();
  const open = Boolean(message);

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel={closeButtonAriaLabel}
    >
      <ColorTemplate16PopupCenterWide.Body spacing={2}>
        <ColorTemplate16PopupCenterWide.Title>{title}</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.BodyText sx={{ whiteSpace: 'pre-wrap' }}>
          {message}
        </ColorTemplate16PopupCenterWide.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate16PopupCenterWide.ActionButton onClick={onClose}>OK</ColorTemplate16PopupCenterWide.ActionButton>
        </Stack>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

VaultWorkspaceErrorPopup.propTypes = {
  error: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string,
  closeButtonAriaLabel: PropTypes.string
};
