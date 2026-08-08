import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import AnimateButton from 'ui-component/extended/AnimateButton';
import { getDesktopIconSizeVw } from 'config/desktopFontEnv';
import { authButtonBoldSx, authEnvButtonFontSize, authFormContentSx } from '../authentication/authPageLayoutSx';
import CustomFormControl from 'ui-component/extended/Form/CustomFormControl';
import enterPhoneImg from 'assets/images/enterPhone.png';
import enterPasswordImg from 'assets/images/enterPassword.png';
import { verifyPhone } from 'api/verifyPhoneFe';
import { createPassword } from 'api/createPasswordFe';
import { SIGNUP_REGISTER_PHONE_KEY, formatPhoneNumber } from 'utils/signupParams';
import {
  clearStoredSignupReferralCode,
  markRefereeRewardUxAfterProfileSetup,
  getSignupReferralCodeFromSearchParams,
  resolveSignupReferByCodeForApi
} from 'utils/signupReferralCode';

// ===========================|| PHONE VERIFICATION ||=========================== //

const greySecondaryBorderBoxSx = {
  bgcolor: '#FFF2CD',
  border: '1px solid',
  borderColor: 'var(--theme-secondary-color)',
  borderRadius: 1,
  p: 1.25
};

const phoneFlowGreyButtonDisabledSx = {
  ...authButtonBoldSx,
  bgcolor: 'action.disabledBackground',
  color: 'action.disabled',
  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }
};

const sendSmsPrimaryButtonSx = {
  ...authButtonBoldSx,
  bgcolor: 'var(--theme-primary-color)',
  color: 'var(--theme-white-color)',
  '&:hover': { bgcolor: 'var(--theme-primary-color)', filter: 'brightness(0.95)' }
};

/** Left-aligned instruction copy inside the card */
const primaryInstructionLineSx = {
  mb: 1,
  color: 'var(--theme-primary-color)',
  textAlign: 'left',
  width: '100%',
  lineHeight: 1.35
};

/** Cooldown / resend wait — still disabled, light grey */
const sendSmsCooldownButtonSx = {
  ...authButtonBoldSx,
  bgcolor: '#e0e0e0',
  color: 'text.primary',
  opacity: 0.9,
  '&.Mui-disabled': {
    bgcolor: '#e0e0e0',
    color: 'text.primary',
    opacity: 0.9
  }
};

const fieldWithRightImageRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  width: '100%'
};

/** Image col is fixed width; reserve it + gap so the input column never paints under the image */
const fieldWithRightImageInputColSx = {
  flex: '1 1 0%',
  minWidth: 0,
  maxWidth: {
    xs: 'calc(100% - 96px - 16px)',
    sm: 'calc(100% - 112px - 16px)'
  }
};

const fieldWithRightImagePicSx = {
  flex: '0 0 auto',
  flexShrink: 0,
  width: { xs: 96, sm: 112 },
  height: 'auto',
  maxHeight: { xs: 88, sm: 100 },
  objectFit: 'contain',
  alignSelf: 'center'
};

/** CustomFormControl input padding + 8px below label */
const phoneFieldInputPaddingSx = {
  '& .MuiInputBase-input': {
    padding: '38.5px 14px 3.5px !important'
  }
};

/** fe/.env DESKTOP_ICON_SIZE — SMS consent checkbox */
const phoneConsentCheckboxSx = {
  p: 0,
  mt: 0.25,
  flexShrink: 0,
  '& .MuiSvgIcon-root': {
    width: getDesktopIconSizeVw(),
    height: getDesktopIconSizeVw(),
    fontSize: getDesktopIconSizeVw()
  }
};

/** 8px below phone field so consent copy does not touch the Phone Number label */
const phoneConsentRowSx = {
  mt: '20px',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 1
};

const verificationSlotInputSx = (hasError) => ({
  boxSizing: 'border-box',
  flex: '1 1 0%',
  minWidth: { xs: 22, sm: 28 },
  maxWidth: { xs: 44, sm: 48 },
  width: 0,
  height: { xs: 44, sm: 48 },
  textAlign: 'center',
  fontSize: authEnvButtonFontSize,
  fontWeight: 600,
  border: '2px solid',
  borderColor: hasError ? 'error.main' : '#000',
  borderRadius: 1,
  bgcolor: '#fff',
  color: 'text.primary',
  '&:focus': {
    outline: 'none',
    borderColor: 'var(--theme-primary-color)',
    boxShadow: '0 0 0 1px var(--theme-primary-color)'
  }
});

