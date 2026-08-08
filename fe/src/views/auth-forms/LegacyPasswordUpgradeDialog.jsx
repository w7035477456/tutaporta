import { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import {
  getPasswordRequirementChecks,
  passwordMeetsAllRequirements,
  passwordStrengthPercent
} from 'utils/passwordRequirements';

const formContentColumnSx = {
  gridColumn: { xs: '1 / -1', sm: '2' },
  width: '100%',
  minWidth: 0,
  alignItems: 'flex-start'
};

function PasswordVisibilityToggle({ visible, onToggle, disabled }) {
  return (
    <InputAdornment position="end">
      <IconButton
        type="button"
        aria-label={visible ? 'Hide password' : 'Show password'}
        onClick={onToggle}
        disabled={disabled}
        edge="end"
      >
        <FontAwesomeIcon icon={visible ? faEyeSlash : faEye} />
      </IconButton>
    </InputAdornment>
  );
}

PasswordVisibilityToggle.propTypes = {
  visible: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool
};

function PasswordInput({ label, value, onChange, disabled, showPassword, onToggleShow }) {
  return (
    <ColorTemplate7PopupLargeDark.Input
      formRow
      fullWidth
      size="small"
      type={showPassword ? 'text' : 'password'}
      placeholder={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
      autoComplete="new-password"
      InputProps={{
        endAdornment: (
          <PasswordVisibilityToggle visible={showPassword} onToggle={onToggleShow} disabled={disabled} />
        )
      }}
    />
  );
}

PasswordInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  showPassword: PropTypes.bool.isRequired,
  onToggleShow: PropTypes.func.isRequired
};

const REQUIREMENT_LABELS = [
  ['minLength', 'At least 8 characters'],
  ['smallLetter', 'At least one small letter'],
  ['capitalLetter', 'At least one capital letter'],
  ['numberOrSymbol', 'At least one number or symbol']
];

function RequirementRow({ met, label }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      {met ? (
        <CheckCircle sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
      ) : (
        <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
      )}
      <ColorTemplate7PopupLargeDark.BodyText sx={{ color: met ? 'success.main' : undefined }}>
        {label}
      </ColorTemplate7PopupLargeDark.BodyText>
    </Stack>
  );
}

RequirementRow.propTypes = {
  met: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired
};

export default function LegacyPasswordUpgradeDialog({ open, onSubmit }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSubmitting(false);
    setError('');
  }, [open]);

  const checks = getPasswordRequirementChecks(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const canSubmit = passwordMeetsAllRequirements(password) && passwordsMatch && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ newPassword: password, confirmPassword });
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save new password.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, confirmPassword, onSubmit, password]);

  return (
    <ColorTemplate7PopupLargeDark open={open} showCloseButton={false} closeOnBackdrop={false}>
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>Create password</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>
          Please create your password to continue
        </ColorTemplate7PopupLargeDark.BodyText>

        <ColorTemplate7PopupLargeDark.FormRows>
          <ColorTemplate7PopupLargeDark.FormRow label="Password">
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              showPassword={showPassword}
              onToggleShow={() => setShowPassword((prev) => !prev)}
            />
          </ColorTemplate7PopupLargeDark.FormRow>

          <Stack spacing={0.75} sx={formContentColumnSx}>
            <ColorTemplate7PopupLargeDark.BodyText>
              Password strength: {passwordStrengthPercent(password)}%
            </ColorTemplate7PopupLargeDark.BodyText>
            {REQUIREMENT_LABELS.map(([key, label]) => (
              <RequirementRow key={key} met={checks[key]} label={label} />
            ))}
          </Stack>

          <ColorTemplate7PopupLargeDark.FormRow label="Confirm password">
            <PasswordInput
              label="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              showPassword={showConfirmPassword}
              onToggleShow={() => setShowConfirmPassword((prev) => !prev)}
            />
          </ColorTemplate7PopupLargeDark.FormRow>

          <Stack direction="row" alignItems="center" spacing={1} sx={formContentColumnSx}>
            {passwordsMatch ? (
              <>
                <CheckCircle sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                <ColorTemplate7PopupLargeDark.BodyText sx={{ color: 'success.main' }}>
                  Passwords match
                </ColorTemplate7PopupLargeDark.BodyText>
              </>
            ) : (
              <>
                <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                <ColorTemplate7PopupLargeDark.BodyText>Passwords match</ColorTemplate7PopupLargeDark.BodyText>
              </>
            )}
          </Stack>
        </ColorTemplate7PopupLargeDark.FormRows>

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton
            type="button"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Creating…' : 'Create Password'}
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

LegacyPasswordUpgradeDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onSubmit: PropTypes.func.isRequired
};
