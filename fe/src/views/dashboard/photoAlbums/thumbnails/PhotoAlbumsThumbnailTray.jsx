import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import PhotoAlbumsSupportedPhotoFilesDialog from '../PhotoAlbumsSupportedPhotoFilesDialog';
import { isFilesExplorerDrag, takeFilesExplorerDragFilesAsync } from '../photoAlbumsFilesExplorerDrag';
import {
  isRecordVaultMobileUploadDrag,
  materializeRecordVaultMobileUploadFile,
  readRecordVaultMobileUploadDragFileNames
} from '../../recordVault/RecordVaultMobileUploadTray';
import { MOBILE_UPLOAD_PRODUCT_TUTAPHOTO } from 'constants/mobileUploadProduct';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';
import PhotoAlbumsVideoIndicator from '../PhotoAlbumsVideoIndicator';
import { PHOTO_ALBUMS_THEME_DAYNIGHT_BG } from '../photoAlbumsNoteFontTokens';
import PhotoAlbumsTrayCountLabel from '../PhotoAlbumsTrayCountLabel';
import PhotoAlbumsSeqBadge from '../PhotoAlbumsSeqBadge';
import PhotoAlbumsThumbnail from './PhotoAlbumsThumbnail';
import { photoAlbumsTrayItemDisplayName } from './photoAlbumsTrayItems';
import {
  PHOTO_DROP_TARGET_BG,
  isPagePhotoDrag,
  readPagePhotoDragPageKey,
  startTrayPhotoDrag
} from '../photoAlbumsPagePhotoDrag';

function isIncomingFileDrag(dataTransfer) {
  if (isFilesExplorerDrag(dataTransfer)) return true;
  if (isRecordVaultMobileUploadDrag(dataTransfer)) return true;
  const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
  return types.includes('Files');
}

function TrayThumb({ item, noteId, storageType, onRemove, disabled }) {
  const attachmentId = Number(item.attachmentId);
  const label = photoAlbumsTrayItemDisplayName(item);
  const thumbRef = useRef(null);
  const [hoverPlate, setHoverPlate] = useState(null);

  const showHoverPlate = useCallback(() => {
    const el = thumbRef.current;
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const rect = el.getBoundingClientRect();
    setHoverPlate({ left: rect.left + rect.width / 2, top: rect.bottom + 6 });
  }, []);

  const hideHoverPlate = useCallback(() => setHoverPlate(null), []);

  // Keep the fixed plate aligned if the tray scrolls under a hovered thumb.
  useEffect(() => {
    if (!hoverPlate) return undefined;
    const scroll = thumbRef.current?.closest?.('.rv-album-photo-staging__scroll');
    scroll?.addEventListener('scroll', showHoverPlate, { passive: true });
    window.addEventListener('resize', showHoverPlate);
    return () => {
      scroll?.removeEventListener('scroll', showHoverPlate);
      window.removeEventListener('resize', showHoverPlate);
    };
  }, [hoverPlate, showHoverPlate]);

  return (
    <div
      ref={thumbRef}
      className="rv-album-staging__thumb"
      data-pa-tray-attachment-id={attachmentId}
      aria-label={label}
      title={disabled ? undefined : 'Drag onto an album page'}
      draggable={!disabled}
      onDragStart={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        hideHoverPlate();
        startTrayPhotoDrag(e.dataTransfer, attachmentId);
      }}
      onMouseEnter={showHoverPlate}
      onMouseLeave={hideHoverPlate}
      onFocus={showHoverPlate}
      onBlur={hideHoverPlate}
      style={{
        position: 'relative',
        width: 96,
        height: 96,
        flex: '0 0 auto',
        borderRadius: 4,
        overflow: 'visible',
        border: '2px solid #1976d2',
        background: PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        userSelect: 'none',
        cursor: disabled ? 'default' : 'grab'
      }}
    >
      {/* Portaled fixed plate — escapes tray overflow / album z-index stacking. */}
      {hoverPlate && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="rv-album-staging__thumb-name is-portaled"
              aria-hidden="true"
              style={{
                position: 'fixed',
                left: hoverPlate.left,
                top: hoverPlate.top,
                transform: 'translateX(-50%)',
                zIndex: 2147483000,
                display: 'block',
                padding: '6px 18px',
                background: '#000000',
                color: '#ffeb3b',
                fontSize: '2.1rem',
                fontWeight: 700,
                lineHeight: 1.25,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.45)'
              }}
            >
              {label}
            </div>,
            document.body
          )
        : null}
      <div className="rv-album-staging__thumb-media">
        <PhotoAlbumsThumbnail noteId={noteId} attachmentId={attachmentId} storageType={storageType} label={label} />
        {item.isVideo ? <PhotoAlbumsVideoIndicator size={22} sx={{ top: 2, left: 2, zIndex: 3 }} /> : null}
        {!disabled ? (
          <button
            type="button"
            aria-label={`Remove ${label} from album`}
            title="Remove from album"
            {...guestDemoBlockProps()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove?.(attachmentId);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            style={{
              position: 'absolute',
              top: 2,
              right: 2,
              width: 18,
              height: 18,
              padding: 0,
              border: '1px solid #fff',
              borderRadius: 2,
              background: '#000',
              color: '#e53935',
              fontSize: '0.7rem',
              fontWeight: 900,
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 3
            }}
          >
            ×
          </button>
        ) : null}
        <PhotoAlbumsSeqBadge seq={item.albumPhotoSeq} />
      </div>
    </div>
  );
}

