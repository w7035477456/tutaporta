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
  downloadRecordVaultTutaDriveStoredBackup,
  fetchRecordVaultStorageConfig,
  fetchRecordVaultTutaDriveBackupNotebookTree,
  fetchRecordVaultTutaDriveBackupStatus,
  formatRecordVaultOneDrive,
  formatRecordVaultTutaDrive,
  restoreRecordVaultOneDriveBackupZip,
  applyRecordVaultTutaDriveMerge,
  previewRecordVaultTutaDriveMergeFromStoredBackup,
  restoreRecordVaultTutaDriveEncryptedBackup,
  uploadRecordVaultTutaDriveStoredBackup
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
import { themedConfirm, themedOverwriteSkip, themedPrompt } from 'utils/themedDialog';
import { promptEncryptPasswordForBackupDecrypt } from 'utils/recordVaultBackupDecryptPrompt';
import Typography from '@mui/material/Typography';

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

const backupRowButtonSx = {
  ...actionButtonSx,
  minWidth: 'unset',
  px: 1.25,
  py: 0.5,
  fontSize: '0.78rem',
  lineHeight: 1.15
};

const backupRowDeleteButtonSx = {
  ...formatRedButtonSx,
  minWidth: 'unset',
  px: 1.25,
  py: 0.5,
  fontSize: '0.9rem',
  fontWeight: 700
};

const formatWarningBoxSx = {
  px: 1.5,
  py: 1.25,
  borderRadius: 1,
  border: '2px solid #000',
  bgcolor: '#000',
  color: '#fff !important',
  WebkitTextFillColor: '#fff !important',
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

const backupRowNoteSx = {
  color: 'rgba(255, 255, 255, 0.82)',
  fontWeight: 500,
  fontStyle: 'italic',
  lineHeight: 1.35,
  mt: 0.35,
  fontSize: getMobileSinglesTextFontSizeVw(),
  '@media (min-width: 600px)': {
    fontSize: getDesktopTextFontSizeVw()
  }
};

const backupOpenTreeSectionSx = {
  pt: 1,
  mt: 0.5,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 0.75,
  minHeight: 0
};

const backupRowOuterSx = {
  border: '2px solid rgba(255, 255, 255, 0.55)',
  borderRadius: 1,
  px: 1.25,
  py: 1,
  mb: 1.25,
  boxSizing: 'border-box',
  bgcolor: 'rgba(0, 0, 0, 0.18)'
};

const backupRowControlsSx = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  gap: 1
};

const backupOpenTreeScrollSx = {
  width: '100%',
  maxHeight: '28vh',
  minHeight: 120,
  overflowY: 'auto',
  overflowX: 'auto',
  border: '2px solid #000',
  bgcolor: 'rgba(0,0,0,0.35)',
  p: 1.5,
  boxSizing: 'border-box',
  fontFamily: 'monospace',
  fontSize: '0.92rem',
  lineHeight: 1.45,
  color: '#fff',
  scrollbarWidth: 'thin',
  scrollbarColor: 'var(--theme-yellow-color) rgba(0,0,0,0.4)',
  '&::-webkit-scrollbar': { width: 14 },
  '&::-webkit-scrollbar-track': { bgcolor: 'rgba(0,0,0,0.4)' },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: 'var(--theme-yellow-color)',
    borderRadius: 7,
    border: '2px solid #000'
  }
};

const backupOpenTreeNotebookSx = {
  fontWeight: 800,
  color: 'var(--theme-yellow-color)',
  mt: 0.75,
  '&:first-of-type': { mt: 0 }
};

const backupOpenTreeNoteSx = {
  fontWeight: 500,
  pl: 2.5,
  color: 'rgba(255,255,255,0.92)'
};

