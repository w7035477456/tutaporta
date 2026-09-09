import PropTypes from 'prop-types';
import { useCallback, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import { recordVaultPopupCloseSx } from 'views/dashboard/recordVault/recordVaultPopupCloseSx';

const ACCEPT =
  'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,image/avif,image/bmp,image/tiff';

/**
 * Phone-as-client upload into the open TutaNotes note (camera / gallery — not QR).
 */
export default function RecordVaultMobileDirectUploadDialog({
  open,
  onClose,
  onPickFile,
  disabled = false,
  noteTitle = '',
  title = 'Upload to current note'
}) {
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const handleFile = useCallback(
    async (e) => {
      const input = e.target;
      const file = input.files?.[0];
      input.value = '';
      if (!file || !onPickFile) return;
      setBusy(true);
      setError('');
      try {
        await onPickFile(file);
      } catch (err) {
        setError(err?.message || 'Upload failed. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [onPickFile]
  );

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={() => {
        if (busy) return;
        onClose?.();
      }}
      closeOnBackdrop={!busy}
      closeButtonAriaLabel="Close upload photo"
      maxWidth="min(96vw, 420px)"
      centerInWindow
      closeButtonSx={recordVaultPopupCloseSx}
    >
      <ColorTemplate7PopupLargeDark.Title>{title}</ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body spacing={1.5}>
        <Typography variant="body2" sx={{ textAlign: 'center' }}>
          {noteTitle
            ? `Photos are added to “${noteTitle}”.`
            : 'Photos are added to the note currently open.'}
        </Typography>
        {error ? (
          <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700, textAlign: 'center' }}>
            {error}
          </Typography>
        ) : null}
        <Stack spacing={1.25} sx={{ width: '100%', alignItems: 'stretch' }}>
          <GreenButton
            type="button"
            disabled={disabled || busy}
            onClick={() => cameraInputRef.current?.click()}
            sx={{ width: '100%' }}
          >
            Take photo
          </GreenButton>
          <GreenButton
            type="button"
            disabled={disabled || busy}
            onClick={() => galleryInputRef.current?.click()}
            sx={{ width: '100%' }}
          >
            Choose from gallery
          </GreenButton>
        </Stack>
        {busy ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1 }}>
            <CircularProgress size={22} />
            <Typography variant="body2">Uploading…</Typography>
          </Box>
        ) : null}
        <Box
          component="input"
          ref={cameraInputRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          onChange={(e) => void handleFile(e)}
          sx={{ display: 'none' }}
        />
        <Box
          component="input"
          ref={galleryInputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => void handleFile(e)}
          sx={{ display: 'none' }}
        />
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

RecordVaultMobileDirectUploadDialog.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  onPickFile: PropTypes.func,
  disabled: PropTypes.bool,
  noteTitle: PropTypes.string,
  title: PropTypes.string
};
