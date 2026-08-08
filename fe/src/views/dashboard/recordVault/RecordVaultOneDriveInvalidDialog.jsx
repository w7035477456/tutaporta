import { useRef } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import { recordVaultOneDriveBackupRestoreButtonSx } from './recordVaultOneDriveBackupRestoreButtonSx';

const actionRowSx = {
  display: 'flex',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: 1.5,
  pt: 0.5
};

const actionButtonSx = {
  minWidth: { xs: '100%', sm: 240 },
  px: 2
};

const formatButtonSx = {
  ...actionButtonSx,
  bgcolor: '#c62828 !important',
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  border: '3px solid #000000 !important',
  '&:hover:not(.Mui-disabled)': {
    bgcolor: '#b71c1c !important'
  }
};

const restoreButtonSx = {
  ...actionButtonSx,
  ...recordVaultOneDriveBackupRestoreButtonSx
};

export default function RecordVaultOneDriveInvalidDialog({
  open,
  busy = false,
  error = '',
  folderName = 'onlinemallwebsitevault',
  onFormat,
  onRestoreFile,
  onClose
}) {
  const fileInputRef = useRef(null);

  const visibleError = String(error || '').trim();

  const handleRestoreClick = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  const handleRestoreFile = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy) return;
    void onRestoreFile?.(file);
  };

  return (
    <>
      <BusyHourglassOverlay open={open && busy} label="Working on OneDrive vault" fontSize={BUSY_HOURGLASS_MODAL_SIZE} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={handleRestoreFile}
      />
      <ColorTemplate16PopupCenterWide
        open={open}
        onClose={busy ? undefined : onClose}
        closeOnBackdrop={false}
      >
        <ColorTemplate16PopupCenterWide.Title>One Drive vault</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
            One Drive file system is invalid. You need either format and start over from scratch or restore from a zip
            copy. Please select one:
          </ColorTemplate16PopupCenterWide.SectionDescription>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center', opacity: 0.85 }}>
            Required files live in your {folderName} folder on OneDrive (for example vault.meta.json, vault.db.enc, and
            photos).
          </ColorTemplate16PopupCenterWide.SectionDescription>

          {visibleError ? (
            <ColorTemplate16PopupCenterWide.ErrorBar>{visibleError}</ColorTemplate16PopupCenterWide.ErrorBar>
          ) : null}

          <Stack spacing={1.5}>
            <Box sx={actionRowSx}>
              <ColorTemplate16PopupCenterWide.ActionButton
                type="button"
                disabled={busy}
                onClick={() => void onFormat?.()}
                sx={formatButtonSx}
              >
                {busy ? 'Working…' : 'Format and start blank'}
              </ColorTemplate16PopupCenterWide.ActionButton>
              <ColorTemplate16PopupCenterWide.ActionButton
                type="button"
                disabled={busy}
                onClick={handleRestoreClick}
                sx={restoreButtonSx}
              >
                Restore from Backup
              </ColorTemplate16PopupCenterWide.ActionButton>
            </Box>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}
