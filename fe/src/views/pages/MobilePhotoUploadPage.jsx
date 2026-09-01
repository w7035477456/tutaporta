import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import Logo from 'ui-component/Logo';
import {
  fetchMobilePhotoUploadSessionPublic,
  getMobilePhotoUploadDebugLines,
  isMobilePhotoUploadDebugEnabled,
  uploadPhotoViaMobileSession
} from 'api/mobilePhotoUploadFe';
import { mobilePhotoUploadDebugLog } from 'utils/mobilePhotoUploadDebug';
import { downsizeImageFileToMaxMb } from 'utils/photoAlbumsDownsizeMedia';

const ACCEPT =
  'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,image/avif,image/bmp,image/tiff';

/** Matches STORAGE_PERMISSION_CODE in be/utils/storagePermissionError.js. */
const STORAGE_PERMISSION_CODE = 'STORAGE_PERMISSION';

/**
 * Phone cameras produce 5–15 MB files. Shrinking in the browser keeps the POST
 * small enough to finish on cellular and avoids proxy/WAF size limits.
 */
const UPLOAD_TARGET_MAX_MB = 2;

export default function MobilePhotoUploadPage() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = String(pathToken ?? searchParams.get('token') ?? '').trim();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadedNow, setUploadedNow] = useState(false);
  const [validating, setValidating] = useState(false);
  const [sessionOk, setSessionOk] = useState(null);
  const [error, setError] = useState('');
  const [debugLines, setDebugLines] = useState([]);
  const [permissionPopupOpen, setPermissionPopupOpen] = useState(false);
  const missingToken = !token;
  const uploaded = searchParams.get('uploaded') === '1' || uploadedNow;
  const errorFromRedirect = String(searchParams.get('error') ?? '').trim();
  const errorCode = String(searchParams.get('code') ?? '').trim();
  const isPermissionError = errorCode === STORAGE_PERMISSION_CODE;
  const showDebug = isMobilePhotoUploadDebugEnabled();

  const refreshDebugLines = useCallback(() => {
    setDebugLines(getMobilePhotoUploadDebugLines());
  }, []);

  const handleFileChange = useCallback(
    async (e) => {
      const input = e.target;
      const file = input.files?.[0];
      if (!file) return;
      input.value = '';

      mobilePhotoUploadDebugLog('file selected', { name: file.name, size: file.size, type: file.type });
      setSubmitting(true);
      setUploadedNow(false);
      setError('');
      setUploadPercent(0);
      setUploadStage('Preparing photo…');

      try {
        let toUpload = file;
        if (file.size > UPLOAD_TARGET_MAX_MB * 1024 * 1024) {
          const smaller = await downsizeImageFileToMaxMb(file, UPLOAD_TARGET_MAX_MB);
          if (smaller) {
            toUpload = smaller;
            mobilePhotoUploadDebugLog('downsized before upload', {
              fromBytes: file.size,
              toBytes: smaller.size
            });
          } else {
            mobilePhotoUploadDebugLog('downsize skipped — uploading original', { bytes: file.size });
          }
        }

        setUploadStage('Uploading photo…');
        await uploadPhotoViaMobileSession(token, toUpload, {
          onProgress: (pct) => setUploadPercent(pct)
        });
        setUploadPercent(100);
        setUploadedNow(true);
      } catch (err) {
        const msg = err?.message || 'Upload failed. Scan a fresh QR code from your computer and try again.';
        setError(msg);
        if (err?.response?.data?.code === STORAGE_PERMISSION_CODE) {
          setPermissionPopupOpen(true);
        }
        mobilePhotoUploadDebugLog('upload FAIL (page)', { message: msg });
      } finally {
        setSubmitting(false);
        setUploadStage('');
        refreshDebugLines();
      }
    },
    [refreshDebugLines, token]
  );

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

  useEffect(() => {
    if (uploaded) {
      mobilePhotoUploadDebugLog('upload complete (redirect)');
    }
    if (errorFromRedirect) {
      mobilePhotoUploadDebugLog('upload error from redirect', {
        error: errorFromRedirect,
        code: errorCode || null
      });
    }
    if (isPermissionError) {
      setPermissionPopupOpen(true);
    }
  }, [errorCode, errorFromRedirect, isPermissionError, uploaded]);

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

        {!missingToken && (uploaded) ? (
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
                <CircularProgress
                  size={28}
                  aria-label="Uploading photo"
                  variant={uploadPercent > 0 ? 'determinate' : 'indeterminate'}
                  value={uploadPercent}
                />
                <Typography>
                  {uploadStage || 'Uploading photo…'}
                  {uploadStage === 'Uploading photo…' && uploadPercent > 0 ? ` ${uploadPercent}%` : ''}
                </Typography>
              </Stack>
            ) : null}

            <input
              ref={cameraInputRef}
              type="file"
              name="photo"
              accept={ACCEPT}
              capture="user"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <input
              ref={galleryInputRef}
              type="file"
              name="photo"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
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

      <Dialog
        open={permissionPopupOpen}
        onClose={() => setPermissionPopupOpen(false)}
        aria-labelledby="upload-permission-error-title"
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle id="upload-permission-error-title" sx={{ fontWeight: 700, color: 'error.main' }}>
          Upload failed
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1.5 }}>
            Permission error on the server. Your photo was received but could not be saved.
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            This is a server configuration problem, not a problem with your photo or your phone. Please contact
            admin — retrying will not help until it is fixed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <SelectedButtonTemplate fullWidth onClick={() => setPermissionPopupOpen(false)}>
            Close
          </SelectedButtonTemplate>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
