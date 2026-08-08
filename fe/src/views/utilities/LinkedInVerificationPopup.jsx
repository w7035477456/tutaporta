import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { LINKEDIN_PROFILE_URL_MAX_CHARS } from 'constants/linkedinProfileUrl';
import { openLinkedInVerifyPopup, openLinkedInProfileWindow } from 'utils/linkedinOAuth';
import { fetchLinkedInStatus, saveLinkedInProfileUrl, saveSelfReportedEmployment } from 'api/linkedinVerificationFe';
import { withRequiredLabelSuffix } from './IdentificationVerificationBoard';
import PopupBlockedAllowHelp, { isPopupBlockedErrorMessage } from 'ui-component/PopupBlockedAllowHelp';

function renderReadOnlyProfileField(key, label, profileFields) {
  return (
    <ColorTemplate7PopupLargeDark.FormRow key={key} label={label}>
      <ColorTemplate7PopupLargeDark.Input
        formRow
        fullWidth
        size="small"
        value={String(profileFields?.[key] ?? '')}
        InputProps={{ readOnly: true }}
        placeholder=""
        inputProps={key === 'profileUrl' ? { maxLength: LINKEDIN_PROFILE_URL_MAX_CHARS } : undefined}
      />
    </ColorTemplate7PopupLargeDark.FormRow>
  );
}

function normalizeLinkedInProfileUrl(raw) {
  let value = String(raw ?? '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) {
    value = `https://${value.replace(/^\/+/, '')}`;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'linkedin.com') return '';
    const path = url.pathname.replace(/\/+$/, '');
    if (!/^\/in\/[^/]+$/i.test(path)) return '';
    return `https://www.linkedin.com${path.toLowerCase()}`;
  } catch {
    return '';
  }
}

