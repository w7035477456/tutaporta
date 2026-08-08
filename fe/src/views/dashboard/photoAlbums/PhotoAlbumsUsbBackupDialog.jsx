import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import GreenButton from 'ui-component/GreenButton';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import { themedConfirm } from 'utils/themedDialog';
import {
  downloadPhotoAlbumsUsbBackupZip,
  formatPhotoAlbumsUsb,
  restorePhotoAlbumsUsbBackupZip
} from 'api/photoAlbumsFe';
import PhotoAlbumsOneDriveVaultTreePanel from './PhotoAlbumsOneDriveVaultTreePanel';
import {
  tutaPhotoAlbumsFormatPostLoginButtonSx,
  tutaPhotoAlbumsOrangePostLoginButtonSx,
  tutaPhotoAlbumsPostLoginActionButtonSx
} from './tutaPhotoAlbumsPostLoginActionButtonSx';

const actionRowSx = {
  display: 'flex',
  justifyContent: 'center',
  flexWrap: 'wrap',
  gap: 1.5,
  pt: 0.5
};

const actionButtonSx = {
  minWidth: { xs: '100%', sm: 200 },
  px: 2,
  ...tutaPhotoAlbumsPostLoginActionButtonSx,
  width: { xs: '100%', sm: 'auto' }
};

const backupRestoreOrangeButtonSx = {
  ...actionButtonSx,
  ...tutaPhotoAlbumsOrangePostLoginButtonSx,
  width: { xs: '100%', sm: 'auto' },
  minWidth: { xs: '100%', sm: 200 }
};

const formatRedButtonSx = {
  ...actionButtonSx,
  ...tutaPhotoAlbumsFormatPostLoginButtonSx,
  width: { xs: '100%', sm: 'auto' },
  minWidth: { xs: '100%', sm: 200 }
};

const formatWarningBoxSx = {
  px: 1.5,
  py: 1.25,
  borderRadius: 1,
  border: '2px solid #000',
  bgcolor: '#000',
  color: '#fff',
  textAlign: 'center',
  fontWeight: 700,
  lineHeight: 1.45
};

const vaultTreeSectionSx = {
  pt: 1,
  borderTop: '2px solid rgba(255, 255, 255, 0.2)',
  display: 'flex',
  flexDirection: 'column',
  gap: 1.5
};

