import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Alert from '@mui/material/Alert';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import BusyHourglassOverlay from 'ui-component/BusyHourglassOverlay';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { captureDriverLicenseFromIdImage, fetchRekognitionStatus } from 'api/rekognitionFe';
import { loadIdVerificationSamplePreviews } from 'constants/idVerificationSampleImages';
import { normalizeVerificationImageFile, normalizeVerificationImageFromUrl } from 'utils/normalizeVerificationImage';
import { sanitizeUserFacingTechTerms } from 'utils/sanitizeUserFacingTechTerms';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import IdentificationVerificationUploadDialog from './IdentificationVerificationUploadDialog';
import { IDV_BUTTON_THICK_BLACK_BORDER } from './IdentificationVerificationBoard';

const verificationNoticePanelSx = {
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

const passportFrameSx = {
  position: 'relative',
  width: '100%',
  maxWidth: 360,
  minHeight: 200,
  border: '3px dashed var(--theme-primary-color)',
  borderRadius: 1,
  bgcolor: 'rgba(25, 118, 210, 0.12)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  p: 1,
  boxSizing: 'border-box',
  mx: 'auto'
};

const passportPreviewImgSx = {
  display: 'block',
  width: 'auto',
  height: 'auto',
  maxWidth: '100%',
  maxHeight: 180,
  objectFit: 'contain',
  borderRadius: 0.5
};

const passportProcessingStatusSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0.75,
  width: '100%'
};

const passportFrameBusyOverlaySx = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: 'rgba(255, 255, 255, 0.55)',
  borderRadius: 1
};

