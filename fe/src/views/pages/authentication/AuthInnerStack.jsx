import PropTypes from 'prop-types';

// material-ui
import Stack from '@mui/material/Stack';

// project imports
import useConfig from 'hooks/useConfig';
import { getDebugDottedBorders } from 'config/debugEnv';

// Top margin from viewport (blue-arrow spacing); stays this size at any zoom (scale compensates)
const TOP_MARGIN_SCREEN_PX = 12;

// ==============================|| AUTH INNER STACK - FIXED TOP MARGIN ||============================== //

export default function AuthInnerStack({ children, sx, ...other }) {
  const {
    state: { pageZoom }
  } = useConfig();
  const zoomFactor = (pageZoom ?? 100) / 100;
  const paddingTopPx = TOP_MARGIN_SCREEN_PX / zoomFactor;
  const debugBorder = getDebugDottedBorders();

  return (
    <Stack
      sx={{
        // Mobile (xs): center dialog in VH/VW; md+ browser: unchanged center. Pages can override xs (e.g. CreatePassword scroll).
        justifyContent: { xs: 'center', md: 'center' },
        alignItems: 'center',
        // xs: do not force minHeight past the flex parent (footer + pb); that caused dialogs to clip top/bottom
        minHeight: { xs: 0, md: 'calc(100vh - 68px)' },
        paddingTop: { xs: paddingTopPx, md: 0 },

        ...(debugBorder ? { border: '3px dashed purple' } : {}), //by ANDREWTON, DO NOT REMOVE THIS CODE
        boxSizing: 'border-box', //by ANDREWTON, DO NOT REMOVE THIS CODE

        // Mobile: stack area is at least viewport minus footer chrome so it stays taller than the MainCard/dialog
        width: '100%',
        ...sx
      }}
      {...other}
    >
      {children}
    </Stack>
  );
}

AuthInnerStack.propTypes = {
  children: PropTypes.node.isRequired,
  sx: PropTypes.object
};
