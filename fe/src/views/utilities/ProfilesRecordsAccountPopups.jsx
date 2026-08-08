import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash } from '@fortawesome/free-solid-svg-icons';

import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { COLOR_TEMPLATE13_DISABLED_BG } from 'config/colorTemplate13DisableGreenButton';
import GreenButton from 'ui-component/GreenButton';
import ColorTemplate13UsableGreenButton from 'ui-component/ColorTemplate13UsableGreenButton';
import {
  completeSettingsChangeEmail,
  completeSettingsChangePassword,
  sendSettingsChangeEmailSms,
  sendSettingsChangePasswordSms,
  sendSettingsChangePhoneSms,
  submitSettingsChangeEmail,
  submitSettingsChangePhone,
  verifySettingsChangeEmailSms,
  verifySettingsChangePasswordSms,
  verifySettingsChangePhoneEmailCode,
  verifySettingsChangePhoneSms
} from 'api/settingsAccountFe';
import SecurityIconPickerDialog from 'views/dashboard/myStory/SecurityIconPickerDialog';
import { formatPhoneNumber } from 'utils/signupParams';
import {
  getPasswordRequirementChecks,
  passwordMeetsAllRequirements,
  passwordStrengthPercent
} from 'utils/passwordRequirements';

function isValidEmailFormat(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhoneDigits(raw) {
  const digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
  return digits;
}

function isValidPhoneFormat(raw) {
  return normalizePhoneDigits(raw).length === 10;
}

function formatSettingsAccountApiError(err, fallbackMessage) {
  const responseData = err?.response?.data;
  const status = err?.response?.status;
  if (responseData?.errorPrimary) {
    return {
      error: responseData.errorPrimary,
      errorSecondary: responseData.errorSecondary || ''
    };
  }
  const serverError = responseData?.error || err?.message || fallbackMessage;
  if (status === 401 && serverError === 'Authentication required') {
    return {
      error:
        'Your login session expired. Please log in again, then reopen Change Email and complete SMS verification from the start.',
      errorSecondary: ''
    };
  }
  return { error: serverError, errorSecondary: '' };
}

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
      size="small"
      type={showPassword ? 'text' : 'password'}
      placeholder={label}
      value={value}
      onChange={onChange}
      disabled={disabled}
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

function AccountPopupShell({ open, submitting, title, children, onClose, onSubmit, canSubmit, submitLabel = 'Submit' }) {
  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={submitting ? undefined : handleClose}
      closeOnBackdrop={!submitting}
      showCloseButton={!submitting}
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>{title}</ColorTemplate7PopupLargeDark.Title>
        {children}
        {onSubmit ? (
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
            <ColorTemplate7PopupLargeDark.ActionButton disabled={!canSubmit} onClick={onSubmit}>
              {submitting ? 'Submitting…' : submitLabel}
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Stack>
        ) : null}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

AccountPopupShell.propTypes = {
  open: PropTypes.bool.isRequired,
  submitting: PropTypes.bool,
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  canSubmit: PropTypes.bool,
  submitLabel: PropTypes.string
};

/** Align password strength / match rows with FormRow inputs (grid column 2). */
const changePasswordFormContentColumnSx = {
  gridColumn: { xs: '1 / -1', sm: '2' },
  width: '100%',
  minWidth: 0,
  alignItems: 'flex-start'
};

const SETTINGS_ACCOUNT_SMS_RESEND_SEC = 50;
const CHANGE_PASSWORD_REQUIREMENT_LABELS = [
  ['minLength', 'At least 8 characters'],
  ['smallLetter', 'At least one small letter'],
  ['capitalLetter', 'At least one capital letter'],
  ['numberOrSymbol', 'At least one number or symbol']
];

const SMS_SLOT_DISABLED_BG = COLOR_TEMPLATE13_DISABLED_BG;
const SMS_SLOT_ENABLED_BG = '#fff';

/** SMS code slots: grey before Send SMS; all white after Send SMS (or locked after verify). */
const changePasswordSmsSlotSx = ({ enabled, locked = false }) => {
  const activeVisual = enabled || locked;
  return {
  boxSizing: 'border-box',
  flex: '0 0 auto',
  width: { xs: 46, sm: 52 },
  height: { xs: 46, sm: 52 },
  minWidth: { xs: 46, sm: 52 },
  maxWidth: { xs: 46, sm: 52 },
  textAlign: 'center',
  fontSize: { xs: '1.25rem', sm: '1.35rem' },
  fontWeight: 700,
  border: '2px solid',
  borderColor: activeVisual ? '#000' : '#bdbdbd',
  borderRadius: 1,
  bgcolor: activeVisual ? `${SMS_SLOT_ENABLED_BG} !important` : SMS_SLOT_DISABLED_BG,
  backgroundColor: activeVisual ? `${SMS_SLOT_ENABLED_BG} !important` : SMS_SLOT_DISABLED_BG,
  color: activeVisual ? '#000 !important' : '#757575',
  WebkitTextFillColor: activeVisual ? '#000 !important' : '#757575',
  opacity: 1,
  cursor: enabled ? 'text' : 'not-allowed',
  WebkitAppearance: 'none',
  MozAppearance: 'textfield',
  '&:disabled': {
    bgcolor: activeVisual ? SMS_SLOT_ENABLED_BG : SMS_SLOT_DISABLED_BG,
    backgroundColor: activeVisual ? SMS_SLOT_ENABLED_BG : SMS_SLOT_DISABLED_BG,
    color: activeVisual ? '#000' : '#757575',
    WebkitTextFillColor: activeVisual ? '#000' : '#757575',
    opacity: 1
  },
  '&:focus': enabled
    ? {
        outline: 'none',
        borderColor: 'var(--theme-primary-color)',
        boxShadow: '0 0 0 2px var(--theme-primary-color)'
      }
    : { outline: 'none' }
  };
};

function ChangePasswordSmsDigitRow({
  codeChars,
  enabled,
  locked = false,
  slotRefs,
  onSlotChange,
  onSlotKeyDown,
  onPaste
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'nowrap',
        gap: { xs: 0.5, sm: 0.75 },
        width: '100%',
        minWidth: 0,
        py: 0.5
      }}
      onPaste={onPaste}
    >
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          component="input"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          readOnly={!enabled}
          tabIndex={enabled ? 0 : -1}
          value={codeChars[i]}
          onChange={(e) => onSlotChange(i, e)}
          onKeyDown={(e) => onSlotKeyDown(i, e)}
          ref={(el) => {
            slotRefs.current[i] = el;
          }}
          sx={{
            ...changePasswordSmsSlotSx({ enabled, locked }),
            pointerEvents: enabled ? 'auto' : 'none'
          }}
          aria-label={`Verification code digit ${i + 1} of 6`}
          aria-readonly={!enabled}
        />
      ))}
      <Box sx={{ width: { xs: 10, sm: 14 }, flexShrink: 0 }} aria-hidden />
      {[3, 4, 5].map((i) => (
        <Box
          key={i}
          component="input"
          inputMode="numeric"
          autoComplete="off"
          maxLength={1}
          readOnly={!enabled}
          tabIndex={enabled ? 0 : -1}
          value={codeChars[i]}
          onChange={(e) => onSlotChange(i, e)}
          onKeyDown={(e) => onSlotKeyDown(i, e)}
          ref={(el) => {
            slotRefs.current[i] = el;
          }}
          sx={{
            ...changePasswordSmsSlotSx({ enabled, locked }),
            pointerEvents: enabled ? 'auto' : 'none'
          }}
          aria-label={`Verification code digit ${i + 1} of 6`}
          aria-readonly={!enabled}
        />
      ))}
    </Box>
  );
}

