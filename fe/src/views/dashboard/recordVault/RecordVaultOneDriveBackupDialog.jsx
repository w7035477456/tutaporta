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
  tutaNotesPostLoginActionButtonSx,
  tutaNotesYellowPostLoginButtonSx
} from './tutaNotesPostLoginActionButtonSx';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { themedConfirm, themedOverwriteSkip } from 'utils/themedDialog';
import {
  ensureEncryptPasswordForBackupSeal,
  prepareBackupDecryptWithPassword
} from 'utils/recordVaultBackupDecryptPrompt';
import RecordVaultBackupPasswordDialog from './RecordVaultBackupPasswordDialog';
import { tutaDriveBackupFileNamePreview } from 'utils/recordVaultBackupFileName';
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

/** User-facing text for backup/restore request failures (gateway errors carry HTML, not JSON). */
function describeBackupRequestError(err, fallback) {
  const apiError = err?.response?.data?.error;
  if (apiError) return apiError;
  const status = Number(err?.response?.status) || 0;
  if (status === 413) {
    return 'Server error 413: the backup zip is larger than the web server upload limit.';
  }
  if (status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 524)) {
    return (
      `Server error ${status}: the web server dropped or timed out the request while processing the backup zip. ` +
      'Please try again. If it keeps happening, the server log (pm2 logs onlinemallwebsite) shows the reason.'
    );
  }
  return err?.message || fallback;
}

