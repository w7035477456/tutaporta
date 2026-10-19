import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

import AuthWrapper1 from 'views/pages/authentication/AuthWrapper1';
import AuthCardWrapper from 'views/pages/authentication/AuthCardWrapper';
import AuthInnerStack from 'views/pages/authentication/AuthInnerStack';
import Logo from 'ui-component/Logo';
import ColorTemplate6CloseX from 'ui-component/ColorTemplate6CloseX';
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
import getMyRaffleTicketImg from 'assets/images/getmyraffleticket.png';

const linkSx = { color: 'var(--theme-primary-color)', fontWeight: 700 };

function RaffleTicketButtonPicture() {
  return (
    <Box
      component="img"
      src={getMyRaffleTicketImg}
      alt="Get My Raffle Ticket button"
      sx={{ height: '1.7em', width: 'auto', verticalAlign: 'middle', mx: 0.25 }}
    />
  );
}

const RAFFLE_STEPS = [
  <>
    Go to{' '}
    <Box component={Link} to="/register" sx={linkSx}>
      tutamall.com/register
    </Box>
    .
  </>,
  <>Log in or sign up for an account with a real US phone number and email address.</>,
  <>
    Standard positive ID registration, any real profile photo, compare to your facial scan and validate name with DL.
  </>,
  <>
    After that, click the <RaffleTicketButtonPicture /> button on the main screen (or go to{' '}
    <Box component={Link} to={GET_MY_RAFFLE_PATH} sx={linkSx}>
      tutamall.com/mall
    </Box>
    ).
  </>,
  <>A raffle ticket popup will appear. Take a screenshot of the raffle ticket and save it to your phone.</>,
  <>Bring the screenshot to the Meetup event, where the host will read out a random winning raffle number.</>,
  <>
    If you have the winning raffle number, immediately claim and go in person to the host, let the host scan the raffle ticket barcode from
    yourphone screenshot of the raffle ticket.
  </>,
  <>
    If you have the winning raffle number, after the event return to{' '}
    <Box component={Link} to={GET_MY_RAFFLE_PATH} sx={linkSx}>
      tutamall.com/mall
    </Box>
    , click the yellow &ldquo;Claim your winning Raffle&rdquo; button, and enter your info so the $200 can be sent to you by PayPal or
    Venmo, your choice.
  </>,
  <>
    If the person with the winning number is not at the event, the host will pick a different number and keep picking until someone at the
    event claims it.
  </>
];

const BONUS_STEPS = [
  <>
    After Registering, you see <RaffleTicketButtonPicture /> has a &ldquo;Your Friend Refer Code: R####&rdquo;.
  </>,
  <>Share this code with your friends.</>,
  <>Your friend enters the code when they register.</>,
  <>You&apos;ll get an email notification a friend had registered once they&apos;ve signed up.</>,
  <>
    You then return to{' '}
    <Box component={Link} to={GET_MY_RAFFLE_PATH} sx={linkSx}>
      tutamall.com/mall
    </Box>{' '}
    and click <strong>&ldquo;Get My Raffle&rdquo;</strong> 2 more times per friend.
  </>,
  <>
    Screenshot every raffle tickets and bring them all to the Meetup event. The more tickets you have, the better your chances of matching
    the winning number!
  </>
];

export default function RaffleInfoPage() {
  const [showBonus, setShowBonus] = useState(false);
  const navigate = useNavigate();

  /** Back to wherever the member came from; opened directly (no in-app history) → home. */
  const handleClose = () => {
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate('/', { replace: true });
  };

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
            <AuthCardWrapper tight sx={{ width: '100%', maxWidth: '100%', position: 'relative' }}>
              <ColorTemplate6CloseX onClose={handleClose} aria-label="Close raffle guide" />
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
                      xs: `${Math.max(0.1, Number.parseFloat(getMobileSinglesTitleFontSizeVw()) || 2)}vw`,
                      sm: `${Math.max(0.1, Number.parseFloat(getDesktopTitleFontSizeVw()) || 2)}vw`
                    }
                  }}
                >
                  {showBonus
                    ? 'Bonus: Quick guide how to get two more FREE raffle tickets:'
                    : 'Quick guide how to get your FREE Meetup Raffle ticket.'}
                </Typography>

                {showBonus ? (
                  <>
                    <Typography variant="body1" sx={{ width: '100%' }}>
                      <strong>Refer friends for extra tickets!</strong> For every friend who signs up for a new TutaMall account, you get 2
                      more raffle tickets FREE. Each friend needs their own unique US phone number and email address.
                    </Typography>
                    <Box component="ul" sx={{ width: '100%', pl: 3, m: 0 }}>
                      {BONUS_STEPS.map((step, index) => (
                        <Typography key={index} component="li" variant="body1" sx={{ mb: 1.25 }}>
                          {step}
                        </Typography>
                      ))}
                    </Box>
                  </>
                ) : (
                  <>
                    <Box component="ol" sx={{ width: '100%', pl: 3, m: 0 }}>
                      {RAFFLE_STEPS.map((step, index) => (
                        <Typography key={index} component="li" variant="body1" sx={{ mb: 1.25 }}>
                          {step}
                        </Typography>
                      ))}
                    </Box>
                    <Typography sx={{ width: '100%', textAlign: 'center', fontWeight: 700, fontSize: '1.25rem' }}>
                      Want two more raffle tickets for FREE?{' '}
                      <Box
                        component="button"
                        type="button"
                        data-guest-demo-allow="true"
                        onClick={() => setShowBonus(true)}
                        sx={{
                          ...linkSx,
                          font: 'inherit',
                          textDecoration: 'underline',
                          bgcolor: 'transparent',
                          border: 0,
                          p: 0,
                          cursor: 'pointer'
                        }}
                      >
                        Click Here
                      </Box>
                    </Typography>
                  </>
                )}
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Button variant="outlined" onClick={() => navigate('/register')} sx={returnButtonSx} data-guest-demo-allow="true">
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
