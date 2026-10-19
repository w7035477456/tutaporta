import PropTypes from 'prop-types';

import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';

import AuthInnerStack from './AuthInnerStack';
import { getMobileScrollbarOverflowSx } from 'config/authDialogEnv';
import { MOBILE_DIALOG_TARGET_WIDTH_FRAC } from './AuthMobileDialogFit';
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
  const mobileWidthVw = MOBILE_DIALOG_TARGET_WIDTH_FRAC * 100;
  const mobileSideVw = (100 - mobileWidthVw) / 2;

  return (
    <AuthInnerStack
      sx={{
        flex: '1 1 0',
        minHeight: 0,
        height: isMobile ? '100%' : undefined,
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
          ...(isMobile
            ? {
                width: `${mobileWidthVw}vw`,
                maxWidth: `${mobileWidthVw}vw`,
                ml: `${mobileSideVw}vw`,
                mr: `${mobileSideVw}vw`,
                mt: '0.6vh',
                mb: '0.6vh',
                flex: '1 1 0',
                height: '100%',
                maxHeight: '100%',
                minHeight: 0,
                overflow: 'hidden',
                ...getMobileScrollbarOverflowSx(true),
                overflowY: 'hidden',
                overflowX: 'hidden'
              }
            : {})
        }}
      >
        <Box
          sx={{
            ...standardAuthDialogInnerColumnSx,
            ...(isMobile ? { height: '100%', flex: '1 1 auto', minHeight: 0 } : {})
          }}
        >
          {children}
        </Box>
      </Box>
    </AuthInnerStack>
  );
}

AuthStandardDialogFrame.propTypes = {
  children: PropTypes.node.isRequired
};