export default function LinkedInVerificationPopup({
  open,
  onClose,
  onVerified,
  onFailed,
  onEmploymentSaved,
  defaultFirstName = '',
  defaultLastName = '',
  defaultProfileUrl = '',
  defaultJobTitle = '',
  defaultCurrentCompany = ''
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [configured, setConfigured] = useState(null);
  const [error, setError] = useState('');
  const [profileFields, setProfileFields] = useState(null);
  const [success, setSuccess] = useState(false);
  const [viewingLinkedIn, setViewingLinkedIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const profileUrlValid = useMemo(() => Boolean(normalizeLinkedInProfileUrl(profileUrl)), [profileUrl]);
  const canConnect =
    Boolean(String(firstName ?? '').trim()) &&
    Boolean(String(lastName ?? '').trim()) &&
    profileUrlValid &&
    !connecting &&
    configured !== false &&
    !success;

  useEffect(() => {
    if (!open) {
      setFirstName('');
      setLastName('');
      setProfileUrl('');
      setJobTitle('');
      setCurrentCompany('');
      setConnecting(false);
      setError('');
      setProfileFields(null);
      setSuccess(false);
      setViewingLinkedIn(false);
      setSaving(false);
      return;
    }
    setFirstName(String(defaultFirstName ?? '').trim());
    setLastName(String(defaultLastName ?? '').trim());
    setProfileUrl(String(defaultProfileUrl ?? '').trim());
    setJobTitle(String(defaultJobTitle ?? '').trim());
    setCurrentCompany(String(defaultCurrentCompany ?? '').trim());
    setError('');
    setProfileFields(null);
    setSuccess(false);
    void fetchLinkedInStatus()
      .then((data) => setConfigured(Boolean(data?.configured)))
      .catch(() => setConfigured(false));
  }, [open, defaultFirstName, defaultLastName, defaultProfileUrl, defaultJobTitle, defaultCurrentCompany]);

  // Task 1 + 3: open the entered profile URL in a popup window and persist it to vet_bio.linkedin_url.
  // (LinkedIn forbids iframe embedding via X-Frame-Options/CSP, so a popup window is the only live view.)
  async function handleViewLinkedIn() {
    const normalizedUrl = normalizeLinkedInProfileUrl(profileUrl);
    if (!normalizedUrl) {
      setError('Enter a valid LinkedIn profile URL first.');
      return;
    }
    setViewingLinkedIn(true);
    setError('');
    const win = openLinkedInProfileWindow(normalizedUrl);
    if (!win) {
      setError('Popup blocked. Allow popups for this site and try again.');
    }
    try {
      await saveLinkedInProfileUrl(normalizedUrl);
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Could not save LinkedIn URL.');
    } finally {
      setViewingLinkedIn(false);
    }
  }

  async function handleConnectLinkedIn() {
    if (!canConnect) return;
    setConnecting(true);
    setError('');
    setProfileFields(null);
    setSuccess(false);
    try {
      const normalizedUrl = normalizeLinkedInProfileUrl(profileUrl);
      const result = await openLinkedInVerifyPopup({
        profileUrl: normalizedUrl,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        jobTitle: jobTitle.trim(),
        currentCompany: currentCompany.trim()
      });
      const fields = {
        ...(result?.profile || {}),
        jobTitle: jobTitle.trim(),
        currentCompany: currentCompany.trim()
      };
      setProfileFields(fields);
      setSuccess(true);
      if (onVerified) {
        await onVerified({ profile: fields, message: 'LinkedIn Search verification complete.' });
      }
    } catch (err) {
      const message = err?.message || 'LinkedIn Search failed.';
      setError(message);
      if (onFailed) onFailed(new Error(message));
    } finally {
      setConnecting(false);
    }
  }

  async function persistManualEntries() {
    const trimmedJobTitle = jobTitle.trim();
    const trimmedCurrentCompany = currentCompany.trim();
    const normalizedUrl = normalizeLinkedInProfileUrl(profileUrl);

    if (!success && (trimmedJobTitle || trimmedCurrentCompany)) {
      await saveSelfReportedEmployment({
        jobTitle: trimmedJobTitle,
        currentCompany: trimmedCurrentCompany
      });
      if (onEmploymentSaved) {
        await onEmploymentSaved();
      }
    }

    if (normalizedUrl) {
      await saveLinkedInProfileUrl(normalizedUrl);
    }
  }

  async function handleSaveAndExit() {
    if (saving || connecting) return;
    setSaving(true);
    setError('');
    try {
      await persistManualEntries();
      onClose();
    } catch (err) {
      const message = err?.response?.data?.error || err?.message || 'Could not save your entries.';
      setError(message);
      if (onFailed) onFailed(new Error(message));
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (saving || connecting) return;
    const trimmedJobTitle = jobTitle.trim();
    const trimmedCurrentCompany = currentCompany.trim();
    if (!success && (trimmedJobTitle || trimmedCurrentCompany)) {
      setSaving(true);
      try {
        await persistManualEntries();
      } catch (err) {
        const message = err?.response?.data?.error || err?.message || 'Could not save employment details.';
        setError(message);
        if (onFailed) onFailed(new Error(message));
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    onClose();
  }

  return (
    <ColorTemplate7PopupLargeDark open={open} onClose={handleClose} closeOnBackdrop closeButtonAriaLabel="Close LinkedIn Search">
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <ColorTemplate7PopupLargeDark.Title>Identification Verification</ColorTemplate7PopupLargeDark.Title>

        <ColorTemplate7PopupLargeDark.FormRows>
          <ColorTemplate7PopupLargeDark.FormRow label={withRequiredLabelSuffix('First Name')}>
            <ColorTemplate7PopupLargeDark.Input
              formRow
              size="small"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value.slice(0, 80));
                setError('');
                setSuccess(false);
              }}
              disabled={connecting || success}
            />
          </ColorTemplate7PopupLargeDark.FormRow>

          <ColorTemplate7PopupLargeDark.FormRow label={withRequiredLabelSuffix('Last Name')}>
            <ColorTemplate7PopupLargeDark.Input
              formRow
              size="small"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value.slice(0, 80));
                setError('');
                setSuccess(false);
              }}
              disabled={connecting || success}
            />
          </ColorTemplate7PopupLargeDark.FormRow>

          <ColorTemplate7PopupLargeDark.FormRow label="job titles">
            <ColorTemplate7PopupLargeDark.Input
              formRow
              fullWidth
              size="small"
              value={jobTitle}
              onChange={(e) => {
                setJobTitle(e.target.value.slice(0, 255));
                setError('');
                setSuccess(false);
              }}
              disabled={connecting || success}
              placeholder="Enter your current job title"
            />
          </ColorTemplate7PopupLargeDark.FormRow>

          <ColorTemplate7PopupLargeDark.FormRow label="current company details">
            <ColorTemplate7PopupLargeDark.Input
              formRow
              fullWidth
              size="small"
              value={currentCompany}
              onChange={(e) => {
                setCurrentCompany(e.target.value.slice(0, 255));
                setError('');
                setSuccess(false);
              }}
              disabled={connecting || success}
              placeholder="Enter your current company name"
            />
          </ColorTemplate7PopupLargeDark.FormRow>

          <ColorTemplate7PopupLargeDark.FormRow
            label={withRequiredLabelSuffix('LinkedIn profile & URL')}
            controlsSx={{ flexDirection: 'column', alignItems: 'stretch', gap: 1 }}
          >
            <ColorTemplate7PopupLargeDark.Input
              formRow
              fullWidth
              size="small"
              placeholder="www.linkedin.com/in/your-profile"
              value={profileUrl}
              onChange={(e) => {
                setProfileUrl(e.target.value.slice(0, LINKEDIN_PROFILE_URL_MAX_CHARS));
                setError('');
                setSuccess(false);
              }}
              disabled={connecting || success}
              error={Boolean(String(profileUrl ?? '').trim()) && !profileUrlValid}
              inputProps={{ maxLength: LINKEDIN_PROFILE_URL_MAX_CHARS }}
            />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <ColorTemplate7PopupLargeDark.ActionButton
                onClick={handleViewLinkedIn}
                disabled={!profileUrlValid || viewingLinkedIn || saving}
              >
                {viewingLinkedIn ? 'Opening…' : 'View LinkedIn'}
              </ColorTemplate7PopupLargeDark.ActionButton>
              <ColorTemplate7PopupLargeDark.ActionButton
                onClick={handleConnectLinkedIn}
                disabled={!canConnect || saving}
              >
                {connecting ? 'Connecting…' : success ? 'Connected' : 'Connect LinkedIN'}
              </ColorTemplate7PopupLargeDark.ActionButton>
              <ColorTemplate7PopupLargeDark.ActionButton onClick={handleSaveAndExit} disabled={connecting || saving}>
                {saving ? 'Saving…' : 'Save&Exit'}
              </ColorTemplate7PopupLargeDark.ActionButton>
            </Box>
          </ColorTemplate7PopupLargeDark.FormRow>
        </ColorTemplate7PopupLargeDark.FormRows>

        {configured === false ? (
          <ColorTemplate7PopupLargeDark.ErrorBar>
            LinkedIn OAuth is not configured on this server. Add ClientId and PrimaryClientSecret to ~/.ssh/be/.env, register the redirect
            URL in the LinkedIn Developer Portal, then restart the backend.
          </ColorTemplate7PopupLargeDark.ErrorBar>
        ) : null}

        <Typography
          component="p"
          sx={{
            color: 'var(--theme-yellow-color, #FFEB3B)',
            textAlign: 'center',
            fontSize: { xs: '0.85rem', sm: '0.95rem' },
            m: 0,
            px: 1
          }}
        >
          (All below info should automatically come from LinkedIn, once partnership establish)
        </Typography>

        {renderReadOnlyProfileField('userId', 'user IDs', profileFields)}
        {renderReadOnlyProfileField('names', 'names', profileFields)}
        {renderReadOnlyProfileField('city', 'cities', profileFields)}
        {renderReadOnlyProfileField('jobTitle', 'job titles', profileFields)}
        {renderReadOnlyProfileField('profileUrl', 'profiles', profileFields)}
        {renderReadOnlyProfileField('posts', 'posts', profileFields)}
        {renderReadOnlyProfileField('currentCompany', 'current company details', profileFields)}
        {renderReadOnlyProfileField('workExperience', 'work experience', profileFields)}

        {success ? (
          <ColorTemplate7PopupLargeDark.BodyText>
            LinkedIn Search verification complete. Name and member id were verified via Sign In with LinkedIn using OpenID Connect.
          </ColorTemplate7PopupLargeDark.BodyText>
        ) : null}

        {error ? (
          <>
            {isPopupBlockedErrorMessage(error) ? <PopupBlockedAllowHelp /> : null}
            <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar>
          </>
        ) : null}

        <ColorTemplate7PopupLargeDark.BodyText>
          Sign In with LinkedIn (OpenID Connect) provides name, email, photo, and member id. Enter your job title and current
          company above before connecting — LinkedIn does not share those via Sign In. City, work experience, and reading posts require
          additional LinkedIn partner API products (Talent, Sales, or Member Data Portability).
        </ColorTemplate7PopupLargeDark.BodyText>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

LinkedInVerificationPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onVerified: PropTypes.func,
  onFailed: PropTypes.func,
  onEmploymentSaved: PropTypes.func,
  defaultFirstName: PropTypes.string,
  defaultLastName: PropTypes.string,
  defaultProfileUrl: PropTypes.string,
  defaultJobTitle: PropTypes.string,
  defaultCurrentCompany: PropTypes.string
};
