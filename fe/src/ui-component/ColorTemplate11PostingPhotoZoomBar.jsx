import PropTypes from 'prop-types';
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faVolumeHigh } from '@fortawesome/free-solid-svg-icons';
import {
  COLOR_TEMPLATE11_POSTING_PHOTO_FULLSCREEN_HINT,
  colorTemplate11PostingPhotoFullscreenHintSx,
  colorTemplate11PostingPhotoHeightPxToVh,
  colorTemplate11PostingPhotoHintOnlyBarSx,
  colorTemplate11PostingPhotoHintOnlyTextSx,
  colorTemplate11PostingPhotoZoomBarSx,
  colorTemplate11PostingPhotoZoomChromeSx,
  colorTemplate11PostingPhotoZoomMarks,
  colorTemplate11PostingPhotoZoomSliderSx,
  colorTemplate11PostingPhotoZoomSpeakerSx,
  getColorTemplate11PostingPhotoHeightBoundsPx
} from 'config/colorTemplate11Posting';

export default function ColorTemplate11PostingPhotoZoomBar({
  heightPx,
  onChangeHeight,
  variant = 'hint',
  hintText = COLOR_TEMPLATE11_POSTING_PHOTO_FULLSCREEN_HINT
}) {
  const { minPx, maxPx, stepPx } = useMemo(() => getColorTemplate11PostingPhotoHeightBoundsPx(), [heightPx]);
  const heightVh = colorTemplate11PostingPhotoHeightPxToVh(heightPx);

  const handleSliderChange = (_event, newValue) => {
    onChangeHeight?.(newValue);
  };

  const marks = useMemo(() => colorTemplate11PostingPhotoZoomMarks(minPx, maxPx, stepPx), [minPx, maxPx, stepPx]);

  if (variant === 'hint') {
    return (
      <Box sx={colorTemplate11PostingPhotoHintOnlyBarSx()} role="note">
        <Typography sx={colorTemplate11PostingPhotoHintOnlyTextSx()}>{hintText}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={colorTemplate11PostingPhotoZoomBarSx()} role="group" aria-label="Posting photo size">
      <Box sx={colorTemplate11PostingPhotoZoomChromeSx()}>
        <Box sx={colorTemplate11PostingPhotoZoomSpeakerSx()} aria-hidden>
          <FontAwesomeIcon icon={faVolumeHigh} />
        </Box>
        <Slider
          value={heightPx}
          onChange={handleSliderChange}
          min={minPx}
          max={maxPx}
          step={stepPx}
          marks={marks}
          size="small"
          sx={colorTemplate11PostingPhotoZoomSliderSx()}
          valueLabelDisplay="auto"
          valueLabelFormat={() => `${heightVh}vh`}
          aria-label="Posting photo height"
        />
      </Box>
      <Typography sx={colorTemplate11PostingPhotoFullscreenHintSx()}>{hintText}</Typography>
    </Box>
  );
}

ColorTemplate11PostingPhotoZoomBar.propTypes = {
  heightPx: PropTypes.number.isRequired,
  onChangeHeight: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(['full', 'hint']),
  hintText: PropTypes.string
};
