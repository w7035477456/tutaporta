import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import PageInstructionPopup from 'ui-component/PageInstructionPopup';
import PageInstructionAudioTutorial from 'ui-component/PageInstructionAudioTutorial';
import PageInstructionEarnTokensAction from 'ui-component/PageInstructionEarnTokensAction';
import PageVideoTutorialsButton from 'ui-component/PageVideoTutorialsButton';
import EarnTokensPageTitle from 'ui-component/EarnTokensPageTitle';
import FriendshipStatesDiagramZoom from 'ui-component/FriendshipStatesDiagramZoom';
import friendShipStatesVFriendsImg from 'assets/images/friendShipStates_vFriends.png';
import audioVettedFriendsSora from 'assets/sound/vetted_friends_instruction_Sora.m4a';
import audioVettedFriendsJessica from 'assets/sound/vetted_friends_instruction_Jessica.m4a';
import audioVettedFriendsMichael from 'assets/sound/vetted_friends_instruction_Michael.m4a';
import {
  VETTED_FRIENDS_INSTRUCTION_CONTEXT_STEP,
  VETTED_FRIENDS_INSTRUCTION_CONTEXT_TITLE,
  VETTED_FRIENDS_INSTRUCTION_POPUP_TEXT
} from 'constants/vettedFriendsInstructionText';

import MainCard from 'ui-component/cards/MainCard';
import { useGetRequestsSent } from 'api/requestsSentFe';
import { dismissAllBioResponseNotifications } from 'api/bioRequestNotificationsFe';
import { triStateBioRequestApproval, isOutgoingBioRequestApproved } from 'utils/receivedBioRequestDisplay';
import { dispatchBellNotificationRefresh } from 'utils/notificationBellStore';
import api from 'api/axios';
import { useAuth } from 'contexts/AuthContext';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { upsertFriendFromRequestRow } from 'utils/chatWithFriendsStore';
import { formatMemberLabel } from 'utils/memberLabel';
import { getThemeOptionsFromEnv } from 'utils/themeConfig';
import { themedAlert } from 'utils/themedDialog';
import friendsPurpleBg from 'assets/images/friends_purple.png';
import friendsPinkBg from 'assets/images/friends_pink.png';
import friendsRedBg from 'assets/images/friends_red.png';
import friendsSilverBg from 'assets/images/friends_silver.png';
import friendsBlueBg from 'assets/images/friends_blue.png';
import VettedFriendsPicksLayout from 'views/utilities/VettedFriendsPicksLayout';
import VettedFriendsBioViewTokenPopup from 'views/utilities/VettedFriendsBioViewTokenPopup';
import {
  checkApprovedBioPrefixGate,
  resolveViewerPrefixForBioUnlock
} from 'utils/approvedBioViewPrefixGate';
import useConfig from 'hooks/useConfig';
import { SIDEBAR_MOBILE_CLOSE_MEDIA } from 'config/sidebarMobileCloseEnv';
import { focusMainScrollColumn } from 'utils/focusMainScrollColumn';
import {
  appPageScrollHostCardSx,
  buildAppPageScrollRegionSx,
  getAppPageScrollRegionBottomPaddingCss,
  getAppPageScrollRegionMaxHeightCss,
  getAppPageZoomFactor
} from 'utils/appPageScrollRegionEnv';
import FirstVisitPageWelcomePopup from 'ui-component/FirstVisitPageWelcomePopup';
import useFirstVisitPageWelcomePopup from 'hooks/useFirstVisitPageWelcomePopup';

const FRIENDS_BG_BY_THEME_FAMILY = {
  purple: friendsPurpleBg,
  pink: friendsPinkBg,
  red: friendsRedBg,
  silver: friendsSilverBg,
  blue: friendsBlueBg
};

const SEND_MESSAGE_NOT_APPROVED_ERROR = 'Error, user have not approved viewing bio.  Once view bio approved, you can then send message.';

const VETTED_FRIENDS_INSTRUCTION_AUDIO_BY_VOICE = {
  Sora: typeof audioVettedFriendsSora === 'string' ? audioVettedFriendsSora : audioVettedFriendsSora?.default || '',
  Jessica:
    typeof audioVettedFriendsJessica === 'string'
      ? audioVettedFriendsJessica
      : audioVettedFriendsJessica?.default || '',
  Michael:
    typeof audioVettedFriendsMichael === 'string'
      ? audioVettedFriendsMichael
      : audioVettedFriendsMichael?.default || ''
};

function triStateApproval(value) {
  return triStateBioRequestApproval(value);
}

