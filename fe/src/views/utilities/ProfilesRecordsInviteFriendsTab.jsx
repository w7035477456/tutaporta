import { useMemo, useState } from 'react';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';

import GreenButton from 'ui-component/GreenButton';
import { formatInviteFriendsMessage, formatInviteFriendsPromoFooter } from 'constants/inviteFriendsMessages';
import { useInviteFriendsMessageTemplates } from 'hooks/useInviteFriendsMessageTemplates';
import { buildRegisterReferralUrl, normalizeSignupReferralCode } from 'utils/signupReferralCode';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import {
  inviteFriendsDraftBoxSx,
  inviteFriendsDraftTextSx,
  inviteFriendsWhiteInputFieldSx,
  inviteFriendsWhiteInputSlotProps
} from 'config/inviteFriendsDraftBox';

const inviteFriendsTextSx = {
  fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
  lineHeight: 1.45,
  color: 'inherit'
};

export default function ProfilesRecordsInviteFriendsTab({ myReferCode, pageTextColor }) {
  const { template, loading, error, pickAnother } = useInviteFriendsMessageTemplates();
  const [optionalText, setOptionalText] = useState('');
  const [copied, setCopied] = useState(false);
  const referralUrl = useMemo(() => buildRegisterReferralUrl(myReferCode), [myReferCode]);
  const referCode = useMemo(() => normalizeSignupReferralCode(myReferCode), [myReferCode]);
  const hasReferralCode = Boolean(String(myReferCode ?? '').trim());
  const promoFooter = useMemo(
    () => formatInviteFriendsPromoFooter(referralUrl, referCode),
    [referralUrl, referCode]
  );
  const fullMessage = useMemo(
    () => formatInviteFriendsMessage(template, referralUrl, referCode, optionalText),
    [template, referralUrl, referCode, optionalText]
  );

  const handleGenerateAnother = () => {
    pickAnother();
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullMessage);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!hasReferralCode) {
    return (
      <Alert severity="info" sx={{ ...inviteFriendsTextSx, alignItems: 'flex-start' }}>
        Your referral code is not available yet. Complete registration so your member number can generate your invite link.
      </Alert>
    );
  }

  return (
    <Stack spacing={2} sx={{ width: '100%' }}>
      <Typography sx={{ ...inviteFriendsTextSx, color: pageTextColor }}>
        Share one of the messages below. Each <strong>[Link]</strong> is your personal signup URL (
        <Link href={referralUrl} target="_blank" rel="noopener noreferrer" underline="always" sx={{ color: 'inherit', fontWeight: 700 }}>
          {referralUrl}
        </Link>
        ). When friends register with that link, your code is recorded as their referrer.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ ...inviteFriendsTextSx, alignItems: 'flex-start' }}>
          {error}
        </Alert>
      ) : null}

      <Box>
        <GreenButton type="button" onClick={handleGenerateAnother} disabled={loading || !template}>
          Generate another posting text
        </GreenButton>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}

      <Box sx={{ ...inviteFriendsDraftBoxSx, position: 'relative', pt: 1.25 }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.75 }}>
          <GreenButton type="button" onClick={() => void handleCopy()}>
            {copied ? 'Copied' : 'Copy'}
          </GreenButton>
        </Box>

        {template ? (
          <Typography sx={{ ...inviteFriendsTextSx, ...inviteFriendsDraftTextSx, mb: 1.5 }}>
            {template}
          </Typography>
        ) : null}

        <TextField
          fullWidth
          multiline
          minRows={2}
          placeholder="Optional: you can add you own text here."
          value={optionalText}
          onChange={(e) => {
            setOptionalText(e.target.value);
            setCopied(false);
          }}
          slotProps={inviteFriendsWhiteInputSlotProps()}
          sx={{ ...inviteFriendsWhiteInputFieldSx, mb: 1.5 }}
        />

        <Typography sx={{ ...inviteFriendsTextSx, ...inviteFriendsDraftTextSx }}>
          {promoFooter}
        </Typography>
      </Box>
    </Stack>
  );
}
