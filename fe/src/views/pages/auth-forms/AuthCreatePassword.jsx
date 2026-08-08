import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import AnimateButton from 'ui-component/extended/AnimateButton';
import GreenButton from 'ui-component/GreenButton';
import CustomFormControl from 'ui-component/extended/Form/CustomFormControl';
import { verifyRegistrationLink } from 'api/verifyRegistrationLinkFe';
import { validateReferralCode } from 'api/validateReferralCodeFe';
import { createPassword } from 'api/createPasswordFe';
import { sendRegistrationSms } from 'api/sendRegistrationSmsFe';
import { resendPhoneCode, verifyPhone } from 'api/verifyPhoneFe';
import { bypassSignupSmsVerification } from 'api/bypassSignupSmsVerificationFe';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import enterPasswordImg from 'assets/images/enterPassword.png';
import emailCodeVerifiedImg from 'assets/images/emailCodeVerified.png';
import {
  SIGNUP_CREATE_PASSWORD_PAYLOAD_KEY,
  SIGNUP_REGISTER_PHONE_KEY,
  buildCreatePasswordQuery,
  getSignupPhoneFromSearchParams
} from 'utils/signupParams';
import {
  clearStoredSignupReferralCode,
  markRefereeRewardUxAfterProfileSetup,
  getSignupReferralCodeFromSearchParams,
  resolveSignupReferByCodeForApi,
  formatValidReferralMessage,
  DEFAULT_REFER_BY_CODE,
  normalizeSignupReferralCode,
  isDefaultReferByCode
} from 'utils/signupReferralCode';

// assets
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';

import {
  authButtonBoldSx,
  authEnvButtonFontSize,
  authEnvTextFontSize,
  authFormContentSx
} from '../authentication/authPageLayoutSx';

// ===========================|| CREATE PASSWORD ||=========================== //

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** CustomFormControl input padding + 8px below label (30.5 + 8 top; 11.5 − 8 bottom) */
const createPasswordFieldInputPaddingSx = {
  '& .MuiInputBase-input': {
    padding: '38.5px 14px 3.5px !important'
  }
};

/** Password / confirm password — typed value + placeholder use inverse-daynight on dark themes */
const createPasswordEntryInputSx = {
  ...createPasswordFieldInputPaddingSx,
  '& .MuiInputBase-input': {
    padding: '38.5px 14px 3.5px !important',
    color: 'var(--theme-inverse-daynight-color)',
    WebkitTextFillColor: 'var(--theme-inverse-daynight-color)'
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'var(--theme-inverse-daynight-color)',
    opacity: 1
  }
};

/** Shown when ?email=&code= fails DB verification (wrong, used, or expired). */
const LINK_CODE_ERROR = 'the code in email link is incorrect. Please try again.';

const phoneFlowGreyButtonDisabledSx = {
  ...authButtonBoldSx,
  bgcolor: 'action.disabledBackground',
  color: 'action.disabled',
  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' }
};

const sendSmsCodeButtonSx = {
  ...authButtonBoldSx,
  bgcolor: '#000',
  color: 'var(--theme-white-color)',
  borderRadius: 999,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { bgcolor: '#000', filter: 'brightness(0.92)' }
};

const sendSmsCooldownButtonSx = {
  ...authButtonBoldSx,
  bgcolor: '#e0e0e0',
  color: 'text.primary',
  borderRadius: 999,
  textTransform: 'none',
  boxShadow: 'none',
  opacity: 0.9,
  '&.Mui-disabled': { bgcolor: '#e0e0e0', color: 'text.primary', opacity: 0.9 }
};

/** Centered above the 6-digit inputs; smaller than body copy so it stays on one line. */
const smsCodeInstructionTextSx = (active) => ({
  mb: 1,
  textAlign: 'center',
  fontWeight: 600,
  fontSize: authEnvTextFontSize,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
  width: '100%',
  color: active ? '#000' : 'text.disabled'
});

/** Compact pill buttons beside / below the 6-digit SMS inputs (Clear, Verify SMS). */
const smsCompactPillButtonSx = {
  borderRadius: 999,
  textTransform: 'none',
  boxShadow: 'none',
  px: { xs: 2.5, sm: 3 },
  py: 1,
  minWidth: 'unset',
  width: 'auto',
  minHeight: { xs: 40, sm: 44 },
  lineHeight: 1.2
};

const verificationSlotInputSx = (hasError, enabled) => ({
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
  borderColor: hasError ? 'error.main' : enabled ? '#000' : '#bdbdbd',
  borderRadius: 1,
  bgcolor: enabled ? '#fff' : '#f5f5f5',
  color: enabled ? 'text.primary' : 'text.disabled',
  cursor: enabled ? 'text' : 'not-allowed',
  '&:focus': enabled
    ? {
        outline: 'none',
        borderColor: 'var(--theme-primary-color)',
        boxShadow: '0 0 0 1px var(--theme-primary-color)'
      }
    : { outline: 'none' }
});

