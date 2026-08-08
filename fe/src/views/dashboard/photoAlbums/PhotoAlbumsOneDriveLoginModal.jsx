import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import { bsizeInputHeightResponsive } from 'config/bsizeEnv';
import ColorTemplate16PopupCenterWide from 'ui-component/ColorTemplate16PopupCenterWide';
import GreenButton from 'ui-component/GreenButton';
import OrangeButton from 'ui-component/OrangeButton';
import BusyHourglass from 'ui-component/BusyHourglass';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { BUSY_HOURGLASS_MODAL_SIZE } from 'config/busyHourglassEnv';
import TutaPhotoAlbumsBrandTitle from './TutaPhotoAlbumsBrandTitle';
import TutaPhotoAlbumsVideoTutorialLink from './TutaPhotoAlbumsVideoTutorialLink';
import TutaPhotoAlbumsRadioMark, {
  tutaPhotoAlbumsNativeRadioInputSx,
  tutaPhotoAlbumsRadioControlWrapSx
} from './TutaPhotoAlbumsRadioMark';
import {
  tutaPhotoAlbumsFormatPostLoginButtonSx,
  tutaPhotoAlbumsMoreChoicesButtonSx,
  tutaPhotoAlbumsOrangePostLoginButtonSx,
  tutaPhotoAlbumsPostLoginActionButtonSx,
  tutaPhotoAlbumsPostLoginButtonRowSx,
  tutaPhotoAlbumsYellowPostLoginButtonSx
} from './tutaPhotoAlbumsPostLoginActionButtonSx';
import { TUTAPHOTOALBUMS_CLOUD_LOGO, TUTAPHOTOALBUMS_CLOUD_LOGIN_TITLE } from './tutaPhotoAlbumsBranding';
import PopupBlockedAllowHelp, { isPopupBlockedErrorMessage } from 'ui-component/PopupBlockedAllowHelp';
const ONEDRIVE_SIGNUP_URL =
  'https://www.microsoft.com/en-us/microsoft-365/onedrive/onedrive-plans-and-pricing';

function rememberedEmailsWaitMessage(elapsedSec) {
  const sec = Math.max(0, Math.floor(Number(elapsedSec) || 0));
  if (sec < 3) {
    return 'Loading remembered OneDrive account emails from the server…';
  }
  if (sec < 10) {
    return `Still loading remembered emails… (${sec}s)\nChecking your saved OneDrive accounts.`;
  }
  return `Still waiting for OneDrive emails… (${sec}s)\nThis can take up to about 20 seconds on a slow connection.`;
}

function scaleResponsiveSize(responsive, factor) {
  return {
    xs: `calc(${responsive.xs} * ${factor})`,
    sm: `calc(${responsive.sm} * ${factor})`
  };
}

const oneDriveTitleSx = {
  textAlign: 'left',
  whiteSpace: 'nowrap',
  overflow: 'visible',
  width: '100%',
  maxWidth: '100%'
};

const oneDriveLabelSx = {
  mb: 0.75,
  textAlign: 'left',
  width: '100%'
};

const oneDriveSelectHeightResponsive = scaleResponsiveSize(bsizeInputHeightResponsive, 1.25);
const oneDriveTypedEmailInputHeightResponsive = scaleResponsiveSize(oneDriveSelectHeightResponsive, 1.25);

/** Shared 50vw column — dropdown, typed email, and buttons share left/right edges. */
const oneDriveControlsColumnSx = {
  width: '50vw',
  maxWidth: '100%',
  alignSelf: 'flex-start',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: 1.5,
  boxSizing: 'border-box'
};

const oneDriveControlFullWidthSx = {
  width: '100%',
  maxWidth: '100%',
  boxSizing: 'border-box'
};

const oneDriveEmailInputSx = (typingActive = false) => ({
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  flex: '1 1 auto',
  alignSelf: 'stretch',
  mx: 0,
  '& .MuiInputBase-root': {
    width: '100%',
    maxWidth: '100%',
    height: oneDriveTypedEmailInputHeightResponsive,
    minHeight: oneDriveTypedEmailInputHeightResponsive,
    bgcolor: typingActive ? 'var(--theme-green-color)' : '#fff',
    color: '#000',
    WebkitTextFillColor: '#000',
    borderColor: typingActive ? 'var(--theme-primary-color)' : 'rgba(0, 0, 0, 0.35)'
  },
  '& .MuiInputBase-input': {
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    caretColor: '#000'
  },
  '& .MuiInputBase-root.Mui-focused': {
    bgcolor: typingActive ? 'var(--theme-green-color)' : '#fff',
    color: '#000',
    WebkitTextFillColor: '#000'
  },
  '& .MuiInputBase-root.Mui-focused .MuiInputBase-input': {
    color: '#000 !important',
    WebkitTextFillColor: '#000 !important',
    caretColor: '#000'
  }
});

