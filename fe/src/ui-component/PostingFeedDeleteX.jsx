import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import {
  postingFeedPhotoDeleteButtonSx,
  postingFeedPostDeleteButtonSx
} from 'config/postingFeedDeleteX';

/** Yellow outlined X — delete entire posting (top-right of post card). */
export function PostingFeedPostDeleteButton({ sx, disabled, onClick, 'aria-label': ariaLabel = 'Delete posting', ...props }) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      sx={{ ...postingFeedPostDeleteButtonSx(), ...(sx || {}) }}
      {...props}
    >
      X
    </Box>
  );
}

/** Yellow outlined X — delete one photo from a posting (top-right of photo). */
export function PostingFeedPhotoDeleteButton({ sx, disabled, onClick, 'aria-label': ariaLabel = 'Delete posting photo', ...props }) {
  return (
    <Box
      component="button"
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      sx={{ ...postingFeedPhotoDeleteButtonSx(), ...(sx || {}) }}
      {...props}
    >
      X
    </Box>
  );
}

PostingFeedPostDeleteButton.propTypes = {
  sx: PropTypes.object,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  'aria-label': PropTypes.string
};

PostingFeedPhotoDeleteButton.propTypes = {
  sx: PropTypes.object,
  disabled: PropTypes.bool,
  onClick: PropTypes.func,
  'aria-label': PropTypes.string
};
