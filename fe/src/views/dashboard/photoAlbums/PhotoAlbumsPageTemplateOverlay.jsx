import PropTypes from 'prop-types';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  albumSlotToPx,
  getPhotoAlbumsPageTemplate,
  resolveAlbumTemplateSlots
} from './photoAlbumsPageTemplates';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';

const MIN_SLOT_PX = 48;
const BLUE = '#2979ff';
const SLOT_STROKE_PX = 2;
const WHEEL_SCALE_IN = 1.06;
const WHEEL_SCALE_OUT = 1 / WHEEL_SCALE_IN;

function pxRectToSlotPct(rect, pageW, pageH) {
  const pw = Math.max(1, pageW);
  const ph = Math.max(1, pageH);
  const x = Math.min(96, Math.max(0, (rect.x / pw) * 100));
  const y = Math.min(96, Math.max(0, (rect.y / ph) * 100));
  const w = Math.min(100 - x, Math.max(4, (rect.w / pw) * 100));
  const h = Math.min(100 - y, Math.max(4, (rect.h / ph) * 100));
  return { x, y, w, h };
}

/**
 * Dashed photo/text placeholders for one album template instance (one page).
 * Double-click a slot to select it; a selected text slot can be dragged or wheel-resized.
 * Picture slots are fixed size. Photos are not placed on pages yet.
 */
