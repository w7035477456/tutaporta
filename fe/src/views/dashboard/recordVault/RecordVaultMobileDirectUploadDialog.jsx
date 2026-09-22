import PropTypes from 'prop-types';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import RecordVaultMobileUploadTray from 'views/dashboard/recordVault/RecordVaultMobileUploadTray';
import { recordVaultPopupCloseSx } from 'views/dashboard/recordVault/recordVaultPopupCloseSx';
import { stageMobileUploadFile } from 'api/photoAlbumsMobileUploadFolderFe';
import { useCompactLoginViewport } from 'config/compactLoginViewport';
import {
  GREEN_BUTTON_BORDER,
  GREEN_BUTTON_DISABLED_BG,
  GREEN_BUTTON_ENABLED_BG,
  GREEN_BUTTON_TEXT,
  greenButtonSx
} from 'config/greenButton';
import {
  MOBILE_UPLOAD_PRODUCT_TUTADATES,
  MOBILE_UPLOAD_PRODUCT_TUTANOTES,
  MOBILE_UPLOAD_PRODUCT_TUTAPHOTO,
  requireMobileUploadProduct
} from 'constants/mobileUploadProduct';
import tutaAlbumsImg from 'assets/images/tutaalbums.png';
import tutaDatesImg from 'assets/images/tutaDates.png';
import tutaNotesImg from 'assets/images/tutaNotes.png';

const ACCEPT =
  'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/heic,image/heif,image/avif,image/bmp,image/tiff';

/** Compact: full-page sheet behind the red popup — theme secondary (not white). */
const mobileSheetOverlaySx = {
  bgcolor: 'var(--theme-secondary-color)',
  flexDirection: 'column',
  alignItems: 'stretch',
  justifyContent: 'flex-start',
  overflowY: 'auto',
  px: 0.75,
  py: 0.75
};

/** Force green even when ColorTemplate7 / AuthCard restyles nested MuiButtons. */
const mobileGreenActionButtonSx = {
  ...greenButtonSx(),
  width: '100%',
  bgcolor: `${GREEN_BUTTON_ENABLED_BG} !important`,
  backgroundColor: `${GREEN_BUTTON_ENABLED_BG} !important`,
  backgroundImage: 'none !important',
  color: `${GREEN_BUTTON_TEXT} !important`,
  WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
  border: `${GREEN_BUTTON_BORDER} !important`,
  '&.MuiButton-root': {
    bgcolor: `${GREEN_BUTTON_ENABLED_BG} !important`,
    backgroundColor: `${GREEN_BUTTON_ENABLED_BG} !important`,
    backgroundImage: 'none !important',
    color: `${GREEN_BUTTON_TEXT} !important`,
    WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
    border: `${GREEN_BUTTON_BORDER} !important`
  },
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: `${GREEN_BUTTON_ENABLED_BG} !important`,
      backgroundColor: `${GREEN_BUTTON_ENABLED_BG} !important`,
      backgroundImage: 'none !important',
      color: `${GREEN_BUTTON_TEXT} !important`,
      WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
      border: `${GREEN_BUTTON_BORDER} !important`
    }
  },
  '&.Mui-disabled': {
    bgcolor: `${GREEN_BUTTON_DISABLED_BG} !important`,
    backgroundColor: `${GREEN_BUTTON_DISABLED_BG} !important`,
    backgroundImage: 'none !important',
    color: `${GREEN_BUTTON_TEXT} !important`,
    WebkitTextFillColor: `${GREEN_BUTTON_TEXT} !important`,
    border: `${GREEN_BUTTON_BORDER} !important`
  }
};

const PRODUCT_MOBILE_UI = {
  [MOBILE_UPLOAD_PRODUCT_TUTANOTES]: {
    logo: tutaNotesImg,
    logoAlt: 'Tuta Notes',
    defaultTitle: 'Upload photo to TutaNotes'
  },
  [MOBILE_UPLOAD_PRODUCT_TUTAPHOTO]: {
    logo: tutaAlbumsImg,
    logoAlt: 'Tuta Albums',
    defaultTitle: 'Upload photo to TutaPhoto'
  },
  [MOBILE_UPLOAD_PRODUCT_TUTADATES]: {
    logo: tutaDatesImg,
    logoAlt: 'Tuta Dates',
    defaultTitle: 'Upload photo to TutaDates'
  }
};