const oneDriveFormStackSx = {
  width: '100%',
  alignItems: 'flex-start'
};

const oneDriveActionButtonStackSx = {
  ...oneDriveControlFullWidthSx,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 1
};

const savedEmailRadioListSx = {
  ...oneDriveControlFullWidthSx,
  display: 'flex',
  flexDirection: 'column',
  gap: 0.75
};

const savedEmailRadioRowSx = (selected = false) => ({
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  width: '100%',
  minWidth: 0,
  px: 1,
  py: 0.65,
  bgcolor: selected ? 'var(--theme-green-color)' : '#fff',
  color: '#000',
  border: selected ? '2px solid var(--theme-primary-color)' : '2px solid rgba(0, 0, 0, 0.35)',
  borderRadius: 1,
  cursor: 'pointer',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: buttonFontSizeResponsive.xs,
  lineHeight: 1.25,
  boxSizing: 'border-box',
  '@media (min-width: 600px)': {
    fontSize: buttonFontSizeResponsive.sm
  },
  '&:has(input:focus-visible)': {
    outline: '2px solid var(--theme-yellow-color)',
    outlineOffset: 0
  }
});

const savedEmailRadioLabelSx = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#000',
  WebkitTextFillColor: '#000'
};

const savedEmailsLoadingRowSx = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 1.25,
  width: '100%',
  minWidth: 0,
  px: 1,
  py: 1,
  bgcolor: 'rgba(255, 255, 255, 0.92)',
  color: '#000',
  border: '2px solid rgba(0, 0, 0, 0.35)',
  borderRadius: 1,
  boxSizing: 'border-box'
};

const savedEmailsLoadingTextSx = {
  m: 0,
  minWidth: 0,
  flex: '1 1 auto',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: buttonFontSizeResponsive.xs,
  lineHeight: 1.35,
  color: '#000',
  WebkitTextFillColor: '#000',
  whiteSpace: 'pre-line',
  '@media (min-width: 600px)': {
    fontSize: buttonFontSizeResponsive.sm
  }
};

const oneDriveSignupFooterSx = {
  width: '50vw',
  maxWidth: '100%',
  alignSelf: 'flex-start',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start'
};

const privacyGuaranteeBoxSx = {
  px: 1.25,
  py: 1.25,
  borderRadius: 1,
  border: '2px solid var(--theme-yellow-color)',
  bgcolor: 'var(--theme-secondary-color)'
};

function isOAuthPopupClosedError(message) {
  return /closed before completion/i.test(String(message || ''));
}

