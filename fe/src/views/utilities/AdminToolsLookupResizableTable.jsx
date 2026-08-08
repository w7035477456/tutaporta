import { useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ColorTemplate9TableData from 'ui-component/ColorTemplate9TableData';
import { writeStoredLookupColumnWidths } from 'utils/adminToolsLookupTableColumns';

const resizeHandleSx = {
  position: 'absolute',
  top: 0,
  right: -5,
  width: 10,
  height: '100%',
  cursor: 'col-resize',
  zIndex: 2,
  touchAction: 'none',
  '&:hover': {
    bgcolor: 'rgba(255, 255, 255, 0.18)'
  }
};

export function useLookupColumnResize({ columnWidths, setColumnWidths, columnIndex, minWidth, storageKey }) {
  return useCallback(
    (event) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth = columnWidths[columnIndex] ?? minWidth;

      const onMove = (moveEvent) => {
        const nextWidth = Math.max(minWidth, Math.trunc(startWidth + (moveEvent.clientX - startX)));
        setColumnWidths((prev) => {
          const next = [...prev];
          next[columnIndex] = nextWidth;
          return next;
        });
      };

      const onUp = () => {
        document.body.style.removeProperty('user-select');
        document.body.style.removeProperty('cursor');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        setColumnWidths((prev) => {
          writeStoredLookupColumnWidths(storageKey, prev);
          return prev;
        });
      };

      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [columnIndex, columnWidths, minWidth, setColumnWidths, storageKey]
  );
}

export function LookupResizableHeaderCell({
  children,
  resizable = false,
  onResizeStart,
  sx,
  ...rest
}) {
  return (
    <ColorTemplate9TableData.HeaderCell
      sx={{
        position: 'relative',
        ...(resizable ? { userSelect: 'none' } : null),
        ...sx
      }}
      {...rest}
    >
      {typeof children === 'string' ? (
        <Typography sx={{ fontWeight: 'inherit', color: 'inherit' }}>{children}</Typography>
      ) : (
        children
      )}
      {resizable ? (
        <Box
          component="span"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize column"
          onMouseDown={onResizeStart}
          sx={resizeHandleSx}
        />
      ) : null}
    </ColorTemplate9TableData.HeaderCell>
  );
}
