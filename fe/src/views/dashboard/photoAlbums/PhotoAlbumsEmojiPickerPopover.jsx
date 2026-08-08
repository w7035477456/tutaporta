import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import { PHOTO_ALBUMS_EMOJI_PALETTE } from './photoAlbumsEmojiPalette';

/**
 * Click-open emoji grid. Choosing an emoji calls onPick and the parent closes.
 */
export default function PhotoAlbumsEmojiPickerPopover({ open, anchorEl, onClose, onPick }) {
  return (
    <Popover
      open={Boolean(open && anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      disableRestoreFocus
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: {
            p: 1.25,
            maxWidth: { xs: 320, sm: 420, md: 520 },
            maxHeight: { xs: 280, sm: 360 },
            overflow: 'auto',
            border: '3px solid #000',
            borderRadius: 1,
            bgcolor: '#fff',
            boxShadow: '0 8px 28px rgba(0,0,0,0.35)'
          }
        }
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(8, 1fr)',
            sm: 'repeat(10, 1fr)',
            md: 'repeat(12, 1fr)'
          },
          gap: 0.35
        }}
      >
        {PHOTO_ALBUMS_EMOJI_PALETTE.map((em, idx) => (
          <Box
            key={`${idx}-${em}`}
            component="button"
            type="button"
            title={em}
            aria-label={`Place emoji ${em}`}
            onMouseDown={(e) => {
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPick?.(em, e);
            }}
            sx={{
              minWidth: 0,
              width: '100%',
              aspectRatio: '1 / 1',
              p: 0,
              m: 0,
              border: '1px solid transparent',
              borderRadius: 0.75,
              bgcolor: 'transparent',
              fontSize: { xs: '1.35rem', sm: '1.55rem', md: '1.7rem' },
              lineHeight: 1,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover': {
                bgcolor: 'rgba(25,118,210,0.12)',
                borderColor: '#1976d2'
              }
            }}
          >
            {em}
          </Box>
        ))}
      </Box>
    </Popover>
  );
}

PhotoAlbumsEmojiPickerPopover.propTypes = {
  open: PropTypes.bool,
  anchorEl: PropTypes.any,
  onClose: PropTypes.func,
  onPick: PropTypes.func
};
