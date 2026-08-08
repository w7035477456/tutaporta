import PropTypes from 'prop-types';
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import {
  getFontAwesome5ObjectIconDefinition,
  getFontAwesome5ObjectIconNames
} from 'utils/fontAwesome5ObjectIcons';
import { formatIconDisplayName } from 'utils/formatIconDisplayName';
import RecordVaultSecurityIconGlyph, {
  RECORD_VAULT_HOURGLASS_ICON_NAME
} from './RecordVaultSecurityIconGlyph';

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
  maxHeight = null
}) {
  const iconNames = useMemo(() => getFontAwesome5ObjectIconNames(), []);

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
          const definition = isHourglass ? true : getFontAwesome5ObjectIconDefinition(iconName);
          if (!definition) return null;
          const selected = selectedIcon === iconName;
          const label = formatIconDisplayName(iconName);
          return (
            <Tooltip
              key={iconName}
              title={label}
              placement="bottom"
              arrow
              slotProps={securityIconTooltipSlotProps}
            >
              <Box
                component="button"
                type="button"
                aria-label={`Select security icon ${label}`}
                disabled={disabled}
                onClick={() => onSelectIcon?.(iconName)}
                sx={{
                  width: '100%',
                  maxWidth: RECORD_VAULT_ICON_PICKER_CELL_PX,
                  aspectRatio: '1 / 1',
                  height: 'auto',
                  minHeight: RECORD_VAULT_ICON_PICKER_CELL_PX,
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
                <RecordVaultSecurityIconGlyph iconName={iconName} sizePx={24} />
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
  maxHeight: PropTypes.oneOfType([PropTypes.object, PropTypes.number, PropTypes.string])
};
