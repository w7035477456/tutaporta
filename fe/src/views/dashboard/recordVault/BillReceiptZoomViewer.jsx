import { useCallback, useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import Typography from '@mui/material/Typography';
import ColorTemplate6CloseX from 'ui-component/ColorTemplate6CloseX';
import { SLIDER_CONTROL_TRUE_YELLOW } from 'ui-component/SliderControlButton';
import { COLOR_TEMPLATE7_POPUP_Z_INDEX } from 'config/colorTemplate7PopupLargeDark';
import { getPaidRecordAttachmentPreviewKind, paidRecordAttachmentUrl } from 'api/paidRecordFe';
import BillReceiptAttachmentPreview from './BillReceiptAttachmentPreview';

const ZOOM_STEP = 1.25;
const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
const TOOLBAR_PX = 64;
const STAGE_MARGIN_PX = 16;

const zoomButtonSx = {
  width: 44,
  height: 44,
  p: 0,
  border: '3px solid #000',
  borderRadius: 1,
  bgcolor: SLIDER_CONTROL_TRUE_YELLOW,
  color: '#000',
  WebkitTextFillColor: '#000',
  fontSize: '2rem',
  fontWeight: 900,
  lineHeight: 1,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&:disabled': { opacity: 0.45, cursor: 'default' },
  '&:hover:not(:disabled)': { filter: 'brightness(1.08)' }
};

function clampZoom(z) {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

/**
 * Full-screen Bills/Receipts viewer. Images open fitted to the window, then − / + (or the mouse
 * wheel) zoom and click-drag pans. PDF / DOCX fall back to the fitted preview.
 */
export default function BillReceiptZoomViewer({ open, onClose, paidRecordId, attachment }) {
  const stageRef = useRef(null);
  const dragRef = useRef(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [naturalSize, setNaturalSize] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const kind = attachment?.previewKind || getPaidRecordAttachmentPreviewKind(attachment?.mimeType, attachment?.originalFileName);
  const isImage = kind === 'image';
  const imageUrl =
    isImage && paidRecordId && attachment?.attachmentId ? paidRecordAttachmentUrl(paidRecordId, attachment.attachmentId) : '';

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [open, imageUrl]);

  const natural = naturalSize && naturalSize.url === imageUrl ? naturalSize : null;

  const measureStage = useCallback((el) => {
    stageRef.current = el;
    if (el) setStage({ w: el.clientWidth, h: el.clientHeight });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => {
      const el = stageRef.current;
      if (el) setStage({ w: el.clientWidth, h: el.clientHeight });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [open]);

  const fitScale =
    natural && stage.w > 0 && stage.h > 0
      ? Math.min((stage.w - STAGE_MARGIN_PX * 2) / natural.w, (stage.h - STAGE_MARGIN_PX * 2) / natural.h)
      : 0;
  const displayW = natural ? natural.w * fitScale * zoom : 0;
  const displayH = natural ? natural.h * fitScale * zoom : 0;

  const zoomBy = (factor) => {
    const next = clampZoom(zoom * factor);
    const ratio = next / zoom;
    setZoom(next);
    setOffset((o) => ({ x: o.x * ratio, y: o.y * ratio }));
  };

  const captureNaturalSize = useCallback((el) => {
    if (el?.complete && el.naturalWidth > 0) {
      setNaturalSize({ url: el.getAttribute('src'), w: el.naturalWidth, h: el.naturalHeight });
    }
  }, []);

  const resetZoom = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e) => {
    if (!isImage || e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    setDragging(true);
  };

  const handlePointerMove = (e) => {
    const start = dragRef.current;
    if (!start) return;
    setOffset({ x: start.ox + (e.clientX - start.x), y: start.oy + (e.clientY - start.y) });
  };

  const endDrag = (e) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  const handleWheel = (e) => {
    if (!isImage) return;
    zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  };

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
      aria-label="Zoomed bill or receipt"
      sx={{ zIndex: COLOR_TEMPLATE7_POPUP_Z_INDEX + 100 }}
      PaperProps={{ sx: { bgcolor: 'rgba(0, 0, 0, 0.88)', backgroundImage: 'none', overflow: 'hidden' } }}
    >
      <Box sx={{ position: 'relative', width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Box
          sx={{
            flex: `0 0 ${TOOLBAR_PX}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5
          }}
        >
          {isImage ? (
            <>
              <Box
                component="button"
                type="button"
                aria-label="Zoom out"
                disabled={zoom <= ZOOM_MIN}
                onClick={() => zoomBy(1 / ZOOM_STEP)}
                sx={zoomButtonSx}
              >
                −
              </Box>
              <Typography
                component="button"
                type="button"
                title="Fit to page"
                onClick={resetZoom}
                sx={{
                  minWidth: 72,
                  bgcolor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fff',
                  WebkitTextFillColor: '#fff',
                  fontWeight: 800,
                  fontSize: '1.1rem'
                }}
              >
                {Math.round(zoom * 100)}%
              </Typography>
              <Box
                component="button"
                type="button"
                aria-label="Zoom in"
                disabled={zoom >= ZOOM_MAX}
                onClick={() => zoomBy(ZOOM_STEP)}
                sx={zoomButtonSx}
              >
                +
              </Box>
            </>
          ) : null}
          <ColorTemplate6CloseX onClose={onClose} aria-label="Close zoom" positionSx={{ position: 'absolute', top: 10, right: 16 }} />
        </Box>
        <Box
          ref={measureStage}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={handleWheel}
          sx={{
            position: 'relative',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            cursor: isImage ? (dragging ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none',
            userSelect: 'none',
            ...(isImage ? null : { display: 'flex', alignItems: 'center', justifyContent: 'center', p: `${STAGE_MARGIN_PX}px` })
          }}
        >
          {isImage && imageUrl ? (
            <Box
              component="img"
              ref={captureNaturalSize}
              src={imageUrl}
              alt={attachment?.originalFileName || 'Receipt'}
              draggable={false}
              onLoad={(e) => setNaturalSize({ url: imageUrl, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              sx={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: natural ? displayW : 'auto',
                height: natural ? displayH : 'auto',
                maxWidth: 'none',
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
                visibility: natural ? 'visible' : 'hidden',
                boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                pointerEvents: 'none'
              }}
            />
          ) : null}
          {!isImage && attachment && paidRecordId ? (
            <BillReceiptAttachmentPreview paidRecordId={paidRecordId} attachment={attachment} mode="preview" fitContainer />
          ) : null}
        </Box>
      </Box>
    </Dialog>
  );
}

BillReceiptZoomViewer.propTypes = {
  open: PropTypes.bool,
  onClose: PropTypes.func,
  paidRecordId: PropTypes.number,
  attachment: PropTypes.object
};
