import PropTypes from 'prop-types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'contexts/AuthContext';
import { isAdminImpersonationBypassSession } from 'utils/adminSession';
import { isPilotUserCategory } from 'utils/memberCategory';
import { clearSignupIdentificationVerificationRequired } from 'utils/signupIdentificationVerification';
import { MY_STORY_PATH, needsProfilePhotoSetup } from 'utils/profilePhotoSetup';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import FormControlLabel from '@mui/material/FormControlLabel';
import CheckIcon from '@mui/icons-material/Check';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { COLOR_TEMPLATE7_POPUP_TEXT, colorTemplate7PopupCheckboxShellSx } from 'config/colorTemplate7PopupLargeDark';
import Stack from '@mui/material/Stack';
import { formatCapitalizedFullName, FULLNAME_MIDDLE_MAX_LENGTH } from 'utils/fullNameFormat';
import {
  fetchRekognitionLivenessResults,
  fetchRekognitionStatus,
  verifyIdentityWithRekognition,
  captureDriverLicenseFromIdImage,
  previewFaceMatchForIdImage,
  previewLiveScanProfileMatch,
  postIdVerificationManualSupportEmail,
  markOver18Verified
} from 'api/rekognitionFe';
import { normalizeVerificationImageFile, normalizeVerificationImageFromUrl } from 'utils/normalizeVerificationImage';
import { uploadMyPhoto, setProfilePhoto } from 'api/myPhotosFe';
import { openLiveFaceScanPopup } from 'utils/openLiveFaceScanPopup';
import { LIVE_FACE_SCAN_POPUP_PHASE } from 'utils/liveFaceScanPopupProtocol';
import { postIdVerificationDateOnClose } from 'api/vetBioVerificationServicesFe';
import { postSaveConsentRecord } from 'api/consentRecordFe';
import {
  CONSENT_DESCRIPTION_IDENTIFICATION_VERIFICATION,
  CONSENT_WATERMARK_VARIANTS
} from 'constants/consentRecordVariants';
import { captureElementAsPng } from 'utils/captureConsentDialogImage';
import { formatLiveFaceScanUserError } from 'utils/livenessErrorMessage';
import { sanitizeUserFacingTechTerms } from 'utils/sanitizeUserFacingTechTerms';
import { themedAlert } from 'utils/themedDialog';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import IdentificationVerificationBoard, {
  IdvActionButton,
  RequiredLabelSuffix,
  WIZARD_STEP_DRIVER_LICENSE,
  WIZARD_STEP_LIVE_SCAN,
  WIZARD_STEP_PASSPORT,
  WIZARD_STEP_PROFILE
} from './IdentificationVerificationBoard';
import { loadIdVerificationSamplePreviews } from 'constants/idVerificationSampleImages';
import DobOcrTracePanel, {
  logDobOcrTraceToConsole,
  PpDobOcrTracePanel,
  PpSexOcrTracePanel,
  SexOcrTracePanel,
  logSexOcrTraceToConsole
} from './DobOcrTracePanel';
import { formatDebugTimestamp, isRekognitionDebugUiEnabled } from 'utils/rekognitionDebugUi';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';

function ageFromDobText(dobText) {
  const m = String(dobText ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = parseInt(m[1], 10);
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) return null;
  const today = new Date();
  let age = today.getFullYear() - year;
  const beforeBirthday =
    today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

const VERIFICATION_COMPLETE_PREFIX = 'Verification complete';

const IDV_WIZARD_STEP_CONSENT = 1;

const DEFAULT_LIVENESS_RETRY_COOLDOWN_MINUTES = 5;

const BIOMETRIC_CONSENT_CHECKBOX_GREEN = '#43a047';
const BIOMETRIC_CONSENT_CHECKBOX_GREEN_BORDER = '#2e7d32';

function BiometricConsentCheckboxIcon({ checked = false }) {
  return (
    <Box
      sx={{
        ...colorTemplate7PopupCheckboxShellSx(),
        ...(checked
          ? {
              bgcolor: `${BIOMETRIC_CONSENT_CHECKBOX_GREEN} !important`,
              border: `3px solid ${BIOMETRIC_CONSENT_CHECKBOX_GREEN_BORDER} !important`
            }
          : {})
      }}
    >
      {checked ? <CheckIcon sx={{ color: '#ffffff', width: '70%', height: '70%' }} aria-hidden /> : null}
    </Box>
  );
}

const livenessStartVideoCheckButtonSx = {
  bgcolor: '#43a047 !important',
  color: '#ffffff !important',
  WebkitTextFillColor: '#ffffff !important',
  border: '2px solid #2e7d32 !important',
  boxShadow: 'none !important',
  minHeight: { xs: 72, sm: 80 },
  height: 'auto',
  py: { xs: 1.25, sm: 1.5 },
  px: { xs: 2.5, sm: 3 },
  fontSize: { xs: '1.25rem', sm: '1.5rem' },
  fontWeight: 700,
  lineHeight: 1.2,
  alignSelf: 'center',
  '&:hover': {
    bgcolor: '#388e3c !important',
    boxShadow: 'none !important'
  },
  '&:disabled': {
    bgcolor: 'rgba(67, 160, 71, 0.45) !important',
    color: '#ffffff !important',
    WebkitTextFillColor: '#ffffff !important'
  }
};

const livenessCameraWrapSx = {
  width: '100%',
  maxWidth: 640,
  mx: 'auto',
  display: 'flex',
  justifyContent: 'center'
};

const idUploadPanelSx = {
  width: '100%',
  border: '3px solid #000',
  borderRadius: 1,
  p: { xs: 1.5, sm: 2 },
  boxSizing: 'border-box'
};

const verificationAccountPanelSx = {
  alignSelf: 'stretch',
  width: { xs: 'calc(100% + 16px)', sm: 'calc(100% + 32px)' },
  maxWidth: 'none',
  mx: { xs: -1, sm: -2 },
  bgcolor: '#ffffff',
  color: '#000000 !important',
  WebkitTextFillColor: '#000000 !important',
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 0,
  p: { xs: 1.25, sm: 1.5 },
  boxSizing: 'border-box',
  fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
  fontWeight: 500,
  lineHeight: 1.35
};

const livenessScanTitleFontSx = {
  fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
  fontWeight: 700,
  lineHeight: 1.25
};

const LIVENESS_PASS_LABEL_COLOR = '#43a047';
const LIVENESS_FAIL_LABEL_COLOR = '#d32f2f';
const LIVENESS_PASS_FAIL_TEXT_STROKE = '1px #000000';

function livenessPassFailLabelSx(passed) {
  return {
    color: passed ? LIVENESS_PASS_LABEL_COLOR : LIVENESS_FAIL_LABEL_COLOR,
    WebkitTextFillColor: passed ? LIVENESS_PASS_LABEL_COLOR : LIVENESS_FAIL_LABEL_COLOR,
    WebkitTextStroke: LIVENESS_PASS_FAIL_TEXT_STROKE,
    paintOrder: 'stroke fill'
  };
}

function resolveLivenessPassFailLabel(result) {
  if (!result) return 'FAIL';
  return result.passFailLabel || (result.passed ? 'PASS' : 'FAIL');
}

function livenessRetryCooldownMsFromMinutes(minutes) {
  const n = Number(minutes);
  const mins = Number.isFinite(n) && n >= 0 ? n : DEFAULT_LIVENESS_RETRY_COOLDOWN_MINUTES;
  return Math.round(mins * 60 * 1000);
}

function formatLivenessRetryCountdown(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds) || 0);
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  return `${minutes} min ${seconds} sec`;
}

function formatLivenessRetryLockdownLabel(totalSeconds) {
  return `Retry in ${formatLivenessRetryCountdown(totalSeconds)}`;
}

function formatLivenessConfidencePercent(confidence) {
  const n = Number(confidence);
  if (!Number.isFinite(n)) return '—';
  return String(Math.round(n));
}

function fileInputSx() {
  return { width: '100%' };
}

/** Preserve uploaded image aspect ratio (no horizontal stretch in the dialog). */
const uploadPreviewImgSx = {
  display: 'block',
  width: 'auto',
  height: 'auto',
  maxWidth: '100%',
  maxHeight: 220,
  objectFit: 'contain',
  borderRadius: 1,
  mx: 'auto'
};

const uploadPreviewWrapSx = {
  display: 'flex',
  justifyContent: 'center',
  width: '100%'
};

const consentNameFormGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'max-content max-content' },
  gap: 1.25,
  alignItems: 'center',
  rowGap: 1.5
};

const wizardStepHeadingSx = {
  fontWeight: 700,
  textAlign: 'left',
  width: '100%',
  mb: 0.5
};

const idvCaptureSummarySx = {
  width: '100%',
  border: '2px solid var(--theme-primary-color)',
  borderRadius: 1,
  p: { xs: 1.25, sm: 1.5 },
  boxSizing: 'border-box'
};