const SIGNUP_SMS_VERIFIED_KEY = 'signupSmsVerified';
const SIGNUP_SMS_BYPASSED_KEY = 'signupSmsBypassed';

function readSmsVerifiedAwaitingPassword() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(SIGNUP_SMS_VERIFIED_KEY) === '1';
}

function readSmsVerificationBypassed() {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(SIGNUP_SMS_BYPASSED_KEY) === '1';
}

export default function AuthCreatePassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') || '');
  const [registrationCode, setRegistrationCode] = useState(() =>
    (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFieldsLocked, setPasswordFieldsLocked] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [signupPhone, setSignupPhone] = useState(() => getSignupPhoneFromSearchParams(searchParams));
  const [smsVerifiedAwaitingPassword, setSmsVerifiedAwaitingPassword] = useState(readSmsVerifiedAwaitingPassword);
  const [smsVerificationBypassed, setSmsVerificationBypassed] = useState(readSmsVerificationBypassed);
  const [bypassSmsPhoneVerification, setBypassSmsPhoneVerification] = useState(false);
  const [bypassSmsInProgress, setBypassSmsInProgress] = useState(false);
  const [publicConfigLoaded, setPublicConfigLoaded] = useState(false);
  const [codeChars, setCodeChars] = useState(() => ['', '', '', '', '', '']);
  const [smsSent, setSmsSent] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isVerifyingSms, setIsVerifyingSms] = useState(false);
  const [sendSmsCooldown, setSendSmsCooldown] = useState(0);
  const [referralStatus, setReferralStatus] = useState('absent');
  const [referrerAlias, setReferrerAlias] = useState('');
  const [referrerMemberCode, setReferrerMemberCode] = useState('');
  const verificationSlotRefs = useRef([]);
  const bypassSmsAttemptedRef = useRef(false);
  const verificationCode = codeChars.join('');
  /** skipped = no code in URL (user types code manually); loading/valid/invalid when code+email present */
  const [linkStatus, setLinkStatus] = useState(() => {
    const em = searchParams.get('email') || '';
    const cd = (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    return em && cd ? 'loading' : 'skipped';
  });

  useEffect(() => {
    const em = searchParams.get('email') || '';
    const cd = (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    setEmail(em);
    setRegistrationCode(cd);
    const phone = getSignupPhoneFromSearchParams(searchParams);
    setSignupPhone(phone);
    if (phone) {
      sessionStorage.setItem(SIGNUP_REGISTER_PHONE_KEY, phone);
    }
    bypassSmsAttemptedRef.current = false;
    getSignupReferralCodeFromSearchParams(searchParams);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          setBypassSmsPhoneVerification(Boolean(data?.bypassSmsPhoneVerification));
          setPublicConfigLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) setPublicConfigLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const urlRef = normalizeSignupReferralCode(searchParams.get('ref') ?? searchParams.get('token') ?? '');
    if (!urlRef || isDefaultReferByCode(urlRef)) {
      setReferralStatus('absent');
      setReferrerAlias('');
      setReferrerMemberCode('');
      return undefined;
    }

    let cancelled = false;
    setReferralStatus('loading');
    setReferrerAlias('');
    setReferrerMemberCode('');

    validateReferralCode(urlRef)
      .then((data) => {
        if (cancelled) return;
        setReferralStatus(data?.valid ? 'valid' : 'invalid');
        setReferrerAlias(data?.referrerAlias ?? '');
        setReferrerMemberCode(data?.referrerMemberCode ?? '');
      })
      .catch(() => {
        if (cancelled) return;
        setReferralStatus('invalid');
        setReferrerAlias('');
        setReferrerMemberCode('');
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  /** Block browser/password-manager autofill on create-password fields. */
  useEffect(() => {
    if (!smsVerifiedAwaitingPassword) return undefined;
    setPassword('');
    setConfirmPassword('');
    setPasswordFieldsLocked(true);
    const timers = [0, 100, 300].map((ms) =>
      window.setTimeout(() => {
        setPassword('');
        setConfirmPassword('');
      }, ms)
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [smsVerifiedAwaitingPassword]);

  /** Task 2: keep phone in the URL so email-link opens with email, code, and phone populated */
  useEffect(() => {
    const em = (email || searchParams.get('email') || '').trim().toLowerCase();
    const cd = (registrationCode || searchParams.get('code') || '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase();
    const phoneDigits = signupPhone.replace(/\D/g, '');
    if (!em || !cd || phoneDigits.length !== 10) return;
    const referralToken = getSignupReferralCodeFromSearchParams(searchParams);
    const hasPhone = Boolean(searchParams.get('phone'));
    const hasToken = Boolean(searchParams.get('token') || searchParams.get('ref'));
    if (hasPhone && hasToken) return;
    const qs = buildCreatePasswordQuery({
      email: em,
      code: cd,
      phone: signupPhone,
      token: referralToken
    });
    navigate(`/pages/createPassword?${qs}`, { replace: true });
  }, [email, registrationCode, signupPhone, searchParams, navigate]);

  const sendSmsCooldownActive = sendSmsCooldown > 0;
  useEffect(() => {
    if (!sendSmsCooldownActive) return undefined;
    const id = setInterval(() => {
      setSendSmsCooldown((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [sendSmsCooldownActive]);

  useEffect(() => {
    const em = searchParams.get('email') || '';
    const cd = (searchParams.get('code') || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    if (!em || !cd) {
      setLinkStatus('skipped');
      setError('');
      return;
    }

    setLinkStatus('loading');
    let cancelled = false;
    verifyRegistrationLink(em, cd)
      .then((data) => {
        if (cancelled) return;
        setLinkStatus(data.valid ? 'valid' : 'invalid');
        if (!data.valid) {
          setError(LINK_CODE_ERROR);
        } else {
          setError('');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLinkStatus('invalid');
          setError(LINK_CODE_ERROR);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!bypassSmsPhoneVerification) return;
    if (linkStatus !== 'valid') return;
    if (smsVerifiedAwaitingPassword) return;
    const phoneDigits = signupPhone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) return;
    const codeTrimmed = registrationCode.trim();
    const emailTrimmedLocal = email.trim();
    if (codeTrimmed.length !== 6 || !emailTrimmedLocal) return;
    if (bypassSmsAttemptedRef.current) return;

    bypassSmsAttemptedRef.current = true;
    let cancelled = false;
    setBypassSmsInProgress(true);
    setError('');

    bypassSignupSmsVerification(codeTrimmed, emailTrimmedLocal, signupPhone)
      .then((data) => {
        if (cancelled) return;
        if (data?.needsPassword) {
          setSmsVerificationBypassed(true);
          setSmsVerifiedAwaitingPassword(true);
          sessionStorage.setItem(SIGNUP_SMS_VERIFIED_KEY, '1');
          sessionStorage.setItem(SIGNUP_SMS_BYPASSED_KEY, '1');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        bypassSmsAttemptedRef.current = false;
        setError(err.message || 'Failed to bypass SMS verification.');
      })
      .finally(() => {
        if (!cancelled) setBypassSmsInProgress(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    bypassSmsPhoneVerification,
    linkStatus,
    smsVerifiedAwaitingPassword,
    signupPhone,
    registrationCode,
    email
  ]);

  const handleCodeChange = (e) => {
    const v = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
    setRegistrationCode(v);
  };

  const handleShowPasswordChange = (event) => {
    setShowPassword(Boolean(event.target.checked));
  };

  // First password: 4 requirements (only first password; confirm only must match)
  const pwRequirement_8Chars = password.length >= 8;
  const pwRequirement_smallLetter = /[a-z]/.test(password);
  const pwRequirement_capitalLetter = /[A-Z]/.test(password);
  const pwRequirement_numberOrSymbol = /[0-9]/.test(password) || /[^a-zA-Z0-9]/.test(password);
  const passwordMeetsAllRequirements =
    pwRequirement_8Chars &&
    pwRequirement_smallLetter &&
    pwRequirement_capitalLetter &&
    pwRequirement_numberOrSymbol;

  const emailTrimmed = email.trim();
  const isEmailFormatValid = EMAIL_PATTERN.test(emailTrimmed);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const codeOk = registrationCode.trim().length === 6;
  const linkAllowsForm = linkStatus === 'skipped' || linkStatus === 'valid';
  const isLinkInvalid = linkStatus === 'invalid';
  const emailCodeVerified = linkStatus === 'valid';
  const isCreatePasswordEnabled =
    linkAllowsForm && isEmailFormatValid && passwordMeetsAllRequirements && passwordsMatch && codeOk;

  const displayPhone = signupPhone;
  const phoneDigitsForValidation = displayPhone.replace(/\D/g, '');
  const hasSignupPhone = phoneDigitsForValidation.length === 10;
  const isVerificationCodeFormatValid = /^\d{6}$/.test(verificationCode);
  const hasAnySmsDigit = codeChars.some((d) => d !== '');
  /** Task 3: enable Send SMS Code as soon as email is verified and phone is available */
  const isSendSmsCodeEnabled = emailCodeVerified && hasSignupPhone && !!emailTrimmed;
  /** After Send SMS: instruction + digit boxes are active (black); before send they stay grey/disabled */
  const isSmsCodeEntryEnabled = smsSent;
  const isClearSmsCodeEnabled = isSmsCodeEntryEnabled && hasAnySmsDigit;
  const isVerifySmsEnabled = isSmsCodeEntryEnabled && isVerificationCodeFormatValid;
  const sendSmsCodeButtonDisabled = isSendingSms || sendSmsCooldownActive || !isSendSmsCodeEnabled;
  const sendSmsCooldownLabel =
    sendSmsCooldown > 0 ? `Wait ${sendSmsCooldown}s For SMS Resend` : '';

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

  const handleSendSmsCode = async () => {
    if (sendSmsCodeButtonDisabled) return;
    setError('');
    const codeTrimmed = registrationCode.trim();
    if (codeTrimmed.length !== 6) {
      setError('Please enter the 6-character code from your registration email.');
      return;
    }
    setIsSendingSms(true);
    try {
      if (smsSent) {
        await resendPhoneCode(emailTrimmed, displayPhone);
      } else {
        await sendRegistrationSms(codeTrimmed, emailTrimmed, displayPhone);
      }
      setSmsSent(true);
      setSendSmsCooldown(60);
    } catch (err) {
      setError(err.message || 'Failed to send code. Please try again.');
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleVerifySms = async (event) => {
    event.preventDefault();
    if (!isVerifySmsEnabled) return;
    setError('');
    setIsVerifyingSms(true);
    try {
      const data = await verifyPhone(emailTrimmed, displayPhone, verificationCode, {
        referByCode: resolveSignupReferByCodeForApi()
      });
      if (data?.needsPassword) {
        setSmsVerifiedAwaitingPassword(true);
        sessionStorage.setItem(SIGNUP_SMS_VERIFIED_KEY, '1');
        return;
      }
      sessionStorage.removeItem(SIGNUP_CREATE_PASSWORD_PAYLOAD_KEY);
      sessionStorage.removeItem(SIGNUP_REGISTER_PHONE_KEY);
      sessionStorage.removeItem(SIGNUP_SMS_VERIFIED_KEY);
      sessionStorage.removeItem(SIGNUP_SMS_BYPASSED_KEY);
      markRefereeRewardUxAfterProfileSetup();
      clearStoredSignupReferralCode();
      navigate(`/pages/phoneVerificationSuccess?email=${encodeURIComponent(emailTrimmed)}`);
    } catch (err) {
      setError(err.message || 'The phone verification code is incorrect. Please enter again or register phone number again.');
    } finally {
      setIsVerifyingSms(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    const codeTrimmed = registrationCode.trim();

    if (!linkAllowsForm) {
      return;
    }
    if (!emailTrimmed) {
      setError('Email is required.');
      return;
    }
    if (codeTrimmed.length !== 6) {
      setError('Please enter the 6-character code from your registration email.');
      return;
    }
    if (!password) {
      setError('Password is required.');
      return;
    }
    if (!passwordMeetsAllRequirements) {
      setError('Please meet all 4 password requirements.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!smsVerifiedAwaitingPassword) {
      setError('Please verify your phone number before creating a password.');
      return;
    }

    setIsSubmitting(true);

    try {
      await createPassword(codeTrimmed, emailTrimmed, password, displayPhone, {
        sendSms: false,
        referByCode: resolveSignupReferByCodeForApi()
      });
      sessionStorage.removeItem(SIGNUP_CREATE_PASSWORD_PAYLOAD_KEY);
      sessionStorage.removeItem(SIGNUP_REGISTER_PHONE_KEY);
      sessionStorage.removeItem(SIGNUP_SMS_VERIFIED_KEY);
      sessionStorage.removeItem(SIGNUP_SMS_BYPASSED_KEY);
      markRefereeRewardUxAfterProfileSetup();
      clearStoredSignupReferralCode();
      navigate(`/pages/phoneVerificationSuccess?email=${encodeURIComponent(emailTrimmed)}`);
    } catch (err) {
      setError(err.message || 'Failed to create password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sectionHeaderSx = {
    bgcolor: 'var(--theme-secondary-color)',
    color: 'var(--theme-white-color)',
    px: 2,
    py: 1.5,
    borderRadius: 1,
    mb: 2,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center'
  };

  /** Pill under verified mail icon (right column) when link verified */
  const emailVerificationPassedStripSx = {
    bgcolor: 'success.main',
    color: 'var(--theme-white-color)',
    py: 0.75,
    px: 1.5,
    borderRadius: 10,
    textAlign: 'center',
    width: '100%',
    boxSizing: 'border-box'
  };

  /** `emailCodeVerified.png` — same 30% shrink as other auth mail icons */
  const emailCodeVerifiedPicSx = {
    width: { xs: 84, sm: 98, md: 112 },
    maxWidth: '100%',
    height: 'auto',
    objectFit: 'contain'
  };

  const outlineNoneSx = {
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
    '&.Mui-error .MuiOutlinedInput-notchedOutline': { border: 'none' }
  };

  const smsVerificationPassedStripSx = {
    bgcolor: 'success.main',
    color: 'var(--theme-white-color)',
    py: 0.75,
    px: 1.5,
    borderRadius: 10,
    textAlign: 'center',
    width: 'max-content',
    maxWidth: '100%',
    boxSizing: 'border-box',
    mt: 2,
    mb: 2
  };

  const createPasswordPlainTitleSx = {
    color: 'var(--theme-primary-color)',
    fontWeight: 700,
    fontSize: '1.875rem',
    textAlign: 'center',
    width: '100%',
    mt: 2,
    mb: 0.5
  };

  const createPasswordPlainSubtitleSx = {
    color: 'var(--theme-primary-color)',
    textAlign: 'center',
    width: '100%',
    mb: 2
  };

  const isPhoneError = !!error && /phone number|10-digit|already associated|different number|sign in/i.test(error);
  const isCodeError =
    !!error &&
    (/code is invalid|invalid, expired, or already used|6-character|request a new registration email|Email does not match|incorrect\. Please try again/i.test(
      error
    ) ||
      error === LINK_CODE_ERROR);
  const registrationCodeLocked = isLinkInvalid || emailCodeVerified;
  const showSmsSection =
    publicConfigLoaded &&
    !bypassSmsPhoneVerification &&
    emailCodeVerified &&
    hasSignupPhone &&
    !smsVerifiedAwaitingPassword &&
    !bypassSmsInProgress;
  const showBypassWaitSpinner =
    emailCodeVerified &&
    hasSignupPhone &&
    !smsVerifiedAwaitingPassword &&
    (!publicConfigLoaded || bypassSmsInProgress);
  const showPasswordForm = linkAllowsForm && smsVerifiedAwaitingPassword;
  const validReferralMessage =
    referralStatus === 'valid' ? formatValidReferralMessage(referrerAlias, referrerMemberCode) : null;

  if (linkStatus === 'loading' || showBypassWaitSpinner) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box component="form" autoComplete="off" onSubmit={smsVerifiedAwaitingPassword ? handleSubmit : handleVerifySms} sx={authFormContentSx}>
      {error && !isPhoneError && !isCodeError && (
        <Typography variant="subtitle1" sx={{ color: 'error.main', fontWeight: 700, textAlign: 'center', mb: 2 }}>
          Error: {error}
        </Typography>
      )}

      {validReferralMessage && emailCodeVerified ? (
        <Typography
          role="status"
          sx={{
            width: '100%',
            px: 1,
            mb: 2,
            textAlign: 'center',
            fontSize: authEnvTextFontSize,
            fontWeight: 600,
            lineHeight: 1.4,
            color: 'var(--theme-success-color, #2e7d32)'
          }}
        >
          {validReferralMessage}
        </Typography>
      ) : null}

      {!emailCodeVerified && (
        <Box sx={sectionHeaderSx}>
          <Typography variant="h6" sx={{ color: 'var(--theme-white-color)', fontWeight: 700, fontSize: '1.875rem' }}>
            Verify email code
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.92)', mt: 0.5 }}>
            Enter the 6-character code we just email to you
          </Typography>
        </Box>
      )}

      {emailCodeVerified ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'flex-start' },
            gap: { xs: 2, sm: 3 },
            width: '100%',
            mb: 2
          }}
        >
          <Stack sx={{ flex: '1 1 auto', minWidth: 0, width: '100%' }}>
            <CustomFormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel htmlFor="outlined-adornment-email-create" sx={{ color: 'var(--theme-primary-color)', '&.Mui-focused': { color: 'var(--theme-primary-color)' }, '&.MuiInputLabel-shrink': { color: 'var(--theme-primary-color)' } }}>
                Email Address
              </InputLabel>
              <OutlinedInput
                id="outlined-adornment-email-create"
                type="email"
                value={email}
                name="email"
                placeholder="you@example.com"
                disabled
                autoComplete="off"
                inputProps={{ readOnly: true, autoComplete: 'off' }}
                required
                sx={{ ...outlineNoneSx, ...createPasswordFieldInputPaddingSx }}
              />
            </CustomFormControl>

            <CustomFormControl fullWidth sx={{ mt: 3, mb: 2 }} error={isCodeError}>
              <InputLabel htmlFor="outlined-adornment-code" sx={{ color: 'var(--theme-primary-color)', '&.Mui-focused': { color: 'var(--theme-primary-color)' }, '&.MuiInputLabel-shrink': { color: 'var(--theme-primary-color)' } }}>
                Registration Code
              </InputLabel>
              <OutlinedInput
                id="outlined-adornment-code"
                type="text"
                value={registrationCode}
                onChange={handleCodeChange}
                name="registrationCode"
                placeholder="e.g. AB12CD"
                disabled={registrationCodeLocked}
                inputProps={{ maxLength: 6, style: { textTransform: 'uppercase', letterSpacing: 2 } }}
                required
                sx={{ ...outlineNoneSx, ...createPasswordFieldInputPaddingSx }}
              />
            </CustomFormControl>
          </Stack>

          <Stack
            sx={{
              flex: '0 0 auto',
              alignItems: 'center',
              gap: 1.25,
              alignSelf: { xs: 'flex-end', sm: 'flex-start' },
              ml: { sm: 'auto' },
              maxWidth: { xs: 'min(100%, 200px)', sm: 'none' }
            }}
          >
            <Box component="img" src={emailCodeVerifiedImg} alt="Email verified" sx={emailCodeVerifiedPicSx} />
            <Box sx={emailVerificationPassedStripSx}>
              <Typography variant="body2" sx={{ color: 'var(--theme-white-color)', fontWeight: 700, letterSpacing: 0.02 }}>
                Email verification PASSED
              </Typography>
            </Box>
          </Stack>
        </Box>
      ) : (
        <>
          <CustomFormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel htmlFor="outlined-adornment-email-create" sx={{ color: 'var(--theme-primary-color)', '&.Mui-focused': { color: 'var(--theme-primary-color)' }, '&.MuiInputLabel-shrink': { color: 'var(--theme-primary-color)' } }}>
              Email Address
            </InputLabel>
            <OutlinedInput
              id="outlined-adornment-email-create"
              type="email"
              value={email}
              name="email"
              placeholder="you@example.com"
              disabled
              inputProps={{ readOnly: true }}
              required
              sx={{
                ...createPasswordFieldInputPaddingSx,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 }
              }}
            />
          </CustomFormControl>

          <CustomFormControl fullWidth sx={{ mt: 3, mb: 2 }} error={isCodeError}>
            <InputLabel htmlFor="outlined-adornment-code" sx={{ color: 'var(--theme-primary-color)', '&.Mui-focused': { color: 'var(--theme-primary-color)' }, '&.MuiInputLabel-shrink': { color: 'var(--theme-primary-color)' } }}>
              Registration Code
            </InputLabel>
            <OutlinedInput
              id="outlined-adornment-code"
              type="text"
              value={registrationCode}
              onChange={handleCodeChange}
              name="registrationCode"
              placeholder="e.g. AB12CD"
              disabled={registrationCodeLocked}
              inputProps={{ maxLength: 6, style: { textTransform: 'uppercase', letterSpacing: 2 } }}
              required
              sx={{
                ...createPasswordFieldInputPaddingSx,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 }
              }}
            />
          </CustomFormControl>
        </>
      )}

      {isCodeError && (
        <Typography variant="subtitle1" sx={{ color: 'error.main', fontWeight: 700, textAlign: 'center', mb: 1.5 }}>
          Error: {error}
        </Typography>
      )}

      {isLinkInvalid && (
        <Box sx={{ mt: 2 }}>
          <AnimateButton>
            <Button
              disableElevation
              fullWidth
              size="large"
              type="button"
              variant="contained"
              onClick={() => navigate('/register')}
              sx={{
                ...authButtonBoldSx,
                bgcolor: 'var(--theme-primary-color)',
                color: 'var(--theme-white-color)',
                '&:hover': { bgcolor: 'var(--theme-primary-color)', filter: 'brightness(0.95)' }
              }}
            >
              Sign Up For Account
            </Button>
          </AnimateButton>
        </Box>
      )}

      {showSmsSection && (
        <>
          <Box
            sx={{
              mt: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              flexWrap: 'nowrap',
              width: '100%',
              minWidth: 0
            }}
          >
            <Typography
              variant="body2"
              sx={{ color: 'var(--theme-primary-color)', fontWeight: 600, flex: '1 1 auto', minWidth: 0 }}
            >
              Phone:{' '}
              <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
                {displayPhone}
              </Box>
            </Typography>

            {smsSent && sendSmsCooldownActive ? (
              <GreenButton disabled>
                {sendSmsCooldownLabel}
              </GreenButton>
            ) : (
              <GreenButton
                onClick={handleSendSmsCode}
                disabled={sendSmsCodeButtonDisabled}
                aria-busy={isSendingSms}
              >
                {isSendingSms
                  ? 'Sending...'
                  : smsSent
                    ? 'Resend SMS Code'
                    : 'Send SMS Code'}
              </GreenButton>
            )}
          </Box>

          <Box sx={{ mt: 2, width: '100%', minWidth: 0 }}>
            <Typography
              variant="body2"
              component="p"
              sx={{
                ...smsCodeInstructionTextSx(isSmsCodeEntryEnabled),
                mb: 1.25
              }}
            >
              Enter code SMS text to your phone below
            </Typography>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto',
                alignItems: 'end',
                columnGap: { xs: 0.5, sm: 1 },
                width: '100%',
                minWidth: 0
              }}
              onPaste={handleVerificationSlotsPaste}
            >
              <Button
                type="button"
                variant="contained"
                size="medium"
                onClick={handleClearVerificationCode}
                disabled={!isClearSmsCodeEnabled}
                sx={{
                  ...authButtonBoldSx,
                  ...smsCompactPillButtonSx,
                  flexShrink: 0,
                  ...(isClearSmsCodeEnabled
                    ? sendSmsCodeButtonSx
                    : {
                        ...phoneFlowGreyButtonDisabledSx,
                        borderRadius: 999,
                        textTransform: 'none',
                        boxShadow: 'none'
                      })
                }}
              >
                Clear
              </Button>

              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexWrap: 'nowrap',
                  gap: { xs: 0.5, sm: 0.75 },
                  minWidth: 0
                }}
              >
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    component="input"
                    inputMode="numeric"
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    maxLength={1}
                    disabled={!isSmsCodeEntryEnabled}
                    value={codeChars[i]}
                    onChange={(e) => handleVerificationSlotChange(i, e)}
                    onKeyDown={(e) => handleVerificationSlotKeyDown(i, e)}
                    ref={(el) => {
                      verificationSlotRefs.current[i] = el;
                    }}
                    sx={verificationSlotInputSx(!!error, isSmsCodeEntryEnabled)}
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
                    disabled={!isSmsCodeEntryEnabled}
                    value={codeChars[i]}
                    onChange={(e) => handleVerificationSlotChange(i, e)}
                    onKeyDown={(e) => handleVerificationSlotKeyDown(i, e)}
                    ref={(el) => {
                      verificationSlotRefs.current[i] = el;
                    }}
                    sx={verificationSlotInputSx(!!error, isSmsCodeEntryEnabled)}
                    aria-label={`Verification code digit ${i + 1} of 6`}
                  />
                ))}
              </Box>

              <GreenButton
                onClick={(e) => void handleVerifySms(e)}
                disabled={isVerifyingSms || !isVerifySmsEnabled}
              >
                {isVerifyingSms ? 'Verifying...' : 'Verify SMS'}
              </GreenButton>
            </Box>
          </Box>
        </>
      )}

      {smsVerifiedAwaitingPassword && !smsVerificationBypassed && (
        <>
          <Typography variant="body2" sx={{ mt: 2, mb: 1.5, color: 'var(--theme-primary-color)', fontWeight: 600 }}>
            Phone:{' '}
            <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
              {displayPhone}
            </Box>
          </Typography>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'nowrap',
              gap: { xs: 0.5, sm: 0.75 },
              width: '100%',
              minWidth: 0
            }}
          >
            {[0, 1, 2].map((i) => (
              <Box
                key={`passed-${i}`}
                component="input"
                readOnly
                disabled
                value={codeChars[i]}
                sx={{
                  ...verificationSlotInputSx(false, false),
                  bgcolor: '#f5f5f5',
                  cursor: 'default'
                }}
                aria-label={`Verification code digit ${i + 1} of 6`}
              />
            ))}
            <Box sx={{ width: { xs: 6, sm: 10 }, flexShrink: 0 }} aria-hidden />
            {[3, 4, 5].map((i) => (
              <Box
                key={`passed-${i}`}
                component="input"
                readOnly
                disabled
                value={codeChars[i]}
                sx={{
                  ...verificationSlotInputSx(false, false),
                  bgcolor: '#f5f5f5',
                  cursor: 'default'
                }}
                aria-label={`Verification code digit ${i + 1} of 6`}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <Box sx={smsVerificationPassedStripSx}>
              <Typography variant="body2" sx={{ color: 'var(--theme-white-color)', fontWeight: 700, letterSpacing: 0.02, whiteSpace: 'nowrap' }}>
                Verify SMS Code PASSES
              </Typography>
            </Box>
          </Box>
        </>
      )}

      {smsVerifiedAwaitingPassword && smsVerificationBypassed && (
        <Typography variant="body2" sx={{ mt: 2, mb: 1.5, color: 'var(--theme-primary-color)', fontWeight: 600 }}>
          Phone:{' '}
          <Box component="span" sx={{ whiteSpace: 'nowrap' }}>
            {displayPhone}
          </Box>
        </Typography>
      )}

      {showPasswordForm && (
        <>
          <Typography component="h2" variant="h6" sx={createPasswordPlainTitleSx}>
            Create password
          </Typography>
          <Typography variant="body2" sx={createPasswordPlainSubtitleSx}>
            Please create your password to continue
          </Typography>

          <CustomFormControl fullWidth>
            <InputLabel htmlFor="outlined-adornment-password-create" sx={{ color: 'var(--theme-primary-color)', '&.Mui-focused': { color: 'var(--theme-primary-color)' }, '&.MuiInputLabel-shrink': { color: 'var(--theme-primary-color)' } }}>
              Password
            </InputLabel>
            <OutlinedInput
              id="outlined-adornment-password-create"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFieldsLocked(false)}
              name="vsingles-new-password"
              autoComplete="new-password"
              readOnly={passwordFieldsLocked}
              required
              label="Password"
              sx={{
                ...createPasswordEntryInputSx,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 }
              }}
            />
            <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
              Password strength:{' '}
              {Math.round(
                ([pwRequirement_8Chars, pwRequirement_smallLetter, pwRequirement_capitalLetter, pwRequirement_numberOrSymbol].filter(Boolean).length / 4) * 100
              )}
              %
            </Typography>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.5,
                mt: 1,
                flexWrap: { xs: 'wrap', sm: 'nowrap' }
              }}
            >
              <Box sx={{ flex: '1 1 auto', minWidth: { xs: '58%', sm: '55%' } }}>
                <Stack component="ul" sx={{ listStyle: 'none', pl: 0, m: 0, gap: 0.5 }}>
                  <Stack component="li" direction="row" alignItems="center" gap={1}>
                    {pwRequirement_8Chars ? <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />}
                    <Typography variant="body2" sx={{ color: pwRequirement_8Chars ? 'success.main' : undefined }}>At least 8 characters</Typography>
                  </Stack>
                  <Stack component="li" direction="row" alignItems="center" gap={1}>
                    {pwRequirement_smallLetter ? <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />}
                    <Typography variant="body2" sx={{ color: pwRequirement_smallLetter ? 'success.main' : undefined }}>At least one small letter</Typography>
                  </Stack>
                  <Stack component="li" direction="row" alignItems="center" gap={1}>
                    {pwRequirement_capitalLetter ? <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />}
                    <Typography variant="body2" sx={{ color: pwRequirement_capitalLetter ? 'success.main' : undefined }}>At least one capital letter</Typography>
                  </Stack>
                  <Stack component="li" direction="row" alignItems="center" gap={1}>
                    {pwRequirement_numberOrSymbol ? <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} /> : <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />}
                    <Typography variant="body2" sx={{ color: pwRequirement_numberOrSymbol ? 'success.main' : undefined }}>At least one number or symbol</Typography>
                  </Stack>
                </Stack>
              </Box>
              <Box
                component="img"
                src={enterPasswordImg}
                alt=""
                sx={{
                  flex: '0 0 auto',
                  width: { xs: 100, sm: 120 },
                  height: 'auto',
                  maxHeight: { xs: 120, sm: 140 },
                  objectFit: 'contain',
                  alignSelf: 'center',
                  ml: { xs: 'auto', sm: 0 }
                }}
              />
            </Box>
          </CustomFormControl>

          <CustomFormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel htmlFor="outlined-adornment-password-confirm" sx={{ color: 'var(--theme-primary-color)', '&.Mui-focused': { color: 'var(--theme-primary-color)' }, '&.MuiInputLabel-shrink': { color: 'var(--theme-primary-color)' } }}>
              Confirm Password
            </InputLabel>
            <OutlinedInput
              id="outlined-adornment-password-confirm"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onFocus={() => setPasswordFieldsLocked(false)}
              name="vsingles-confirm-password"
              autoComplete="new-password"
              readOnly={passwordFieldsLocked}
              required
              label="Confirm Password"
              sx={{
                ...createPasswordEntryInputSx,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--theme-primary-color)', borderWidth: 2 }
              }}
            />
            <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 0.5, pl: { xs: 1.5, sm: 2 } }}>
              {password.length > 0 && password === confirmPassword ? (
                <>
                  <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: 'success.main' }}>Passwords match</Typography>
                </>
              ) : (
                <>
                  <RadioButtonUnchecked sx={{ color: 'text.secondary', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>Passwords Match</Typography>
                </>
              )}
            </Stack>
          </CustomFormControl>

          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1.5, pl: { xs: 1.5, sm: 2 } }}>
            <Checkbox
              checked={showPassword}
              onChange={handleShowPasswordChange}
              name="showPassword"
              color="primary"
              sx={{ p: 0, mr: 1 }}
            />
            <Typography variant="body2" sx={{ color: 'var(--theme-primary-color)' }}>
              Show Password
            </Typography>
          </Box>

          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', width: '100%' }}>
            <GreenButton type="submit" disabled={isSubmitting || !isCreatePasswordEnabled}>
              {isSubmitting ? 'Creating...' : 'Create Password'}
            </GreenButton>
          </Box>
        </>
      )}
    </Box>
  );
}
