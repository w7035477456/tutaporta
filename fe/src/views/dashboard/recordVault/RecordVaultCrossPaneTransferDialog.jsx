import PropTypes from 'prop-types';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import GreenButton from 'ui-component/GreenButton';
import Box from '@mui/material/Box';
import {
  tutaNotesOrangePostLoginButtonSx,
  tutaNotesPostLoginActionButtonSx,
  tutaNotesYellowPostLoginButtonSx
} from './tutaNotesPostLoginActionButtonSx';

const actionRowSx = {
  display: 'flex',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: 1.5,
  pt: 0.5
};

const actionButtonSx = {
  minWidth: { xs: '100%', sm: 180 },
  px: 2,
  ...tutaNotesPostLoginActionButtonSx,
  width: { xs: '100%', sm: 'auto' }
};

function storageLabel(storageType) {
  return storageType === 'onedrive' ? 'TutaNotes Cloud' : 'TutaNotes USB';
}

export default function RecordVaultCrossPaneTransferDialog({
  open,
  item = null,
  targetStorageType = 'usb',
  targetNotebookName = '',
  busy = false,
  duplicateError = '',
  onCopy,
  onMove,
  onClose,
  onDismissDuplicate
}) {
  if (duplicateError) {
    return (
      <ColorTemplate16PopupCenterWide
        open={open}
        onClose={onDismissDuplicate || onClose}
        closeOnBackdrop={!busy}
      >
        <ColorTemplate16PopupCenterWide.Title>Duplicate name</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.ErrorBar>{duplicateError}</ColorTemplate16PopupCenterWide.ErrorBar>
          <Box sx={actionRowSx}>
            <GreenButton type="button" disabled={busy} onClick={() => onDismissDuplicate?.()} sx={actionButtonSx}>
              OK
            </GreenButton>
          </Box>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    );
  }

  if (!item) return null;

  const kindLabel = item.kind === 'notebook' ? 'notebook' : 'note';
  const name = String(item.name || '').trim() || (item.kind === 'notebook' ? 'Notebook' : 'Note');
  const fromLabel = storageLabel(item.storageType);
  const toLabel = storageLabel(targetStorageType);
  const noteDestHint =
    item.kind === 'note' && targetNotebookName
      ? ` into notebook “${targetNotebookName}”`
      : item.kind === 'note'
        ? ' into the selected notebook'
        : '';

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={busy ? undefined : onClose}
      closeOnBackdrop={!busy}
    >
      <ColorTemplate16PopupCenterWide.Title>
        Transfer {kindLabel} to {toLabel}
      </ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={2}>
        <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
          Transfer “{name}” from {fromLabel} to {toLabel}
          {noteDestHint}. Do you want move (delete source copy) or copy (keep source copy)?
        </ColorTemplate16PopupCenterWide.SectionDescription>
        <Box sx={actionRowSx}>
          <GreenButton
            type="button"
            disabled={busy}
            onClick={() => onCopy?.()}
            sx={{ ...actionButtonSx, ...tutaNotesYellowPostLoginButtonSx, width: { xs: '100%', sm: 'auto' } }}
          >
            Copy
          </GreenButton>
          <GreenButton
            type="button"
            disabled={busy}
            onClick={() => onMove?.()}
            sx={{ ...actionButtonSx, ...tutaNotesOrangePostLoginButtonSx, width: { xs: '100%', sm: 'auto' } }}
          >
            Move
          </GreenButton>
          <GreenButton type="button" disabled={busy} onClick={() => onClose?.()} sx={actionButtonSx}>
            Cancel
          </GreenButton>
        </Box>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

RecordVaultCrossPaneTransferDialog.propTypes = {
  open: PropTypes.bool,
  item: PropTypes.shape({
    kind: PropTypes.oneOf(['notebook', 'note']),
    id: PropTypes.number,
    storageType: PropTypes.oneOf(['onedrive', 'usb']),
    name: PropTypes.string,
    notebookId: PropTypes.number
  }),
  targetStorageType: PropTypes.oneOf(['onedrive', 'usb']),
  targetNotebookName: PropTypes.string,
  busy: PropTypes.bool,
  duplicateError: PropTypes.string,
  onCopy: PropTypes.func,
  onMove: PropTypes.func,
  onClose: PropTypes.func,
  onDismissDuplicate: PropTypes.func
};
