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

// ================================|| TERMS AND CONDITIONS ||================================ //

export default function TermsAndConditions() {
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
  const sectionHeaderSx = { fontWeight: 700, fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() }, mt: 0.2 };

  return (
    <AuthWrapper1>
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom, justifyContent: 'flex-start', overflow: 'hidden' }}>
        <AuthInnerStack sx={{ py: 0, flex: '1 1 auto', minHeight: 0, width: '100%', overflow: 'hidden', alignItems: 'stretch', px: 0 }}>
          <Box sx={legalInfoDialogScrollSx}>
            <AuthCardWrapper tight sx={{ width: '100%', maxWidth: '100%' }}>
                  <Stack spacing={1} sx={{ alignItems: 'flex-start', textAlign: 'left' }}>
                <Box>
                  <Link to="/pages/login" aria-label="logo">
                    <Logo authBranding />
                  </Link>
                </Box>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mb: 0.5 }}>
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
                  Terms and Conditions of Service
                </Typography>
                <Typography variant="body1" paragraph>
                  This Agreement between you and <strong>TutaMall.com (formerly OnlineMall.Website)</strong> applies to the <strong>TutaMall.com (formerly OnlineMall.Website)</strong> website, its specialized dating subdomain <strong>Vsingles</strong> (collectively, the &quot;Services&quot;), our mobile applications (iOS and Android), and all related services. By accessing or using our Services, you acknowledge that you have read, understood, and agree to be bound by these terms (including our Privacy Policy) for the duration of your use. Specific features may have additional rules; we may update this agreement and will post a revised version on this page.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>1. Eligibility</Typography>
                <Typography variant="body1" paragraph>
                  You must be 18 or older to register an account or use any of the Services. If you utilize the <strong>Vsingles</strong> dating platform, you explicitly represent and warrant that you are single or legally separated. <strong>TutaMall.com (formerly OnlineMall.Website)</strong> and <strong>Vsingles</strong> do not currently perform automated criminal record checks on users but reserve the right to verify eligibility and user identities at any time.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>2. Use of the Services</Typography>
                <Typography variant="body1" paragraph>
                  Basic Membership is free and includes standard features across our eMarketing directory, Classified Ads marketplace, and limited <strong>Vsingles</strong> features (such as compatibility assessments, a limited dating profile, and predefined interactions). Premium Membership includes paid features across the ecosystem (including unblurred photos, advanced search filters, match unlocks, premium classified ad placements, and virtual goods). Billing is subject to auto-renewal and cancellation policies. Use of mobile apps is also subject to Apple/Google terms.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>3. Proprietary Rights</Typography>
                <Typography variant="body1" paragraph>
                  <strong>OnlineMall.Website</strong> retains all rights to its technology, branding, and content, and grants you a limited, personal, non-commercial license to access the platform and its subdomains, including <strong>Vsingles</strong>.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>4. User Information</Typography>
                <Typography variant="body1" paragraph>
                  We handle your data as described in our Privacy Policy. You are solely responsible for the content you post, including classified listings and dating profiles. Do not post personal contact details (such as your personal email, phone number, or physical address) in your public directory or public dating profile.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>5. Risk and Safety</Typography>
                <Typography variant="body1" paragraph>
                  Please review our Safety Guidelines. You agree to interact with other marketplace members, buyers, sellers, and <strong>Vsingles</strong> dating members responsibly. You acknowledge that <strong>TutaMall.com (formerly OnlineMall.Website)</strong> and its subdomains are not liable for the conduct of its users or any offline interactions resulting from the Services.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>6. Disclaimer of Warranties</Typography>
                <Typography variant="body1" paragraph>
                  Services are provided &quot;<strong>AS IS</strong>&quot; without any warranties of any kind, either express or implied, regarding the platform functionality, the accuracy of marketplace listings, or the compatibility of dating matches.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>7. Limitation of Liability</Typography>
                <Typography variant="body1" paragraph>
                  To the maximum extent permitted by law, total liability is limited to the amount paid for the account or $25.00, whichever is greater.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>8. Statutory Cancellation Rights</Typography>
                <Typography variant="body1" paragraph>
                  Residents of AZ, CA, CO, CT, IL, IA, MN, NY, NC, OH, RI, WI may have additional cancellation rights. Cancel via email: <strong>subscriptions@OnlineMall.Website</strong>.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>9. Mobile Messaging Terms</Typography>
                <Typography variant="body1" paragraph>
                  <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                    By providing your mobile number and opting in, you agree to receive text messages from <strong>TutaMall.com (formerly OnlineMall.Website)</strong> and its <strong>Vsingles</strong> service for account security, identity verification, matching alerts, and service updates.
                  </Box>
                </Typography>
                <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
                  <Typography component="li" variant="body1" sx={{ mb: 1 }}>
                    <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                      <strong>Voluntary Consent:</strong> Opting into mobile messaging is voluntary. Consent is not a requirement to create an account or use the <strong>TutaMall.com (formerly OnlineMall.Website)</strong> or <strong>Vsingles</strong> services.
                    </Box>
                  </Typography>
                  <Typography component="li" variant="body1" sx={{ mb: 1 }}>
                    <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                      <strong>How to Opt-Out:</strong> You may cancel the SMS service at any time by texting &quot;<strong>STOP</strong>&quot; to the number from which you received the message. You will receive a final confirmation SMS to verify your unsubscription.
                    </Box>
                  </Typography>
                  <Typography component="li" variant="body1" sx={{ mb: 1 }}>
                    <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                      <strong>Support:</strong> For assistance, reply &quot;<strong>HELP</strong>&quot; to any message or contact support at <strong>privacy@OnlineMall.Website</strong>.
                    </Box>
                  </Typography>
                  <Typography component="li" variant="body1" sx={{ mb: 1 }}>
                    <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                      <strong>Charges:</strong> Message and data rates may apply. Message frequency varies based on your account activity, marketplace transactions, and dating interactions.
                    </Box>
                  </Typography>
                </Box>
                <Typography variant="h6" sx={sectionHeaderSx}>10. Arbitration and Class Action Waiver</Typography>
                <Typography variant="body1" paragraph>
                  Binding individual arbitration applies to all disputes arising under this agreement or through the use of any subdomains, set forth in the full terms of this agreement.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>11. Automatic Renewals</Typography>
                <Typography variant="body1" paragraph>
                  The auto-renewal process and instructions on how to disable it are provided within your account settings and at the point of purchase for any premium directory, classified, or dating packages.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                    Effective Date: May 18, 2025
                  </Box>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  © 2026 <strong>OnlineMall.Website</strong>. All Rights Reserved. (Including <strong>Vsingles</strong> Services)
                </Typography>
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 1 }}>
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
