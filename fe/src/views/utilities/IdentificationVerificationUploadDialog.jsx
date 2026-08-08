import { useCallback, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import ProfilePhotoUploadQrPanel from 'components/ProfilePhotoUploadQrPanel';
import dragDropClickUploadImg from 'assets/images/dragDropClickUpload.png';
import { isAllowedUploadImageFile } from 'api/myPhotosFe';
import { COLOR_TEMPLATE7_POPUP_TEXT, COLOR_TEMPLATE7_POPUP_Z_INDEX } from 'config/colorTemplate7PopupLargeDark';
import { buttonHoverMagnifyTransitionSx, getHoverMagnifyFactor, hoverMagnifyFontSizeSx } from 'config/hoverMagnifyEnv';
import useColorTemplate7PopupLargeDarkLayout from 'hooks/useColorTemplate7PopupLargeDarkLayout';

const UPLOAD_DIALOG_MAX_WIDTH = 'min(960px, calc(100vw - 24px))';

const UPLOAD_KIND_TITLES = {
  profile: 'Upload New Profile',
  driver_license: 'Upload Driver License ID',
  passport: 'Upload Passport ID'
};

const uploadGraphicHoverSx = {
  transition: 'transform 0.15s ease',
  transformOrigin: 'center center',
  '@media (hover: hover)': {
    '.idv-upload-drop:hover &': {
      transform: `scale(${getHoverMagnifyFactor()})`
    }
  }
};

const captionFontSize = {
  xs: 'clamp(1rem, 3.5vw, 1.35rem)',
  sm: 'clamp(1.1rem, 1.2vw, 1.5rem)'
};

const extensionsFontSize = {
  xs: 'clamp(0.85rem, 3vw, 1.1rem)',
  sm: 'clamp(0.95rem, 1vw, 1.25rem)'
};

export default function IdentificationVerificationUploadDialog({
  open,
  kind,
  onClose,
  onDesktopFile,
  onPhoneUploadComplete
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorText, setErrorText] = useState('');

  const title = kind ? UPLOAD_KIND_TITLES[kind] || 'Upload image' : 'Upload image';
  const { overlaySx, panelShellSx } = useColorTemplate7PopupLargeDarkLayout({
    maxWidth: UPLOAD_DIALOG_MAX_WIDTH,
    centerInGallery: true
  });

  const resetTransient = useCallback(() => {
    setDragOver(false);
    setUploading(false);
    setErrorText('');
  }, []);

  const handleClose = useCallback(() => {
    resetTransient();
    onClose?.();
  }, [onClose, resetTransient]);

  const processFile = useCallback(
    async (file) => {
      if (!file) return;
      if (!isAllowedUploadImageFile(file)) {
        setErrorText('Accept file extensions are: .jpg, .jpeg, .png, .gif, and .webp');
        return;
      }
      setErrorText('');
      setUploading(true);
      try {
        await onDesktopFile?.(file);
        resetTransient();
        onClose?.();
      } catch (err) {
        setErrorText(err?.message || 'Failed to upload image');
      } finally {
        setUploading(false);
      }
    },
    [onClose, onDesktopFile, resetTransient]
  );

  const onSelectFile = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      void processFile(file);
    },
    [processFile]
  );

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);
      const file = e.dataTransfer?.files?.[0];
      void processFile(file);
    },
    [processFile]
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handlePhoneUploadComplete = useCallback(
    async (photosId, meta) => {
      setErrorText('');
      setUploading(true);
      try {
        await onPhoneUploadComplete?.(photosId, meta);
        resetTransient();
        onClose?.();
      } catch (err) {
        setErrorText(err?.message || 'Failed to receive phone upload');
      } finally {
        setUploading(false);
      }
    },
    [onClose, onPhoneUploadComplete, resetTransient]
  );

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={handleClose}
      maxWidth={UPLOAD_DIALOG_MAX_WIDTH}
      overlaySx={{
        ...overlaySx,
        zIndex: COLOR_TEMPLATE7_POPUP_Z_INDEX + 1
      }}
      panelShellSx={panelShellSx}
    >
      <ColorTemplate7PopupLargeDark.Title>{title}</ColorTemplate7PopupLargeDark.Title>
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: 'stretch',
            gap: { xs: 2, md: 2 },
            width: '100%'
          }}
        >
          <Box
            className="idv-upload-drop"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => !uploading && fileInputRef.current?.click()}
            sx={{
              border: '3px solid var(--theme-primary-color)',
              borderRadius: 2,
              bgcolor: dragOver ? 'var(--theme-daynight-color)' : 'var(--theme-secondary-color)',
              minHeight: { xs: 200, md: 'clamp(140px, 14vw, 200px)' },
              flex: { xs: '1 1 auto', md: '1 1 50%' },
              width: { xs: '100%', md: '50%' },
              maxWidth: { md: '50%' },
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: uploading ? 'wait' : 'pointer',
              transition: 'background-color 0.2s, border-color 0.2s',
              px: { xs: 1.5, md: 2 },
              py: { xs: 2, md: 1.5 }
            }}
          >
            {uploading ? (
              <CircularProgress size={48} sx={{ color: 'var(--theme-primary-color)' }} />
            ) : (
              <>
                <Box
                  component="img"
                  src={dragDropClickUploadImg}
                  alt="Drag and drop or click to upload images"
                  sx={{
                    maxWidth: 'min(100%, clamp(120px, 18vw, 240px))',
                    width: '100%',
                    height: 'auto',
                    mb: { xs: 1, md: 0.5 },
                    display: 'block',
                    cursor: 'pointer',
                    userSelect: 'none',
                    ...uploadGraphicHoverSx
                  }}
                />
                <Typography
                  variant="body1"
                  sx={{
                    textAlign: 'center',
                    color: COLOR_TEMPLATE7_POPUP_TEXT,
                    WebkitTextFillColor: COLOR_TEMPLATE7_POPUP_TEXT,
                    fontWeight: 700,
                    fontSize: captionFontSize,
                    lineHeight: 1.35,
                    maxWidth: '100%',
                    ...buttonHoverMagnifyTransitionSx,
                    '@media (hover: hover)': {
                      '.idv-upload-drop:hover &': hoverMagnifyFontSizeSx({ baseFontSize: captionFontSize })
                    }
                  }}
                >
                  Drag and drop or click here to upload your image
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                    textAlign: 'center',
                    color: COLOR_TEMPLATE7_POPUP_TEXT,
                    WebkitTextFillColor: COLOR_TEMPLATE7_POPUP_TEXT,
                    fontSize: extensionsFontSize,
                    lineHeight: 1.35,
                    maxWidth: '100%'
                  }}
                >
                  Accept file extensions are: .jpg, .jpeg, .png, .gif, and .webp
                </Typography>
              </>
            )}
          </Box>
          <Box
            sx={{
              flex: { xs: '1 1 auto', md: '1 1 50%' },
              width: { xs: '100%', md: '50%' },
              maxWidth: { md: '50%' },
              minWidth: 0,
              alignSelf: 'stretch',
              display: 'flex'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <ProfilePhotoUploadQrPanel
              variant="inline"
              disabled={uploading}
              onPhoneUploadComplete={handlePhoneUploadComplete}
            />
          </Box>
        </Box>
        {errorText ? <ColorTemplate7PopupLargeDark.ErrorBar>{errorText}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onSelectFile} />
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

IdentificationVerificationUploadDialog.propTypes = {
  open: PropTypes.bool,
  kind: PropTypes.oneOf(['profile', 'driver_license', 'passport']),
  onClose: PropTypes.func,
  onDesktopFile: PropTypes.func,
  onPhoneUploadComplete: PropTypes.func
};
