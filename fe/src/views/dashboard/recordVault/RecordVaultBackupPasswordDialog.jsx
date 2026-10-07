import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { verifyEncryptPasswordInTab } from 'utils/recordVaultBackupDecryptPrompt';
import { verifyTutaDriveBackupPassword } from 'utils/recordVaultClientVaultCrypto';
import {
  TUTADRIVE_BACKUP_HINT_MAX_LEN,
  TUTADRIVE_BACKUP_NOTE_MAX_LEN,
  tutaDriveBackupDateStamp,
  tutaDriveBackupFileNamePreview
} from 'utils/recordVaultBackupFileName';

const MODE_CONFIRM_LABEL = { backup: 'Backup', restore: 'Restore', merge: 'Merge', open: 'Open' };
const MODE_TITLE = { backup: 'Backup note', restore: 'Restore backup', merge: 'Merge backup', open: 'Open backup' };

const readOnlyValueSx = { fontWeight: 600, wordBreak: 'break-all', lineHeight: 1.35 };
const helperTextSx = { fontWeight: 500, lineHeight: 1.35 };
const verifiedTextSx = { fontWeight: 700, color: '#1b7a2e !important', WebkitTextFillColor: '#1b7a2e !important' };

/**
 * TutaDrive backup password screen — same layout for Backup and Restore / Merge / Open.
 * Backup: any new password for this zip (nothing to verify yet); note + hint editable.
 * Restore / Merge / Open: note + hint read-only; the typed password is checked against the zip's
 * stored verifier (`passwordCheck`), or against the Encrypt Password for older backups without one.
 * Resolves via onConfirm({ note, hint, password, dateStamp }).
 */