/** Build exactly maxSlots rows; empty slots keep Upload available. */
function buildBackupSlots(backups, maxSlots) {
  const max = Math.max(1, Number(maxSlots) || 3);
  const list = Array.isArray(backups) ? backups.slice(0, max) : [];
  const slots = [];
  for (let i = 0; i < max; i += 1) {
    const bk = list[i] || null;
    slots.push({
      slotIndex: i,
      rowNumber: i + 1,
      empty: !bk?.fileName,
      fileName: bk?.fileName || '',
      sizeBytes: Number(bk?.sizeBytes) || 0,
      mtimeMs: Number(bk?.mtimeMs) || 0,
      note: String(bk?.note || '').trim()
    });
  }
  return slots;
}

/** Among filled display slots, find the oldest by mtime (fallback: last filled). */
function findOldestBackupSlot(slots) {
  const filled = (slots || []).filter((s) => !s.empty && s.fileName);
  if (!filled.length) return null;
  let oldest = filled[0];
  for (let i = 1; i < filled.length; i += 1) {
    const row = filled[i];
    if (row.mtimeMs > 0 && (oldest.mtimeMs <= 0 || row.mtimeMs < oldest.mtimeMs)) {
      oldest = row;
    }
  }
  return oldest;
}

export default function RecordVaultOneDriveBackupDialog({
  open,
  onClose,
  folderName = 'onlinemallwebsitevault',
  tutaDrive = false,
  onFormatted,
  onRestored
}) {
  const fileInputRef = useRef(null);
  const uploadInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [successTone, setSuccessTone] = useState('');
  const [treeRefreshToken, setTreeRefreshToken] = useState(0);
  const [backupList, setBackupList] = useState([]); // { fileName, sizeBytes, mtimeMs }
  const [maxBackups, setMaxBackups] = useState(3);
  /** Server-backed TutaDrive mode (prop + /api/recordVault/storage/config + backup status). */
  const [tutaDriveActive, setTutaDriveActive] = useState(() => Boolean(tutaDrive));
  // fileName currently being restored/deleted/downloaded/uploaded
  const [actioningFile, setActioningFile] = useState('');
  /** Upload mode: replace a fileName, or null to POST a new EncryptedBackup_*.zip. */
  const [uploadTargetFile, setUploadTargetFile] = useState(null);
  const [uploadMode, setUploadMode] = useState(''); // 'replace' | 'new'
  const [openBackupFileName, setOpenBackupFileName] = useState('');
  const [openBackupNotebooks, setOpenBackupNotebooks] = useState([]);

  const backupSlots = buildBackupSlots(backupList, maxBackups);
  const slotsFull = backupSlots.every((s) => !s.empty);
  const oldestSlot = findOldestBackupSlot(backupSlots);

  const applyBackupStatus = (status) => {
    const backups = Array.isArray(status?.backups) ? status.backups : [];
    setBackupList(backups);
    if (status?.maxBackups) setMaxBackups(Number(status.maxBackups));
    if (status?.enabled === true || backups.length > 0) {
      setTutaDriveActive(true);
    }
  };

  const loadBackupList = async () => {
    const status = await fetchRecordVaultTutaDriveBackupStatus();
    applyBackupStatus(status);
    return status;
  };

  useEffect(() => {
    if (!open) return undefined;
    setTutaDriveActive(Boolean(tutaDrive));
    setOpenBackupFileName('');
    setOpenBackupNotebooks([]);
    setUploadTargetFile(null);
    setUploadMode('');
    setTreeRefreshToken((value) => value + 1);
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchRecordVaultStorageConfig().catch(() => null);
        if (cancelled) return;
        if (cfg?.tutaDrive || tutaDrive) {
          setTutaDriveActive(true);
        }
        const status = await fetchRecordVaultTutaDriveBackupStatus();
        if (cancelled) return;
        applyBackupStatus(status);
      } catch (err) {
        if (!cancelled) {
          if (tutaDrive || tutaDriveActive) {
            setBackupList([]);
          }
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
    setOpenBackupFileName('');
    setOpenBackupNotebooks([]);
    setUploadTargetFile(null);
    setUploadMode('');
    onClose?.();
  };

  const refreshVaultTree = () => {
    setTreeRefreshToken((value) => value + 1);
  };

  const handleBackup = async () => {
    resetMessages();
    if (tutaDriveActive && slotsFull && oldestSlot) {
      const ok = await themedConfirm(
        `All ${maxBackups} backup slots are full.\n\nThe oldest slot (row ${oldestSlot.rowNumber}) will be overwritten:\n${oldestSlot.fileName}\n\nContinue with Backup?`
      );
      if (!ok) return;
    }
    let backupNote = '';
    if (tutaDriveActive) {
      const entered = await themedPrompt('You can add note of this backup:', '', {
        title: 'Backup note',
        okLabel: 'Backup',
        cancelLabel: 'Cancel'
      });
      if (entered === null) return;
      backupNote = String(entered || '').trim();
    }
    setBusy(true);
    try {
      if (tutaDriveActive) {
        const result = await createRecordVaultTutaDriveEncryptedBackup(backupNote);
        const fileName = result?.fileName || 'EncryptedBackup.zip';
        const rel = result?.relativePath || fileName;
        const sizeLabel = formatBackupZipSizeLabel(result?.sizeBytes);
        const sizeText = sizeLabel ? ` (size ${sizeLabel})` : '';
        const noteText = result?.note ? ` Note: ${result.note}.` : '';
        setSuccess(
          `Backup sealed with your Encrypt Password and saved as ${rel}${sizeText}.${noteText}`
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

  const handleOpenBackupTree = async (fileName) => {
    resetMessages();
    try {
      const unlocked = await promptEncryptPasswordForBackupDecrypt('open');
      if (!unlocked) return;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to unlock Encrypt Password');
      return;
    }
    setBusy(true);
    setActioningFile(fileName);
    try {
      const tree = await fetchRecordVaultTutaDriveBackupNotebookTree(fileName);
      setOpenBackupFileName(fileName);
      setOpenBackupNotebooks(Array.isArray(tree?.notebooks) ? tree.notebooks : []);
    } catch (err) {
      setOpenBackupFileName('');
      setOpenBackupNotebooks([]);
      setError(err?.response?.data?.error || err?.message || 'Unable to open backup');
    } finally {
      setBusy(false);
      setActioningFile('');
    }
  };

  const handleMergeBackup = async (fileName) => {
    resetMessages();
    try {
      const unlocked = await promptEncryptPasswordForBackupDecrypt('merge');
      if (!unlocked) return;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to unlock Encrypt Password');
      return;
    }
    setBusy(true);
    setActioningFile(fileName);
    try {
      const preview = await previewRecordVaultTutaDriveMergeFromStoredBackup(fileName);
      const mergeId = preview?.mergeId;
      const notes = Array.isArray(preview?.notes) ? preview.notes : [];
      if (!mergeId || !notes.length) {
        setSuccess('No notes found in this backup to merge.');
        setSuccessTone('general');
        return;
      }

      setBusy(false);
      const decisions = {};
      for (const row of notes) {
        const backupNoteId = String(row.backupNoteId);
        const noteName = String(row.noteName || '').trim();
        if (row.conflict) {
          const choice = await themedOverwriteSkip(
            `Note "${noteName}" exist, overwrite current with version from zip or skip?`
          );
          decisions[backupNoteId] = choice === 'overwrite' ? 'overwrite' : 'skip';
        } else {
          decisions[backupNoteId] = 'add';
        }
      }

      setBusy(true);
      const result = await applyRecordVaultTutaDriveMerge(mergeId, decisions);
      const added = Number(result?.added) || 0;
      const overwritten = Number(result?.overwritten) || 0;
      const skipped = Number(result?.skipped) || 0;
      setSuccess(
        `Merge complete: ${added} note${added === 1 ? '' : 's'} added, ${overwritten} overwritten, ${skipped} skipped.`
      );
      setSuccessTone('general');
      refreshVaultTree();
      await onRestored?.(result);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Merge failed');
    } finally {
      setBusy(false);
      setActioningFile('');
    }
  };

  const handleTutaDriveRestoreFromStored = async (fileName) => {
    const ok = await themedConfirm(
      `Restore backup "${fileName}" from your member folder?\n\nThis replaces your current TutaDrive vault. You will need to open TutaNotes again afterward.`
    );
    if (!ok) return;
    resetMessages();
    try {
      const unlocked = await promptEncryptPasswordForBackupDecrypt('restore');
      if (!unlocked) return;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to unlock Encrypt Password');
      return;
    }
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

  const handleDownloadBackup = async (fileName) => {
    resetMessages();
    setBusy(true);
    setActioningFile(fileName);
    try {
      const result = await downloadRecordVaultTutaDriveStoredBackup(fileName);
      const sizeLabel = formatBackupZipSizeLabel(result?.sizeBytes);
      const sizeText = sizeLabel ? ` (${sizeLabel})` : '';
      setSuccess(`Downloaded ${result?.fileName || fileName}${sizeText} to your browser download folder.`);
      setSuccessTone('backup');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Download failed');
    } finally {
      setBusy(false);
      setActioningFile('');
    }
  };

  const handleUploadClick = async (slot) => {
    if (busy || !slot) return;
    resetMessages();

    if (slotsFull && oldestSlot) {
      const ok = await themedConfirm(
        `All ${maxBackups} backup slots are full.\n\nThe oldest slot (row ${oldestSlot.rowNumber}) will be overwritten:\n${oldestSlot.fileName}\n\nContinue with Upload?`
      );
      if (!ok) return;
      setUploadMode('replace');
      setUploadTargetFile(oldestSlot.fileName);
      uploadInputRef.current?.click();
      return;
    }

    if (slot.empty) {
      setUploadMode('new');
      setUploadTargetFile(null);
      uploadInputRef.current?.click();
      return;
    }

    const ok = await themedConfirm(
      `Overwrite slot (row ${slot.rowNumber})?\n\n${slot.fileName}`
    );
    if (!ok) return;
    setUploadMode('replace');
    setUploadTargetFile(slot.fileName);
    uploadInputRef.current?.click();
  };

  const handleUploadFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    const mode = uploadMode;
    const targetFileName = uploadTargetFile;
    setUploadMode('');
    setUploadTargetFile(null);
    if (!file || (mode === 'replace' && !targetFileName)) return;

    resetMessages();
    setBusy(true);
    setActioningFile(targetFileName || 'new-upload');
    try {
      const result =
        mode === 'replace'
          ? await uploadRecordVaultTutaDriveStoredBackup(file, targetFileName)
          : await uploadRecordVaultTutaDriveStoredBackup(file);
      const uploadedName = result?.fileName || targetFileName || 'EncryptedBackup.zip';
      const sizeLabel = formatBackupZipSizeLabel(result?.sizeBytes);
      const sizeText = sizeLabel ? ` (${sizeLabel})` : '';
      setSuccess(`Uploaded and saved ${uploadedName}${sizeText}.`);
      setSuccessTone('general');
      await loadBackupList();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Upload failed');
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
    if (tutaDriveActive) {
      try {
        const unlocked = await promptEncryptPasswordForBackupDecrypt('restore');
        if (!unlocked) return;
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Unable to unlock Encrypt Password');
        return;
      }
    }
    setBusy(true);
    try {
      if (tutaDriveActive) {
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
      tutaDriveActive
        ? `Format TutaDrive vault?\n\nThis deletes notes under your member notes/TutaNotes folder. Photos folder is kept.\n\nBack up first if you want to keep your current notes.`
        : `Format ${folderName}?\n\nThis deletes the existing OneDrive MyNote folder and creates a fresh vault with SAMPLE NOTEBOOK (SAMPLE NOTE1 / SAMPLE NOTE2). Other OneDrive files are not touched.\n\nBack up first if you want to keep your current notes.`
    );
    if (!ok) return;

    resetMessages();
    setBusy(true);
    try {
      if (tutaDriveActive) {
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

  const renderBackupRowActionButtons = (slot) => {
    const fileName = slot?.fileName || '';
    const empty = Boolean(slot?.empty);
    const isActioning = Boolean(fileName) && actioningFile === fileName;
    const filledDisabled = busy || empty;
    return (
      <>
        <GreenButton
          type="button"
          disabled={filledDisabled}
          onClick={() => void handleDownloadBackup(fileName)}
          sx={{ ...backupRowButtonSx, opacity: isActioning || empty ? 0.45 : 1 }}
        >
          Download
        </GreenButton>
        <GreenButton
          type="button"
          disabled={busy}
          onClick={() => void handleUploadClick(slot)}
          sx={{ ...backupRowButtonSx, opacity: isActioning ? 0.6 : 1 }}
        >
          Upload
        </GreenButton>
        <GreenButton
          type="button"
          disabled={filledDisabled}
          onClick={() => void handleMergeBackup(fileName)}
          sx={{ ...backupRowButtonSx, opacity: isActioning || empty ? 0.45 : 1 }}
        >
          Merge
        </GreenButton>
        <GreenButton
          type="button"
          disabled={filledDisabled}
          onClick={() => void handleTutaDriveRestoreFromStored(fileName)}
          sx={{ ...backupRowButtonSx, opacity: isActioning || empty ? 0.45 : 1 }}
        >
          Restore
        </GreenButton>
        <GreenButton
          type="button"
          disabled={filledDisabled}
          onClick={() => void handleOpenBackupTree(fileName)}
          sx={{ ...backupRowButtonSx, opacity: isActioning || empty ? 0.45 : 1 }}
        >
          Open
        </GreenButton>
        <GreenButton
          type="button"
          disabled={filledDisabled}
          onClick={() => void handleDeleteBackup(fileName)}
          sx={{ ...backupRowDeleteButtonSx, opacity: isActioning || empty ? 0.45 : 1 }}
        >
          X
        </GreenButton>
      </>
    );
  };

  const renderOpenBackupTree = (fileName) => {
    if (openBackupFileName !== fileName) return null;
    return (
      <Box sx={backupOpenTreeSectionSx}>
        <ColorTemplate16PopupCenterWide.SectionDescription
          sx={{ ...generalSuccessMessageSx, mb: 0, textAlign: 'left' }}
        >
          Opened notebook list from {fileName}.
        </ColorTemplate16PopupCenterWide.SectionDescription>
        <ColorTemplate16PopupCenterWide.SectionDescription
          sx={{ mb: 0, textAlign: 'left', fontWeight: 700 }}
        >
          Notebooks &amp; notes in {fileName}
        </ColorTemplate16PopupCenterWide.SectionDescription>
        <Box sx={backupOpenTreeScrollSx} role="tree" aria-label={`Notebooks in ${fileName}`}>
          {openBackupNotebooks.length === 0 ? (
            <Typography component="div" sx={{ fontFamily: 'inherit', fontSize: 'inherit' }}>
              (No notebooks found in this backup)
            </Typography>
          ) : (
            openBackupNotebooks.map((nb) => (
              <Box key={`nb-${nb.notebookId}-${nb.notebookName}`}>
                <Typography component="div" sx={backupOpenTreeNotebookSx}>
                  📁 {nb.notebookName}
                </Typography>
                {(nb.notes || []).length === 0 ? (
                  <Typography
                    component="div"
                    sx={{ ...backupOpenTreeNoteSx, fontStyle: 'italic', opacity: 0.75 }}
                  >
                    (no notes)
                  </Typography>
                ) : (
                  (nb.notes || []).map((note) => (
                    <Typography
                      key={`note-${note.noteId}-${note.noteName}`}
                      component="div"
                      sx={backupOpenTreeNoteSx}
                    >
                      • {note.noteName}
                    </Typography>
                  ))
                )}
              </Box>
            ))
          )}
        </Box>
      </Box>
    );
  };

  return (
    <>
      <BusyHourglassOverlay
        open={open && busy}
        label={tutaDriveActive ? 'Working on TutaDrive backup' : 'Working on OneDrive backup'}
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={tutaDriveActive ? '.zip,application/octet-stream,application/zip' : '.zip,application/zip'}
        hidden
        onChange={(event) => void handleRestoreFile(event)}
      />
      <input
        ref={uploadInputRef}
        type="file"
        accept=".zip,application/octet-stream,application/zip"
        hidden
        onChange={(event) => void handleUploadFile(event)}
      />
      <ColorTemplate16PopupCenterWide open={open} onClose={handleClose} closeOnBackdrop={!busy}>
        <ColorTemplate16PopupCenterWide.Title>
          Backup &amp; Restore TutaNotes Cloud
        </ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
            {tutaDriveActive
              ? 'Backup seals your TutaDrive vault with your Encrypt Password (zero-knowledge) and stores one file under your member folder: users/M####/EncryptedBackup_YYYY-MM-DD_HH-MM-SS.zip. You can save up to 3 zip files. When all 3 slots are full, Backup or Upload overwrites the oldest slot (after you confirm).'
              : 'You can backup entire TutaNotes Cloud folder from OneDrive to a zip file in your browser download folder. You can also Restore from it back to OneDrive (overwrite OneDrive).'}
          </ColorTemplate16PopupCenterWide.SectionDescription>

          <Box sx={formatWarningBoxSx}>
            {tutaDriveActive
              ? 'Backup Encryption uses the same Encrypt Password from Full Disk Encryption — the password never leaves your browser. Up to 3 EncryptedBackup_*.zip files are kept. Before Format, run Backup first if you need to keep your notes.'
              : 'If you do not want to store your data on OneDrive, before you select the "Format TutaNotes Cloud" button below, backup all your data first to a zip file on your storage. Click Backup/Encrypt TutaNote to Cloud. Once you have done that, you may use Format TutaNotes Cloud to delete your online data. Later, when you decide to restore your backup to OneDrive, choose Restore below.'}
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
                Backup/Encrypt TutaNote to Cloud
              </GreenButton>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => void handleFormat()}
                sx={formatRedButtonSx}
              >
                Format TutaNotes Cloud
              </GreenButton>
              {!tutaDriveActive && (
                <GreenButton
                  type="button"
                  disabled={busy}
                  onClick={handleRestoreClick}
                  sx={restoreYellowButtonSx}
                >
                  Restore
                </GreenButton>
              )}
            </Box>
          </Stack>

          {tutaDriveActive ? (
            <Box sx={{ pt: 0.5 }}>
              {backupSlots.map((slot) => {
                const mb =
                  !slot.empty && Number(slot.sizeBytes) > 0
                    ? (Number(slot.sizeBytes) / (1024 * 1024)).toFixed(1)
                    : '';
                const label = slot.empty
                  ? ''
                  : mb
                    ? `${slot.fileName} (${mb}mb)`
                    : slot.fileName;
                return (
                  <Box key={`backup-slot-${slot.rowNumber}`} sx={backupRowOuterSx}>
                    <Box sx={backupRowControlsSx}>
                      <Box
                        sx={{
                          flex: 1,
                          minWidth: { xs: '100%', sm: 220 },
                          color: '#fff',
                          fontWeight: 700,
                          lineHeight: 1.3,
                          fontSize: getMobileSinglesTextFontSizeVw(),
                          '@media (min-width: 600px)': {
                            fontSize: getDesktopTextFontSizeVw()
                          }
                        }}
                      >
                        <Box>
                          {slot.rowNumber}) {label}
                        </Box>
                        {!slot.empty && slot.note ? (
                          <Box sx={backupRowNoteSx}>(Note: {slot.note})</Box>
                        ) : null}
                      </Box>
                      {renderBackupRowActionButtons(slot)}
                    </Box>
                    {!slot.empty ? renderOpenBackupTree(slot.fileName) : null}
                  </Box>
                );
              })}
            </Box>
          ) : null}

          {success ? (
            successTone === 'backup' ? (
              <Box sx={backupSuccessMessageSx}>{success}</Box>
            ) : (
              <ColorTemplate16PopupCenterWide.SectionDescription sx={generalSuccessMessageSx}>
                {success}
              </ColorTemplate16PopupCenterWide.SectionDescription>
            )
          ) : null}

          {!tutaDriveActive ? (
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
  onRestored: PropTypes.func
};
