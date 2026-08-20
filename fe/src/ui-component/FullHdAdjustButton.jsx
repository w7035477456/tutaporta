import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import {
  RECOMMENDED_VIEWPORT_HEIGHT_PX,
  RECOMMENDED_VIEWPORT_WIDTH_PX,
  fullHdAdjustMessageFontSx
} from 'config/fullHdViewportEnv';
import {
  baseButtonSx,
  SELECTED_UNSELECTED_BUTTON_HOVER_SCALE
} from 'config/selectedUnselectedButtonTemplate';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import { LIGHT_SURFACE_CLASS } from 'utils/themeContrast';
import { DAYNIGHT_VAR, INVERSE_DAYNIGHT_VAR, YELLOW_VAR } from 'utils/themeConfig';

function useWindowInnerSize() {
  const [dims, setDims] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 0,
    h: typeof window !== 'undefined' ? window.innerHeight : 0
  }));

  useEffect(() => {
    const update = () => setDims({ w: window.innerWidth, h: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return dims;
}

function FullHdAdjustDialog({ open, onClose, widthPx, heightPx }) {
  if (!open) return null;

  return (
    <Box
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-hd-adjust-title"
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 10001,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'rgba(0,0,0,0.45)',
        p: 2
      }}
      onClick={onClose}
    >
      <Box
        className={LIGHT_SURFACE_CLASS}
        sx={{
          position: 'relative',
          maxWidth: 640,
          width: '100%',
          bgcolor: 'var(--theme-yellow-color, #FFEB3B)',
          border: `8px solid var(${INVERSE_DAYNIGHT_VAR})`,
          borderRadius: 2,
          px: { xs: 2, sm: 3 },
          py: { xs: 2.5, sm: 3 },
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
          color: '#000000'
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <Box
          component="button"
          type="button"
          aria-label="Close Full HD adjust help"
          onClick={onClose}
          sx={{
            position: 'absolute',
            top: 6,
            right: 10,
            border: '2px solid #000',
            bgcolor: 'var(--theme-error-color)',
            color: '#000000',
            WebkitTextFillColor: '#000000',
            fontFamily: 'Algerian, fantasy',
            fontWeight: 800,
            fontSize: buttonFontSizeResponsive,
            lineHeight: 1,
            cursor: 'pointer',
            p: 0,
            m: 0,
            width: '1.75em',
            height: '1.75em',
            minWidth: '1.75em',
            minHeight: '1.75em',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box'
          }}
        >
          X
        </Box>
        <Typography
          id="full-hd-adjust-title"
          sx={{ ...fullHdAdjustMessageFontSx(), fontWeight: 700, pr: 4 }}
        >
          Please use Ctrl+ and Ctrl- and drag window corner to resize close to recommend{' '}
          {RECOMMENDED_VIEWPORT_WIDTH_PX}x{RECOMMENDED_VIEWPORT_HEIGHT_PX} for best user experience.
        </Typography>
        <Typography sx={{ ...fullHdAdjustMessageFontSx(), mt: 1.5, fontWeight: 700 }}>
          Current: {widthPx}px Width by {heightPx}px Height
        </Typography>
      </Box>
    </Box>
  );
}

const fullHdAdjustButtonSx = baseButtonSx(
  `var(${YELLOW_VAR}, #FFEB3B)`,
  '#000000',
  `1px solid var(${DAYNIGHT_VAR})`,
  SELECTED_UNSELECTED_BUTTON_HOVER_SCALE,
  { fitLabelWidth: true }
);

/** Opens yellow help popup with live window size (Admin Tools tab bar, mockup: Full HD adjust). */
export default function FullHdAdjustButton({ sx: sxProp } = {}) {
  const [open, setOpen] = useState(false);
  const { w, h } = useWindowInnerSize();

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <SelectedButtonTemplate
        type="button"
        className={LIGHT_SURFACE_CLASS}
        onClick={handleOpen}
        sx={{ ...fullHdAdjustButtonSx, flexShrink: 0, ...(sxProp || {}) }}
      >
        Full HD adjust
      </SelectedButtonTemplate>
      <FullHdAdjustDialog open={open} onClose={handleClose} widthPx={w} heightPx={h} />
    </>
  );
}
