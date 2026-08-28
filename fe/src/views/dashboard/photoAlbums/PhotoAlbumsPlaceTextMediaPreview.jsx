import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import BusyHourglass from 'ui-component/BusyHourglass';
import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import { mimeTypeForPhotoAlbumsVideoExtension } from 'utils/photoAlbumsFileFormats';
import { PlaceTextPositionLabel, computePlaceTextContainedRect } from './photoAlbumsPlaceTextPreviewShared';
import PlaceTextPanDragOverlay from './PlaceTextPanDragOverlay';
import {
  clampPhotoPan,
  coverSizeForFrame,
  fitSizeForFrame,
  photoSlotFitTransitionCss
} from './photoAlbumsSlotZoom';

const HOURGLASS = '2rem';

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp'
};

/**
 * Photo/video preview stage with draggable text labels (top half of Add Text dialog).
 * When the album photo is framed, renders pan/zoom like the album slot so slider + drag work live.
 */
export default function PhotoAlbumsPlaceTextMediaPreview({
  session = null,
  labels = [],
  activeKey = '',
  noteId = null,
  storageType = null,
  panZoomActive = false,
  photoFitAnimating = false,
  onNaturalAspectRatio = null,
  onPhotoChromeChange = null,
  onVideoElementChange = null,
  onActivate,
  onLabelChange,
  onLabelDelete,
  onDoubleClickLabel
}) {
  const stageRef = useRef(null);
  const mediaRef = useRef(null);
  const panDragRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [photoDisplayRect, setPhotoDisplayRect] = useState({ left: 0, top: 0, width: 1, height: 1 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const [objectUrl, setObjectUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [draggingPan, setDraggingPan] = useState(false);
  const objectUrlRef = useRef('');

  // Play/Pause + seek live in the dialog's action row, so hand the <video> node
  // up as it mounts. Kept in a ref so the callback ref identity stays stable.
  const onVideoElementChangeRef = useRef(onVideoElementChange);
  onVideoElementChangeRef.current = onVideoElementChange;
  const setVideoNode = useCallback((node) => {
    mediaRef.current = node;
    onVideoElementChangeRef.current?.(node || null);
  }, []);

  const photoRect = session?.photoRect;
  const pageFrameW = Math.max(1, Number(photoRect?.width) || 1);
  const pageFrameH = Math.max(1, Number(photoRect?.height) || 1);
  const hasFrame = Boolean(photoRect?.width && photoRect?.height);
  const labelPageWidth = pageFrameW;

  /**
   * Un-rotated aspect. Rotation is a CSS transform on the same element the photo
   * width/height size, so the box must stay at the photo's own aspect — the album
   * page sizes its slot the same way (photoAspectRatio ignores rotationDeg).
   */
  const naturalAspect = useMemo(() => {
    const nw = naturalSize.width;
    const nh = naturalSize.height;
    if (!(nw > 0 && nh > 0)) return 0;
    return nw / nh;
  }, [naturalSize.width, naturalSize.height]);

  const measureFrameRect = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const sr = stage.getBoundingClientRect();
    if (!sr.width || !sr.height) return;

    if (hasFrame) {
      const slotAspect = pageFrameW / pageFrameH;
      setPhotoDisplayRect(computePlaceTextContainedRect(sr.width, sr.height, slotAspect));
      return;
    }

    const media = mediaRef.current;
    const nw = Number(media?.naturalWidth || media?.videoWidth) || 0;
    const nh = Number(media?.naturalHeight || media?.videoHeight) || 0;
    if (!nw || !nh) return;
    let aspect = nw / nh;
    const rot = Number(session?.rotationDeg) || 0;
    if (Math.abs(rot) % 180 === 90) aspect = nh / nw;
    setPhotoDisplayRect(computePlaceTextContainedRect(sr.width, sr.height, aspect));
  }, [hasFrame, pageFrameW, pageFrameH, session?.rotationDeg]);

  const reportNaturalAspect = useCallback(() => {
    const media = mediaRef.current;
    const nw = Number(media?.naturalWidth || media?.videoWidth) || 0;
    const nh = Number(media?.naturalHeight || media?.videoHeight) || 0;
    if (!nw || !nh) return;
    setNaturalSize({ width: nw, height: nh });
    // Sizing aspect, not footprint aspect — see naturalAspect above.
    if (typeof onNaturalAspectRatio === 'function') onNaturalAspectRatio(nw / nh);
    measureFrameRect();
  }, [onNaturalAspectRatio, measureFrameRect]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setStageSize({ width: r.width, height: r.height });
      measureFrameRect();
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setStageSize({ width: r.width, height: r.height });
    measureFrameRect();
    return () => ro.disconnect();
  }, [measureFrameRect]);

  useEffect(() => {
    measureFrameRect();
  }, [
    objectUrl,
    stageSize.width,
    stageSize.height,
    session?.rotationDeg,
    session?.slotFit,
    measureFrameRect
  ]);

  const attachmentId = Number(session?.attachmentId) || 0;
  const fileExtension = String(session?.fileExtension || '');
  const isVideo = Boolean(session?.isVideo);

  useEffect(() => {
    if (!session) return undefined;
    const nid = Number(noteId);
    if (!(attachmentId >= 1) || !(nid >= 1)) {
      setError('Photo not available');
      setObjectUrl('');
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    (async () => {
      try {
        const ext = fileExtension.trim().toLowerCase().replace(/^\./, '');
        const mime = isVideo
          ? mimeTypeForPhotoAlbumsVideoExtension(ext)
          : MIME_BY_EXT[ext] || 'image/jpeg';
        const blob = await fetchPhotoAlbumsNoteAttachmentBlob(nid, attachmentId, {
          inline: true,
          storageType: storageType || undefined,
          variant: 'full'
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
  }, [attachmentId, noteId, storageType, fileExtension, isVideo]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    },
    []
  );

  const framedLayout = useMemo(() => {
    if (!hasFrame || !(naturalAspect > 0)) return null;
    const slotFit = String(session?.slotFit || 'cover').toLowerCase() === 'contain' ? 'contain' : 'cover';
    const fit = fitSizeForFrame(naturalAspect, pageFrameW, pageFrameH, slotFit);
    const photoW = Number.isFinite(Number(session?.photoW)) && Number(session.photoW) > 0
      ? Number(session.photoW)
      : fit.width;
    const storedH = Number.isFinite(Number(session?.photoH)) && Number(session.photoH) > 0
      ? Number(session.photoH)
      : 0;
    // The <img> is objectFit:'fill', so a stored width/height pair that disagrees with
    // the photo's own aspect renders stretched. Width is what the zoom slider drives,
    // so keep it and re-derive the height.
    const proportionalH = Math.round(photoW / naturalAspect);
    const storedHDrift = Math.abs(storedH - proportionalH);
    const photoH = storedH > 0 && storedHDrift <= Math.max(1, proportionalH * 0.01) ? storedH : proportionalH;
    const panX = Number.isFinite(Number(session?.panX))
      ? Number(session.panX)
      : (pageFrameW - photoW) / 2;
    const panY = Number.isFinite(Number(session?.panY))
      ? Number(session.panY)
      : (pageFrameH - photoH) / 2;
    const scale = photoDisplayRect.width / pageFrameW;
    return {
      photoW,
      photoH,
      panX,
      panY,
      scale,
      left: panX * scale,
      top: panY * scale,
      width: photoW * scale,
      height: photoH * scale
    };
  }, [
    hasFrame,
    naturalAspect,
    session?.slotFit,
    session?.photoW,
    session?.photoH,
    session?.panX,
    session?.panY,
    pageFrameW,
    pageFrameH,
    photoDisplayRect
  ]);

  const endPanDrag = useCallback(() => {
    panDragRef.current = null;
    setDraggingPan(false);
  }, []);

  const handlePanPointerDown = useCallback(
    (e) => {
      if (!panZoomActive || !framedLayout || isVideo) return;
      if (e.button != null && e.button !== 0) return;
      if (e.target?.closest?.('[data-place-text-label]')) return;
      e.preventDefault();
      e.stopPropagation();
      const scale = framedLayout.scale || 1;
      panDragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        originPanX: framedLayout.panX,
        originPanY: framedLayout.panY,
        photoW: framedLayout.photoW,
        photoH: framedLayout.photoH,
        scale
      };
      setDraggingPan(true);
      try {
        e.currentTarget.setPointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
    },
    [panZoomActive, framedLayout, isVideo]
  );

  const handlePanPointerMove = useCallback(
    (e) => {
      const drag = panDragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      const scale = drag.scale || 1;
      const dxPage = (e.clientX - drag.startX) / scale;
      const dyPage = (e.clientY - drag.startY) / scale;
      const next = clampPhotoPan(
        drag.originPanX + dxPage,
        drag.originPanY + dyPage,
        drag.photoW,
        drag.photoH,
        pageFrameW,
        pageFrameH
      );
      if (typeof onPhotoChromeChange === 'function') {
        onPhotoChromeChange({ panX: next.panX, panY: next.panY });
      }
    },
    [onPhotoChromeChange, pageFrameW, pageFrameH]
  );

  const handlePanPointerUp = useCallback(
    (e) => {
      const drag = panDragRef.current;
      if (!drag || (e.pointerId != null && drag.pointerId !== e.pointerId)) return;
      try {
        e.currentTarget.releasePointerCapture?.(e.pointerId);
      } catch {
        // ignore
      }
      endPanDrag();
    },
    [endPanDrag]
  );

  if (!session) return null;

  const rotationDeg = Number(session.rotationDeg) || 0;
  const showFramedPhoto = Boolean(framedLayout && objectUrl && !isVideo);

  return (
    <Box
      ref={stageRef}
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        border: '2px solid rgba(255,255,255,0.35)',
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
          {isVideo && objectUrl ? (
            hasFrame ? (
              <Box
                sx={{
                  position: 'absolute',
                  left: photoDisplayRect.left,
                  top: photoDisplayRect.top,
                  width: photoDisplayRect.width,
                  height: photoDisplayRect.height,
                  overflow: 'hidden',
                  bgcolor: '#000'
                }}
              >
                <Box
                  ref={setVideoNode}
                  component="video"
                  src={objectUrl}
                  playsInline
                  preload="metadata"
                  onLoadedMetadata={reportNaturalAspect}
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    display: 'block',
                    bgcolor: '#000'
                  }}
                />
              </Box>
            ) : (
              <Box
                ref={setVideoNode}
                component="video"
                src={objectUrl}
                playsInline
                preload="metadata"
                onLoadedMetadata={reportNaturalAspect}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  display: 'block',
                  bgcolor: '#000'
                }}
              />
            )
          ) : showFramedPhoto ? (
            <Box
              sx={{
                position: 'absolute',
                left: photoDisplayRect.left,
                top: photoDisplayRect.top,
                width: photoDisplayRect.width,
                height: photoDisplayRect.height,
                overflow: 'hidden',
                bgcolor: '#000'
              }}
            >
              <Box
                ref={mediaRef}
                component="img"
                src={objectUrl}
                alt={session.fileName || 'Photo'}
                onLoad={reportNaturalAspect}
                draggable={false}
                onPointerDown={handlePanPointerDown}
                onPointerMove={handlePanPointerMove}
                onPointerUp={handlePanPointerUp}
                onPointerCancel={handlePanPointerUp}
                sx={{
                  position: 'absolute',
                  left: framedLayout.left,
                  top: framedLayout.top,
                  width: framedLayout.width,
                  height: framedLayout.height,
                  objectFit: 'fill',
                  display: 'block',
                  transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
                  transformOrigin: 'center center',
                  transition:
                    photoFitAnimating && !draggingPan ? photoSlotFitTransitionCss : 'none',
                  userSelect: 'none',
                  cursor: panZoomActive ? (draggingPan ? 'grabbing' : 'grab') : 'default',
                  touchAction: panZoomActive ? 'none' : 'auto',
                  pointerEvents: 'auto'
                }}
              />
            </Box>
          ) : objectUrl ? (
            <Box
              ref={mediaRef}
              component="img"
              src={objectUrl}
              alt={session.fileName || 'Photo'}
              onLoad={reportNaturalAspect}
              sx={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transform: rotationDeg ? `rotate(${rotationDeg}deg)` : undefined,
                transformOrigin: 'center center',
                display: 'block',
                bgcolor: '#000',
                userSelect: 'none'
              }}
            />
          ) : null}

          {panZoomActive && !isVideo && !loading && !error && objectUrl ? (
            <Box
              onPointerDown={handlePanPointerDown}
              onPointerMove={handlePanPointerMove}
              onPointerUp={handlePanPointerUp}
              onPointerCancel={handlePanPointerUp}
              sx={{
                position: 'absolute',
                left: photoDisplayRect.left,
                top: photoDisplayRect.top,
                width: photoDisplayRect.width,
                height: photoDisplayRect.height,
                zIndex: 3,
                cursor: draggingPan ? 'grabbing' : 'grab',
                touchAction: 'none'
              }}
            >
              <PlaceTextPanDragOverlay />
            </Box>
          ) : null}

          {labels.map((label) => (
            <PlaceTextPositionLabel
              key={label.clientKey}
              label={label}
              photoDisplayRect={photoDisplayRect}
              pagePhotoWidth={labelPageWidth}
              active={label.clientKey === activeKey}
              onActivate={onActivate}
              onChange={onLabelChange}
              onDelete={onLabelDelete}
              onDoubleClickEdit={onDoubleClickLabel}
            />
          ))}
        </>
      )}
    </Box>
  );
}

PhotoAlbumsPlaceTextMediaPreview.propTypes = {
  session: PropTypes.object,
  labels: PropTypes.arrayOf(PropTypes.object),
  activeKey: PropTypes.string,
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  storageType: PropTypes.string,
  panZoomActive: PropTypes.bool,
  photoFitAnimating: PropTypes.bool,
  onNaturalAspectRatio: PropTypes.func,
  onPhotoChromeChange: PropTypes.func,
  onVideoElementChange: PropTypes.func,
  onActivate: PropTypes.func,
  onLabelChange: PropTypes.func,
  onLabelDelete: PropTypes.func,
  onDoubleClickLabel: PropTypes.func
};
