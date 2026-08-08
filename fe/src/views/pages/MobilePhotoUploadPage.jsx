import { useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import Logo from 'ui-component/Logo';

const ACCEPT = 'image/jpeg,image/jpg,image/png,image/gif,image/webp';

export default function MobilePhotoUploadPage() {
  const { token: pathToken } = useParams();
  const [searchParams] = useSearchParams();
  const token = String(pathToken ?? searchParams.get('token') ?? '').trim();
  const cameraFormRef = useRef(null);
  const galleryFormRef = useRef(null);
  const missingToken = !token;
  const uploaded = searchParams.get('uploaded') === '1';
  const errorFromRedirect = String(searchParams.get('error') ?? '').trim();

  const uploadAction = token
    ? `/api/mobilePhotoUpload/photo?token=${encodeURIComponent(token)}`
    : '';

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

        {!missingToken && uploaded ? (
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

            {errorFromRedirect ? <Alert severity="error">{decodeURIComponent(errorFromRedirect)}</Alert> : null}

            <form
              ref={cameraFormRef}
              method="POST"
              action={uploadAction}
              encType="multipart/form-data"
              style={{ display: 'none' }}
            >
              <input
                type="file"
                name="photo"
                accept={ACCEPT}
                capture="user"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            </form>

            <form
              ref={galleryFormRef}
              method="POST"
              action={uploadAction}
              encType="multipart/form-data"
              style={{ display: 'none' }}
            >
              <input
                type="file"
                name="photo"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files?.[0]) {
                    e.currentTarget.form?.requestSubmit();
                  }
                }}
              />
            </form>

            <Stack spacing={1.5}>
              <SelectedButtonTemplate
                fullWidth
                onClick={() => cameraFormRef.current?.querySelector('input[type="file"]')?.click()}
              >
                Take photo
              </SelectedButtonTemplate>
              <SelectedButtonTemplate
                fullWidth
                onClick={() => galleryFormRef.current?.querySelector('input[type="file"]')?.click()}
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
