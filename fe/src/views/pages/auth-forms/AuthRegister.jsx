import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

// material-ui
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

// project imports
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import ColorTemplate16InputTemplate from 'ui-component/ColorTemplate16InputTemplate';
import { registerUser } from 'api/registerFe';
import { completeGoogleSignup } from 'api/googleSignupFe';
import enterEmailImg from 'assets/images/enterEmail.png';
import enterPhoneImg from 'assets/images/enterPhone.png';

import { getDesktopIconSizeVw } from 'config/desktopFontEnv';
import { formatPhoneNumber, SIGNUP_REGISTER_PHONE_KEY } from 'utils/signupParams';
import {
  getUsSignupPhoneValidationMessage,
  validateUsSignupPhone
} from 'utils/usPhoneValidation';
import { getSignupReferralCodeFromSearchParams } from 'utils/signupReferralCode';
import { authRegisterFormContentSx } from '../authentication/authPageLayoutSx';
import GoogleSignupButton from 'ui-component/GoogleSignupButton';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import {
  openGoogleSignupPopup,
  resolveGoogleSignupPrefillEmail,
  readStoredGoogleSignupEmail,
  readStoredGoogleSignupToken,
  clearGoogleSignupToken
} from 'utils/googleSignupOAuth';
import { LIGHT_SURFACE_CLASS } from 'utils/themeContrast';
import { useAuth } from 'contexts/AuthContext';
import { ADMIN_TOOLS_PATH } from 'constants/adminToolsRoute';

// ===========================|| JWT - REGISTER ||=========================== //

const EMAIL_EXISTS_MSG = 'This email already exist in out system. Please double check your email.';
const PHONE_EXISTS_MSG =
  'This phone number is already associated with an account. Please use a different number or sign in.';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmailAlreadyRegisteredMessage(msg) {
  const text = String(msg ?? '').toLowerCase();
  return text.includes('already exist') || text.includes(EMAIL_EXISTS_MSG.toLowerCase());
}

function isPhoneAlreadyRegisteredMessage(msg) {
  const text = String(msg ?? '');
  return text.includes(PHONE_EXISTS_MSG) || /phone number is already associated/i.test(text);
}

const primaryInstructionLineSx = {
  mt: 2,
  mb: 1,
  color: 'var(--theme-primary-color)',
  textAlign: 'left',
  width: '100%',
  lineHeight: 1.35
};

const emailFieldWithImageRowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  width: '100%',
  minWidth: 0
};

/** Input grows with the row; image stays a fixed width flush to the right edge. */
const emailFieldInputColSx = {
  flex: '1 1 0%',
  minWidth: 0,
  maxWidth: '100%'
};

const emailFieldImageSx = {
  flex: '0 0 auto',
  flexShrink: 0,
  width: { xs: 67, sm: 78 },
  height: 'auto',
  maxHeight: { xs: 62, sm: 70 },
  objectFit: 'contain',
  alignSelf: 'center'
};

/** fe/.env DESKTOP_ICON_SIZE — SMS consent checkbox */
const registerConsentCheckboxSx = {
  p: 0,
  mr: 1,
  mt: 0.25,
  flexShrink: 0,
  '& .MuiSvgIcon-root': {
    width: getDesktopIconSizeVw(),
    height: getDesktopIconSizeVw(),
    fontSize: getDesktopIconSizeVw()
  }
};

/** I agree copy — always black on #FFF2CD regardless of theme */
const registerConsentCopyBoxSx = {
  bgcolor: '#FFF2CD',
  flex: 1,
  minWidth: 0,
  p: 1.25,
  borderRadius: 1
};

const registerConsentLinkSx = {
  color: '#000000',
  fontWeight: 700,
  textDecoration: 'underline',
  fontSize: 'inherit',
  '&:hover': { color: '#000000', textDecoration: 'underline' }
};