export default function AuthPhoneVerification() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Get email and phone from URL params (phone may be set at sign-up)
  const email = searchParams.get('email') || '';
  const phoneFromUrl = searchParams.get('phone') || '';
  const phoneFromSignup =
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SIGNUP_REGISTER_PHONE_KEY) || '' : '';
  const initialPhone = formatPhoneNumber(phoneFromUrl || phoneFromSignup);

  const [codeChars, setCodeChars] = useState(() => ['', '', '', '', '', '']);
  const [phoneInput, setPhoneInput] = useState(() => initialPhone);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState('');
  const [sendSmsCooldown, setSendSmsCooldown] = useState(0);

  const phoneInputRef = useRef(null);
  const verificationSlotRefs = useRef([]);

  const verificationCode = codeChars.join('');

  const sendSmsCooldownActive = sendSmsCooldown > 0;
  useEffect(() => {
    if (!sendSmsCooldownActive) return undefined;
    const id = setInterval(() => {
      setSendSmsCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [sendSmsCooldownActive]);

  useEffect(() => {
    if (!email) setError('Email is required.');
  }, [email]);

  useEffect(() => {
    getSignupReferralCodeFromSearchParams(searchParams);
  }, [searchParams]);

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
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = Array.from({ length: 6 }, (_, j) => text[j] || '');
    setCodeChars(next);
    setError('');
    requestAnimationFrame(() => verificationSlotRefs.current[Math.min(text.length, 5)]?.focus());
  };

  const handleVerifySms = async (event) => {
    event.preventDefault();
    setError('');

    const finalPhone = phoneInput || initialPhone;
    if (!email || !finalPhone) {
      setError('Email and phone number are required.');
      return;
    }

    if (!verificationCode) {
      setError('Verification code is required.');
      return;
    }

    if (verificationCode.length !== 6) {
      setError('Verification code must be 6 digits.');
      return;
    }

    setIsSubmitting(true);

    try {
      await verifyPhone(email, finalPhone, verificationCode, {
        referByCode: resolveSignupReferByCodeForApi()
      });
      markRefereeRewardUxAfterProfileSetup();
      clearStoredSignupReferralCode();
      navigate(`/pages/phoneVerificationSuccess?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setError(err.message || 'The phone verification code is incorrect. Please enter again or register phone number again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSms = async () => {
    if (sendSmsCooldown > 0) return;
    const finalPhone = phoneInput || initialPhone;
    if (!email || !finalPhone) {
      setError('Email and phone number are required.');
      return;
    }
    if (finalPhone.replace(/\D/g, '').length !== 10) {
      setError('Please enter a complete 10-digit phone number.');
      return;
    }
    if (!consentChecked) {
      setError('Please check the consent box before sending SMS.');
      return;
    }
    setError('');
    setIsSendingSms(true);
    try {
      const raw = sessionStorage.getItem('signupCreatePasswordPayload');
      const payload = raw ? JSON.parse(raw) : null;
      if (!payload?.code || !payload?.password) {
        throw new Error('Create Password step is missing. Please go back and create password first.');
      }
      await createPassword(payload.code, email, payload.password, finalPhone, {
        sendSms: true,
        referByCode: resolveSignupReferByCodeForApi()
      });
      setSmsSent(true);
      setSendSmsCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to send code. Please try again.');
    } finally {
      setIsSendingSms(false);
    }
  };

  const displayPhone = phoneInput || initialPhone;
  const phoneDigitsForValidation = (phoneInput || initialPhone).replace(/\D/g, '');
  const isPhoneFormatValid = phoneDigitsForValidation.length === 10;
  const isSendSmsEnabled = isPhoneFormatValid && consentChecked && !!email.trim();
  const isVerificationCodeFormatValid = /^\d{6}$/.test(verificationCode);
  const isVerifySmsEnabled = smsSent && isVerificationCodeFormatValid;

  const sendSmsButtonLabel =
    sendSmsCooldown > 0
      ? `wait ${sendSmsCooldown}s for SMS resend`
      : isSendingSms
        ? 'Sending...'
        : smsSent
          ? 'Resend SMS'
          : 'Send SMS';

  /** Cooldown (shows Ns): always disabled. Send SMS / Resend: need 10-digit phone, consent, and email. */
  const sendSmsButtonDisabled =
    isSendingSms || sendSmsCooldownActive || !isPhoneFormatValid || !consentChecked || !email.trim();

  const sendSmsButtonEl = (
    <AnimateButton scale={sendSmsButtonDisabled ? { hover: 1, tap: 1 } : undefined}>
      <Button
        disableElevation
        fullWidth
        size="large"
        type="button"
        variant="contained"
        onClick={handleSendSms}
        disabled={sendSmsButtonDisabled}
        aria-busy={isSendingSms}
        sx={{
          ...(sendSmsCooldown > 0
            ? sendSmsCooldownButtonSx
            : isSendSmsEnabled && !isSendingSms
              ? sendSmsPrimaryButtonSx
              : phoneFlowGreyButtonDisabledSx)
        }}
      >
        {sendSmsButtonLabel}
      </Button>
    </AnimateButton>
  );

  /** Phone when action is Send SMS; verification when SMS flow is active (countdown / Resend / after send). */
  const inputFocusToken =
    sendSmsButtonLabel === 'Send SMS' ? 'phone' : smsSent ? 'verification' : 'phone';

  useLayoutEffect(() => {
    if (inputFocusToken === 'phone') {
      phoneInputRef.current?.focus();
    } else {
      const idx = Math.min(verificationCode.replace(/\D/g, '').length, 5);
      verificationSlotRefs.current[idx]?.focus();
    }
  }, [inputFocusToken]);

  return (
    <Box component="form" noValidate onSubmit={handleVerifySms} sx={authFormContentSx}>
      <Typography variant="body2" sx={primaryInstructionLineSx}>
        Enter the phone tied to this account
      </Typography>
      <Box sx={fieldWithRightImageRowSx}>
        <Box sx={fieldWithRightImageInputColSx}>
          <CustomFormControl fullWidth>
            <InputLabel htmlFor="outlined-adornment-phone-number">Phone Number</InputLabel>
            <OutlinedInput
              id="outlined-adornment-phone-number"
              inputRef={phoneInputRef}
              type="tel"
              value={phoneInput}
              onChange={(e) => setPhoneInput(formatPhoneNumber(e.target.value))}
              name="phone"
              placeholder="(703) 547-7457"
              required
              sx={phoneFieldInputPaddingSx}
            />
          </CustomFormControl>
        </Box>
        <Box
          component="img"
          src={enterPhoneImg}
          alt=""
          sx={fieldWithRightImagePicSx}
        />
      </Box>

      <Box sx={phoneConsentRowSx}>
        <Checkbox
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
          name="smsConsent"
          color="primary"
          sx={phoneConsentCheckboxSx}
        />
        <Box sx={{ ...greySecondaryBorderBoxSx, flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            To ensure account integrity,{' '}
            <Box component="span" sx={{ fontWeight: 700, textDecoration: 'underline' }}>
              this phone number will be permanently tied to this single account and cannot be reused for other registrations.
            </Box>{' '}
            By clicking &apos;Send SMS&apos;, you agree to receive a one-time identity verification code to this number. Message and data rates may apply.
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2 }}>{sendSmsButtonEl}</Box>

      <Box sx={{ mt: 2, height: 5, bgcolor: '#000', width: '100%', flexShrink: 0, borderRadius: 0 }} />

      <Box sx={{ ...fieldWithRightImageRowSx, mt: 2, alignItems: 'flex-start' }}>
        <Box
          sx={{
            ...fieldWithRightImageInputColSx,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'stretch',
            width: '100%'
          }}
        >
          {smsSent && displayPhone.trim() && (
            <Typography variant="body2" sx={primaryInstructionLineSx}>
              Enter the 6 digit code we texted to{'\u00A0'}
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {displayPhone}.
              </Box>
            </Typography>
          )}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: { xs: 0.5, sm: 0.75 },
              width: '100%',
              minWidth: 0
            }}
            onPaste={handleVerificationSlotsPaste}
          >
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                id={i === 0 ? 'verification-code-slot-0' : undefined}
                component="input"
                inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'}
                name={i === 0 ? 'verificationCode' : undefined}
                maxLength={1}
                value={codeChars[i]}
                onChange={(e) => handleVerificationSlotChange(i, e)}
                onKeyDown={(e) => handleVerificationSlotKeyDown(i, e)}
                ref={(el) => {
                  verificationSlotRefs.current[i] = el;
                }}
                sx={verificationSlotInputSx(!!error)}
                aria-label={`Verification code digit ${i + 1} of 6`}
              />
            ))}
            <Box sx={{ width: { xs: 6, sm: 10 }, flexShrink: 0 }} aria-hidden />
            {[3, 4, 5].map((i) => (
              <Box
                key={i}
                component="input"
                inputMode="numeric"
                autoComplete="off"
                maxLength={1}
                value={codeChars[i]}
                onChange={(e) => handleVerificationSlotChange(i, e)}
                onKeyDown={(e) => handleVerificationSlotKeyDown(i, e)}
                ref={(el) => {
                  verificationSlotRefs.current[i] = el;
                }}
                sx={verificationSlotInputSx(!!error)}
                aria-label={`Verification code digit ${i + 1} of 6`}
              />
            ))}
          </Box>
        </Box>
        <Box
          component="img"
          src={enterPasswordImg}
          alt=""
          sx={{ ...fieldWithRightImagePicSx, alignSelf: 'center' }}
        />
      </Box>

      {error && (
        <Typography variant="body2" sx={{ mt: 1, mb: 1, color: 'error.main' }}>
          {error}
        </Typography>
      )}

      <Box sx={{ mt: 2 }}>
        <AnimateButton>
          <Button
            disableElevation
            fullWidth
            size="large"
            type="submit"
            variant="contained"
            disabled={isSubmitting || !isVerifySmsEnabled}
            sx={{
              ...(isVerifySmsEnabled && !isSubmitting ? sendSmsPrimaryButtonSx : phoneFlowGreyButtonDisabledSx)
            }}
          >
            {isSubmitting ? 'Verifying...' : 'Verify SMS'}
          </Button>
        </AnimateButton>
      </Box>
    </Box>
  );
}
