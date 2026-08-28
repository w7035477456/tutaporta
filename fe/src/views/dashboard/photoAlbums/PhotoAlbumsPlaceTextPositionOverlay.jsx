import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { createPortal } from 'react-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import GreenButton from 'ui-component/GreenButton';
import BusyHourglass from 'ui-component/BusyHourglass';
import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import { mimeTypeForPhotoAlbumsVideoExtension } from 'utils/photoAlbumsFileFormats';
import { PLACE_TEXT_DEFAULTS } from './PhotoAlbumsPlaceTextDialog';

const HOURGLASS = '2rem';
const MIN_REL_W = 0.06;
const MIN_REL_H = 0.04;
const MIN_FONT_PX = 10;
const MAX_FONT_PX = 400;

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
};

function clamp01(n) {
  return Math.min(1, Math.max(0, n));
}

function computeContainedRect(containerW, containerH, aspect) {
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

function labelTextStyle(label, scale) {
  const fs = Math.max(MIN_FONT_PX, Math.round((Number(label.fontSize) || PLACE_TEXT_DEFAULTS.fontSize) * scale));
  const ow = Math.max(0, Number(label.outlineWidth));
  const strokeW = Number.isFinite(ow) ? ow : 1.25;
  const fill = label.color || PLACE_TEXT_DEFAULTS.color;
  const outline = label.outlineColor || PLACE_TEXT_DEFAULTS.outlineColor;
  const strokePx = strokeW > 0 ? Math.max(0.5, strokeW * scale) : 0;
  return {
    ['--rv-place-text-fill']: fill,
    ['--rv-place-text-outline']: outline,
    ['--rv-place-text-stroke']: strokePx > 0 ? `${strokePx}px ${outline}` : '0px transparent',
    ['--rv-place-text-shadow']: strokePx > 0 ? `0 1px 0 ${outline}` : 'none',
    fontSize: `${fs}px`,
    fontFamily: label.fontFamily || PLACE_TEXT_DEFAULTS.fontFamily,
    fontWeight: label.fontWeight || PLACE_TEXT_DEFAULTS.fontWeight,
    lineHeight: 1.15,
    wordBreak: 'break-word',
    textAlign: 'center',
    width: '100%',
    userSelect: 'none'
  };
}

function PlaceTextPositionLabel({
  label,
  photoDisplayRect,
  pagePhotoWidth,
  active,
  onActivate,
  onChange
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
        relX: clamp01((dispLeft - photoDisplayRect.left) / pw),
        relY: clamp01((dispTop - photoDisplayRect.top) / ph),
        relW: Math.max(MIN_REL_W, dispW / pw),
        relH: Math.max(MIN_REL_H, dispH / ph)
      };
    },
    [photoDisplayRect]
  );

  const startMove = useCallback(
    (event) => {
      if (event.button !== 0) return;
      if (event.target?.closest?.('.rv-place-text-pos__handle')) return;
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
        const nextLeft = originLeft + dx;
        const nextTop = originTop + dy;
        const rel = relFromDisplay(nextLeft, nextTop, w, h);
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

  const startResize = useCallback(
    (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      onActivate?.(label.clientKey);

      const startX = event.clientX;
      const startY = event.clientY;
      const originW = w;
      const originH = h;
      const originLeft = left;
      const originTop = top;
      const originFont = Math.max(MIN_FONT_PX, Number(label.fontSize) || PLACE_TEXT_DEFAULTS.fontSize);

      const onMove = (moveEvent) => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        let nextW = Math.max(48, originW + dx);
        let nextH = Math.max(28, originH + dy);
        const sx = nextW / originW;
        const sy = nextH / originH;
        const s = Math.abs(sx - 1) >= Math.abs(sy - 1) ? sx : sy;
        nextW = Math.max(48, originW * s);
        nextH = Math.max(28, originH * s);
        const nextFont = Math.max(
          MIN_FONT_PX,
          Math.min(MAX_FONT_PX, Math.round(originFont * (nextW / originW)))
        );
        const rel = relFromDisplay(originLeft, originTop, nextW, nextH);
        patchLabel({ ...rel, fontSize: nextFont });
      };

      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'nwse-resize';
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
        onActivate?.(label.clientKey);
        startMove(e);
      }}
      sx={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${w}px`,
        minHeight: `${h}px`,
        transform: `rotate(${rot}deg)`,
        transformOrigin: 'center center',
        cursor: 'grab',
        zIndex: active ? 4 : 2,
        border: active ? '2px dashed #e53935' : '1px dashed rgba(255,255,255,0.45)',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0.5
      }}
    >
      <span className="rv-place-text-pos__glyph" style={labelTextStyle(label, scale)}>
        {String(label.text || 'Text')}
      </span>
      {active ? (
        <>
          <Box
            className="rv-place-text-pos__handle rv-place-text-pos__handle--resize"
            onMouseDown={startResize}
            sx={{
              position: 'absolute',
              right: -8,
              bottom: -8,
              width: 14,
              height: 14,
              bgcolor: '#ffeb3b',
              border: '2px solid #000',
              borderRadius: '2px',
              cursor: 'nwse-resize'
            }}
          />
          <Box
            className="rv-place-text-pos__handle rv-place-text-pos__handle--rotate"
            onMouseDown={startRotate}
            sx={{
              position: 'absolute',
              left: '50%',
              bottom: -28,
              transform: 'translateX(-50%)',
              width: 22,
              height: 22,
              borderRadius: '50%',
              bgcolor: '#4fc3f7',
              border: '2px solid #000',
              cursor: 'grab'
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
  onChange: PropTypes.func
};

/**
 * Full-screen text placement on a photo/video after Add Text styling.
 */
export default function PhotoAlbumsPlaceTextPositionOverlay({
  open,
  session = null,
  noteId = null,
  storageType = null,
  onConfirm,
  onCancel
}) {
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [labels, setLabels] = useState([]);
  const [activeKey, setActiveKey] = useState('');
  const [objectUrl, setObjectUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const objectUrlRef = useRef('');

  const photoRect = session?.photoRect;
  const aspect =
    photoRect && photoRect.width > 0 && photoRect.height > 0
      ? photoRect.width / photoRect.height
      : 1;

  const photoDisplayRect = useMemo(() => {
    if (!stageSize.width || !stageSize.height) {
      return { left: 0, top: 0, width: 1, height: 1 };
    }
    return computeContainedRect(stageSize.width, stageSize.height, aspect);
  }, [stageSize.width, stageSize.height, aspect]);

  useEffect(() => {
    if (!open || !session) return undefined;
    setLabels(Array.isArray(session.labels) ? session.labels.map((l) => ({ ...l })) : []);
    setActiveKey(session.labels?.[session.labels.length - 1]?.clientKey || '');
    setError('');
    return undefined;
  }, [open, session]);

  useEffect(() => {
    if (!open) return undefined;
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setStageSize({ width: r.width, height: r.height });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setStageSize({ width: r.width, height: r.height });
    return () => ro.disconnect();
  }, [open]);

  useEffect(() => {
    if (!open || !session) return undefined;
    const attachmentId = Number(session.attachmentId);
    const nid = Number(noteId);
    if (!Number.isFinite(attachmentId) || attachmentId < 1 || !Number.isFinite(nid) || nid < 1) {
      setError('Photo not available');
      setObjectUrl('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const ext = String(session.fileExtension || '')
          .trim()
          .toLowerCase()
          .replace(/^\./, '');
        const mime = session.isVideo
          ? mimeTypeForPhotoAlbumsVideoExtension(ext)
          : MIME_BY_EXT[ext] || 'image/jpeg';
        const blob = await fetchPhotoAlbumsNoteAttachmentBlob(nid, attachmentId, {
          inline: true,
          storageType: storageType || undefined,
          variant: session.isVideo ? 'full' : 'display'
        });
        if (cancelled) return;
        const typed = blob?.type === mime ? blob : new Blob([blob], { type: mime });
        const url = URL.createObjectURL(typed);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = url;
        setObjectUrl(url);
      } catch (e) {
        if (!cancelled) {
          setError(String(e?.message || 'Could not load photo'));
          setObjectUrl('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, session, noteId, storageType]);

  useEffect(() => {
    if (open) return undefined;
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
    setObjectUrl('');
    return undefined;
  }, [open]);

  const handleLabelChange = useCallback((clientKey, patch) => {
    setLabels((prev) =>
      prev.map((l) => (l.clientKey === clientKey ? { ...l, ...patch } : l))
    );
  }, []);

  const handleConfirm = useCallback(() => {
    if (!session) return;
    onConfirm?.({ ...session, labels });
  }, [session, labels, onConfirm]);

  if (!open || !session || typeof document === 'undefined') return null;

  return createPortal(
    <Box
      role="dialog"
      aria-modal="true"
      aria-label="Place text on photo"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 15100,
        bgcolor: '#111',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ flex: '0 0 auto', px: 2, py: 1.5, textAlign: 'center' }}>
        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.1rem' }}>
          Place text on photo
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem', mt: 0.5 }}>
          Drag to move. Use the corner to resize and the blue handle to rotate. OK when done.
        </Typography>
      </Box>

      <Box
        ref={stageRef}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          mx: { xs: 1, sm: 3 },
          mb: 1,
          border: '2px solid rgba(255,255,255,0.25)',
          borderRadius: 1,
          overflow: 'hidden',
          bgcolor: '#000'
        }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <BusyHourglass fontSize={HOURGLASS} />
          </Box>
        ) : error ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#fff',
              px: 2,
              textAlign: 'center'
            }}
          >
            {error}
          </Box>
        ) : (
          <>
            <Box
              sx={{
                position: 'absolute',
                left: `${photoDisplayRect.left}px`,
                top: `${photoDisplayRect.top}px`,
                width: `${photoDisplayRect.width}px`,
                height: `${photoDisplayRect.height}px`,
                pointerEvents: 'none'
              }}
            >
              {session.isVideo && objectUrl ? (
                <Box
                  component="video"
                  src={objectUrl}
                  muted
                  playsInline
                  autoPlay
                  loop
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    bgcolor: '#000'
                  }}
                />
              ) : objectUrl ? (
                <Box
                  component="img"
                  src={objectUrl}
                  alt={session.fileName || 'Photo'}
                  sx={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    bgcolor: '#000',
                    userSelect: 'none'
                  }}
                />
              ) : null}
            </Box>
            {labels.map((label) => (
              <PlaceTextPositionLabel
                key={label.clientKey}
                label={label}
                photoDisplayRect={photoDisplayRect}
                pagePhotoWidth={Math.max(1, photoRect?.width || 1)}
                active={label.clientKey === activeKey}
                onActivate={setActiveKey}
                onChange={handleLabelChange}
              />
            ))}
          </>
        )}
      </Box>

      <Box
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 1.5,
          px: 3,
          py: 2
        }}
      >
        <GreenButton type="button" onClick={() => onCancel?.()} sx={{ minWidth: 96, fontWeight: 800 }}>
          Cancel
        </GreenButton>
        <GreenButton type="button" onClick={handleConfirm} disabled={loading || Boolean(error)}>
          OK
        </GreenButton>
      </Box>
    </Box>,
    document.body
  );
}

PhotoAlbumsPlaceTextPositionOverlay.propTypes = {
  open: PropTypes.bool,
  session: PropTypes.object,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  onConfirm: PropTypes.func,
  onCancel: PropTypes.func
};
