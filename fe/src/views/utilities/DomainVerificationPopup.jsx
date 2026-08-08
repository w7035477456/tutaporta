import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { sendDomainVerificationCode, verifyDomainVerificationCode } from 'api/domainVerificationFe';

const domainVerificationBannerBaseSx = {
  width: '100%',
  boxSizing: 'border-box',
  py: 1.25,
  px: { xs: 1, sm: 1.5 },
  textAlign: 'center',
  fontWeight: 700,
  lineHeight: 1.2,
  fontSize: { xs: '3.4vw', sm: '2.5vw' },
  wordBreak: 'break-word'
};

const domainVerificationSuccessBannerSx = {
  ...domainVerificationBannerBaseSx,
  bgcolor: '#43a047',
  color: '#000000'
};

const domainVerificationFailureBannerSx = {
  ...domainVerificationBannerBaseSx,
  bgcolor: '#c62828',
  color: '#ffffff'
};

function formatDomainVerificationSuccessMessage(domain) {
  const label = String(domain ?? '').trim();
  return label ? `Company Domain ${label} Verification Success` : 'Company Domain Verification Success';
}

function formatDomainVerificationIncorrectMessage(domain) {
  const label = String(domain ?? '').trim();
  return label
    ? `Company Domain ${label} verification code incorrect. Use the code from the most recent email, or click Send code again.`
    : 'Company Domain verification code incorrect. Use the code from the most recent email, or click Send code again.';
}

function normalizeSixDigitCode(raw) {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 6);
}

