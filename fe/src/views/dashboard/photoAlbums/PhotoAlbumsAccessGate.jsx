import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import {
  clearPhotoAlbumsAccessFail,
  fetchPhotoAlbumsAccessStatus,
  fetchPhotoAlbumsE2eKeys,
  recordPhotoAlbumsAccessFail,
  savePhotoAlbumsE2eKeys,
  setPhotoAlbumsAccessPasswordHint,
  updatePhotoAlbumsE2eKeys
} from 'api/photoAlbumsFe';
import {
  createVaultKeyMaterial,
  rewrapDekForNewPassword,
  unlockVaultWithPassword
} from 'utils/photoAlbumsClientVaultCrypto';
import {
  clearPhotoAlbumsE2eSession,
  setPhotoAlbumsE2eSession
} from 'utils/photoAlbumsClientSession';
import PhotoAlbumsZeroKnowledgeNotice from './PhotoAlbumsZeroKnowledgeNotice';
import ColorTemplate12Underline from 'ui-component/ColorTemplate12Underline';
import { closeErrorPopup } from 'ui-component/ErrorPopup';

const MIN_VAULT_PASSWORD_LEN = 8;

/** Hint/password fields + buttons — 50vw column; inputs and buttons stay inside. */
const vaultFormControlsColumnSx = {
  width: '50vw',
  maxWidth: '100%',
  alignSelf: 'flex-start',
  boxSizing: 'border-box',
  '& .MuiTextField-root.color-template7-popup-form-row-input-stretch': {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flex: '1 1 auto'
  }
};

const vaultFormRowsSx = {
  rowGap: 1,
  width: '100%'
};

/** Action buttons sit in the FormRows control column (same width as inputs). */
const vaultActionButtonControlsSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 1,
  minWidth: 0,
  width: '100%',
  '& .MuiButton-root': {
    width: '100%'
  }
};

const vaultActionButtonFormRowLabelSx = {
  visibility: 'hidden',
  height: 0,
  minHeight: 0,
  p: 0,
  m: 0,
  overflow: 'hidden',
  lineHeight: 0
};

const vaultHintInputSx = {
  '& .MuiInputBase-input': {
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important'
  }
};

function vaultPasswordReady(password, confirm) {
  const pwd = String(password ?? '');
  const conf = String(confirm ?? '');
  return pwd.length >= MIN_VAULT_PASSWORD_LEN && pwd === conf;
}

function normalizeStorageType(storageType) {
  return storageType === 'usb' ? 'usb' : 'onedrive';
}

/** Fail bar — TutaPhoto has no cooldown / auto-format (unlike TutaNotes). */
const PHOTO_ALBUMS_WRONG_PASSWORD_ERROR = 'Incorrect Encrypt password, please try again';

/**
 * Shared vault-password popup for Open TutaPhotoAlbums Cloud and Open TutaPhotoAlbums USB.
 * Yellow E2E: password → KEK → DEK in the browser; server stores salt + wrapped DEK only.
 *
 * Wrong password: simple retry message only (no cooldown, no auto-format).
 */
