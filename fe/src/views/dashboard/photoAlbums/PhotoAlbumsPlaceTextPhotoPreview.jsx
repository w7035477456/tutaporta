import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import PhotoAlbumsThumbnail from './thumbnails/PhotoAlbumsThumbnail';
import { photoAlbumsPagePhotoCache } from './thumbnails/photoAlbumsThumbnailStore';

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
  textStyle
}) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [stage, setStage] = useState({ width: 0, height: 0 });

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

  const fontPx = Math.max(4, (Number(textStyle?.fontSize) || 45) * scale);
  const strokePx = Math.max(0, (Number(textStyle?.outlineWidth) || 0) * scale);
  const outline = textStyle?.outlineColor || '#000';

  return (
    <Box ref={containerRef} sx={{ width: '100%', display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
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
      >
        <PhotoAlbumsThumbnail
          noteId={noteId}
          attachmentId={attachmentId}
          storageType={storageType}
          cache={photoAlbumsPagePhotoCache}
          objectFit="contain"
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
  textStyle: PropTypes.object
};
