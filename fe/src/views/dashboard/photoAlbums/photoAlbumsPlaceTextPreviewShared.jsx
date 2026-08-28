import { useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ThumbnailDeleteXButton from 'ui-component/ThumbnailDeleteXButton';
import { PLACE_TEXT_DEFAULTS } from './PhotoAlbumsPlaceTextDialog';

export const PLACE_TEXT_PREVIEW_MIN_REL_W = 0.06;
export const PLACE_TEXT_PREVIEW_MIN_REL_H = 0.04;
export const PLACE_TEXT_PREVIEW_MIN_FONT_PX = 10;
export const PLACE_TEXT_PREVIEW_MAX_FONT_PX = 400;

const PLACE_TEXT_MIN_BOX_W_PX = 48;
const PLACE_TEXT_MIN_BOX_H_PX = 28;
const PLACE_TEXT_BOX_RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const PLACE_TEXT_BOX_CURSOR = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize'
};

export function clampPlaceText01(n) {
  return Math.min(1, Math.max(0, n));
}

export function computePlaceTextContainedRect(containerW, containerH, aspect) {
  const a = aspect > 0 ? aspect : 1;
  let w = containerW;
  let h = w / a;
  if (h > containerH) {
    h = containerH;
    w = h * a;
  }
  const left = (containerW - w) / 2;
  const top = (containerH - h) / 2;
  return { left, top, width: w, height: h };
}

export function placeTextLabelTextStyle(label, scale) {
  const fs = Math.max(
    PLACE_TEXT_PREVIEW_MIN_FONT_PX,
    Math.round((Number(label.fontSize) || PLACE_TEXT_DEFAULTS.fontSize) * scale)
  );
  const ow = Math.max(0, Number(label.outlineWidth));
  const strokeW = Number.isFinite(ow) ? ow : 1.25;
  const fill = label.color || PLACE_TEXT_DEFAULTS.color;
  const outline = label.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor;
  const strokePx = strokeW > 0 ? Math.max(0.5, strokeW * scale) : 0;
  // Use CSS vars + class (see .rv-place-text-pos__glyph) so fill beats popup
  // inverse-daynight WebkitTextFillColor. Never put "!important" inside a React
  // style *value* — browsers treat "#FBE618 !important" as an invalid color and
  // keep the inherited black fill.
  return {
    ['--rv-place-text-fill']: fill,
    ['--rv-place-text-outline']: outline,
    ['--rv-place-text-stroke']: strokePx > 0 ? `${strokePx}px ${outline}` : '0px transparent',
    ['--rv-place-text-shadow']: strokePx > 0 ? `0 1px 0 ${outline}` : 'none',
    fontSize: `${fs}px`,
    fontFamily: label.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
    fontWeight: label.fontWeight || PLACE_TEXT_DEFAULTS.fontWeight,
    lineHeight: 1.15,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    textAlign: 'center',
    width: '100%',
    userSelect: 'none'
  };
}

