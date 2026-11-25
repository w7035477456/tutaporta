import PropTypes from 'prop-types';
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { getFontAwesome5ObjectIconDefinition, getFontAwesome5ObjectIconNames } from 'utils/fontAwesome5ObjectIcons';
import { formatIconDisplayName } from 'utils/formatIconDisplayName';
import { isBillCompositeIconName } from 'utils/billCompositeIcons';
import RecordVaultIconGlyph, { RECORD_VAULT_HOURGLASS_ICON_NAME } from './RecordVaultIconGlyph';

/** Fixed column count — icon decrypt grids always show 10 icons per row. */
export const RECORD_VAULT_ICON_PICKER_COLUMNS = 10;
export const RECORD_VAULT_ICON_PICKER_CELL_PX = 44;
export const RECORD_VAULT_ICON_PICKER_GAP_PX = 8;

const ICON_DRAG_MIME = 'application/x-tutanotes-icon';

/** Move `dragged` onto `target`'s spot (items between shift by one). */
export function moveIconInOrder(order, dragged, target) {
  const from = order.indexOf(dragged);
  const to = order.indexOf(target);
  if (from < 0 || to < 0 || from === to) return order;
  const next = order.filter((n) => n !== dragged);
  next.splice(to, 0, dragged);
  return next;
}

const iconTooltipSlotProps = {
  tooltip: {
    sx: {
      bgcolor: 'var(--theme-yellow-color)',
      color: '#000',
      fontSize: '1.5rem',
      fontWeight: 700,
      lineHeight: 1.25,
      px: 2,
      py: 1,
      maxWidth: 'none',
      border: '2px solid #000',
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
      '& .MuiTooltip-arrow': {
        color: 'var(--theme-yellow-color)',
        '&::before': {
          border: '2px solid #000'
        }
      }
    }
  }
};

export default function RecordVaultIconPickerGrid({
  selectedIcon,
  onSelectIcon,
  disabled = false,
  maxHeight = null,
  ariaLabelPrefix = 'Select icon',
  pinnedIcons = null,
  cellScale = 1,
  fillIcons = null,
  iconOrder = null,
  onReorder = null
}) {
  const defaultNames = useMemo(() => {
    const all = getFontAwesome5ObjectIconNames();
    if (!pinnedIcons?.length) return all;
    const pinned = pinnedIcons.filter((name) => all.includes(name) || isBillCompositeIconName(name));
    return [...pinned, ...all.filter((name) => !pinned.includes(name))];
  }, [pinnedIcons]);

  /** Saved order first (unknown names dropped), then any icon not in it yet. */
  const iconNames = useMemo(() => {
    if (!iconOrder?.length) return defaultNames;
    const known = new Set(defaultNames);
    const saved = iconOrder.filter((n) => known.has(n));
    const savedSet = new Set(saved);
    return [...saved, ...defaultNames.filter((n) => !savedSet.has(n))];
  }, [defaultNames, iconOrder]);

  const canDrag = Boolean(onReorder) && !disabled;
  const [dragName, setDragName] = useState(null);
  const [overName, setOverName] = useState(null);

  const dropOn = (target, e) => {
    e.preventDefault();
    const dragged = e.dataTransfer.getData(ICON_DRAG_MIME) || dragName;
    setDragName(null);
    setOverName(null);
    if (!dragged || dragged === target) return;
    const next = moveIconInOrder(iconNames, dragged, target);
    if (next !== iconNames) onReorder(next);
  };

  return (
    <Box
      sx={{
        width: '100%',
        minHeight: 0,
        ...(maxHeight != null ? maxHeight : null)
      }}
    >
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${RECORD_VAULT_ICON_PICKER_COLUMNS}, minmax(0, 1fr))`,
          gap: `${RECORD_VAULT_ICON_PICKER_GAP_PX}px`,
          justifyItems: 'center',
          width: '100%'
        }}
      >
        {iconNames.map((iconName) => {
          const isHourglass = iconName === RECORD_VAULT_HOURGLASS_ICON_NAME;
          const definition = isHourglass || isBillCompositeIconName(iconName) ? true : getFontAwesome5ObjectIconDefinition(iconName);
          if (!definition) return null;
          const selected = selectedIcon === iconName;
          const dropTarget = canDrag && overName === iconName && dragName && dragName !== iconName;
          const label = formatIconDisplayName(iconName);
          const cellPx = Math.round(RECORD_VAULT_ICON_PICKER_CELL_PX * cellScale);
          // Fill icons reach almost to the 2px border; the rest keep the normal icon-to-box ratio.
          const glyphPx = fillIcons?.includes(iconName) ? cellPx - 10 : Math.round(24 * cellScale);
          return (
            <Tooltip key={iconName} title={label} placement="bottom" arrow slotProps={iconTooltipSlotProps}>
              <Box
                component="button"
                type="button"
                aria-label={`${ariaLabelPrefix} ${label}`}
                disabled={disabled}
                onClick={() => onSelectIcon?.(iconName)}
                draggable={canDrag}
                onDragStart={
                  canDrag
                    ? (e) => {
                        e.dataTransfer.setData(ICON_DRAG_MIME, iconName);
                        e.dataTransfer.effectAllowed = 'move';
                        setDragName(iconName);
                      }
                    : undefined
                }
                onDragEnd={
                  canDrag
                    ? () => {
                        setDragName(null);
                        setOverName(null);
                      }
                    : undefined
                }
                onDragOver={
                  canDrag
                    ? (e) => {
                        if (!dragName) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (overName !== iconName) setOverName(iconName);
                      }
                    : undefined
                }
                onDrop={canDrag ? (e) => dropOn(iconName, e) : undefined}
                sx={{
                  width: '100%',
                  maxWidth: cellPx,
                  aspectRatio: '1 / 1',
                  height: 'auto',
                  minHeight: cellPx,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid',
                  borderColor: selected ? '#c62828' : 'var(--theme-inverse-daynight-color)',
                  borderRadius: 1,
                  bgcolor: selected ? '#c62828' : 'transparent',
                  color: selected ? '#fff' : 'var(--theme-inverse-daynight-color)',
                  cursor: disabled ? 'not-allowed' : canDrag ? 'grab' : 'pointer',
                  opacity: disabled ? 0.55 : dragName === iconName ? 0.35 : 1,
                  outline: dropTarget ? '3px dashed #c62828' : 'none',
                  outlineOffset: 2,
                  p: 0
                }}
              >
                <RecordVaultIconGlyph iconName={iconName} sizePx={glyphPx} />
              </Box>
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
}

RecordVaultIconPickerGrid.propTypes = {
  selectedIcon: PropTypes.string,
  onSelectIcon: PropTypes.func,
  disabled: PropTypes.bool,
  maxHeight: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.string]),
  ariaLabelPrefix: PropTypes.string,
  /** Icon names shown first (in this order); the rest stay alphabetical. */
  pinnedIcons: PropTypes.arrayOf(PropTypes.string),
  /** Scales every cell and its icon (1 = 44px cells, 24px icons). */
  cellScale: PropTypes.number,
  /** Icon names whose glyph fills its cell almost to the border. */
  fillIcons: PropTypes.arrayOf(PropTypes.string),
  /** Saved per-user order (icon names); icons missing from it follow in default order. */
  iconOrder: PropTypes.arrayOf(PropTypes.string),
  /** Set → icons can be dragged onto another icon's spot; called with the full new order. */
  onReorder: PropTypes.func
};
