import { useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import FilmSquare from 'assets/images/filmSquare.png';
import verifiedSeal from 'assets/images/verifiedSeal.png';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';

/** Letterbox / gutters inside the film strip frame (filmSquare.png). */
const FILM_IN_FRAME_FILL = '#372E2A';

/** Desktop: fill the photo cell edge-to-edge; `contain` left side gutters (secondary bg) beside the frame. */
const filmOverlaySx = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'fill',
  objectPosition: 'center',
  pointerEvents: 'none',
  zIndex: 1
};

/** Mobile: fill the photo square edge-to-edge; `contain` left the frame visually small (blue vs red mock). */
const filmOverlayMobileSx = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  pointerEvents: 'none',
  zIndex: 1
};

const sealSx = {
  position: 'absolute',
  right: '5%',
  bottom: '5%',
  width: '32%',
  height: 'auto',
  maxWidth: 'none',
  objectFit: 'contain',
  pointerEvents: 'none',
  zIndex: 4,
  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.35))'
};

/**
 * Member card photo: desktop = one image (unchanged).
 * Mobile = one primary photo (full width, 1:1); Member ID sits in the action block below (AllSingles / Interested).
 */
export default function MemberCardPhotoSection({
  downSM,
  memberLabel,
  memberSecondaryLabel = '',
  singlesId,
  desktopImageSrc,
  galleryImageUrls,
  vettedStatus,
  userSinglesId,
  profilePhotoCacheBust,
  themeSeriesPhotoCell = false,
  onPhotoDoubleClick
}) {
  const lastClickAtRef = useRef(0);
  const lastFiredAtRef = useRef(0);
  const bust = (url) => {
    if (typeof url !== 'string' || !url.includes('/api/photo/')) return url;
    if (userSinglesId != null && singlesId === userSinglesId) {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}v=${profilePhotoCacheBust}`;
    }
    return url;
  };

  const primaryMobileSrc =
    galleryImageUrls.length > 0 ? bust(galleryImageUrls[0]) : bust(desktopImageSrc);

  const photoCellBackground = themeSeriesPhotoCell ? 'var(--theme-daynight-color, #ffffff)' : FILM_IN_FRAME_FILL;
  const photoCellBorderColor = 'var(--theme-inverse-daynight-color, #000000)';
  const photoCellBorder = themeSeriesPhotoCell ? `2px solid ${photoCellBorderColor}` : 'none';
  const photoCellThemeSeriesSx = themeSeriesPhotoCell
    ? {
        boxSizing: 'border-box',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: 0,
          border: `2px solid ${photoCellBorderColor}`,
          pointerEvents: 'none',
          zIndex: 5,
          boxSizing: 'border-box'
        }
      }
    : {};

  const desktopOuterSx = {
    flex: { xs: '0 0 auto', sm: 1 },
    minWidth: 0,
    width: '100%',
    height: { xs: 'auto', sm: '100%' },
    minHeight: { sm: 0 },
    aspectRatio: { xs: '1 / 1', sm: 'unset' },
    bgcolor: photoCellBackground,
    border: photoCellBorder,
    alignSelf: 'stretch',
    position: 'relative',
    overflow: 'hidden',
    ...photoCellThemeSeriesSx
  };
  const doubleClickSx = typeof onPhotoDoubleClick === 'function' ? { cursor: 'zoom-in' } : {};
  const handlePhotoDoubleClick = () => {
    if (typeof onPhotoDoubleClick !== 'function') return;
    const now = Date.now();
    if (now - lastFiredAtRef.current < 450) return;
    lastFiredAtRef.current = now;
    onPhotoDoubleClick();
  };
  const handlePhotoClick = () => {
    if (typeof onPhotoDoubleClick !== 'function') return;
    const now = Date.now();
    const elapsed = now - lastClickAtRef.current;
    lastClickAtRef.current = now;
    if (elapsed > 0 && elapsed <= 350) {
      handlePhotoDoubleClick();
    }
  };

  if (!downSM) {
    return (
      <Box sx={{ ...desktopOuterSx, ...doubleClickSx }} onDoubleClick={handlePhotoDoubleClick} onClick={handlePhotoClick}>
        <Box
          component="img"
          src={desktopImageSrc}
          alt={memberLabel}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block'
          }}
        />
        <Box component="img" src={FilmSquare} alt="" aria-hidden sx={filmOverlaySx} />
        <Typography
          variant="subtitle2"
          component="div"
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 3,
            color: '#ffffff',
            fontWeight: 700,
            textAlign: 'center',
            lineHeight: 1.25,
            fontSize: getDesktopTitleFontSizeVw(),
            wordBreak: 'break-word',
            bgcolor: FILM_IN_FRAME_FILL,
            borderTop: '1px solid var(--theme-primary-color)',
            px: 1,
            py: 0.6,
            pointerEvents: 'none'
          }}
        >
          {memberLabel}
          {memberSecondaryLabel ? (
            <Box
              component="span"
              sx={{
                display: 'block',
                mt: 0.2,
                fontSize: '0.88em',
                lineHeight: 1.15
              }}
            >
              {memberSecondaryLabel}
            </Box>
          ) : null}
        </Typography>
        {vettedStatus ? (
          <Box component="img" src={verifiedSeal} alt="Vetted" sx={sealSx} />
        ) : null}
      </Box>
    );
  }

  /* Mobile: single 1:1 frame — page scroll moves whole Card (this block + actions below) */
  return (
    <Box
      sx={{
        flex: '0 0 auto',
        minWidth: 0,
        width: '100%',
        position: 'relative',
        aspectRatio: '1 / 1',
        flexShrink: 0,
        overflow: 'hidden',
        bgcolor: photoCellBackground,
        border: photoCellBorder,
        alignSelf: 'stretch',
        touchAction: 'manipulation',
        ...photoCellThemeSeriesSx,
        ...doubleClickSx
      }}
      onDoubleClick={handlePhotoDoubleClick}
      onClick={handlePhotoClick}
    >
      <Box
        component="img"
        src={primaryMobileSrc}
        alt={memberLabel}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center',
          display: 'block',
          pointerEvents: 'none',
          userSelect: 'none'
        }}
      />
      <Box component="img" src={FilmSquare} alt="" aria-hidden sx={filmOverlayMobileSx} />
      {vettedStatus ? <Box component="img" src={verifiedSeal} alt="Vetted" sx={sealSx} /> : null}
    </Box>
  );
}
