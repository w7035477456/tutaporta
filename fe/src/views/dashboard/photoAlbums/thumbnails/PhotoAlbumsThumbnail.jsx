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

/** One vault attachment thumbnail (image, or video poster/clip), with a filename placeholder. */
export default function PhotoAlbumsThumbnail({ noteId, attachmentId, storageType = null, label = '' }) {
  const { status, url, mimeType, reportBroken } = usePhotoAlbumsThumbnail({ noteId, attachmentId, storageType });

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
          style={{ ...MEDIA_STYLE, background: '#000' }}
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
        style={MEDIA_STYLE}
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
  label: PropTypes.string
};
