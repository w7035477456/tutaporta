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

// ================================|| PRIVACY POLICY ||================================ //

export default function PrivacyPolicy() {
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
  const sectionHeaderSx = {
    fontWeight: 700,
    fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
    mt: 0.2
  };

  return (
    <AuthWrapper1>
      <Stack sx={{ ...authShellStackSx, ...authFixedFooterContentPaddingBottom, justifyContent: 'flex-start', overflow: 'hidden', height: '100dvh', minHeight: '100dvh' }}>
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
                  Privacy Policy
                </Typography>
                <Typography variant="body1" paragraph>
                  This policy outlines <strong>OnlineMall.Website</strong>&apos;s privacy protocols for data gathering, storage, usage, and sharing. It applies to all information collected via Services (including its eMarketing directories, Classified Ads marketplace, its specialized dating subdomain <strong>Vsingles</strong>, mobile applications, and websites managed by <strong>OnlineMall.Website</strong> and its corporate partners). By using the Services, you agree to the Privacy Policy and Terms and Conditions. The policy may be updated; continued use after updates signifies agreement.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>1. Data Collection: What and How</Typography>
                <Typography variant="body1" component="div" paragraph>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    <Box component="li" sx={{ mb: 0.5 }}><strong>Personal Information:</strong> Collected to facilitate marketplace listings, transactions, and dating matchmaking. Includes names, emails, phone numbers, addresses, birth dates, dating/search preferences, and notes. For users utilizing the <strong>Vsingles</strong> service, a Compatibility Quiz generates personality profiles, and uploaded dating photos may be visible to other users.</Box>
                    <Box component="li" sx={{ mb: 0.5 }}><strong>Communications:</strong> We store communications with support, marketplace buyers/sellers, or other platform members.</Box>
                    <Box component="li" sx={{ mb: 0.5 }}><strong>Subscriptions:</strong> We process names, addresses, and payment details for premium marketplace listings and premium dating tiers; you can request removal of payment data.</Box>
                    <Box component="li" sx={{ mb: 0.5 }}><strong>Sensitive Information:</strong> You may voluntarily provide sensitive information (e.g., religion, ethnicity, gender identity), which you can update or hide.</Box>
                    <Box component="li" sx={{ mb: 0.5 }}><strong>Biometrics:</strong> May be used with consent for identity verification or fraud prevention.</Box>
                    <Box component="li"><strong>Automated Collection:</strong> We automatically collect technical data (IP, browser, ISP, device IDs) and use cookies and web beacons. Essential cookies support security and navigation, while analytics cookies help understand usage. You can disable cookies, but some features may not work.</Box>
                  </Box>
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>2. Purpose of Data Usage</Typography>
                <Typography variant="body1" paragraph>
                  Information is used to operate and secure the platform, maintain user profiles and show relevant fields to matches, process transactions and offer promotions, verify identities via SMS, conduct anonymized research, and address legal claims and regulatory requirements.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>3. Sharing and Disclosure</Typography>
                <Typography variant="body1" component="div" paragraph>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    <Box component="li" sx={{ mb: 0.5 }}><strong>No Sale:</strong> <strong>OnlineMall.Website</strong> and <strong>Vsingles</strong> do not sell your contact information or personal details to third parties.</Box>
                    <Box component="li"><strong>Permitted Sharing:</strong> We may share profile details (login status, compatibility scores, photos, and public classified listings) with potential matches or marketplace browsers; with service providers (hosting, payments, SMS authentication, support); for legal reasons (subpoenas, safety); for abuse prevention; and in connection with business transfers (merger or asset sale).</Box>
                  </Box>
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>4. Security and Global Transfers</Typography>
                <Typography variant="body1" paragraph>
                  We utilize firewalls, SSL encryption, and physical security measures. Servers are located in the United States and Germany. Data may be transferred across borders. Using the service implies consent to these transfers.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>5. Your Rights and Choices</Typography>
                <Typography variant="body1" paragraph>
                  You can opt out of promotional emails. You have the right to request a copy of your data or corrections (some changes require verification). Basic members can delete profiles via &quot;Data &amp; Settings.&quot; Premium members or those with unused purchases may need to submit a request. Inactive Basic account data is generally deleted after 2 years; Premium data is kept for the membership duration, after which Basic rules apply.
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>6. Jurisdiction-Specific Information</Typography>
                <Typography variant="body1" component="div" paragraph>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    <Box component="li" sx={{ mb: 0.5 }}><strong>U.S. Residents:</strong> May have specific rights regarding targeted advertising. <strong>OnlineMall.Website</strong> does not sell user data for cross-contextual behavioral advertising.</Box>
                    <Box component="li"><strong>California (CCPA/CPRA) Residents:</strong> Have additional rights regarding access and deletion.</Box>
                  </Box>
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>7. SMS Messaging and Data Privacy</Typography>
                <Typography variant="body1" paragraph>
                  <strong>OnlineMall.Website</strong> is committed to protecting your privacy regarding mobile communications.
                </Typography>
                <Typography variant="body1" component="div" paragraph>
                  <Box component="ul" sx={{ m: 0, pl: 3 }}>
                    <Box component="li" sx={{ mb: 0.5 }}>
                      <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                        <strong>No Sharing:</strong> Mobile information will not be shared with third parties/affiliates for marketing/promotional purposes.
                      </Box>
                    </Box>
                    <Box component="li">
                      <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                        <strong>Exclusion:</strong> All the above categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties.
                      </Box>
                    </Box>
                  </Box>
                </Typography>
                <Typography variant="h6" sx={sectionHeaderSx}>8. Contact and Disputes</Typography>
                <Typography variant="body1" paragraph>
                  For privacy concerns or to exercise data rights, you can contact <strong>OnlineMall.Website</strong> at <strong>privacy@OnlineMall.Website</strong>.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <Box component="span" sx={{ backgroundColor: '#FFF3CD' }}>
                    Effective Date: May 18, 2025.
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
