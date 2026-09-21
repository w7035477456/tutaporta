import PropTypes from 'prop-types';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import RecordVaultMobileUploadTray from 'views/dashboard/recordVault/RecordVaultMobileUploadTray';
import { recordVaultPopupCloseSx } from 'views/dashboard/recordVault/recordVaultPopupCloseSx';
import { stageMobileUploadFile } from 'api/photoAlbumsMobileUploadFolderFe';
import { useCompactLoginViewport } from 'config/compactLoginViewport';

const ACCEPT =
  'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,image/avif,image/bmp,image/tiff';

/** Compact: opaque white sheet — popup on top, uploaded thumbnails stacked below, nothing else. */
const mobileSheetOverlaySx = {
  bgcolor: '#ffffff',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  overflowY: 'auto',
  px: 0.75,
  py: 0.75
};

/**
 * Phone-as-client upload (camera / gallery — not QR) for TutaNotes, TutaDates and TutaPhoto.
 * Every pick is also staged into UPLOAD_FOLDER so its thumbnail shows under the popup.
 * Compact: the popup is the whole page, so closing it leaves for /mall.
 */
export default function RecordVaultMobileDirectUploadDialog({
  open,
  onClose,
  onPickFile,
  onStaged,
  onExitToMall,
  disabled = false,
  noteTitle = '',
  title = 'Upload to current note'
}) {
  const navigate = useNavigate();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [thumbsRefreshToken, setThumbsRefreshToken] = useState(0);
  const isCompact = useCompactLoginViewport();

  /**
   * Mobile: X closes the whole upload page → back to the mall (vault panes log off first).
   * The mall navigation is unconditional: a pane that is busy or whose logoff fails must
   * not leave the phone stranded on the workspace behind the sheet.
   */
  const handleRequestClose = useCallback(() => {
    if (busy) return;
    onClose?.();
    if (!isCompact) return;
    void (async () => {
      try {
        await onExitToMall?.();
      } catch (err) {
        console.warn('[RecordVaultMobileDirectUploadDialog] exit to mall', err?.message ?? err);
      }
      navigate('/mall');
    })();
  }, [busy, isCompact, navigate, onClose, onExitToMall]);

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
        // Thumbnail strip / sheet reads UPLOAD_FOLDER — a failed copy must not fail the upload.
        try {
          await stageMobileUploadFile(file);
          setThumbsRefreshToken((n) => n + 1);
          onStaged?.();
        } catch (stageErr) {
          console.warn('[RecordVaultMobileDirectUploadDialog] stageMobileUploadFile', stageErr?.message ?? stageErr);
        }
      } catch (err) {
        setError(err?.message || 'Upload failed. Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [onPickFile, onStaged]
  );

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={handleRequestClose}
      closeOnBackdrop={!busy && !isCompact}
      closeButtonAriaLabel="Close upload photo"
      maxWidth="min(96vw, 420px)"
      centerInWindow
      closeButtonSx={recordVaultPopupCloseSx}
      overlaySx={isCompact ? mobileSheetOverlaySx : undefined}
      overlayFooter={
        isCompact ? (
          <RecordVaultMobileUploadTray
            active={open}
            disabled={busy}
            layout="grid"
            plain
            refreshToken={thumbsRefreshToken}
            emptyHint="Take a photo or choose from gallery — thumbnails appear here."
          />
        ) : null
      }
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
  /** Fired after the picked file is copied into UPLOAD_FOLDER (refresh a pane-level tray). */
  onStaged: PropTypes.func,
  /** Compact X target — vault panes pass their Exit to Mall (logoff) handler. */
  onExitToMall: PropTypes.func,
  disabled: PropTypes.bool,
  noteTitle: PropTypes.string,
  title: PropTypes.string
};
