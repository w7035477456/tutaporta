import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import PhotoAlbumsThumbnail from './thumbnails/PhotoAlbumsThumbnail';
import { photoAlbumsPagePhotoCache } from './thumbnails/photoAlbumsThumbnailStore';
import { ALBUM_PHOTO_VIEW_IDENTITY, albumPhotoViewTransform } from './photoAlbumsPages';
import { PhotoEditActionButtons, PhotoEditPanArrows, PhotoEditRotateBar, PhotoEditZoomBar } from './PhotoAlbumsPhotoEditBars';
import PhotoAlbumsPhotoOverlays from './PhotoAlbumsPhotoOverlays';

const MAX_STAGE_HEIGHT_VH = 38;

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(0.98, n));
}

/**
 * Add Text preview for a double-clicked page photo. The stage has the photo frame's
 * aspect ratio and draws the photo the way the page does (contain), so a label dragged
 * here lands at the same spot on the page. `anchor` is the label's top-left as a
 * fraction of the frame; text renders at stage scale (stage width / frame width).
 * The yellow bars (zoom, rotate, Original / Pan / Crop) edit `view`, drawn the same way
 * the album page draws it.
 */
export default function PhotoAlbumsPlaceTextPhotoPreview({
  noteId,
  attachmentId,
  storageType = null,
  frameWidth,
  frameHeight,
  anchor,
  onAnchorChange,
  text,
  textStyle,
  view = ALBUM_PHOTO_VIEW_IDENTITY,
  onViewChange,
  onOriginal,
  onCrop,
  selectedOverlayId = null,
  onSelectOverlay
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const dragPanRef = useRef(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const [panEnabled, setPanEnabled] = useState(false);

  const fw = Math.max(1, Number(frameWidth) || 1);
  const fh = Math.max(1, Number(frameHeight) || 1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const measure = () => {
      const availW = Math.max(1, el.clientWidth);
      const availH = Math.max(1, (window.innerHeight * MAX_STAGE_HEIGHT_VH) / 100);
      const scale = Math.min(availW / fw, availH / fh);
      setStage({ width: Math.round(fw * scale), height: Math.round(fh * scale) });
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [fw, fh]);

  const scale = stage.width > 0 ? stage.width / fw : 1;

  const handlePointerDown = useCallback(
    (e) => {
      const rect = stageRef.current?.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = { startX: e.clientX, startY: e.clientY, origin: { ...anchor }, rect };
    },
    [anchor]
  );

  const handlePointerMove = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      onAnchorChange?.({
        fx: clamp01(drag.origin.fx + (e.clientX - drag.startX) / drag.rect.width),
        fy: clamp01(drag.origin.fy + (e.clientY - drag.startY) / drag.rect.height)
      });
    },
    [onAnchorChange]
  );

  const endDrag = useCallback((e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  const onPanPointerDown = useCallback(
    (e) => {
      if (!panEnabled) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const rect = stageRef.current?.getBoundingClientRect?.();
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragPanRef.current = { clientX: e.clientX, clientY: e.clientY, view, rect };
    },
    [panEnabled, view]
  );

  const onPanPointerMove = useCallback(
    (e) => {
      const s = dragPanRef.current;
      if (!s) return;
      onViewChange?.({
        ...s.view,
        panFx: s.view.panFx + (e.clientX - s.clientX) / s.rect.width,
        panFy: s.view.panFy + (e.clientY - s.clientY) / s.rect.height
      });
    },
    [onViewChange]
  );

  const overlays = Array.isArray(view.overlays) ? view.overlays : [];

  const handleOverlayChange = useCallback(
    (next) => {
      onViewChange?.({ ...view, overlays: overlays.map((o) => (o.id === next.id ? next : o)) });
    },
    [onViewChange, view, overlays]
  );

  const handleOverlayDelete = useCallback(
    (id) => {
      onSelectOverlay?.(null);
      onViewChange?.({ ...view, overlays: overlays.filter((o) => o.id !== id) });
    },
    [onSelectOverlay, onViewChange, view, overlays]
  );

  const onPanPointerUp = useCallback((e) => {
    dragPanRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  const fontPx = Math.max(4, (Number(textStyle?.fontSize) || 45) * scale);
  const strokePx = Math.max(0, (Number(textStyle?.outlineWidth) || 0) * scale);
  const outline = textStyle?.outlineColor || '#000';

  return (
    <Box ref={containerRef} sx={{ width: '100%', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
      <Box sx={{ width: stage.width ? stage.width + 4 : '100%', display: 'flex', flexDirection: 'column', gap: 1 }}>
        <PhotoEditZoomBar zoom={view.zoom} onZoomChange={(zoom) => onViewChange?.({ ...view, zoom })} />
        <Box
          ref={stageRef}
          data-pa-place-text-photo-preview=""
          sx={{
            position: 'relative',
            width: stage.width || '100%',
            height: stage.height || 200,
            bgcolor: 'var(--theme-daynight-color)',
            border: '2px solid #000',
            boxSizing: 'content-box',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none'
          }}
          onPointerDown={(e) => {
            if (!e.target?.closest?.('[data-pa-photo-overlay]')) onSelectOverlay?.(null);
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              transform: albumPhotoViewTransform(view, stage.width, stage.height),
              transformOrigin: 'center center',
              pointerEvents: 'none',
              zIndex: 0
            }}
          >
            <PhotoAlbumsThumbnail
              noteId={noteId}
              attachmentId={attachmentId}
              storageType={storageType}
              cache={photoAlbumsPagePhotoCache}
              objectFit="contain"
            />
          </Box>
          <PhotoAlbumsPhotoOverlays
            overlays={overlays}
            width={stage.width}
            height={stage.height}
            editable
            selectedId={selectedOverlayId}
            onSelect={onSelectOverlay}
            onChange={handleOverlayChange}
            onDelete={handleOverlayDelete}
          />
          <Box
            role="button"
            tabIndex={-1}
            aria-label="Drag to position the text on the photo"
            title="Drag to position the text on the photo"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            sx={{
              position: 'absolute',
              left: Math.round(clamp01(anchor?.fx) * stage.width),
              top: Math.round(clamp01(anchor?.fy) * stage.height),
              maxWidth: '100%',
              cursor: 'move',
              touchAction: 'none',
              outline: '2px dashed rgba(255,255,255,0.85)',
              outlineOffset: 2,
              fontFamily: textStyle?.fontFamily,
              fontWeight: textStyle?.fontWeight,
              fontSize: `${fontPx}px`,
              lineHeight: 1.2,
              color: textStyle?.color,
              WebkitTextFillColor: textStyle?.color,
              WebkitTextStroke: strokePx > 0 ? `${strokePx}px ${outline}` : '0px transparent',
              paintOrder: 'stroke fill',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              textTransform: textStyle?.uppercase ? 'uppercase' : 'none',
              zIndex: 2
            }}
          >
            {text}
          </Box>
          {panEnabled ? <PhotoEditPanArrows /> : null}
          {panEnabled ? (
            <Box
              role="application"
              aria-label="Drag to move the photo"
              onPointerDown={onPanPointerDown}
              onPointerMove={onPanPointerMove}
              onPointerUp={onPanPointerUp}
              onPointerCancel={onPanPointerUp}
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 4,
                cursor: 'grab',
                touchAction: 'none',
                '&:active': { cursor: 'grabbing' }
              }}
            />
          ) : null}
        </Box>
        <PhotoEditRotateBar rotationDeg={view.rotationDeg} onRotationChange={(rotationDeg) => onViewChange?.({ ...view, rotationDeg })} />
        <PhotoEditActionButtons
          panEnabled={panEnabled}
          onOriginal={() => {
            setPanEnabled(false);
            onOriginal?.();
          }}
          onTogglePan={() => setPanEnabled((v) => !v)}
          onCrop={() => {
            setPanEnabled(false);
            onCrop?.();
          }}
        />
      </Box>
    </Box>
  );
}

PhotoAlbumsPlaceTextPhotoPreview.propTypes = {
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  attachmentId: PropTypes.number.isRequired,
  storageType: PropTypes.string,
  frameWidth: PropTypes.number.isRequired,
  frameHeight: PropTypes.number.isRequired,
  anchor: PropTypes.shape({ fx: PropTypes.number, fy: PropTypes.number }).isRequired,
  onAnchorChange: PropTypes.func,
  text: PropTypes.string,
  textStyle: PropTypes.object,
  view: PropTypes.shape({
    zoom: PropTypes.number,
    panFx: PropTypes.number,
    panFy: PropTypes.number,
    rotationDeg: PropTypes.number
  }),
  onViewChange: PropTypes.func,
  onOriginal: PropTypes.func,
  onCrop: PropTypes.func,
  selectedOverlayId: PropTypes.string,
  onSelectOverlay: PropTypes.func
};
