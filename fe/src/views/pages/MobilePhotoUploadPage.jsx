import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import Logo from 'ui-component/Logo';
import {
  fetchMobilePhotoUploadSessionPublic,
  getMobilePhotoUploadDebugLines,
  isMobilePhotoUploadDebugEnabled,
  uploadPhotoViaMobileSession
} from 'api/mobilePhotoUploadFe';
import { mobilePhotoUploadDebugLog } from 'utils/mobilePhotoUploadDebug';

const ACCEPT =
  'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,image/avif,image/bmp,image/tiff';

export default function MobilePhotoUploadPage() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = String(pathToken ?? searchParams.get('token') ?? '').trim();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [sessionOk, setSessionOk] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [debugLines, setDebugLines] = useState([]);
  const missingToken = !token;
  const uploaded = searchParams.get('uploaded') === '1';
  const errorFromRedirect = String(searchParams.get('error') ?? '').trim();
  const showDebug = isMobilePhotoUploadDebugEnabled();

  const refreshDebugLines = useCallback(() => {
    setDebugLines(getMobilePhotoUploadDebugLines());
  }, []);

  useEffect(() => {
    mobilePhotoUploadDebugLog('page mount', {
      tokenLen: token.length,
      path: window.location.pathname,
      showDebug
    });
    refreshDebugLines();
  }, [refreshDebugLines, showDebug, token.length]);

  useEffect(() => {
    if (missingToken) return undefined;
    let cancelled = false;
    setValidating(true);
    setError('');
    mobilePhotoUploadDebugLog('validate on mount START');
    fetchMobilePhotoUploadSessionPublic(token)
      .then((data) => {
        if (cancelled) return;
        setSessionOk(data);
        mobilePhotoUploadDebugLog('validate on mount OK', {
          valid: data?.valid,
          expired: data?.expired,
          purpose: data?.purpose
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionOk(null);
        const msg = err?.message || 'Upload link is not valid';
        setError(msg);
        mobilePhotoUploadDebugLog('validate on mount FAIL', {
          message: msg,
          debug: err?.debug
        });
      })
      .finally(() => {
        if (!cancelled) {
          setValidating(false);
          refreshDebugLines();
        }
      });
    return () => {
      cancelled = true;
    };
  }, [missingToken, refreshDebugLines, token]);

  const handleFileSelected = async (file) => {
    if (!file || !token) return;
    setSubmitting(true);
    setError('');
    setSuccess(false);
    mobilePhotoUploadDebugLog('file selected', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    try {
      await uploadPhotoViaMobileSession(token, file);
      setSuccess(true);
      mobilePhotoUploadDebugLog('upload complete');
    } catch (err) {
      const msg = err?.message || 'Failed to upload photo';
      setError(msg);
      mobilePhotoUploadDebugLog('upload error shown to user', { message: msg, debug: err?.debug });
    } finally {
      setSubmitting(false);
      refreshDebugLines();
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const onCameraChange = (e) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelected(file);
  };

  const onGalleryChange = (e) => {
    const file = e.target.files?.[0];
    if (file) void handleFileSelected(file);
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'var(--theme-daynight-color)',
        color: 'var(--theme-inverse-daynight-color)',
        px: 2,
        py: 3
      }}
    >
      <Stack spacing={2.5} sx={{ maxWidth: 420, mx: 'auto' }}>
        <Box sx={{ textAlign: 'center' }}>
          <Logo authBranding />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 700, textAlign: 'center' }}>
          Upload profile photo
        </Typography>

        {missingToken ? (
          <Alert severity="error">Missing upload link. Scan the QR code again from your computer.</Alert>
        ) : null}

        {!missingToken && validating ? (
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
            <CircularProgress size={24} aria-label="Checking upload link" />
            <Typography>Checking upload link…</Typography>
          </Stack>
        ) : null}

        {!missingToken && !validating && sessionOk && !sessionOk.valid && !sessionOk.expired ? (
          <Alert severity="warning">
            This upload link may no longer be valid. Scan a fresh QR code from your computer.
          </Alert>
        ) : null}

        {!missingToken && (uploaded || success) ? (
          <Alert severity="success">
            Photo uploaded. Your album on your computer will update automatically. You can upload another photo below
            using the same QR link.
          </Alert>
        ) : null}

        {!missingToken ? (
          <>
            <Typography sx={{ lineHeight: 1.5, textAlign: 'center' }}>
              Take a new photo or choose one from your gallery. It will be added to your OnlineMall.Website album on
              your computer.
            </Typography>

            {errorFromRedirect && !error ? (
              <Alert severity="error">{decodeURIComponent(errorFromRedirect)}</Alert>
            ) : null}
            {error ? <Alert severity="error">{error}</Alert> : null}

            {submitting ? (
              <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ py: 1 }}>
                <CircularProgress size={28} aria-label="Uploading photo" />
                <Typography>Uploading photo…</Typography>
              </Stack>
            ) : null}

            <input
              ref={cameraInputRef}
              type="file"
              accept={ACCEPT}
              capture="user"
              onChange={onCameraChange}
              style={{ display: 'none' }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={onGalleryChange}
              style={{ display: 'none' }}
            />

            <Stack spacing={1.5}>
              <SelectedButtonTemplate
                fullWidth
                disabled={submitting || validating}
                onClick={() => cameraInputRef.current?.click()}
              >
                Take photo
              </SelectedButtonTemplate>
              <SelectedButtonTemplate
                fullWidth
                disabled={submitting || validating}
                onClick={() => galleryInputRef.current?.click()}
              >
                Choose from gallery
              </SelectedButtonTemplate>
            </Stack>

            <Typography variant="caption" sx={{ textAlign: 'center', opacity: 0.85, display: 'block' }}>
              After you pick a photo, wait for the success message — do not close the page too soon. You can upload
              multiple photos with the same QR code.
            </Typography>

            {showDebug ? (
              <Box
                sx={{
                  mt: 1,
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'rgba(0,0,0,0.35)',
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  lineHeight: 1.35,
                  textAlign: 'left',
                  maxHeight: 220,
                  overflow: 'auto'
                }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                  Debug log (add ?debug=1 to URL to always show)
                </Typography>
                {debugLines.length === 0 ? (
                  <Typography variant="caption" component="div">
                    (no events yet)
                  </Typography>
                ) : (
                  debugLines.map((line, idx) => (
                    <Typography key={`${line.at}-${idx}`} variant="caption" component="div" sx={{ wordBreak: 'break-all' }}>
                      {line.at} {line.step}
                      {line.detail != null ? ` ${JSON.stringify(line.detail)}` : ''}
                    </Typography>
                  ))
                )}
              </Box>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
