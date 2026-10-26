import PropTypes from 'prop-types';
import usePhotoAlbumsThumbnail from './usePhotoAlbumsThumbnail';

const MEDIA_STYLE = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
  pointerEvents: 'none',
  userSelect: 'none'
};

/**
 * One vault attachment thumbnail (image, or video poster/clip), with a filename placeholder.
 * `fallbackCache`: tried once when `cache` cannot load this attachment.
 */
export default function PhotoAlbumsThumbnail({
  noteId,
  attachmentId,
  storageType = null,
  label = '',
  cache,
  fallbackCache = null,
  objectFit = 'cover'
}) {
  const { status, url, mimeType, reportBroken } = usePhotoAlbumsThumbnail({
    noteId,
    attachmentId,
    storageType,
    ...(cache ? { cache } : null)
  });
  const mediaStyle = objectFit === 'cover' ? MEDIA_STYLE : { ...MEDIA_STYLE, objectFit };

  if (status === 'error' && fallbackCache && fallbackCache !== cache) {
    return (
      <PhotoAlbumsThumbnail
        noteId={noteId}
        attachmentId={attachmentId}
        storageType={storageType}
        label={label}
        cache={fallbackCache}
        objectFit={objectFit}
      />
    );
  }

  if (status === 'ready' && url) {
    if (/^video\//i.test(mimeType)) {
      return (
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          draggable={false}
          onError={reportBroken}
          data-pa-thumb-status="ready"
          style={{ ...mediaStyle, background: '#000' }}
        />
      );
    }
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        onError={reportBroken}
        onLoad={(event) => {
          const img = event.currentTarget;
          if (img.naturalWidth < 1 || img.naturalHeight < 1) reportBroken();
        }}
        data-pa-thumb-status="ready"
        style={mediaStyle}
      />
    );
  }

  return (
    <span
      data-pa-thumb-status={status}
      style={{
        fontSize: '0.65rem',
        fontWeight: 700,
        padding: 4,
        color: status === 'error' ? '#c62828' : '#444',
        lineHeight: 1.2,
        pointerEvents: 'none',
        userSelect: 'none',
        display: 'block',
        wordBreak: 'break-all'
      }}
    >
      {status === 'loading' ? `Loading… ${label}` : label}
    </span>
  );
}

PhotoAlbumsThumbnail.propTypes = {
  noteId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  attachmentId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired,
  storageType: PropTypes.string,
  label: PropTypes.string,
  /** Defaults to the shared tray thumbnail cache. */
  cache: PropTypes.object,
  fallbackCache: PropTypes.object,
  objectFit: PropTypes.oneOf(['cover', 'contain'])
};
