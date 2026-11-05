import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import GreenButton from 'ui-component/GreenButton';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import { TUTACLOUD_VAULT_FOLDER_DEFAULT } from 'constants/tutaCloudVaultFolder';
import {
  createRecordVaultTutaDriveEncryptedBackup,
  downloadRecordVaultTutaDriveBackupZip,
  fetchRecordVaultStorageConfig,
  restoreRecordVaultTutaDriveBackupZip,
  restoreRecordVaultTutaDriveEncryptedBackup
} from 'api/recordVaultFe';
import { tutaNotesPostLoginActionButtonSx } from './tutaNotesPostLoginActionButtonSx';
import { themedAlert } from 'utils/themedDialog';
import { acquireOpenZipFile, acquireSaveZipFile } from 'utils/downloadZipFolder';
import {
  ensureEncryptPasswordForBackupSeal,
  prepareBackupDecryptWithPassword
} from 'utils/recordVaultBackupDecryptPrompt';
import RecordVaultBackupPasswordDialog from './RecordVaultBackupPasswordDialog';
import { tutaDriveBackupFileNamePreview } from 'utils/recordVaultBackupFileName';

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

const formatRedButtonSx = {
  ...actionButtonSx,
  bgcolor: 'var(--theme-error-color, #d32f2f) !important',
  color: '#fff !important'
};

function formatBackupZipSizeLabel(sizeBytes) {
  const bytes = Number(sizeBytes);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  return `${(bytes / (1024 * 1024)).toFixed(1)}mb`;
}

function describeBackupRequestError(err, fallback) {
  const apiError = err?.response?.data?.error;
  if (apiError) return apiError;
  const status = Number(err?.response?.status) || 0;
  if (status === 413) {
    return 'Server error 413: upload too large for the gateway limit. Try again or use a smaller vault.';
  }
  if (status === 502 || status === 503 || status === 504 || (status >= 520 && status <= 524)) {
    return (
      `Server error ${status}: the web server dropped or timed out the request. ` +
      'Please try again.'
    );
  }
  return err?.message || fallback;
}

