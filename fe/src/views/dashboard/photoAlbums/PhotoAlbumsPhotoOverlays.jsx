import { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { ALBUM_PHOTO_OVERLAY_SIZE_MAX, ALBUM_PHOTO_OVERLAY_SIZE_MIN } from './photoAlbumsPages';

const HANDLE_PX = 18;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Emoji stickers and round blurs over a page photo, sized to the `width` × `height` photo cell.
 * With `editable`, each one drags to move, the corner handle resizes it and × removes it.
 */
export default function PhotoAlbumsPhotoOverlays({
  overlays,
  width,
  height,
  editable = false,
  selectedId = null,
  onSelect,
  onChange,
  onDelete,
  zIndex = 1
}) {
  const dragRef = useRef(null);
  const w = Math.max(1, Number(width) || 1);
  const h = Math.max(1, Number(height) || 1);

  const startDrag = useCallback(
    (e, overlay, mode) => {
      if (!editable) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      dragRef.current = { mode, overlay, startX: e.clientX, startY: e.clientY };
      onSelect?.(overlay.id);
    },
    [editable, onSelect]
  );

  const moveDrag = useCallback(
    (e) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const o = drag.overlay;
      if (drag.mode === 'resize') {
        const grow = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        onChange?.({
          ...o,
          size: clamp(o.size + (grow * 2) / w, ALBUM_PHOTO_OVERLAY_SIZE_MIN, ALBUM_PHOTO_OVERLAY_SIZE_MAX)
        });
        return;
      }
      onChange?.({ ...o, fx: clamp(o.fx + dx / w, 0, 1), fy: clamp(o.fy + dy / h, 0, 1) });
    },
    [onChange, w, h]
  );

  const endDrag = useCallback((e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  }, []);

  if (!Array.isArray(overlays) || !overlays.length) return null;

  return overlays.map((overlay) => {
    const sizePx = Math.max(4, overlay.size * w);
    const selected = editable && overlay.id === selectedId;
    const isBlur = overlay.kind === 'blur';
    const blurPx = Math.max(4, Math.round(sizePx * 0.08));
    return (
      <Box
        key={overlay.id}
        data-pa-photo-overlay={overlay.kind}
        role={editable ? 'button' : undefined}
        aria-label={editable ? (isBlur ? 'Blur — drag to move' : `Emoji ${overlay.emoji} — drag to move`) : undefined}
        onPointerDown={editable ? (e) => startDrag(e, overlay, 'move') : undefined}
        onPointerMove={editable ? moveDrag : undefined}
        onPointerUp={editable ? endDrag : undefined}
        onPointerCancel={editable ? endDrag : undefined}
        sx={{
          position: 'absolute',
          left: overlay.fx * w - sizePx / 2,
          top: overlay.fy * h - sizePx / 2,
          width: sizePx,
          height: sizePx,
          zIndex,
          pointerEvents: editable ? 'auto' : 'none',
          cursor: editable ? 'move' : 'default',
          touchAction: 'none',
          userSelect: 'none',
          outline: selected ? '2px dashed #fff' : 'none',
          outlineOffset: 2,
          boxShadow: selected ? '0 0 0 4px rgba(0,0,0,0.45)' : 'none',
          borderRadius: isBlur ? '50%' : 1,
          ...(isBlur
            ? {
                backdropFilter: `blur(${blurPx}px)`,
                WebkitBackdropFilter: `blur(${blurPx}px)`,
                bgcolor: 'rgba(255,255,255,0.04)'
              }
            : {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${sizePx * 0.86}px`,
                lineHeight: 1
              })
        }}
      >
        {isBlur ? null : overlay.emoji}
        {selected ? (
          <>
            <Box
              component="button"
              type="button"
              aria-label="Remove"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(overlay.id);
              }}
              sx={{
                position: 'absolute',
                top: -HANDLE_PX / 2,
                right: -HANDLE_PX / 2,
                width: HANDLE_PX + 4,
                height: HANDLE_PX + 4,
                p: 0,
                borderRadius: '50%',
                border: '2px solid #fff',
                bgcolor: '#e53935',
                color: '#fff',
                fontSize: 13,
                fontWeight: 900,
                lineHeight: 1,
                cursor: 'pointer'
              }}
            >
              ×
            </Box>
            <Box
              aria-label="Drag to resize"
              onPointerDown={(e) => startDrag(e, overlay, 'resize')}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              sx={{
                position: 'absolute',
                right: -HANDLE_PX / 2,
                bottom: -HANDLE_PX / 2,
                width: HANDLE_PX,
                height: HANDLE_PX,
                bgcolor: '#FBDF1B',
                border: '2px solid #000',
                borderRadius: 0.5,
                cursor: 'nwse-resize',
                touchAction: 'none'
              }}
            />
          </>
        ) : null}
      </Box>
    );
  });
}

PhotoAlbumsPhotoOverlays.propTypes = {
  overlays: PropTypes.arrayOf(PropTypes.object),
  width: PropTypes.number,
  height: PropTypes.number,
  editable: PropTypes.bool,
  selectedId: PropTypes.string,
  onSelect: PropTypes.func,
  onChange: PropTypes.func,
  onDelete: PropTypes.func,
  zIndex: PropTypes.number
};