export default function PhotoAlbumsAccessGate({
  open,
  onUnlocked,
  onClose,
  storageType = 'onedrive',
  usbMountPath = '',
  onVaultFormatted: _onVaultFormatted,
  skipEncryptGate = false
}) {
  const side = normalizeStorageType(storageType);
  const [configured, setConfigured] = useState(false);
  const [vaultRow, setVaultRow] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [changeCurrentPassword, setChangeCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hint, setHint] = useState('');
  const [newHint, setNewHint] = useState('');
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!open) {
      setChecking(true);
      setBusy(false);
      return undefined;
    }
    // SKIP_TUTAPHOTO_ENC — never show Full Disk Encryption; proceed as unlocked.
    if (skipEncryptGate) {
      setChecking(false);
      onUnlocked?.();
      return undefined;
    }
    closeErrorPopup();
    let cancelled = false;
    setCurrentPassword('');
    setChangeCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setHint('');
    setNewHint('');
    setChangePasswordOpen(false);
    setError('');
    setChecking(true);
    void (async () => {
      try {
        const [e2e, accessStatus] = await Promise.all([
          fetchPhotoAlbumsE2eKeys(),
          fetchPhotoAlbumsAccessStatus().catch(() => null)
        ]);
        if (cancelled) return;
        if (accessStatus?.skipPasswordCheck) {
          onUnlocked?.();
          return;
        }
        setConfigured(Boolean(e2e.configured));
        setVaultRow(e2e.vault || null);
        setHint(accessStatus?.hint || '');
        setNewHint(accessStatus?.hint || '');
      } catch (err) {
        if (!cancelled) {
          setError(err?.response?.data?.error || err?.message || 'Unable to load vault access status');
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, side, skipEncryptGate, onUnlocked]);

  const persistHint = async (nextHint = hint) => {
    try {
      await setPhotoAlbumsAccessPasswordHint(String(nextHint ?? '').trim());
    } catch {
      // Hint is optional / non-secret; do not block unlock.
    }
  };

  const handleVerifyVaultPassword = async () => {
    const value = currentPassword.trim();
    if (!value) {
      setError('Enter your Encrypt Password');
      return;
    }
    if (!vaultRow?.kdfSaltB64 || !vaultRow?.wrappedDekB64) {
      setError('Vault key material missing — set a Encrypt Password first');
      return;
    }
    // Paint hourglass before Argon2 KDF blocks the main thread.
    flushSync(() => {
      setBusy(true);
      setError('');
    });
    try {
      // Password stays in the browser — never POSTed to the server.
      const { dek, dekRaw } = await unlockVaultWithPassword(vaultRow, value);
      setPhotoAlbumsE2eSession({ dek, dekRaw, vault: vaultRow });
      await clearPhotoAlbumsAccessFail(side).catch(() => null);
      await persistHint();
      // Proceed to the pending OneDrive / USB open flow (icon unlock).
      onUnlocked?.();
    } catch (err) {
      clearPhotoAlbumsE2eSession();
      try {
        const failStatus = await recordPhotoAlbumsAccessFail({
          storageType: side,
          mountPath: side === 'usb' ? usbMountPath : undefined
        });
        setError(failStatus?.error || PHOTO_ALBUMS_WRONG_PASSWORD_ERROR);
      } catch (failErr) {
        setError(
          failErr?.response?.data?.error ||
            err?.message ||
            PHOTO_ALBUMS_WRONG_PASSWORD_ERROR
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSetNewVaultPassword = async () => {
    const priorPassword = changeCurrentPassword.trim();
    const nextPassword = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (!priorPassword) {
      setError('Enter your current Encrypt Password');
      return;
    }
    if (!vaultPasswordReady(nextPassword, confirm)) {
      setError(
        nextPassword.length < MIN_VAULT_PASSWORD_LEN
          ? `Encrypt Password must be at least ${MIN_VAULT_PASSWORD_LEN} characters`
          : 'Password confirmation does not match'
      );
      return;
    }
    if (!vaultRow?.kdfSaltB64 || !vaultRow?.wrappedDekB64) {
      setError('Vault key material missing — set a Encrypt Password first');
      return;
    }
    // Paint hourglass before Argon2 KDF blocks the main thread.
    flushSync(() => {
      setBusy(true);
      setError('');
    });
    try {
      // Unlock with current password from the change box (not the top verify field).
      const { dekRaw } = await unlockVaultWithPassword(vaultRow, priorPassword);
      const keyPayload = await rewrapDekForNewPassword(dekRaw, nextPassword);
      const result = await updatePhotoAlbumsE2eKeys({
        ...keyPayload,
        backends: ['usb', 'onedrive']
      });
      const nextVault = result?.vault || vaultRow;
      setVaultRow(nextVault);
      setConfigured(true);

      const hintToSave = String(newHint ?? '').trim();
      await persistHint(hintToSave);
      setHint(hintToSave);
      await clearPhotoAlbumsAccessFail(side).catch(() => null);

      // Close change box; clear session so user must Verify Encrypt Password again with the new password.
      clearPhotoAlbumsE2eSession();
      setCurrentPassword('');
      setChangePasswordOpen(false);
      setChangeCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      clearPhotoAlbumsE2eSession();
      const msg = err?.response?.data?.error || err?.message || 'Unable to change Encrypt Password';
      setError(msg === 'Incorrect Encrypt Password' ? 'Incorrect current Encrypt password' : msg);
    } finally {
      setBusy(false);
    }
  };

  const handleSetVaultPassword = async () => {
    const value = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (!vaultPasswordReady(value, confirm)) {
      setError(
        value.length < MIN_VAULT_PASSWORD_LEN
          ? `Encrypt Password must be at least ${MIN_VAULT_PASSWORD_LEN} characters`
          : 'Password confirmation does not match'
      );
      return;
    }
    // Paint hourglass before Argon2 KDF blocks the main thread.
    flushSync(() => {
      setBusy(true);
      setError('');
    });
    try {
      // Client: password → KEK → wrap DEK. Server gets salt + wrapped DEK only.
      const { dek, dekRaw, createPayload } = await createVaultKeyMaterial(value);
      const result = await savePhotoAlbumsE2eKeys(createPayload);
      setPhotoAlbumsE2eSession({ dek, dekRaw, vault: result?.vault || null });
      setConfigured(true);
      setVaultRow(result?.vault || null);
      await clearPhotoAlbumsAccessFail(side).catch(() => null);
      await persistHint();
      onUnlocked?.();
    } catch (err) {
      clearPhotoAlbumsE2eSession();
      setError(err?.response?.data?.error || err?.message || 'Unable to set Encrypt Password');
    } finally {
      setBusy(false);
    }
  };

  const setPasswordReady = vaultPasswordReady(newPassword, confirmPassword);
  const inputsLocked = busy;

  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const hintRow = (
    <ColorTemplate16PopupCenterWide.FormRow label="Hint:">
      <ColorTemplate16PopupCenterWide.Input
        formRow
        fullWidth
        value={hint}
        onChange={(e) => setHint(e.target.value.slice(0, 200))}
        placeholder="Reminder for you (optional)"
        inputProps={{ maxLength: 200 }}
        sx={vaultHintInputSx}
        disabled={inputsLocked}
      />
    </ColorTemplate16PopupCenterWide.FormRow>
  );

  /** First-time setup: two password fields (no verify step yet). */
  const firstTimePasswordRows = (
    <>
      <ColorTemplate16PopupCenterWide.FormRow label="Encrypt Password:">
        <ColorTemplate16PopupCenterWide.Input
          formRow
          fullWidth
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Encrypt Password"
          type="password"
          autoComplete="new-password"
          disabled={inputsLocked}
        />
      </ColorTemplate16PopupCenterWide.FormRow>
      <ColorTemplate16PopupCenterWide.FormRow label="Password again:">
        <ColorTemplate16PopupCenterWide.Input
          formRow
          fullWidth
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          type="password"
          autoComplete="new-password"
          disabled={inputsLocked}
        />
      </ColorTemplate16PopupCenterWide.FormRow>
    </>
  );

  const vaultActionButtonRow = (buttons) => (
    <ColorTemplate16PopupCenterWide.FormRow
      label=" "
      labelSx={vaultActionButtonFormRowLabelSx}
      controlsSx={vaultActionButtonControlsSx}
    >
      {buttons}
    </ColorTemplate16PopupCenterWide.FormRow>
  );

  /** Hint + change-password link always visible; panel reveals on link click. */
  const changePasswordSection = (
    <Stack spacing={1} sx={{ width: '100%', mt: 1 }}>
      <ColorTemplate16PopupCenterWide.FormRows sx={vaultFormRowsSx}>
        {hintRow}
      </ColorTemplate16PopupCenterWide.FormRows>

      <ColorTemplate12Underline
        onClick={() => {
          if (inputsLocked) return;
          setChangePasswordOpen((open) => {
            if (!open) setNewHint(hint);
            return !open;
          });
        }}
        disabled={inputsLocked}
        sx={{
          alignSelf: 'flex-start',
          textAlign: 'left',
          fontWeight: 700,
          fontSize: 'inherit',
          fontFamily: 'inherit',
          ...(inputsLocked ? { opacity: 0.5, pointerEvents: 'none' } : null)
        }}
      >
        Click here if you wish to change encryption password
      </ColorTemplate12Underline>

      {changePasswordOpen ? (
        <Box
          sx={{
            width: '100%',
            boxSizing: 'border-box',
            border: '2px solid #000',
            borderRadius: 1,
            bgcolor: 'rgba(255,255,255,0.45)',
            px: { xs: 1, sm: 1.25 },
            py: 1.25
          }}
        >
          <ColorTemplate16PopupCenterWide.FormRows sx={vaultFormRowsSx}>
            <ColorTemplate16PopupCenterWide.FormRow label="Current Encrypt Password:">
              <ColorTemplate16PopupCenterWide.Input
                formRow
                fullWidth
                value={changeCurrentPassword}
                onChange={(e) => setChangeCurrentPassword(e.target.value)}
                placeholder="Current password"
                type="password"
                autoComplete="current-password"
                disabled={inputsLocked}
              />
            </ColorTemplate16PopupCenterWide.FormRow>
            <ColorTemplate16PopupCenterWide.FormRow label="New Encrypt Password:">
              <ColorTemplate16PopupCenterWide.Input
                formRow
                fullWidth
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New vault access pass"
                type="password"
                autoComplete="new-password"
                disabled={inputsLocked}
              />
            </ColorTemplate16PopupCenterWide.FormRow>
            <ColorTemplate16PopupCenterWide.FormRow label="New Password again:">
              <ColorTemplate16PopupCenterWide.Input
                formRow
                fullWidth
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                type="password"
                autoComplete="new-password"
                disabled={inputsLocked}
              />
            </ColorTemplate16PopupCenterWide.FormRow>
            <ColorTemplate16PopupCenterWide.FormRow label="New Hint:">
              <ColorTemplate16PopupCenterWide.Input
                formRow
                fullWidth
                value={newHint}
                onChange={(e) => setNewHint(e.target.value.slice(0, 200))}
                placeholder="Reminder for you (optional)"
                inputProps={{ maxLength: 200 }}
                sx={vaultHintInputSx}
                disabled={inputsLocked}
              />
            </ColorTemplate16PopupCenterWide.FormRow>
            {vaultActionButtonRow(
              <ColorTemplate16PopupCenterWide.ActionButton
                type="button"
                onClick={() => void handleSetNewVaultPassword()}
                disabled={inputsLocked}
              >
                Change Encrypt Password
              </ColorTemplate16PopupCenterWide.ActionButton>
            )}
          </ColorTemplate16PopupCenterWide.FormRows>
        </Box>
      ) : null}
    </Stack>
  );

  return (
    <>
      <BusyHourglassOverlay
        open={Boolean(open) && !skipEncryptGate && (checking || busy)}
        label={
          checking
            ? 'Checking vault access…'
            : changePasswordOpen
              ? 'Updating Encrypt Password…'
              : configured
                ? 'Verifying Encrypt Password…'
                : 'Setting Encrypt Password…'
        }
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
      />
      <ColorTemplate16PopupCenterWide
      open={Boolean(open) && !skipEncryptGate}
      onClose={handleClose}
      closeOnBackdrop={false}
      closeButtonDisabled={busy}
    >
      <ColorTemplate16PopupCenterWide.Title>Full Disk Encryption</ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body>
        <Stack spacing={2}>
          <PhotoAlbumsZeroKnowledgeNotice />

          {checking ? (
            <Typography>Checking vault access…</Typography>
          ) : configured ? (
            <Stack spacing={1.5}>
              <Typography sx={{ lineHeight: 1.5, fontWeight: 700 }}>
                Enter your current password and verify to continue.
              </Typography>
              <Typography sx={{ lineHeight: 1.5, fontWeight: 700 }}>
                Due to our maximum secure architecture, it is impossible to recover lost password. Creating
                new password will require erase/format TutaPhotoAlbums folder on OneDrive or USB.
              </Typography>

              <Box sx={vaultFormControlsColumnSx}>
                <ColorTemplate16PopupCenterWide.FormRows sx={vaultFormRowsSx}>
                  <ColorTemplate16PopupCenterWide.FormRow label="Encrypt Password:">
                    <ColorTemplate16PopupCenterWide.Input
                      formRow
                      fullWidth
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setChangePasswordOpen(false);
                      }}
                      placeholder="Encrypt Password"
                      type="password"
                      autoComplete="current-password"
                      disabled={busy}
                    />
                    <ColorTemplate16PopupCenterWide.ActionButton
                      type="button"
                      onClick={() => void handleVerifyVaultPassword()}
                      disabled={busy || !currentPassword.trim()}
                    >
                      Verify Encrypt Password
                    </ColorTemplate16PopupCenterWide.ActionButton>
                  </ColorTemplate16PopupCenterWide.FormRow>
                </ColorTemplate16PopupCenterWide.FormRows>
                {changePasswordSection}
              </Box>
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Typography sx={{ lineHeight: 1.5, fontWeight: 700 }}>
                Encrypt Password is <strong>OFF</strong>. Set a Encrypt Password to continue opening TutaPhotoAlbums
                Cloud or USB.
              </Typography>

              <Box sx={vaultFormControlsColumnSx}>
                <ColorTemplate16PopupCenterWide.FormRows sx={vaultFormRowsSx}>
                  {firstTimePasswordRows}
                  {hintRow}
                  {vaultActionButtonRow(
                    <ColorTemplate16PopupCenterWide.ActionButton
                      type="button"
                      disabled={inputsLocked || !setPasswordReady}
                      onClick={() => void handleSetVaultPassword()}
                    >
                      Set Encrypt Password
                    </ColorTemplate16PopupCenterWide.ActionButton>
                  )}
                </ColorTemplate16PopupCenterWide.FormRows>
              </Box>
            </Stack>
          )}

          {error ? (
            <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar>
          ) : null}
        </Stack>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
    </>
  );
}
