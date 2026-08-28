import { Link, useNavigate } from 'react-router-dom';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';

// project imports
import AuthWrapper1 from './AuthWrapper1';
import AuthCardWrapper from './AuthCardWrapper';
import AuthInnerStack from './AuthInnerStack';
import Logo from 'ui-component/Logo';
import AuthFooter from 'ui-component/cards/AuthFooter';
import {
  authShellStackSx,
  authFixedFooterContentPaddingBottom,
  legalInfoDialogScrollSx,
  authButtonBoldSx
} from './authPageLayoutSx';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';

// ================================|| ABOUT US - OUR VISION & HEART ||================================ //

export default function AboutUs() {
  const navigate = useNavigate();
  const handleReturn = () => navigate(-1);

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
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom, justifyContent: 'flex-start', overflow: 'hidden', position: 'relative' }}>
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
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <Button variant="outlined" onClick={handleReturn} sx={returnButtonSx}>
                    Return
                  </Button>
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
                  About Us
                </Typography>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    width: '100%'
                  }}
                >
                  Our Vision &amp; Heart
                </Typography>
                <Typography variant="body1" paragraph>
                  Welcome to <strong>TutaMall.com (formerly OnlineMall.Website)</strong>, your comprehensive digital community hub. At <strong>TutaMall.com (formerly OnlineMall.Website)</strong>, we believe in connecting people across all aspects of life-whether you are discovering local businesses, browsing our eMarket (flower shop, etc), or embarking on the journey to find real love via our dedicated dating platform, <strong>Vsingles</strong>. As a trailblazing network, our mission is to provide an inclusive, trusted space where single adults can find not just a partner, but their perfect match, while utilizing a secure environment for all their online community and marketplace needs.
                </Typography>
                <Typography variant="body1" paragraph>
                  We are committed to providing a best-in-class experience that evolves alongside technology to ensure a trusted, customer-first environment. Unlike traditional platforms, we have pioneered unique verification and vetting infrastructures specifically engineered to support both a safe classifieds marketplace and a secure dating ecosystem. Whether you are seeking community connections, marketplace deals, a kindred spirit, or a life-long partner, we provide a welcoming space for our diverse and dynamic community to flourish.
                </Typography>
                <Box sx={{ width: '100%', borderTop: 1, borderColor: 'divider', pt: 2, mt: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                    Why Choose <strong>TutaMall.com (formerly OnlineMall.Website)</strong> and <strong>Vsingles</strong>?
                  </Typography>
                  <Typography variant="body1" paragraph>
                    We understand that navigating online marketplaces and dating platforms requires a foundation of trust. That is why we go beyond the standard profile. <strong>TutaMall.com (formerly OnlineMall.Website)</strong>, through its specialized <strong>Vsingles</strong> dating service, provides a dedicated vetting service for our members. This process is comprehensive and unique, offering a layer of security and authenticity that you simply won&apos;t find on other platforms. By prioritizing your peace of mind through our thoughtful screening processes, we ensure a safer, more intentional environment where you can focus on what truly matters: making meaningful connections and trusted transactions.
                  </Typography>
                  <Stack component="ul" sx={{ pl: 2.5, m: 0 }}>
                    <Typography component="li" variant="body1" sx={{ mb: 1 }}>
                      <strong>Authentic Connections:</strong> Built on advanced verification insights to foster reliable relationships and safe marketplace interactions.
                    </Typography>
                    <Typography component="li" variant="body1" sx={{ mb: 1 }}>
                      <strong>Global Community:</strong> Bringing people together across borders and languages for commerce, community, and companionship.
                    </Typography>
                    <Typography component="li" variant="body1">
                      <strong>Safety First:</strong> A refined vetting process designed to protect your data, your transactions, and your heart.
                    </Typography>
                  </Stack>
                </Box>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                  <Button variant="outlined" onClick={handleReturn} sx={returnButtonSx}>
                    Return
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
