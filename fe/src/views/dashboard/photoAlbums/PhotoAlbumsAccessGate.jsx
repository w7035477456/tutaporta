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
  fetchPhotoAlbumsAccessFailStatus,
  fetchPhotoAlbumsAccessStatus,
  fetchPhotoAlbumsE2eKeys,
  recordPhotoAlbumsAccessFail,
  savePhotoAlbumsE2eKeys,
  setPhotoAlbumsAccessPasswordEnabled,
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
import { COLOR_TEMPLATE7_POPUP_ACTION_GREEN } from 'config/colorTemplate7PopupLargeDark';
import { formatRecordVaultUnlockCountdown } from 'utils/recordVaultUnlockCountdown';
import { useCompactLoginViewport } from 'config/compactLoginViewport';

const MIN_VAULT_PASSWORD_LEN = 8;

const SKIP_VERIFY_MESSAGE =
  'Please verify previous encrypt/decrypt password used, and password no longer needed next time.';

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

/** Two choice panels — border uses theme inverse-daynight so choices read clearly on any theme. */
const vaultChoiceBoxSx = {
  width: '100%',
  boxSizing: 'border-box',
  border: '2px solid var(--theme-inverse-daynight-color)',
  borderRadius: 1,
  px: { xs: 1, sm: 1.5 },
  py: 1.5
};

const vaultChoiceButtonRowSx = {
  width: '100%',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center'
};

/**
 * FDE choice buttons — literal #60C446 green (not --theme-action-green-color).
 * Minimal Palete remaps that CSS var to theme secondary (maroon), which made buttons match the panel.
 */
