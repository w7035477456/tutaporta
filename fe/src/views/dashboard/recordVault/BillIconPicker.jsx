import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import api from 'api/axios';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import RecordVaultIconPickerGrid from './RecordVaultIconPickerGrid';
import RecordVaultIconGlyph from './RecordVaultIconGlyph';
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
  'auto-insurance',
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

/** Row 1 of the tray + auto insurance — fill their tray box, and are drawn 50% bigger in the Bill Schedule icon column. */
const BILL_ICON_FEATURED = [...BILL_ICON_PINNED.slice(0, 10), 'auto-insurance'];
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
      {iconName ? <RecordVaultIconGlyph iconName={iconName} sizePx={glyphPx} /> : '?'}
    </Box>
  );
}

BillIconCell.propTypes = {
  iconName: PropTypes.string,
  disabled: PropTypes.bool,
  onClick: PropTypes.func
};

/**
 * Tray of the bill icon set — picking one applies it to the bill row and closes.
 * Dragging an icon onto another spot rearranges the tray; the order is saved per user
 * (mynote_ui_pref.bill_icon_order) and shared by Monthly / Yearly / Subscription.
 */
export function BillIconPickerDialog({ open, selectedIcon, onSelect, onClose }) {
  const [iconOrder, setIconOrder] = useState(null);
  const [orderMsg, setOrderMsg] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setOrderMsg('');
    api
      .get('/api/mynoteUiPref')
      .then(({ data }) => {
        if (!cancelled) setIconOrder(Array.isArray(data?.bill_icon_order) ? data.bill_icon_order : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  const saveOrder = (order) => {
    setIconOrder(order);
    setOrderMsg('');
    api.put('/api/mynoteUiPref/billIconOrder', { order }).catch((err) => {
      setOrderMsg(err?.response?.data?.error || 'Could not save the icon order');
    });
  };

  return (
    <ColorTemplate7PopupLargeDark open={open} onClose={onClose} closeOnBackdrop>
      <ColorTemplate7PopupLargeDark.Body>
        <ColorTemplate7PopupLargeDark.Title>Bill Icon</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>
          Pick an icon for this bill — e.g. a car for auto insurance, a house for home insurance or mortgage. Drag an icon onto another spot
          to rearrange; your order is saved.
        </ColorTemplate7PopupLargeDark.BodyText>
        {selectedIcon || iconOrder ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, width: '100%', mb: 1 }}>
            {selectedIcon ? (
              <ColorTemplate7PopupLargeDark.ActionButton onClick={() => onSelect?.(null)}>
                Clear icon (show ?)
              </ColorTemplate7PopupLargeDark.ActionButton>
            ) : null}
            {iconOrder ? (
              <ColorTemplate7PopupLargeDark.ActionButton onClick={() => saveOrder(null)}>
                Reset icon order
              </ColorTemplate7PopupLargeDark.ActionButton>
            ) : null}
          </Box>
        ) : null}
        {orderMsg ? <ColorTemplate7PopupLargeDark.ErrorBar>{orderMsg}</ColorTemplate7PopupLargeDark.ErrorBar> : null}
        <RecordVaultIconPickerGrid
          selectedIcon={selectedIcon || ''}
          onSelectIcon={(iconName) => onSelect?.(iconName)}
          ariaLabelPrefix="Select bill icon"
          pinnedIcons={BILL_ICON_PINNED}
          cellScale={BILL_ICON_TRAY_SCALE}
          fillIcons={BILL_ICON_FEATURED}
          maxHeight={billIconTrayScrollSx}
          iconOrder={iconOrder}
          onReorder={saveOrder}
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
