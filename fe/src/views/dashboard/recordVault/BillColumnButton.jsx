import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';

const GREEN = '#2e7d32';

/**
 * Bill column control: green circle attach (+/paperclip) until notes or files exist,
 * then receipt icon. Hover enlarges 25% (HOVER_MAGNIFY_FACTOR).
 */
export default function BillColumnButton({ hasContent = false, onClick, disabled = false, title }) {
  const scale = getHoverMagnifyFactor();
  const label = title || (hasContent ? 'Open bill receipts' : 'Attach bill / receipt');
  return (
    <Box
      component="button"
      type="button"
      disabled={disabled}
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) onClick?.(e);
      }}
      sx={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: '2px solid #000',
        bgcolor: GREEN,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        p: 0,
        mx: 'auto',
        opacity: disabled ? 0.55 : 1,
        transform: 'scale(1)',
        transition: 'transform 0.15s ease',
        '@media (hover: hover)': {
          '&:hover:not(:disabled)': {
            transform: `scale(${scale})`,
            zIndex: 2
          }
        }
      }}
    >
      {hasContent ? (
        <ReceiptLongIcon sx={{ fontSize: 22, color: '#fff' }} />
      ) : (
        <AttachFileIcon sx={{ fontSize: 22, color: '#fff', transform: 'rotate(45deg)' }} />
      )}
    </Box>
  );
}

BillColumnButton.propTypes = {
  hasContent: PropTypes.bool,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  title: PropTypes.string
};