const vaultFdeActionButtonSx = {
  minWidth: { xs: '100%', sm: 320 },
  maxWidth: '100%',
  // Mobile: shrink label so “Skip Photo Encryption” / “Set Encrypt Password” fit the button.
  // GreenButton sets MOBILE_FONT_SIZE_BUTTON with !important — override only under 600px.
  '@media (max-width: 599.95px)': {
    fontSize: 'clamp(0.65rem, 3.2vw, 0.9rem) !important',
    px: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
  backgroundColor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  border: '1px solid #000000 !important',
  '&.Mui-disabled': {
    bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
    backgroundColor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
    color: '#000000 !important',
    WebkitTextFillColor: '#000000 !important',
    border: '1px solid #000000 !important',
    opacity: 0.45,
    cursor: 'not-allowed',
    pointerEvents: 'none'
  },
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`,
      backgroundColor: `${COLOR_TEMPLATE7_POPUP_ACTION_GREEN} !important`
    }
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

const PHOTO_ALBUMS_WRONG_PASSWORD_ERROR = 'Incorrect Encrypt password, please try again';
const PHOTO_ALBUMS_WRONG_CURRENT_PASSWORD_ERROR = 'Incorrect current Encrypt password';

function buildPhotoAlbumsCooldownError(wrongPasswordError, cooldownSeconds) {
  const countdown = formatRecordVaultUnlockCountdown(cooldownSeconds);
  return `${wrongPasswordError} Retry Cool Down ${countdown}.`;
}

/**
 * Shared vault-password popup for Open TutaPhotoAlbums Cloud and Open TutaPhotoAlbums USB.
 * Yellow E2E: password → KEK → DEK in the browser; server stores salt + wrapped DEK only.
 *
 * Always shown when opening Cloud/USB so the user can set a password or Skip Photo Encryption.
 * Skip persists per account; the screen still appears on every open (Skip again to proceed).
 */
export default function PhotoAlbumsAccessGate({
  open,
  onUnlocked,
  onClose,
  storageType = 'onedrive',
  usbMountPath = '',
  onVaultFormatted: _onVaultFormatted
}) {
  const isCompact = useCompactLoginViewport();
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
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [skipVerifyMode, setSkipVerifyMode] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [cooldownUntilMs, setCooldownUntilMs] = useState(0);
  const [cooldownWrongPasswordError, setCooldownWrongPasswordError] = useState(
    PHOTO_ALBUMS_WRONG_PASSWORD_ERROR
  );

  const applyFailStatus = useCallback((status) => {
    const remaining = Math.max(0, Math.floor(Number(status?.remainingSeconds) || 0));
    const wrongMsg = String(status?.error || '').startsWith(PHOTO_ALBUMS_WRONG_CURRENT_PASSWORD_ERROR)
      ? PHOTO_ALBUMS_WRONG_CURRENT_PASSWORD_ERROR
      : PHOTO_ALBUMS_WRONG_PASSWORD_ERROR;

    if (remaining > 0) {
      setCooldownWrongPasswordError(wrongMsg);
      setCooldownSeconds(remaining);
      const untilMs = status?.lockedUntil ? Date.parse(status.lockedUntil) : NaN;
      setCooldownUntilMs(
        Number.isFinite(untilMs) && untilMs > Date.now()
          ? untilMs
          : Date.now() + remaining * 1000
      );
      setError(buildPhotoAlbumsCooldownError(wrongMsg, remaining));
      return;
    }

    setCooldownSeconds(0);
    setCooldownUntilMs(0);
    setError(status?.error || wrongMsg);
  }, []);

  useEffect(() => {
    if (!open) {
      setChecking(true);
      setBusy(false);
      setCooldownSeconds(0);
      setCooldownUntilMs(0);
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
    setSkipVerifyMode(false);
    setError('');
    setChecking(true);
    void (async () => {
      try {
        const [e2e, accessStatus, failStatus] = await Promise.all([
          fetchPhotoAlbumsE2eKeys(),
          fetchPhotoAlbumsAccessStatus().catch(() => null),
          fetchPhotoAlbumsAccessFailStatus(side).catch(() => null)
        ]);
        if (cancelled) return;
        setEncryptionEnabled(accessStatus?.enabled !== false);
        setConfigured(Boolean(e2e.configured));
        setVaultRow(e2e.vault || null);
        setHint(accessStatus?.hint || '');
        setNewHint(accessStatus?.hint || '');
        if (failStatus?.remainingSeconds > 0) {
          applyFailStatus(failStatus);
        }
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
  }, [open, side, onUnlocked, applyFailStatus]);

  useEffect(() => {
    if (!open || cooldownUntilMs <= 0) return undefined;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const left = Math.max(0, Math.ceil((cooldownUntilMs - Date.now()) / 1000));
      setCooldownSeconds(left);
      if (left <= 0) {
        setCooldownUntilMs(0);
        setError('');
      }
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, cooldownUntilMs]);

  useEffect(() => {
    if (!open || cooldownSeconds <= 0) return;
    setError(buildPhotoAlbumsCooldownError(cooldownWrongPasswordError, cooldownSeconds));
  }, [open, cooldownSeconds, cooldownWrongPasswordError]);

  const persistHint = async (nextHint = hint) => {
    try {
      await setPhotoAlbumsAccessPasswordHint(String(nextHint ?? '').trim());
    } catch {
      // Hint is optional / non-secret; do not block unlock.
    }
  };

  const finishSkipEncryption = async (passwordForServer = '') => {
    await setPhotoAlbumsAccessPasswordEnabled(false, {
      password: passwordForServer || undefined
    });
    clearPhotoAlbumsE2eSession();
    onUnlocked?.();
  };

  const handleSkipPhotoEncryption = () => {
    if (busy) return;
    setError('');
    if (!encryptionEnabled) {
      clearPhotoAlbumsE2eSession();
      onUnlocked?.();
      return;
    }
    if (!configured) {
      flushSync(() => {
        setBusy(true);
        setError('');
      });
      void finishSkipEncryption()
        .then(() => {
          setEncryptionEnabled(false);
        })
        .catch((err) => {
          setError(err?.response?.data?.error || err?.message || 'Unable to skip photo encryption');
        })
        .finally(() => {
          setBusy(false);
        });
      return;
    }
    setSkipVerifyMode(true);
    setChangePasswordOpen(false);
    setCurrentPassword('');
  };

  const handleVerifyVaultPassword = async () => {
    const value = currentPassword.trim();
    if (!value) {
      setError('Enter your Encrypt Password');
      return;
    }
    if (cooldownSeconds > 0) {
      return;
    }
    if (!vaultRow?.kdfSaltB64 || !vaultRow?.wrappedDekB64) {
      setError('Vault key material missing — set a Encrypt Password first');
      return;
    }
    flushSync(() => {
      setBusy(true);
      setError('');
    });
    try {
      const { dek, dekRaw } = await unlockVaultWithPassword(vaultRow, value);
      if (skipVerifyMode) {
        await finishSkipEncryption(value);
        setEncryptionEnabled(false);
        return;
      }
      setPhotoAlbumsE2eSession({ dek, dekRaw, vault: vaultRow });
      await clearPhotoAlbumsAccessFail(side).catch(() => null);
      await persistHint();
      onUnlocked?.();
    } catch (err) {
      clearPhotoAlbumsE2eSession();
      try {
        const failStatus = await recordPhotoAlbumsAccessFail({
          storageType: side,
          mountPath: side === 'usb' ? usbMountPath : undefined
        });
        applyFailStatus(failStatus);
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
    if (cooldownSeconds > 0) {
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
    flushSync(() => {
      setBusy(true);
      setError('');
    });
    try {
      const { dekRaw } = await unlockVaultWithPassword(vaultRow, priorPassword);
      try {
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

        clearPhotoAlbumsE2eSession();
        setCurrentPassword('');
        setChangePasswordOpen(false);
        setChangeCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } catch (innerErr) {
        clearPhotoAlbumsE2eSession();
        setError(
          innerErr?.response?.data?.error ||
            innerErr?.message ||
            'Unable to change Encrypt Password'
        );
      }
    } catch {
      clearPhotoAlbumsE2eSession();
      try {
        const failStatus = await recordPhotoAlbumsAccessFail({
          storageType: side,
          mountPath: side === 'usb' ? usbMountPath : undefined,
          wrongPasswordKind: 'current'
        });
        applyFailStatus(failStatus);
      } catch (failErr) {
        setError(
          failErr?.response?.data?.error ||
            PHOTO_ALBUMS_WRONG_CURRENT_PASSWORD_ERROR
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSetVaultPassword = async () => {
    const value = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (cooldownSeconds > 0) {
      return;
    }
    if (!vaultPasswordReady(value, confirm)) {
      setError(
        value.length < MIN_VAULT_PASSWORD_LEN
          ? `Encrypt Password must be at least ${MIN_VAULT_PASSWORD_LEN} characters`
          : 'Password confirmation does not match'
      );
      return;
    }
    flushSync(() => {
      setBusy(true);
      setError('');
    });
    try {
      if (configured && vaultRow?.kdfSaltB64 && vaultRow?.wrappedDekB64) {
        try {
          const { dek, dekRaw } = await unlockVaultWithPassword(vaultRow, value);
          await setPhotoAlbumsAccessPasswordEnabled(true, { keepSessionUnlocked: true });
          setPhotoAlbumsE2eSession({ dek, dekRaw, vault: vaultRow });
          setEncryptionEnabled(true);
          await clearPhotoAlbumsAccessFail(side).catch(() => null);
          await persistHint();
          onUnlocked?.();
          return;
        } catch {
          clearPhotoAlbumsE2eSession();
          const failStatus = await recordPhotoAlbumsAccessFail({
            storageType: side,
            mountPath: side === 'usb' ? usbMountPath : undefined
          });
          applyFailStatus(failStatus);
          return;
        }
      }

      const { dek, dekRaw, createPayload } = await createVaultKeyMaterial(value);
      const result = await savePhotoAlbumsE2eKeys(createPayload);
      await setPhotoAlbumsAccessPasswordEnabled(true, { keepSessionUnlocked: true });
      setPhotoAlbumsE2eSession({ dek, dekRaw, vault: result?.vault || null });
      setConfigured(true);
      setVaultRow(result?.vault || null);
      setEncryptionEnabled(true);
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
  const verifyLocked = cooldownSeconds > 0;
  const inputsLocked = busy || verifyLocked;

  const handleClose = useCallback(() => {
    if (cooldownSeconds > 0) return;
    onClose?.();
  }, [onClose, cooldownSeconds]);

  const skipPhotoEncryptionButton = (
    <Box sx={vaultChoiceButtonRowSx}>
      <ColorTemplate16PopupCenterWide.ActionButton
        type="button"
        onClick={handleSkipPhotoEncryption}
        disabled={inputsLocked || skipVerifyMode || verifyLocked}
        sx={vaultFdeActionButtonSx}
      >
        Skip Photo Encryption
      </ColorTemplate16PopupCenterWide.ActionButton>
    </Box>
  );

  const skipPhotoEncryptionChoiceBox = (
    <Box sx={vaultChoiceBoxSx}>{skipPhotoEncryptionButton}</Box>
  );

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
          placeholder="Create Encrypt Password"
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
          placeholder="Confirm Encrypt Password"
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

  /** Hint + change-password link; panel reveals on link click. */
  const changePasswordSection = (
    <Stack spacing={1} sx={{ width: '100%', mt: changePasswordOpen ? 0 : 1 }}>
      {!changePasswordOpen ? (
        <ColorTemplate16PopupCenterWide.FormRows sx={vaultFormRowsSx}>
          {hintRow}
        </ColorTemplate16PopupCenterWide.FormRows>
      ) : null}

      <ColorTemplate12Underline
        onClick={() => {
          if (inputsLocked) return;
          setChangePasswordOpen((openPanel) => {
            if (!openPanel) setNewHint(hint);
            return !openPanel;
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
            border: '2px solid var(--theme-inverse-daynight-color)',
            borderRadius: 1,
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
                sx={vaultFdeActionButtonSx}
              >
                Change Encrypt Password
              </ColorTemplate16PopupCenterWide.ActionButton>
            )}
          </ColorTemplate16PopupCenterWide.FormRows>
        </Box>
      ) : null}
    </Stack>
  );

  const verifyPasswordSection = (
    <Box sx={vaultFormControlsColumnSx}>
      {!changePasswordOpen ? (
        <ColorTemplate16PopupCenterWide.FormRows sx={vaultFormRowsSx}>
          <ColorTemplate16PopupCenterWide.FormRow label="Encrypt Password:">
            <ColorTemplate16PopupCenterWide.Input
              formRow
              fullWidth
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Encrypt Password"
              type="password"
              autoComplete="current-password"
              disabled={busy || verifyLocked}
            />
            <ColorTemplate16PopupCenterWide.ActionButton
              type="button"
              onClick={() => void handleVerifyVaultPassword()}
              disabled={busy || verifyLocked || !currentPassword.trim()}
              sx={vaultFdeActionButtonSx}
            >
              Verify Encrypt Password
            </ColorTemplate16PopupCenterWide.ActionButton>
          </ColorTemplate16PopupCenterWide.FormRow>
        </ColorTemplate16PopupCenterWide.FormRows>
      ) : null}
      {!skipVerifyMode ? changePasswordSection : null}
    </Box>
  );

  return (
    <>
      <BusyHourglassOverlay
        open={Boolean(open) && (checking || busy)}
        label={
          checking
            ? 'Checking vault access…'
            : skipVerifyMode
              ? 'Disabling photo encryption…'
              : changePasswordOpen
                ? 'Updating Encrypt Password…'
                : configured && encryptionEnabled
                  ? 'Verifying Encrypt Password…'
                  : 'Setting Encrypt Password…'
        }
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
      />
      <ColorTemplate16PopupCenterWide
        open={Boolean(open)}
        onClose={handleClose}
        closeOnBackdrop={false}
        closeButtonDisabled={busy || verifyLocked}
      >
        <ColorTemplate16PopupCenterWide.Title>Full Disk Encryption</ColorTemplate16PopupCenterWide.Title>
        <ColorTemplate16PopupCenterWide.Body>
          <Stack spacing={2}>
            {isCompact ? null : <PhotoAlbumsZeroKnowledgeNotice />}

            {checking ? (
              <Typography>Checking vault access…</Typography>
            ) : skipVerifyMode ? (
              <Stack spacing={1.5}>
                <Typography sx={{ lineHeight: 1.5, fontWeight: 700 }}>{SKIP_VERIFY_MESSAGE}</Typography>
                {verifyPasswordSection}
              </Stack>
            ) : configured && encryptionEnabled ? (
              <Stack spacing={1.5}>
                {skipPhotoEncryptionChoiceBox}
                {!changePasswordOpen ? (
                  <>
                    <Typography sx={{ lineHeight: 1.5, fontWeight: 700 }}>
                      Enter your current password and verify to continue.
                    </Typography>
                    <Typography sx={{ lineHeight: 1.5, fontWeight: 700 }}>
                      Due to our maximum secure architecture, it is impossible to recover lost password. Creating
                      new password will require erase/format TutaPhotoAlbums folder on OneDrive or USB.
                    </Typography>
                  </>
                ) : null}
                {verifyPasswordSection}
              </Stack>
            ) : (
              <Stack spacing={1.5}>
                {skipPhotoEncryptionChoiceBox}

                <Box sx={vaultChoiceBoxSx}>
                  <Typography sx={{ lineHeight: 1.5, fontWeight: 700, mb: 1.5 }}>
                    Encrypt Password is <strong>OFF</strong>. Set a Encrypt Password to continue opening
                    TutaPhotoAlbums Cloud or USB.
                  </Typography>

                  <Box sx={{ ...vaultFormControlsColumnSx, width: '100%' }}>
                    <ColorTemplate16PopupCenterWide.FormRows sx={vaultFormRowsSx}>
                      {firstTimePasswordRows}
                      {hintRow}
                    </ColorTemplate16PopupCenterWide.FormRows>
                  </Box>

                  <Box sx={{ ...vaultChoiceButtonRowSx, mt: 1.5 }}>
                    <ColorTemplate16PopupCenterWide.ActionButton
                      type="button"
                      disabled={inputsLocked || !setPasswordReady}
                      onClick={() => void handleSetVaultPassword()}
                      sx={vaultFdeActionButtonSx}
                    >
                      Set Encrypt Password
                    </ColorTemplate16PopupCenterWide.ActionButton>
                  </Box>
                </Box>
              </Stack>
            )}

            {error ? (
              <ColorTemplate16PopupCenterWide.ErrorBar>
                {cooldownSeconds > 0 ? (
                  <>
                    {cooldownWrongPasswordError}{' '}
                    <Box component="span" sx={{ fontWeight: 800 }}>
                      Retry Cool Down {formatRecordVaultUnlockCountdown(cooldownSeconds)}.
                    </Box>
                  </>
                ) : (
                  error
                )}
              </ColorTemplate16PopupCenterWide.ErrorBar>
            ) : null}
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );
}
