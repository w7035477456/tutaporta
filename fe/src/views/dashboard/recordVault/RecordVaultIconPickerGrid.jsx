import PropTypes from 'prop-types';
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { getFontAwesome5ObjectIconDefinition, getFontAwesome5ObjectIconNames } from 'utils/fontAwesome5ObjectIcons';
import { formatIconDisplayName } from 'utils/formatIconDisplayName';
import { isBillCompositeIconName } from 'utils/billCompositeIcons';
import RecordVaultSecurityIconGlyph, { RECORD_VAULT_HOURGLASS_ICON_NAME } from './RecordVaultSecurityIconGlyph';

/** Fixed column count — icon decrypt grids always show 10 icons per row. */
export const RECORD_VAULT_ICON_PICKER_COLUMNS = 10;
export const RECORD_VAULT_ICON_PICKER_CELL_PX = 44;
export const RECORD_VAULT_ICON_PICKER_GAP_PX = 8;

const securityIconTooltipSlotProps = {
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
  ariaLabelPrefix = 'Select security icon',
  pinnedIcons = null,
  cellScale = 1,
  fillIcons = null
}) {
  const iconNames = useMemo(() => {
    const all = getFontAwesome5ObjectIconNames();
    if (!pinnedIcons?.length) return all;
    const pinned = pinnedIcons.filter((name) => all.includes(name) || isBillCompositeIconName(name));
    return [...pinned, ...all.filter((name) => !pinned.includes(name))];
  }, [pinnedIcons]);

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
          const label = formatIconDisplayName(iconName);
          const cellPx = Math.round(RECORD_VAULT_ICON_PICKER_CELL_PX * cellScale);
          // Fill icons reach almost to the 2px border; the rest keep the normal icon-to-box ratio.
          const glyphPx = fillIcons?.includes(iconName) ? cellPx - 10 : Math.round(24 * cellScale);
          return (
            <Tooltip key={iconName} title={label} placement="bottom" arrow slotProps={securityIconTooltipSlotProps}>
              <Box
                component="button"
                type="button"
                aria-label={`${ariaLabelPrefix} ${label}`}
                disabled={disabled}
                onClick={() => onSelectIcon?.(iconName)}
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
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.55 : 1,
                  p: 0
                }}
              >
                <RecordVaultSecurityIconGlyph iconName={iconName} sizePx={glyphPx} />
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
  fillIcons: PropTypes.arrayOf(PropTypes.string)
};
