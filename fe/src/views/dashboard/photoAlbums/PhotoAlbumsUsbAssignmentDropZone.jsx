import Box from '@mui/material/Box';
import SliderControlButton from 'ui-component/SliderControlButton';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { greenButtonSx } from 'config/greenButton';
import { formatPhotoAlbumsUsbAssignmentLabel } from 'utils/photoAlbumsUsbStatsLabel';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';

export const PHOTO_ALBUMS_USB_DRAG_MIME = 'application/x-record-vault-usb';

export function parsePhotoAlbumsUsbDragPayload(event) {
  try {
    const raw = event.dataTransfer?.getData(PHOTO_ALBUMS_USB_DRAG_MIME);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const mountPath = String(parsed?.mountPath ?? '').trim();
    if (!mountPath) return null;
    return {
      mountPath,
      label: String(parsed?.label ?? mountPath),
      hasVault: Boolean(parsed?.hasVault),
      legacyPinVault: Boolean(parsed?.legacyPinVault),
      vaultUsedGb: parsed?.vaultUsedGb ?? null,
      vaultUsedBytes: parsed?.vaultUsedBytes ?? null,
      freePercent: parsed?.freePercent ?? null
    };
  } catch {
    return null;
  }
}

const compactAssignmentButtonSx = {
  fontSize: '0.75em !important',
  lineHeight: 1.2,
  py: 0.4,
  px: 0.65,
  minHeight: 0,
  '&.MuiButton-root': {
    fontSize: '0.75em !important'
  },
  '& .MuiButton-label': {
    fontSize: 'inherit !important',
    lineHeight: 1.2
  }
};

const formatButtonSx = {
  ...compactAssignmentButtonSx,
  bgcolor: 'var(--theme-yellow-color) !important',
  color: '#000 !important',
  WebkitTextFillColor: '#000 !important',
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': {
      bgcolor: 'var(--theme-yellow-color) !important'
    }
  }
};

const drivePillButtonSx = {
  ...greenButtonSx(),
  ...compactAssignmentButtonSx,
  minWidth: 0,
  maxWidth: '100%',
  flex: '1 1 12rem',
  justifyContent: 'flex-start',
  textAlign: 'left',
  fontFamily: MAIN_FONT_FAMILY,
  lineHeight: 1.2,
  py: 0.4,
  px: 0.65,
  cursor: 'default',
  pointerEvents: 'none',
  boxShadow: 'none',
  '&.Mui-disabled': {
    opacity: 1
  },
  '& .MuiButton-label': {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
    fontSize: 'inherit !important'
  }
};

export default function PhotoAlbumsUsbAssignmentDropZone({
  label,
  location,
  dragActive = false,
  busy = false,
  onAssign,
  onClear,
  onFormat
}) {
  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event) => {
    event.preventDefault();
    const payload = parsePhotoAlbumsUsbDragPayload(event);
    if (payload) onAssign?.(payload);
  };

  return (
    <Box
      onDragEnter={(event) => {
        event.preventDefault();
      }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flexWrap: 'wrap',
        p: 1,
        border: '2px dashed',
        borderColor: dragActive ? 'var(--theme-yellow-color)' : 'var(--theme-primary-color)',
        borderRadius: 1,
        bgcolor: dragActive ? 'rgba(255, 235, 59, 0.12)' : 'rgba(0,0,0,0.15)',
        minHeight: 52
      }}
    >
      <ColorTemplate7PopupLargeDark.BodyText sx={{ fontWeight: 700, mb: 0, flexShrink: 0, fontSize: 'inherit !important' }}>
        {label}
      </ColorTemplate7PopupLargeDark.BodyText>
      {location ? (
        <SliderControlButton type="button" disabled sx={drivePillButtonSx}>
          {formatPhotoAlbumsUsbAssignmentLabel(location)}
        </SliderControlButton>
      ) : (
        <ColorTemplate7PopupLargeDark.SectionDescription sx={{ mb: 0, opacity: 0.85, fontSize: 'inherit !important' }}>
          Drag a USB drive here
        </ColorTemplate7PopupLargeDark.SectionDescription>
      )}
      {location && typeof onClear === 'function' ? (
        <SliderControlButton type="button" sx={compactAssignmentButtonSx} disabled={busy} onClick={() => onClear()}>
          Clear
        </SliderControlButton>
      ) : null}
      {location ? (
        <SliderControlButton type="button" sx={formatButtonSx} disabled={busy} onClick={() => onFormat?.()}>
          Format
        </SliderControlButton>
      ) : null}
    </Box>
  );
}
