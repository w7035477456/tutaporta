import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { IconMaximize, IconMinimize, IconSquare } from '@tabler/icons-react';

const toggleButtonSx = (active) => ({
  flex: '0 0 auto',
  width: 30,
  height: 30,
  p: 0,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  border: '2px solid #000',
  borderRadius: 1,
  bgcolor: active ? '#c62828' : '#000',
  color: '#fff',
  '&:hover': { bgcolor: active ? '#b71c1c' : '#333' },
  '&:focus-visible': { outline: '2px solid #c62828', outlineOffset: 2 }
});

/**
 * Note title row buttons beside the zoom slider (TutaNotes):
 * - full box → open / close the left + right menus (same as « Close Menu)
 * - corners box → note fills the whole browser window / back to normal layout
 */
export default function RecordVaultNoteLayoutToggleButtons({
  menusOpen,
  onToggleMenus,
  fullWindow,
  onToggleFullWindow
}) {
  const menusLabel = menusOpen ? 'Close left and right menus' : 'Open left and right menus';
  const fullWindowLabel = fullWindow ? 'Exit full window (Esc)' : 'Show note in full window';
  return (
    <Box sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Tooltip title={menusLabel} arrow>
        <Box
          component="button"
          type="button"
          aria-label={menusLabel}
          aria-pressed={!menusOpen}
          onClick={onToggleMenus}
          sx={toggleButtonSx(!menusOpen)}
        >
          <IconSquare size={18} stroke={2.5} />
        </Box>
      </Tooltip>
      <Tooltip title={fullWindowLabel} arrow>
        <Box
          component="button"
          type="button"
          aria-label={fullWindowLabel}
          aria-pressed={fullWindow}
          onClick={onToggleFullWindow}
          sx={toggleButtonSx(fullWindow)}
        >
          {fullWindow ? <IconMinimize size={18} stroke={2.5} /> : <IconMaximize size={18} stroke={2.5} />}
        </Box>
      </Tooltip>
    </Box>
  );
}

RecordVaultNoteLayoutToggleButtons.propTypes = {
  menusOpen: PropTypes.bool,
  onToggleMenus: PropTypes.func,
  fullWindow: PropTypes.bool,
  onToggleFullWindow: PropTypes.func
};