export default function RekognitionVerifyDialog({
  open,
  onClose,
  accountEmail,
  singlesId,
  onVerified,
  onFailed
}) {
  const { user, profilePhotoCacheBust, bumpProfilePhotoCache, updateSessionProfilePhoto, refreshAuthProfilePhoto, logout, updateSessionOver18Verified } =
    useAuth();
  const adminImpersonationBypass = isAdminImpersonationBypassSession(user);
  const showPilotSkip = isPilotUserCategory(user?.member_category);
  const navigate = useNavigate();
  const consentCaptureRef = useRef(null);
  const dlAutoProcessRef = useRef({ key: '', inFlight: false });
  const ppAutoProcessRef = useRef({ key: '', inFlight: false });
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentFirstName, setConsentFirstName] = useState('');
  const [consentMiddleInitial, setConsentMiddleInitial] = useState('');
  const [consentLastName, setConsentLastName] = useState('');
  const [livenessSessionId, setLivenessSessionId] = useState('');
  const [livenessRegion, setLivenessRegion] = useState('');
  const [livenessIdentityPoolId, setLivenessIdentityPoolId] = useState('');
  const [livenessPassed, setLivenessPassed] = useState(false);
  const [livenessCheckResult, setLivenessCheckResult] = useState(null);
  const [livenessLoading, setLivenessLoading] = useState(false);
  const [livenessRetryAvailableAt, setLivenessRetryAvailableAt] = useState(0);
  const [livenessRetryCountdownSec, setLivenessRetryCountdownSec] = useState(0);
  const [debugLog, setDebugLog] = useState([]);
  const [driverLicensePreview, setDriverLicensePreview] = useState('');
  const [driverLicenseUserUploaded, setDriverLicenseUserUploaded] = useState(false);
  const [passportPreview, setPassportPreview] = useState('');
  const [passportUserUploaded, setPassportUserUploaded] = useState(false);
  const [profilePhotoLoadFailed, setProfilePhotoLoadFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [closing, setClosing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [result, setResult] = useState(null);
  const [dobOcrTrace, setDobOcrTrace] = useState(null);
  const [sexOcrTrace, setSexOcrTrace] = useState(null);
  const [passportDobOcrTrace, setPassportDobOcrTrace] = useState(null);
  const [passportSexOcrTrace, setPassportSexOcrTrace] = useState(null);
  const [profilePhotoReady, setProfilePhotoReady] = useState(false);
  const [profileVerified, setProfileVerified] = useState(false);
  const [profileMatchPct, setProfileMatchPct] = useState(null);
  const [profileVerifying, setProfileVerifying] = useState(false);
  const [profileVerifyError, setProfileVerifyError] = useState('');
  const [profileManualSupport, setProfileManualSupport] = useState(false);
  const [driverLicenseVerified, setDriverLicenseVerified] = useState(false);
  const [driverLicenseMatchPct, setDriverLicenseMatchPct] = useState(null);
  const [driverLicenseVerifying, setDriverLicenseVerifying] = useState(false);
  const [driverLicenseVerifyError, setDriverLicenseVerifyError] = useState('');
  const [driverLicenseManualSupport, setDriverLicenseManualSupport] = useState(false);
  const [passportVerified, setPassportVerified] = useState(false);
  const [passportMatchPct, setPassportMatchPct] = useState(null);
  const [passportVerifying, setPassportVerifying] = useState(false);
  const [passportVerifyError, setPassportVerifyError] = useState('');
  const [passportManualSupport, setPassportManualSupport] = useState(false);
  const [manualSupportEmailSent, setManualSupportEmailSent] = useState(false);
  const [manualSupportEmailSending, setManualSupportEmailSending] = useState(false);
  const [driverLicenseExtracted, setDriverLicenseExtracted] = useState(null);
  const [passportExtracted, setPassportExtracted] = useState(null);
  const [liveFaceVerified, setLiveFaceVerified] = useState(false);
  const [liveFaceMatchPct, setLiveFaceMatchPct] = useState(null);
  const [liveFaceVerifying, setLiveFaceVerifying] = useState(false);
  const [liveFaceVerifyError, setLiveFaceVerifyError] = useState('');
  const [liveFaceSnapshotPreview, setLiveFaceSnapshotPreview] = useState('');
  const [liveScanVideoSent, setLiveScanVideoSent] = useState(false);
  const [liveScanVideoRecorded, setLiveScanVideoRecorded] = useState(false);
  const [liveScanManualVideoFallback, setLiveScanManualVideoFallback] = useState(false);
  const liveScanManualVideoFallbackRef = useRef(false);
  const [wizardStep, setWizardStep] = useState(IDV_WIZARD_STEP_CONSENT);
  const [captureForSave, setCaptureForSave] = useState(false);

  const verificationCompleteShown = Boolean(result);

  const effectiveSinglesId = Number(singlesId) || Number(user?.singles_id) || 0;

  const profilePhotoUrl = useMemo(() => {
    const photoId = Number(user?.profile_image_fk);
    if (Number.isFinite(photoId) && photoId > 0) {
      return `${getApiBaseUrl()}/api/photo/${photoId}?v=${profilePhotoCacheBust}`;
    }
    if (effectiveSinglesId > 0) {
      return `${getApiBaseUrl()}/api/profile-photo/${effectiveSinglesId}?v=${profilePhotoCacheBust}`;
    }
    return '';
  }, [effectiveSinglesId, user?.profile_image_fk, profilePhotoCacheBust]);

  const skipLiveFaceScan = Boolean(status?.skipLiveFaceScan);
  const skipDlPassportCheck = Boolean(status?.skipDlPassportCheck);
  const requirePhysicalDriverLicenseUpload = !skipDlPassportCheck && !adminImpersonationBypass;
  const profileSlotReady = profilePhotoReady && !profilePhotoLoadFailed && Boolean(profilePhotoUrl);
  const driverLicenseSlotReady = Boolean(driverLicensePreview) || (adminImpersonationBypass && driverLicenseVerified);
  const passportSlotReady = Boolean(passportPreview) || (adminImpersonationBypass && passportVerified);
  const driverLicenseReady = adminImpersonationBypass
    ? driverLicenseVerified
    : driverLicenseUserUploaded && Boolean(driverLicensePreview);
  const liveFaceSlotReady =
    skipLiveFaceScan || livenessPassed || (skipDlPassportCheck && profileSlotReady);
  const verifyButtonsEnabled = profileSlotReady && driverLicenseReady && liveFaceSlotReady;
  const consentValid =
    consentChecked && Boolean(String(consentFirstName || '').trim()) && Boolean(String(consentLastName || '').trim());
  const faceMatchThreshold = status?.faceMatchThreshold ?? 90;
  const liveScanMatchSatisfied =
    skipLiveFaceScan ||
    (liveFaceVerified &&
      liveFaceMatchPct != null &&
      Number(liveFaceMatchPct) >= Number(faceMatchThreshold));
  const identificationSlotsVerified = skipDlPassportCheck
    ? true
    : adminImpersonationBypass
      ? liveScanMatchSatisfied ||
        (profileVerified && driverLicenseVerified && (!passportUserUploaded || passportVerified))
      : profileVerified &&
        driverLicenseVerified &&
        (!passportUserUploaded || passportVerified);
  const allSlotsVerified = identificationSlotsVerified && liveScanMatchSatisfied;
  const liveScanVideoReady = liveScanVideoRecorded || liveScanVideoSent;
  const canSaveAfterLiveScanVideo = skipDlPassportCheck
    ? liveScanVideoReady
    : liveScanVideoReady &&
      profileVerified &&
      driverLicenseVerified &&
      (!passportUserUploaded || passportVerified);
  const canSaveVerification = allSlotsVerified || canSaveAfterLiveScanVideo;
  const consentValidForSave = consentValid;

  const wizardStep1Complete = consentValid;
  const wizardStep2Complete = profileSlotReady && !profilePhotoLoadFailed;
  const wizardStep3Complete =
    driverLicenseReady && driverLicenseVerified && profileVerified && !driverLicenseVerifying;
  const wizardStep4Complete = !passportVerifying;

  const canAdvanceWizardStep = useMemo(() => {
    if (wizardStep === IDV_WIZARD_STEP_CONSENT) return wizardStep1Complete;
    if (wizardStep === WIZARD_STEP_PROFILE) return wizardStep2Complete;
    if (wizardStep === WIZARD_STEP_DRIVER_LICENSE) return wizardStep3Complete;
    if (wizardStep === WIZARD_STEP_PASSPORT) return wizardStep4Complete;
    return false;
  }, [
    wizardStep,
    wizardStep1Complete,
    wizardStep2Complete,
    wizardStep3Complete,
    wizardStep4Complete
  ]);

  function wizardStepAdvanceErrorMessage() {
    if (wizardStep === IDV_WIZARD_STEP_CONSENT) {
      return 'Consent and legal name are required before continuing.';
    }
    if (wizardStep === WIZARD_STEP_PROFILE) {
      if (profilePhotoLoadFailed) return 'Could not load your profile photo. Upload a new profile photo to continue.';
      return 'Your profile photo must load before continuing.';
    }
    if (wizardStep === WIZARD_STEP_DRIVER_LICENSE) {
      if (driverLicenseVerifying || profileVerifying) {
        return 'Driver license processing is still running. Wait for it to finish.';
      }
      if (requirePhysicalDriverLicenseUpload && !driverLicenseUserUploaded) {
        return 'Upload your driver license before continuing.';
      }
      if (!driverLicenseVerified) return 'Driver license processing must finish before continuing.';
      if (!profileVerified) return 'Profile photo must match your driver license before continuing.';
      return 'Complete driver license verification before continuing.';
    }
    if (wizardStep === WIZARD_STEP_PASSPORT) {
      if (passportVerifying) return 'Passport processing is still running. Wait for it to finish.';
      if (passportUserUploaded && !passportVerified) {
        return 'Passport processing must finish before continuing, or skip passport upload.';
      }
    }
    return 'Complete this step before continuing.';
  }

  function advanceWizardStep(step) {
    if (skipDlPassportCheck && step === IDV_WIZARD_STEP_CONSENT) return WIZARD_STEP_LIVE_SCAN;
    if (step === WIZARD_STEP_DRIVER_LICENSE) return WIZARD_STEP_LIVE_SCAN;
    return Math.min(WIZARD_STEP_LIVE_SCAN, step + 1);
  }

  function retreatWizardStep(step) {
    if (skipDlPassportCheck && step === WIZARD_STEP_LIVE_SCAN) return IDV_WIZARD_STEP_CONSENT;
    if (step === WIZARD_STEP_LIVE_SCAN) return WIZARD_STEP_DRIVER_LICENSE;
    return Math.max(IDV_WIZARD_STEP_CONSENT, step - 1);
  }

  function handleWizardNext() {
    if (!canAdvanceWizardStep) {
      setErrorText(wizardStepAdvanceErrorMessage());
      return;
    }
    setErrorText('');
    setWizardStep((step) => advanceWizardStep(step));
  }

  function handleWizardPrevious() {
    if (wizardStep <= IDV_WIZARD_STEP_CONSENT) return;
    setErrorText('');
    setWizardStep((step) => retreatWizardStep(step));
  }

  const consentFullName = useMemo(
    () => formatCapitalizedFullName(consentFirstName, consentMiddleInitial, consentLastName),
    [consentFirstName, consentMiddleInitial, consentLastName]
  );

  const showDebugUi = isRekognitionDebugUiEnabled(status);

  const appendDebugLog = useCallback((message, detail = undefined) => {
    const entry = { ts: formatDebugTimestamp(), message, detail };
    setDebugLog((prev) => [...prev, entry].slice(-80));
    if (showDebugUi) {
      console.log('[rekognition-verify]', message, detail !== undefined ? detail : '');
    }
  }, [showDebugUi]);

  const livenessRetryCooldownMs = useMemo(
    () => livenessRetryCooldownMsFromMinutes(status?.liveScanCooldownMinutes),
    [status?.liveScanCooldownMinutes]
  );

  const redirectToAlbumPosts = useCallback(() => {
    onClose?.();
    navigate(MY_STORY_PATH);
  }, [navigate, onClose]);

  const applyDobOcrTrace = useCallback(
    (trace, sourceLabel, slot = null) => {
      if (!trace?.steps?.length) return;
      const isPassport =
        slot === 'passport' || (!slot && /passport/i.test(String(sourceLabel ?? '')));
      if (isPassport) {
        setPassportDobOcrTrace(trace);
      } else {
        setDobOcrTrace(trace);
      }
      logDobOcrTraceToConsole(trace, `[rekognition-verify] DOB OCR (${sourceLabel})`);
      appendDebugLog(`DOB OCR trace (${sourceLabel})`, trace);
    },
    [appendDebugLog]
  );

  const applySexOcrTrace = useCallback(
    (trace, sourceLabel, slot = null) => {
      if (!trace?.steps?.length) return;
      const isPassport =
        slot === 'passport' || (!slot && /passport/i.test(String(sourceLabel ?? '')));
      if (isPassport) {
        setPassportSexOcrTrace(trace);
      } else {
        setSexOcrTrace(trace);
      }
      logSexOcrTraceToConsole(trace, `[rekognition-verify] Sex OCR (${sourceLabel})`);
      appendDebugLog(`Sex OCR trace (${sourceLabel})`, trace);
    },
    [appendDebugLog]
  );

  const resetState = useCallback(() => {
    setConsentChecked(false);
    setConsentFirstName('');
    setConsentMiddleInitial('');
    setConsentLastName('');
    setLivenessSessionId('');
    setLivenessRegion('');
    setLivenessIdentityPoolId('');
    setLivenessPassed(false);
    setLivenessCheckResult(null);
    setLivenessRetryAvailableAt(0);
    setLivenessRetryCountdownSec(0);
    setDebugLog([]);
    setDriverLicensePreview('');
    setDriverLicenseUserUploaded(false);
    setPassportPreview('');
    setPassportUserUploaded(false);
    setProfilePhotoLoadFailed(false);
    setErrorText('');
    setResult(null);
    setDobOcrTrace(null);
    setSexOcrTrace(null);
    setPassportDobOcrTrace(null);
    setPassportSexOcrTrace(null);
    setProfilePhotoReady(false);
    setProfileVerified(false);
    setProfileMatchPct(null);
    setProfileVerifying(false);
    setProfileVerifyError('');
    setProfileManualSupport(false);
    setDriverLicenseVerified(false);
    setDriverLicenseMatchPct(null);
    setDriverLicenseVerifying(false);
    setDriverLicenseVerifyError('');
    setDriverLicenseManualSupport(false);
    setPassportVerified(false);
    setPassportMatchPct(null);
    setPassportVerifying(false);
    setPassportVerifyError('');
    setPassportManualSupport(false);
    setManualSupportEmailSent(false);
    setManualSupportEmailSending(false);
    setDriverLicenseExtracted(null);
    setPassportExtracted(null);
    setLiveFaceVerified(false);
    setLiveFaceMatchPct(null);
    setLiveFaceVerifying(false);
    setLiveFaceVerifyError('');
    setLiveFaceSnapshotPreview('');
    setLiveScanVideoSent(false);
    setLiveScanVideoRecorded(false);
    setLiveScanManualVideoFallback(false);
    liveScanManualVideoFallbackRef.current = false;
    setWizardStep(IDV_WIZARD_STEP_CONSENT);
    setCaptureForSave(false);
    dlAutoProcessRef.current = { key: '', inFlight: false };
    ppAutoProcessRef.current = { key: '', inFlight: false };
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    setLoadingStatus(true);
    fetchRekognitionStatus()
      .then((data) => {
        setStatus(data);
        if (isRekognitionDebugUiEnabled(data)) {
          console.log('[rekognition-verify] status', data);
        }
      })
      .catch((err) =>
        setErrorText(
          sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Failed to load verification status')
        )
      )
      .finally(() => setLoadingStatus(false));
  }, [open, resetState]);

  useEffect(() => {
    if (!open || skipDlPassportCheck) return undefined;
    let cancelled = false;
    void loadIdVerificationSamplePreviews()
      .then(({ driverLicense, passport }) => {
        if (cancelled) return;
        setDriverLicensePreview(driverLicense);
        setPassportPreview(passport);
        setDriverLicenseUserUploaded(false);
        setPassportUserUploaded(false);
      })
      .catch((err) => {
        if (cancelled) return;
        appendDebugLog('Sample gov ID previews failed', err?.message || String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [open, skipDlPassportCheck, appendDebugLog]);

  useEffect(() => {
    if (!open) return;
    if (needsProfilePhotoSetup(user)) {
      redirectToAlbumPosts();
      return;
    }
    if (!loadingStatus && status && !status.hasProfilePhoto) {
      redirectToAlbumPosts();
    }
  }, [open, user, loadingStatus, status, redirectToAlbumPosts]);

  useEffect(() => {
    if (!open || !skipDlPassportCheck || !profilePhotoUrl) return undefined;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setProfilePhotoLoadFailed(false);
      setProfilePhotoReady(true);
    };
    img.onerror = () => {
      if (cancelled) return;
      setProfilePhotoLoadFailed(true);
      setProfilePhotoReady(false);
    };
    img.src = profilePhotoUrl;
    return () => {
      cancelled = true;
    };
  }, [open, skipDlPassportCheck, profilePhotoUrl]);

  useEffect(() => {
    if (!open || !showDebugUi) return;
    appendDebugLog('Identification verification board', {
      profileSlotReady,
      driverLicenseReady,
      liveFaceSlotReady,
      verifyButtonsEnabled,
      profileVerified,
      driverLicenseVerified,
      passportVerified,
      liveFaceVerified
    });
  }, [
    open,
    showDebugUi,
    profileSlotReady,
    driverLicenseReady,
    liveFaceSlotReady,
    verifyButtonsEnabled,
    profileVerified,
    driverLicenseVerified,
    passportVerified,
    liveFaceVerified,
    appendDebugLog
  ]);

  useEffect(() => {
    if (!livenessRetryAvailableAt) {
      setLivenessRetryCountdownSec(0);
      return undefined;
    }
    const tick = () => {
      setLivenessRetryCountdownSec(Math.max(0, Math.ceil((livenessRetryAvailableAt - Date.now()) / 1000)));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [livenessRetryAvailableAt]);

  const enterLivenessFailedCooldown = useCallback(
    (result, reason) => {
      setLivenessSessionId('');
      setLivenessRegion('');
      setLivenessIdentityPoolId('');
      setLivenessPassed(false);
      setErrorText('');
      setLivenessCheckResult(
        result || {
          passed: false,
          passFailLabel: 'FAIL',
          passFailReason: reason || 'Face liveness did not pass.'
        }
      );
      setLivenessRetryAvailableAt(Date.now() + livenessRetryCooldownMs);
      appendDebugLog('Liveness FAILED — camera session closed; retry cooldown started', {
        reason: reason || result?.passFailReason || null,
        cooldownMinutes: livenessRetryCooldownMs / 60000
      });
    },
    [appendDebugLog, livenessRetryCooldownMs]
  );

  const liveScanCooldownActive = livenessRetryCountdownSec > 0;
  const livenessRetryBlocked = liveScanCooldownActive;
  const livenessCooldownLockdown = livenessRetryBlocked;

  async function confirmLivenessComplete({ autoAdvance = true, source = 'manual' } = {}) {
    if (!livenessSessionId) return;
    setLivenessLoading(true);
    setErrorText('');
    try {
      appendDebugLog(`Checking liveness results (${source})…`, { sessionId: livenessSessionId });
      const data = await fetchRekognitionLivenessResults(livenessSessionId);
      setLivenessCheckResult(data);
      appendDebugLog(`Liveness API result: ${data?.passFailLabel || (data?.passed ? 'PASS' : 'FAIL')}`, data);

      if (!data?.passed) {
        const reason = data?.passFailReason || 'Face liveness did not pass yet. Complete the video check and try again.';
        enterLivenessFailedCooldown(data, reason);
        return data;
      }
      setLivenessPassed(true);
      setErrorText('');
      appendDebugLog('Liveness PASSED', data);
      return data;
    } catch (err) {
      const msg = sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Liveness check failed');
      appendDebugLog('Liveness check FAILED', msg);
      enterLivenessFailedCooldown(null, msg);
      return null;
    } finally {
      setLivenessLoading(false);
    }
  }

  function buildExtractedFromCapture(data, documentType) {
    const extracted = data?.extracted || {};
    const tracePlaceOfBirth = data?.passportFieldTrace?.fields?.placeOfBirth || null;
    const countryOfBirth =
      extracted.countryOfBirth || extracted.placeOfBirth || tracePlaceOfBirth || null;
    return {
      ...extracted,
      documentType,
      countryOfBirth,
      placeOfBirth: countryOfBirth,
      age: ageFromDobText(extracted.dateOfBirth),
      passportLabelsFound: (data?.passportFieldTrace?.labelsFound || []).map((item) => item.label),
      passportFieldTrace: data?.passportFieldTrace || null
    };
  }

  function buildGovIdAutoProcessKey(profileUrl, preview) {
    if (!profileUrl || !preview) return '';
    return `${profileUrl}|${preview.length}|${preview.slice(-96)}`;
  }

  function resetProfileVerificationAfterIdChange() {
    setProfileVerified(false);
    setProfileMatchPct(null);
    setProfileVerifyError('');
    setProfileManualSupport(false);
  }

  function resetMatchStatesAfterProfileChange() {
    resetProfileVerificationAfterIdChange();
    setDriverLicenseVerified(false);
    setDriverLicenseMatchPct(null);
    setDriverLicenseVerifyError('');
    setDriverLicenseManualSupport(false);
    setPassportVerified(false);
    setPassportMatchPct(null);
    setPassportVerifyError('');
    setPassportManualSupport(false);
    dlAutoProcessRef.current = { key: '', inFlight: false };
    ppAutoProcessRef.current = { key: '', inFlight: false };
  }

  async function onPickDriverLicense(file) {
    if (!file) return;
    try {
      const dataUrl = await normalizeVerificationImageFile(file);
      setDriverLicensePreview(dataUrl);
      setDriverLicenseUserUploaded(true);
      setErrorText('');
      setDobOcrTrace(null);
      setSexOcrTrace(null);
      setDriverLicenseVerified(false);
      setDriverLicenseMatchPct(null);
      setDriverLicenseVerifyError('');
      setDriverLicenseExtracted(null);
      resetProfileVerificationAfterIdChange();
      dlAutoProcessRef.current = { key: '', inFlight: false };
    } catch (err) {
      setDriverLicenseVerifyError(err?.message || 'Failed to read driver license image');
    }
  }

  async function onPickPassport(file) {
    if (!file) return;
    try {
      const dataUrl = await normalizeVerificationImageFile(file);
      setPassportPreview(dataUrl);
      setPassportUserUploaded(true);
      setErrorText('');
      setPassportVerified(false);
      setPassportMatchPct(null);
      setPassportVerifyError('');
      setPassportExtracted(null);
      setPassportDobOcrTrace(null);
      setPassportSexOcrTrace(null);
      ppAutoProcessRef.current = { key: '', inFlight: false };
    } catch (err) {
      setPassportVerifyError(err?.message || 'Failed to read passport image');
    }
  }

  async function handleProfileUploadFile(file) {
    if (!file) return;
    try {
      const data = await uploadMyPhoto(file);
      const photosId = Number(data?.photos_id);
      if (!Number.isFinite(photosId) || photosId < 1) {
        throw new Error('Upload failed');
      }
      await setProfilePhoto(photosId);
      updateSessionProfilePhoto(photosId);
      bumpProfilePhotoCache();
      await refreshAuthProfilePhoto();
      resetMatchStatesAfterProfileChange();
      setProfilePhotoLoadFailed(false);
      setProfilePhotoReady(false);
      setErrorText('');
    } catch (err) {
      const msg =
        err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Failed to upload profile photo';
      setProfileVerifyError(msg);
      throw new Error(msg);
    }
  }

  async function handleIdvUploadPhoneFromPhotosId(kind, photosId) {
    const id = Number(photosId);
    if (!Number.isFinite(id) || id < 1) {
      throw new Error('Invalid photo from phone upload');
    }
    if (kind === 'profile') {
      await setProfilePhoto(id);
      updateSessionProfilePhoto(id);
      bumpProfilePhotoCache();
      await refreshAuthProfilePhoto();
      resetMatchStatesAfterProfileChange();
      setProfilePhotoLoadFailed(false);
      setProfilePhotoReady(false);
      setErrorText('');
      return;
    }
    const dataUrl = await normalizeVerificationImageFromUrl(`${getApiBaseUrl()}/api/photo/${id}`);
    if (kind === 'driver_license') {
      setDriverLicensePreview(dataUrl);
      setDriverLicenseUserUploaded(true);
      setErrorText('');
      setDobOcrTrace(null);
      setSexOcrTrace(null);
      setDriverLicenseVerified(false);
      setDriverLicenseMatchPct(null);
      setDriverLicenseVerifyError('');
      setDriverLicenseExtracted(null);
      resetProfileVerificationAfterIdChange();
      dlAutoProcessRef.current = { key: '', inFlight: false };
      return;
    }
    if (kind === 'passport') {
      setPassportPreview(dataUrl);
      setPassportUserUploaded(true);
      setErrorText('');
      setPassportVerified(false);
      setPassportMatchPct(null);
      setPassportVerifyError('');
      setPassportExtracted(null);
      setPassportDobOcrTrace(null);
      setPassportSexOcrTrace(null);
      ppAutoProcessRef.current = { key: '', inFlight: false };
    }
  }

  async function handleIdvUploadFilePick(kind, file) {
    if (kind === 'profile') {
      await handleProfileUploadFile(file);
    } else if (kind === 'driver_license') {
      await onPickDriverLicense(file);
    } else if (kind === 'passport') {
      await onPickPassport(file);
    }
  }

  async function handleIdvUploadPhoneComplete(kind, photosId) {
    try {
      await handleIdvUploadPhoneFromPhotosId(kind, photosId);
    } catch (err) {
      const msg = err?.message || 'Failed to receive phone upload';
      if (kind === 'profile') {
        setProfileVerifyError(msg);
      } else if (kind === 'driver_license') {
        setDriverLicenseVerifyError(msg);
      } else if (kind === 'passport') {
        setPassportVerifyError(msg);
      }
      throw err;
    }
  }

  const applyProfileIdMatchFromCapture = useCallback(
    (data) => {
      const threshold = data?.faceMatchThreshold ?? status?.faceMatchThreshold ?? 90;
      const matchPct = data?.profileMatchPercentMatch ?? data?.idMatchSimilarity ?? null;
      const matched = Boolean(data?.profileMatchMatched ?? data?.matched);
      setProfileMatchPct(matchPct);
      setDriverLicenseMatchPct(matchPct);
      if (matchPct == null) {
        setProfileVerified(false);
        setProfileVerifyError('');
        return;
      }
      if (!matched) {
        setProfileVerifyError(
          `Profile photo ↔ ID face match ${Math.round(matchPct)}% (need ${threshold}%).`
        );
        setProfileVerified(false);
        return;
      }
      setProfileVerifyError('');
      setProfileVerified(true);
    },
    [status?.faceMatchThreshold]
  );

  const enforceUnder18FromIdCapture = useCallback(
    async (data, extracted) => {
      const age = data?.age ?? extracted?.age;
      const underage = Boolean(data?.underage) || (Number.isFinite(age) && age < 18);
      if (!underage) {
        const over18Flag = data?.over_18_verified ?? data?.over18Verified ?? (Number.isFinite(age) && age >= 18 ? true : null);
        if (over18Flag === true) {
          updateSessionOver18Verified?.(true);
        }
        return false;
      }
      const msg = String(data?.message || '').trim() || 'Sorry you must be over 18 years of age';
      appendDebugLog('Under 18 from government ID OCR — logout', { age, underage: true });
      await themedAlert(msg);
      try {
        await logout();
      } catch (logoutErr) {
        console.warn('[rekognition-verify] logout after under18 failed', logoutErr);
      }
      navigate('/pages/login', { replace: true });
      return true;
    },
    [appendDebugLog, logout, navigate, updateSessionOver18Verified]
  );

  const autoProcessDriverLicense = useCallback(async () => {
    if (!driverLicenseUserUploaded || !driverLicensePreview || !profileSlotReady) return;
    setDriverLicenseVerifying(true);
    setProfileVerifying(true);
    setDriverLicenseVerifyError('');
    setProfileVerifyError('');
    setDriverLicenseManualSupport(false);
    setProfileManualSupport(false);
    setErrorText('');
    try {
      appendDebugLog('POST /api/rekognition/id-capture (auto Driver License)');
      const data = await captureDriverLicenseFromIdImage({
        idImage: driverLicensePreview,
        documentType: 'driver_license'
      });
      applyDobOcrTrace(data?.dobOcrTrace, 'auto driver license');
      applySexOcrTrace(data?.sexOcrTrace, 'auto driver license');
      const extracted = buildExtractedFromCapture(data, 'driver_license');
      setDriverLicenseExtracted(extracted);
      if (await enforceUnder18FromIdCapture(data, extracted)) return;
      applyProfileIdMatchFromCapture(data);
      setDriverLicenseVerified(true);
      appendDebugLog('Auto driver license processing succeeded', data?.captured);
    } catch (err) {
      const msg = sanitizeUserFacingTechTerms(
        err?.response?.data?.error || err?.message || 'Driver license processing failed'
      );
      setDriverLicenseVerifyError(msg);
      setDriverLicenseVerified(false);
      setProfileVerified(false);
      appendDebugLog('Auto driver license processing FAILED', msg);
    } finally {
      setDriverLicenseVerifying(false);
      setProfileVerifying(false);
    }
  }, [
    driverLicenseUserUploaded,
    driverLicensePreview,
    profileSlotReady,
    appendDebugLog,
    applyDobOcrTrace,
    applySexOcrTrace,
    applyProfileIdMatchFromCapture,
    enforceUnder18FromIdCapture
  ]);

  const autoProcessPassport = useCallback(async () => {
    if (!passportUserUploaded || !passportPreview || !profileSlotReady) return;
    setPassportVerifying(true);
    setPassportVerifyError('');
    setPassportManualSupport(false);
    setErrorText('');
    try {
      appendDebugLog('POST /api/rekognition/id-capture (auto Passport)');
      const data = await captureDriverLicenseFromIdImage({
        idImage: passportPreview,
        documentType: 'passport'
      });
      applyDobOcrTrace(data?.dobOcrTrace, 'auto passport');
      applySexOcrTrace(data?.sexOcrTrace, 'auto passport');
      const extracted = buildExtractedFromCapture(data, 'passport');
      setPassportExtracted(extracted);
      if (await enforceUnder18FromIdCapture(data, extracted)) return;
      const matchPct = data?.profileMatchPercentMatch ?? data?.idMatchSimilarity ?? null;
      setPassportMatchPct(matchPct);
      setPassportVerified(true);
      appendDebugLog('Auto passport processing succeeded', data?.captured);
    } catch (err) {
      const msg = sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Passport processing failed');
      setPassportVerifyError(msg);
      setPassportVerified(false);
      appendDebugLog('Auto passport processing FAILED', msg);
    } finally {
      setPassportVerifying(false);
    }
  }, [
    passportUserUploaded,
    passportPreview,
    profileSlotReady,
    appendDebugLog,
    applyDobOcrTrace,
    applySexOcrTrace,
    enforceUnder18FromIdCapture
  ]);

  const applyBypassIdCapture = useCallback(
    async (documentType) => {
      const isDriverLicense = documentType === 'driver_license';
      if (isDriverLicense) {
        setDriverLicenseVerifying(true);
        setProfileVerifying(true);
        setDriverLicenseVerifyError('');
        setProfileVerifyError('');
        setDriverLicenseManualSupport(false);
        setProfileManualSupport(false);
      } else {
        setPassportVerifying(true);
        setPassportVerifyError('');
        setPassportManualSupport(false);
      }
      setErrorText('');
      try {
        appendDebugLog(`POST /api/rekognition/id-capture (admin bypass ${documentType})`);
        const data = await captureDriverLicenseFromIdImage({ documentType });
        applyDobOcrTrace(data?.dobOcrTrace, `admin bypass ${documentType}`);
        applySexOcrTrace(data?.sexOcrTrace, `admin bypass ${documentType}`);
        if (isDriverLicense) {
          const extracted = buildExtractedFromCapture(data, 'driver_license');
          setDriverLicenseExtracted(extracted);
          if (await enforceUnder18FromIdCapture(data, extracted)) return;
          applyProfileIdMatchFromCapture(data);
          setDriverLicenseVerified(true);
        } else {
          const extracted = buildExtractedFromCapture(data, 'passport');
          setPassportExtracted(extracted);
          if (await enforceUnder18FromIdCapture(data, extracted)) return;
          const matchPct = data?.profileMatchPercentMatch ?? data?.idMatchSimilarity ?? 100;
          setPassportMatchPct(matchPct);
          setPassportVerified(true);
        }
        appendDebugLog(`Admin bypass ${documentType} succeeded`, data?.captured);
      } catch (err) {
        const msg = sanitizeUserFacingTechTerms(
          err?.response?.data?.error || err?.message || `${documentType} bypass failed`
        );
        if (isDriverLicense) {
          setDriverLicenseVerifyError(msg);
          setDriverLicenseVerified(false);
          setProfileVerified(false);
        } else {
          setPassportVerifyError(msg);
          setPassportVerified(false);
        }
        appendDebugLog(`Admin bypass ${documentType} FAILED`, msg);
      } finally {
        if (isDriverLicense) {
          setDriverLicenseVerifying(false);
          setProfileVerifying(false);
        } else {
          setPassportVerifying(false);
        }
      }
    },
    [appendDebugLog, applyDobOcrTrace, applySexOcrTrace, applyProfileIdMatchFromCapture, enforceUnder18FromIdCapture]
  );

  const handleBypassDriverLicense = useCallback(() => {
    if (!profileSlotReady) {
      setDriverLicenseVerifyError('Profile photo must load before bypassing driver license.');
      return;
    }
    void applyBypassIdCapture('driver_license');
  }, [applyBypassIdCapture, profileSlotReady]);

  const handleBypassPassport = useCallback(() => {
    if (!profileSlotReady) {
      setPassportVerifyError('Profile photo must load before bypassing passport.');
      return;
    }
    void applyBypassIdCapture('passport');
  }, [applyBypassIdCapture, profileSlotReady]);

  const handleBypassLiveScan = useCallback(async () => {
    if (!profileSlotReady) {
      setLiveFaceVerifyError('Your profile photo must load before bypassing live scan.');
      return;
    }
    if (!adminImpersonationBypass && !skipDlPassportCheck && !driverLicenseReady) {
      setLiveFaceVerifyError('Complete driver license first.');
      return;
    }
    setLiveFaceVerifying(true);
    setLiveFaceVerifyError('');
    setErrorText('');
    try {
      appendDebugLog('Admin impersonation — By Pass Live Scan');
      const matchData = await previewLiveScanProfileMatch({ livenessSessionId: '' });
      const matchPct =
        matchData?.liveScanPercentMatch ??
        matchData?.profileMatchSimilarity ??
        matchData?.idMatchSimilarity ??
        100;
      setLiveFaceMatchPct(matchPct);
      setLivenessPassed(true);
      setLiveFaceVerified(true);
      setLivenessCheckResult({ passed: true, adminImpersonationBypass: true });
      appendDebugLog('Admin bypass live scan PASSED', matchData);
    } catch (err) {
      const msg = sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Live scan bypass failed');
      setLiveFaceVerifyError(msg);
      setLiveFaceVerified(false);
      setLivenessPassed(false);
    } finally {
      setLiveFaceVerifying(false);
    }
  }, [appendDebugLog, adminImpersonationBypass, driverLicenseReady, profileSlotReady, skipDlPassportCheck]);

  useEffect(() => {
    if (!open || !profileSlotReady || !driverLicenseUserUploaded || !driverLicensePreview) return undefined;
    const key = buildGovIdAutoProcessKey(profilePhotoUrl, driverLicensePreview);
    if (!key || dlAutoProcessRef.current.inFlight || dlAutoProcessRef.current.key === key) return undefined;
    dlAutoProcessRef.current.inFlight = true;
    let cancelled = false;
    void autoProcessDriverLicense()
      .finally(() => {
        if (cancelled) return;
        dlAutoProcessRef.current.inFlight = false;
        dlAutoProcessRef.current.key = key;
      });
    return () => {
      cancelled = true;
    };
  }, [open, profileSlotReady, driverLicenseUserUploaded, driverLicensePreview, profilePhotoUrl, autoProcessDriverLicense]);

  useEffect(() => {
    if (!open || !profileSlotReady || !passportUserUploaded || !passportPreview) return undefined;
    const key = buildGovIdAutoProcessKey(profilePhotoUrl, passportPreview);
    if (!key || ppAutoProcessRef.current.inFlight || ppAutoProcessRef.current.key === key) return undefined;
    ppAutoProcessRef.current.inFlight = true;
    let cancelled = false;
    void autoProcessPassport()
      .finally(() => {
        if (cancelled) return;
        ppAutoProcessRef.current.inFlight = false;
        ppAutoProcessRef.current.key = key;
      });
    return () => {
      cancelled = true;
    };
  }, [open, profileSlotReady, passportUserUploaded, passportPreview, profilePhotoUrl, autoProcessPassport]);

  function collectVerificationErrors() {
    const errors = [];
    if (profilePhotoLoadFailed) errors.push('No profile photo');
    if (profileVerifyError) errors.push(`Profile verification: ${profileVerifyError}`);
    if (driverLicenseVerifyError) errors.push(`Driver license verification: ${driverLicenseVerifyError}`);
    if (passportVerifyError) errors.push(`Passport verification: ${passportVerifyError}`);
    if (liveFaceVerifyError) errors.push(`Live face verification: ${liveFaceVerifyError}`);
    if (errorText) errors.push(errorText);
    return errors;
  }

  function buildMergedExtractedForSupport() {
    const dl = driverLicenseExtracted || {};
    const pp = passportExtracted || {};
    return {
      ...dl,
      ppNationality: pp.ppNationality || dl.ppNationality,
      nationality: pp.nationality || dl.nationality,
      passportLabelsFound: pp.passportLabelsFound || []
    };
  }

  async function handleManualSupportChange(slot, checked, otherSlotsChecked = []) {
    if (slot === 'profile') {
      setProfileManualSupport(checked);
    } else if (slot === 'driver_license') {
      setDriverLicenseManualSupport(checked);
    } else if (slot === 'passport') {
      setPassportManualSupport(checked);
    }
    if (!checked || manualSupportEmailSent || manualSupportEmailSending) return;

    const markedSlots = [];
    if (slot === 'profile' || otherSlotsChecked.includes('profile')) markedSlots.push('Profile Photo');
    if (slot === 'driver_license' || otherSlotsChecked.includes('driver_license')) markedSlots.push('Driver License');
    if (slot === 'passport' || otherSlotsChecked.includes('passport')) markedSlots.push('Passport');

    setManualSupportEmailSending(true);
    setErrorText('');
    try {
      appendDebugLog('POST /api/rekognition/manual-support-email', { markedSlots });
      const data = await postIdVerificationManualSupportEmail({
        driverLicenseImage: driverLicensePreview || undefined,
        passportImage: passportPreview || undefined,
        errors: collectVerificationErrors(),
        extracted: buildMergedExtractedForSupport(),
        passportLabelsFound: passportExtracted?.passportLabelsFound || [],
        consentName: consentFullName,
        markedSlots
      });
      setManualSupportEmailSent(true);
      appendDebugLog('Manual support email sent', data);
    } catch (err) {
      const msg = sanitizeUserFacingTechTerms(
        err?.response?.data?.error || err?.message || 'Failed to notify support for manual review'
      );
      setErrorText(msg);
      appendDebugLog('Manual support email FAILED', msg);
      if (slot === 'profile') setProfileManualSupport(false);
      else if (slot === 'driver_license') setDriverLicenseManualSupport(false);
      else if (slot === 'passport') setPassportManualSupport(false);
    } finally {
      setManualSupportEmailSending(false);
    }
  }

  async function handleVerifyLiveFace() {
    if (liveScanCooldownActive) {
      setLiveFaceVerifyError(formatLivenessRetryLockdownLabel(livenessRetryCountdownSec));
      return;
    }
    if (!profileSlotReady || (!skipDlPassportCheck && !driverLicenseReady)) {
      setLiveFaceVerifyError(
        skipDlPassportCheck
          ? 'Your profile photo must load before live scan.'
          : 'Upload profile photo and driver license first.'
      );
      return;
    }
    if (!status?.livenessConfigured) {
      setLiveFaceVerifyError('Face liveness is not set up on this site yet.');
      return;
    }

    setLiveFaceVerifying(true);
    setLiveFaceVerifyError('');
    setLiveScanManualVideoFallback(false);
    liveScanManualVideoFallbackRef.current = false;
    setErrorText('');
    setLiveFaceVerified(false);
    setLiveFaceMatchPct(null);
    setLiveFaceSnapshotPreview('');
    setLivenessPassed(false);
    setLivenessSessionId('');
    setLivenessCheckResult(null);
    try {
      appendDebugLog('Opening live face scan popup…');
      const popupResult = await openLiveFaceScanPopup({
        returnOrigin: window.location.origin,
        onPopupPhase: (data) => {
          if (data?.phase === LIVE_FACE_SCAN_POPUP_PHASE.SUBMIT_VIDEO) {
            liveScanManualVideoFallbackRef.current = true;
            setLiveScanManualVideoFallback(true);
            setLiveFaceVerifyError('');
            return;
          }
          if (data?.phase === LIVE_FACE_SCAN_POPUP_PHASE.FAILED) {
            const failMsg = formatLiveFaceScanUserError(
              { message: data.message, checkResult: data.checkResult },
              status?.faceMatchThreshold ?? 90
            );
            setLiveFaceVerifyError(failMsg);
            enterLivenessFailedCooldown(data.checkResult, failMsg);
          }
        }
      });

      if (popupResult?.submitVideo) {
        appendDebugLog('Live face scan — user chose manual video (Step 7)');
        return;
      }

      setLivenessSessionId(popupResult.sessionId);
      setLivenessRegion(popupResult.region || status?.region || 'us-east-1');
      setLivenessIdentityPoolId(popupResult.identityPoolId || '');
      setLivenessCheckResult(popupResult.checkResult);

      appendDebugLog('POST /api/rekognition/live-scan-profile-match');
      const matchData = await previewLiveScanProfileMatch({ livenessSessionId: popupResult.sessionId });
      const threshold = matchData?.faceMatchThreshold ?? status?.faceMatchThreshold ?? 90;
      const matchPct =
        matchData?.liveScanPercentMatch ??
        matchData?.profileMatchSimilarity ??
        matchData?.idMatchSimilarity ??
        null;
      const snapshotPreview =
        matchData?.referenceImageDataUrl || popupResult.checkResult?.referenceImageDataUrl || '';
      setLiveFaceSnapshotPreview(snapshotPreview);
      setLiveFaceMatchPct(matchPct);

      if (!matchData?.matched) {
        setLivenessPassed(false);
        setLiveFaceVerified(false);
        setLivenessSessionId('');
        const pctLabel = matchPct != null ? `${Math.round(matchPct)}%` : 'N/A';
        const msg = `Live scan did not match your profile photo (${pctLabel}; need ${threshold}%). Center your face and try again.`;
        setLiveFaceVerifyError(msg);
        appendDebugLog('Live scan profile match FAILED', matchData);
        return;
      }

      setLivenessPassed(true);
      setLiveFaceVerified(true);
      setLiveFaceVerifyError('');
      appendDebugLog('Live face scan popup PASSED with profile match', {
        matchPct,
        threshold,
        checkResult: popupResult.checkResult
      });
    } catch (err) {
      const phase = err?.phase;
      const msg = formatLiveFaceScanUserError(err, status?.faceMatchThreshold ?? 90);
      if (phase === LIVE_FACE_SCAN_POPUP_PHASE.CLOSED) {
        if (!liveScanManualVideoFallbackRef.current) {
          setLiveFaceVerifyError('');
        }
      } else if (phase === LIVE_FACE_SCAN_POPUP_PHASE.ERROR) {
        setLiveFaceVerifyError(msg);
      } else {
        setLiveFaceVerifyError(msg);
      }
      appendDebugLog('Live face scan popup FAILED', msg);
    } finally {
      setLiveFaceVerifying(false);
    }
  }

  async function handleSubmit() {
    setErrorText('');
    if (!consentValidForSave) {
      setErrorText('Consent and legal name are required before saving.');
      return;
    }
    if (!canSaveVerification) {
      setErrorText(
        skipDlPassportCheck
          ? 'Complete live face scan or send manual video before saving.'
          : 'Upload and process profile photo, driver license, and Live Scan before saving.'
      );
      return;
    }
    if (!status?.hasProfilePhoto || needsProfilePhotoSetup(user)) {
      redirectToAlbumPosts();
      return;
    }
    if (profilePhotoLoadFailed) {
      setErrorText('Could not load your profile photo. Refresh or update it in My Album&Posts.');
      return;
    }
    setSubmitting(true);
    try {
      if (canSaveAfterLiveScanVideo && !allSlotsVerified) {
        appendDebugLog('Saving identification verification after manual live scan video send');
        const dateSigned = new Date().toISOString();
        if (!adminImpersonationBypass) {
          await postSaveConsentRecord({
            full_name_signed: consentFullName,
            viewer_approved: effectiveSinglesId,
            date_signed: dateSigned,
            description: CONSENT_DESCRIPTION_IDENTIFICATION_VERIFICATION,
            watermark_variant: CONSENT_WATERMARK_VARIANTS.identificationVerification
          });
        } else {
          appendDebugLog('Admin impersonation — skipped consent record save');
        }
        await onVerified?.({ manualLiveScanVideo: true });
        await postIdVerificationDateOnClose({ verificationComplete: true });
        onClose?.();
        return;
      }

      let consentSignatureImage = null;
      if (!adminImpersonationBypass) {
        try {
          flushSync(() => setCaptureForSave(true));
          consentSignatureImage = await captureElementAsPng(consentCaptureRef.current);
        } catch (captureErr) {
          const msg = sanitizeUserFacingTechTerms(
            captureErr?.message || 'Failed to capture identification verification screen.'
          );
          appendDebugLog('Consent screen capture FAILED', msg);
          setErrorText(msg);
          return;
        } finally {
          setCaptureForSave(false);
        }
      }

      appendDebugLog('POST /api/rekognition/verify', {
        livenessPassed,
        livenessSessionId: livenessPassed ? livenessSessionId : null,
        hasDriverLicenseImage: Boolean(driverLicensePreview),
        hasPassportImage: Boolean(passportPreview),
        useProfilePhotoAsSelfie: true
      });
      const data = await verifyIdentityWithRekognition({
        ...(skipDlPassportCheck || adminImpersonationBypass || !driverLicensePreview
          ? {}
          : { driverLicenseImage: driverLicensePreview }),
        ...(passportUserUploaded && passportPreview ? { passportImage: passportPreview } : {}),
        livenessSessionId: livenessPassed ? livenessSessionId : undefined,
        consentFullName: consentFullName || 'Live Scan Dev'
      });
      appendDebugLog('Final verification succeeded', data);
      applyDobOcrTrace(data?.dobOcrTrace, 'final verify');
      applySexOcrTrace(data?.sexOcrTrace, 'final verify');

      const dateSigned = new Date().toISOString();
      if (!adminImpersonationBypass) {
        await postSaveConsentRecord({
          full_name_signed: consentFullName,
          viewer_approved: effectiveSinglesId,
          date_signed: dateSigned,
          consent_signature_image: consentSignatureImage,
          description: CONSENT_DESCRIPTION_IDENTIFICATION_VERIFICATION,
          watermark_variant: CONSENT_WATERMARK_VARIANTS.identificationVerification
        });
        appendDebugLog('Consent record saved for identification verification');
      } else {
        appendDebugLog('Admin impersonation — skipped consent record save');
      }

      setResult(data);
      await onVerified?.(data);
      await postIdVerificationDateOnClose({ verificationComplete: true });
      onClose?.();
    } catch (err) {
      const data = err?.response?.data;
      let msg = sanitizeUserFacingTechTerms(data?.error || err?.message || 'Verification failed');
      if (data?.nameMismatch && data?.extracted?.fullName) {
        msg = `${msg} Update the legal name above to match your ID, or retake a clearer ID photo.`;
      }
      appendDebugLog('Final verification FAILED', data || msg);
      setErrorText(msg);
      setResult(null);
      await onFailed?.(err);
    } finally {
      setSubmitting(false);
    }
  }

  const handleClose = useCallback(async () => {
    if (closing || submitting) return;
    setClosing(true);
    setErrorText('');
    try {
      await postIdVerificationDateOnClose({ verificationComplete: verificationCompleteShown });
      onClose?.();
    } catch (err) {
      setErrorText(
        sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Failed to save verification date')
      );
    } finally {
      setClosing(false);
    }
  }, [closing, submitting, verificationCompleteShown, onClose]);

  const handleWizardBackOrClose = useCallback(() => {
    if (wizardStep <= IDV_WIZARD_STEP_CONSENT) {
      void handleClose();
      return;
    }
    handleWizardPrevious();
  }, [wizardStep, handleClose, handleWizardPrevious]);

  const handlePilotSkipIdentificationVerification = useCallback(() => {
    if (closing || submitting) return;
    clearSignupIdentificationVerificationRequired();
    onClose?.();
    navigate('/allSingles');
  }, [closing, submitting, onClose, navigate]);

  const handleHiddenPassportOOver18Bypass = useCallback(async () => {
    if (closing || submitting) return;
    setClosing(true);
    setErrorText('');
    try {
      await markOver18Verified();
      updateSessionOver18Verified?.(true);
      clearSignupIdentificationVerificationRequired();
      const { markFirstLoginOnboardingCongratsPending } = await import('utils/firstLoginOnboarding');
      markFirstLoginOnboardingCongratsPending();
      onClose?.();
      navigate('/allSingles');
    } catch (err) {
      setErrorText(
        sanitizeUserFacingTechTerms(err?.response?.data?.error || err?.message || 'Failed to update over-18 status')
      );
    } finally {
      setClosing(false);
    }
  }, [closing, submitting, onClose, updateSessionOver18Verified, navigate]);

  const livenessBlocked =
    !adminImpersonationBypass && status?.requireLivenessEffective && !status?.livenessConfigured;
  const liveFaceVerifyDisabled =
    liveFaceVerifying ||
    liveScanCooldownActive ||
    !status?.livenessConfigured ||
    !profileSlotReady ||
    (requirePhysicalDriverLicenseUpload && !driverLicenseReady);
  const liveFaceBypassDisabled =
    liveFaceVerifying ||
    liveScanCooldownActive ||
    !profileSlotReady ||
    (requirePhysicalDriverLicenseUpload && !driverLicenseReady);

  const showDlDobTrace = wizardStep === WIZARD_STEP_DRIVER_LICENSE && dobOcrTrace;
  const showDlSexTrace = wizardStep === WIZARD_STEP_DRIVER_LICENSE && sexOcrTrace;
  const showPpDobTrace = wizardStep === WIZARD_STEP_PASSPORT && passportDobOcrTrace;
  const showPpSexTrace = wizardStep === WIZARD_STEP_PASSPORT && passportSexOcrTrace;

  return (
    <>
      <BusyHourglassOverlay open={submitting} label="Saving verification" />
      <ColorTemplate7PopupLargeDark
      open={open}
      closeOnBackdrop={false}
      showCloseButton={false}
      onClose={() => void handleClose()}
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <Box ref={consentCaptureRef}>
          <ColorTemplate7PopupLargeDark.Title>Identification Verification</ColorTemplate7PopupLargeDark.Title>

          <Stack spacing={2} sx={{ width: '100%' }}>
            <Box sx={verificationAccountPanelSx}>
              Notice: Your Driver Licennse and Passport is scan for basic info, in temporary memory only and is not permanent
              stored. For your security, we do not scan for DL Id or Passpor ID, and never store image of Driver License or
              Passp
              <Box
                component="span"
                role="button"
                tabIndex={-1}
                aria-hidden
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleHiddenPassportOOver18Bypass();
                }}
                sx={{
                  display: 'inline',
                  p: 0,
                  m: 0,
                  border: 0,
                  background: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  cursor: 'inherit',
                  userSelect: 'text'
                }}
              >
                o
              </Box>
              rt.
            </Box>

            {!result ? (
              <>
                {captureForSave ? (
                  <Box sx={idvCaptureSummarySx}>
                    <ColorTemplate7PopupLargeDark.BodyText sx={{ fontWeight: 700 }}>
                      I agree to biometric identity verification (CCPA/BIPA-style consent):{' '}
                      {consentChecked ? 'Yes' : 'No'}
                    </ColorTemplate7PopupLargeDark.BodyText>
                    <ColorTemplate7PopupLargeDark.BodyText sx={{ mt: 1 }}>
                      Legal name: {consentFullName || '—'}
                    </ColorTemplate7PopupLargeDark.BodyText>
                  </Box>
                ) : null}

                {wizardStep === IDV_WIZARD_STEP_CONSENT ? (
                  <Stack spacing={1.5}>
                    <ColorTemplate7PopupLargeDark.SectionTitle sx={wizardStepHeadingSx}>
                      Step 1: Basic Information
                    </ColorTemplate7PopupLargeDark.SectionTitle>
                    <FormControlLabel
                      sx={{
                        alignItems: 'flex-start',
                        '& .MuiFormControlLabel-label': {
                          color: `${COLOR_TEMPLATE7_POPUP_TEXT} !important`,
                          fontSize: 'inherit',
                          pt: 0.75
                        }
                      }}
                      control={
                        <ColorTemplate7PopupLargeDark.Checkbox
                          checked={consentChecked}
                          onChange={(e) => setConsentChecked(e.target.checked)}
                          icon={<BiometricConsentCheckboxIcon checked={false} />}
                          checkedIcon={<BiometricConsentCheckboxIcon checked />}
                        />
                      }
                      label="I agree to biometric identity verification (CCPA/BIPA-style consent)"
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                      <Box sx={consentNameFormGridSx}>
                        <ColorTemplate7PopupLargeDark.SectionLabel sx={{ textAlign: 'right', whiteSpace: 'nowrap', pr: 1, justifySelf: 'end', mt: 0 }}>
                          First Name
                          <RequiredLabelSuffix />
                        </ColorTemplate7PopupLargeDark.SectionLabel>
                        <ColorTemplate7PopupLargeDark.Input
                          value={consentFirstName}
                          onChange={(e) => setConsentFirstName(e.target.value)}
                          size="small"
                          sx={{ mx: 0 }}
                        />
                        <ColorTemplate7PopupLargeDark.SectionLabel sx={{ textAlign: 'right', whiteSpace: 'nowrap', pr: 1, justifySelf: 'end', mt: 0 }}>
                          Middle Initial
                          <RequiredLabelSuffix />
                        </ColorTemplate7PopupLargeDark.SectionLabel>
                        <ColorTemplate7PopupLargeDark.Input
                          value={consentMiddleInitial}
                          onChange={(e) => setConsentMiddleInitial(e.target.value.slice(0, FULLNAME_MIDDLE_MAX_LENGTH))}
                          size="small"
                          inputProps={{ maxLength: FULLNAME_MIDDLE_MAX_LENGTH }}
                          sx={{ mx: 0 }}
                        />
                        <ColorTemplate7PopupLargeDark.SectionLabel sx={{ textAlign: 'right', whiteSpace: 'nowrap', pr: 1, justifySelf: 'end', mt: 0 }}>
                          Last Name
                          <RequiredLabelSuffix />
                        </ColorTemplate7PopupLargeDark.SectionLabel>
                        <ColorTemplate7PopupLargeDark.Input
                          value={consentLastName}
                          onChange={(e) => setConsentLastName(e.target.value)}
                          size="small"
                          sx={{ mx: 0 }}
                        />
                      </Box>
                    </Box>
                  </Stack>
                ) : null}

                {!result && status?.configured && wizardStep >= WIZARD_STEP_PROFILE ? (
                  <IdentificationVerificationBoard
                    wizardStep={wizardStep}
                    skipLiveFaceScan={skipLiveFaceScan}
                    adminImpersonationBypass={adminImpersonationBypass}
                    onBypassDriverLicense={handleBypassDriverLicense}
                    onBypassPassport={handleBypassPassport}
                    onBypassLiveScan={() => void handleBypassLiveScan()}
                    profilePhotoUrl={profilePhotoUrl}
                    profileSlotReady={profileSlotReady}
                    profilePhotoLoadFailed={profilePhotoLoadFailed}
                    onProfilePhotoLoad={() => {
                      setProfilePhotoLoadFailed(false);
                      setProfilePhotoReady(true);
                    }}
                    onProfilePhotoError={() => {
                      setProfilePhotoLoadFailed(true);
                      setProfilePhotoReady(false);
                    }}
                    profileVerifying={profileVerifying}
                    profileVerified={profileVerified}
                    profileMatchPct={profileMatchPct}
                    profileVerifyError={profileVerifyError}
                    profileManualSupport={profileManualSupport}
                    onProfileManualSupportChange={(checked) =>
                      void handleManualSupportChange('profile', checked, [
                        driverLicenseManualSupport ? 'driver_license' : '',
                        passportManualSupport ? 'passport' : ''
                      ].filter(Boolean))
                    }
                    onUploadFilePick={(kind, file) => handleIdvUploadFilePick(kind, file)}
                    onUploadPhoneComplete={(kind, photosId, meta) => handleIdvUploadPhoneComplete(kind, photosId, meta)}
                    driverLicenseUserUploaded={driverLicenseUserUploaded}
                    driverLicensePreview={driverLicensePreview}
                    driverLicenseSlotReady={driverLicenseSlotReady}
                    driverLicenseVerifying={driverLicenseVerifying}
                    driverLicenseVerified={driverLicenseVerified}
                    driverLicenseMatchPct={driverLicenseMatchPct}
                    driverLicenseVerifyError={driverLicenseVerifyError}
                    driverLicenseManualSupport={driverLicenseManualSupport}
                    onDriverLicenseManualSupportChange={(checked) =>
                      void handleManualSupportChange('driver_license', checked, [
                        profileManualSupport ? 'profile' : '',
                        passportManualSupport ? 'passport' : ''
                      ].filter(Boolean))
                    }
                    driverLicenseExtracted={driverLicenseExtracted}
                    passportPreview={passportPreview}
                    passportSlotReady={passportSlotReady}
                    passportVerifying={passportVerifying}
                    passportVerified={passportVerified}
                    passportMatchPct={passportMatchPct}
                    passportVerifyError={passportVerifyError}
                    passportManualSupport={passportManualSupport}
                    onPassportManualSupportChange={(checked) =>
                      void handleManualSupportChange('passport', checked, [
                        profileManualSupport ? 'profile' : '',
                        driverLicenseManualSupport ? 'driver_license' : ''
                      ].filter(Boolean))
                    }
                    passportExtracted={passportExtracted}
                    livenessPassed={livenessPassed}
                    liveFaceSlotReady={liveFaceSlotReady}
                    liveFaceVerifying={liveFaceVerifying}
                    liveFaceVerified={liveFaceVerified}
                    liveFaceMatchPct={liveFaceMatchPct}
                    liveFaceVerifyError={liveFaceVerifyError}
                    liveFaceSnapshotPreview={liveFaceSnapshotPreview}
                    liveFaceVerifyDisabled={liveFaceVerifyDisabled}
                    liveFaceBypassDisabled={liveFaceBypassDisabled}
                    liveScanManualVideoFallback={liveScanManualVideoFallback}
                    liveScanRetryCountdownSec={liveScanCooldownActive ? livenessRetryCountdownSec : 0}
                    faceMatchThreshold={status?.faceMatchThreshold ?? 90}
                    onVerifyLiveFace={() => void handleVerifyLiveFace()}
                    consentFullName={consentFullName}
                    consentFirstName={consentFirstName}
                    viewerApprovedId={effectiveSinglesId > 0 ? effectiveSinglesId : null}
                    onLiveScanVideoSent={() => setLiveScanVideoSent(true)}
                    onLiveScanVideoRecorded={() => setLiveScanVideoRecorded(true)}
                    onLiveScanVideoCleared={() => {
                      setLiveScanVideoRecorded(false);
                      setLiveScanVideoSent(false);
                    }}
                  />
                ) : null}
              </>
            ) : null}
          </Stack>
        </Box>

        <Stack spacing={2} sx={{ width: '100%' }}>

          {loadingStatus ? <ColorTemplate7PopupLargeDark.BodyText>Loading…</ColorTemplate7PopupLargeDark.BodyText> : null}
          {status && !status.configured ? (
            <Alert severity="error">Identity verification is not available right now. Please try again later or contact support.</Alert>
          ) : null}
          {livenessBlocked && wizardStep === WIZARD_STEP_LIVE_SCAN ? (
            <Alert severity="warning">
              Face liveness is required but is not set up on this site yet. Please contact support, or ask an administrator to finish
              liveness configuration.
            </Alert>
          ) : status?.skipLiveFaceScan && wizardStep === WIZARD_STEP_LIVE_SCAN ? (
            <Alert severity="info">
              Live face scan is skipped on this site. Government ID upload, driver license field extraction, and profile-photo face
              matching still run.
            </Alert>
          ) : status?.requireLiveness && !status?.requireLivenessEffective && wizardStep === WIZARD_STEP_LIVE_SCAN ? (
            <Alert severity="info">
              Face liveness is not ready on this site, so this run will continue with ID and profile-photo face matching only.
            </Alert>
          ) : null}

          {errorText ? <ColorTemplate7PopupLargeDark.ErrorBar>{errorText}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

          {showDlDobTrace ? <DobOcrTracePanel trace={dobOcrTrace} compact /> : null}
          {showDlSexTrace ? <SexOcrTracePanel trace={sexOcrTrace} compact /> : null}
          {showPpDobTrace ? <PpDobOcrTracePanel trace={passportDobOcrTrace} compact /> : null}
          {showPpSexTrace ? <PpSexOcrTracePanel trace={passportSexOcrTrace} compact /> : null}

          {result ? (
            <Alert severity="success">
              {VERIFICATION_COMPLETE_PREFIX}.{' '}
              {result.useProfilePhotoAsSelfie
                ? `Profile photo ↔ ID match: ${Math.round(result.idMatchSimilarity || 0)}%.`
                : `Profile photo match: ${Math.round(result.profileMatchSimilarity || 0)}%.`}{' '}
              Extracted:{' '}
              {[result.extracted?.firstName, result.extracted?.middleInitial, result.extracted?.lastName].filter(Boolean).join(' ')}
              {result.extracted?.dateOfBirth ? ` · DOB ${result.extracted.dateOfBirth}` : ''}
              {result.extracted?.city ? ` · ${result.extracted.city}` : ''}
            </Alert>
          ) : null}
        </Stack>

        <Stack
          direction="row"
          spacing={1.5}
          justifyContent={showPilotSkip ? 'space-between' : 'flex-end'}
          alignItems="center"
          flexWrap="wrap"
          sx={{ width: '100%', pt: 1 }}
        >
          {showPilotSkip ? (
            <IdvActionButton
              onClick={handlePilotSkipIdentificationVerification}
              disabled={closing || submitting}
              aria-label="Skip identification verification"
            >
              Skip
            </IdvActionButton>
          ) : null}
          <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ ml: showPilotSkip ? 'auto' : 0 }}>
            {result ? (
              <IdvActionButton onClick={() => void handleClose()} disabled={closing || submitting}>
                {closing ? 'Closing…' : 'Close'}
              </IdvActionButton>
            ) : null}
            {!result && wizardStep > IDV_WIZARD_STEP_CONSENT ? (
              <IdvActionButton onClick={handleWizardBackOrClose} disabled={closing || submitting}>
                Previous
              </IdvActionButton>
            ) : null}
            {!result && wizardStep < WIZARD_STEP_LIVE_SCAN ? (
              <IdvActionButton
                onClick={handleWizardNext}
                disabled={submitting || livenessCooldownLockdown || !canAdvanceWizardStep}
              >
                Next
              </IdvActionButton>
            ) : null}
            {!result && wizardStep === WIZARD_STEP_LIVE_SCAN ? (
              <IdvActionButton
                onClick={() => void handleSubmit()}
                disabled={
                  submitting ||
                  livenessCooldownLockdown ||
                  !consentValidForSave ||
                  !canSaveVerification ||
                  !status?.hasProfilePhoto ||
                  profilePhotoLoadFailed
                }
              >
                {submitting ? 'Saving…' : 'Save'}
              </IdvActionButton>
            ) : null}
          </Stack>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
    </>
  );
}

RekognitionVerifyDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  accountEmail: PropTypes.string,
  singlesId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onVerified: PropTypes.func,
  onFailed: PropTypes.func
};
