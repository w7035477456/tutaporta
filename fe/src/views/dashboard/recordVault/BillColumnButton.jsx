import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
import { BILL_SCHEDULE_INK, BILL_SCHEDULE_SURFACE } from './billScheduleTheme';
import { isBillRowAttachDrag } from './billRowDropAttach';

const RED = '#e53935';
const DROP_GREEN = '#2e7d32';

/**
 * Bill column control: white circle attach until notes or files exist,
 * then red receipt (note) icon. Hover enlarges (HOVER_MAGNIFY_FACTOR).
 * When onDropAttach is set, Mobile Upload thumbnails / computer files can be dropped on it.
 */
export default function BillColumnButton({ hasContent = false, onClick, onDropAttach, disabled = false, title }) {
  const scale = getHoverMagnifyFactor();
  const [dropActive, setDropActive] = useState(false);
  const dragDepthRef = useRef(0);
  const acceptsDrop = Boolean(onDropAttach) && !disabled;
  const baseLabel = title || (hasContent ? 'Open bill receipts' : 'Attach bill / receipt');
  const label = onDropAttach ? `${baseLabel} — or drop a photo here` : baseLabel;
  const noteStyle = hasContent;

  const dropHandlers = onDropAttach
    ? {
        onDragEnter: (e) => {
          if (!isBillRowAttachDrag(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          if (!acceptsDrop) return;
          dragDepthRef.current += 1;
          setDropActive(true);
        },
        onDragOver: (e) => {
          if (!isBillRowAttachDrag(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = acceptsDrop ? 'copy' : 'none';
        },
        onDragLeave: (e) => {
          if (!isBillRowAttachDrag(e.dataTransfer)) return;
          e.stopPropagation();
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
          if (dragDepthRef.current === 0) setDropActive(false);
        },
        onDrop: (e) => {
          if (!isBillRowAttachDrag(e.dataTransfer)) return;
          e.preventDefault();
          e.stopPropagation();
          dragDepthRef.current = 0;
          setDropActive(false);
          if (acceptsDrop) onDropAttach(e.dataTransfer);
        }
      }
    : {};

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
      {...dropHandlers}
      sx={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        border: `2px solid ${dropActive ? DROP_GREEN : BILL_SCHEDULE_INK}`,
        boxShadow: dropActive ? `0 0 0 3px ${DROP_GREEN}` : 'none',
        bgcolor: noteStyle ? RED : BILL_SCHEDULE_SURFACE,
        color: noteStyle ? '#fff' : BILL_SCHEDULE_INK,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled ? 'default' : 'pointer',
        p: 0,
        mx: 'auto',
        opacity: disabled ? 0.55 : 1,
        position: 'relative',
        zIndex: dropActive ? 2 : 'auto',
        transform: dropActive ? `scale(${scale})` : 'scale(1)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        '@media (hover: hover)': {
          '&:hover:not(:disabled)': {
            transform: `scale(${scale})`,
            zIndex: 2
          }
        }
      }}
    >
      {hasContent ? (
        <ReceiptLongIcon sx={{ fontSize: 22, color: '#fff', pointerEvents: 'none' }} />
      ) : (
        <AttachFileIcon sx={{ fontSize: 22, color: BILL_SCHEDULE_INK, transform: 'rotate(45deg)', pointerEvents: 'none' }} />
      )}
    </Box>
  );
}

BillColumnButton.propTypes = {
  hasContent: PropTypes.bool,
  onClick: PropTypes.func,
  onDropAttach: PropTypes.func,
  disabled: PropTypes.bool,
  title: PropTypes.string
};