function normalizeCssColor(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function resolveThemeFamilyFromCss(themeOptions) {
  if (typeof document === 'undefined') return 'silver';
  const style = getComputedStyle(document.documentElement);
  const currentPrimary = normalizeCssColor(style.getPropertyValue('--theme-primary-color'));
  const currentSecondary = normalizeCssColor(style.getPropertyValue('--theme-secondary-color'));
  const match = themeOptions.find(
    (option) => normalizeCssColor(option?.primaryColor) === currentPrimary && normalizeCssColor(option?.secondaryColor) === currentSecondary
  );
  const name = String(match?.name || '').toLowerCase();
  if (name.includes('purple')) return 'purple';
  if (name.includes('pink')) return 'pink';
  if (name.includes('red')) return 'red';
  if (name.includes('blue')) return 'blue';
  if (name.includes('silver')) return 'silver';
  return 'silver';
}

/** Page title + section headings — fe/.env MOBILE_FONT_SIZE_TITLE / DESKTOP_FONT_SIZE_TITLE */
const titleFontSx = {
  color: 'var(--theme-primary-color)',
  fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() }
};

export default function RequestsSent() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const vettedFriendsPhoneLayout = useMediaQuery(SIDEBAR_MOBILE_CLOSE_MEDIA);
  const {
    state: { pageZoom }
  } = useConfig();
  const [inlineChatOpen, setInlineChatOpen] = useState(false);
  const handleInlineChatOpenChange = useCallback((open) => {
    setInlineChatOpen(Boolean(open));
  }, []);
  const scrollRegionSx = useMemo(() => {
    if (vettedFriendsPhoneLayout) {
      return {
        flex: '0 1 auto',
        minHeight: 'auto',
        overflow: 'visible',
        width: '100%',
        display: 'block',
        pb: getAppPageScrollRegionBottomPaddingCss(1)
      };
    }
    if (inlineChatOpen) {
      // Chat pins composer in-panel; outer page scroll only exposed empty space.
      return {
        flex: 1,
        minHeight: 0,
        maxHeight: getAppPageScrollRegionMaxHeightCss(downSM ? 1 : getAppPageZoomFactor(pageZoom)),
        overflow: 'hidden',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        pb: 0
      };
    }
    return buildAppPageScrollRegionSx(downSM ? 1 : getAppPageZoomFactor(pageZoom));
  }, [downSM, pageZoom, vettedFriendsPhoneLayout, inlineChatOpen]);
  const { user } = useAuth();
  const {
    open: firstVisitWelcomeOpen,
    onClose: closeFirstVisitWelcome
  } = useFirstVisitPageWelcomePopup('firstVisitAcquaintBuddies', { userSinglesId: user?.singles_id });
  const themeOptions = useMemo(() => getThemeOptionsFromEnv(), []);
  const [themeFamily, setThemeFamily] = useState(() => resolveThemeFamilyFromCss(themeOptions));
  const { requestsSent, requestsSentLoading, requestsSentError, refetch } = useGetRequestsSent();
  const [viewChargeDialogState, setViewChargeDialogState] = useState({
    open: false,
    mode: 'confirm',
    row: null,
    viewKind: 'basic',
    tokenBalance: 0,
    requiredTokens: 1
  });
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [unlockApprovedBioViewKind, setUnlockApprovedBioViewKind] = useState(null);
  const [bioViewConsentCapture, setBioViewConsentCapture] = useState(null);

  const rows = useMemo(() => {
    const myId = user?.singles_id != null ? Number(user.singles_id) : null;
    const myIdOk = Number.isFinite(myId);
    return requestsSent.filter((x) => {
      if (!Number.isFinite(x?.singles_id_to) || !Number.isFinite(x?.singles_id_from)) return false;
      // Backend already scopes by JWT; this only guards stale/cache mismatch. Use numeric compare:
      // string `user.singles_id` vs number `singles_id_from` would make `!==` drop every row.
      if (myIdOk && Number(x.singles_id_from) !== myId) return false;
      return true;
    });
  }, [requestsSent, user?.singles_id]);
  const query = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const focusSinglesId = Number(query.get('focusChat') ?? location.state?.focusSinglesId);
  const openChatFromNotification = location.state?.openChat === true;

  useEffect(() => {
    const hasQueryFocus = String(query.get('focusChat') ?? '').trim().length > 0;
    if (!hasQueryFocus && !location.state?.openChat && !location.state?.focusSinglesId) return;
    navigate({ pathname: location.pathname, search: '' }, { replace: true, state: null });
  }, [location.pathname, location.state, location.search, navigate, query]);

  useLayoutEffect(() => {
    focusMainScrollColumn();
  }, []);

  useLayoutEffect(() => {
    if (requestsSentLoading || requestsSentError) return;
    focusMainScrollColumn();
  }, [requestsSentLoading, requestsSentError]);

  useEffect(() => {
    void (async () => {
      try {
        await dismissAllBioResponseNotifications();
        dispatchBellNotificationRefresh('bio');
      } catch (err) {
        console.warn('[RequestsSent] dismiss bio response notifications failed', err?.message ?? err);
      }
    })();
  }, []);

  /** Left-rail cards: outgoing requests where recipient approved Brief or Full bio. */
  const photoStackRows = useMemo(() => rows.filter(isOutgoingBioRequestApproved), [rows]);

  const closeViewChargeDialog = useCallback(() => {
    setViewChargeDialogState((prev) => ({ ...prev, open: false, row: null }));
  }, []);

  const openViewChargeDialog = useCallback(async ({ row, viewKind, requiredTokens = 1 }) => {
    let tokenBalance = 0;
    try {
      const { data } = await api.get('/api/settings/profile');
      tokenBalance = Number.isFinite(Number(data?.token_balance)) ? Number(data.token_balance) : 0;
    } catch {
      tokenBalance = 0;
    }
    setViewChargeDialogState({
      open: true,
      mode: tokenBalance >= requiredTokens ? 'confirm' : 'insufficient',
      row,
      viewKind,
      tokenBalance,
      requiredTokens
    });
  }, []);

  const handleConfirmDebitAndProceed = async () => {
    const row = viewChargeDialogState.row;
    const viewKind = viewChargeDialogState.viewKind;
    if (!row || row.singles_id_to == null) return;
    try {
      await api.post('/api/requestedSingles/debitView', {
        target_singles_id: Number(row.singles_id_to),
        view_kind: viewKind
      });
      await refetch();
      setViewChargeDialogState((prev) => ({ ...prev, open: false, row: null }));
      const unlockKind = viewKind === 'detail' ? 'full' : 'brief';
      setUnlockApprovedBioViewKind(unlockKind);
      setBioViewConsentCapture({
        targetSinglesId: Number(row.singles_id_to),
        bioKind: unlockKind,
        nonce: Date.now()
      });
    } catch (err) {
      closeViewChargeDialog();
      await themedAlert(err?.response?.data?.error || err?.message || 'Failed to process token debit');
    }
  };

  const handleApprovedViewClick = async (row, viewKind) => {
    if (!row || row.singles_id_to == null) return;
    const viewerPrefix = await resolveViewerPrefixForBioUnlock(user);
    const gate = checkApprovedBioPrefixGate(viewerPrefix, row.prefix);
    if (!gate.ok) {
      await themedAlert(gate.message);
      return;
    }
    await openViewChargeDialog({
      row,
      viewKind,
      requiredTokens: viewKind === 'detail' ? 2 : 1
    });
  };

  const prepareInlineChat = async (row) => {
    if (!row || row.singles_id_to == null) return false;
    const viewerPrefix = await resolveViewerPrefixForBioUnlock(user);
    const gate = checkApprovedBioPrefixGate(viewerPrefix, row.prefix);
    if (!gate.ok) {
      await themedAlert(SEND_MESSAGE_NOT_APPROVED_ERROR);
      return false;
    }
    upsertFriendFromRequestRow(row);
    return true;
  };

  const openSendFlower = (row) => {
    if (!row || row.singles_id_to == null) return;
    navigate('/send-flower', { state: { targetSinglesId: Number(row.singles_id_to) } });
  };

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const root = document.documentElement;
    const refreshTheme = () => {
      setThemeFamily(resolveThemeFamilyFromCss(themeOptions));
    };
    refreshTheme();
    const observer = new MutationObserver(refreshTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['style', 'class'] });
    return () => observer.disconnect();
  }, [themeOptions]);

  const pageBackgroundImage = FRIENDS_BG_BY_THEME_FAMILY[themeFamily] || FRIENDS_BG_BY_THEME_FAMILY.silver;

  const dialogTargetMemberLabel = viewChargeDialogState.row
    ? formatMemberLabel({
        alias: viewChargeDialogState.row.alias,
        singlesId: viewChargeDialogState.row.singles_id_to,
        prefix: viewChargeDialogState.row.prefix,
        memberId: viewChargeDialogState.row.member_id
      })
    : 'Selected member';
  const approvedViewPopupKind = viewChargeDialogState.viewKind === 'detail' ? 'full' : 'brief';

  return (
    <>
      <MainCard
        title={
          <EarnTokensPageTitle>
            <Box component="span" sx={titleFontSx}>
              Acquaint. & Buddies
            </Box>
          </EarnTokensPageTitle>
        }
        center={<PageVideoTutorialsButton pageKey="acquaintBuddies" />}
        secondary={<PageInstructionEarnTokensAction onInstructionClick={() => setInstructionOpen(true)} />}
        headerSX={{
          alignItems: 'center',
          '& .MuiCardHeader-title': {
            ...titleFontSx,
            lineHeight: 1.2
          }
        }}
        sx={{
          ...appPageScrollHostCardSx,
          ...(vettedFriendsPhoneLayout
            ? { flex: '0 1 auto', minHeight: 'auto', height: 'auto', maxHeight: 'none', overflow: 'visible' }
            : null)
        }}
        contentSX={{
          ...(vettedFriendsPhoneLayout
            ? { flex: '0 1 auto', minHeight: 'auto', overflow: 'visible', display: 'flex', flexDirection: 'column' }
            : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' })
        }}
      >
        {requestsSentLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : null}

        {requestsSentError ? (
          <Alert severity="error">
            Failed to load requests.
            <Box component="pre" sx={{ mt: 1, fontSize: '0.75rem', overflow: 'auto', maxHeight: 120 }}>
              {requestsSentError?.message ?? String(requestsSentError)}
            </Box>
          </Alert>
        ) : null}

        {!requestsSentLoading && !requestsSentError ? (
          <Box sx={scrollRegionSx}>
            <Box
              sx={{
                width: '100%',
                p: { xs: 1, sm: 1.5 },
                borderRadius: 1,
                backgroundImage: `url(${pageBackgroundImage})`,
                backgroundSize: 'cover',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
                ...(inlineChatOpen
                  ? {
                      flex: 1,
                      minHeight: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      boxSizing: 'border-box'
                    }
                  : null)
              }}
            >
              {rows.length === 0 ? (
                <Typography>No outgoing request found.</Typography>
              ) : photoStackRows.length ? (
                <VettedFriendsPicksLayout
                  rows={photoStackRows}
                  onApprovedViewClick={handleApprovedViewClick}
                  unlockApprovedBioViewKind={unlockApprovedBioViewKind}
                  onUnlockApprovedBioViewConsumed={() => setUnlockApprovedBioViewKind(null)}
                  bioViewConsentCapture={bioViewConsentCapture}
                  onBioViewConsentCaptureConsumed={() => setBioViewConsentCapture(null)}
                  onBioRequestUpdated={refetch}
                  onPrepareInlineChat={prepareInlineChat}
                  onSendFlower={openSendFlower}
                  initialSelectedSinglesId={Number.isFinite(focusSinglesId) && focusSinglesId > 0 ? focusSinglesId : null}
                  initialOpenChat={openChatFromNotification || (Number.isFinite(focusSinglesId) && focusSinglesId > 0)}
                  onInlineChatOpenChange={handleInlineChatOpenChange}
                />
              ) : (
                <Typography sx={{ color: 'red', fontWeight: 700, fontSize: '1.5rem' }}>
                  Currently there is no users who have responded to your bio requests
                </Typography>
              )}
            </Box>
          </Box>
        ) : null}
      </MainCard>

      <FirstVisitPageWelcomePopup
        pageKey="acquaintBuddies"
        open={firstVisitWelcomeOpen}
        onClose={closeFirstVisitWelcome}
      />

      <PageInstructionPopup
        open={instructionOpen}
        onClose={() => setInstructionOpen(false)}
        closeOnBackdrop
        bodyTextAlignLeft
        centeredLeadLines={1}
      >
        <PageInstructionPopup.Body>
          <PageInstructionAudioTutorial
            active={instructionOpen}
            audioByVoice={VETTED_FRIENDS_INSTRUCTION_AUDIO_BY_VOICE}
            title={VETTED_FRIENDS_INSTRUCTION_CONTEXT_TITLE}
            contextStep={VETTED_FRIENDS_INSTRUCTION_CONTEXT_STEP}
          />
          <PageInstructionPopup.BodyText sx={{ whiteSpace: 'pre-line' }}>
            {VETTED_FRIENDS_INSTRUCTION_POPUP_TEXT}
          </PageInstructionPopup.BodyText>
          <FriendshipStatesDiagramZoom
            imageSrc={friendShipStatesVFriendsImg}
            imageAlt="Vetted Friends friendship states diagram"
          />
        </PageInstructionPopup.Body>
      </PageInstructionPopup>

      <VettedFriendsBioViewTokenPopup
        open={viewChargeDialogState.open}
        onClose={closeViewChargeDialog}
        onApprove={handleConfirmDebitAndProceed}
        bioKind={approvedViewPopupKind}
        mode={viewChargeDialogState.mode}
        tokenBalance={viewChargeDialogState.tokenBalance}
        requiredTokens={viewChargeDialogState.requiredTokens}
        memberLabel={dialogTargetMemberLabel}
      />
    </>
  );
}