ChangePasswordSmsDigitRow.propTypes = {
  codeChars: PropTypes.arrayOf(PropTypes.string).isRequired,
  enabled: PropTypes.bool.isRequired,
  locked: PropTypes.bool,
  slotRefs: PropTypes.shape({ current: PropTypes.array }).isRequired,
  onSlotChange: PropTypes.func.isRequired,
  onSlotKeyDown: PropTypes.func.isRequired,
  onPaste: PropTypes.func.isRequired
};

function ChangePasswordRequirementRow({ met, label }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1}>
      {met ? (
        <CheckCircle sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
      ) : (
        <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
      )}
      <ColorTemplate7PopupLargeDark.BodyText sx={{ color: met ? 'success.main' : undefined }}>{label}</ColorTemplate7PopupLargeDark.BodyText>
    </Stack>
  );
}

ChangePasswordRequirementRow.propTypes = {
  met: PropTypes.bool.isRequired,
  label: PropTypes.string.isRequired
};

export function ChangePasswordPopup({ open, onClose, onSuccess, phone = '', email = '' }) {
  const [codeChars, setCodeChars] = useState(() => ['', '', '', '', '', '']);
  const [smsSent, setSmsSent] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isVerifyingSms, setIsVerifyingSms] = useState(false);
  const [sendSmsCooldown, setSendSmsCooldown] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const verificationSlotRefs = useRef([]);

  const displayPhone = formatPhoneNumber(phone || '');
  const phoneDigits = displayPhone.replace(/\D/g, '');
  const hasPhone = phoneDigits.length === 10;
  const verificationCode = codeChars.join('');
  const isVerificationCodeFormatValid = /^\d{6}$/.test(verificationCode);
  const hasAnySmsDigit = codeChars.some((d) => d !== '');
  const isSmsCodeEntryEnabled = smsSent;
  const sendSmsCooldownActive = sendSmsCooldown > 0;
  const sendSmsCooldownLabel =
    sendSmsCooldown > 0 ? `Wait ${sendSmsCooldown}s For SMS Resend` : '';
  const sendSmsCodeButtonDisabled = isSendingSms || sendSmsCooldownActive || !hasPhone;
  const isClearSmsCodeEnabled = isSmsCodeEntryEnabled && hasAnySmsDigit;
  const isVerifySmsEnabled = isSmsCodeEntryEnabled && isVerificationCodeFormatValid;

  const passwordChecks = getPasswordRequirementChecks(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const canCreatePassword =
    smsVerified && passwordMeetsAllRequirements(newPassword) && passwordsMatch && !submitting;

  useEffect(() => {
    if (!open) return;
    setCodeChars(['', '', '', '', '', '']);
    setSmsSent(false);
    setSmsVerified(false);
    setIsSendingSms(false);
    setIsVerifyingSms(false);
    setSendSmsCooldown(0);
    setNewPassword('');
    setConfirmPassword('');
    setSubmitting(false);
    setError('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  }, [open]);

  useEffect(() => {
    if (!sendSmsCooldownActive) return undefined;
    const id = window.setInterval(() => {
      setSendSmsCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sendSmsCooldownActive]);

  const handleVerificationSlotChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split('');
      const next = Array.from({ length: 6 }, (_, j) => digits[j] || '');
      setCodeChars(next);
      setError('');
      const focusIdx = Math.min(Math.max(digits.length - 1, 0), 5);
      requestAnimationFrame(() => verificationSlotRefs.current[focusIdx]?.focus());
      return;
    }
    const digit = raw.slice(-1);
    setCodeChars((prev) => {
      const n = [...prev];
      n[index] = digit || '';
      return n;
    });
    setError('');
    if (digit && index < 5) {
      requestAnimationFrame(() => verificationSlotRefs.current[index + 1]?.focus());
    }
  };

  const handleVerificationSlotKeyDown = (index, e) => {
    if (e.key !== 'Backspace') return;
    setCodeChars((prev) => {
      if (prev[index]) {
        const n = [...prev];
        n[index] = '';
        return n;
      }
      if (index > 0) {
        e.preventDefault();
        const n = [...prev];
        n[index - 1] = '';
        requestAnimationFrame(() => verificationSlotRefs.current[index - 1]?.focus());
        return n;
      }
      return prev;
    });
  };

  const handleVerificationSlotsPaste = (e) => {
    if (!smsSent) return;
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, j) => text[j] || '');
    setCodeChars(next);
    setError('');
    requestAnimationFrame(() => verificationSlotRefs.current[Math.min(text.length, 5)]?.focus());
  };

  const handleClearVerificationCode = () => {
    setCodeChars(['', '', '', '', '', '']);
    setError('');
    requestAnimationFrame(() => verificationSlotRefs.current[0]?.focus());
  };

  const handleSendSmsCode = useCallback(async () => {
    if (sendSmsCodeButtonDisabled) return;
    if (!hasPhone) {
      setError('No valid phone number on file. Update your phone first.');
      return;
    }
    setError('');
    setIsSendingSms(true);
    try {
      await sendSettingsChangePasswordSms();
      setSmsSent(true);
      setSendSmsCooldown(SETTINGS_ACCOUNT_SMS_RESEND_SEC);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send code. Please try again.');
    } finally {
      setIsSendingSms(false);
    }
  }, [hasPhone, sendSmsCodeButtonDisabled]);

  const handleVerifySms = useCallback(async () => {
    if (!isVerifySmsEnabled || isVerifyingSms) return;
    setError('');
    setIsVerifyingSms(true);
    try {
      await verifySettingsChangePasswordSms(verificationCode);
      setSmsVerified(true);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'The verification code is incorrect. Please try again.');
    } finally {
      setIsVerifyingSms(false);
    }
  }, [isVerifySmsEnabled, isVerifyingSms, verificationCode]);

  const handleCreatePassword = useCallback(async () => {
    if (!canCreatePassword) return;
    setError('');
    setSubmitting(true);
    try {
      const data = await completeSettingsChangePassword({ newPassword, confirmPassword });
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to change password.');
    } finally {
      setSubmitting(false);
    }
  }, [canCreatePassword, confirmPassword, newPassword, onClose, onSuccess]);

  const handleClose = () => {
    if (submitting || isSendingSms || isVerifyingSms) return;
    onClose();
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={handleClose}
      closeOnBackdrop={!submitting && !isSendingSms && !isVerifyingSms}
      showCloseButton={!submitting && !isSendingSms && !isVerifyingSms}
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        {!smsVerified ? (
          <>
            <ColorTemplate7PopupLargeDark.BodyText>
              Phone:{' '}
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {hasPhone ? displayPhone : '—'}
              </Box>
            </ColorTemplate7PopupLargeDark.BodyText>

            <Stack direction="row" justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
              {smsSent && sendSmsCooldownActive ? (
                <ColorTemplate13UsableGreenButton disabled>{sendSmsCooldownLabel}</ColorTemplate13UsableGreenButton>
              ) : (
                <ColorTemplate13UsableGreenButton
                  onClick={() => void handleSendSmsCode()}
                  disabled={sendSmsCodeButtonDisabled}
                  aria-busy={isSendingSms}
                >
                  {isSendingSms ? 'Sending...' : smsSent ? 'Resend SMS Code' : 'Send SMS Code'}
                </ColorTemplate13UsableGreenButton>
              )}
            </Stack>

            <ColorTemplate7PopupLargeDark.BodyText
              sx={{
                fontWeight: 600,
                color: isSmsCodeEntryEnabled ? 'inherit' : 'text.disabled'
              }}
            >
              Enter code SMS text to your phone below
            </ColorTemplate7PopupLargeDark.BodyText>

            <ChangePasswordSmsDigitRow
              codeChars={codeChars}
              enabled={isSmsCodeEntryEnabled}
              slotRefs={verificationSlotRefs}
              onSlotChange={handleVerificationSlotChange}
              onSlotKeyDown={handleVerificationSlotKeyDown}
              onPaste={handleVerificationSlotsPaste}
            />

            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1}
              sx={{ width: '100%' }}
            >
              <GreenButton onClick={handleClearVerificationCode} disabled={!isClearSmsCodeEnabled}>
                Clear
              </GreenButton>

              <GreenButton onClick={() => void handleVerifySms()} disabled={isVerifyingSms || !isVerifySmsEnabled}>
                {isVerifyingSms ? 'Verifying...' : 'Verify SMS'}
              </GreenButton>
            </Stack>
          </>
        ) : (
          <>
            <ColorTemplate7PopupLargeDark.BodyText>
              Phone:{' '}
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {displayPhone}
              </Box>
            </ColorTemplate7PopupLargeDark.BodyText>

            <ChangePasswordSmsDigitRow
              codeChars={codeChars}
              enabled={false}
              locked
              slotRefs={verificationSlotRefs}
              onSlotChange={() => {}}
              onSlotKeyDown={() => {}}
              onPaste={() => {}}
            />

            <Box sx={settingsAccountVerifyPassPillSx}>
              <Typography variant="body2" sx={{ color: 'var(--theme-white-color)', fontWeight: 700 }}>
                Verify SMS Code PASSES
              </Typography>
            </Box>

            <ColorTemplate7PopupLargeDark.Title>Create password</ColorTemplate7PopupLargeDark.Title>
            <ColorTemplate7PopupLargeDark.BodyText>
              Please create your password to continue
            </ColorTemplate7PopupLargeDark.BodyText>

            <ColorTemplate7PopupLargeDark.FormRows>
              <ColorTemplate7PopupLargeDark.FormRow label="Password">
                <PasswordInput
                  label="Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={submitting}
                  showPassword={showNewPassword}
                  onToggleShow={() => setShowNewPassword((prev) => !prev)}
                />
              </ColorTemplate7PopupLargeDark.FormRow>

              <Stack spacing={0.75} sx={changePasswordFormContentColumnSx}>
                <ColorTemplate7PopupLargeDark.BodyText>
                  Password strength: {passwordStrengthPercent(newPassword)}%
                </ColorTemplate7PopupLargeDark.BodyText>
                {CHANGE_PASSWORD_REQUIREMENT_LABELS.map(([key, label]) => (
                  <ChangePasswordRequirementRow key={key} met={passwordChecks[key]} label={label} />
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

              <Stack direction="row" alignItems="center" spacing={1} sx={changePasswordFormContentColumnSx}>
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

            <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
              <ColorTemplate7PopupLargeDark.ActionButton
                type="button"
                disabled={!canCreatePassword}
                onClick={() => void handleCreatePassword()}
              >
                {submitting ? 'Creating…' : 'Create Password'}
              </ColorTemplate7PopupLargeDark.ActionButton>
            </Stack>
          </>
        )}

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        {!email ? (
          <ColorTemplate7PopupLargeDark.BodyText sx={{ opacity: 0.85 }}>
            Account email is required for SMS verification.
          </ColorTemplate7PopupLargeDark.BodyText>
        ) : null}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

ChangePasswordPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  phone: PropTypes.string,
  email: PropTypes.string
};

/** Green SMS/email verify pass pill — shrink-wrap to label text only. */
const settingsAccountVerifyPassPillSx = {
  alignSelf: 'center',
  width: 'fit-content',
  maxWidth: '100%',
  bgcolor: 'success.main',
  color: 'var(--theme-white-color)',
  py: 0.75,
  px: 1.5,
  borderRadius: 10,
  textAlign: 'center',
  boxSizing: 'border-box',
  whiteSpace: 'nowrap'
};

/** Match indicator row — icon + label sit together in column 2 (not full-width spread). */
const settingsAccountMatchRowSx = {
  gridColumn: { xs: '1 / -1', sm: '2' },
  width: 'fit-content',
  maxWidth: '100%',
  justifySelf: { xs: 'center', sm: 'start' },
  alignItems: 'center',
  flexWrap: 'nowrap'
};

export function ChangeEmailPopup({ open, onClose, onSuccess, phone = '', email = '' }) {
  const [codeChars, setCodeChars] = useState(() => ['', '', '', '', '', '']);
  const [emailCodeChars, setEmailCodeChars] = useState(() => ['', '', '', '', '', '']);
  const [smsSent, setSmsSent] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeVerified, setEmailCodeVerified] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isVerifyingSms, setIsVerifyingSms] = useState(false);
  const [isVerifyingEmailCode, setIsVerifyingEmailCode] = useState(false);
  const [sendSmsCooldown, setSendSmsCooldown] = useState(0);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorSecondary, setErrorSecondary] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const verificationSlotRefs = useRef([]);
  const emailCodeSlotRefs = useRef([]);

  const displayPhone = formatPhoneNumber(phone || '');
  const phoneDigits = displayPhone.replace(/\D/g, '');
  const hasPhone = phoneDigits.length === 10;
  const verificationCode = codeChars.join('');
  const isVerificationCodeFormatValid = /^\d{6}$/.test(verificationCode);
  const hasAnySmsDigit = codeChars.some((d) => d !== '');
  const isSmsCodeEntryEnabled = smsSent;
  const sendSmsCooldownActive = sendSmsCooldown > 0;
  const sendSmsCooldownLabel =
    sendSmsCooldown > 0 ? `Wait ${sendSmsCooldown}s For SMS Resend` : '';
  const sendSmsCodeButtonDisabled = isSendingSms || sendSmsCooldownActive || !hasPhone;
  const isClearSmsCodeEnabled = isSmsCodeEntryEnabled && hasAnySmsDigit;
  const isVerifySmsEnabled = isSmsCodeEntryEnabled && isVerificationCodeFormatValid;

  const normalizedNewEmail = newEmail.trim().toLowerCase();
  const normalizedConfirmEmail = confirmEmail.trim().toLowerCase();
  const emailsMatch =
    isValidEmailFormat(normalizedNewEmail) &&
    isValidEmailFormat(normalizedConfirmEmail) &&
    normalizedNewEmail === normalizedConfirmEmail;
  const emailVerificationCode = emailCodeChars.join('');
  const isEmailCodeFormatValid = /^\d{6}$/.test(emailVerificationCode);
  const hasAnyEmailCodeDigit = emailCodeChars.some((d) => d !== '');
  const isEmailCodeEntryEnabled = emailCodeSent && !emailCodeVerified;
  const isClearEmailCodeEnabled = isEmailCodeEntryEnabled && hasAnyEmailCodeDigit;
  const isVerifyEmailCodeEnabled = isEmailCodeEntryEnabled && isEmailCodeFormatValid;
  const canSubmitEmailForm =
    smsVerified &&
    emailsMatch &&
    currentPassword.trim().length > 0 &&
    !submitting &&
    !emailCodeSent;

  useEffect(() => {
    if (!open) return;
    setCodeChars(['', '', '', '', '', '']);
    setEmailCodeChars(['', '', '', '', '', '']);
    setSmsSent(false);
    setSmsVerified(false);
    setEmailCodeSent(false);
    setEmailCodeVerified(false);
    setIsSendingSms(false);
    setIsVerifyingSms(false);
    setIsVerifyingEmailCode(false);
    setSendSmsCooldown(0);
    setCurrentPassword('');
    setNewEmail('');
    setConfirmEmail('');
    setSubmitting(false);
    setError('');
    setErrorSecondary('');
    setShowCurrentPassword(false);
  }, [open]);

  useEffect(() => {
    if (!sendSmsCooldownActive) return undefined;
    const id = window.setInterval(() => {
      setSendSmsCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sendSmsCooldownActive]);

  const handleVerificationSlotChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split('');
      const next = Array.from({ length: 6 }, (_, j) => digits[j] || '');
      setCodeChars(next);
      setError('');
      const focusIdx = Math.min(Math.max(digits.length - 1, 0), 5);
      requestAnimationFrame(() => verificationSlotRefs.current[focusIdx]?.focus());
      return;
    }
    const digit = raw.slice(-1);
    setCodeChars((prev) => {
      const n = [...prev];
      n[index] = digit || '';
      return n;
    });
    setError('');
    if (digit && index < 5) {
      requestAnimationFrame(() => verificationSlotRefs.current[index + 1]?.focus());
    }
  };

  const handleVerificationSlotKeyDown = (index, e) => {
    if (e.key !== 'Backspace') return;
    setCodeChars((prev) => {
      if (prev[index]) {
        const n = [...prev];
        n[index] = '';
        return n;
      }
      if (index > 0) {
        e.preventDefault();
        const n = [...prev];
        n[index - 1] = '';
        requestAnimationFrame(() => verificationSlotRefs.current[index - 1]?.focus());
        return n;
      }
      return prev;
    });
  };

  const handleVerificationSlotsPaste = (e) => {
    if (!smsSent) return;
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, j) => text[j] || '');
    setCodeChars(next);
    setError('');
    requestAnimationFrame(() => verificationSlotRefs.current[Math.min(text.length, 5)]?.focus());
  };

  const handleClearVerificationCode = () => {
    setCodeChars(['', '', '', '', '', '']);
    setError('');
    requestAnimationFrame(() => verificationSlotRefs.current[0]?.focus());
  };

  const handleSendSmsCode = useCallback(async () => {
    if (sendSmsCodeButtonDisabled) return;
    if (!hasPhone) {
      setError('No valid phone number on file. Update your phone first.');
      return;
    }
    setError('');
    setIsSendingSms(true);
    try {
      await sendSettingsChangeEmailSms();
      setSmsSent(true);
      setSendSmsCooldown(SETTINGS_ACCOUNT_SMS_RESEND_SEC);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send code. Please try again.');
    } finally {
      setIsSendingSms(false);
    }
  }, [hasPhone, sendSmsCodeButtonDisabled]);

  const handleVerifySms = useCallback(async () => {
    if (!isVerifySmsEnabled || isVerifyingSms) return;
    setError('');
    setIsVerifyingSms(true);
    try {
      await verifySettingsChangeEmailSms(verificationCode);
      setSmsVerified(true);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'SMS code incorrect. Please retry.');
    } finally {
      setIsVerifyingSms(false);
    }
  }, [isVerifySmsEnabled, isVerifyingSms, verificationCode]);

  const handleEmailCodeSlotChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split('');
      const next = Array.from({ length: 6 }, (_, j) => digits[j] || '');
      setEmailCodeChars(next);
      setError('');
      const focusIdx = Math.min(Math.max(digits.length - 1, 0), 5);
      requestAnimationFrame(() => emailCodeSlotRefs.current[focusIdx]?.focus());
      return;
    }
    const digit = raw.slice(-1);
    setEmailCodeChars((prev) => {
      const n = [...prev];
      n[index] = digit || '';
      return n;
    });
    setError('');
    if (digit && index < 5) {
      requestAnimationFrame(() => emailCodeSlotRefs.current[index + 1]?.focus());
    }
  };

  const handleEmailCodeSlotKeyDown = (index, e) => {
    if (e.key !== 'Backspace') return;
    setEmailCodeChars((prev) => {
      if (prev[index]) {
        const n = [...prev];
        n[index] = '';
        return n;
      }
      if (index > 0) {
        e.preventDefault();
        const n = [...prev];
        n[index - 1] = '';
        requestAnimationFrame(() => emailCodeSlotRefs.current[index - 1]?.focus());
        return n;
      }
      return prev;
    });
  };

  const handleEmailCodeSlotsPaste = (e) => {
    if (!emailCodeSent) return;
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, j) => text[j] || '');
    setEmailCodeChars(next);
    setError('');
    requestAnimationFrame(() => emailCodeSlotRefs.current[Math.min(text.length, 5)]?.focus());
  };

  const handleClearEmailCode = () => {
    setEmailCodeChars(['', '', '', '', '', '']);
    setError('');
    requestAnimationFrame(() => emailCodeSlotRefs.current[0]?.focus());
  };

  const handleSubmitEmailForm = useCallback(async () => {
    if (!canSubmitEmailForm) return;
    setError('');
    setErrorSecondary('');
    setSubmitting(true);
    try {
      await submitSettingsChangeEmail({ currentPassword, newEmail, confirmEmail });
      setEmailCodeSent(true);
      setEmailCodeChars(['', '', '', '', '', '']);
      requestAnimationFrame(() => emailCodeSlotRefs.current[0]?.focus());
    } catch (err) {
      const formatted = formatSettingsAccountApiError(err, 'Failed to submit email change.');
      setError(formatted.error);
      setErrorSecondary(formatted.errorSecondary);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmitEmailForm, confirmEmail, currentPassword, newEmail]);

  const handleVerifyEmailCode = useCallback(async () => {
    if (!isVerifyEmailCodeEnabled || isVerifyingEmailCode) return;
    setError('');
    setIsVerifyingEmailCode(true);
    try {
      const data = await completeSettingsChangeEmail({ verificationCode: emailVerificationCode });
      setEmailCodeVerified(true);
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Code from email is invalid. Please retry.');
    } finally {
      setIsVerifyingEmailCode(false);
    }
  }, [emailVerificationCode, isVerifyEmailCodeEnabled, isVerifyingEmailCode, onClose, onSuccess]);

  const handleClose = () => {
    if (submitting || isSendingSms || isVerifyingSms || isVerifyingEmailCode) return;
    onClose();
  };

  const smsDigitRow = (enabled, locked = false) => (
    <ChangePasswordSmsDigitRow
      codeChars={codeChars}
      enabled={enabled}
      locked={locked}
      slotRefs={verificationSlotRefs}
      onSlotChange={enabled ? handleVerificationSlotChange : () => {}}
      onSlotKeyDown={enabled ? handleVerificationSlotKeyDown : () => {}}
      onPaste={enabled ? handleVerificationSlotsPaste : () => {}}
    />
  );

  const smsActionRow = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap={1}
      sx={{ width: '100%' }}
    >
      <GreenButton onClick={handleClearVerificationCode} disabled={!isClearSmsCodeEnabled}>
        Clear
      </GreenButton>
      <GreenButton onClick={() => void handleVerifySms()} disabled={isVerifyingSms || !isVerifySmsEnabled}>
        {isVerifyingSms ? 'Verifying...' : 'Verify SMS'}
      </GreenButton>
    </Stack>
  );

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={handleClose}
      closeOnBackdrop={!submitting && !isSendingSms && !isVerifyingSms && !isVerifyingEmailCode}
      showCloseButton={!submitting && !isSendingSms && !isVerifyingSms && !isVerifyingEmailCode}
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        {!smsVerified ? (
          <>
            <ColorTemplate7PopupLargeDark.BodyText>
              Phone:{' '}
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {hasPhone ? displayPhone : '—'}
              </Box>
            </ColorTemplate7PopupLargeDark.BodyText>

            <Stack direction="row" justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
              {smsSent && sendSmsCooldownActive ? (
                <ColorTemplate13UsableGreenButton disabled>{sendSmsCooldownLabel}</ColorTemplate13UsableGreenButton>
              ) : (
                <ColorTemplate13UsableGreenButton
                  onClick={() => void handleSendSmsCode()}
                  disabled={sendSmsCodeButtonDisabled}
                  aria-busy={isSendingSms}
                >
                  {isSendingSms ? 'Sending...' : smsSent ? 'Resend SMS Code' : 'Send SMS Code'}
                </ColorTemplate13UsableGreenButton>
              )}
            </Stack>

            <ColorTemplate7PopupLargeDark.BodyText
              sx={{
                fontWeight: 600,
                color: isSmsCodeEntryEnabled ? 'inherit' : 'text.disabled'
              }}
            >
              Enter code SMS text to your phone below
            </ColorTemplate7PopupLargeDark.BodyText>

            {smsDigitRow(isSmsCodeEntryEnabled)}
            {smsActionRow}
          </>
        ) : (
          <>
            <ColorTemplate7PopupLargeDark.BodyText>
              Phone:{' '}
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {displayPhone}
              </Box>
            </ColorTemplate7PopupLargeDark.BodyText>

            {smsDigitRow(false, true)}

            <Box sx={settingsAccountVerifyPassPillSx}>
              <Typography variant="body2" sx={{ color: 'var(--theme-white-color)', fontWeight: 700 }}>
                Verify SMS Code PASSES
              </Typography>
            </Box>

            <ColorTemplate7PopupLargeDark.Title>Change Email</ColorTemplate7PopupLargeDark.Title>

            <ColorTemplate7PopupLargeDark.FormRows>
              <ColorTemplate7PopupLargeDark.FormRow label="Current password">
                <PasswordInput
                  label="Current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={submitting || emailCodeSent}
                  showPassword={showCurrentPassword}
                  onToggleShow={() => setShowCurrentPassword((prev) => !prev)}
                />
              </ColorTemplate7PopupLargeDark.FormRow>

              <ColorTemplate7PopupLargeDark.FormRow label="New Email">
                <ColorTemplate7PopupLargeDark.Input
                  formRow
                  size="small"
                  type="email"
                  placeholder="New Email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={submitting || emailCodeSent}
                />
              </ColorTemplate7PopupLargeDark.FormRow>

              <ColorTemplate7PopupLargeDark.FormRow label="New Email again">
                <ColorTemplate7PopupLargeDark.Input
                  formRow
                  size="small"
                  type="email"
                  placeholder="New Email again"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  disabled={submitting || emailCodeSent}
                />
              </ColorTemplate7PopupLargeDark.FormRow>

              <Stack direction="row" alignItems="center" spacing={0.75} sx={settingsAccountMatchRowSx}>
                {emailsMatch ? (
                  <>
                    <CheckCircle sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                    <ColorTemplate7PopupLargeDark.BodyText
                      sx={{ color: 'success.main', textAlign: 'left', width: 'auto', flexShrink: 0 }}
                    >
                      Emails match
                    </ColorTemplate7PopupLargeDark.BodyText>
                  </>
                ) : (
                  <>
                    <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                    <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'left', width: 'auto', flexShrink: 0 }}>
                      Emails match
                    </ColorTemplate7PopupLargeDark.BodyText>
                  </>
                )}
              </Stack>
            </ColorTemplate7PopupLargeDark.FormRows>

            {!emailCodeSent ? (
              <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
                <ColorTemplate7PopupLargeDark.ActionButton
                  type="button"
                  disabled={!canSubmitEmailForm}
                  onClick={() => void handleSubmitEmailForm()}
                >
                  {submitting ? 'Submitting…' : 'Submit'}
                </ColorTemplate7PopupLargeDark.ActionButton>
              </Stack>
            ) : null}

            {emailCodeSent ? (
              <>
                <ColorTemplate7PopupLargeDark.BodyText
                  sx={{
                    fontWeight: 600,
                    color: isEmailCodeEntryEnabled ? 'inherit' : 'text.disabled'
                  }}
                >
                  Enter code sent to your new email
                </ColorTemplate7PopupLargeDark.BodyText>

                <ChangePasswordSmsDigitRow
                  codeChars={emailCodeChars}
                  enabled={isEmailCodeEntryEnabled}
                  slotRefs={emailCodeSlotRefs}
                  onSlotChange={handleEmailCodeSlotChange}
                  onSlotKeyDown={handleEmailCodeSlotKeyDown}
                  onPaste={handleEmailCodeSlotsPaste}
                />

                <Stack
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  flexWrap="wrap"
                  gap={1}
                  sx={{ width: '100%' }}
                >
                  <GreenButton onClick={handleClearEmailCode} disabled={!isClearEmailCodeEnabled}>
                    Clear
                  </GreenButton>
                  <GreenButton
                    onClick={() => void handleVerifyEmailCode()}
                    disabled={isVerifyingEmailCode || !isVerifyEmailCodeEnabled}
                  >
                    {isVerifyingEmailCode ? 'Verifying...' : 'Verify Code'}
                  </GreenButton>
                </Stack>

                {emailCodeVerified ? (
                  <Box sx={settingsAccountVerifyPassPillSx}>
                    <Typography variant="body2" sx={{ color: 'var(--theme-white-color)', fontWeight: 700 }}>
                      Verify email code PASSES
                    </Typography>
                  </Box>
                ) : null}
              </>
            ) : null}
          </>
        )}

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        {errorSecondary ? <ColorTemplate7PopupLargeDark.BodyText>{errorSecondary}</ColorTemplate7PopupLargeDark.BodyText> : null}
        {!email ? (
          <ColorTemplate7PopupLargeDark.BodyText sx={{ opacity: 0.85 }}>
            Account email is required for SMS verification.
          </ColorTemplate7PopupLargeDark.BodyText>
        ) : null}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

ChangeEmailPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  phone: PropTypes.string,
  email: PropTypes.string
};

export function ChangePhonePopup({ open, onClose, onSuccess, email = '', phone = '' }) {
  const [showSecurityIcon, setShowSecurityIcon] = useState(true);
  const [verifiedIconName, setVerifiedIconName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [confirmPhone, setConfirmPhone] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  const [emailCodeChars, setEmailCodeChars] = useState(() => ['', '', '', '', '', '']);
  const [codeChars, setCodeChars] = useState(() => ['', '', '', '', '', '']);
  const [emailCodeSent, setEmailCodeSent] = useState(false);
  const [emailCodeVerified, setEmailCodeVerified] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsVerified, setSmsVerified] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isVerifyingSms, setIsVerifyingSms] = useState(false);
  const [isVerifyingEmailCode, setIsVerifyingEmailCode] = useState(false);
  const [sendSmsCooldown, setSendSmsCooldown] = useState(0);
  const [error, setError] = useState('');
  const [errorSecondary, setErrorSecondary] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const emailCodeSlotRefs = useRef([]);
  const verificationSlotRefs = useRef([]);
  const verifiedIconNameRef = useRef('');

  const [resolvedAccountEmail, setResolvedAccountEmail] = useState('');
  const accountEmailNorm = resolvedAccountEmail || String(email ?? '').trim().toLowerCase();
  const newPhoneDigits = normalizePhoneDigits(newPhone);
  const confirmPhoneDigits = normalizePhoneDigits(confirmPhone);
  const accountPhoneDigits = normalizePhoneDigits(phone);
  const phonesMatch =
    isValidPhoneFormat(newPhone) &&
    isValidPhoneFormat(confirmPhone) &&
    newPhoneDigits === confirmPhoneDigits;
  const newPhoneIsDifferent =
    !accountPhoneDigits || !phonesMatch || newPhoneDigits !== accountPhoneDigits;
  const currentEmailNorm = currentEmail.trim().toLowerCase();
  const currentEmailMatchesAccount =
    isValidEmailFormat(currentEmailNorm) && Boolean(accountEmailNorm) && currentEmailNorm === accountEmailNorm;
  const emailVerificationCode = emailCodeChars.join('');
  const isEmailCodeFormatValid = /^\d{6}$/.test(emailVerificationCode);
  const hasAnyEmailCodeDigit = emailCodeChars.some((d) => d !== '');
  const isEmailCodeEntryEnabled = emailCodeSent && !emailCodeVerified;
  const isClearEmailCodeEnabled = isEmailCodeEntryEnabled && hasAnyEmailCodeDigit;
  const isVerifyEmailCodeEnabled = isEmailCodeEntryEnabled && isEmailCodeFormatValid;
  const verificationCode = codeChars.join('');
  const isVerificationCodeFormatValid = /^\d{6}$/.test(verificationCode);
  const hasAnySmsDigit = codeChars.some((d) => d !== '');
  const isSmsCodeEntryEnabled = smsSent && !smsVerified;
  const sendSmsCooldownActive = sendSmsCooldown > 0;
  const sendSmsCooldownLabel = sendSmsCooldown > 0 ? `Wait ${sendSmsCooldown}s For SMS Resend` : '';
  const sendSmsCodeButtonDisabled = isSendingSms || sendSmsCooldownActive || !emailCodeVerified || smsVerified;
  const isClearSmsCodeEnabled = isSmsCodeEntryEnabled && hasAnySmsDigit;
  const isVerifySmsEnabled = isSmsCodeEntryEnabled && isVerificationCodeFormatValid;
  const canSubmitPhoneForm =
    Boolean(verifiedIconNameRef.current || verifiedIconName) &&
    phonesMatch &&
    newPhoneIsDifferent &&
    currentEmailMatchesAccount &&
    currentPassword.trim().length > 0 &&
    !submitting &&
    !emailCodeSent &&
    !smsVerified;
  const displayNewPhone = formatPhoneNumber(newPhone || '');

  useEffect(() => {
    const norm = String(email ?? '').trim().toLowerCase();
    if (norm) setResolvedAccountEmail(norm);
  }, [email]);

  useEffect(() => {
    if (!open) return;
    setShowSecurityIcon(true);
    setVerifiedIconName('');
    verifiedIconNameRef.current = '';
    setCurrentPassword('');
    setNewPhone('');
    setConfirmPhone('');
    setCurrentEmail(accountEmailNorm);
    setEmailCodeChars(['', '', '', '', '', '']);
    setCodeChars(['', '', '', '', '', '']);
    setEmailCodeSent(false);
    setEmailCodeVerified(false);
    setSmsSent(false);
    setSmsVerified(false);
    setSubmitting(false);
    setIsSendingSms(false);
    setIsVerifyingSms(false);
    setIsVerifyingEmailCode(false);
    setSendSmsCooldown(0);
    setError('');
    setErrorSecondary('');
    setShowCurrentPassword(false);
  }, [open]);

  useEffect(() => {
    if (!open || accountEmailNorm) return;
    let cancelled = false;
    void (async () => {
      try {
        const { default: apiClient } = await import('api/axios');
        const { data } = await apiClient.get('/api/settings/profile');
        const fetched = String(data?.email ?? '').trim().toLowerCase();
        if (!cancelled && fetched) {
          setResolvedAccountEmail(fetched);
          setCurrentEmail((prev) => (prev.trim() ? prev : fetched));
        }
      } catch {
        // ignore — user can still type Current Email manually
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, accountEmailNorm]);

  useEffect(() => {
    if (!open || !accountEmailNorm) return;
    setCurrentEmail((prev) => {
      const prevNorm = prev.trim().toLowerCase();
      if (!prevNorm) return accountEmailNorm;
      return prev;
    });
  }, [open, accountEmailNorm]);

  useEffect(() => {
    if (!sendSmsCooldownActive) return undefined;
    const id = window.setInterval(() => {
      setSendSmsCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [sendSmsCooldownActive]);

  const handleEmailCodeSlotChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split('');
      const next = Array.from({ length: 6 }, (_, j) => digits[j] || '');
      setEmailCodeChars(next);
      setError('');
      const focusIdx = Math.min(Math.max(digits.length - 1, 0), 5);
      requestAnimationFrame(() => emailCodeSlotRefs.current[focusIdx]?.focus());
      return;
    }
    const digit = raw.slice(-1);
    setEmailCodeChars((prev) => {
      const n = [...prev];
      n[index] = digit || '';
      return n;
    });
    setError('');
    if (digit && index < 5) {
      requestAnimationFrame(() => emailCodeSlotRefs.current[index + 1]?.focus());
    }
  };

  const handleEmailCodeSlotKeyDown = (index, e) => {
    if (e.key !== 'Backspace') return;
    setEmailCodeChars((prev) => {
      if (prev[index]) {
        const n = [...prev];
        n[index] = '';
        return n;
      }
      if (index > 0) {
        e.preventDefault();
        const n = [...prev];
        n[index - 1] = '';
        requestAnimationFrame(() => emailCodeSlotRefs.current[index - 1]?.focus());
        return n;
      }
      return prev;
    });
  };

  const handleEmailCodeSlotsPaste = (e) => {
    if (!emailCodeSent) return;
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, j) => text[j] || '');
    setEmailCodeChars(next);
    setError('');
    requestAnimationFrame(() => emailCodeSlotRefs.current[Math.min(text.length, 5)]?.focus());
  };

  const handleClearEmailCode = () => {
    setEmailCodeChars(['', '', '', '', '', '']);
    setError('');
    requestAnimationFrame(() => emailCodeSlotRefs.current[0]?.focus());
  };

  const handleVerificationSlotChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split('');
      const next = Array.from({ length: 6 }, (_, j) => digits[j] || '');
      setCodeChars(next);
      setError('');
      const focusIdx = Math.min(Math.max(digits.length - 1, 0), 5);
      requestAnimationFrame(() => verificationSlotRefs.current[focusIdx]?.focus());
      return;
    }
    const digit = raw.slice(-1);
    setCodeChars((prev) => {
      const n = [...prev];
      n[index] = digit || '';
      return n;
    });
    setError('');
    if (digit && index < 5) {
      requestAnimationFrame(() => verificationSlotRefs.current[index + 1]?.focus());
    }
  };

  const handleVerificationSlotKeyDown = (index, e) => {
    if (e.key !== 'Backspace') return;
    setCodeChars((prev) => {
      if (prev[index]) {
        const n = [...prev];
        n[index] = '';
        return n;
      }
      if (index > 0) {
        e.preventDefault();
        const n = [...prev];
        n[index - 1] = '';
        requestAnimationFrame(() => verificationSlotRefs.current[index - 1]?.focus());
        return n;
      }
      return prev;
    });
  };

  const handleVerificationSlotsPaste = (e) => {
    if (!smsSent) return;
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, j) => text[j] || '');
    setCodeChars(next);
    setError('');
    requestAnimationFrame(() => verificationSlotRefs.current[Math.min(text.length, 5)]?.focus());
  };

  const handleClearVerificationCode = () => {
    setCodeChars(['', '', '', '', '', '']);
    setError('');
    requestAnimationFrame(() => verificationSlotRefs.current[0]?.focus());
  };

  const handleSubmitPhoneForm = useCallback(async () => {
    if (!canSubmitPhoneForm) return;
    setError('');
    setErrorSecondary('');
    setSubmitting(true);
    try {
      await submitSettingsChangePhone({
        iconName: verifiedIconNameRef.current || verifiedIconName,
        currentPassword,
        newPhone,
        confirmPhone,
        currentEmail
      });
      setEmailCodeSent(true);
      setEmailCodeChars(['', '', '', '', '', '']);
      requestAnimationFrame(() => emailCodeSlotRefs.current[0]?.focus());
    } catch (err) {
      const formatted = formatSettingsAccountApiError(err, 'Failed to submit phone change.');
      setError(formatted.error);
      setErrorSecondary(formatted.errorSecondary);
    } finally {
      setSubmitting(false);
    }
  }, [canSubmitPhoneForm, confirmPhone, currentEmail, currentPassword, newPhone, verifiedIconName]);

  const handleVerifyEmailCode = useCallback(async () => {
    if (!isVerifyEmailCodeEnabled || isVerifyingEmailCode) return;
    setError('');
    setIsVerifyingEmailCode(true);
    try {
      await verifySettingsChangePhoneEmailCode(emailVerificationCode);
      setEmailCodeVerified(true);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Code from email is invalid. Please retry.');
    } finally {
      setIsVerifyingEmailCode(false);
    }
  }, [emailVerificationCode, isVerifyEmailCodeEnabled, isVerifyingEmailCode]);

  const handleSendSmsCode = useCallback(async () => {
    if (sendSmsCodeButtonDisabled) return;
    setError('');
    setIsSendingSms(true);
    try {
      await sendSettingsChangePhoneSms();
      setSmsSent(true);
      setSendSmsCooldown(SETTINGS_ACCOUNT_SMS_RESEND_SEC);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send code. Please try again.');
    } finally {
      setIsSendingSms(false);
    }
  }, [sendSmsCodeButtonDisabled]);

  const handleVerifySms = useCallback(async () => {
    if (!isVerifySmsEnabled || isVerifyingSms) return;
    setError('');
    setIsVerifyingSms(true);
    try {
      const data = await verifySettingsChangePhoneSms(verificationCode);
      setSmsVerified(true);
      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'SMS code incorrect. Please retry.');
    } finally {
      setIsVerifyingSms(false);
    }
  }, [isVerifySmsEnabled, isVerifyingSms, onClose, onSuccess, verificationCode]);

  const handleClose = () => {
    if (submitting || isSendingSms || isVerifyingSms || isVerifyingEmailCode) return;
    onClose();
  };

  const smsDigitRow = (enabled, locked = false) => (
    <ChangePasswordSmsDigitRow
      codeChars={codeChars}
      enabled={enabled}
      locked={locked}
      slotRefs={verificationSlotRefs}
      onSlotChange={enabled ? handleVerificationSlotChange : () => {}}
      onSlotKeyDown={enabled ? handleVerificationSlotKeyDown : () => {}}
      onPaste={enabled ? handleVerificationSlotsPaste : () => {}}
    />
  );

  const smsActionRow = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      flexWrap="wrap"
      gap={1}
      sx={{ width: '100%' }}
    >
      <GreenButton onClick={handleClearVerificationCode} disabled={!isClearSmsCodeEnabled}>
        Clear
      </GreenButton>
      <GreenButton onClick={() => void handleVerifySms()} disabled={isVerifyingSms || !isVerifySmsEnabled}>
        {isVerifyingSms ? 'Verifying...' : 'Verify SMS'}
      </GreenButton>
    </Stack>
  );

  return (
    <>
      <SecurityIconPickerDialog
        open={open && showSecurityIcon}
        mode="verify"
        dismissible
        onClose={handleClose}
        onVerified={(iconName) => {
          verifiedIconNameRef.current = iconName;
          setVerifiedIconName(iconName);
          setShowSecurityIcon(false);
        }}
      />
      <ColorTemplate7PopupLargeDark
        open={open && !showSecurityIcon}
        onClose={handleClose}
        closeOnBackdrop={!submitting && !isSendingSms && !isVerifyingSms && !isVerifyingEmailCode}
        showCloseButton={!submitting && !isSendingSms && !isVerifyingSms && !isVerifyingEmailCode}
      >
        <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
          <ColorTemplate7PopupLargeDark.Title>Change Phone</ColorTemplate7PopupLargeDark.Title>

          <ColorTemplate7PopupLargeDark.FormRows>
            <ColorTemplate7PopupLargeDark.FormRow label="Current password">
              <PasswordInput
                label="Current password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={submitting || emailCodeSent || smsVerified}
                showPassword={showCurrentPassword}
                onToggleShow={() => setShowCurrentPassword((prev) => !prev)}
              />
            </ColorTemplate7PopupLargeDark.FormRow>

            <ColorTemplate7PopupLargeDark.FormRow label="New Phone">
              <ColorTemplate7PopupLargeDark.Input
                formRow
                size="small"
                type="tel"
                placeholder="New Phone"
                value={newPhone}
                onChange={(e) => setNewPhone(formatPhoneNumber(e.target.value))}
                disabled={submitting || emailCodeSent || smsVerified}
                inputProps={{ inputMode: 'tel', autoComplete: 'tel' }}
              />
            </ColorTemplate7PopupLargeDark.FormRow>

            <ColorTemplate7PopupLargeDark.FormRow label="New Phone again">
              <ColorTemplate7PopupLargeDark.Input
                formRow
                size="small"
                type="tel"
                placeholder="New Phone again"
                value={confirmPhone}
                onChange={(e) => setConfirmPhone(formatPhoneNumber(e.target.value))}
                disabled={submitting || emailCodeSent || smsVerified}
                inputProps={{ inputMode: 'tel', autoComplete: 'tel' }}
              />
            </ColorTemplate7PopupLargeDark.FormRow>

            <Stack direction="row" alignItems="center" spacing={0.75} sx={settingsAccountMatchRowSx}>
              {phonesMatch ? (
                <>
                  <CheckCircle sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                  <ColorTemplate7PopupLargeDark.BodyText
                    sx={{ color: 'success.main', textAlign: 'left', width: 'auto', flexShrink: 0 }}
                  >
                    Phones match
                  </ColorTemplate7PopupLargeDark.BodyText>
                </>
              ) : (
                <>
                  <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                  <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'left', width: 'auto', flexShrink: 0 }}>
                    Phones match
                  </ColorTemplate7PopupLargeDark.BodyText>
                </>
              )}
            </Stack>

            <Stack direction="row" alignItems="center" spacing={0.75} sx={settingsAccountMatchRowSx}>
              {phonesMatch && newPhoneIsDifferent ? (
                <>
                  <CheckCircle sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                  <ColorTemplate7PopupLargeDark.BodyText
                    sx={{ color: 'success.main', textAlign: 'left', width: 'auto', flexShrink: 0 }}
                  >
                    New phone is different from current phone
                  </ColorTemplate7PopupLargeDark.BodyText>
                </>
              ) : phonesMatch && !newPhoneIsDifferent ? (
                <>
                  <RadioButtonUnchecked sx={{ color: 'error.main', fontSize: 20, flexShrink: 0 }} />
                  <ColorTemplate7PopupLargeDark.BodyText sx={{ color: 'error.main', textAlign: 'left', width: 'auto', flexShrink: 0 }}>
                    New phone must differ from your current phone
                  </ColorTemplate7PopupLargeDark.BodyText>
                </>
              ) : null}
            </Stack>

            <ColorTemplate7PopupLargeDark.FormRow label="Current Email">
              <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%', minWidth: 0 }}>
                <ColorTemplate7PopupLargeDark.Input
                  formRow
                  size="small"
                  type="email"
                  placeholder="Current Email"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  disabled={submitting || emailCodeSent || smsVerified}
                  sx={{ flex: 1, minWidth: 0 }}
                />
                {!emailCodeSent ? (
                  <ColorTemplate7PopupLargeDark.ActionButton
                    type="button"
                    disabled={!canSubmitPhoneForm}
                    onClick={() => void handleSubmitPhoneForm()}
                  >
                    {submitting ? 'Submitting…' : 'Submit'}
                  </ColorTemplate7PopupLargeDark.ActionButton>
                ) : null}
              </Stack>
            </ColorTemplate7PopupLargeDark.FormRow>

            <Stack direction="row" alignItems="center" spacing={0.75} sx={settingsAccountMatchRowSx}>
              {currentEmailMatchesAccount ? (
                <>
                  <CheckCircle sx={{ color: 'success.main', fontSize: 20, flexShrink: 0 }} />
                  <ColorTemplate7PopupLargeDark.BodyText
                    sx={{ color: 'success.main', textAlign: 'left', width: 'auto', flexShrink: 0 }}
                  >
                    Email matches account
                  </ColorTemplate7PopupLargeDark.BodyText>
                </>
              ) : (
                <>
                  <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20, flexShrink: 0 }} />
                  <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'left', width: 'auto', flexShrink: 0 }}>
                    Email matches account
                  </ColorTemplate7PopupLargeDark.BodyText>
                </>
              )}
            </Stack>
          </ColorTemplate7PopupLargeDark.FormRows>

          {emailCodeSent ? (
            <>
              <ColorTemplate7PopupLargeDark.BodyText
                sx={{
                  fontWeight: 600,
                  color: isEmailCodeEntryEnabled ? 'inherit' : 'text.disabled'
                }}
              >
                Enter 6-digit code We emailed you
              </ColorTemplate7PopupLargeDark.BodyText>

              <ChangePasswordSmsDigitRow
                codeChars={emailCodeChars}
                enabled={isEmailCodeEntryEnabled}
                slotRefs={emailCodeSlotRefs}
                onSlotChange={handleEmailCodeSlotChange}
                onSlotKeyDown={handleEmailCodeSlotKeyDown}
                onPaste={handleEmailCodeSlotsPaste}
              />

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                flexWrap="wrap"
                gap={1}
                sx={{ width: '100%' }}
              >
                <GreenButton onClick={handleClearEmailCode} disabled={!isClearEmailCodeEnabled}>
                  Clear
                </GreenButton>
                <GreenButton
                  onClick={() => void handleVerifyEmailCode()}
                  disabled={isVerifyingEmailCode || !isVerifyEmailCodeEnabled}
                >
                  {isVerifyingEmailCode ? 'Verifying...' : 'Verify Code'}
                </GreenButton>
              </Stack>

              {emailCodeVerified ? (
                <Box sx={settingsAccountVerifyPassPillSx}>
                  <Typography variant="body2" sx={{ color: 'var(--theme-white-color)', fontWeight: 700 }}>
                    Verify email code PASSES
                  </Typography>
                </Box>
              ) : null}
            </>
          ) : null}

          {emailCodeVerified ? (
            <>
              <ColorTemplate7PopupLargeDark.BodyText>
                Phone:{' '}
                <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                  {displayNewPhone}
                </Box>
              </ColorTemplate7PopupLargeDark.BodyText>

              <Stack direction="row" justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
                {smsSent && sendSmsCooldownActive ? (
                  <ColorTemplate13UsableGreenButton disabled>{sendSmsCooldownLabel}</ColorTemplate13UsableGreenButton>
                ) : (
                  <ColorTemplate13UsableGreenButton
                    onClick={() => void handleSendSmsCode()}
                    disabled={sendSmsCodeButtonDisabled}
                    aria-busy={isSendingSms}
                  >
                    {isSendingSms ? 'Sending...' : smsSent ? 'Resend SMS Code' : 'Send SMS Code'}
                  </ColorTemplate13UsableGreenButton>
                )}
              </Stack>

              <ColorTemplate7PopupLargeDark.BodyText
                sx={{
                  fontWeight: 600,
                  color: isSmsCodeEntryEnabled ? 'inherit' : 'text.disabled'
                }}
              >
                Enter code SMS text to your phone below
              </ColorTemplate7PopupLargeDark.BodyText>

              {smsDigitRow(isSmsCodeEntryEnabled)}
              {smsActionRow}
            </>
          ) : null}

          {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
          {errorSecondary ? <ColorTemplate7PopupLargeDark.BodyText>{errorSecondary}</ColorTemplate7PopupLargeDark.BodyText> : null}
          {!accountEmailNorm ? (
            <ColorTemplate7PopupLargeDark.BodyText sx={{ opacity: 0.85 }}>
              Account email is required for phone change verification.
            </ColorTemplate7PopupLargeDark.BodyText>
          ) : null}
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </>
  );
}

ChangePhonePopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
  email: PropTypes.string,
  phone: PropTypes.string
};
