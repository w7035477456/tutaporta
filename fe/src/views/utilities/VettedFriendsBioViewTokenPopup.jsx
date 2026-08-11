import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import {
  PROFILES_RECORDS_PATH,
  PROFILES_RECORDS_TAB_INVITE_FRIENDS,
  PROFILES_RECORDS_TAB_POST_FB
} from 'constants/profilesRecordsRoute';
import { useNavigate } from 'react-router-dom';
import { earnTokensGreenSelectedButtonSx } from 'config/earnTokensGreenButton';

const leftBodyTextSx = { textAlign: 'left' };
const leftListBodyTextSx = { textAlign: 'left', pl: 2.5, my: 0 };
const tokenBalanceErrorBarSx = {
  bgcolor: 'var(--theme-primary-color)',
  color: 'var(--theme-white-color)'
};

const tokenSummaryWrapSx = {
  my: 1,
  width: '100%',
  boxSizing: 'border-box'
};

const tokenSummaryGridSx = {
  display: 'grid',
  gridTemplateColumns: 'max-content minmax(0, max-content)',
  columnGap: 1,
  rowGap: 0.5,
  alignItems: 'center',
  justifyContent: 'start',
  width: '100%'
};

const tokenSummaryLabelSx = {
  ...leftBodyTextSx,
  my: 0,
  whiteSpace: 'nowrap'
};

function TokenSummaryRow({ label, value }) {
  return (
    <>
      <ColorTemplate7PopupLargeDark.BodyText component="div" sx={tokenSummaryLabelSx}>
        {label}
      </ColorTemplate7PopupLargeDark.BodyText>
      <SelectedButtonTemplate
        type="button"
        hoverScale={1}
        selectedLabelScale={1}
        fitLabelWidth
        tabIndex={-1}
        aria-hidden
        onClick={() => {}}
        sx={{
          minWidth: '5.75rem',
          pointerEvents: 'none',
          cursor: 'default'
        }}
      >
        {value}
      </SelectedButtonTemplate>
    </>
  );
}

TokenSummaryRow.propTypes = {
  label: PropTypes.node.isRequired,
  value: PropTypes.node.isRequired
};

function tokenCountLabel(count) {
  const n = Math.max(0, Number(count) || 0);
  return `${n} Token${n === 1 ? '' : 's'}`;
}

function resolveUnlockTokenCost(bioKind, requiredTokens) {
  if (Number.isFinite(Number(requiredTokens)) && Number(requiredTokens) > 0) {
    return Number(requiredTokens);
  }
  return bioKind === 'full' ? 2 : 1;
}

function BioViewGreenActionButton({ children, onClick }) {
  return (
    <SelectedButtonTemplate
      type="button"
      hoverScale={1}
      selectedLabelScale={1}
      onClick={onClick}
      sx={earnTokensGreenSelectedButtonSx({ popupAction: true })}
    >
      <Box component="span" className="hover-magnify-label">
        {children}
      </Box>
    </SelectedButtonTemplate>
  );
}

BioViewGreenActionButton.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func.isRequired
};

/**
 * Task 1 / Task 2 — ColorTemplate7 popup before approved "Click to view" when brief_paid / full_paid is false.
 */
export default function VettedFriendsBioViewTokenPopup({
  open,
  onClose,
  onApprove,
  bioKind = 'brief',
  mode = 'confirm',
  tokenBalance = 0,
  requiredTokens = 1,
  memberLabel = 'this member'
}) {
  const navigate = useNavigate();
  const isFullBio = bioKind === 'full';
  const unlockLabel = isFullBio
    ? 'View Buddies Bio (Full Bio)'
    : 'View Acquaintance Bio (Brief Bio)';
  const balance = Math.max(0, Number(tokenBalance) || 0);
  const cost = resolveUnlockTokenCost(bioKind, requiredTokens);
  const balanceAfterUnlock = balance - cost;

  const goToProfilesTab = (openTab, { tokensBuying } = {}) => {
    onClose();
    const state = { openTab };
    const tokensToBuy = Number(tokensBuying);
    if (Number.isFinite(tokensToBuy) && tokensToBuy > 0) {
      state.tokensBuying = String(Math.trunc(tokensToBuy));
    }
    navigate(PROFILES_RECORDS_PATH, { state });
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeOnBackdrop
      closeButtonAriaLabel="Close bio view token popup"
    >
      <ColorTemplate7PopupLargeDark.Body>
        <ColorTemplate7PopupLargeDark.Title>Token Debit confirmation</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText sx={leftBodyTextSx}>
          Great news! <strong>{memberLabel}</strong> approved your request to view their{' '}
          {unlockLabel}. To open it now, a small token fee unlocks this profile view on your
          account.
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText sx={leftBodyTextSx}>
          Demo and testing accounts are excluded from the Bio exchange. Rest assured, your tokens are only used to
          unlock real, authentic profiles.
        </ColorTemplate7PopupLargeDark.BodyText>
        <ColorTemplate7PopupLargeDark.BodyText sx={leftBodyTextSx}>
          One Time Fee will unlock for 12 twelve months and updates.
        </ColorTemplate7PopupLargeDark.BodyText>

        <ColorTemplate7PopupLargeDark.SectionLabel sx={leftBodyTextSx}>
          Choose Your Connection Level
        </ColorTemplate7PopupLargeDark.SectionLabel>
        <ColorTemplate7PopupLargeDark.BodyText component="ul" sx={leftListBodyTextSx}>
          <li>
            <strong>Brief Bio (1 Token)</strong> — Get a quick snapshot of who they are.
          </li>
          <li>
            <strong>Full Bio (2 Tokens — Best Value!)</strong> — Get the complete picture, including chat and album
            access.
          </li>
        </ColorTemplate7PopupLargeDark.BodyText>

        <ColorTemplate7PopupLargeDark.SectionLabel sx={leftBodyTextSx}>
          Click Buy Token below or Earn Free Tokens:
        </ColorTemplate7PopupLargeDark.SectionLabel>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
            width: '100%',
            flexWrap: 'wrap'
          }}
        >
          <Stack spacing={1} sx={{ flex: '1 1 12rem', minWidth: 0 }}>
            <ColorTemplate7PopupLargeDark.BodyText sx={{ ...leftBodyTextSx, my: 0 }}>
              • Invite friends to join - earn tokens when they sign up
            </ColorTemplate7PopupLargeDark.BodyText>
            <ColorTemplate7PopupLargeDark.BodyText sx={{ ...leftBodyTextSx, my: 0 }}>
              • Post about us on Facebook - share your journey and earn tokens
            </ColorTemplate7PopupLargeDark.BodyText>
          </Stack>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, flexShrink: 0 }}>
            <Stack spacing={1} alignItems="stretch">
              <BioViewGreenActionButton onClick={() => goToProfilesTab(PROFILES_RECORDS_TAB_INVITE_FRIENDS)}>
                Click to Invite Friends
              </BioViewGreenActionButton>
              <BioViewGreenActionButton onClick={() => goToProfilesTab(PROFILES_RECORDS_TAB_POST_FB)}>
                Click to Post FB
              </BioViewGreenActionButton>
            </Stack>
          </Box>
        </Box>

        {mode === 'insufficient' ? (
          <ColorTemplate7PopupLargeDark.ErrorBar sx={tokenBalanceErrorBarSx}>
            Your current balance is {tokenCountLabel(balance)}. You need {tokenCountLabel(cost)} to unlock {unlockLabel}.
            Please buy more tokens, then tap <strong>{unlockLabel}</strong> again.
          </ColorTemplate7PopupLargeDark.ErrorBar>
        ) : null}

        <Box sx={tokenSummaryWrapSx}>
          <Box sx={tokenSummaryGridSx}>
            <TokenSummaryRow label="Your Token Balance:" value={tokenCountLabel(balance)} />
            <TokenSummaryRow
              label={
                <>
                  Unlock <strong>{unlockLabel}</strong>:
                </>
              }
              value={tokenCountLabel(cost)}
            />
            {balanceAfterUnlock > 0 ? (
              <TokenSummaryRow label="Remain Balance after:" value={tokenCountLabel(balanceAfterUnlock)} />
            ) : balanceAfterUnlock < 0 ? (
              <TokenSummaryRow label="Tokens needed to buy/earn:" value={tokenCountLabel(cost - balance)} />
            ) : (
              <TokenSummaryRow label="Remain Balance after:" value={tokenCountLabel(0)} />
            )}
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap">
          <UnSelectedButtonTemplate onClick={onClose}>Cancel</UnSelectedButtonTemplate>
          {mode === 'confirm' ? (
            <UnSelectedButtonTemplate onClick={onApprove}>Confirm Pay</UnSelectedButtonTemplate>
          ) : (
            <UnSelectedButtonTemplate onClick={() => goToProfilesTab('buyTokens', { tokensBuying: cost })}>
              Go to Buy Token
            </UnSelectedButtonTemplate>
          )}
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

VettedFriendsBioViewTokenPopup.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onApprove: PropTypes.func,
  bioKind: PropTypes.oneOf(['brief', 'full']),
  mode: PropTypes.oneOf(['confirm', 'insufficient']),
  tokenBalance: PropTypes.number,
  requiredTokens: PropTypes.number,
  memberLabel: PropTypes.string
};