export default function AuthRegister() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { refreshSessionAfterExternalLogin } = useAuth();
  const [checked, setChecked] = useState(false);
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleSignupEnabled, setGoogleSignupEnabled] = useState(false);
  const [googleBound, setGoogleBound] = useState(false);
  const [googleSignupToken, setGoogleSignupToken] = useState('');
  const [error, setError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const emailTrimmed = email.trim();
  const isEmailFormatValid = EMAIL_PATTERN.test(emailTrimmed);
  const isPhoneFormatValid = validateUsSignupPhone(phone).valid;
  const derivedEmailError =
    emailError || (emailTrimmed.length > 0 && !isEmailFormatValid ? 'Please enter a valid email address.' : '');
  const derivedPhoneError = phoneError || getUsSignupPhoneValidationMessage(phone);
  /** Sign Up enabled only when valid email + area code + 7-digit line + consent checked. */
  const isSignUpEnabled =
    checked &&
    isEmailFormatValid &&
    isPhoneFormatValid &&
    emailTrimmed.length > 0 &&
    !derivedEmailError &&
    !derivedPhoneError;

  const navigateAfterGoogleLogin = useCallback(async () => {
    await refreshSessionAfterExternalLogin();
    const from = location.state?.from;
    if (from?.pathname) {
      navigate(
        { pathname: from.pathname, search: from.search || '', hash: from.hash || '' },
        { replace: true }
      );
      return;
    }
    navigate('/mall', { replace: true });
  }, [refreshSessionAfterExternalLogin, location.state, navigate]);

  const handleEmailChange = (e) => {
    if (googleBound) return;
    setEmail(e.target.value);
    setEmailError('');
    setError('');
  };

  const handlePhoneChange = (e) => {
    setPhone(formatPhoneNumber(e.target.value));
    setPhoneError('');
    setError('');
  };

  useEffect(() => {
    getSignupReferralCodeFromSearchParams(searchParams);
    const fromGoogle = resolveGoogleSignupPrefillEmail(searchParams);
    const storedToken = readStoredGoogleSignupToken();
    if (fromGoogle && storedToken) {
      setEmail(fromGoogle);
      setGoogleBound(true);
      setGoogleSignupToken(storedToken);
      setEmailError('');
    } else if (fromGoogle) {
      setEmail(fromGoogle);
      setEmailError('');
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (typeof data.googleSignupEnabled === 'boolean') {
          setGoogleSignupEnabled(data.googleSignupEnabled);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleGoogleSignup = useCallback(async () => {
    setError('');
    setEmailError('');
    setGoogleBusy(true);
    try {
      const result = await openGoogleSignupPopup();
      if (result.action === 'login') {
        clearGoogleSignupToken();
        setGoogleBound(false);
        setGoogleSignupToken('');
        await navigateAfterGoogleLogin();
        return;
      }
      setEmail(result.email);
      setGoogleBound(true);
      setGoogleSignupToken(result.signupToken || '');
      setEmailError('');
    } catch (err) {
      const storedEmail = readStoredGoogleSignupEmail();
      if (storedEmail) setEmail(storedEmail);
      const msg = err?.message || 'Google sign-up failed.';
      if (!/cancelled|closed before completion/i.test(msg)) {
        setError(msg);
      }
    } finally {
      setGoogleBusy(false);
    }
  }, [navigateAfterGoogleLogin]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setEmailError('');
    setPhoneError('');
    if (!checked) {
      setError('Please agree to the terms and conditions.');
      return;
    }
    if (!emailTrimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!isEmailFormatValid) {
      setError('Please enter a valid email address.');
      return;
    }
    const phoneValidationMessage = getUsSignupPhoneValidationMessage(phone);
    if (!isPhoneFormatValid) {
      setPhoneError(phoneValidationMessage || 'Please enter a valid US phone number.');
      return;
    }
    setIsSubmitting(true);

    try {
      const formattedPhone = formatPhoneNumber(phone);
      if (formattedPhone) {
        sessionStorage.setItem(SIGNUP_REGISTER_PHONE_KEY, formattedPhone);
      }

      if (googleBound && (googleSignupToken || readStoredGoogleSignupToken())) {
        const data = await completeGoogleSignup({
          email: emailTrimmed,
          phone: formattedPhone,
          signupToken: googleSignupToken || readStoredGoogleSignupToken(),
          termsAccepted: true
        });
        clearGoogleSignupToken();
        if (data?.user?.tools_only) {
          await refreshSessionAfterExternalLogin();
          navigate(ADMIN_TOOLS_PATH, { replace: true });
          return;
        }
        await navigateAfterGoogleLogin();
        return;
      }

      await registerUser(emailTrimmed, formattedPhone);
      navigate('/pages/registrationEmailed', { state: { email: emailTrimmed, phone: formattedPhone } });
    } catch (err) {
      console.error('Registration error:', err);
      const msg = err?.response?.data?.error || err.message || 'Failed to register. Please try again.';
      if (isPhoneAlreadyRegisteredMessage(msg)) {
        setPhoneError(PHONE_EXISTS_MSG);
      } else if (isEmailAlreadyRegisteredMessage(msg)) {
        setEmailError(EMAIL_EXISTS_MSG);
      } else {
        setError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={authRegisterFormContentSx}>
      {googleSignupEnabled ? (
        <>
          <GoogleSignupButton disabled={isSubmitting} busy={googleBusy} onClick={() => void handleGoogleSignup()} />
          <Divider sx={{ my: 2, color: 'var(--theme-primary-color)', '&::before, &::after': { borderColor: 'var(--theme-primary-color)' } }}>
            <Typography variant="body2" sx={{ color: 'var(--theme-primary-color)', fontWeight: 700, px: 1 }}>
              Or
            </Typography>
          </Divider>
        </>
      ) : null}

      <Box sx={emailFieldWithImageRowSx}>
        <Box sx={emailFieldInputColSx}>
          <ColorTemplate16InputTemplate
            id="outlined-adornment-email-register"
            label="Email Address"
            type="email"
            value={email}
            onChange={handleEmailChange}
            name="email"
            required
            inputProps={googleBound ? { readOnly: true } : undefined}
          />
        </Box>
        <Box component="img" src={enterEmailImg} alt="" sx={emailFieldImageSx} />
      </Box>
      {googleBound ? (
        <Typography
          variant="body1"
          sx={{
            mt: 1.5,
            mb: 0.5,
            fontWeight: 700,
            color: '#d32f2f',
            lineHeight: 1.4,
            textAlign: 'left',
            width: '100%'
          }}
        >
          Congratulation, Signup with Google Success
          <br />
          Now just need add Phone below
        </Typography>
      ) : null}
      {derivedEmailError && (
        <Typography variant="body2" sx={{ mt: 0.5, mb: 0, fontWeight: 500, color: 'var(--theme-error-color)' }}>
          {derivedEmailError}
        </Typography>
      )}
      <Typography variant="body2" sx={{ mt: 1, mb: 0, color: 'var(--theme-primary-color)' }}>
        For your security, we limit one account per person per phone number and email. You can update your email address anytime in your account settings.
      </Typography>

      <Typography variant="body2" sx={primaryInstructionLineSx}>
        Enter the phone tied to this account
      </Typography>
      <Box sx={emailFieldWithImageRowSx}>
        <Box sx={emailFieldInputColSx}>
          <ColorTemplate16InputTemplate
            id="outlined-adornment-phone-register"
            label="Phone Number"
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            name="phone"
            required
          />
        </Box>
        <Box component="img" src={enterPhoneImg} alt="" sx={emailFieldImageSx} />
      </Box>
      {derivedPhoneError && (
        <Typography
          variant="body2"
          sx={{ mt: 0.75, mb: 0, fontWeight: 700, color: 'var(--theme-error-color)', lineHeight: 1.35 }}
        >
          {derivedPhoneError}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'flex-start', mt: 2, mb: 1.5 }}>
        <Checkbox
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          name="checked"
          color="primary"
          sx={registerConsentCheckboxSx}
        />
        <Box className={LIGHT_SURFACE_CLASS} sx={registerConsentCopyBoxSx}>
          <Typography variant="body2" sx={{ color: '#000000' }}>
            I agree to the{' '}
            <Typography
              component="a"
              href="/pages/termsAndConditions"
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              sx={registerConsentLinkSx}
            >
              Terms &amp; Conditions
            </Typography>{' '}
            and{' '}
            <Typography
              component="a"
              href="/pages/privacyPolicy"
              target="_blank"
              rel="noopener noreferrer"
              variant="body2"
              sx={registerConsentLinkSx}
            >
              Privacy Policy
            </Typography>
            . By checking this box and providing my number, I also give explicit consent to receive automated one-time identity verification codes and account security alerts from OnlineMall.Website and Vetted Singles (VSingles). Consent is not a condition of purchase. Message and data rates may apply. Message frequency varies. Reply HELP for help or STOP to cancel.
          </Typography>
        </Box>
      </Box>

      {error && (
        <Typography variant="body2" color="error" sx={{ mt: 1, mb: 1 }}>
          {error}
        </Typography>
      )}

      <Box sx={{ mt: 2 }}>
        <SelectedButtonTemplate
          fullWidth
          fitLabelWidth={false}
          type="submit"
          disabled={isSubmitting || !isSignUpEnabled}
        >
          {isSubmitting ? (googleBound ? 'Creating account…' : 'Sending...') : 'Sign Up'}
        </SelectedButtonTemplate>
      </Box>
    </Box>
  );
}
