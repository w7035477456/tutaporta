import PropTypes from 'prop-types';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  albumSlotToPx,
  getPhotoAlbumsPageTemplate,
  resolveAlbumTemplateSlots
} from './photoAlbumsPageTemplates';
import { isStagedAttachmentDrag } from './PhotoAlbumsPhotoStagingTray';
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
 * Dashed photo/text placeholders for one album template instance.
 * Template size/position is fixed — no template select, move, or resize.
 * Click a slot → slot control; click outside any slot → unselect slot only.
 * Picture slots NEVER resize or pan — scroll only zooms the photo inside the window.
 * Text slots: scroll/drag can reshape the text box.
 */
export default function PhotoAlbumsPageTemplateOverlay({
  templateId = '',
  pageWidth = 0,
  pageHeight = 0,
  offsetLeft = 0,
  offsetTop = 0,
  slotOverrides = null,
  highlightSlotId = '',
  occupiedSlotIds = null,
  editable = true,
  stagingDragActive = false,
  dragScale = 1,
  /** Template instance key — each template is one album page for prev/next nav. */
  pageKey = '',
  onMoveResize: _onMoveResize,
  onSlotGeometryChange,
  onSlotPhotoZoom,
  onSlotPhotoPan,
  onSlotPhotoScale,
  /** Return true when the photo occupying this slot is the TipTap-selected node. */
  isSlotPhotoSelected = null,
  onDelete,
  onStagedPhotoDrop
}) {
  void _onMoveResize;
  const template = getPhotoAlbumsPageTemplate(templateId);
  const slots = useMemo(
    () => resolveAlbumTemplateSlots(template, slotOverrides),
    [template, slotOverrides]
  );
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [slotDragOverId, setSlotDragOverId] = useState('');
  const liveRef = useRef(null);
  const slotElsRef = useRef({});
  const overlayRef = useRef(null);
  const scale = Math.max(0.01, Number(dragScale) || 1);
  const canEditLayout = editable;
  const slotMode = canEditLayout && Boolean(selectedSlotId);
  const occupancyReady = occupiedSlotIds instanceof Set;

  // Scroll-wheel: picture slots never capture the wheel (page scrollbar scrolls).
  // Text slots may still be reshaped with the wheel when already selected.
  useLayoutEffect(() => {
    if (!canEditLayout) return undefined;
    const onWheel = (e) => {
      const factor = e.deltaY < 0 ? WHEEL_SCALE_IN : WHEEL_SCALE_OUT;

      for (const slot of slots) {
        const el = slotElsRef.current[slot.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        ) {
          continue;
        }
        // Picture slots: do not zoom with the wheel — leave vertical page scroll alone.
        if (slot.type !== 'text') {
          return;
        }

        // Text slots may still be reshaped with the wheel when already selected.
        if (!onSlotGeometryChange) return;
        if (selectedSlotId !== slot.id) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = albumSlotToPx(slot, pageWidth, pageHeight);
        const origin = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
        const cx = origin.x + origin.w / 2;
        const cy = origin.y + origin.h / 2;
        let w = Math.max(MIN_SLOT_PX, Math.round(origin.w * factor));
        let h = Math.max(MIN_SLOT_PX, Math.round(origin.h * factor));
        let x = Math.round(cx - w / 2);
        let y = Math.round(cy - h / 2);
        if (x < 0) x = 0;
        if (y < 0) y = 0;
        if (x + w > pageWidth) w = Math.max(MIN_SLOT_PX, pageWidth - x);
        if (y + h > pageHeight) h = Math.max(MIN_SLOT_PX, pageHeight - y);
        onSlotGeometryChange(slot.id, pxRectToSlotPct({ x, y, w, h }, pageWidth, pageHeight), {
          live: false
        });
        return;
      }
      // Outside slots: do not select/resize the template.
    };
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    return () => window.removeEventListener('wheel', onWheel, { capture: true });
  }, [
    canEditLayout,
    onSlotGeometryChange,
    selectedSlotId,
    pageWidth,
    pageHeight,
    slotOverrides,
    templateId,
    slots
  ]);

  useEffect(() => {
    if (!slotMode) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedSlotId('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slotMode]);

  /**
   * Occupied slots are pointer-events:none so photos stay draggable. Capture-phase:
   * single-click outside a slot clears slot chrome; slot select is double-click only
   * (drop must not enter blinking selected mode).
   */
  useLayoutEffect(() => {
    if (!canEditLayout) return undefined;
    const onPointerDown = (e) => {
      if (e.button != null && e.button !== 0) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (
        t.closest(
          [
            '.rv-album-template__delete',
            '.rv-photo-tile__actions',
            'button',
            'a'
          ].join(',')
        )
      ) {
        return;
      }
      let hitId = '';
      for (const slot of slots) {
        const el = slotElsRef.current[slot.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          continue;
        }
        hitId = slot.id;
        break;
      }
      // Clicking a slot does not select — double-click does (see onDblClick).
      if (hitId) return;
      setSelectedSlotId('');
    };
    const onDblClick = (e) => {
      if (e.button != null && e.button !== 0) return;
      const t = e.target;
      if (!(t instanceof Element)) return;
      if (
        t.closest(
          [
            '.rv-album-template__delete',
            '.rv-photo-tile__actions',
            'button',
            'a'
          ].join(',')
        )
      ) {
        return;
      }
      for (const slot of slots) {
        const el = slotElsRef.current[slot.id];
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
          continue;
        }
        // Occupied photo/text: let the node receive edit-mode double-click.
        if (occupancyReady && occupiedSlotIds.has(slot.id)) return;
        setSelectedSlotId(slot.id);
        return;
      }
    };
    window.addEventListener('mousedown', onPointerDown, true);
    window.addEventListener('dblclick', onDblClick, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown, true);
      window.removeEventListener('dblclick', onDblClick, true);
    };
  }, [canEditLayout, slots, occupancyReady, occupiedSlotIds]);

  const acceptStagedDragOver = useCallback(
    (event) => {
      if (!editable || !onStagedPhotoDrop) return false;
      if (!isStagedAttachmentDrag(event.dataTransfer) && !stagingDragActive) return false;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'copy';
      return true;
    },
    [editable, onStagedPhotoDrop, stagingDragActive]
  );

  const handleSlotDrop = useCallback(
    (event) => {
      if (!editable || !onStagedPhotoDrop) return;
      if (!isStagedAttachmentDrag(event.dataTransfer) && !stagingDragActive) return;
      event.preventDefault();
      event.stopPropagation();
      setSlotDragOverId('');
      // Drop fills the slot only — never enter blinking selected mode.
      setSelectedSlotId('');
      onStagedPhotoDrop(event);
    },
    [editable, onStagedPhotoDrop, stagingDragActive]
  );

  const startSlotMove = useCallback(
    (slotId, rect) => (event) => {
      if (!canEditLayout || !onSlotGeometryChange || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedSlotId(slotId);

      const startX = event.clientX;
      const startY = event.clientY;
      const origin = { x: rect.left, y: rect.top, w: rect.width, h: rect.height };
      let latestPct = null;

      const onMove = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / scale;
        const dy = (moveEvent.clientY - startY) / scale;
        let x = Math.round(origin.x + dx);
        let y = Math.round(origin.y + dy);
        x = Math.max(0, Math.min(pageWidth - origin.w, x));
        y = Math.max(0, Math.min(pageHeight - origin.h, y));
        latestPct = pxRectToSlotPct({ x, y, w: origin.w, h: origin.h }, pageWidth, pageHeight);
        liveRef.current = latestPct;
        onSlotGeometryChange(slotId, latestPct, { live: true });
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
    [canEditLayout, onSlotGeometryChange, pageWidth, pageHeight, scale]
  );

  if (!template || pageWidth < 8 || pageHeight < 8) return null;

  const borderOpacity = 1;
  const fillOpacity = 1;

  return (
    <Box
      ref={overlayRef}
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
        /* No template frame outline/blink — templates are never selected. */
        outline: 'none',
        boxSizing: 'border-box',
        overflow: 'visible'
      }}
    >

      {slots.map((slot) => {
        const rect = albumSlotToPx(slot, pageWidth, pageHeight);
        const isPhoto = slot.type === 'photo';
        const highlighted = highlightSlotId && highlightSlotId === slot.id;
        const occupied = occupancyReady && occupiedSlotIds.has(slot.id);
        const isSlotSelected = selectedSlotId === slot.id;
        const photoNodeSelected =
          occupied &&
          isPhoto &&
          typeof isSlotPhotoSelected === 'function' &&
          Boolean(isSlotPhotoSelected(slot.id));
        const photoBorder =
          photoNodeSelected || isSlotSelected || highlighted || slotDragOverId === slot.id
            ? BLUE
            : '#c62828';
        const textBorder =
          isSlotSelected || highlighted || slotDragOverId === slot.id ? BLUE : '#1976d2';
        const showPhotoSlotOutline =
          !occupied ||
          photoNodeSelected ||
          isSlotSelected ||
          highlighted ||
          slotDragOverId === slot.id ||
          stagingDragActive;
        const slotOutline = photoNodeSelected
          ? '2rem solid #e53935'
          : isPhoto
            ? showPhotoSlotOutline
              ? `${SLOT_STROKE_PX}px dashed ${photoBorder}`
              : 'none'
            : `${SLOT_STROKE_PX}px dashed ${textBorder}`;
        // Empty / staging-drop: full surface. Occupied: border strips only so the
        // photo underneath stays draggable (return to thumbnail alley).
        // Until occupancy is known, do not cover photos with fullHit (fail closed).
        const fullHit =
          stagingDragActive || (occupancyReady && !occupied && !isSlotSelected);
        const hideOccupiedPhotoChrome =
          occupied &&
          isPhoto &&
          !stagingDragActive &&
          !photoNodeSelected &&
          !isSlotSelected &&
          !highlighted &&
          slotDragOverId !== slot.id;
        const showBorderHits = !fullHit && !occupied;
        const selectSlot = (e) => {
          if (!canEditLayout) return;
          e.stopPropagation();
          setSelectedSlotId(slot.id);
        };
        const onSlotMouseDown = (e) => {
          if (!canEditLayout) return;
          // Move only after the slot is already selected (double-click). Picture slots never move.
          if (!occupied && slot.type === 'text' && selectedSlotId === slot.id) {
            startSlotMove(slot.id, rect)(e);
          }
        };
        const borderHit = {
          position: 'absolute',
          pointerEvents: 'auto',
          zIndex: 2,
          bgcolor: 'transparent'
        };
        return (
          <Box
            key={slot.id}
            data-album-slot={slot.id}
            data-album-slot-type={slot.type}
            className={
              photoNodeSelected
                ? 'rv-album-chrome-outline-blink-photo-slot'
                : isSlotSelected
                  ? 'rv-album-chrome-outline-blink-slot'
                  : undefined
            }
            ref={(el) => {
              if (el) slotElsRef.current[slot.id] = el;
              else delete slotElsRef.current[slot.id];
            }}
            onMouseDown={fullHit ? onSlotMouseDown : undefined}
            onDoubleClick={fullHit ? selectSlot : undefined}
            onDragEnter={(e) => {
              if (acceptStagedDragOver(e)) setSlotDragOverId(slot.id);
            }}
            onDragOver={(e) => {
              if (acceptStagedDragOver(e)) setSlotDragOverId(slot.id);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget)) return;
              setSlotDragOverId((id) => (id === slot.id ? '' : id));
            }}
            onDrop={handleSlotDrop}
            title={
              isSlotSelected
                ? isPhoto
                  ? 'Slot selected · double-click photo to select it · drag to swap or return to thumbnails (Pan&Zoom off) · Pan&Zoom to pan inside'
                  : 'Scroll wheel to resize text box · drag to move · Esc or click outside to unselect'
                : occupied
                  ? 'Drag photo to another slot to swap · drag to thumbnails to return · double-click for Edit Photo / Pan&Zoom'
                  : isPhoto
                    ? 'Drop a photo · drag another tray photo here to swap · double-click slot to select · slot size is fixed'
                    : 'Drop a photo or enter text · double-click to select · then scroll/drag'
            }
            sx={{
              position: 'absolute',
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              /* Outline (not border) so the dashed line sits on the box edge —
                 same edge the 9-dots are anchored to.
                 When the photo inside is selected, use a thick solid red frame that
                 stays slot-sized while the photo zooms underneath (clipped). */
              border: 'none',
              outline: slotOutline,
              outlineOffset: 0,
              opacity: borderOpacity,
              bgcolor: fullHit || isSlotSelected || photoNodeSelected
                ? isPhoto
                  ? highlighted ||
                    slotDragOverId === slot.id ||
                    isSlotSelected ||
                    photoNodeSelected
                    ? `rgba(41,121,255,${0.14 * fillOpacity})`
                    : `rgba(198,40,40,${0.06 * fillOpacity})`
                  : highlighted || slotDragOverId === slot.id || isSlotSelected
                    ? `rgba(41,121,255,${0.14 * fillOpacity})`
                    : `rgba(25,118,210,${0.06 * fillOpacity})`
                : 'transparent',
              borderRadius: 0,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: canEditLayout
                ? isSlotSelected
                  ? occupied || isPhoto
                    ? 'default'
                    : 'grab'
                  : 'pointer'
                : 'default',
              pointerEvents: hideOccupiedPhotoChrome ? 'none' : fullHit ? 'auto' : 'none',
              visibility: hideOccupiedPhotoChrome ? 'hidden' : 'visible',
              zIndex: photoNodeSelected || isSlotSelected ? 12 : stagingDragActive ? 20 : occupied ? 8 : 1,
              transition: isSlotSelected || photoNodeSelected
                ? 'background-color 0.12s ease, opacity 0.2s ease'
                : 'background-color 0.12s ease, outline-color 0.12s ease, opacity 0.2s ease'
            }}
          >
            {!showBorderHits ? null : (
              <>
                <Box onDoubleClick={selectSlot} title="Double-click to select slot" sx={{ ...borderHit, left: 0, right: 0, top: 0, height: 14 }} />
                <Box onDoubleClick={selectSlot} title="Double-click to select slot" sx={{ ...borderHit, left: 0, right: 0, bottom: 0, height: 14 }} />
                <Box onDoubleClick={selectSlot} title="Double-click to select slot" sx={{ ...borderHit, left: 0, top: 0, bottom: 0, width: 14 }} />
                <Box onDoubleClick={selectSlot} title="Double-click to select slot" sx={{ ...borderHit, right: 0, top: 0, bottom: 0, width: 14 }} />
              </>
            )}

            {!occupied && !isSlotSelected ? (
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
                {isPhoto ? 'Drop photo' : 'Drop photo or enter text'}
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
  highlightSlotId: PropTypes.string,
  occupiedSlotIds: PropTypes.instanceOf(Set),
  editable: PropTypes.bool,
  stagingDragActive: PropTypes.bool,
  dragScale: PropTypes.number,
  pageKey: PropTypes.string,
  onMoveResize: PropTypes.func,
  onSlotGeometryChange: PropTypes.func,
  onSlotPhotoZoom: PropTypes.func,
  onSlotPhotoPan: PropTypes.func,
  onSlotPhotoScale: PropTypes.func,
  isSlotPhotoSelected: PropTypes.func,
  onDelete: PropTypes.func,
  onStagedPhotoDrop: PropTypes.func
};
