import { useRef } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { normalizeImageRotation } from './recordVaultImageRotation';
import { useRotatedImageBox } from './recordVaultImageLayout';

/**
 * Renders a picture at 0 / 90 / 180 / 270 degrees inside a note.
 *
 * A CSS rotation alone does not resize the element's box, so a wide scan turned
 * upright would overflow sideways. This frames the image with its turned
 * footprint (`recordVaultImageLayout`) and scales it down to fit the pane.
 *
 * Used by the inline vault-file image preview (e.g. a scanned letter shot
 * sideways) and by any other in-note picture that needs turning.
 */
export default function RecordVaultRotateFrame({ src, alt = '', rotation = 0, preferredWidth, maxHeight, imgSx, frameSx }) {
  const imgRef = useRef(null);
  const containerRef = useRef(null);
  const angle = normalizeImageRotation(rotation);

  const { quarterTurn, box, imgWidth } = useRotatedImageBox({
    imageRef: imgRef,
    containerRef,
    rotation: angle,
    preferredWidth,
    maxHeight
  });

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'relative',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...frameSx
      }}
    >
      <Box
        className={`rv-rotate-frame__box${quarterTurn ? ' is-turned' : ''}`}
        sx={{
          position: 'relative',
          display: quarterTurn ? 'flex' : 'block',
          alignItems: 'center',
          justifyContent: 'center',
          maxWidth: '100%',
          lineHeight: 0,
          ...(box ? { width: box.width, height: box.height } : null)
        }}
      >
        <Box
          component="img"
          ref={imgRef}
          src={src}
          alt={alt}
          sx={{
            display: 'block',
            height: 'auto',
            objectFit: 'contain',
            objectPosition: 'center',
            ...imgSx,
            // Layout-driven values go last so they win over caller cosmetics.
            width: box || imgWidth ? `${imgWidth}px` : imgSx?.width,
            maxWidth: quarterTurn ? 'none' : '100%',
            ...(quarterTurn ? { maxHeight: 'none' } : null),
            ...(angle ? { transform: `rotate(${angle}deg)` } : null)
          }}
        />
      </Box>
    </Box>
  );
}

RecordVaultRotateFrame.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  /** 0 / 90 / 180 / 270 — other values snap to the nearest quarter turn. */
  rotation: PropTypes.number,
  /** Fixed width before rotation (defaults to the container width). */
  preferredWidth: PropTypes.number,
  /** Height cap applied before rotation. */
  maxHeight: PropTypes.number,
  /** Styles for the <img> itself (object-fit, background…). */
  imgSx: PropTypes.object,
  /** Styles for the outer framing box. */
  frameSx: PropTypes.object
};
