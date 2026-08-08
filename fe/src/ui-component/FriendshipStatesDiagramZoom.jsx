import { useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';

import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { MAIN_FONT_FAMILY } from 'config/mainFontEnv';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';

/**
 * Thumbnail + ColorTemplate7PopupLargeDark full diagram (menu-aware width, vertical scroll when tall).
 */
export default function FriendshipStatesDiagramZoom({ imageSrc, imageAlt = 'Friendship states diagram' }) {
  const [zoomOpen, setZoomOpen] = useState(false);

  return (
    <>
      <Box
        sx={{
          mt: 2,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        <Typography
          sx={{
            fontWeight: 700,
            textAlign: 'center',
            fontFamily: MAIN_FONT_FAMILY,
            color: 'var(--theme-primary-color)',
            fontSize: getDesktopTextFontSizeVw(),
            mb: 1
          }}
        >
          Click to zoom
        </Typography>
        <ButtonBase
          type="button"
          aria-label={`${imageAlt} — open full size`}
          onClick={() => setZoomOpen(true)}
          sx={{
            display: 'block',
            width: '100%',
            maxWidth: 420,
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: '#fff',
            border: '2px solid #000',
            p: 0.5,
            cursor: 'zoom-in',
            '&:hover': { filter: 'brightness(0.98)' }
          }}
        >
          <Box
            component="img"
            src={imageSrc}
            alt={imageAlt}
            sx={{
              width: '100%',
              height: 'auto',
              display: 'block',
              maxHeight: { xs: 160, sm: 220 },
              objectFit: 'contain'
            }}
          />
        </ButtonBase>
      </Box>

      <ColorTemplate7PopupLargeDark
        open={zoomOpen}
        onClose={() => setZoomOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel={`Close ${imageAlt}`}
      >
        <ColorTemplate7PopupLargeDark.Body spacing={0}>
          <Box component="img" src={imageSrc} alt={imageAlt} />
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>
    </>
  );
}

FriendshipStatesDiagramZoom.propTypes = {
  imageSrc: PropTypes.string.isRequired,
  imageAlt: PropTypes.string
};