const trayItemShape = PropTypes.shape({
  attachmentId: PropTypes.number.isRequired,
  fileName: PropTypes.string,
  fileExtension: PropTypes.string,
  fileSizeBytes: PropTypes.number,
  albumPhotoSeq: PropTypes.number,
  isVideo: PropTypes.bool
});

TrayThumb.propTypes = {
  item: trayItemShape.isRequired,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  onRemove: PropTypes.func,
  disabled: PropTypes.bool
};

/**
 * Thumbnail tray: shows every photo/video saved in the album vault (`items` comes from
 * `buildPhotoAlbumsTrayItems(note.attachments)`), and accepts OS / Files Explorer /
 * Mobile Upload drops to add more. Thumbs drag onto album pages; a page photo dropped
 * here is taken off its page (`onPagePhotoReturn(pageKey)`).
 */
export default function PhotoAlbumsThumbnailTray({
  items = [],
  noteId = null,
  storageType = null,
  editable = true,
  onOsFiles,
  onRemove,
  onRemoveAll,
  onPagePhotoReturn
}) {
  const [fileDragOver, setFileDragOver] = useState(false);
  /** A page photo is over the tray: whole tray turns red until release. */
  const [pagePhotoDragOver, setPagePhotoDragOver] = useState(false);
  const [supportListOpen, setSupportListOpen] = useState(false);
  const canRemoveAll = Boolean(editable && items.length > 0 && onRemoveAll);
  const acceptsPagePhoto = (dataTransfer) => Boolean(editable && onPagePhotoReturn && isPagePhotoDrag(dataTransfer));
  const acceptsDrag = (dataTransfer) => isIncomingFileDrag(dataTransfer) || acceptsPagePhoto(dataTransfer);

  // A drag cancelled with Esc or dropped elsewhere never fires dragleave/drop here.
  useEffect(() => {
    if (!pagePhotoDragOver) return undefined;
    const clear = () => setPagePhotoDragOver(false);
    window.addEventListener('dragend', clear, true);
    window.addEventListener('drop', clear, true);
    return () => {
      window.removeEventListener('dragend', clear, true);
      window.removeEventListener('drop', clear, true);
    };
  }, [pagePhotoDragOver]);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setFileDragOver(false);
    setPagePhotoDragOver(false);
    if (!editable) return;

    if (isPagePhotoDrag(e.dataTransfer)) {
      const pageKey = readPagePhotoDragPageKey(e.dataTransfer);
      if (pageKey) onPagePhotoReturn?.(pageKey);
      return;
    }

    if (isRecordVaultMobileUploadDrag(e.dataTransfer)) {
      const stagedNames = readRecordVaultMobileUploadDragFileNames(e.dataTransfer);
      if (!stagedNames.length) return;
      void (async () => {
        const files = [];
        for (const stagedName of stagedNames) {
          try {
            files.push(await materializeRecordVaultMobileUploadFile(stagedName, MOBILE_UPLOAD_PRODUCT_TUTAPHOTO));
          } catch (err) {
            console.warn('[PhotoAlbumsThumbnailTray] mobile upload drop failed', stagedName, err?.message ?? err);
          }
        }
        if (files.length) onOsFiles?.(files);
      })();
      return;
    }

    if (isFilesExplorerDrag(e.dataTransfer)) {
      void (async () => {
        const explorerFiles = await takeFilesExplorerDragFilesAsync();
        if (explorerFiles.length) onOsFiles?.(explorerFiles);
      })();
      return;
    }

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length) onOsFiles?.(files);
  };

  return (
    <Box
      className="rv-album-photo-staging"
      data-rv-album-staging-tray=""
      onDragEnter={(e) => {
        if (!acceptsDrag(e.dataTransfer)) return;
        e.preventDefault();
        setFileDragOver(true);
        if (acceptsPagePhoto(e.dataTransfer)) setPagePhotoDragOver(true);
      }}
      onDragOver={(e) => {
        if (!acceptsDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = isPagePhotoDrag(e.dataTransfer) ? 'move' : 'copy';
        setFileDragOver(true);
        if (acceptsPagePhoto(e.dataTransfer)) setPagePhotoDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setFileDragOver(false);
        setPagePhotoDragOver(false);
      }}
      onDrop={handleDrop}
      sx={{
        flex: '1 1 auto',
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        gap: 0.35,
        px: 1.25,
        pt: 0.5,
        pb: 0,
        minHeight: 136,
        boxSizing: 'border-box',
        border: '2px dashed #1A7B02',
        borderRadius: 0,
        bgcolor: pagePhotoDragOver ? PHOTO_DROP_TARGET_BG : '#B5E7A8',
        outline: fileDragOver ? '2px dashed #1A7B02' : 'none',
        outlineOffset: 2,
        '&[data-pa-explorer-drag-over="1"]': {
          outline: '3px solid #1A7B02',
          outlineOffset: 2,
          boxShadow: 'inset 0 0 0 4px rgba(26, 123, 2, 0.25)'
        },
        /* Visible so hover filename plates can paint over the album below. */
        overflow: 'visible',
        transition: 'outline-color 0.12s ease, background-color 0.12s ease'
      }}
    >
      <PhotoAlbumsTrayCountLabel count={items.length} sx={{ alignSelf: 'flex-start', px: 0.25 }} />
      <Box
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 0.75,
          px: 0.5,
          py: 0.1
        }}
      >
        <Box sx={{ flex: '1 1 auto', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.15 }}>
          <Typography
            component="button"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSupportListOpen(true);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            sx={{
              m: 0,
              p: 0,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: { xs: '0.68rem', sm: '0.78rem' },
              color: '#c62828',
              WebkitTextFillColor: '#c62828',
              textDecoration: 'underline',
              textAlign: 'center',
              lineHeight: 1.25,
              fontFamily: 'inherit'
            }}
          >
            Click here for list of support photo files
          </Typography>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: { xs: '0.72rem', sm: '0.82rem' },
              color: '#c62828',
              WebkitTextFillColor: '#c62828',
              textAlign: 'center',
              lineHeight: 1.25,
              userSelect: 'none',
              pointerEvents: 'none'
            }}
          >
            Please drag and drop photos or videos (MP4, MOV, WebM, MKV, AVI, WMV, AVCHD) here to add them to this album
          </Typography>
        </Box>
        {canRemoveAll ? (
          <SliderControlButton
            type="button"
            hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
            aria-label="X All — remove all photos from this album"
            title="X All — remove all photos from this album"
            {...guestDemoBlockProps()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemoveAll?.();
            }}
            sx={{
              flexShrink: 0,
              alignSelf: 'center',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 0.75,
              py: 0.35,
              minWidth: 'auto',
              fontSize: { xs: '0.72rem', sm: '0.82rem' },
              fontWeight: 800,
              lineHeight: 1.2,
              bgcolor: 'var(--theme-secondary-color) !important',
              color: '#000 !important',
              WebkitTextFillColor: '#000 !important',
              border: '4px solid #000 !important',
              '@media (hover: hover)': {
                '&:hover:not(.Mui-disabled)': {
                  bgcolor: 'var(--theme-secondary-color) !important',
                  color: '#000 !important',
                  WebkitTextFillColor: '#000 !important'
                }
              }
            }}
          >
            <Box
              component="span"
              aria-hidden
              sx={{
                width: 18,
                height: 18,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#000',
                color: '#e53935',
                WebkitTextFillColor: '#e53935',
                border: '1px solid #fff',
                borderRadius: '2px',
                fontSize: '0.7rem',
                fontWeight: 900,
                lineHeight: 1,
                boxSizing: 'border-box',
                flexShrink: 0
              }}
            >
              ×
            </Box>
            All
          </SliderControlButton>
        ) : null}
      </Box>
      <Box
        className="rv-album-photo-staging__scroll"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flex: '1 1 auto',
          minWidth: 0,
          minHeight: 0,
          overflowX: 'scroll',
          overflowY: 'hidden',
          scrollbarGutter: 'stable',
          px: 0.25,
          pt: 0.25,
          pb: 0,
          flexWrap: 'nowrap'
        }}
      >
        {items.map((item) => (
          <TrayThumb
            key={`tray-${item.attachmentId}`}
            item={item}
            noteId={noteId}
            storageType={storageType}
            disabled={!editable}
            onRemove={onRemove}
          />
        ))}
      </Box>
      <PhotoAlbumsSupportedPhotoFilesDialog open={supportListOpen} onClose={() => setSupportListOpen(false)} />
    </Box>
  );
}

PhotoAlbumsThumbnailTray.propTypes = {
  items: PropTypes.arrayOf(trayItemShape),
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  editable: PropTypes.bool,
  onOsFiles: PropTypes.func,
  onRemove: PropTypes.func,
  onRemoveAll: PropTypes.func,
  onPagePhotoReturn: PropTypes.func
};
