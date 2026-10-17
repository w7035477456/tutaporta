import { Link, useNavigate } from 'react-router-dom';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import AuthWrapper1 from 'views/pages/authentication/AuthWrapper1';
import AuthCardWrapper from 'views/pages/authentication/AuthCardWrapper';
import AuthInnerStack from 'views/pages/authentication/AuthInnerStack';
import Logo from 'ui-component/Logo';
import AuthFooter from 'ui-component/cards/AuthFooter';
import {
  authShellStackSx,
  authFixedFooterContentPaddingBottom,
  legalInfoDialogScrollSx,
  authButtonBoldSx
} from 'views/pages/authentication/authPageLayoutSx';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { GET_MY_RAFFLE_PATH } from 'constants/raffleRoute';

const linkSx = { color: 'var(--theme-primary-color)', fontWeight: 700 };

const RAFFLE_STEPS = [
  <>
    Go to{' '}
    <Box component={Link} to="/register" sx={linkSx}>
      tutamall.com/register
    </Box>
    .
  </>,
  <>Log in or sign up for an account with a real US phone number and email address.</>,
  <>All standard registration initialization require upload profile photo, live facial scan, and scanning your Driver License.</>,
  <>
    After that, click the <strong>&ldquo;Get My Raffle&rdquo;</strong> button on the main screen (or go to{' '}
    <Box component={Link} to={GET_MY_RAFFLE_PATH} sx={linkSx}>
      tutamall.com/mall
    </Box>
    ).
  </>,
  <>A popup of Raffle ticket will appear. Take a screenshot of the raffle ticket and save to you phone.</>,
  <>Bring the screenshot to the Meetup event, where the host will read out a random winning raffle number..</>,
  <>The winner need to physically go to host to claim, and allow host to scan your raffle ticket bar code from your phone screenshot.</>,
  <>If you have the winning raffle number, also, after event, return to tutalamll.com/mall to click on yellow "Claim your winning Raffle",
    and enter your info so the $200 can be sent to you via your choice of Paypal or Venmo.</>,
  <>
    If the person with the winning number is not at the event, the host will pick a different number, and keep
    picking until someone at the event calls claim it.
  </>
];

export default function RaffleInfoPage() {
  const navigate = useNavigate();

  const returnButtonSx = {
    ...authButtonBoldSx,
    minWidth: 120,
    bgcolor: 'var(--theme-secondary-color)',
    color: 'var(--theme-primary-color)',
    borderColor: 'var(--theme-primary-color)',
    '&:hover': {
      bgcolor: 'var(--theme-secondary-color)',
      filter: 'brightness(0.95)',
      borderColor: 'var(--theme-primary-color)'
    }
  };

  return (
    <AuthWrapper1>
      <Stack
        sx={{
          ...authShellStackSx,
          ...authFixedFooterContentPaddingBottom,
          justifyContent: 'flex-start',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <AuthInnerStack
          sx={{
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            py: 0,
            px: 0,
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
            width: '100%'
          }}
        >
          <Box sx={legalInfoDialogScrollSx}>
            <AuthCardWrapper tight sx={{ width: '100%', maxWidth: '100%' }}>
              <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'left' }}>
                <Box>
                  <Link to="/pages/login" aria-label="logo">
                    <Logo authBranding />
                  </Link>
                </Box>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    textAlign: 'center',
                    width: '100%',
                    fontSize: {
                      xs: `${Math.max(0.1, (Number.parseFloat(getMobileSinglesTitleFontSizeVw()) || 2) * 2)}vw`,
                      sm: `${Math.max(0.1, (Number.parseFloat(getDesktopTitleFontSizeVw()) || 2) * 2)}vw`
                    }
                  }}
                >
                  TutaMall Meetup Raffle
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, width: '100%' }}>
                  To enter the raffle:
                </Typography>
                <Box component="ol" sx={{ width: '100%', pl: 3, m: 0 }}>
                  {RAFFLE_STEPS.map((step, index) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Typography key={index} component="li" variant="body1" sx={{ mb: 1.25 }}>
                      {step}
                    </Typography>
                  ))}
                </Box>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Button
                    variant="outlined"
                    onClick={() => navigate("/register")}
                    sx={returnButtonSx}
                    data-guest-demo-allow="true"
                  >
                    Go to Register New Account
                  </Button>
                </Box>
              </Stack>
            </AuthCardWrapper>
          </Box>
        </AuthInnerStack>
        <AuthFooter />
      </Stack>
    </AuthWrapper1>
  );
}