function formatDurationSec(sec) {
  const n = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

const BACKUP_OPERATION_STEPS = {
  backup: {
    title: 'Backing up TutaNotes',
    steps: [
      ['build', 'Server zipping your notes'],
      ['seal', 'Encrypting the zip in your browser'],
      ['save', 'Saving to the folder you chose']
    ]
  },
  restoreLocal: {
    title: 'Restoring TutaNotes',
    steps: [
      ['read', 'Reading zip from your computer'],
      ['decrypt', 'Checking password and decrypting'],
      ['send', 'Sending vault to the server'],
      ['server', 'Server unpacking notes and attachments']
    ],
    serverWaitText: 'server is unpacking notes into your vault'
  }
};

function buildBackupProgressLabel(progress, nowMs) {
  if (!progress) return '';
  const op = BACKUP_OPERATION_STEPS[progress.operation] || BACKUP_OPERATION_STEPS.backup;
  const lines = [op.title];
  const step = op.steps.find(([key]) => key === progress.stage);
  if (step) lines.push(step[1]);
  if (progress.stage === 'server' && op.serverWaitText) {
    lines.push(`(${op.serverWaitText})`);
  }
  if (progress.sourceName) lines.push(`File: ${progress.sourceName}`);
  if (progress.fileName) lines.push(`Saved as ${progress.fileName}`);
  if (progress.startedAt && progress.percent >= 99) {
    lines.push(`Elapsed ${formatDurationSec((nowMs - progress.startedAt) / 1000)}`);
  }
  return lines.join('\n');
}

/**
 * Backup & Restore — encrypted zip on the member's computer only (Save As / Open file).
 * Vault data still lives on the server; this dialog no longer keeps backup slots in TutaCloud.
 */
export default function RecordVaultTutaCloudBackupDialog({
  open,
  onClose,
  folderName = TUTACLOUD_VAULT_FOLDER_DEFAULT,
  tutaDrive = false,
  onFormatted: _onFormatted,
  onRestored,
  requireBackupBeforeClose = false
}) {
  const fileInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tutaDriveActive, setTutaDriveActive] = useState(() => Boolean(tutaDrive));
  const [passwordDialog, setPasswordDialog] = useState(null);
  const [backupProgress, setBackupProgress] = useState(null);
  const [progressNowMs, setProgressNowMs] = useState(() => Date.now());
  const [requiredBackupDone, setRequiredBackupDone] = useState(false);
  const [exitReadyOpen, setExitReadyOpen] = useState(false);
  const backupLocked = requireBackupBeforeClose && !requiredBackupDone;

  useEffect(() => {
    if (open) {
      setRequiredBackupDone(false);
      setExitReadyOpen(false);
    }
  }, [open]);

  useEffect(() => {
    if (!backupProgress) return undefined;
    setProgressNowMs(Date.now());
    const timer = setInterval(() => setProgressNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [backupProgress]);

  useEffect(() => {
    if (!open) return undefined;
    setTutaDriveActive(Boolean(tutaDrive));
    let cancelled = false;
    void (async () => {
      try {
        const cfg = await fetchRecordVaultStorageConfig().catch(() => null);
        if (!cancelled && (cfg?.tutaDrive || tutaDrive)) setTutaDriveActive(true);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tutaDrive]);

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

  const resetMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    if (busy) return;
    resetMessages();
    onClose?.();
  };

  const handleExitAfterBackup = () => {
    resetMessages();
    onClose?.('exit');
  };

  const announceRestoreSuccessThenRedirect = async (zipFileName, result) => {
    setBusy(false);
    setBackupProgress(null);
    await themedAlert(`Restore zip ${zipFileName} success`, { title: 'Restore complete' });
    await onRestored?.(result);
  };

  const handleBackup = async () => {
    resetMessages();
    let backupInput = null;
    let saveTarget = null;

    if (tutaDriveActive) {
      backupInput = await askBackupPassword({ mode: 'backup' });
      if (!backupInput) return;
      if (!backupInput.password) {
        try {
          if (!(await ensureEncryptPasswordForBackupSeal('backup'))) return;
        } catch (err) {
          setError(err?.message || 'Unable to unlock Encrypt Password');
          return;
        }
      }
      saveTarget = await acquireSaveZipFile(
        tutaDriveBackupFileNamePreview(backupInput.note, backupInput.dateStamp)
      );
      if (saveTarget?.cancelled) return;
    }

    setBusy(true);
    const progress = startBackupProgress(
      'backup',
      saveTarget?.name || tutaDriveBackupFileNamePreview(backupInput?.note, backupInput?.dateStamp),
      0
    );
    try {
      if (tutaDriveActive) {
        const result = await createRecordVaultTutaDriveEncryptedBackup(backupInput.note, {
          hint: backupInput.hint,
          dateStamp: backupInput.dateStamp,
          password: backupInput.password,
          onProgress: progress.update,
          saveTarget
        });
        const sizeText = formatBackupZipSizeLabel(result?.sizeBytes);
        progress.update({ stage: 'done', percent: 100, fileName: result?.fileName });
        const elapsedText = formatDurationSec((Date.now() - progress.base.startedAt) / 1000);
        setSuccess(
          `Saved ${result?.fileName || 'backup.zip'}${sizeText ? ` (${sizeText})` : ''} in ${elapsedText}.`
        );
      } else {
        progress.update({ stage: 'build', percent: 50 });
        const result = await downloadRecordVaultTutaDriveBackupZip();
        progress.update({ stage: 'done', percent: 100, fileName: result?.fileName });
        setSuccess(`Downloaded ${result?.fileName || 'backup.zip'} to your browser download folder.`);
      }
      setRequiredBackupDone(true);
      if (requireBackupBeforeClose) setExitReadyOpen(true);
    } catch (err) {
      setError(describeBackupRequestError(err, 'Backup failed'));
    } finally {
      setBusy(false);
      setBackupProgress(null);
    }
  };

  const runRestoreWithFile = async (file) => {
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
          warning: 'Restore replaces your current vault. Open TutaNotes again afterward.'
        });
        if (!result) return;
        await prepareBackupDecryptWithPassword(result.password, 'restore');
      } catch (err) {
        setError(err?.response?.data?.error || err?.message || 'Unable to unlock backup password');
        return;
      }
    }

    setBusy(true);
    const progress = startBackupProgress('restoreLocal', file.name, file.size);
    try {
      if (tutaDriveActive) {
        const result = await restoreRecordVaultTutaDriveEncryptedBackup(file, undefined, {
          onProgress: progress.update
        });
        progress.update({ stage: 'done', percent: 100 });
        await announceRestoreSuccessThenRedirect(file.name, result);
      } else {
        const result = await restoreRecordVaultTutaDriveBackupZip(file);
        progress.update({ stage: 'done', percent: 100 });
        setSuccess(
          `Restored ${Number(result?.restoredFiles) || 0} file(s) to ${folderName}. Open TutaNotes again.`
        );
        await announceRestoreSuccessThenRedirect(file.name, result);
      }
    } catch (err) {
      setError(describeBackupRequestError(err, 'Restore failed'));
    } finally {
      setBusy(false);
      setBackupProgress(null);
    }
  };

  const handleRestoreClick = async () => {
    if (busy || backupLocked) return;
    const picked = await acquireOpenZipFile();
    if (picked?.cancelled) return;
    if (picked?.file) {
      await runRestoreWithFile(picked.file);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleRestoreFileInput = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    void runRestoreWithFile(file);
  };

  return (
    <>
      <BusyHourglassOverlay
        open={open && busy}
        label={
          backupProgress
            ? (BACKUP_OPERATION_STEPS[backupProgress.operation] || BACKUP_OPERATION_STEPS.backup).title
            : 'Working…'
        }
        progressPercent={backupProgress ? backupProgress.percent : null}
        progressLabel={buildBackupProgressLabel(backupProgress, progressNowMs)}
        yellowPanel={Boolean(backupProgress)}
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".zip,application/octet-stream,application/zip"
        hidden
        onChange={handleRestoreFileInput}
      />
      <ColorTemplate16PopupCenterWide
        open={open}
        onClose={handleClose}
        closeOnBackdrop={!busy && !backupLocked}
        closeButtonDisabled={busy}
        closeButtonAriaLabel={backupLocked ? 'Close without leaving TutaNotes' : 'Close popup'}
      >
        <ColorTemplate16PopupCenterWide.Title>Backup &amp; Restore TutaNotes</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.SectionDescription sx={{ mb: 0, textAlign: 'center' }}>
            Backup saves an encrypted zip to a folder you choose. Restore loads a zip you pick from your computer.
            Your browser remembers the last folder when it supports Save As / Open file dialogs.
          </ColorTemplate16PopupCenterWide.SectionDescription>

          {backupLocked ? (
            <ColorTemplate16PopupCenterWide.ErrorBar>
              Your notes changed since the last backup. Click Backup before leaving, or Skip backup &amp; Exit. X
              keeps you in TutaNotes until you back up.
            </ColorTemplate16PopupCenterWide.ErrorBar>
          ) : null}
          {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}
          {success ? (
            <ColorTemplate16PopupCenterWide.SectionDescription sx={{ textAlign: 'center', fontWeight: 700 }}>
              {success}
            </ColorTemplate16PopupCenterWide.SectionDescription>
          ) : null}

          <Stack spacing={1.5}>
            <Box sx={actionRowSx}>
              <GreenButton type="button" disabled={busy} onClick={() => void handleBackup()} sx={actionButtonSx}>
                Backup
              </GreenButton>
              <GreenButton
                type="button"
                disabled={busy || backupLocked}
                onClick={() => void handleRestoreClick()}
                sx={actionButtonSx}
              >
                Restore
              </GreenButton>
              {backupLocked ? (
                <GreenButton type="button" disabled={busy} onClick={handleExitAfterBackup} sx={formatRedButtonSx}>
                  Skip backup &amp; Exit
                </GreenButton>
              ) : null}
            </Box>
          </Stack>
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
      <ColorTemplate16PopupCenterWide
        open={Boolean(open && exitReadyOpen)}
        onClose={() => setExitReadyOpen(false)}
        closeOnBackdrop={false}
        bodyTextAlignLeft={false}
        centeredLeadLines={0}
        overlaySx={{ zIndex: 39000 }}
        closeButtonAriaLabel="Stay in Backup & Restore"
      >
        <ColorTemplate16PopupCenterWide.Title>Backup complete</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.BodyText>Zip saved — you can exit now.</ColorTemplate16PopupCenterWide.BodyText>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <GreenButton type="button" onClick={handleExitAfterBackup} sx={actionButtonSx}>
              Exit
            </GreenButton>
          </Box>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}

RecordVaultTutaCloudBackupDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  folderName: PropTypes.string,
  tutaDrive: PropTypes.bool,
  onFormatted: PropTypes.func,
  onRestored: PropTypes.func,
  requireBackupBeforeClose: PropTypes.bool
};
