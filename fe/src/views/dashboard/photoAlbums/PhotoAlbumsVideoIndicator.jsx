import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import videoIndicatorImg from 'assets/images/videoIcon.png';

/** Top-left MP4 / video badge for staging thumbs and album-page slots. */
export default function PhotoAlbumsVideoIndicator({
  size = 24,
  sx = null,
  onClick = null,
  title = 'Open video in a new tab'
}) {
  const px = Math.max(12, Math.round(Number(size) || 24));
  const clickable = typeof onClick === 'function';
  return (
    <Box
      component="img"
      src={videoIndicatorImg}
      alt=""
      aria-hidden={!clickable}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? title : undefined}
      title={clickable ? title : undefined}
      draggable={false}
      className="rv-album-video-indicator"
      onClick={
        clickable
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onClick(event);
            }
          : undefined
      }
      onMouseDown={
        clickable
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : undefined
      }
      onKeyDown={
        clickable
          ? (event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              onClick(event);
            }
          : undefined
      }
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: px,
        height: px,
        objectFit: 'contain',
        pointerEvents: clickable ? 'auto' : 'none',
        cursor: clickable ? 'pointer' : 'default',
        userSelect: 'none',
        zIndex: 21,
        ...sx
      }}
    />
  );
}

PhotoAlbumsVideoIndicator.propTypes = {
  size: PropTypes.number,
  sx: PropTypes.object,
  onClick: PropTypes.func,
  title: PropTypes.string
};