export default function PassportCitizenshipUploadDialog({ open, onClose, onComplete }) {
  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [passportPreview, setPassportPreview] = useState('');
  const [passportUserUploaded, setPassportUserUploaded] = useState(false);
  const [passportVerifying, setPassportVerifying] = useState(false);
  const [passportVerified, setPassportVerified] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const autoProcessRef = useRef({ key: '', inFlight: false });

  const resetState = useCallback(() => {
    setPassportPreview('');
    setPassportUserUploaded(false);
    setPassportVerifying(false);
    setPassportVerified(false);
    setErrorText('');
    setUploadDialogOpen(false);
    autoProcessRef.current = { key: '', inFlight: false };
  }, []);

  useEffect(() => {
    if (!open) {
      resetState();
      return;
    }
    setLoadingStatus(true);
    void fetchRekognitionStatus()
      .then((data) => setStatus(data))
      .catch(() => setStatus(null))
      .finally(() => setLoadingStatus(false));

    let cancelled = false;
    void loadIdVerificationSamplePreviews()
      .then(({ passport }) => {
        if (cancelled) return;
        setPassportPreview(passport);
        setPassportUserUploaded(false);
      })
      .catch(() => {
        if (cancelled) return;
        setPassportPreview('');
      });
    return () => {
      cancelled = true;
    };
  }, [open, resetState]);

  const processPassportImage = useCallback(
    async (preview) => {
      if (!preview) return;
      setPassportVerifying(true);
      setPassportVerified(false);
      setErrorText('');
      try {
        const data = await captureDriverLicenseFromIdImage({
          idImage: preview,
          documentType: 'passport'
        });
        setPassportVerified(true);
        onComplete?.(data);
        onClose?.();
      } catch (err) {
        const msg = sanitizeUserFacingTechTerms(
          err?.response?.data?.error || err?.message || 'Passport processing failed'
        );
        setErrorText(msg);
        setPassportVerified(false);
      } finally {
        setPassportVerifying(false);
      }
    },
    [onClose, onComplete]
  );

  useEffect(() => {
    if (!open || !passportUserUploaded || !passportPreview) return undefined;
    const key = `${passportPreview.length}|${passportPreview.slice(-96)}`;
    if (!key || autoProcessRef.current.inFlight || autoProcessRef.current.key === key) return undefined;
    autoProcessRef.current.inFlight = true;
    let cancelled = false;
    void processPassportImage(passportPreview).finally(() => {
      if (cancelled) return;
      autoProcessRef.current.inFlight = false;
      autoProcessRef.current.key = key;
    });
    return () => {
      cancelled = true;
    };
  }, [open, passportUserUploaded, passportPreview, processPassportImage]);

  async function handlePassportFile(file) {
    if (!file) return;
    const dataUrl = await normalizeVerificationImageFile(file);
    setPassportPreview(dataUrl);
    setPassportUserUploaded(true);
    setPassportVerified(false);
    setErrorText('');
    autoProcessRef.current = { key: '', inFlight: false };
  }

  async function handlePassportPhoneUpload(photosId) {
    const id = Number(photosId);
    if (!Number.isFinite(id) || id < 1) {
      throw new Error('Invalid photo from phone upload');
    }
    const dataUrl = await normalizeVerificationImageFromUrl(`${getApiBaseUrl()}/api/photo/${id}`);
    setPassportPreview(dataUrl);
    setPassportUserUploaded(true);
    setPassportVerified(false);
    setErrorText('');
    autoProcessRef.current = { key: '', inFlight: false };
  }

  const rekognitionUnavailable = !loadingStatus && status && !status.configured;

  return (
    <>
      <BusyHourglassOverlay open={passportVerifying} label="Verifying passport" />
      <ColorTemplate7PopupLargeDark
        open={open}
        closeOnBackdrop={false}
        showCloseButton
        closeButtonDisabled={passportVerifying}
        onClose={() => {
          if (passportVerifying) return;
          onClose?.();
        }}
        closeButtonAriaLabel="Close passport upload"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={2}>
          <ColorTemplate7PopupLargeDark.Title>Identification Verification</ColorTemplate7PopupLargeDark.Title>

          <Stack spacing={2} sx={{ width: '100%' }}>
            <Box sx={verificationNoticePanelSx}>
              Notice: Your Driver Licennse and Passport is scan for basic info, in temporary memory only and is not
              permanent stored. For your security, we do not scan for DL Id or Passpor ID, and never store image of Driver
              License or Passport.
            </Box>

            <ColorTemplate7PopupLargeDark.SectionTitle sx={{ textAlign: 'center', mt: 0 }}>
              Step 4: Passport
            </ColorTemplate7PopupLargeDark.SectionTitle>

            <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', width: '100%' }}>
              Passport verification is completely optional, but taking this step can really help your profile stand out!
              Statistically, verified details—like your citizenship and birth country—make your profile much more
              attractive to potential matches. Your privacy is our top priority. Feel free to cover your passport number
              with a piece of tape; we just need to clearly see your name, photo, country of citizenship, place of birth,
              and date of birth. To keep your data secure, we only extract these details and never store the actual image
              of your passport. Plus, you are always in control and can choose to hide any of this information from your
              public profile at any time.
            </ColorTemplate7PopupLargeDark.BodyText>

            {rekognitionUnavailable ? (
              <Alert severity="warning">Identity verification is not available on the server right now.</Alert>
            ) : null}
            {errorText ? <Alert severity="error">{errorText}</Alert> : null}
            {passportVerifying ? (
              <Box sx={passportProcessingStatusSx} role="status" aria-live="polite">
                <ColorTemplate7PopupLargeDark.BodyText sx={{ textAlign: 'center', fontWeight: 700 }}>
                  Extracting citizenship and place of birth from your passport…
                </ColorTemplate7PopupLargeDark.BodyText>
              </Box>
            ) : null}
            {passportVerified ? (
              <Alert severity="success">Passport information saved.</Alert>
            ) : null}

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5 }}>
              <ColorTemplate7PopupLargeDark.SectionLabel sx={{ fontWeight: 700, textAlign: 'center' }}>
                Passport (Optional)
              </ColorTemplate7PopupLargeDark.SectionLabel>
              <Box sx={passportFrameSx}>
                {passportPreview ? (
                  <Box component="img" src={passportPreview} alt="Passport preview" sx={passportPreviewImgSx} />
                ) : null}
                {passportVerifying ? <Box sx={passportFrameBusyOverlaySx} aria-hidden /> : null}
              </Box>
              <GreenButton
                onClick={() => setUploadDialogOpen(true)}
                disabled={passportVerifying || rekognitionUnavailable}
              >
                Upload Passport ID
              </GreenButton>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%', pt: 1 }}>
            <ColorTemplate7PopupLargeDark.ActionButton
              thickBlackBorder={IDV_BUTTON_THICK_BLACK_BORDER}
              onClick={() => onClose?.()}
              disabled={passportVerifying}
            >
              Cancel
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <IdentificationVerificationUploadDialog
        open={uploadDialogOpen}
        kind="passport"
        onClose={() => setUploadDialogOpen(false)}
        onDesktopFile={(file) => handlePassportFile(file)}
        onPhoneUploadComplete={(photosId) => handlePassportPhoneUpload(photosId)}
      />
    </>
  );
}

PassportCitizenshipUploadDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onComplete: PropTypes.func
};
