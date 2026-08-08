import PropTypes from 'prop-types';
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faMagnifyingGlassMinus, faMagnifyingGlassPlus } from '@fortawesome/free-solid-svg-icons';
import {
  COLOR_TEMPLATE11_POSTING_PHOTO_FULLSCREEN_HINT,
  colorTemplate11PostingPhotoFullscreenHintSx,
  colorTemplate11PostingPhotoHeightPxToVh,
  colorTemplate11PostingPhotoZoomBarSx,
  colorTemplate11PostingPhotoZoomIconButtonSx,
  colorTemplate11PostingPhotoZoomSliderSx,
  colorTemplate11PostingPhotoZoomVhLabelSx,
  getColorTemplate11PostingPhotoHeightBoundsPx
} from 'config/colorTemplate11Posting';

export default function ColorTemplate11PostingPhotoZoomBar({ heightPx, onChangeHeight }) {
  const { minPx, maxPx, stepPx } = useMemo(() => getColorTemplate11PostingPhotoHeightBoundsPx(), [heightPx]);
  const heightVh = colorTemplate11PostingPhotoHeightPxToVh(heightPx);

  const handleSliderChange = (_event, newValue) => {
    onChangeHeight?.(newValue);
  };

  const handleZoomOut = () => {
    onChangeHeight?.(Math.max(minPx, heightPx - stepPx));
  };

  const handleZoomIn = () => {
    onChangeHeight?.(Math.min(maxPx, heightPx + stepPx));
  };

  return (
    <Box sx={colorTemplate11PostingPhotoZoomBarSx()} role="group" aria-label="Posting photo size">
      <IconButton
        size="small"
        onClick={handleZoomOut}
        disabled={heightPx <= minPx}
        aria-label="Smaller posting photos"
        sx={colorTemplate11PostingPhotoZoomIconButtonSx()}
      >
        <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
      </IconButton>
      <Slider
        value={heightPx}
        onChange={handleSliderChange}
        min={minPx}
        max={maxPx}
        step={stepPx}
        size="small"
        sx={colorTemplate11PostingPhotoZoomSliderSx()}
        valueLabelDisplay="auto"
        valueLabelFormat={() => `${heightVh}vh`}
        aria-label="Posting photo height"
      />
      <IconButton
        size="small"
        onClick={handleZoomIn}
        disabled={heightPx >= maxPx}
        aria-label="Larger posting photos"
        sx={colorTemplate11PostingPhotoZoomIconButtonSx()}
      >
        <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
      </IconButton>
      <Typography sx={colorTemplate11PostingPhotoZoomVhLabelSx()}>{heightVh}vh</Typography>
      <Typography sx={colorTemplate11PostingPhotoFullscreenHintSx()}>{COLOR_TEMPLATE11_POSTING_PHOTO_FULLSCREEN_HINT}</Typography>
    </Box>
  );
}

ColorTemplate11PostingPhotoZoomBar.propTypes = {
  heightPx: PropTypes.number.isRequired,
  onChangeHeight: PropTypes.func.isRequired
};
