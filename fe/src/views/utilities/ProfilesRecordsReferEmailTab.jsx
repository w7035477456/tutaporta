import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import GreenButton from 'ui-component/GreenButton';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { getMobileSinglesTextFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { getDesktopTextFontSizeVw } from 'config/desktopFontEnv';
import {
  inviteFriendsDraftBoxSx,
  inviteFriendsDraftTextSx,
  inviteFriendsWhiteInputFieldSx,
  inviteFriendsWhiteInputSlotProps
} from 'config/inviteFriendsDraftBox';
import { sendReferralInviteEmail } from 'api/sendReferralInviteEmailFe';
import { formatInviteFriendsMessage, formatInviteFriendsPromoFooter } from 'constants/inviteFriendsMessages';
import { useInviteFriendsMessageTemplates } from 'hooks/useInviteFriendsMessageTemplates';
import { buildRegisterReferralUrl, normalizeSignupReferralCode } from 'utils/signupReferralCode';

function isValidEmailFormat(raw) {
  const email = String(raw ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

const referEmailTextSx = {
  fontSize: { xs: getMobileSinglesTextFontSizeVw(), sm: getDesktopTextFontSizeVw() },
  lineHeight: 1.45,
  color: 'inherit'
};

const INVITE_STEPS = [
  'Confirm your Email or enter email of your choice, and click Send Email.',
  'When the message arrives in your inbox or phone, simply forward email to your friend. You may want to text your friend to expect your referral email.',
  "Earn tokens together! You and your friend will each get a free token the moment they sign up. Plus, there's no limit to your earnings—refer more friends to keep racking up tokens!"
];

export default function ProfilesRecordsReferEmailTab({ accountEmail, pageTextColor, hasReferralCode, myReferCode }) {
  const { template, loading: templatesLoading, error: templatesError, pickAnother } = useInviteFriendsMessageTemplates();
  const [email, setEmail] = useState(() => String(accountEmail ?? '').trim());
  const [optionalText, setOptionalText] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const referralUrl = useMemo(() => buildRegisterReferralUrl(myReferCode), [myReferCode]);
  const referCode = useMemo(() => normalizeSignupReferralCode(myReferCode), [myReferCode]);
  const promoFooter = useMemo(
    () => formatInviteFriendsPromoFooter(referralUrl, referCode),
    [referralUrl, referCode]
  );
  const forwardedMessage = useMemo(
    () => formatInviteFriendsMessage(template, referralUrl, referCode, optionalText),
    [template, referralUrl, referCode, optionalText]
  );
  const emailValid = useMemo(() => isValidEmailFormat(email), [email]);

  useEffect(() => {
    const next = String(accountEmail ?? '').trim();
    if (next) setEmail(next);
  }, [accountEmail]);

  const handleGenerateAnother = () => {
    pickAnother();
  };

  const handleSend = async () => {
    const trimmed = String(email ?? '').trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      setMessage('');
      return;
    }
    if (!hasReferralCode) {
      setError('Your referral code is not available yet. Complete registration to generate your invite link.');
      setMessage('');
      return;
    }
    if (!isValidEmailFormat(trimmed)) {
      setError('Please enter a valid email address.');
      setMessage('');
      return;
    }

    setSending(true);
    setError('');
    setMessage('');
    try {
      const data = await sendReferralInviteEmail(trimmed, { forwardedMessage });
      setMessage(data?.message || 'Invitation email sent. Check your inbox and forward it to your friend.');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to send invitation email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Stack spacing={2.5} sx={{ width: '100%' }}>
      <Typography sx={{ ...referEmailTextSx, color: pageTextColor, fontWeight: 700 }}>
        How to invite your friend:
      </Typography>
      <Box component="ol" sx={{ ...referEmailTextSx, color: pageTextColor, pl: 2.5, my: 0 }}>
        {INVITE_STEPS.map((step) => (
          <Typography component="li" key={step} sx={{ ...referEmailTextSx, color: pageTextColor, mb: 0.75 }}>
            {step}
          </Typography>
        ))}
      </Box>

      {!hasReferralCode ? (
        <Alert severity="info" sx={referEmailTextSx}>
          Your referral code is not available yet. Complete registration so your member number can generate your invite link.
        </Alert>
      ) : null}

      <Typography sx={{ ...referEmailTextSx, color: pageTextColor, fontWeight: 600 }}>
        Your email (where to receive the invite. Do NOT put your friend email here):
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-start' }}>
        <TextField
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          fullWidth
          size="small"
          disabled={sending}
          slotProps={inviteFriendsWhiteInputSlotProps()}
          sx={{
            flex: 1,
            ...inviteFriendsWhiteInputFieldSx,
            '& .MuiInputBase-input': {
              fontSize: referEmailTextSx.fontSize,
              lineHeight: referEmailTextSx.lineHeight
            }
          }}
        />
        <GreenButton
          type="button"
          disabled={sending || !hasReferralCode || !emailValid || templatesLoading || !template}
          onClick={() => void handleSend()}
        >
          {sending ? 'Sending…' : 'Send Email'}
        </GreenButton>
      </Stack>

      <Typography sx={{ ...referEmailTextSx, color: pageTextColor }}>
        Here is a draft we putting in email. Feel free to add your own text where indicated, or click &apos;Generate
        another posting text&apos; for a different version.
      </Typography>

      {templatesError ? (
        <Alert severity="error" sx={referEmailTextSx}>
          {templatesError}
        </Alert>
      ) : null}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <GreenButton
          type="button"
          onClick={handleGenerateAnother}
          disabled={!hasReferralCode || templatesLoading || !template}
          {...guestDemoAllowProps()}
        >
          Generate another posting text
        </GreenButton>
      </Box>

      {templatesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={28} />
        </Box>
      ) : null}

      {hasReferralCode ? (
        <Box sx={inviteFriendsDraftBoxSx}>
          {template ? (
            <Typography sx={{ ...referEmailTextSx, ...inviteFriendsDraftTextSx, mb: 1.5 }}>
              {template}
            </Typography>
          ) : null}

          <TextField
            fullWidth
            multiline
            minRows={2}
            placeholder="Optional: you can add you own text here."
            value={optionalText}
            onChange={(e) => setOptionalText(e.target.value)}
            disabled={sending}
            slotProps={inviteFriendsWhiteInputSlotProps()}
            sx={{ ...inviteFriendsWhiteInputFieldSx, mb: 1.5 }}
          />

          <Typography sx={{ ...referEmailTextSx, ...inviteFriendsDraftTextSx }}>
            {promoFooter}
          </Typography>
        </Box>
      ) : null}

      {message ? (
        <Alert severity="success" sx={referEmailTextSx}>
          {message}
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" sx={referEmailTextSx}>
          {error}
        </Alert>
      ) : null}
    </Stack>
  );
}

ProfilesRecordsReferEmailTab.propTypes = {
  accountEmail: PropTypes.string,
  pageTextColor: PropTypes.string,
  hasReferralCode: PropTypes.bool,
  myReferCode: PropTypes.string
};
