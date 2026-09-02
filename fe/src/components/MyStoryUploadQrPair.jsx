import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import ProfilePhotoUploadQrPanel from 'components/ProfilePhotoUploadQrPanel';
import dragDropClickUploadImg from 'assets/images/dragDropClickUpload.png';
import {
  ALBUM_ACCEPTED_PHOTO_EXTENSIONS_UI,
  ALBUM_ACCEPTED_VIDEO_EXTENSIONS_UI
} from 'constants/albumUploadFormats';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { buttonHoverMagnifyTransitionSx, getHoverMagnifyFactor, hoverMagnifyFontSizeSx } from 'config/hoverMagnifyEnv';

const comicStyle = {
  fontFamily: MAIN_FONT_FAMILY,
  color: 'var(--theme-primary-color)'
};

const uploadGraphicHoverSx = {
  transition: 'transform 0.15s ease',
  transformOrigin: 'center center',
  '@media (hover: hover)': {
    '.my-story-upload-drop:hover &': {
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

/**
 * My Album & Posts desktop row: drag-drop upload (left) + phone QR (right).
 * Shared by /myStory and Bills/Receipts popup.
 */
export default function MyStoryUploadQrPair({
  onFiles,
  uploading = false,
  disabled = false,
  accept = 'image/*,video/*',
  multiple = true,
  purpose = 'profile',
  paidRecordId = null,
  qrMessageOverride = null,
  qrSize,
  onPhoneUploadComplete,
  qrPanelSx,
  qrMessageSx,
  sx
}) {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const pickFiles = () => {
    if (uploading || disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: 'stretch',
        gap: { xs: 2, md: 2 },
        width: '100%',
        minWidth: 0,
        minHeight: 0,
        ...sx
      }}
    >
      <Box
        className="my-story-upload-drop"
        onDragEnter={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (disabled || uploading) return;
          onFiles?.(e.dataTransfer?.files);
        }}
        onClick={pickFiles}
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
          cursor: uploading || disabled ? 'default' : 'pointer',
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
              className="my-story-upload-graphic"
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
              className="my-story-upload-caption"
              sx={{
                ...comicStyle,
                textAlign: 'center',
                fontWeight: 700,
                fontSize: captionFontSize,
                lineHeight: 1.35,
                maxWidth: '100%',
                ...buttonHoverMagnifyTransitionSx,
                '@media (hover: hover)': {
                  '.my-story-upload-drop:hover &': hoverMagnifyFontSizeSx({ baseFontSize: captionFontSize })
                }
              }}
            >
              Drag and drop or click here to upload photos or vault media
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                ...comicStyle,
                textAlign: 'center',
                fontSize: extensionsFontSize,
                lineHeight: 1.35,
                maxWidth: '100%'
              }}
            >
              {ALBUM_ACCEPTED_PHOTO_EXTENSIONS_UI}
            </Typography>
            <Typography
              variant="body2"
              sx={{
                mt: 0.5,
                ...comicStyle,
                textAlign: 'center',
                fontSize: extensionsFontSize,
                lineHeight: 1.35,
                maxWidth: '100%'
              }}
            >
              {ALBUM_ACCEPTED_VIDEO_EXTENSIONS_UI}
            </Typography>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          hidden
          onChange={(e) => {
            onFiles?.(e.target.files);
            e.target.value = '';
          }}
        />
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
          purpose={purpose}
          paidRecordId={paidRecordId}
          disabled={uploading || disabled}
          qrSize={qrSize}
          messageOverride={qrMessageOverride}
          onPhoneUploadComplete={onPhoneUploadComplete}
          messageSx={qrMessageSx ?? comicStyle}
          sx={{
            flex: 1,
            width: '100%',
            minHeight: 0,
            ...qrPanelSx
          }}
        />
      </Box>
    </Box>
  );
}

MyStoryUploadQrPair.propTypes = {
  onFiles: PropTypes.func,
  uploading: PropTypes.bool,
  disabled: PropTypes.bool,
  accept: PropTypes.string,
  multiple: PropTypes.bool,
  purpose: PropTypes.string,
  paidRecordId: PropTypes.number,
  qrMessageOverride: PropTypes.string,
  qrSize: PropTypes.number,
  onPhoneUploadComplete: PropTypes.func,
  qrPanelSx: PropTypes.object,
  qrMessageSx: PropTypes.object,
  sx: PropTypes.object
};
