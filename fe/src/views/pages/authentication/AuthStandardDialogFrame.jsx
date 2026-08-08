import PropTypes from 'prop-types';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';

import AuthInnerStack from './AuthInnerStack';
import { getMobileScrollbarOverflowSx } from 'config/authDialogEnv';
import { standardAuthDialogScrollSx, standardAuthDialogInnerColumnSx } from './authPageLayoutSx';

/**
 * Scrollable auth dialog column: DIALOG_WIDTH_MOBILE / DIALOG_WIDTH_DESKTOP + DIALOG_MARGIN_TOP/BOT.
 * Do not use for About / Terms / Privacy (use legalInfoDialogScrollSx there).
 *
 * Intentionally no CSS transform scale: App sets --app-dialog-scale for MUI Dialogs, but
 * scaling here would paint larger than this vw-wide column and clip (overflow hidden).
 */
export default function AuthStandardDialogFrame({ children }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  return (
    <AuthInnerStack
      sx={{
        flex: '1 1 0',
        minHeight: 0,
        width: '100%',
        paddingTop: 0,
        justifyContent: 'flex-start',
        alignItems: 'stretch',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        px: 0
      }}
    >
      <Box
        sx={{
          ...standardAuthDialogScrollSx,
          ...(isMobile ? getMobileScrollbarOverflowSx(true) : {})
        }}
      >
        <Box sx={standardAuthDialogInnerColumnSx}>{children}</Box>
      </Box>
    </AuthInnerStack>
  );
}

AuthStandardDialogFrame.propTypes = {
  children: PropTypes.node.isRequired
};