/** Draggable / resizable / rotatable label on a photo preview stage. */
export function PlaceTextPositionLabel({
  label,
  photoDisplayRect,
  pagePhotoWidth,
  active,
  onActivate,
  onChange,
  onDelete,
  onDoubleClickEdit
}) {
  const rootRef = useRef(null);
  const scale = photoDisplayRect.width / Math.max(1, pagePhotoWidth);
  const rot = Number.isFinite(Number(label.rotationDeg))
    ? Number(label.rotationDeg)
    : PLACE_TEXT_DEFAULTS.rotationDeg;
  const left = photoDisplayRect.left + (Number(label.relX) || 0) * photoDisplayRect.width;
  const top = photoDisplayRect.top + (Number(label.relY) || 0) * photoDisplayRect.height;
  const w = Math.max(24, (Number(label.relW) || 0.35) * photoDisplayRect.width);
  const h = Math.max(20, (Number(label.relH) || 0.12) * photoDisplayRect.height);

  const patchLabel = useCallback(
    (patch) => onChange?.(label.clientKey, patch),
    [label.clientKey, onChange]
  );

  const relFromDisplay = useCallback(
    (dispLeft, dispTop, dispW, dispH) => {
      const pw = Math.max(1, photoDisplayRect.width);
      const ph = Math.max(1, photoDisplayRect.height);
      return {
        relX: clampPlaceText01((dispLeft - photoDisplayRect.left) / pw),
        relY: clampPlaceText01((dispTop - photoDisplayRect.top) / ph),
        relW: Math.max(PLACE_TEXT_PREVIEW_MIN_REL_W, dispW / pw),
        relH: Math.max(PLACE_TEXT_PREVIEW_MIN_REL_H, dispH / ph)
      };
    },
    [photoDisplayRect]
  );

  const startMove = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (event.target?.closest?.('.rv-place-text-pos__handle')) return;
      if (event.target?.closest?.('.rv-place-text-pos__delete')) return;
      event.preventDefault();
      event.stopPropagation();
      onActivate?.(label.clientKey);

      const startX = event.clientX;
      const startY = event.clientY;
      const originLeft = left;
      const originTop = top;

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const rel = relFromDisplay(originLeft + dx, originTop + dy, w, h);
        patchLabel(rel);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [label.clientKey, left, top, w, h, onActivate, patchLabel, relFromDisplay]
  );

  const startBoxResize = useCallback(
    (handle) => (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      onActivate?.(label.clientKey);

      const cornerScale = handle.length === 2;
      const startX = event.clientX;
      const startY = event.clientY;
      const originW = w;
      const originH = h;
      const originLeft = left;
      const originTop = top;
      const originFont = Math.max(
        PLACE_TEXT_PREVIEW_MIN_FONT_PX,
        Number(label.fontSize) || PLACE_TEXT_DEFAULTS.fontSize
      );

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        let nextW = originW;
        let nextH = originH;
        let nextLeft = originLeft;
        let nextTop = originTop;

        if (handle.includes('e')) nextW = originW + dx;
        if (handle.includes('w')) {
          nextW = originW - dx;
          nextLeft = originLeft + dx;
        }
        if (handle.includes('s')) nextH = originH + dy;
        if (handle.includes('n')) {
          nextH = originH - dy;
          nextTop = originTop + dy;
        }
        if (handle === 'n' || handle === 's') {
          nextLeft = originLeft;
          nextW = originW;
        }
        if (handle === 'e' || handle === 'w') {
          nextTop = originTop;
          nextH = originH;
        }

        let nextFont = originFont;
        if (cornerScale) {
          let scale = 1;
          if (handle === 'e' || handle === 'w') scale = nextW / originW;
          else if (handle === 'n' || handle === 's') scale = nextH / originH;
          else {
            const sx = nextW / originW;
            const sy = nextH / originH;
            scale = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
          }
          const minScale = Math.max(
            PLACE_TEXT_MIN_BOX_W_PX / originW,
            PLACE_TEXT_MIN_BOX_H_PX / originH,
            PLACE_TEXT_PREVIEW_MIN_FONT_PX / originFont
          );
          const maxScale = Math.min(PLACE_TEXT_PREVIEW_MAX_FONT_PX / originFont, 12);
          scale = Math.min(maxScale, Math.max(minScale, scale));
          nextW = Math.max(PLACE_TEXT_MIN_BOX_W_PX, originW * scale);
          nextH = Math.max(PLACE_TEXT_MIN_BOX_H_PX, originH * scale);
          nextFont = Math.max(
            PLACE_TEXT_PREVIEW_MIN_FONT_PX,
            Math.min(PLACE_TEXT_PREVIEW_MAX_FONT_PX, Math.round(originFont * scale))
          );
        } else {
          nextW = Math.max(PLACE_TEXT_MIN_BOX_W_PX, nextW);
          nextH = Math.max(PLACE_TEXT_MIN_BOX_H_PX, nextH);
        }

        if (handle.includes('w')) nextLeft = originLeft + originW - nextW;
        if (handle.includes('n')) nextTop = originTop + originH - nextH;

        const rel = relFromDisplay(nextLeft, nextTop, nextW, nextH);
        patchLabel(cornerScale ? { ...rel, fontSize: nextFont } : rel);
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = PLACE_TEXT_BOX_CURSOR[handle] || 'nwse-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [label.clientKey, label.fontSize, left, top, w, h, onActivate, patchLabel, relFromDisplay]
  );

  const startRotate = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      onActivate?.(label.clientKey);

      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const startAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
      const originRot = rot;

      const onMove = (moveEvent) => {
        const angle = Math.atan2(moveEvent.clientY - cy, moveEvent.clientX - cx);
        const deltaDeg = ((angle - startAngle) * 180) / Math.PI;
        patchLabel({ rotationDeg: Math.round(originRot + deltaDeg) });
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'grabbing';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [label.clientKey, rot, onActivate, patchLabel]
  );

  return (
    <Box
      ref={rootRef}
      className={`rv-place-text-pos__label${active ? ' is-active' : ''}`}
      onMouseDown={(e) => {
        if (e.target?.closest?.('.rv-place-text-pos__delete')) return;
        onActivate?.(label.clientKey);
        startMove(e);
      }}
      onDoubleClick={(e) => {
        if (e.target?.closest?.('.rv-place-text-pos__delete')) return;
        e.preventDefault();
        e.stopPropagation();
        onActivate?.(label.clientKey);
        onDoubleClickEdit?.(label.clientKey);
      }}
      sx={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${w}px`,
        height: `${h}px`,
        transform: `rotate(${rot}deg)`,
        transformOrigin: 'center center',
        cursor: 'grab',
        zIndex: active ? 4 : 2,
        border: active ? '2px dashed #2f6fed' : '1px dashed rgba(255,255,255,0.45)',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0.5,
        overflow: 'visible'
      }}
    >
      {typeof onDelete === 'function' ? (
        <ThumbnailDeleteXButton
          className="rv-place-text-pos__delete"
          aria-label="Delete text or emoji"
          title="Delete"
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(label.clientKey);
          }}
          sx={{
            top: -10,
            right: -10,
            width: 22,
            height: 22,
            zIndex: 8
          }}
        />
      ) : null}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box'
        }}
      >
        <span className="rv-place-text-pos__glyph" style={placeTextLabelTextStyle(label, scale)}>
          {String(label.text || 'Text')}
        </span>
      </Box>
      {active ? (
        <>
          {PLACE_TEXT_BOX_RESIZE_HANDLES.map((handle) => {
            const pos = {};
            if (handle.includes('n')) pos.top = -6;
            if (handle.includes('s')) pos.bottom = -6;
            if (handle.includes('w')) pos.left = -6;
            if (handle.includes('e')) pos.right = -6;
            if (handle === 'n' || handle === 's') {
              pos.left = '50%';
              pos.marginLeft = '-6px';
            }
            if (handle === 'e' || handle === 'w') {
              pos.top = '50%';
              pos.marginTop = '-6px';
            }
            return (
              <Box
                key={handle}
                className={`rv-place-text-pos__handle rv-place-text-pos__handle--${handle}`}
                aria-label={`Resize text (${handle})`}
                title={
                  handle.length === 2
                    ? 'Drag corner to scale text size'
                    : 'Drag side to stretch the box (word wrap)'
                }
                onMouseDown={startBoxResize(handle)}
                sx={{
                  position: 'absolute',
                  width: 12,
                  height: 12,
                  ...pos,
                  borderRadius: '2px',
                  bgcolor: '#2f6fed',
                  border: '2px solid #fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
                  cursor: PLACE_TEXT_BOX_CURSOR[handle] || 'nwse-resize',
                  zIndex: 4,
                  '&:hover': { transform: 'scale(1.15)' }
                }}
              />
            );
          })}
          <Box
            className="rv-place-text-pos__handle rv-place-text-pos__handle--rotate"
            role="slider"
            aria-label="Rotate text"
            title="Drag to rotate"
            onMouseDown={startRotate}
            sx={{
              position: 'absolute',
              left: '50%',
              top: -34,
              width: 16,
              height: 16,
              ml: '-8px',
              borderRadius: '50%',
              bgcolor: '#2f6fed',
              border: '2px solid #fff',
              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              cursor: 'grab',
              zIndex: 6,
              '&::after': {
                content: '""',
                position: 'absolute',
                left: '50%',
                top: 16,
                width: 2,
                height: 14,
                ml: '-1px',
                bgcolor: '#2f6fed'
              }
            }}
          />
        </>
      ) : null}
    </Box>
  );
}

PlaceTextPositionLabel.propTypes = {
  label: PropTypes.object.isRequired,
  photoDisplayRect: PropTypes.object.isRequired,
  pagePhotoWidth: PropTypes.number.isRequired,
  active: PropTypes.bool,
  onActivate: PropTypes.func,
  onChange: PropTypes.func,
  onDelete: PropTypes.func,
  onDoubleClickEdit: PropTypes.func
};
