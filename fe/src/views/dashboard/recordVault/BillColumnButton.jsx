import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
import { BILL_SCHEDULE_INK, BILL_SCHEDULE_SURFACE } from './billScheduleTheme';

const RED = '#e53935';

/**
 * Bill column control: white circle attach until notes or files exist,
 * then red receipt (note) icon. Hover enlarges (HOVER_MAGNIFY_FACTOR).
 */
export default function BillColumnButton({ hasContent = false, onClick, disabled = false, title }) {
  const scale = getHoverMagnifyFactor();
  const label = title || (hasContent ? 'Open bill receipts' : 'Attach bill / receipt');
  const noteStyle = hasContent;
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
        border: `2px solid ${BILL_SCHEDULE_INK}`,
        bgcolor: noteStyle ? RED : BILL_SCHEDULE_SURFACE,
        color: noteStyle ? '#fff' : BILL_SCHEDULE_INK,
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
        <AttachFileIcon sx={{ fontSize: 22, color: BILL_SCHEDULE_INK, transform: 'rotate(45deg)' }} />
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
