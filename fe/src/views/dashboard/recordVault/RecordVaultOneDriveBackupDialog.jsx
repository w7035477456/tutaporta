import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import GreenButton from 'ui-component/GreenButton';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import {
  createRecordVaultTutaDriveEncryptedBackup,
  deleteRecordVaultTutaDriveBackup,
  downloadRecordVaultOneDriveBackupZip,
  fetchRecordVaultTutaDriveBackupStatus,
  formatRecordVaultOneDrive,
  formatRecordVaultTutaDrive,
  restoreRecordVaultOneDriveBackupZip,
  restoreRecordVaultTutaDriveEncryptedBackup
} from 'api/recordVaultFe';
import RecordVaultOneDriveVaultTreePanel from './RecordVaultOneDriveVaultTreePanel';
import {
  tutaNotesFormatPostLoginButtonSx,
  tutaNotesOrangePostLoginButtonSx,
  tutaNotesPostLoginActionButtonSx,
  tutaNotesYellowPostLoginButtonSx
} from './tutaNotesPostLoginActionButtonSx';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { themedConfirm } from 'utils/themedDialog';

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
  ...tutaNotesPostLoginActionButtonSx,
  width: { xs: '100%', sm: 'auto' }
};

const backupOrangeButtonSx = {
  ...actionButtonSx,
  ...tutaNotesOrangePostLoginButtonSx,
  width: { xs: '100%', sm: 'auto' },
  minWidth: { xs: '100%', sm: 200 }
};

const restoreYellowButtonSx = {
  ...actionButtonSx,
  ...tutaNotesYellowPostLoginButtonSx,
  width: { xs: '100%', sm: 'auto' },
  minWidth: { xs: '100%', sm: 200 }
};

