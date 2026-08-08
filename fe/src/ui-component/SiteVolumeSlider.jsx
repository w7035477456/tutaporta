import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';

import audioOnImg from 'assets/images/audioOn.png';
import audioOffImg from 'assets/images/audioOff.png';
import { useSiteAudio } from 'contexts/SiteAudioContext';

/** Track + thumb color: blue (low) → green (mid) → red (loud). Grey when muted. */
function volumeAccent(v) {
  if (v <= 0) return '#9e9e9e';
  if (v < 1 / 3) return '#1e88e5';
  if (v < 2 / 3) return '#43a047';
  return '#e53935';
}

/**
 * Site-wide volume (media, mall hover, UI clicks). `footer` = parent positions; `fixed` = viewport bottom-right.
 * Left icon shows mute state at 0.
 */
export default function SiteVolumeSlider({ variant = 'footer' }) {
  const { mediaVolume, setMediaVolume } = useSiteAudio();
  const accent = volumeAccent(mediaVolume);
  const isOff = mediaVolume <= 0;
  const isFixed = variant === 'fixed';

  const handleChange = (_e, value) => {
    setMediaVolume(Array.isArray(value) ? value[0] : value);
  };

  return (
    <Box
      data-no-click-sound
      sx={
        isFixed
          ? { position: 'fixed', bottom: 16, right: 16, zIndex: 1300, maxWidth: { xs: 220, sm: 260 } }
          : { maxWidth: { xs: 200, sm: 240 }, minWidth: 0 }
      }
    >
      <Stack direction="row" alignItems="center" spacing={0.75} sx={{ minWidth: 0 }}>
        <Box
          sx={{
            flexShrink: 0,
            width: 44,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 1,
            border: isOff ? '3px solid var(--theme-error-color)' : '3px solid transparent',
            boxSizing: 'border-box',
            bgcolor: isOff ? 'rgba(229, 57, 53, 0.08)' : 'transparent',
            transition: 'border-color 0.2s ease, background-color 0.2s ease'
          }}
          aria-hidden
        >
          <Box component="img" src={isOff ? audioOffImg : audioOnImg} alt="" sx={{ width: 36, height: 36, objectFit: 'contain', display: 'block' }} />
        </Box>

        <Slider
          value={mediaVolume}
          onChange={handleChange}
          min={0}
          max={1}
          step={0.01}
          size="small"
          aria-label="Site sound volume"
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${Math.round(v * 100)}%`}
          sx={{
            flex: 1,
            minWidth: 72,
            color: accent,
            '& .MuiSlider-track': {
              border: 'none',
              backgroundColor: accent
            },
            '& .MuiSlider-rail': {
              opacity: 0.35,
              backgroundColor: isOff ? '#bdbdbd' : accent
            },
            '& .MuiSlider-thumb': {
              width: 16,
              height: 16,
              backgroundColor: accent,
              border: '2px solid #fff',
              boxSizing: 'border-box',
              '&:hover, &.Mui-focusVisible': {
                boxShadow: `0 0 0 8px ${accent}33`
              }
            }
          }}
        />

        <Box sx={{ flexShrink: 0, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }} aria-hidden>
          <Box component="img" src={audioOnImg} alt="" sx={{ width: 32, height: 32, objectFit: 'contain', display: 'block', opacity: 0.9 }} />
        </Box>
      </Stack>
    </Box>
  );
}

SiteVolumeSlider.propTypes = {
  variant: PropTypes.oneOf(['footer', 'fixed'])
};
