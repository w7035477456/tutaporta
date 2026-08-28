import { Activity, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Avatar from '@mui/material/Avatar';
import Button from '@mui/material/Button';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Paper from '@mui/material/Paper';
import Popper from '@mui/material/Popper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
// project imports
import MainCard from 'ui-component/cards/MainCard';
import Transitions from 'ui-component/extended/Transitions';
import NotificationList from './NotificationList';
import useChatUnreadSenderCount from 'hooks/useChatUnreadSenderCount';
import { VETTED_FRIENDS_PATH } from 'routes/vettedFriendsPaths';
import {
  dismissAllMyPicksPostNotifications,
  dismissMyPicksPostNotification,
  useGetMyPicksPostNotifications
} from 'api/myPicksFe';
import {
  dismissAllPaymentBalanceNotifications,
  dismissPaymentBalanceNotification,
  useGetPaymentBalanceNotifications
} from 'api/paymentNotificationsFe';
import {
  dismissAllBioRequestNotifications,
  dismissBioRequestNotification,
  useGetBioRequestNotifications,
  useGetReceivedBioRequestsPendingCount,
  useGetVettedFriendsBioResponsePendingCount
} from 'api/bioRequestNotificationsFe';
import { useGetUnreadChatNotifications } from 'api/chatWithFriendsFe';
import { PROFILES_RECORDS_PATH, PROFILES_RECORDS_TAB_PAY_HISTORY } from 'constants/profilesRecordsRoute';
import { RECEIVED_BIO_REQUESTS_PATH } from 'constants/receivedBioRequestsRoute';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { getHoverMagnifyFactor } from 'config/hoverMagnifyEnv';
import {
  NOTIFICATION_BADGE_FONT_SIZE,
  NOTIFICATION_BADGE_SIZE,
  NOTIFICATION_BELL_ICON_SIZE,
  NOTIFICATION_BELL_SIZE,
  notificationBellHoverSizeCss
} from 'config/notificationIconSizeEnv';
import { markChatVisitedApi } from 'api/chatWithFriendsFe';
import { isAutoUiUpdateEnabled } from 'config/autoUiUpdateEnv';
import { BELL_NOTIFICATION_REFRESH_EVENT } from 'utils/notificationBellStore';
import { getDesktopButtonFontSizeVw } from 'config/desktopFontEnv';
import { getMobileSinglesButtonFontSizeVw } from 'config/singlesMemberCardFontEnv';

// assets
import { IconBell } from '@tabler/icons-react';

// ==============================|| NOTIFICATION ||============================== //

export default function NotificationSection({ clusterTight = false, placement = 'header' }) {
  const inline = placement === 'inline';
  const inlineBellHoverFactor = getHoverMagnifyFactor();
  const inlineBellHoverSize = notificationBellHoverSizeCss(inlineBellHoverFactor);
  const theme = useTheme();
  const downMD = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [markAllPending, setMarkAllPending] = useState(false);
  const [autoUiChatUpdate, setAutoUiChatUpdate] = useState(true);
  const [autoUiPostUpdate, setAutoUiPostUpdate] = useState(true);
  /** HTTP only: refetch on bell open / Refresh Posts & Chats. */
  const { refreshCount: refreshUnreadChatCount } = useChatUnreadSenderCount(true, {
    manualOnly: true
  });
  const { postNotifications, postNotificationsLoading, postNotificationsError, refetchPostNotifications } =
    useGetMyPicksPostNotifications(true, { autoFetch: autoUiPostUpdate });
  const {
    unreadChatMessages,
    unreadChatMessagesLoading,
    unreadChatMessagesError,
    refetchUnreadChatMessages
  } = useGetUnreadChatNotifications(true, { autoFetch: autoUiChatUpdate });
  const {
    balanceNotifications,
    balanceNotificationsLoading,
    balanceNotificationsError,
    refetchBalanceNotifications
  } = useGetPaymentBalanceNotifications(true, { autoFetch: true });
  const {
    bioRequestNotifications,
    bioRequestNotificationsLoading,
    bioRequestNotificationsError,
    refetchBioRequestNotifications
  } = useGetBioRequestNotifications(true, { autoFetch: true });
  const { refetchPendingCount } = useGetReceivedBioRequestsPendingCount(true);
  const { refetchBioResponsePendingCount } = useGetVettedFriendsBioResponsePendingCount(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/publicConfig`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setAutoUiChatUpdate(isAutoUiUpdateEnabled(data?.autoUiChatUpdate));
        setAutoUiPostUpdate(isAutoUiUpdateEnabled(data?.autoUiPostUpdate));
      } catch {
        if (!cancelled) {
          setAutoUiChatUpdate(true);
          setAutoUiPostUpdate(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const mergedNotifications = useMemo(() => {
    const postRows = (Array.isArray(postNotifications) ? postNotifications : []).map((row) => ({
      notification_type: 'post',
      notification_key: `post:${row.post_id}`,
      post_id: Number(row.post_id),
      created_at: row.created_at ?? null,
      content: row.content ?? '',
      author_singles_id: Number(row.author_singles_id),
      prefix: row.prefix ?? null,
      member_id: row.member_id ?? null,
      alias: row.alias ?? null
    }));
    const chatRows = (Array.isArray(unreadChatMessages) ? unreadChatMessages : []).map((row) => ({
      notification_type: 'chat',
      notification_key: `chat:${row.msg_id}`,
      msg_id: Number(row.msg_id),
      created_at: row.created_at ?? null,
      content: row.msg_text ?? '',
      author_singles_id: Number(row.singles_id),
      prefix: row.prefix ?? null,
      member_id: row.member_id ?? null,
      alias: row.alias ?? null
    }));
    const balanceRows = (Array.isArray(balanceNotifications) ? balanceNotifications : []).map((row) => ({
      notification_type: 'balance',
      notification_key: `balance:${row.payment_id}`,
      payment_id: Number(row.payment_id),
      created_at: row.created_at ?? null,
      description: row.description ?? ''
    }));
    const bioRows = (Array.isArray(bioRequestNotifications) ? bioRequestNotifications : []).map((row) => ({
      notification_type: 'bio_request',
      notification_key: `bio_request:${row.requester_singles_id}`,
      requester_singles_id: Number(row.requester_singles_id),
      created_at: row.created_at ?? null,
      message: row.message ?? '',
      brief_bio_request: row.brief_bio_request ?? 'notrequested',
      full_bio_request: row.full_bio_request ?? 'notrequested',
      alias: row.alias ?? null,
      prefix: row.prefix ?? null,
      member_id: row.member_id ?? null
    }));
    return [...postRows, ...chatRows, ...balanceRows, ...bioRows].sort((a, b) => {
      const at = Date.parse(a.created_at ?? '');
      const bt = Date.parse(b.created_at ?? '');
      const an = Number.isFinite(at) ? at : 0;
      const bn = Number.isFinite(bt) ? bt : 0;
      return bn - an;
    });
  }, [postNotifications, unreadChatMessages, balanceNotifications, bioRequestNotifications]);

  const visibleNotifications = useMemo(() => (markAllPending ? [] : mergedNotifications), [mergedNotifications, markAllPending]);

  const bellNotificationCount = useMemo(() => visibleNotifications.length, [visibleNotifications]);

  const anchorRef = useRef(null);

  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current.focus();
    }
    prevOpen.current = open;
  }, [open]);

  const refreshBellData = useCallback(
    (scope = 'all') => {
      if (scope === 'posts' || scope === 'all') {
        void refetchPostNotifications();
      }
      if (scope === 'chat' || scope === 'all') {
        void refreshUnreadChatCount({ broadcast: false });
        void refetchUnreadChatMessages();
      }
      if (scope === 'balance' || scope === 'all') {
        void refetchBalanceNotifications();
      }
      if (scope === 'bio' || scope === 'all') {
        void refetchBioRequestNotifications();
        void refetchPendingCount();
        void refetchBioResponsePendingCount();
      }
    },
    [
      refreshUnreadChatCount,
      refetchPostNotifications,
      refetchUnreadChatMessages,
      refetchBalanceNotifications,
      refetchBioRequestNotifications,
      refetchPendingCount,
      refetchBioResponsePendingCount
    ]
  );

  useEffect(() => {
    if (!open) return;
    refreshBellData('all');
  }, [open, refreshBellData]);

  useEffect(() => {
    const onManualRefresh = (e) => {
      const scope = e?.detail?.scope;
      refreshBellData(
        scope === 'posts' || scope === 'chat' || scope === 'bio' || scope === 'balance' ? scope : 'all'
      );
    };
    window.addEventListener(BELL_NOTIFICATION_REFRESH_EVENT, onManualRefresh);
    return () => window.removeEventListener(BELL_NOTIFICATION_REFRESH_EVENT, onManualRefresh);
  }, [refreshBellData]);

  const handleMarkAllRead = useCallback(() => {
    const postIds = visibleNotifications
      .filter((row) => row.notification_type === 'post')
      .map((row) => Number(row.post_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const chatSenderIds = [
      ...new Set(
        visibleNotifications
          .filter((row) => row.notification_type === 'chat')
          .map((row) => Number(row.author_singles_id))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    ];
    const paymentIds = visibleNotifications
      .filter((row) => row.notification_type === 'balance')
      .map((row) => Number(row.payment_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    const requesterIds = visibleNotifications
      .filter((row) => row.notification_type === 'bio_request')
      .map((row) => Number(row.requester_singles_id))
      .filter((id) => Number.isFinite(id) && id > 0);
    void (async () => {
      setMarkAllPending(true);
      try {
        await dismissAllMyPicksPostNotifications(postIds);
        await dismissAllPaymentBalanceNotifications(paymentIds);
        await dismissAllBioRequestNotifications(requesterIds);
        if (chatSenderIds.length) await Promise.all(chatSenderIds.map((id) => markChatVisitedApi(id)));
      } finally {
        try {
          await Promise.all([
            refetchPostNotifications(),
            refetchUnreadChatMessages(),
            refetchBalanceNotifications(),
            refetchBioRequestNotifications()
          ]);
        } finally {
          setMarkAllPending(false);
        }
      }
    })();
  }, [
    visibleNotifications,
    refetchPostNotifications,
    refetchUnreadChatMessages,
    refetchBalanceNotifications,
    refetchBioRequestNotifications
  ]);

  const handleSelectNotification = useCallback(
    (row) => {
      const authorId = Number(row?.author_singles_id);
      setOpen(false);
      void (async () => {
        try {
          if (row?.notification_type === 'balance') {
            const paymentId = Number(row?.payment_id);
            if (Number.isFinite(paymentId) && paymentId > 0) {
              await dismissPaymentBalanceNotification(paymentId);
            }
            navigate(PROFILES_RECORDS_PATH, {
              state: { openTab: PROFILES_RECORDS_TAB_PAY_HISTORY }
            });
            return;
          }
          if (row?.notification_type === 'chat') {
            if (Number.isFinite(authorId) && authorId > 0) {
              await markChatVisitedApi(authorId);
            }
            const params = new URLSearchParams();
            if (Number.isFinite(authorId) && authorId > 0) params.set('focusChat', String(authorId));
            const search = params.toString();
            navigate(`${VETTED_FRIENDS_PATH}${search ? `?${search}` : ''}`, {
              state: {
                focusSinglesId: Number.isFinite(authorId) && authorId > 0 ? authorId : undefined,
                openChat: true
              }
            });
            return;
          }
          if (row?.notification_type === 'bio_request') {
            const requesterId = Number(row?.requester_singles_id);
            if (Number.isFinite(requesterId) && requesterId > 0) {
              await dismissBioRequestNotification(requesterId);
            }
            const params = new URLSearchParams();
            if (Number.isFinite(requesterId) && requesterId > 0) params.set('focusRequester', String(requesterId));
            const search = params.toString();
            navigate(`${RECEIVED_BIO_REQUESTS_PATH}${search ? `?${search}` : ''}`);
            return;
          }
          const postId = Number(row?.post_id);
          if (Number.isFinite(postId) && postId > 0) {
            await dismissMyPicksPostNotification(postId);
          }
          const params = new URLSearchParams();
          if (Number.isFinite(authorId) && authorId > 0) params.set('focusAuthor', String(authorId));
          const search = params.toString();
          navigate(`/myPicks${search ? `?${search}` : ''}`, {
            state: {
              targetSinglesId: Number.isFinite(authorId) && authorId > 0 ? authorId : undefined
            }
          });
        } finally {
          refetchPostNotifications();
          refetchUnreadChatMessages();
          refetchBalanceNotifications();
          refetchBioRequestNotifications();
        }
      })();
    },
    [navigate, refetchPostNotifications, refetchUnreadChatMessages, refetchBalanceNotifications, refetchBioRequestNotifications]
  );

  return (
    <>
      <Box
        sx={{
          ml: inline || clusterTight ? 0 : 2,
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          overflow: 'visible',
          '& .MuiBadge-root': {
            overflow: 'visible'
          },
          '& .MuiBadge-badge': {
            color: '#ffffff',
            backgroundColor: '#d50000',
            border: '2px solid #000000',
            borderRadius: '999px',
            boxSizing: 'border-box',
            fontWeight: 700,
            minWidth: NOTIFICATION_BADGE_SIZE,
            height: NOTIFICATION_BADGE_SIZE,
            fontSize: NOTIFICATION_BADGE_FONT_SIZE,
            lineHeight: 1,
            padding: '0 6px',
            pointerEvents: 'none',
            transform: 'translate(35%, -35%)'
          },
          '&:hover .MuiBadge-badge': {
            transform: 'translate(35%, -35%)'
          },
          ...(inline
            ? {
                '& .MuiAvatar-root': {
                  transformOrigin: 'center',
                  transition: 'transform 180ms ease'
                },
                '&:hover .MuiAvatar-root': {
                  width: inlineBellHoverSize,
                  height: inlineBellHoverSize
                }
              }
            : null)
        }}
      >
        <Badge
          badgeContent={
            inline || bellNotificationCount > 0 ? (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '100%',
                  height: '100%'
                }}
              >
                {bellNotificationCount}
              </Box>
            ) : null
          }
          overlap="circular"
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          invisible={!inline && bellNotificationCount < 1}
        >
          <Avatar
            variant="rounded"
            sx={{
              ...theme.typography.commonAvatar,
              width: NOTIFICATION_BELL_SIZE,
              height: NOTIFICATION_BELL_SIZE,
              minWidth: NOTIFICATION_BELL_SIZE,
              fontSize: NOTIFICATION_BADGE_FONT_SIZE,
              ...(inline
                ? {
                    borderRadius: '10px'
                  }
                : null),
              position: 'relative',
              zIndex: 1,
              color: '#FFEB3B',
              background: '#e53935',
              border: '3px solid #FFEB3B',
              boxSizing: 'border-box',
              transform: 'scale(1)',
              transformOrigin: 'center',
              transition: 'transform 180ms ease, filter 180ms ease',
              '&:hover, &:focus-visible, &[aria-controls="menu-list-grow"]': {
                color: '#FFEB3B',
                background: '#e53935',
                border: '3px solid #FFEB3B',
                filter: 'none',
                transform: inline ? undefined : 'none',
                boxShadow: 'none'
              },
              '& svg': {
                color: '#FFEB3B',
                stroke: '#FFEB3B'
              }
            }}
            ref={anchorRef}
            aria-controls={open ? 'menu-list-grow' : undefined}
            aria-haspopup="true"
            onClick={handleToggle}
          >
            <IconBell stroke={1.5} size={NOTIFICATION_BELL_ICON_SIZE} color="#FFEB3B" />
          </Avatar>
        </Badge>
      </Box>
      <Popper
        placement={inline ? 'bottom' : downMD ? 'bottom' : 'bottom-end'}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        sx={{ zIndex: 1400 }}
        modifiers={[{ name: 'offset', options: { offset: [downMD ? 5 : 0, 20] } }]}
      >
        {({ TransitionProps }) => (
          <ClickAwayListener onClickAway={handleClose}>
            <Transitions position={downMD ? 'top' : 'top-right'} in={open} {...TransitionProps}>
              <Paper sx={{ width: 'max-content', maxWidth: 'min(96vw, 800px)', overflow: 'visible' }}>
                <Activity mode={open ? 'visible' : 'hidden'}>
                  <MainCard
                    border={false}
                    elevation={16}
                    content={false}
                    boxShadow
                    shadow={theme.shadows[16]}
                    sx={{ minWidth: 520, maxWidth: 'min(96vw, 800px)', width: 'max-content' }}
                  >
                    <Stack sx={{ gap: 0 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 2, px: 2, pb: 1 }}>
                        <Button
                          variant="outlined"
                          onClick={handleMarkAllRead}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: { xs: getMobileSinglesButtonFontSizeVw(), sm: getDesktopButtonFontSizeVw() },
                            lineHeight: 1.35,
                            borderWidth: 2,
                            borderColor: 'primary.main',
                            color: 'primary.main',
                            px: 4,
                            py: 1.25,
                            minHeight: 52,
                            '&:hover': {
                              borderWidth: 2,
                              borderColor: 'primary.dark',
                              bgcolor: 'action.hover'
                            }
                          }}
                        >
                          Mark as all read
                        </Button>
                      </Box>
                      <Box
                        sx={{
                          maxHeight: 'calc(100vh - 205px)',
                          overflowY: 'auto',
                          overflowX: 'visible',
                          '&::-webkit-scrollbar': { width: 5 }
                        }}
                      >
                        <NotificationList
                          notifications={visibleNotifications}
                          loading={
                            postNotificationsLoading ||
                            unreadChatMessagesLoading ||
                            balanceNotificationsLoading ||
                            bioRequestNotificationsLoading
                          }
                          error={
                            postNotificationsError ||
                            unreadChatMessagesError ||
                            balanceNotificationsError ||
                            bioRequestNotificationsError
                          }
                          onSelectNotification={handleSelectNotification}
                        />
                      </Box>
                    </Stack>
                  </MainCard>
                </Activity>
              </Paper>
            </Transitions>
          </ClickAwayListener>
        )}
      </Popper>
    </>
  );
}