function isValidCompanyEmail(raw) {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractDomainFromEmail(raw) {
  const email = String(raw ?? '')
    .trim()
    .toLowerCase();
  const parts = email.split('@');
  if (parts.length !== 2) return '';
  return parts[1].trim();
}

export default function DomainVerificationPopup({ open, onClose, onVerified, onFailed }) {
  const [companyEmail, setCompanyEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [sendNotice, setSendNotice] = useState('');
  const [sendError, setSendError] = useState('');
  const [verifyOutcome, setVerifyOutcome] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [verifiedDomain, setVerifiedDomain] = useState('');

  const companyEmailValid = useMemo(() => isValidCompanyEmail(companyEmail), [companyEmail]);
  const codeComplete = verificationCode.length === 6;
  const emailDomain = useMemo(() => extractDomainFromEmail(companyEmail), [companyEmail]);
  const canVerify = codeSent && codeComplete && !verifyingCode && verifyOutcome == null;
  const canSendCode = companyEmailValid && !sendingCode && !verifyOutcome && !codeSent;

  useEffect(() => {
    if (!open) {
      setCompanyEmail('');
      setVerificationCode('');
      setSendingCode(false);
      setVerifyingCode(false);
      setCodeSent(false);
      setSendNotice('');
      setSendError('');
      setVerifyOutcome(null);
      setVerifyError('');
      setVerifiedDomain('');
    }
  }, [open]);

  function resetVerificationAttempt() {
    setCodeSent(false);
    setVerificationCode('');
    setVerifyOutcome(null);
    setVerifyError('');
    setVerifiedDomain('');
    setSendNotice('');
  }

  async function handleSendCode() {
    if (!companyEmailValid || sendingCode) return;
    setSendingCode(true);
    setSendError('');
    setSendNotice('');
    setVerifyOutcome(null);
    setVerifyError('');
    setVerifiedDomain('');
    try {
      const data = await sendDomainVerificationCode(companyEmail.trim().toLowerCase());
      setCodeSent(true);
      setSendNotice(data?.message || `Verification code sent to ${companyEmail.trim().toLowerCase()}.`);
    } catch (err) {
      if (err?.response?.status === 401) {
        setSendError('Your login session expired. Log out, log in again, then click Send code.');
      } else {
        setSendError(err?.response?.data?.error || err?.message || 'Failed to send verification code');
      }
    } finally {
      setSendingCode(false);
    }
  }

  async function handleVerifyCode() {
    if (!canVerify) return;
    setVerifyingCode(true);
    setVerifyOutcome(null);
    setVerifyError('');
    setVerifiedDomain('');
    try {
      const data = await verifyDomainVerificationCode(verificationCode, companyEmail.trim().toLowerCase());
      const domain = String(data?.companyDomain ?? extractDomainFromEmail(companyEmail)).trim();
      setVerifiedDomain(domain);
      setVerifyOutcome('success');
      if (onVerified) {
        await onVerified(data);
      }
    } catch (err) {
      const apiError = String(err?.response?.data?.error ?? '').trim();
      if (err?.response?.status === 401) {
        setSendError('Your login session expired. Log out, log in again, then click Verify code.');
      } else if (err?.response?.status === 400) {
        setVerifyError(apiError || 'Verification failed. Click Send code and try again.');
        if (/incorrect/i.test(apiError)) {
          setVerifyOutcome('incorrect');
          setCodeSent(false);
        } else {
          setVerifyOutcome('error');
          if (/expired|send code again/i.test(apiError)) {
            setCodeSent(false);
          }
        }
      } else {
        setSendError(apiError || err?.message || 'Failed to verify code');
        onFailed?.(err);
      }
    } finally {
      setVerifyingCode(false);
    }
  }

  return (
    <ColorTemplate7PopupLargeDark open={open} onClose={onClose} closeOnBackdrop closeButtonAriaLabel="Close work domain verification">
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>Work Domain Verification</ColorTemplate7PopupLargeDark.Title>

        <ColorTemplate7PopupLargeDark.FormRows>
          <ColorTemplate7PopupLargeDark.FormRow label="Company Email">
            <ColorTemplate7PopupLargeDark.Input
              formRow
              size="small"
              placeholder="you@company.com"
              value={companyEmail}
              onChange={(e) => {
                setCompanyEmail(e.target.value.slice(0, 30));
                resetVerificationAttempt();
                setSendNotice('');
                setSendError('');
              }}
              disabled={Boolean(verifyOutcome)}
              error={Boolean(String(companyEmail ?? '').trim()) && !companyEmailValid}
              inputProps={{ maxLength: 30 }}
            />
            <ColorTemplate7PopupLargeDark.ActionButton onClick={handleSendCode} disabled={!canSendCode}>
              {sendingCode ? 'Sending…' : codeSent ? 'Code sent' : 'Send code'}
            </ColorTemplate7PopupLargeDark.ActionButton>
          </ColorTemplate7PopupLargeDark.FormRow>

          <ColorTemplate7PopupLargeDark.FormRow label="Verification Code">
            <ColorTemplate7PopupLargeDark.Input
              formRow
              size="small"
              placeholder="6-digit code"
              value={verificationCode}
              onChange={(e) => {
                setVerificationCode(normalizeSixDigitCode(e.target.value));
                if (verifyOutcome) return;
                setVerifyOutcome(null);
                setVerifyError('');
                setVerifiedDomain('');
              }}
              disabled={!codeSent || Boolean(verifyOutcome)}
              inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
            />
            <ColorTemplate7PopupLargeDark.ActionButton onClick={handleVerifyCode} disabled={!canVerify}>
              {verifyingCode ? 'Verifying…' : 'Verify code'}
            </ColorTemplate7PopupLargeDark.ActionButton>
          </ColorTemplate7PopupLargeDark.FormRow>
        </ColorTemplate7PopupLargeDark.FormRows>

        {sendNotice ? (
          <ColorTemplate7PopupLargeDark.BodyText>
            {sendNotice} Use that email&apos;s code within 5 minutes. Clicking Send code again invalidates earlier emails.
          </ColorTemplate7PopupLargeDark.BodyText>
        ) : null}
        {sendError ? <ColorTemplate7PopupLargeDark.ErrorBar>{sendError}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        {verifyOutcome === 'success' ? (
          <Box sx={domainVerificationSuccessBannerSx} role="status">
            {formatDomainVerificationSuccessMessage(verifiedDomain)}
          </Box>
        ) : null}
        {verifyOutcome === 'incorrect' ? (
          <Box sx={domainVerificationFailureBannerSx} role="alert">
            {verifyError || formatDomainVerificationIncorrectMessage(emailDomain)}
          </Box>
        ) : null}
        {verifyOutcome === 'error' ? (
          <Box sx={domainVerificationFailureBannerSx} role="alert">
            {verifyError || 'Verification failed. Click Send code and try again.'}
          </Box>
        ) : null}

        <ColorTemplate7PopupLargeDark.BodyText>
          If work email domain is restricted (like .gov, then use contract firm email instead)
        </ColorTemplate7PopupLargeDark.BodyText>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

DomainVerificationPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onVerified: PropTypes.func,
  onFailed: PropTypes.func
};
