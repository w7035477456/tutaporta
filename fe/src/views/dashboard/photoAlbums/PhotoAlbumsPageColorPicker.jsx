import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { ALBUM_PAGE_BG_COLORS } from './photoAlbumsPages';

const SWATCH_W = 22;
const SWATCH_H = 52;

const radioLabelSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 0.5,
  cursor: 'pointer',
  fontFamily: MAIN_FONT_FAMILY,
  fontWeight: 700,
  fontSize: '0.8rem',
  lineHeight: 1.2,
  color: '#000',
  WebkitTextFillColor: '#000',
  whiteSpace: 'nowrap',
  '& input': { m: 0, accentColor: '#000', cursor: 'pointer' }
};

/**
 * Pastel page background swatches beside the album. `scope` 'album' colors every page,
 * 'page' only the last page clicked.
 */
export default function PhotoAlbumsPageColorPicker({ value = '', scope = 'album', onScopeChange, onPick, sx }) {
  return (
    <Box
      data-pa-page-color-picker=""
      onMouseDown={(e) => e.stopPropagation()}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 0.75,
        p: 0.75,
        bgcolor: 'rgba(255,255,255,0.85)',
        borderRadius: 1,
        ...sx
      }}
    >
      <Box role="radiogroup" aria-label="Album page color" sx={{ display: 'flex', borderRadius: 1, overflow: 'hidden' }}>
        {ALBUM_PAGE_BG_COLORS.map((color) => {
          const selected = color === value;
          return (
            <Box
              key={color}
              component="button"
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`Page color ${color}`}
              title={scope === 'page' ? 'Color the last page you clicked' : 'Color every page of this album'}
              onClick={() => onPick?.(color)}
              sx={{
                width: SWATCH_W,
                height: SWATCH_H,
                p: 0,
                m: 0,
                border: selected ? '2px solid #000' : '2px solid transparent',
                bgcolor: color,
                cursor: 'pointer',
                boxSizing: 'border-box',
                '&:hover': { borderColor: selected ? '#000' : 'rgba(0,0,0,0.35)' }
              }}
            />
          );
        })}
      </Box>
      <Box component="label" sx={radioLabelSx}>
        <input type="radio" name="pa-page-color-scope" checked={scope === 'album'} onChange={() => onScopeChange?.('album')} />
        Entire Album
      </Box>
      <Box component="label" sx={radioLabelSx}>
        <input type="radio" name="pa-page-color-scope" checked={scope === 'page'} onChange={() => onScopeChange?.('page')} />
        This Page Only
      </Box>
    </Box>
  );
}

PhotoAlbumsPageColorPicker.propTypes = {
  value: PropTypes.string,
  scope: PropTypes.oneOf(['album', 'page']),
  onScopeChange: PropTypes.func,
  onPick: PropTypes.func,
  sx: PropTypes.object
};