function formatProgressMb(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0.0 MB';
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDurationSec(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

/** Ordered steps + labels per backup operation shown in the busy overlay. */
const BACKUP_OPERATION_STEPS = {
  backup: {
    title: 'Backing up TutaNotes to Cloud',
    steps: [
      ['build', 'Server zipping your TutaNote Cloud'],
      ['seal', 'Encrypting with the password for this zip'],
      ['send', 'Uploading sealed zip to TutaCloud'],
      ['server', 'Server saving zip to your member folder'],
      ['saved', 'Refreshing backup list']
    ],
    serverWaitText: 'waiting for server to write the file'
  },
  upload: {
    title: 'Uploading backup zip',
    steps: [
      ['read', 'Reading zip from your computer'],
      ['seal', 'Encrypting in your browser'],
      ['send', 'Uploading to TutaCloud'],
      ['server', 'Server saving zip to your member folder'],
      ['saved', 'Refreshing backup list']
    ],
    serverWaitText: 'waiting for server to write the file'
  },
  restore: {
    title: 'Restoring TutaDrive vault',
    steps: [
      ['download', 'Downloading sealed zip from TutaCloud'],
      ['decrypt', 'Checking password and decrypting in your browser'],
      ['send', 'Sending decrypted vault to TutaDrive'],
      ['server', 'Server replacing your TutaDrive vault (unpacking files)'],
      ['refresh', 'Refreshing TutaDrive file list']
    ],
    serverWaitText: 'server is unpacking notes and attachments into your vault'
  },
  restoreLocal: {
    title: 'Restoring TutaDrive vault',
    steps: [
      ['read', 'Reading zip from your computer'],
      ['decrypt', 'Checking password and decrypting in your browser'],
      ['send', 'Sending decrypted vault to TutaDrive'],
      ['server', 'Server replacing your TutaDrive vault (unpacking files)'],
      ['refresh', 'Refreshing TutaDrive file list']
    ],
    serverWaitText: 'server is unpacking notes and attachments into your vault'
  },
  merge: {
    title: 'Merging backup into TutaDrive',
    steps: [
      ['download', 'Downloading sealed zip from TutaCloud'],
      ['decrypt', 'Checking password and decrypting in your browser'],
      ['send', 'Sending decrypted zip for comparison'],
      ['server', 'Server comparing backup notes with your current notes'],
      ['apply', 'Merging notes into your vault'],
      ['refresh', 'Refreshing TutaDrive file list']
    ],
    serverWaitText: 'server is comparing every note in the backup with your vault'
  }
};

function formatTransferLine(verb, progress) {
  const total = Number(progress.totalBytes) || 0;
  const lines = [
    total > 0
      ? `${verb} ${formatProgressMb(progress.loadedBytes)} of ${formatProgressMb(total)}`
      : `${verb} ${formatProgressMb(progress.loadedBytes)}`
  ];
  if (!progress.done && Number(progress.bytesPerSec) > 0) {
    const eta = Number.isFinite(progress.etaSec) ? ` — about ${formatDurationSec(progress.etaSec)} left` : '';
    lines.push(`Speed: ${formatProgressMb(progress.bytesPerSec)}/s${eta}`);
  }
  return lines;
}

/** Multi-line status for BusyHourglassOverlay while a backup Upload / Restore / Merge runs. */
function buildBackupProgressLabel(progress, nowMs) {
  if (!progress) return '';
  const op = BACKUP_OPERATION_STEPS[progress.operation] || BACKUP_OPERATION_STEPS.upload;
  const lines = [];
  if (progress.sourceName) {
    const size = Number(progress.sourceBytes) > 0 ? ` (${formatProgressMb(progress.sourceBytes)})` : '';
    const sourceLabel = { upload: 'File', backup: 'Zip' }[progress.operation] || 'Backup';
    lines.push(`${sourceLabel}: ${progress.sourceName}${size}`);
  }
  if (progress.operation === 'upload' || progress.operation === 'backup') {
    lines.push(progress.targetName ? `Slot: overwrite ${progress.targetName}` : 'Slot: new backup slot');
  }

  if (progress.stage === 'done') {
    lines.push(`${op.title} — complete`);
  } else {
    const index = op.steps.findIndex(([key]) => key === progress.stage);
    const stepLabel = index >= 0 ? op.steps[index][1] : 'Working';
    lines.push(index >= 0 ? `Step ${index + 1} of ${op.steps.length}: ${stepLabel}` : stepLabel);
  }

  switch (progress.stage) {
    case 'read':
      lines.push(...formatTransferLine('Read', progress));
      break;
    case 'download':
      lines.push(...formatTransferLine('Downloaded', progress));
      break;
    case 'build':
      lines.push(...formatTransferLine('Received', progress));
      if (!progress.done && !(Number(progress.totalBytes) > 0) && Number(progress.estimatedBytes) > 0) {
        lines.push(`Expected about ${formatProgressMb(progress.estimatedBytes)} (based on your newest backup)`);
      }
      break;
    case 'seal': {
      const secret = progress.withZipPassword ? 'the password for this zip' : 'your Encrypt Password';
      lines.push(
        progress.alreadySealed
          ? 'Zip is already sealed — no re-encryption needed'
          : progress.done
            ? `Sealed with ${secret} (${formatProgressMb(progress.totalBytes)})`
            : `Sealing ${formatProgressMb(progress.totalBytes)} with ${secret} (${
                progress.withZipPassword ? 'Argon2id + ' : ''
              }AES-256-GCM)…`
      );
      break;
    }
    case 'decrypt':
      lines.push(
        progress.done
          ? `Decrypted — vault zip is ${formatProgressMb(progress.totalBytes)}`
          : progress.withZipPassword
            ? `Verifying zip password (Argon2id) and decrypting ${formatProgressMb(progress.totalBytes)} (AES-256-GCM)…`
            : `Decrypting ${formatProgressMb(progress.totalBytes)} with your Encrypt Password (AES-256-GCM)…`
      );
      break;
    case 'send':
      lines.push(...formatTransferLine('Sent', progress));
      break;
    case 'server':
      lines.push(`All ${formatProgressMb(progress.totalBytes)} sent — ${op.serverWaitText}`);
      break;
    case 'saved':
      if (progress.fileName) lines.push(`Saved as ${progress.fileName}`);
      break;
    case 'apply':
      lines.push(
        `${progress.addCount || 0} to add, ${progress.overwriteCount || 0} to overwrite, ${progress.skipCount || 0} to skip`
      );
      break;
    default:
      break;
  }

  if (Number(progress.noteCount) > 0 && progress.stage !== 'apply') {
    lines.push(`Backup contains ${progress.noteCount} notes (${progress.conflictCount || 0} already exist)`);
  }
  if (Number.isFinite(progress.restoredFiles)) {
    lines.push(`Restored ${progress.restoredFiles} files`);
  }
  if (progress.startedAt) {
    lines.push(`Elapsed: ${formatDurationSec((nowMs - progress.startedAt) / 1000)}`);
  }
  return lines.join('\n');
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

const backupRowLabelSx = {
  flex: 1,
  minWidth: { xs: '100%', sm: 220 },
  color: '#fff',
  fontWeight: 700,
  lineHeight: 1.3,
  overflowWrap: 'anywhere',
  fontSize: getMobileSinglesTextFontSizeVw(),
  '@media (min-width: 600px)': {
    fontSize: getDesktopTextFontSizeVw()
  }
};

const backupRowNoteSx = {
  color: 'rgba(255, 255, 255, 0.82)',
  fontWeight: 500,
  fontStyle: 'italic',
  lineHeight: 1.35,
  ml: 1,
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
      note: String(bk?.note || '').trim(),
      hint: String(bk?.hint || '').trim(),
      passwordCheck: bk?.passwordCheck || null
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
  /** Backup password screen: { mode, fileName, note, hint, passwordCheck, warning, resolve }. */
  const [passwordDialog, setPasswordDialog] = useState(null);
  /** Upload / Restore / Merge progress: { operation, stage, percent, sourceName, startedAt, ... }. */
  const [backupProgress, setBackupProgress] = useState(null);
  const [progressNowMs, setProgressNowMs] = useState(() => Date.now());

  const backupProgressActive = Boolean(backupProgress);

  useEffect(() => {
    if (!backupProgressActive) return undefined;
    setProgressNowMs(Date.now());
    const timer = setInterval(() => setProgressNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [backupProgressActive]);

  /**
   * Start tracking an operation. `update(event)` replaces the per-step details;
   * `addInfo(info)` adds facts (note counts, restored files) kept for later steps.
   */
  const startBackupProgress = (operation, sourceName, sourceBytes, extra = {}) => {
    const base = { operation, sourceName, sourceBytes, startedAt: Date.now(), ...extra };
    let info = {};
    let latest = { ...base, stage: '', percent: 0 };
    setBackupProgress(latest);
    return {
      base,
      update: (event) => {
        latest = { ...base, ...info, ...event };
        setBackupProgress(latest);
      },
      addInfo: (nextInfo) => {
        info = { ...info, ...nextInfo };
        latest = { ...latest, ...nextInfo };
        setBackupProgress(latest);
      }
    };
  };

  const backupSlots = buildBackupSlots(backupList, maxBackups);

  /** @returns {Promise<{ note, hint, password, dateStamp } | null>} null when cancelled */
  const askBackupPassword = (opts) =>
    new Promise((resolve) => {
      setPasswordDialog({
        mode: 'backup',
        fileName: '',
        note: '',
        hint: '',
        passwordCheck: null,
        warning: '',
        ...opts,
        resolve
      });
    });

  const closePasswordDialog = (value) => {
    const resolve = passwordDialog?.resolve;
    setPasswordDialog(null);
    if (typeof resolve === 'function') resolve(value);
  };

  /** Password screen for a stored backup (shows its note + hint), then prepares the decrypt. */
  const askStoredBackupPassword = async (purpose, fileName, warning = '') => {
    const slot = backupSlots.find((s) => s.fileName === fileName);
    const result = await askBackupPassword({
      mode: purpose,
      fileName,
      note: slot?.note || '',
      hint: slot?.hint || '',
      passwordCheck: slot?.passwordCheck || null,
      warning
    });
    if (!result) return false;
    await prepareBackupDecryptWithPassword(result.password, purpose);
    return true;
  };
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
    let backupInput = null;
    if (tutaDriveActive) {
      backupInput = await askBackupPassword({ mode: 'backup' });
      if (!backupInput) return;
    }
    setBusy(true);
    try {
      if (tutaDriveActive) {
        const newestBackupBytes = backupSlots
          .filter((s) => !s.empty && Number(s.sizeBytes) > 0)
          .sort((a, b) => (Number(b.mtimeMs) || 0) - (Number(a.mtimeMs) || 0))[0]?.sizeBytes;
        const progress = startBackupProgress(
          'backup',
          tutaDriveBackupFileNamePreview(backupInput.note, backupInput.dateStamp),
          0,
          { targetName: slotsFull && oldestSlot ? oldestSlot.fileName : '' }
        );
        const result = await createRecordVaultTutaDriveEncryptedBackup(backupInput.note, {
          hint: backupInput.hint,
          dateStamp: backupInput.dateStamp,
          password: backupInput.password,
          onProgress: progress.update,
          estimatedTotalBytes: Number(newestBackupBytes) || 0
        });
        const fileName = result?.fileName || 'EncryptedTutaNotesZip.zip';
        const rel = result?.relativePath || fileName;
        const sizeLabel = formatBackupZipSizeLabel(result?.sizeBytes);
        const sizeText = sizeLabel ? ` (size ${sizeLabel})` : '';
        const noteText = result?.note ? ` Note: ${result.note}.` : '';
        await loadBackupList();
        progress.update({ stage: 'done', percent: 100 });
        const elapsedText = formatDurationSec((Date.now() - progress.base.startedAt) / 1000);
        setSuccess(
          `Backup sealed with the password you chose for this zip and saved as ${rel}${sizeText} in ${elapsedText}.${noteText}`
        );
        setSuccessTone('backup');
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
      setError(describeBackupRequestError(err, 'Backup failed'));
    } finally {
      setBusy(false);
      setBackupProgress(null);
    }
  };

  const handleOpenBackupTree = async (fileName) => {
    resetMessages();
    try {
      const unlocked = await askStoredBackupPassword('open', fileName);
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
      setError(describeBackupRequestError(err, 'Unable to open backup'));
    } finally {
      setBusy(false);
      setActioningFile('');
    }
  };

  const handleMergeBackup = async (fileName) => {
    resetMessages();
    try {
      const unlocked = await askStoredBackupPassword('merge', fileName);
      if (!unlocked) return;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to unlock Encrypt Password');
      return;
    }
    setBusy(true);
    setActioningFile(fileName);
    const slot = backupSlots.find((s) => s.fileName === fileName);
    const progress = startBackupProgress('merge', fileName, Number(slot?.sizeBytes) || 0);
    try {
      const preview = await previewRecordVaultTutaDriveMergeFromStoredBackup(fileName, {
        onProgress: progress.update
      });
      const mergeId = preview?.mergeId;
      const notes = Array.isArray(preview?.notes) ? preview.notes : [];
      if (!mergeId || !notes.length) {
        setSuccess('No notes found in this backup to merge.');
        setSuccessTone('general');
        return;
      }
      const conflictCount = notes.filter((row) => row.conflict).length;
      progress.addInfo({ noteCount: notes.length, conflictCount });

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
      const choices = Object.values(decisions);
      progress.update({
        stage: 'apply',
        percent: 85,
        addCount: choices.filter((c) => c === 'add').length,
        overwriteCount: choices.filter((c) => c === 'overwrite').length,
        skipCount: choices.filter((c) => c === 'skip').length
      });

      setBusy(true);
      const result = await applyRecordVaultTutaDriveMerge(mergeId, decisions);
      const added = Number(result?.added) || 0;
      const overwritten = Number(result?.overwritten) || 0;
      const skipped = Number(result?.skipped) || 0;
      progress.update({ stage: 'refresh', percent: 95 });
      refreshVaultTree();
      await onRestored?.(result);
      progress.update({ stage: 'done', percent: 100 });
      const elapsedText = formatDurationSec((Date.now() - progress.base.startedAt) / 1000);
      setSuccess(
        `Merge complete in ${elapsedText}: ${added} note${added === 1 ? '' : 's'} added, ${overwritten} overwritten, ${skipped} skipped.`
      );
      setSuccessTone('general');
    } catch (err) {
      setError(describeBackupRequestError(err, 'Merge failed'));
    } finally {
      setBusy(false);
      setActioningFile('');
      setBackupProgress(null);
    }
  };

  const handleTutaDriveRestoreFromStored = async (fileName) => {
    resetMessages();
    try {
      const unlocked = await askStoredBackupPassword(
        'restore',
        fileName,
        'Restore replaces your current TutaDrive vault. You will need to open TutaNotes again afterward.'
      );
      if (!unlocked) return;
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to unlock Encrypt Password');
      return;
    }
    setBusy(true);
    setActioningFile(fileName);
    const slot = backupSlots.find((s) => s.fileName === fileName);
    const progress = startBackupProgress('restore', fileName, Number(slot?.sizeBytes) || 0);
    try {
      const result = await restoreRecordVaultTutaDriveEncryptedBackup(undefined, fileName, {
        onProgress: progress.update
      });
      const count = Number(result?.restoredFiles) || 0;
      progress.addInfo({ restoredFiles: count });
      progress.update({ stage: 'refresh', percent: 95 });
      refreshVaultTree();
      await onRestored?.(result);
      progress.update({ stage: 'done', percent: 100 });
      const elapsedText = formatDurationSec((Date.now() - progress.base.startedAt) / 1000);
      setSuccess(
        `Restored ${count} file${count === 1 ? '' : 's'} to TutaDrive in ${elapsedText} (decrypted with your Encrypt Password). Open TutaNotes again to load the restored notes.`
      );
      setSuccessTone('general');
    } catch (err) {
      setError(describeBackupRequestError(err, 'Restore failed'));
    } finally {
      setBusy(false);
      setActioningFile('');
      setBackupProgress(null);
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
      setError(describeBackupRequestError(err, 'Download failed'));
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
    try {
      const { isTutaDriveSealedBackupBytes } = await import('utils/recordVaultClientVaultCrypto');
      const head = new Uint8Array(await file.slice(0, 64).arrayBuffer());
      if (!isTutaDriveSealedBackupBytes(head)) {
        const unlocked = await ensureEncryptPasswordForBackupSeal('upload');
        if (!unlocked) return;
      }
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Unable to unlock Encrypt Password');
      return;
    }
    setBusy(true);
    setActioningFile(targetFileName || 'new-upload');
    const progress = startBackupProgress('upload', file.name, file.size, {
      targetName: mode === 'replace' ? targetFileName : ''
    });
    try {
      const result =
        mode === 'replace'
          ? await uploadRecordVaultTutaDriveStoredBackup(file, targetFileName, { onProgress: progress.update })
          : await uploadRecordVaultTutaDriveStoredBackup(file, undefined, { onProgress: progress.update });
      const uploadedName = result?.fileName || targetFileName || 'EncryptedBackup.zip';
      const sizeLabel = formatBackupZipSizeLabel(result?.sizeBytes);
      const sizeText = sizeLabel ? ` (${sizeLabel})` : '';
      await loadBackupList();
      progress.update({ stage: 'done', percent: 100, fileName: uploadedName });
      const elapsedText = formatDurationSec((Date.now() - progress.base.startedAt) / 1000);
      setSuccess(`Uploaded and saved ${uploadedName}${sizeText} in ${elapsedText}.`);
      setSuccessTone('general');
    } catch (err) {
      setError(describeBackupRequestError(err, 'Upload failed'));
    } finally {
      setBusy(false);
      setActioningFile('');
      setBackupProgress(null);
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
        const { readTutaDriveBackupHeader, tutaDriveBackupPasswordCheckFromHeader } = await import(
          'utils/recordVaultClientVaultCrypto'
        );
        const head = new Uint8Array(await file.slice(0, 64 * 1024 + 16).arrayBuffer());
        const parsed = readTutaDriveBackupHeader(head);
        const header = parsed?.format === 'TNBAK3' ? parsed.header : null;
        const result = await askBackupPassword({
          mode: 'restore',
          fileName: file.name,
          note: String(header?.note || ''),
          hint: String(header?.hint || ''),
          passwordCheck: tutaDriveBackupPasswordCheckFromHeader(header),
          warning: 'Restore replaces your current TutaDrive vault. You will need to open TutaNotes again afterward.'
        });
        if (!result) return;
        await prepareBackupDecryptWithPassword(result.password, 'restore');
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Unable to unlock Encrypt Password');
        return;
      }
    }
    setBusy(true);
    try {
      if (tutaDriveActive) {
        const progress = startBackupProgress('restoreLocal', file.name, file.size);
        const result = await restoreRecordVaultTutaDriveEncryptedBackup(file, undefined, {
          onProgress: progress.update
        });
        const count = Number(result?.restoredFiles) || 0;
        progress.addInfo({ restoredFiles: count });
        progress.update({ stage: 'refresh', percent: 95 });
        refreshVaultTree();
        await onRestored?.(result);
        const elapsedText = formatDurationSec((Date.now() - progress.base.startedAt) / 1000);
        setSuccess(
          `Restored ${count} file${count === 1 ? '' : 's'} to TutaDrive in ${elapsedText} (decrypted with your Encrypt Password). Open TutaNotes again to load the restored notes.`
        );
        setSuccessTone('general');
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
      setError(describeBackupRequestError(err, 'Restore failed'));
    } finally {
      setBusy(false);
      setBackupProgress(null);
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
        label={
          backupProgress
            ? (BACKUP_OPERATION_STEPS[backupProgress.operation] || BACKUP_OPERATION_STEPS.upload).title
            : tutaDriveActive
              ? 'Working on TutaDrive backup'
              : 'Working on OneDrive backup'
        }
        progressPercent={backupProgress ? backupProgress.percent : null}
        progressLabel={buildBackupProgressLabel(backupProgress, progressNowMs)}
        yellowPanel={Boolean(backupProgress)}
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
              ? 'Backup encrypts your TutaNote to cloud with any password you choose for each zip and stores the TutaCloud. You can save up to 3 zip file in TutaClouds. When all 3 slots are full, Backup or Upload overwrites the oldest slot (after you confirm).'
              : 'You can also download zip file to your local desktop download folder. You can also Restore or Upload & Restore (or Merge) to TutaNotes.'}
          </ColorTemplate16PopupCenterWide.SectionDescription>

          <Box sx={formatWarningBoxSx}>
            {tutaDriveActive
              ? 'Each backup zip can have its own password — it never leaves your browser. Only a password check and your hint are stored with the zip, so Restore / Merge can verify it. If you forget a zip password, that backup cannot be opened. Up to 3 backup zip files are kept. Before Format, run Backup first if you need to keep your notes.'
              : 'If you do not want to store your data on TutaCloud, before you select the "Format TutaNotes Cloud" button below, backup all your data first to a zip file on your storage. Click Backup/Encrypt TutaNote to Cloud. Once you have done that, you may use Format TutaNotes Cloud to delete your online data. Later, when you decide to restore your backup to OneDrive, choose Restore below.'}
          </Box>

          {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}

          <Stack spacing={1.5}>
            <Box sx={actionRowSx}>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => void handleBackup()}
                sx={actionButtonSx}
              >
                Backup/Encrypt TutaNote to Cloud
              </GreenButton>
              <GreenButton
                type="button"
                disabled={busy}
                onClick={() => void handleFormat()}
                sx={actionButtonSx}
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
                const labelBox = (
                  <Box sx={slot.empty ? backupRowLabelSx : { ...backupRowLabelSx, flex: 'none', minWidth: 0 }}>
                    <Box component="span">
                      {slot.rowNumber}) {label}
                    </Box>
                    {!slot.empty && slot.note ? (
                      <Box component="span" sx={backupRowNoteSx}>
                        (Note: {slot.note})
                      </Box>
                    ) : null}
                  </Box>
                );
                return (
                  <Box key={`backup-slot-${slot.rowNumber}`} sx={backupRowOuterSx}>
                    {slot.empty ? (
                      <Box sx={backupRowControlsSx}>
                        {labelBox}
                        {renderBackupRowActionButtons(slot)}
                      </Box>
                    ) : (
                      <>
                        {labelBox}
                        <Box sx={{ ...backupRowControlsSx, mt: 0.75 }}>
                          {renderBackupRowActionButtons(slot)}
                        </Box>
                      </>
                    )}
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
      <RecordVaultBackupPasswordDialog
        open={Boolean(passwordDialog)}
        mode={passwordDialog?.mode || 'backup'}
        fileName={passwordDialog?.fileName || ''}
        note={passwordDialog?.note || ''}
        hint={passwordDialog?.hint || ''}
        passwordCheck={passwordDialog?.passwordCheck || null}
        warning={passwordDialog?.warning || ''}
        onCancel={() => closePasswordDialog(null)}
        onConfirm={(result) => closePasswordDialog(result)}
      />
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
