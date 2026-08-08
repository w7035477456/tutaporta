import PropTypes from 'prop-types';

// material-ui
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';

// project import
import { withAlpha } from 'utils/colorUtils';

// third party
import { BrowserView, MobileView } from 'react-device-detect';
import SimpleBar from 'simplebar-react';

// root style
const RootStyle = styled(BrowserView)({
  flexGrow: 1,
  height: '100%',
  overflow: 'visible'
});

// scroll bar wrapper
const SimpleBarStyle = styled(SimpleBar)(({ theme }) => ({
  maxHeight: '100%',
  // simplebar.min.css uses overflow:hidden on wrapper/mask and overflow:auto on content-wrapper,
  // which clips transform:scale() on sidebar rows on desktop. Force visible on clip ancestors.
  '& .simplebar-wrapper': {
    overflow: 'visible !important'
  },
  '& .simplebar-mask': {
    zIndex: 'inherit',
    overflow: 'visible !important'
  },
  '& .simplebar-offset': {
    overflow: 'visible !important'
  },
  '& .simplebar-content-wrapper': {
    overflowX: 'visible !important',
    overflowY: 'auto !important'
  },
  '& .simplebar-scrollbar': {
    '&:before': { backgroundColor: withAlpha(theme.vars.palette.grey[500], 0.48) },
    '&.simplebar-visible:before': { opacity: 1 }
  },
  '& .simplebar-track.simplebar-vertical': { width: 10 },
  '& .simplebar-track.simplebar-horizontal .simplebar-scrollbar': { height: 6 }
}));

// ==============================|| SIMPLE SCROLL BAR  ||============================== //

export default function SimpleBarScroll({ children, sx, ...other }) {
  return (
    <>
      <RootStyle>
        <SimpleBarStyle clickOnTrack={false} sx={sx} data-simplebar-direction={'ltr'} {...other}>
          {children}
        </SimpleBarStyle>
      </RootStyle>
      <MobileView>
        <Box sx={{ overflow: 'visible', ...sx }} {...other}>
          {children}
        </Box>
      </MobileView>
    </>
  );
}

SimpleBarScroll.propTypes = { children: PropTypes.any, sx: PropTypes.any, other: PropTypes.any };
