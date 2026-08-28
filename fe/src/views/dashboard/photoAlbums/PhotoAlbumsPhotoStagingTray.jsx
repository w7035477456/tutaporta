import PropTypes from 'prop-types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import SliderControlButton, {
  SLIDER_CONTROL_BUTTON_HOVER_SCALE_15
} from 'ui-component/SliderControlButton';
import PhotoAlbumsSupportedPhotoFilesDialog from './PhotoAlbumsSupportedPhotoFilesDialog';
import { isPhotoAlbumsStagingVideoExtension, photoAlbumsStagingPhotoPrefersServerThumb } from 'utils/photoAlbumsFileFormats';
import {
  isFilesExplorerDrag,
  takeFilesExplorerDragFilesAsync
} from './photoAlbumsFilesExplorerDrag';
import { getStagingAttachmentPreview } from './photoAlbumsStagingPreviewCache';
import PhotoAlbumsVideoIndicator from './PhotoAlbumsVideoIndicator';
import {
  PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
  PHOTO_ALBUMS_THEME_INVERSE_FG
} from './photoAlbumsNoteFontTokens';
import PhotoAlbumsTrayCountLabel from './PhotoAlbumsTrayCountLabel';
import PhotoAlbumsSeqBadge from './PhotoAlbumsSeqBadge';

export const DRAG_STAGED_ATTACHMENT = 'application/x-pa-staged-attachment';
export const DRAG_STAGED_FLAG = 'application/x-pa-staged-flag';

export function isStagedAttachmentDrag(dataTransfer) {
  const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
  return types.includes(DRAG_STAGED_ATTACHMENT) || types.includes(DRAG_STAGED_FLAG);
}

export function readStagedAttachmentDrag(dataTransfer, stagedItems = []) {
  const rawCustom = dataTransfer?.getData?.(DRAG_STAGED_ATTACHMENT) || '';
  const rawPlain = dataTransfer?.getData?.('text/plain') || '';
  const rawId = String(rawCustom || rawPlain.replace(/^pa-staged:/i, '')).trim();
  const attachmentId = Number(rawId);
  let meta = (stagedItems || []).find((item) => Number(item.attachmentId) === attachmentId);
  if (!meta) {
    try {
      const parsed = JSON.parse(dataTransfer?.getData?.('application/json') || '{}');
      if (parsed && (parsed.attachmentId != null || Number.isFinite(attachmentId))) {
        meta = {
          attachmentId: Number(parsed.attachmentId) || attachmentId,
          fileName: String(parsed.fileName || ''),
          fileExtension: String(parsed.fileExtension || ''),
          fileSizeBytes: parsed.fileSizeBytes ?? null,
          albumPhotoSeq:
            parsed.albumPhotoSeq != null ? Number(parsed.albumPhotoSeq) : null
        };
      }
    } catch {
      meta = Number.isFinite(attachmentId) && attachmentId > 0 ? { attachmentId } : null;
    }
  }
  if (!meta || !Number.isFinite(Number(meta.attachmentId)) || Number(meta.attachmentId) < 1) {
    return null;
  }
  return {
    attachmentId: Number(meta.attachmentId),
    fileName: String(meta.fileName || ''),
    fileExtension: String(meta.fileExtension || ''),
    fileSizeBytes: meta.fileSizeBytes ?? null,
    albumPhotoSeq:
      meta.albumPhotoSeq != null && Number.isFinite(Number(meta.albumPhotoSeq))
        ? Number(meta.albumPhotoSeq)
        : null
  };
}

/** Full original filename with extension for staging tray hover labels. */
function stagingDisplayFileName(item, attachmentId) {
  const name = String(item?.fileName || '').trim();
  const ext = String(item?.fileExtension || '')
    .trim()
    .replace(/^\./, '');
  if (!name) return ext ? `photo-${attachmentId}.${ext}` : `photo-${attachmentId}`;
  if (!ext) return name;
  if (name.toLowerCase().endsWith(`.${ext.toLowerCase()}`)) return name;
  return `${name}.${ext}`;
}

