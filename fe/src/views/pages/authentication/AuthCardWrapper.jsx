import PropTypes from 'prop-types';
// material-ui
import Box from '@mui/material/Box';

// project imports
import MainCard from 'ui-component/cards/MainCard';
import AuthMobileDialogFit from './AuthMobileDialogFit';

// ==============================|| AUTHENTICATION CARD WRAPPER ||============================== //

export default function AuthCardWrapper({ children, tight, disableMobileFit, fullWidth = false, sx: sxOverride, ...other }) {
  const stretchFill =
    sxOverride?.height === '100%' ||
    sxOverride?.flex === '1 1 auto' ||
    sxOverride?.flex === 1;
  // md+: shrink-wrap so column flex parents do not stretch the card full width (horizontal center).
  const card = (
    <Box
      sx={{
        width: fullWidth ? '100%' : { xs: '100%', md: 'auto' },
        maxWidth: '100%',
        minWidth: 0,
        alignSelf: stretchFill ? 'stretch' : { xs: 'stretch', md: fullWidth ? 'stretch' : 'center' },
        mx: fullWidth ? 0 : { md: 'auto' },
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: stretchFill ? 'column' : undefined,
        justifyContent: stretchFill ? 'flex-start' : 'center',
        ...(stretchFill
          ? {
              height: '100%',
              flex: sxOverride?.flex ?? '1 1 auto',
              minHeight: sxOverride?.minHeight ?? 0
            }
          : null)
      }}
    >
      <MainCard
        sx={{
          maxWidth: stretchFill ? '100%' : fullWidth ? '100%' : { xs: 400, lg: 475 },
          width: stretchFill ? '100%' : fullWidth ? '100%' : { xs: '100%', md: 'auto' },
          my: stretchFill ? 0 : tight ? { xs: 0.5, sm: 1 } : { xs: 2.5, md: 3 },
          mx: 'auto',
          ...(stretchFill
            ? {
                height: '100%',
                flex: '1 1 auto',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column'
              }
            : null),
          '& > *': {
            flexGrow: 1,
            flexBasis: '50%'
          },
          color: 'var(--theme-primary-color)',
          ...(sxOverride && typeof sxOverride === 'object' ? sxOverride : {})
        }}
        content={false}
        {...other}
      >
        <Box
          sx={{
            p: stretchFill ? 0 : tight ? { xs: 1, sm: 1.5 } : { xs: 2, sm: 3, xl: 5 },
            ...(stretchFill
              ? {
                  height: '100%',
                  flex: '1 1 auto',
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column'
                }
              : null)
          }}
        >
          {children}
        </Box>
      </MainCard>
    </Box>
  );

  if (disableMobileFit) {
    return card;
  }

  return <AuthMobileDialogFit>{card}</AuthMobileDialogFit>;
}

AuthCardWrapper.propTypes = {
  children: PropTypes.any,
  tight: PropTypes.bool,
  disableMobileFit: PropTypes.bool,
  fullWidth: PropTypes.bool,
  sx: PropTypes.object
};