function formatBackupZipSizeLabel(sizeBytes) {
  const bytes = Number(sizeBytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)}mb`;
}

const backupSuccessMessageSx = {
  mb: 0,
  textAlign: 'center',
  color: 'var(--theme-yellow-color) !important',
  WebkitTextFillColor: 'var(--theme-yellow-color) !important',
  fontWeight: 700,
  lineHeight: 1.45,
  fontStyle: 'normal'
};

const generalSuccessMessageSx = {
  mb: 0,
  textAlign: 'center',
  color: '#b8f5c3',
  fontWeight: 700,
  lineHeight: 1.45
};

export default function PhotoAlbumsUsbBackupDialog({
  open,
  onClose,
  folderLabel = 'USB',
  onFormatted,
  onRestored,
  onOpenMyPhotoAlbums
}) {
  const fileInputRef = useRef(null);
  const needsRelockRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successTone, setSuccessTone] = useState('');
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);

  useEffect(() => {
    if (!open) return;
    needsRelockRef.current = false;
    setTreeRefreshToken((value) => value + 1);
  }, [open]);

  const resetMessages = () => {
    setError('');
    setSuccess('');
    setSuccessTone('');
  };

  const notifyParentRelockIfNeeded = async () => {
    if (!needsRelockRef.current) return;
    needsRelockRef.current = false;
    if (onRestored) await onRestored();
    else if (onFormatted) await onFormatted();
  };

  const handleClose = () => {
    if (busy) return;
    resetMessages();
    void (async () => {
      await notifyParentRelockIfNeeded();
      onClose?.();
    })();
  };

  const handleOpenMyPhotoAlbums = () => {
    if (busy) return;
    resetMessages();
    void (async () => {
      await notifyParentRelockIfNeeded();
      onOpenMyPhotoAlbums?.();
    })();
  };

  const refreshVaultTree = () => {
    setTreeRefreshToken((value) => value + 1);
  };

  const handleBackup = async () => {
    resetMessages();
    setBusy(true);
    try {
      const result = await downloadPhotoAlbumsUsbBackupZip();
      const fileName = result?.fileName || 'MyPhotoAlbums_USB.zip';
      const sizeLabel = formatBackupZipSizeLabel(result?.sizeBytes);
      const sizeText = sizeLabel ? ` (size ${sizeLabel})` : '';
      setSuccess(
        `Backup to zip completed. Your ${fileName}${sizeText} has been downloaded to browser download folder.`
      );
      setSuccessTone('backup');
      refreshVaultTree();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Backup failed');
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreClick = () => {
    if (busy) return;
    resetMessages();
    fileInputRef.current?.click();
  };

  const handleRestoreFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    resetMessages();
    setBusy(true);
    try {
      const result = await restorePhotoAlbumsUsbBackupZip(file);
      const count = Number(result?.restoredFiles) || 0;
      const label = String(result?.label || folderLabel || 'USB').trim() || 'USB';
      needsRelockRef.current = true;
      setSuccess(
        `Restored ${count} file${count === 1 ? '' : 's'} to USB (${label}). Open TutaPhotoAlbums again with your Encrypt Password to load the restored notes.`
      );
      setSuccessTone('general');
      refreshVaultTree();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFormat = async () => {
    if (busy) return;
    const label = String(folderLabel || 'USB').trim() || 'USB';
    const ok = await themedConfirm(
      `Format TutaPhotoAlbums USB on ${label}?\n\nThis deletes the existing USB TutaPhotoAlbums folder and leaves a blank vault area. Other files on the USB are not touched.\n\nBack up first if you want to keep your current notes.`
    );
    if (!ok) return;

    resetMessages();
    setBusy(true);
    try {
      const result = await formatPhotoAlbumsUsb();
      const resultLabel = String(result?.label || label).trim() || label;
      needsRelockRef.current = true;
      setSuccess(`Formatted TutaPhotoAlbums USB on ${resultLabel}. The folder is now blank and ready for a fresh vault.`);
      setSuccessTone('general');
      refreshVaultTree();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Format failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BusyHourglassOverlay open={open && busy} label="Working on USB backup" fontSize={BUSY_HOURGLASS_MODAL_SIZE} />
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(event) => void handleRestoreFile(event)}
      />
      <ColorTemplate16PopupCenterWide
        open={open}
        onClose={handleClose}
        closeOnBackdrop={!busy}
      >
        <ColorTemplate16PopupCenterWide.Title>
          Backup &amp; Restore TutaPhotoAlbums USB
        </ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
            You can backup entire TutaPhotoAlbums folder from USB to a zip file to save on your computer and restore from it back
            to USB (overwrite USB).
          </ColorTemplate16PopupCenterWide.SectionDescription>

          <Box sx={formatWarningBoxSx}>
            &apos;Backup USB&apos; will zip entire USB as as 1 zip archive. You will need to &apos;Restore to USB&apos; to
            view the files again
          </Box>

          {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}

          <Stack spacing={1.5}>
            <Box sx={actionRowSx}>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => void handleBackup()}
                sx={backupRestoreOrangeButtonSx}
              >
                Backup TutaPhotoAlbums USB
              </GreenButton>
              <GreenButton type="button" disabled={busy} onClick={() => void handleFormat()} sx={formatRedButtonSx}>
                Format TutaPhotoAlbums USB
              </GreenButton>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={handleRestoreClick}
                sx={backupRestoreOrangeButtonSx}
              >
                Restore TutaPhotoAlbums USB
              </GreenButton>
              <GreenButton type="button" disabled={busy} onClick={handleOpenMyPhotoAlbums} sx={actionButtonSx}>
                Open TutaPhotoAlbums USB
              </GreenButton>
            </Box>
          </Stack>

          {success ? (
            successTone === 'backup' ? (
              <Box sx={backupSuccessMessageSx}>{success}</Box>
            ) : (
              <ColorTemplate16PopupCenterWide.SectionDescription sx={generalSuccessMessageSx}>
                {success}
              </ColorTemplate16PopupCenterWide.SectionDescription>
            )
          ) : null}

          <Box sx={vaultTreeSectionSx}>
            <PhotoAlbumsOneDriveVaultTreePanel
              active={open}
              storageType="usb"
              refreshToken={treeRefreshToken}
              maxHeight="22vh"
            />
          </Box>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}