function StagingThumb({ item, noteId, storageType, onRemove, disabled }) {
  const attachmentId = Number(item.attachmentId);
  const cachedPreview = getStagingAttachmentPreview(attachmentId);
  const localPreviewUrl = String(item?.localPreviewUrl || cachedPreview || '');
  const fileExt = String(item?.fileExtension || '').toLowerCase().replace(/^\./, '');
  const preferServerThumb = photoAlbumsStagingPhotoPrefersServerThumb(fileExt);
  const [url, setUrl] = useState(() => (preferServerThumb ? '' : localPreviewUrl));
  const objectUrlRef = useRef('');
  const thumbRef = useRef(null);
  const [hoverPlate, setHoverPlate] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const nid = Number(noteId);
    const freshCache = getStagingAttachmentPreview(attachmentId);
    const fallback = preferServerThumb ? '' : String(item?.localPreviewUrl || freshCache || '');
    if (fallback) setUrl(fallback);

    if (!Number.isFinite(attachmentId) || attachmentId < 1 || !Number.isFinite(nid) || nid < 1) {
      return undefined;
    }
    // HEIC/TIFF/… — always use vault JPEG thumb; local File preview cannot render in <img>.
    if (fallback && !preferServerThumb) return undefined;
    (async () => {
      try {
        const blob = await fetchPhotoAlbumsNoteAttachmentBlob(nid, attachmentId, {
          inline: true,
          storageType,
          variant: 'thumb'
        });
        if (cancelled || !blob || blob.size < 1) return;
        const type = String(blob.type || '').toLowerCase();
        if (type.includes('json') || type.includes('text/html') || type.includes('text/plain')) {
          return;
        }
        const next = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(next);
          return;
        }
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = next;
        setUrl(next);
      } catch {
        // Keep File-based preview from Files Explorer / Finder drop.
      }
    })();
    return () => {
      cancelled = true;
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    };
  }, [attachmentId, noteId, storageType, item?.localPreviewUrl, preferServerThumb]);

  const label = stagingDisplayFileName(item, attachmentId);
  const displayUrl = preferServerThumb
    ? url
    : url || localPreviewUrl || getStagingAttachmentPreview(attachmentId);
  const isVideo = isPhotoAlbumsStagingVideoExtension(item?.fileExtension);

  const handleImgError = useCallback(() => {
    setUrl('');
    const nid = Number(noteId);
    if (!Number.isFinite(attachmentId) || attachmentId < 1 || !Number.isFinite(nid) || nid < 1) return;
    if (isVideo) return;
    void (async () => {
      try {
        const blob = await fetchPhotoAlbumsNoteAttachmentBlob(nid, attachmentId, {
          inline: true,
          storageType,
          variant: 'thumb'
        });
        if (!blob || blob.size < 1) return;
        const next = URL.createObjectURL(blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = next;
        setUrl(next);
      } catch {
        // keep filename placeholder
      }
    })();
  }, [attachmentId, isVideo, noteId, storageType]);

  const showHoverPlate = useCallback(() => {
    const el = thumbRef.current;
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const rect = el.getBoundingClientRect();
    setHoverPlate({
      left: rect.left + rect.width / 2,
      top: rect.bottom + 6
    });
  }, []);

  const hideHoverPlate = useCallback(() => {
    setHoverPlate(null);
  }, []);

  // Keep fixed plate aligned if the tray scrolls under a hovered thumb.
  useEffect(() => {
    if (!hoverPlate) return undefined;
    const scroll = thumbRef.current?.closest?.('.rv-album-photo-staging__scroll');
    const onScrollOrResize = () => showHoverPlate();
    scroll?.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      scroll?.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [hoverPlate, showHoverPlate]);

  return (
    // Native div: MUI Box + React re-renders mid-drag were canceling HTML5 drag
    // for every thumb after the first.
    <div
      ref={thumbRef}
      className="rv-album-staging__thumb"
      draggable={!disabled}
      aria-label={`${label} — drag onto a template slot`}
      onMouseEnter={showHoverPlate}
      onMouseLeave={hideHoverPlate}
      onFocus={showHoverPlate}
      onBlur={hideHoverPlate}
      onDragStart={(event) => {
        hideHoverPlate();
        if (disabled) {
          event.preventDefault();
          return;
        }
        // Stop the tray from treating this as an incoming OS-file drag (re-render).
        event.stopPropagation();
        const dt = event.dataTransfer;
        dt.effectAllowed = 'copyMove';
        dt.setData(DRAG_STAGED_ATTACHMENT, String(attachmentId));
        dt.setData(DRAG_STAGED_FLAG, '1');
        // Do NOT put `pa-staged:N` in text/plain — TipTap/ProseMirror would insert that
        // visible junk when a drop misses a slot. Custom MIME types carry the id.
        try {
          dt.setData('text/plain', '');
        } catch {
          // ignore
        }
        try {
          dt.setData(
            'application/json',
            JSON.stringify({
              attachmentId,
              fileName: item.fileName || '',
              fileExtension: item.fileExtension || '',
              fileSizeBytes: item.fileSizeBytes ?? null,
              albumPhotoSeq:
                item.albumPhotoSeq != null && Number.isFinite(Number(item.albumPhotoSeq))
                  ? Number(item.albumPhotoSeq)
                  : null
            })
          );
        } catch {
          // ignore
        }
        try {
          if (typeof dt.setDragImage === 'function' && event.currentTarget) {
            dt.setDragImage(event.currentTarget, 48, 48);
          }
        } catch {
          // ignore
        }
      }}
      style={{
        position: 'relative',
        width: 96,
        height: 96,
        flex: '0 0 auto',
        borderRadius: 4,
        overflow: 'visible',
        border: '2px solid #1976d2',
        background: PHOTO_ALBUMS_THEME_DAYNIGHT_BG,
        cursor: disabled ? 'default' : 'grab',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
        userSelect: 'none',
        WebkitUserDrag: disabled ? 'none' : 'element'
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
        {displayUrl && isVideo ? (
          <video
            src={displayUrl}
            muted
            playsInline
            preload="metadata"
            draggable={false}
            onError={handleImgError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none',
              userSelect: 'none',
              background: '#000'
            }}
          />
        ) : displayUrl ? (
          <img
            src={displayUrl}
            alt=""
            draggable={false}
            onError={handleImgError}
            onLoad={(event) => {
              const img = event.currentTarget;
              if (img.naturalWidth < 1 || img.naturalHeight < 1) handleImgError();
            }}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              pointerEvents: 'none',
              userSelect: 'none'
            }}
          />
        ) : (
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: 4,
              color: '#444',
              lineHeight: 1.2,
              pointerEvents: 'none',
              userSelect: 'none',
              display: 'block'
            }}
          >
            {label}
          </span>
        )}
        {isVideo ? <PhotoAlbumsVideoIndicator size={22} sx={{ top: 2, left: 2, zIndex: 3 }} /> : null}
        {!disabled ? (
          <button
            type="button"
            aria-label={`Remove ${label} from staging`}
            title="Remove from staging"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove?.(attachmentId);
            }}
            onMouseDown={(e) => {
              // Don't start a thumb-drag when pressing the ×.
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

StagingThumb.propTypes = {
  item: PropTypes.shape({
    attachmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
    fileName: PropTypes.string,
    fileExtension: PropTypes.string,
    fileSizeBytes: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
    albumPhotoSeq: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]),
    localPreviewUrl: PropTypes.string
  }).isRequired,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  onRemove: PropTypes.func,
  disabled: PropTypes.bool
};

