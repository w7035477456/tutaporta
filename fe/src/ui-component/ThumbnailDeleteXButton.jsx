import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import deleteXImg from 'assets/images/x.png';
import { guestDemoBlockProps } from 'utils/guestDemoLogin';

/** Top-right delete control on photo / video thumbnails — uses assets/images/x.png. */
export default function ThumbnailDeleteXButton({
  sx,
  disabled = false,
  onClick,
  onMouseDown,
  'aria-label': ariaLabel = 'Delete',
  ...props
}) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      onMouseDown={onMouseDown}
      {...guestDemoBlockProps()}
      sx={{
        position: 'absolute',
        top: 2,
        right: 2,
        zIndex: 10,
        width: { xs: 24, sm: 28 },
        height: { xs: 24, sm: 28 },
        minWidth: 0,
        p: 0,
        m: 0,
        border: 'none',
        bgcolor: 'transparent',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 0,
        transformOrigin: 'top right',
        ...(sx || {})
      }}
      {...props}
    >
      <Box
        component="img"
        src={deleteXImg}
        alt=""
        aria-hidden
        draggable={false}
        sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
      />
    </Box>
  );
}

ThumbnailDeleteXButton.propTypes = {
  sx: PropTypes.object,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  onMouseDown: PropTypes.func,
  'aria-label': PropTypes.string
};
