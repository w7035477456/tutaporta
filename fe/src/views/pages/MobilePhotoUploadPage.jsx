import { useCallback, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import Logo from 'ui-component/Logo';
import { uploadPhotoViaMobileSession } from 'api/mobilePhotoUploadFe';

const ACCEPT =
  'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,image/avif,image/bmp,image/tiff';

export default function MobilePhotoUploadPage() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = String(pathToken ?? searchParams.get('token') ?? '').trim();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const missingToken = !token;
  const uploadedFromRedirect = searchParams.get('uploaded') === '1';
  const errorFromRedirect = String(searchParams.get('error') ?? '').trim();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(uploadedFromRedirect);

  const handleFileSelected = useCallback(
    async (file) => {
      if (!file || !token || uploading) return;
      setUploading(true);
      setUploadError('');
      setUploadSuccess(false);
      try {
        await uploadPhotoViaMobileSession(token, file);
        setUploadSuccess(true);
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (galleryInputRef.current) galleryInputRef.current.value = '';
      } catch (err) {
        setUploadError(err?.message || 'Failed to upload photo.');
      } finally {
        setUploading(false);
      }
    },
    [token, uploading]
  );

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

        {!missingToken && uploadSuccess ? (
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

            {uploadError ? <Alert severity="error">{uploadError}</Alert> : null}
            {!uploadError && errorFromRedirect ? (
              <Alert severity="error">{decodeURIComponent(errorFromRedirect)}</Alert>
            ) : null}

            {uploading ? (
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
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSelected(file);
              }}
            />

            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileSelected(file);
              }}
            />

            <Stack spacing={1.5}>
              <SelectedButtonTemplate
                fullWidth
                disabled={uploading}
                onClick={() => cameraInputRef.current?.click()}
              >
                Take photo
              </SelectedButtonTemplate>
              <SelectedButtonTemplate
                fullWidth
                disabled={uploading}
                onClick={() => galleryInputRef.current?.click()}
              >
                Choose from gallery
              </SelectedButtonTemplate>
            </Stack>

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
