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
  uploadPhotoViaMobileSession
} from 'api/mobilePhotoUploadFe';

const ACCEPT_CAMERA = 'image/jpeg,image/jpg,image/png,image/gif,image/webp';
const ACCEPT_GALLERY = 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,image/*';

export default function MobilePhotoUploadPage() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = String(pathToken ?? searchParams.get('token') ?? '').trim();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const missingToken = !token;

  const [validating, setValidating] = useState(!missingToken);
  const [sessionError, setSessionError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedOk, setUploadedOk] = useState(false);

  useEffect(() => {
    if (missingToken) {
      setValidating(false);
      return undefined;
    }
    let cancelled = false;
    setValidating(true);
    setSessionError('');
    void fetchMobilePhotoUploadSessionPublic(token)
      .then((data) => {
        if (cancelled) return;
        if (data?.expired && !data?.valid) {
          setSessionError('This upload link has expired. Scan the QR code again from your computer.');
          return;
        }
        if (data && data.valid === false && !data.completed) {
          setSessionError('Upload link is not valid. Scan a fresh QR code from your computer.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setSessionError(err?.message || 'Upload link is not valid. Scan a fresh QR code from your computer.');
      })
      .finally(() => {
        if (!cancelled) setValidating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [missingToken, token]);

  const handleFile = useCallback(
    async (file) => {
      if (!file || !token || uploading) return;
      setUploading(true);
      setUploadError('');
      setUploadedOk(false);
      try {
        await uploadPhotoViaMobileSession(token, file);
        setUploadedOk(true);
      } catch (err) {
        setUploadError(err?.message || 'Failed to upload photo');
      } finally {
        setUploading(false);
      }
    },
    [token, uploading]
  );

  const onInputChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const blocked = missingToken || Boolean(sessionError) || validating;

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

        {validating ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={32} />
          </Box>
        ) : null}

        {!missingToken && sessionError ? <Alert severity="error">{sessionError}</Alert> : null}

        {!missingToken && !sessionError && !validating ? (
          <>
            <Typography sx={{ lineHeight: 1.5, textAlign: 'center' }}>
              Take a new photo or choose one from your gallery. It will be added to your OnlineMall.Website album on
              your computer.
            </Typography>

            {uploadedOk ? (
              <Alert severity="success">
                Photo uploaded. Your album on your computer will update automatically. You can upload another photo
                below using the same QR link.
              </Alert>
            ) : null}

            {uploadError ? <Alert severity="error">{uploadError}</Alert> : null}

            <input
              ref={cameraInputRef}
              type="file"
              accept={ACCEPT_CAMERA}
              capture="user"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={onInputChange}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept={ACCEPT_GALLERY}
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={onInputChange}
            />

            <Stack spacing={1.5}>
              <SelectedButtonTemplate
                fullWidth
                disabled={blocked || uploading}
                onClick={() => cameraInputRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Take photo'}
              </SelectedButtonTemplate>
              <SelectedButtonTemplate
                fullWidth
                disabled={blocked || uploading}
                onClick={() => galleryInputRef.current?.click()}
              >
                {uploading ? 'Uploading…' : 'Choose from gallery'}
              </SelectedButtonTemplate>
            </Stack>

            {uploading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={28} />
              </Box>
            ) : null}

            <Typography variant="caption" sx={{ textAlign: 'center', opacity: 0.85, display: 'block' }}>
              After you pick a photo, wait for the success message — do not close the page too soon. You can upload
              multiple photos with the same QR code.
            </Typography>
          </>
        ) : null}
      </Stack>
    </Box>
  );
}
