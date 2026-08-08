import Box from '@mui/material/Box';
import greencheck from 'assets/images/greencheck.png';

/** Custom radio face: greencheck.png when selected, empty circle otherwise. */
export default function TutaPhotoAlbumsRadioMark({ selected = false, disabled = false }) {
  if (selected) {
    return (
      <Box
        component="img"
        src={greencheck}
        alt=""
        aria-hidden
        sx={{
          width: 20,
          height: 20,
          flexShrink: 0,
          borderRadius: '50%',
          objectFit: 'cover',
          display: 'block',
          opacity: disabled ? 0.55 : 1,
          pointerEvents: 'none'
        }}
      />
    );
  }

  return (
    <Box
      aria-hidden
      sx={{
        width: 20,
        height: 20,
        flexShrink: 0,
        borderRadius: '50%',
        boxSizing: 'border-box',
        bgcolor: '#fff',
        border: '2px solid rgba(0, 0, 0, 0.45)',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: 'none'
      }}
    />
  );
}

/** Visually hide native radio; keep it for a11y / form behavior. */
export const tutaPhotoAlbumsNativeRadioInputSx = {
  position: 'absolute',
  opacity: 0,
  width: 20,
  height: 20,
  margin: 0,
  inset: 0,
  cursor: 'pointer'
};

export const tutaPhotoAlbumsRadioControlWrapSx = {
  position: 'relative',
  width: 20,
  height: 20,
  flexShrink: 0
};
