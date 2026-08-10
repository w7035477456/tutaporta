import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import BusyHourglass from 'ui-component/BusyHourglass';
import { fetchPhotoAlbumsNoteAttachmentBlob } from 'api/photoAlbumsFe';
import {
  PlaceTextPositionLabel,
  computePlaceTextContainedRect
} from './photoAlbumsPlaceTextPreviewShared';

const HOURGLASS = '2rem';

const MIME_BY_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4'
};

/**
 * Photo/video preview stage with draggable text labels (top half of Add Text dialog).
 */
export default function PhotoAlbumsPlaceTextMediaPreview({
  session = null,
  labels = [],
  activeKey = '',
  noteId = null,
  storageType = null,
  onActivate,
  onLabelChange,
  onLabelDelete,
  onDoubleClickLabel
}) {
  const stageRef = useRef(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
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
    return computePlaceTextContainedRect(stageSize.width, stageSize.height, aspect);
  }, [stageSize.width, stageSize.height, aspect]);

  useEffect(() => {
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
  }, [session]);

  useEffect(() => {
    if (!session) return undefined;
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
        const mime = MIME_BY_EXT[ext] || (session.isVideo ? 'video/mp4' : 'image/jpeg');
        const blob = await fetchPhotoAlbumsNoteAttachmentBlob(nid, attachmentId, {
          inline: true,
          storageType: storageType || undefined
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
  }, [session, noteId, storageType]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = '';
      }
    },
    []
  );

  if (!session) return null;

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
  onActivate: PropTypes.func,
  onLabelChange: PropTypes.func,
  onLabelDelete: PropTypes.func,
  onDoubleClickLabel: PropTypes.func
};
