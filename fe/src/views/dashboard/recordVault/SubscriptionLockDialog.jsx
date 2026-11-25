import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Stack from '@mui/material/Stack';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import { fetchSubscriptionLockStatus, unlockSubscriptionLock } from 'api/monthlyBillFe';

/**
 * Password prompt for the Locked Subscription table.
 * First time (no password on the server yet): asks for a new password twice and sets it.
 * After that: asks for the password. Resolves via onUnlocked({ token, expiresAt }).
 */
export default function SubscriptionLockDialog({ open, onCancel, onUnlocked }) {
  const [hasPassword, setHasPassword] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setHasPassword(null);
    setPassword('');
    setConfirm('');
    setError('');
    fetchSubscriptionLockStatus()
      .then((data) => {
        if (!cancelled) setHasPassword(Boolean(data?.hasPassword));
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.error || err?.message || 'Could not reach the server');
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const settingUp = hasPassword === false;

  const submit = async () => {
    if (busy || hasPassword == null) return;
    if (!password) {
      setError('Enter your Locked Subscription password');
      return;
    }
    if (settingUp && password !== confirm) {
      setError('The two passwords do not match');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await unlockSubscriptionLock(password, settingUp ? confirm : undefined);
      onUnlocked?.({ token: data.token, expiresAt: data.expiresAt });
    } catch (err) {
      if (err?.response?.data?.code === 'HAS_PASSWORD') setHasPassword(true);
      setError(err?.response?.data?.error || err?.message || 'Unlock failed');
    } finally {
      setBusy(false);
    }
  };

  const onEnter = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <ColorTemplate16PopupCenterWide
      open={open}
      onClose={() => !busy && onCancel?.()}
      closeOnBackdrop={false}
      bodyTextAlignLeft={false}
      centeredLeadLines={0}
      overlaySx={{ zIndex: 39000 }}
      closeButtonAriaLabel="Close Locked Subscription password dialog"
    >
      <ColorTemplate16PopupCenterWide.Title>
        {settingUp ? 'Set Locked Subscription password' : 'Locked Subscription'}
      </ColorTemplate16PopupCenterWide.Title>
      <ColorTemplate16PopupCenterWide.Body spacing={1.5} sx={{ textAlign: 'left' }}>
        {settingUp ? (
          <ColorTemplate16PopupCenterWide.BodyText sx={{ fontWeight: 600 }}>
            Choose a password for your Locked Subscription table (at least 4 characters). You will need it every time you open the table.
            Keep it safe — it cannot be recovered.
          </ColorTemplate16PopupCenterWide.BodyText>
        ) : null}
        <ColorTemplate16PopupCenterWide.FormRows>
          <ColorTemplate16PopupCenterWide.FormRow label="Password:">
            <ColorTemplate16PopupCenterWide.Input
              formRow
              autoFocus
              type="password"
              value={password}
              disabled={hasPassword == null}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={onEnter}
              inputProps={{ autoComplete: settingUp ? 'new-password' : 'current-password', maxLength: 200 }}
            />
          </ColorTemplate16PopupCenterWide.FormRow>
          {settingUp ? (
            <ColorTemplate16PopupCenterWide.FormRow label="Confirm:">
              <ColorTemplate16PopupCenterWide.Input
                formRow
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError('');
                }}
                onKeyDown={onEnter}
                inputProps={{ autoComplete: 'new-password', maxLength: 200 }}
              />
            </ColorTemplate16PopupCenterWide.FormRow>
          ) : null}
        </ColorTemplate16PopupCenterWide.FormRows>

        {error ? <ColorTemplate16PopupCenterWide.ErrorBar>{error}</ColorTemplate16PopupCenterWide.ErrorBar> : null}

        <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ width: '100%', pt: 0.5 }}>
          <ColorTemplate16PopupCenterWide.ActionButton type="button" disabled={busy} onClick={() => onCancel?.()}>
            Cancel
          </ColorTemplate16PopupCenterWide.ActionButton>
          <ColorTemplate16PopupCenterWide.ActionButton
            type="button"
            disabled={busy || hasPassword == null || !password}
            onClick={() => void submit()}
          >
            {busy ? 'Checking…' : settingUp ? 'Set Password & Open' : 'Unlock'}
          </ColorTemplate16PopupCenterWide.ActionButton>
        </Stack>
      </ColorTemplate16PopupCenterWide.Body>
    </ColorTemplate16PopupCenterWide>
  );
}

SubscriptionLockDialog.propTypes = {
  open: PropTypes.bool,
  onCancel: PropTypes.func,
  onUnlocked: PropTypes.func
};