/**
 * Phone-as-client upload (camera / gallery — not QR) for TutaNotes, TutaDates and TutaPhoto.
 * Every pick is staged into that product's UPLOAD_FOLDER bucket so its thumbnail shows under the popup.
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
  title = '',
  product = MOBILE_UPLOAD_PRODUCT_TUTANOTES
}) {
  const navigate = useNavigate();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uploadProgress, setUploadProgress] = useState('');
  const [thumbsRefreshToken, setThumbsRefreshToken] = useState(0);
  const isCompact = useCompactLoginViewport();
  const stagingProduct = requireMobileUploadProduct(product);
  const productUi = useMemo(
    () => PRODUCT_MOBILE_UI[stagingProduct] || PRODUCT_MOBILE_UI[MOBILE_UPLOAD_PRODUCT_TUTANOTES],
    [stagingProduct]
  );
  const dialogTitle = String(title || '').trim() || productUi.defaultTitle;

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
    async (e, { multiple = false } = {}) => {
      const input = e.target;
      const list = input.files ? Array.from(input.files) : [];
      input.value = '';
      const files = multiple ? list.filter(Boolean) : list[0] ? [list[0]] : [];
      if (!files.length || !onPickFile) return;
      setBusy(true);
      setError('');
      const failures = [];
      try {
        for (let i = 0; i < files.length; i += 1) {
          const file = files[i];
          setUploadProgress(
            files.length > 1 ? `Uploading ${i + 1} of ${files.length}…` : 'Uploading…'
          );
          try {
            await onPickFile(file);
          } catch (err) {
            failures.push(err?.message || file?.name || 'Upload failed');
            continue;
          }
          // Thumbnail strip / sheet reads UPLOAD_FOLDER — a failed copy must not fail the upload.
          try {
            await stageMobileUploadFile(file, stagingProduct);
            setThumbsRefreshToken((n) => n + 1);
            onStaged?.();
          } catch (stageErr) {
            console.warn(
              '[RecordVaultMobileDirectUploadDialog] stageMobileUploadFile',
              stageErr?.message ?? stageErr
            );
          }
        }
        if (failures.length) {
          const ok = files.length - failures.length;
          setError(
            ok > 0
              ? `${ok} uploaded; ${failures.length} failed. ${failures[0]}`
              : failures[0] || 'Upload failed. Please try again.'
          );
        }
      } finally {
        setUploadProgress('');
        setBusy(false);
      }
    },
    [onPickFile, onStaged, stagingProduct]
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
            product={stagingProduct}
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
      {isCompact ? (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            pt: 0.5,
            pb: 0.25
          }}
        >
          <Box
            component="img"
            src={productUi.logo}
            alt={productUi.logoAlt}
            sx={{
              maxWidth: 'min(72vw, 220px)',
              maxHeight: 88,
              width: 'auto',
              height: 'auto',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </Box>
      ) : null}
      <ColorTemplate7PopupLargeDark.Title>{dialogTitle}</ColorTemplate7PopupLargeDark.Title>
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
          <ColorTemplate7PopupLargeDark.ActionButton
            type="button"
            disabled={disabled || busy}
            onClick={() => cameraInputRef.current?.click()}
            sx={isCompact ? mobileGreenActionButtonSx : { width: '100%' }}
          >
            Take photo
          </ColorTemplate7PopupLargeDark.ActionButton>
          <ColorTemplate7PopupLargeDark.ActionButton
            type="button"
            disabled={disabled || busy}
            onClick={() => galleryInputRef.current?.click()}
            sx={isCompact ? mobileGreenActionButtonSx : { width: '100%' }}
          >
            Choose from gallery
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
        {busy ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1 }}>
            <CircularProgress size={22} />
            <Typography variant="body2">{uploadProgress || 'Uploading…'}</Typography>
          </Box>
        ) : null}
        <Box
          component="input"
          ref={cameraInputRef}
          type="file"
          accept={ACCEPT}
          capture="environment"
          onChange={(e) => void handleFile(e, { multiple: false })}
          sx={{ display: 'none' }}
        />
        <Box
          component="input"
          ref={galleryInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          onChange={(e) => void handleFile(e, { multiple: true })}
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
  title: PropTypes.string,
  product: PropTypes.oneOf(['tutaphoto', 'tutanotes', 'tutadates'])
};