/**
 * Top-bar photo staging tray: OS multi-drop → thumbnails → drag into template slots.
 * When `inline`, sits beside the page filmstrip (own horizontal scrollbar at bottom).
 */
export default function PhotoAlbumsPhotoStagingTray({
  items = [],
  noteId = null,
  storageType = null,
  editable = true,
  onOsFiles,
  onRemove,
  onRemoveAll,
  onReturnFromPage,
  inline = false
}) {
  const [fileDragOver, setFileDragOver] = useState(false);
  const [supportListOpen, setSupportListOpen] = useState(false);

  const isOsFileDrag = (dataTransfer) => {
    if (isFilesExplorerDrag(dataTransfer)) return true;
    const types = dataTransfer?.types ? Array.from(dataTransfer.types) : [];
    return types.includes('Files') && !isStagedAttachmentDrag(dataTransfer);
  };

  const canRemoveAll = Boolean(editable && items.length > 0 && onRemoveAll);

  return (
    <Box
      className="rv-album-photo-staging"
      data-rv-album-staging-tray=""
      onDragEnter={(e) => {
        if (!isOsFileDrag(e.dataTransfer)) return;
        e.preventDefault();
        setFileDragOver((was) => (was ? was : true));
      }}
      onDragOver={(e) => {
        // Never preventDefault / setState while dragging our own thumbnails —
        // a re-render mid-drag cancels HTML5 drag (only the first thumb often "worked").
        if (isStagedAttachmentDrag(e.dataTransfer)) return;
        if (!isOsFileDrag(e.dataTransfer)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setFileDragOver((was) => (was ? was : true));
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setFileDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setFileDragOver(false);
        if (!editable) return;

        if (isStagedAttachmentDrag(e.dataTransfer)) return;

        const pageReturnId = e.dataTransfer.getData('application/x-pa-page-attachment');
        if (pageReturnId) {
          onReturnFromPage?.(Number(pageReturnId));
          return;
        }

        // In-app Files Explorer drag — rematerialize File bytes from handles.
        if (isFilesExplorerDrag(e.dataTransfer)) {
          void (async () => {
            const explorerFiles = await takeFilesExplorerDragFilesAsync();
            if (explorerFiles.length) onOsFiles?.(explorerFiles);
          })();
          return;
        }

        const files = Array.from(e.dataTransfer?.files || []);
        if (files.length) onOsFiles?.(files);
      }}
      sx={{
        flex: inline ? '1 1 auto' : '0 0 auto',
        width: inline ? '100%' : '100%',
        minWidth: 0,
        maxWidth: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        gap: 0.35,
        px: 1.25,
        pt: 0.5,
        pb: 0,
        minHeight: inline ? 136 : 124,
        boxSizing: 'border-box',
        border: '2px dashed #1A7B02',
        borderRadius: inline ? 0 : 1,
        bgcolor: '#B5E7A8',
        outline: fileDragOver ? '2px dashed #1A7B02' : 'none',
        outlineOffset: 2,
        '&[data-pa-explorer-drag-over="1"]': {
          outline: '3px solid #1A7B02',
          outlineOffset: 2,
          boxShadow: 'inset 0 0 0 4px rgba(26, 123, 2, 0.25)'
        },
        /* Visible so hover filename plates can paint over the album below. */
        overflow: 'visible',
        transition: 'outline-color 0.12s ease',
        '&[data-rv-staging-return-hover="1"]': {
          bgcolor: '#B5E7A8',
          outline: '2px dashed #1A7B02',
          outlineOffset: 2
        }
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
        <Box
          sx={{
            flex: '1 1 auto',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.15
          }}
        >
          <Typography
            component="button"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSupportListOpen(true);
            }}
            onMouseDown={(e) => {
              // Don't start a tray drag / drop highlight when clicking the link.
              e.stopPropagation();
            }}
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
            Please drag and drop photos or videos (MP4, MOV, WebM, MKV, AVI, WMV, AVCHD) here to be put on album
          </Typography>
        </Box>
        {canRemoveAll ? (
          <SliderControlButton
            type="button"
            hoverScale={SLIDER_CONTROL_BUTTON_HOVER_SCALE_15}
            aria-label="X All — remove all photos from thumbnail tray"
            title="X All — remove all photos from the thumbnail tray"
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
        {items.length
          ? items.map((item) => (
              <StagingThumb
                key={`staged-${item.attachmentId}`}
                item={item}
                noteId={noteId}
                storageType={storageType}
                disabled={!editable}
                onRemove={onRemove}
              />
            ))
          : null}
      </Box>
      <PhotoAlbumsSupportedPhotoFilesDialog open={supportListOpen} onClose={() => setSupportListOpen(false)} />
    </Box>
  );
}

PhotoAlbumsPhotoStagingTray.propTypes = {
  items: PropTypes.arrayOf(
    PropTypes.shape({
      attachmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
      fileName: PropTypes.string,
      fileExtension: PropTypes.string,
      fileSizeBytes: PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])])
    })
  ),
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  editable: PropTypes.bool,
  onOsFiles: PropTypes.func,
  onRemove: PropTypes.func,
  onRemoveAll: PropTypes.func,
  onReturnFromPage: PropTypes.func,
  inline: PropTypes.bool
};