export default function RecordVaultBackupPasswordDialog({
  open,
  mode = 'backup',
  fileName = '',
  note = '',
  hint = '',
  passwordCheck = null,
  warning = '',
  onCancel,
  onConfirm
}) {
  const isBackup = mode === 'backup';
  const zipHasOwnPassword = Boolean(passwordCheck?.verifierB64);
  const [noteValue, setNoteValue] = useState('');
  const [hintValue, setHintValue] = useState('');
  const [password, setPassword] = useState('');
  const [verifiedPassword, setVerifiedPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [dateStamp, setDateStamp] = useState(() => tutaDriveBackupDateStamp());

  useEffect(() => {
    if (!open) return;
    setNoteValue(isBackup ? '' : String(note || ''));
    setHintValue(isBackup ? '' : String(hint || ''));
    setPassword('');
    setVerifiedPassword('');
    setVerifying(false);
    setError('');
    setDateStamp(tutaDriveBackupDateStamp());
  }, [open, isBackup, note, hint]);

  const verified = Boolean(password) && password === verifiedPassword;

  const verify = async () => {
    if (verified) return true;
    const typed = password.trim();
    if (!typed) {
      setError(zipHasOwnPassword ? 'Enter the password for this backup zip' : 'Enter your Encrypt Password');
      return false;
    }
    // Paint "Verifying…" before Argon2 KDF blocks the main thread.
    flushSync(() => {
      setVerifying(true);
      setError('');
    });
    try {
      if (zipHasOwnPassword) {
        await verifyTutaDriveBackupPassword(typed, passwordCheck);
      } else {
        await verifyEncryptPasswordInTab(typed);
      }
      setVerifiedPassword(password);
      return true;
    } catch (err) {
      setVerifiedPassword('');
      setError(err?.response?.data?.error || err?.message || 'Unable to verify password');
      return false;
    } finally {
      setVerifying(false);
    }
  };

  const confirm = async () => {
    if (verifying) return;
    if (isBackup) {
      if (!password.trim()) {
        setError('Enter a password for this backup zip');
        return;
      }
    } else {
      const ok = await verify();
      if (!ok) return;
    }
    onConfirm?.({
      note: noteValue.trim().slice(0, TUTADRIVE_BACKUP_NOTE_MAX_LEN),
      hint: hintValue.trim().slice(0, TUTADRIVE_BACKUP_HINT_MAX_LEN),
      password: password.trim(),
      dateStamp
    });
  };

  const cancel = () => {
    if (verifying) return;
    onCancel?.();
  };

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={cancel}
      closeOnBackdrop={false}
      bodyTextAlignLeft={false}
      centeredLeadLines={0}
      overlaySx={{ zIndex: 39000 }}
      closeButtonAriaLabel="Close backup password dialog"
    >
      <ColorTemplate16PopupCenterWide.Title>{MODE_TITLE[mode] || MODE_TITLE.backup}</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={1.5} sx={{ textAlign: 'left' }}>
        {warning ? (
          <ColorTemplate16PopupCenterWide.BodyText sx={{ whiteSpace: 'pre-wrap', fontWeight: 700 }}>
            {warning}
          </ColorTemplate16PopupCenterWide.BodyText>
        ) : null}

        <ColorTemplate16PopupCenterWide.FormRows>
          <ColorTemplate16PopupCenterWide.FormRow label="Note:">
            {isBackup ? (
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <ColorTemplate16PopupCenterWide.Input
                  formRow
                  autoFocus
                  value={noteValue}
                  onChange={(e) => setNoteValue(e.target.value.slice(0, TUTADRIVE_BACKUP_NOTE_MAX_LEN))}
                  inputProps={{ maxLength: TUTADRIVE_BACKUP_NOTE_MAX_LEN, autoComplete: 'off' }}
                />
                <ColorTemplate16PopupCenterWide.BodyText sx={helperTextSx}>
                  (Keep it short &lt;20 characters since it will be append to result zip file name)
                </ColorTemplate16PopupCenterWide.BodyText>
              </Box>
            ) : (
              <ColorTemplate16PopupCenterWide.BodyText sx={readOnlyValueSx}>
                {noteValue || '(none)'}
              </ColorTemplate16PopupCenterWide.BodyText>
            )}
          </ColorTemplate16PopupCenterWide.FormRow>

          <ColorTemplate16PopupCenterWide.FormRow label={isBackup ? 'Zip file output:' : 'Zip file:'}>
            <ColorTemplate16PopupCenterWide.BodyText sx={readOnlyValueSx}>
              {isBackup ? tutaDriveBackupFileNamePreview(noteValue, dateStamp) : fileName}
            </ColorTemplate16PopupCenterWide.BodyText>
          </ColorTemplate16PopupCenterWide.FormRow>

          <ColorTemplate16PopupCenterWide.FormRow label="Encrypt Password:">
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
              <ColorTemplate16PopupCenterWide.Input
                formRow
                autoFocus={!isBackup}
                type="password"
                placeholder={
                  isBackup ? 'Any new password for this zip' : zipHasOwnPassword ? 'Password of this zip' : 'Your Encrypt Password'
                }
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void confirm();
                  }
                }}
                inputProps={{ autoComplete: isBackup ? 'new-password' : 'current-password' }}
              />
              {!isBackup ? (
                <ColorTemplate16PopupCenterWide.ActionButton
                  type="button"
                  disabled={!password || verifying || verified}
                  onClick={() => void verify()}
                >
                  {verifying ? 'Verifying…' : zipHasOwnPassword ? 'Verify Password' : 'Verify Encrypt Password'}
                </ColorTemplate16PopupCenterWide.ActionButton>
              ) : null}
              {verified ? (
                <ColorTemplate16PopupCenterWide.BodyText sx={verifiedTextSx}>✓ Verified</ColorTemplate16PopupCenterWide.BodyText>
              ) : null}
            </Box>
          </ColorTemplate16PopupCenterWide.FormRow>

          <ColorTemplate16PopupCenterWide.FormRow label="Hint:">
            {isBackup ? (
              <ColorTemplate16PopupCenterWide.Input
                formRow
                fullWidth
                placeholder="Optional — shown when Restore / Merge asks for this password"
                value={hintValue}
                onChange={(e) => setHintValue(e.target.value.slice(0, TUTADRIVE_BACKUP_HINT_MAX_LEN))}
                inputProps={{ maxLength: TUTADRIVE_BACKUP_HINT_MAX_LEN, autoComplete: 'off' }}
              />
            ) : (
              <ColorTemplate16PopupCenterWide.BodyText sx={readOnlyValueSx}>
                {hintValue || '(no hint saved)'}
              </ColorTemplate16PopupCenterWide.BodyText>
            )}
          </ColorTemplate16PopupCenterWide.FormRow>
        </ColorTemplate16PopupCenterWide.FormRows>

        {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}

        <Stack direction="row" spacing={1.5} justifyContent="flex-start" flexWrap="wrap" sx={{ width: '100%', pt: 0.5 }}>
          <ColorTemplate16PopupCenterWide.ActionButton type="button" disabled={verifying} onClick={cancel}>
            Cancel
          </ColorTemplate16PopupCenterWide.ActionButton>
          <ColorTemplate16PopupCenterWide.ActionButton type="button" disabled={verifying || !password} onClick={() => void confirm()}>
            {MODE_CONFIRM_LABEL[mode] || MODE_CONFIRM_LABEL.backup}
          </ColorTemplate16PopupCenterWide.ActionButton>
        </Stack>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

RecordVaultBackupPasswordDialog.propTypes = {
  open: PropTypes.bool,
  mode: PropTypes.oneOf(['backup', 'restore', 'merge', 'open']),
  fileName: PropTypes.string,
  note: PropTypes.string,
  hint: PropTypes.string,
  passwordCheck: PropTypes.shape({
    kdfSaltB64: PropTypes.string,
    kdfMemKib: PropTypes.number,
    kdfTime: PropTypes.number,
    kdfParallelism: PropTypes.number,
    verifierB64: PropTypes.string
  }),
  warning: PropTypes.string,
  onCancel: PropTypes.func,
  onConfirm: PropTypes.func
};
