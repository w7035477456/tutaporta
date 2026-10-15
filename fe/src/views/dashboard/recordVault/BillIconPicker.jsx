import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import RecordVaultIconPickerGrid from './RecordVaultIconPickerGrid';
import RecordVaultSecurityIconGlyph from './RecordVaultSecurityIconGlyph';
import { BILL_SCHEDULE_INK } from './billScheduleTheme';

/** Common bill icons — the first 10 fill row 1 of the Bill Icon tray, the next 10 fill row 2, then row 3 leads with the rest. */
const BILL_ICON_PINNED = [
  'mortgage',
  'home-insurance',
  'car-smog-check',
  'utility-bill',
  'anniversary',
  'birthday-cake',
  'annual-health-checkup',
  'online-bill',
  'tax-bill',
  'car-safety-inspection',
  'archive',
  'university',
  'search',
  'lightbulb',
  'pen-nib',
  'anchor',
  'fire-alt',
  'ambulance',
  'taxi',
  'car',
  'internet-bill'
];

/** Row 1 of the tray — fills its tray box, and is drawn 50% bigger in the Bill Schedule icon column. */
const BILL_ICON_FEATURED = BILL_ICON_PINNED.slice(0, 10);
const BILL_ICON_FEATURED_SCALE = 1.5;
/** Every tray box + icon is 50% bigger than the security-icon grid. */
const BILL_ICON_TRAY_SCALE = 1.5;

/** Grid scrolls inside the popup so title + Clear stay visible and the popup fits the screen. */
const billIconTrayScrollSx = {
  maxHeight: 'calc(min(92vh, 100vh - 24px) - 260px)',
  overflowY: 'auto',
  overflowX: 'hidden',
  pr: 1.5,
  py: 0.5,
  boxSizing: 'border-box',
  scrollbarWidth: 'auto',
  scrollbarColor: 'var(--theme-yellow-color) rgba(0,0,0,0.25)',
  '&::-webkit-scrollbar': { width: 14 },
  '&::-webkit-scrollbar-track': { bgcolor: 'rgba(0,0,0,0.25)', borderRadius: 7 },
  '&::-webkit-scrollbar-thumb': {
    bgcolor: 'var(--theme-yellow-color)',
    borderRadius: 7,
    border: '2px solid #000'
  }
};
const BILL_ICON_CELL_GLYPH_PX = 26;
const BILL_ICON_CELL_PX = 36;

/** Bill Schedule icon column — the row's picked icon, or a big "?" until one is chosen. */
export function BillIconCell({ iconName, disabled = false, onClick }) {
  const featured = BILL_ICON_FEATURED.includes(iconName);
  const glyphPx = Math.round(BILL_ICON_CELL_GLYPH_PX * (featured ? BILL_ICON_FEATURED_SCALE : 1));
  const cellPx = Math.max(BILL_ICON_CELL_PX, glyphPx + 4);
  return (
    <Box
      component="button"
      type="button"
      aria-label={iconName ? `Bill icon ${iconName} — click to change` : 'Choose a bill icon'}
      title={iconName ? 'Change icon' : 'Choose an icon (car, house, …)'}
      disabled={disabled}
      onClick={onClick}
      sx={{
        width: cellPx,
        height: cellPx,
        p: 0,
        border: 'none',
        bgcolor: 'transparent',
        color: BILL_SCHEDULE_INK,
        WebkitTextFillColor: BILL_SCHEDULE_INK,
        cursor: disabled ? 'default' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.9rem',
        fontWeight: 900,
        lineHeight: 1,
        transition: 'transform 0.15s ease',
        '&:hover:not(:disabled)': { transform: 'scale(1.2)' }
      }}
    >
      {iconName ? <RecordVaultSecurityIconGlyph iconName={iconName} sizePx={glyphPx} /> : '?'}
    </Box>
  );
}

BillIconCell.propTypes = {
  iconName: PropTypes.string,
  disabled: PropTypes.bool,
  onClick: PropTypes.func
};

/** Tray of the security icon set — picking one applies it to the bill row and closes. */
export function BillIconPickerDialog({ open, selectedIcon, onSelect, onClose }) {
  return (
    <ColorTemplate7PopupLargeDark open={open} onClose={onClose} closeOnBackdrop>
      <ColorTemplate7PopupLargeDark.Body>
        <ColorTemplate7PopupLargeDark.Title>Bill Icon</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>
          Pick an icon for this bill — e.g. a car for auto insurance, a house for home insurance or mortgage.
        </ColorTemplate7PopupLargeDark.BodyText>
        {selectedIcon ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%', mb: 1 }}>
            <ColorTemplate7PopupLargeDark.ActionButton onClick={() => onSelect?.(null)}>
              Clear icon (show ?)
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Box>
        ) : null}
        <RecordVaultIconPickerGrid
          selectedIcon={selectedIcon || ''}
          onSelectIcon={(iconName) => onSelect?.(iconName)}
          ariaLabelPrefix="Select bill icon"
          pinnedIcons={BILL_ICON_PINNED}
          cellScale={BILL_ICON_TRAY_SCALE}
          fillIcons={BILL_ICON_FEATURED}
          maxHeight={billIconTrayScrollSx}
        />
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

BillIconPickerDialog.propTypes = {
  open: PropTypes.bool,
  selectedIcon: PropTypes.string,
  onSelect: PropTypes.func,
  onClose: PropTypes.func
};