export default function PhotoAlbumsPageTemplateOverlay({
  templateId = '',
  pageWidth = 0,
  pageHeight = 0,
  offsetLeft = 0,
  offsetTop = 0,
  slotOverrides = null,
  editable = true,
  dragScale = 1,
  /** Template instance key — each template is one album page for prev/next nav. */
  pageKey = '',
  onSlotGeometryChange,
  onDelete
}) {
  const template = getPhotoAlbumsPageTemplate(templateId);
  const slots = useMemo(
    () => resolveAlbumTemplateSlots(template, slotOverrides),
    [template, slotOverrides]
  );
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const liveRef = useRef(null);
  const slotElsRef = useRef({});
  const scale = Math.max(0.01, Number(dragScale) || 1);
  const slotMode = editable && Boolean(selectedSlotId);

  const slotIdAtPoint = useCallback(
    (clientX, clientY) => {
      for (const slot of slots) {
        const el = slotElsRef.current[slot.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
          return slot;
        }
      }
      return null;
    },
    [slots]
  );

  // Wheel over a selected text slot reshapes it; everything else scrolls the page.
  useLayoutEffect(() => {
    if (!editable || !onSlotGeometryChange || !selectedSlotId) return undefined;
    const onWheel = (e) => {
      const slot = slotIdAtPoint(e.clientX, e.clientY);
      if (!slot || slot.type !== 'text' || slot.id !== selectedSlotId) return;
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY < 0 ? WHEEL_SCALE_IN : WHEEL_SCALE_OUT;
      const rect = albumSlotToPx(slot, pageWidth, pageHeight);
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let w = Math.max(MIN_SLOT_PX, Math.round(rect.width * factor));
      let h = Math.max(MIN_SLOT_PX, Math.round(rect.height * factor));
      const x = Math.max(0, Math.round(cx - w / 2));
      const y = Math.max(0, Math.round(cy - h / 2));
      if (x + w > pageWidth) w = Math.max(MIN_SLOT_PX, pageWidth - x);
      if (y + h > pageHeight) h = Math.max(MIN_SLOT_PX, pageHeight - y);
      onSlotGeometryChange(slot.id, pxRectToSlotPct({ x, y, w, h }, pageWidth, pageHeight), {
        live: false
      });
    };
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', onWheel, { capture: true });
  }, [editable, onSlotGeometryChange, selectedSlotId, slotIdAtPoint, pageWidth, pageHeight]);

  useEffect(() => {
    if (!slotMode) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedSlotId('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slotMode]);

  // Click outside every slot of this page clears the slot selection.
  useLayoutEffect(() => {
    if (!slotMode) return undefined;
    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      const t = e.target;
      if (t instanceof Element && t.closest('.rv-album-template__delete, button, a')) return;
      if (slotIdAtPoint(e.clientX, e.clientY)) return;
      setSelectedSlotId('');
    };
    window.addEventListener('mousedown', onPointerDown, true);
    return () => window.removeEventListener('mousedown', onPointerDown, true);
  }, [slotMode, slotIdAtPoint]);

  const startSlotMove = useCallback(
    (slotId, rect) => (event) => {
      if (!editable || !onSlotGeometryChange || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;
      const origin = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };

      const onMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / scale;
        const dy = (moveEvent.clientY - startY) / scale;
        const x = Math.max(0, Math.min(pageWidth - origin.w, Math.round(origin.x + dx)));
        const y = Math.max(0, Math.min(pageHeight - origin.h, Math.round(origin.y + dy)));
        liveRef.current = pxRectToSlotPct({ x, y, w: origin.w, h: origin.h }, pageWidth, pageHeight);
        onSlotGeometryChange(slotId, liveRef.current, { live: true });
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        if (liveRef.current) onSlotGeometryChange(slotId, liveRef.current, { live: false });
        liveRef.current = null;
      };
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'move';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [editable, onSlotGeometryChange, pageWidth, pageHeight, scale]
  );

  if (!template || pageWidth < 8 || pageHeight < 8) return null;

  return (
    <Box
      data-pa-album-page-key={pageKey || undefined}
      className={`rv-album-template-overlay${slotMode ? ' is-slot-mode' : ''}`}
      sx={{
        position: 'absolute',
        left: offsetLeft,
        top: offsetTop,
        width: pageWidth,
        height: pageHeight,
        pointerEvents: 'none',
        zIndex: 40,
        outline: 'none',
        boxSizing: 'border-box',
        overflow: 'visible'
      }}
    >
      {slots.map((slot) => {
        const rect = albumSlotToPx(slot, pageWidth, pageHeight);
        const isPhoto = slot.type === 'photo';
        const isSlotSelected = selectedSlotId === slot.id;
        const idleColor = isPhoto ? '#c62828' : '#1976d2';
        const strokeColor = isSlotSelected ? BLUE : idleColor;
        return (
          <Box
            key={slot.id}
            data-album-slot={slot.id}
            data-album-slot-type={slot.type}
            className={isSlotSelected ? 'rv-album-chrome-outline-blink-slot' : undefined}
            ref={(el) => {
              if (el) slotElsRef.current[slot.id] = el;
              else delete slotElsRef.current[slot.id];
            }}
            onMouseDown={(e) => {
              if (editable && !isPhoto && isSlotSelected) startSlotMove(slot.id, rect)(e);
            }}
            onDoubleClick={(e) => {
              if (!editable) return;
              e.stopPropagation();
              setSelectedSlotId(slot.id);
            }}
            title={
              isSlotSelected
                ? isPhoto
                  ? 'Slot selected · slot size is fixed · Esc or click outside to unselect'
                  : 'Scroll wheel to resize text box · drag to move · Esc or click outside to unselect'
                : 'Double-click to select slot'
            }
            sx={{
              position: 'absolute',
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              border: 'none',
              outline: `${SLOT_STROKE_PX}px dashed ${strokeColor}`,
              outlineOffset: 0,
              bgcolor: isSlotSelected
                ? 'rgba(41,121,255,0.14)'
                : isPhoto
                  ? 'rgba(198,40,40,0.06)'
                  : 'rgba(25,118,210,0.06)',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: editable ? (isSlotSelected && !isPhoto ? 'grab' : 'pointer') : 'default',
              pointerEvents: editable ? 'auto' : 'none',
              zIndex: isSlotSelected ? 12 : 1,
              transition: 'background-color 0.12s ease, outline-color 0.12s ease'
            }}
          >
            {!isSlotSelected ? (
              <Typography
                sx={{
                  color: isPhoto ? '#c62828' : '#1565c0',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textAlign: 'center',
                  px: 1,
                  userSelect: 'none',
                  pointerEvents: 'none',
                  opacity: 0.75
                }}
              >
                {isPhoto ? 'Photo' : 'Text'}
              </Typography>
            ) : null}
          </Box>
        );
      })}

      {editable && onDelete ? (
        <Box
          component="button"
          type="button"
          className="rv-album-template__delete"
          aria-label="Delete template"
          title="Delete template"
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setSelectedSlotId('');
            onDelete();
          }}
          {...guestDemoBlockProps()}
          sx={{
            position: 'absolute',
            top: 8,
            right: 4,
            zIndex: 90,
            pointerEvents: 'auto',
            width: 44,
            height: 44,
            minWidth: 44,
            minHeight: 44,
            p: 0,
            m: 0,
            border: '2px solid #ffffff',
            borderRadius: '4px',
            bgcolor: '#000000',
            color: '#e53935',
            fontSize: '1.6rem',
            fontWeight: 900,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
            '&:hover': {
              bgcolor: '#111111',
              color: '#ff1744'
            }
          }}
        >
          X
        </Box>
      ) : null}
    </Box>
  );
}

PhotoAlbumsPageTemplateOverlay.propTypes = {
  templateId: PropTypes.string,
  pageWidth: PropTypes.number,
  pageHeight: PropTypes.number,
  offsetLeft: PropTypes.number,
  offsetTop: PropTypes.number,
  slotOverrides: PropTypes.object,
  editable: PropTypes.bool,
  dragScale: PropTypes.number,
  pageKey: PropTypes.string,
  onSlotGeometryChange: PropTypes.func,
  onDelete: PropTypes.func
};
