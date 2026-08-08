import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import GreenButton from 'ui-component/GreenButton';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import { themedConfirm } from 'utils/themedDialog';
import {
  downloadPhotoAlbumsOneDriveBackupZip,
  formatPhotoAlbumsOneDrive,
  restorePhotoAlbumsOneDriveBackupZip
} from 'api/photoAlbumsFe';
import PhotoAlbumsOneDriveVaultTreePanel from './PhotoAlbumsOneDriveVaultTreePanel';
import {
  tutaPhotoAlbumsFormatPostLoginButtonSx,
  tutaPhotoAlbumsOrangePostLoginButtonSx,
  tutaPhotoAlbumsPostLoginActionButtonSx,
  tutaPhotoAlbumsYellowPostLoginButtonSx
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

const backupOrangeButtonSx = {
  ...actionButtonSx,
  ...tutaPhotoAlbumsOrangePostLoginButtonSx,
  width: { xs: '100%', sm: 'auto' },
  minWidth: { xs: '100%', sm: 200 }
};

const restoreYellowButtonSx = {
  ...actionButtonSx,
  ...tutaPhotoAlbumsYellowPostLoginButtonSx,
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
  color: 'var(--theme-yellow-color)',
  textAlign: 'center',
  fontWeight: 600,
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

export default function PhotoAlbumsOneDriveBackupDialog({
  open,
  onClose,
  folderName = 'onlinemallwebsitevault',
  onFormatted,
  onRestored,
  onOpenMyPhotoAlbums
}) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successTone, setSuccessTone] = useState('');
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);

  useEffect(() => {
    if (!open) return;
    setTreeRefreshToken((value) => value + 1);
  }, [open]);

  const resetMessages = () => {
    setError('');
    setSuccess('');
    setSuccessTone('');
  };

  const handleClose = () => {
    if (busy) return;
    resetMessages();
    onClose?.();
  };

  const refreshVaultTree = () => {
    setTreeRefreshToken((value) => value + 1);
  };

  const handleBackup = async () => {
    resetMessages();
    setBusy(true);
    try {
      const result = await downloadPhotoAlbumsOneDriveBackupZip();
      const fileName = result?.fileName || 'onlinemallwebsitevault-backup.zip';
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
      const result = await restorePhotoAlbumsOneDriveBackupZip(file);
      const count = Number(result?.restoredFiles) || 0;
      setSuccess(
        `Restored ${count} file${count === 1 ? '' : 's'} to OneDrive (${folderName}). Open MyPhotoAlbums again with your Encrypt Password to load the restored notes.`
      );
      setSuccessTone('general');
      refreshVaultTree();
      await onRestored?.(result);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFormat = async () => {
    if (busy) return;
    const ok = await themedConfirm(
      `Format ${folderName}?\n\nThis deletes the existing OneDrive MyPhotoAlbums folder and creates a fresh blank vault. Other OneDrive files are not touched.\n\nBack up first if you want to keep your current notes.`
    );
    if (!ok) return;

    resetMessages();
    setBusy(true);
    try {
      await formatPhotoAlbumsOneDrive();
      setSuccess(`Formatted ${folderName} on OneDrive. The folder is now blank and ready for a fresh vault.`);
      setSuccessTone('general');
      refreshVaultTree();
      onFormatted?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Format failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <BusyHourglassOverlay open={open && busy} label="Working on OneDrive backup" fontSize={BUSY_HOURGLASS_MODAL_SIZE} />
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
          Backup &amp; Restore TutaPhotoAlbums Cloud
        </ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
            You can backup entire TutaPhotoAlbums Cloud folder from OneDrive to a zip file in your browser download folder. You
            can also Restore from it back to OneDrive (overwrite OneDrive).
          </ColorTemplate16PopupCenterWide.SectionDescription>

          <Box sx={formatWarningBoxSx}>
            If you do not want to store your data on OneDrive, before you select the &quot;Format TutaPhotoAlbums Cloud&quot;
            button below, backup all your data first to a zip file on your storage. Click Backup TutaPhotoAlbums Cloud. Once you
            have done that, you may use Format TutaPhotoAlbums Cloud to delete your online data. Later, when you decide to
            restore your backup to OneDrive, choose Restore TutaPhotoAlbums Cloud below.
          </Box>

          {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}

          <Stack spacing={1.5}>
            <Box sx={actionRowSx}>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => void handleBackup()}
                sx={backupOrangeButtonSx}
              >
                Backup TutaPhotoAlbums Cloud
              </GreenButton>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => void handleFormat()}
                sx={formatRedButtonSx}
              >
                Format TutaPhotoAlbums Cloud
              </GreenButton>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={handleRestoreClick}
                sx={restoreYellowButtonSx}
              >
                Restore TutaPhotoAlbums Cloud
              </GreenButton>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => onOpenMyPhotoAlbums?.()}
                sx={actionButtonSx}
              >
                Open TutaPhotoAlbums Cloud
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
              refreshToken={treeRefreshToken}
              maxHeight="22vh"
            />
          </Box>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}