const formatRedButtonSx = {
  ...actionButtonSx,
  ...tutaNotesFormatPostLoginButtonSx,
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

export default function RecordVaultOneDriveBackupDialog({
  open,
  onClose,
  folderName = 'onlinemallwebsitevault',
  tutaDrive = false,
  onFormatted,
  onRestored,
  onOpenMyNote
}) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successTone, setSuccessTone] = useState('');
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);
  const [backupList, setBackupList] = useState([]); // { fileName, sizeBytes, mtimeMs }
  const [maxBackups, setMaxBackups] = useState(3);
  // fileName currently being restored/deleted
  const [actioningFile, setActioningFile] = useState('');

  const loadBackupList = async () => {
    const status = await fetchRecordVaultTutaDriveBackupStatus();
    setBackupList(Array.isArray(status?.backups) ? status.backups : []);
    if (status?.maxBackups) setMaxBackups(Number(status.maxBackups));
  };

  useEffect(() => {
    if (!open) return;
    setTreeRefreshToken((value) => value + 1);
    if (!tutaDrive) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const status = await fetchRecordVaultTutaDriveBackupStatus();
        if (cancelled) return;
        setBackupList(Array.isArray(status?.backups) ? status.backups : []);
        if (status?.maxBackups) setMaxBackups(Number(status.maxBackups));
      } catch (err) {
        if (!cancelled) {
          setBackupList([]);
          setError(err?.response?.data?.error || err?.message || 'Unable to load backup list');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tutaDrive]);

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
    if (tutaDrive && backupList.length >= maxBackups) {
      setError(`Maximum limit of ${maxBackups} backup copies reached. Please delete at least one older backup before creating a new one.`);
      return;
    }
    setBusy(true);
    try {
      if (tutaDrive) {
        const result = await createRecordVaultTutaDriveEncryptedBackup();
        const fileName = result?.fileName || 'backup.zip';
        const rel = result?.relativePath || fileName;
        const sizeLabel = formatBackupZipSizeLabel(result?.sizeBytes);
        const sizeText = sizeLabel ? ` (size ${sizeLabel})` : '';
        setSuccess(
          `Backup sealed with your Encrypt Password and saved as ${rel}${sizeText}.`
        );
        setSuccessTone('backup');
        await loadBackupList();
      } else {
        const result = await downloadRecordVaultOneDriveBackupZip();
        const fileName = result?.fileName || 'onlinemallwebsitevault-backup.zip';
        const sizeLabel = formatBackupZipSizeLabel(result?.sizeBytes);
        const sizeText = sizeLabel ? ` (size ${sizeLabel})` : '';
        setSuccess(
          `Backup to zip completed. Your ${fileName}${sizeText} has been downloaded to browser download folder.`
        );
        setSuccessTone('backup');
      }
      refreshVaultTree();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Backup failed');
    } finally {
      setBusy(false);
    }
  };

  const handleTutaDriveRestoreFromStored = async (fileName) => {
    const ok = await themedConfirm(
      `Restore backup "${fileName}" from your member folder?\n\nThis replaces your current TutaDrive vault. You will need to open TutaNotes again afterward.`
    );
    if (!ok) return;
    resetMessages();
    setBusy(true);
    setActioningFile(fileName);
    try {
      const result = await restoreRecordVaultTutaDriveEncryptedBackup(undefined, fileName);
      const count = Number(result?.restoredFiles) || 0;
      setSuccess(
        `Restored ${count} file${count === 1 ? '' : 's'} to TutaDrive (decrypted with your Encrypt Password). Open TutaNotes again to load the restored notes.`
      );
      setSuccessTone('general');
      refreshVaultTree();
      await onRestored?.(result);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Restore failed');
    } finally {
      setBusy(false);
      setActioningFile('');
    }
  };

  const handleDeleteBackup = async (fileName) => {
    const ok = await themedConfirm(`Delete backup "${fileName}"?\n\nThis cannot be undone.`);
    if (!ok) return;
    resetMessages();
    setBusy(true);
    setActioningFile(fileName);
    try {
      await deleteRecordVaultTutaDriveBackup(fileName);
      await loadBackupList();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Delete failed');
    } finally {
      setBusy(false);
      setActioningFile('');
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
      if (tutaDrive) {
        const result = await restoreRecordVaultTutaDriveEncryptedBackup(file);
        const count = Number(result?.restoredFiles) || 0;
        setSuccess(
          `Restored ${count} file${count === 1 ? '' : 's'} to TutaDrive (decrypted with your Encrypt Password). Open TutaNotes again to load the restored notes.`
        );
        setSuccessTone('general');
        refreshVaultTree();
        await onRestored?.(result);
      } else {
        const result = await restoreRecordVaultOneDriveBackupZip(file);
        const count = Number(result?.restoredFiles) || 0;
        setSuccess(
          `Restored ${count} file${count === 1 ? '' : 's'} to OneDrive (${folderName}). Open MyNote again with your Encrypt Password to load the restored notes.`
        );
        setSuccessTone('general');
        refreshVaultTree();
        await onRestored?.(result);
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Restore failed');
    } finally {
      setBusy(false);
    }
  };

  const handleFormat = async () => {
    if (busy) return;
    const ok = await themedConfirm(
      tutaDrive
        ? `Format TutaDrive vault?\n\nThis deletes notes under your member notes/TutaNotes folder. Photos folder is kept.\n\nBack up first if you want to keep your current notes.`
        : `Format ${folderName}?\n\nThis deletes the existing OneDrive MyNote folder and creates a fresh vault with SAMPLE NOTEBOOK (SAMPLE NOTE1 / SAMPLE NOTE2). Other OneDrive files are not touched.\n\nBack up first if you want to keep your current notes.`
    );
    if (!ok) return;

    resetMessages();
    setBusy(true);
    try {
      if (tutaDrive) {
        await formatRecordVaultTutaDrive();
        setSuccess('Formatted TutaDrive vault. Open TutaNotes again to create a fresh vault.');
      } else {
        await formatRecordVaultOneDrive();
        setSuccess(
          `Formatted ${folderName} on OneDrive. Open TutaNotes again to see SAMPLE NOTEBOOK.`
        );
      }
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
      <BusyHourglassOverlay
        open={open && busy}
        label={tutaDrive ? 'Working on TutaDrive backup' : 'Working on OneDrive backup'}
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={tutaDrive ? '.zip,application/octet-stream,application/zip' : '.zip,application/zip'}
        hidden
        onChange={(event) => void handleRestoreFile(event)}
      />
      <ColorTemplate16PopupCenterWide open={open} onClose={handleClose} closeOnBackdrop={!busy}>
        <ColorTemplate16PopupCenterWide.Title>
          Backup &amp; Restore TutaNotes Cloud
        </ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
            {tutaDrive
              ? 'Backup seals your TutaDrive vault with your Encrypt Password (zero-knowledge) and stores one file under your member folder: users/M####/backup_YYYY-MM-DD_HH-MM-SS.zip. You can save up to 3 zip files.'
              : 'You can backup entire TutaNotes Cloud folder from OneDrive to a zip file in your browser download folder. You can also Restore from it back to OneDrive (overwrite OneDrive).'}
          </ColorTemplate16PopupCenterWide.SectionDescription>

          <Box sx={formatWarningBoxSx}>
            {tutaDrive
              ? 'Sealing uses the same Encrypt Password from Full Disk Encryption — the password never leaves your browser. Up to 3 backup_*.zip files are kept. Before Format, run Backup first if you need to keep your notes.'
              : 'If you do not want to store your data on OneDrive, before you select the "Format TutaNotes Cloud" button below, backup all your data first to a zip file on your storage. Click Backup TutaNotes Cloud. Once you have done that, you may use Format TutaNotes Cloud to delete your online data. Later, when you decide to restore your backup to OneDrive, choose Restore TutaNotes Cloud below.'}
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
                Backup TutaNotes Cloud
              </GreenButton>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => void handleFormat()}
                sx={formatRedButtonSx}
              >
                Format TutaNotes Cloud
              </GreenButton>
              {!tutaDrive && (
                <GreenButton
                  type="button"
                  disabled={busy}
                  onClick={handleRestoreClick}
                  sx={restoreYellowButtonSx}
                >
                  Restore TutaNotes Cloud
                </GreenButton>
              )}
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => onOpenMyNote?.()}
                sx={actionButtonSx}
              >
                Open TutaNotes Cloud
              </GreenButton>
            </Box>
          </Stack>

          {tutaDrive && backupList.length === 0 ? (
            <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
              No backup_*.zip files found in your member folder yet. Click Backup TutaNotes Cloud to create one.
            </ColorTemplate16PopupCenterWide.SectionDescription>
          ) : null}

          {tutaDrive && backupList.length > 0 && (
            <Box sx={{ pt: 0.5 }}>
              {backupList.map((bk, idx) => {
                const mb = Number(bk.sizeBytes) > 0 ? (Number(bk.sizeBytes) / (1024 * 1024)).toFixed(1) : '';
                const label = mb ? `${bk.fileName} (${mb}mb)` : bk.fileName;
                const isActioning = actioningFile === bk.fileName;
                return (
                  <Box
                    key={bk.fileName}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      py: 0.75,
                      borderBottom: idx < backupList.length - 1 ? '1px solid rgba(255,255,255,0.12)' : 'none'
                    }}
                  >
                    <Box
                      sx={{
                        flex: 1,
                        color: '#fff',
                        fontWeight: 700,
                        lineHeight: 1.3,
                        fontSize: getMobileSinglesTextFontSizeVw(),
                        '@media (min-width: 600px)': {
                          fontSize: getDesktopTextFontSizeVw()
                        }
                      }}
                    >
                      {idx + 1}) {label}
                    </Box>
                    <GreenButton
                      type="button"
                      disabled={busy}
                      onClick={() => void handleTutaDriveRestoreFromStored(bk.fileName)}
                      sx={{ ...restoreYellowButtonSx, minWidth: 'unset', px: 1.5, fontSize: '0.8rem', opacity: isActioning ? 0.6 : 1 }}
                    >
                      Restore TutaNotes
                    </GreenButton>
                    <GreenButton
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDeleteBackup(bk.fileName)}
                      sx={{ ...formatRedButtonSx, minWidth: 'unset', px: 1.5, fontSize: '0.9rem', fontWeight: 700, opacity: isActioning ? 0.6 : 1 }}
                    >
                      X
                    </GreenButton>
                  </Box>
                );
              })}
            </Box>
          )}

          {success ? (
            successTone === 'backup' ? (
              <Box sx={backupSuccessMessageSx}>{success}</Box>
            ) : (
              <ColorTemplate16PopupCenterWide.SectionDescription sx={generalSuccessMessageSx}>
                {success}
              </ColorTemplate16PopupCenterWide.SectionDescription>
            )
          ) : null}

          {!tutaDrive ? (
            <Box sx={vaultTreeSectionSx}>
              <RecordVaultOneDriveVaultTreePanel
                active={open}
                refreshToken={treeRefreshToken}
                maxHeight="22vh"
              />
            </Box>
          ) : null}
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}

RecordVaultOneDriveBackupDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  folderName: PropTypes.string,
  tutaDrive: PropTypes.bool,
  onFormatted: PropTypes.func,
  onRestored: PropTypes.func,
  onOpenMyNote: PropTypes.func
};
