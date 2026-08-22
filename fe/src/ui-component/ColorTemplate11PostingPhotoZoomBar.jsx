import PropTypes from 'prop-types';
import { useMemo } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import {
  COLOR_TEMPLATE11_POSTING_PHOTO_FULLSCREEN_HINT,
  colorTemplate11PostingPhotoFullscreenHintSx,
  colorTemplate11PostingPhotoHeightPxToVh,
  colorTemplate11PostingPhotoHintOnlyBarSx,
  colorTemplate11PostingPhotoHintOnlyTextSx,
  colorTemplate11PostingPhotoZoomBarSx,
  colorTemplate11PostingPhotoZoomChromeSx,
  colorTemplate11PostingPhotoZoomIconButtonSx,
  colorTemplate11PostingPhotoZoomMarks,
  colorTemplate11PostingPhotoZoomSliderSx,
  colorTemplate11PostingPhotoZoomVhLabelSx,
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
  const heightPercent = useMemo(() => {
    const span = Math.max(1, maxPx - minPx);
    return Math.round(((Number(heightPx) - minPx) / span) * 100);
  }, [heightPx, minPx, maxPx]);

  const handleSliderChange = (_event, newValue) => {
    onChangeHeight?.(newValue);
  };

  const handleZoomOut = () => {
    onChangeHeight?.(Math.max(minPx, Number(heightPx) - stepPx));
  };

  const handleZoomIn = () => {
    onChangeHeight?.(Math.min(maxPx, Number(heightPx) + stepPx));
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
        <IconButton
          size="small"
          onClick={handleZoomOut}
          aria-label="Decrease photo size"
          disabled={Number(heightPx) <= minPx}
          sx={colorTemplate11PostingPhotoZoomIconButtonSx({ fontWeight: 900 })}
        >
          −
        </IconButton>
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
        <IconButton
          size="small"
          onClick={handleZoomIn}
          aria-label="Increase photo size"
          disabled={Number(heightPx) >= maxPx}
          sx={colorTemplate11PostingPhotoZoomIconButtonSx({ fontWeight: 900 })}
        >
          +
        </IconButton>
        <Typography sx={colorTemplate11PostingPhotoZoomVhLabelSx()} aria-live="polite">
          {heightPercent}%
        </Typography>
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