function dedupeEmails(emails) {
  const seen = new Set();
  const out = [];
  for (const raw of emails) {
    const value = String(raw || '').trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function oneDriveEmailsMatch(a, b) {
  const left = String(a || '').trim().toLowerCase();
  const right = String(b || '').trim().toLowerCase();
  return Boolean(left && right && left === right);
}

function isOneDriveSessionActiveForEmail(loginEmail, loggedInEmail, connectedEmail) {
  return (
    Boolean(loggedInEmail) &&
    oneDriveEmailsMatch(loggedInEmail, connectedEmail) &&
    oneDriveEmailsMatch(loginEmail, loggedInEmail)
  );
}

export default function PhotoAlbumsOneDriveLoginModal({
  open,
  embedded = false,
  defaultEmail = '',
  savedEmails = [],
  emailsLoading = false,
  busy = false,
  busyLabel = 'Connecting to OneDrive',
  busyProgressPercent = null,
  error = '',
  errorSecondary = '',
  success = '',
  connectedEmail = '',
  loggedInEmail = '',
  hasVault = false,
  needsReformat = false,
  onOpenMyPhotoAlbums,
  onViewOneDrive,
  onBackupRestore,
  onFormatMyPhotoAlbumsFolder,
  onLogin,
  onClose,
  onClearError,
  onSkipOneDrive,
  videoTutorialUrl = ''
}) {
  const [savedEmail, setSavedEmail] = useState('');
  const [typedEmail, setTypedEmail] = useState('');
  const [emailLoadElapsedSec, setEmailLoadElapsedSec] = useState(0);
  /** Compact: Open + More Choices. Expanded: full 2×2 grid + signup footer. */
  const [showMoreChoices, setShowMoreChoices] = useState(false);
  const savedEmailInitializedRef = useRef(false);
  /** Avoid re-firing auto TutaPhotos for the same email until the user changes it. */
  const autoTutaPhotosEmailRef = useRef('');

  const emailOptions = useMemo(() => dedupeEmails(savedEmails), [savedEmails]);

  const visibleError = isOAuthPopupClosedError(error) ? '' : error;
  const visibleErrorSecondary = isOAuthPopupClosedError(error) ? '' : errorSecondary;
  const clearError = () => {
    if (typeof onClearError === 'function') onClearError();
  };

  const typedEmailActive = typedEmail.length > 0;

  const loginEmail = useMemo(() => {
    const typed = String(typedEmail || '').trim();
    if (typed) return typed;
    return String(savedEmail || '').trim();
  }, [typedEmail, savedEmail]);

  const sessionActive = useMemo(
    () => isOneDriveSessionActiveForEmail(loginEmail, loggedInEmail, connectedEmail),
    [loginEmail, loggedInEmail, connectedEmail]
  );

  /** Valid TutaPhotoAlbums cloud vault only — Open/View/Backup. Missing/broken → Format only. */
  const cloudVaultBroken = Boolean(needsReformat);
  const canFormatCloud = sessionActive && !busy;
  const canOpenCloud = canFormatCloud && Boolean(hasVault) && !cloudVaultBroken;
  const canViewOrBackupCloud = canFormatCloud && Boolean(hasVault) && !cloudVaultBroken;

  const visibleSuccess = sessionActive ? String(success || '').trim() : '';
  const showRememberedEmailsSection = emailsLoading || emailOptions.length > 0;
  const emailsWaitDetail = rememberedEmailsWaitMessage(emailLoadElapsedSec);

  useEffect(() => {
    if (!open) {
      savedEmailInitializedRef.current = false;
      autoTutaPhotosEmailRef.current = '';
      setShowMoreChoices(false);
      return;
    }
    setTypedEmail('');
  }, [open]);

  useEffect(() => {
    if (!open || !emailsLoading) {
      setEmailLoadElapsedSec(0);
      return undefined;
    }
    const startedAt = Date.now();
    setEmailLoadElapsedSec(0);
    const timer = window.setInterval(() => {
      setEmailLoadElapsedSec(Math.floor((Date.now() - startedAt) / 1000));
    }, 500);
    return () => {
      window.clearInterval(timer);
    };
  }, [open, emailsLoading]);

  useEffect(() => {
    if (!open || emailsLoading || savedEmailInitializedRef.current) return;
    if (!emailOptions.length) {
      setSavedEmail('');
      savedEmailInitializedRef.current = true;
      return;
    }
    const preferred = String(defaultEmail || '').trim();
    const preferredKey = preferred.toLowerCase();
    const match = emailOptions.find((option) => option.toLowerCase() === preferredKey);
    setSavedEmail(match || emailOptions[0]);
    savedEmailInitializedRef.current = true;
  }, [open, emailsLoading, defaultEmail, emailOptions]);

  /** Green Open → password gate. OneDrive connect is automatic (no TutaPhotos button). */
  const handleOpenCloud = () => {
    if (!canOpenCloud || busy) return;
    onOpenMyPhotoAlbums?.();
  };

  const handleSubmit = () => {
    if (canOpenCloud) {
      handleOpenCloud();
      return;
    }
    const value = String(loginEmail || '').trim();
    if (!value || busy || sessionActive) return;
    onLogin?.(value);
  };

  /**
   * Auto-connect once a login email is ready so Open TutaPhotoAlbums Cloud
   * turns green without a separate TutaPhotos button.
   */
  useEffect(() => {
    if (!open || busy || sessionActive || emailsLoading) return;
    const value = String(loginEmail || '').trim();
    if (!value) return;
    if (showRememberedEmailsSection && !savedEmailInitializedRef.current) return;
    const key = value.toLowerCase();
    if (autoTutaPhotosEmailRef.current === key) return;
    autoTutaPhotosEmailRef.current = key;
    onLogin?.(value);
  }, [
    open,
    busy,
    sessionActive,
    emailsLoading,
    loginEmail,
    showRememberedEmailsSection,
    onLogin
  ]);

  const handleOpenOneDriveSignup = () => {
    window.open(ONEDRIVE_SIGNUP_URL, '_blank', 'noopener,noreferrer');
  };

  const controlsColumnSx = embedded
    ? { ...oneDriveControlsColumnSx, width: '100%' }
    : oneDriveControlsColumnSx;
  const signupFooterSx = embedded ? { ...oneDriveSignupFooterSx, width: '100%' } : oneDriveSignupFooterSx;

  const panelBody = (
    <>
      <ColorTemplate16PopupCenterWide.Title sx={oneDriveTitleSx}>
        <TutaPhotoAlbumsBrandTitle
          logoSrc={TUTAPHOTOALBUMS_CLOUD_LOGO}
          title={TUTAPHOTOALBUMS_CLOUD_LOGIN_TITLE}
          logoSize={64}
          fitWidth
          sx={{ width: '100%', flexWrap: 'nowrap' }}
          labelSx={{
            color: 'inherit',
            WebkitTextFillColor: 'inherit',
            fontWeight: 800,
            lineHeight: 1.1
          }}
        />
      </ColorTemplate16PopupCenterWide.Title>
      <TutaPhotoAlbumsVideoTutorialLink
        href={videoTutorialUrl}
        label="Click here for video tutorial on TutaPhotoAlbums"
      />
      <ColorTemplate16PopupCenterWide.Body spacing={2}>
        <Box
          component="form"
          autoComplete="off"
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <Stack spacing={1.5} sx={oneDriveFormStackSx}>
            <Box sx={controlsColumnSx}>
              {showRememberedEmailsSection ? (
                <Box sx={oneDriveControlFullWidthSx}>
                  <ColorTemplate16PopupCenterWide.BodyText sx={oneDriveLabelSx}>
                    Choose a remembered One Drive account email
                  </ColorTemplate16PopupCenterWide.BodyText>
                  {emailsLoading ? (
                    <Box
                      role="status"
                      aria-live="polite"
                      aria-label={emailsWaitDetail.replace(/\n/g, ' ')}
                      sx={savedEmailsLoadingRowSx}
                    >
                      <BusyHourglass fontSize={{ xs: '2.4rem', sm: '2.8rem' }} />
                      <Box component="p" sx={savedEmailsLoadingTextSx}>
                        {emailsWaitDetail}
                      </Box>
                    </Box>
                  ) : (
                    <Box
                      role="radiogroup"
                      aria-label="Remembered OneDrive emails"
                      sx={savedEmailRadioListSx}
                    >
                      {emailOptions.map((option) => {
                        const checked = oneDriveEmailsMatch(savedEmail, option) && !typedEmailActive;
                        return (
                          <Box
                            key={option}
                            component="label"
                            sx={savedEmailRadioRowSx(checked)}
                          >
                            <Box sx={tutaPhotoAlbumsRadioControlWrapSx}>
                              <Box
                                component="input"
                                type="radio"
                                name="record-vault-remembered-onedrive-email"
                                value={option}
                                checked={checked}
                                disabled={busy}
                                onChange={() => {
                                  setSavedEmail(option);
                                  setTypedEmail('');
                                }}
                                sx={tutaPhotoAlbumsNativeRadioInputSx}
                              />
                              <TutaPhotoAlbumsRadioMark selected={checked} disabled={busy} />
                            </Box>
                            <Box component="span" sx={savedEmailRadioLabelSx} title={option}>
                              {option}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              ) : null}

              <Box sx={oneDriveControlFullWidthSx}>
                <ColorTemplate16PopupCenterWide.BodyText sx={oneDriveLabelSx}>
                  Or enter new One Drive Account Email:
                </ColorTemplate16PopupCenterWide.BodyText>
                <ColorTemplate16PopupCenterWide.Input
                  formRow
                  fullWidth
                  type="text"
                  name="record-vault-new-onedrive-email"
                  value={typedEmail}
                  disabled={busy}
                  onChange={(event) => setTypedEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleSubmit();
                    }
                  }}
                  sx={oneDriveEmailInputSx(typedEmailActive)}
                  inputProps={{
                    autoComplete: 'off',
                    autoCorrect: 'off',
                    autoCapitalize: 'off',
                    spellCheck: 'false',
                    inputMode: 'email',
                    'data-form-type': 'other',
                    'data-lpignore': 'true',
                    'data-1p-ignore': 'true'
                  }}
                />
              </Box>

              <Box sx={oneDriveActionButtonStackSx}>
                <Box sx={tutaPhotoAlbumsPostLoginButtonRowSx}>
                  {showMoreChoices ? (
                    <>
                      <GreenButton
                        type="button"
                        singleLineLabel={false}
                        onClick={() => setShowMoreChoices(false)}
                        sx={tutaPhotoAlbumsPostLoginActionButtonSx}
                      >
                        Less Choices
                      </GreenButton>
                      <GreenButton
                        type="button"
                        singleLineLabel={false}
                        disabled={!canViewOrBackupCloud}
                        onClick={() => onViewOneDrive?.()}
                        sx={tutaPhotoAlbumsYellowPostLoginButtonSx}
                      >
                        View OneDrive Cloud
                      </GreenButton>
                      <GreenButton
                        type="button"
                        singleLineLabel={false}
                        disabled={!canViewOrBackupCloud}
                        onClick={() => onBackupRestore?.()}
                        sx={tutaPhotoAlbumsOrangePostLoginButtonSx}
                      >
                        Backup &amp; Restore Cloud
                      </GreenButton>
                      <GreenButton
                        type="button"
                        singleLineLabel={false}
                        disabled={!canFormatCloud}
                        onClick={() => onFormatMyPhotoAlbumsFolder?.()}
                        sx={tutaPhotoAlbumsFormatPostLoginButtonSx}
                      >
                        Format TutaPhotoAlbums Cloud
                      </GreenButton>
                    </>
                  ) : (
                    <>
                      <GreenButton
                        type="button"
                        singleLineLabel={false}
                        disabled={!canOpenCloud}
                        aria-busy={busy && sessionActive}
                        onClick={handleOpenCloud}
                        sx={tutaPhotoAlbumsPostLoginActionButtonSx}
                      >
                        {busy && sessionActive ? 'Opening…' : 'Open TutaPhotoAlbums Cloud'}
                      </GreenButton>
                      <GreenButton
                        type="button"
                        singleLineLabel={false}
                        onClick={() => setShowMoreChoices(true)}
                        sx={tutaPhotoAlbumsMoreChoicesButtonSx}
                      >
                        More Choices
                      </GreenButton>
                    </>
                  )}
                </Box>
              </Box>

              {showMoreChoices && sessionActive && (!hasVault || needsReformat) ? (
                <ColorTemplate16PopupCenterWide.SectionDescription
                  sx={{ color: 'var(--theme-yellow-color)', fontWeight: 700, mb: 0 }}
                >
                  {needsReformat
                    ? 'Cloud vault is invalid or outdated. Use Format TutaPhotoAlbums Cloud, then set up again.'
                    : 'No valid TutaPhotoAlbums vault on this OneDrive. Use Format TutaPhotoAlbums Cloud to create one.'}
                </ColorTemplate16PopupCenterWide.SectionDescription>
              ) : null}

              {showMoreChoices ? (
                <Box sx={{ width: '100%' }}>
                  <ColorTemplate16PopupCenterWide.BodyText sx={{ mt: 0, mb: 0, width: '100%', textAlign: 'left', fontSize: '0.92rem' }}>
                    Microsoft offer extremely cheap rate storage:
                  </ColorTemplate16PopupCenterWide.BodyText>
                  <ColorTemplate16PopupCenterWide.BodyText sx={{ mt: 0.25, mb: 0, width: '100%', textAlign: 'left', fontSize: '0.92rem' }}>
                    * Free 5g Cloud Storage
                  </ColorTemplate16PopupCenterWide.BodyText>
                  <ColorTemplate16PopupCenterWide.BodyText sx={{ mt: 0.25, mb: 0, width: '100%', textAlign: 'left', fontSize: '0.92rem' }}>
                    * Upgrade: $1.99/m or only $19.9/year for 100gb Cloud Storage
                  </ColorTemplate16PopupCenterWide.BodyText>
                </Box>
              ) : null}
            </Box>

            {showMoreChoices ? (
              <Box sx={signupFooterSx}>
                <OrangeButton type="button" onClick={handleOpenOneDriveSignup}>
                  Register new OneDrive
                </OrangeButton>
              </Box>
            ) : null}

            {!embedded ? (
              <Box sx={privacyGuaranteeBoxSx}>
                <ColorTemplate16PopupCenterWide.SectionTitle leadLine sx={{ mb: 0.75, textAlign: 'left' }}>
                  The MyPhotoAlbums Privacy Commitment: 🔐
                </ColorTemplate16PopupCenterWide.SectionTitle>
                <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                  <Box component="li" sx={{ mb: 1 }}>
                    <ColorTemplate16PopupCenterWide.BodyText sx={{ mb: 0 }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        Zero Server Storage:
                      </Box>{' '}
                      Your entire Records Vault (text, images, and data) lives exclusively in your OneDrive. We store
                      nothing on our servers.
                    </ColorTemplate16PopupCenterWide.BodyText>
                  </Box>
                  <Box component="li">
                    <ColorTemplate16PopupCenterWide.BodyText sx={{ mb: 0 }}>
                      <Box component="span" sx={{ fontWeight: 700 }}>
                        Encrypted at Rest:
                      </Box>{' '}
                      All data in your vault is fully encrypted before it reaches OneDrive. Even if your storage is lost or
                      stolen, your information remains permanently locked and impenetrable.
                    </ColorTemplate16PopupCenterWide.BodyText>
                  </Box>
                </Box>
              </Box>
            ) : null}

            {visibleSuccess ? (
              <ColorTemplate16PopupCenterWide.SectionDescription
                sx={{ color: '#b8f5c3', fontWeight: 700, whiteSpace: 'pre-wrap', mb: 0 }}
              >
                {visibleSuccess}
              </ColorTemplate16PopupCenterWide.SectionDescription>
            ) : null}
          </Stack>
        </Box>
      </ColorTemplate16PopupCenterWide.Body>

      <ColorTemplate16PopupCenterWide
        open={Boolean(visibleError)}
        onClose={clearError}
        closeOnBackdrop
        closeButtonAriaLabel="Close Cloud error"
      >
        <ColorTemplate16PopupCenterWide.Body spacing={2}>
          <ColorTemplate16PopupCenterWide.Title>TutaPhotoAlbums Cloud</ColorTemplate16PopupCenterWide.Title>
          {isPopupBlockedErrorMessage(visibleError) ? <PopupBlockedAllowHelp /> : null}
          <ColorTemplate16PopupCenterWide.ErrorBar sx={{ whiteSpace: 'pre-wrap' }}>{visibleError}</ColorTemplate16PopupCenterWide.ErrorBar>
          {visibleErrorSecondary ? (
            <ColorTemplate16PopupCenterWide.SectionDescription
              sx={{ color: '#ffb4a9', fontWeight: 600, whiteSpace: 'pre-wrap', mb: 0, textAlign: 'center' }}
            >
              {visibleErrorSecondary}
            </ColorTemplate16PopupCenterWide.SectionDescription>
          ) : null}
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate16PopupCenterWide.ActionButton onClick={clearError}>OK</ColorTemplate16PopupCenterWide.ActionButton>
          </Stack>
        </ColorTemplate16PopupCenterWide.Body>
      </ColorTemplate16PopupCenterWide>
    </>
  );

  const showSkipOneDrive =
    busy &&
    typeof onSkipOneDrive === 'function' &&
    /connecting to onedrive/i.test(String(busyLabel || ''));

  return (
    <>
      <BusyHourglassOverlay
        open={open && busy}
        label={busyLabel}
        progressPercent={busyProgressPercent}
        progressLabel={busyLabel}
        fontSize={BUSY_HOURGLASS_MODAL_SIZE}
        actionLabel={showSkipOneDrive ? 'Skip OneDrive' : ''}
        onAction={showSkipOneDrive ? onSkipOneDrive : undefined}
      />
      {embedded ? (
        <Box sx={{ width: '100%' }}>{panelBody}</Box>
      ) : (
        <ColorTemplate16PopupCenterWide
          open={open}
          onClose={busy ? undefined : onClose}
          closeOnBackdrop={false}
        >
          {panelBody}
        </ColorTemplate16PopupCenterWide>
      )}
    </>
  );
}
