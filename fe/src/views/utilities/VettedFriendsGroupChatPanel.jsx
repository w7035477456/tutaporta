import { useCallback, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import GreenButton from 'ui-component/GreenButton';
import { GREEN_BUTTON_ENABLED_BG, GREEN_BUTTON_TEXT } from 'config/greenButton';
import {
  COLOR_TEMPLATE1_BG_SELECTED,
  COLOR_TEMPLATE1_TEXT_SELECTED,
  COLOR_TEMPLATE1_TEXT_UNSELECTED
} from 'config/colorTemplate1';
import { buildProfilePhotoUrl } from 'utils/profilePhotoUrl';
import { formatMemberLabel } from 'utils/memberLabel';
import { themedAlert } from 'utils/themedDialog';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import { useAuth } from 'contexts/AuthContext';
import {
  acceptGroupChatInviteApi,
  declineGroupChatInviteApi,
  fetchGroupChatInviteCandidates,
  fetchGroupChatMessages,
  fetchGroupChatOverview,
  fetchMyGroupChat,
  fetchMyGroupChatMemberships,
  fetchPendingGroupChatInvites,
  markGroupChatVisitedApi,
  postGroupChatInviteApi,
  sendGroupChatMessageApi
} from 'api/groupChatFe';

/** Shared width for Invite button + dropdown (same green strip). */
const INVITE_CONTROL_WIDTH = 300;

const invitePanelSx = {
  width: INVITE_CONTROL_WIDTH,
  maxWidth: '100%',
  bgcolor: GREEN_BUTTON_ENABLED_BG,
  color: GREEN_BUTTON_TEXT,
  border: '1px solid #000',
  borderTop: 'none',
  maxHeight: 320,
  overflowY: 'auto'
};

/** Distinct incoming blues so each other member is easy to tell apart. */
const GROUP_INCOMING_SHADE_MIXES = ['#90caf9', '#64b5f6', '#4fc3f7', '#29b6f6', '#81d4fa', '#42a5f5'];

function incomingBubbleShadeForSender(senderId) {
  const id = Math.abs(Number(senderId) || 0);
  const mix = GROUP_INCOMING_SHADE_MIXES[id % GROUP_INCOMING_SHADE_MIXES.length];
  return `color-mix(in srgb, var(--theme-secondary-color) 72%, ${mix} 28%)`;
}

/**
 * Buddies-area Group Chat panel.
 * Until inbound "Group Chat Invite Accept": history + Send locked.
 * Host: after buddies accept, compose is enabled (even before first message).
 */
export default function VettedFriendsGroupChatPanel({ refreshNonce = 0 }) {
  const { user } = useAuth();
  const mySinglesId = Number(user?.singles_id);
  const [loading, setLoading] = useState(true);
  const [groupId, setGroupId] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingOut, setPendingOut] = useState([]);
  const [pendingIn, setPendingIn] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [acceptBusyId, setAcceptBusyId] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [preferredGroupId, setPreferredGroupId] = useState(null);

  const chatLocked = pendingIn.length > 0;
  const acceptedOthers = useMemo(
    () => members.filter((m) => Number(m.singlesId) !== mySinglesId && String(m.status || 'active') === 'active'),
    [members, mySinglesId]
  );
  // Unlock typing once group id is known OR accepted members are visible (host after Accept).
  const canCompose =
    !chatLocked && ((Number.isFinite(Number(groupId)) && Number(groupId) > 0) || acceptedOthers.length > 0);

  const loadGroupThread = useCallback(async (gid) => {
    const id = Number(gid);
    if (!Number.isFinite(id) || id < 1) {
      setGroupId(null);
      setMembers([]);
      setMessages([]);
      return;
    }
    // Set id immediately so the composer unlocks even if a follow-up fetch fails.
    setGroupId(id);
    try {
      const overview = await fetchGroupChatOverview(id);
      if (Array.isArray(overview?.members)) {
        setMembers(overview.members);
      }
    } catch (err) {
      console.error('[group-chat] overview failed', err);
    }
    try {
      const msgData = await fetchGroupChatMessages(id, 100);
      setMessages(Array.isArray(msgData?.messages) ? msgData.messages : []);
    } catch (err) {
      console.error('[group-chat] messages failed', err);
      setMessages([]);
    }
    try {
      await markGroupChatVisitedApi(id);
    } catch {
      /* ignore */
    }
  }, []);

  const pickActiveGroupId = useCallback((mine, memberships, preferred) => {
    const hostGid = Number(mine?.group?.groupId);
    const list = Array.isArray(memberships) ? memberships : [];
    const pref = Number(preferred);
    if (Number.isFinite(pref) && pref > 0 && list.some((g) => Number(g.groupId) === pref)) {
      return pref;
    }
    // Invitee who joined someone else's room
    const asMember = list.find((g) => g.role === 'member');
    if (asMember) return Number(asMember.groupId);
    // Host managing their own room
    if (Number.isFinite(hostGid) && hostGid > 0) return hostGid;
    const asHost = list.find((g) => g.role === 'host');
    if (asHost) return Number(asHost.groupId);
    return null;
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [mine, cand, inbound, membershipsData] = await Promise.all([
        fetchMyGroupChat(),
        fetchGroupChatInviteCandidates(),
        fetchPendingGroupChatInvites(),
        fetchMyGroupChatMemberships()
      ]);

      const inboundList = Array.isArray(inbound?.invites) ? inbound.invites : [];
      setPendingIn(inboundList);
      setPendingOut(Array.isArray(mine?.pendingInvites) ? mine.pendingInvites : []);
      setCandidates(Array.isArray(cand?.candidates) ? cand.candidates : []);

      const memberships = Array.isArray(membershipsData?.groups) ? membershipsData.groups : [];

      // Inbound pending: lock composer; still keep host group id for after-accept.
      if (inboundList.length > 0) {
        setGroupId(null);
        setMembers([]);
        setMessages([]);
        setDraft('');
        return;
      }

      const nextGid = pickActiveGroupId(mine, memberships, preferredGroupId);
      if (Number.isFinite(nextGid) && nextGid > 0) {
        // Unlock composer immediately; then load members/messages.
        setGroupId(nextGid);
        if (Number(mine?.group?.groupId) === nextGid && Array.isArray(mine?.members)) {
          setMembers(mine.members);
        }
        await loadGroupThread(nextGid);
      } else {
        setGroupId(null);
        setMembers(Array.isArray(mine?.members) ? mine.members : []);
        setMessages([]);
      }
    } catch (err) {
      console.error('[group-chat] reload failed', err);
      await themedAlert(err?.response?.data?.error || err?.message || 'Failed to load Group Chat');
    } finally {
      setLoading(false);
    }
  }, [loadGroupThread, pickActiveGroupId, preferredGroupId]);

  useEffect(() => {
    void reload();
  }, [reload, refreshNonce]);

  // Host: poll so Accepted members appear without manual refresh.
  useEffect(() => {
    if (chatLocked) return undefined;
    const timer = setInterval(() => {
      void (async () => {
        try {
          const [mine, cand, membershipsData] = await Promise.all([
            fetchMyGroupChat(),
            fetchGroupChatInviteCandidates(),
            fetchMyGroupChatMemberships()
          ]);
          setPendingOut(Array.isArray(mine?.pendingInvites) ? mine.pendingInvites : []);
          setCandidates(Array.isArray(cand?.candidates) ? cand.candidates : []);
          const memberships = Array.isArray(membershipsData?.groups) ? membershipsData.groups : [];
          const nextGid = pickActiveGroupId(mine, memberships, preferredGroupId);
          if (!Number.isFinite(nextGid) || nextGid < 1) return;
          if (Number(groupId) !== nextGid) {
            await loadGroupThread(nextGid);
            return;
          }
          const overview = await fetchGroupChatOverview(nextGid);
          setMembers(Array.isArray(overview?.members) ? overview.members : []);
          const msgData = await fetchGroupChatMessages(nextGid, 100);
          setMessages(Array.isArray(msgData?.messages) ? msgData.messages : []);
        } catch {
          /* ignore poll errors */
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [chatLocked, groupId, loadGroupThread, pickActiveGroupId, preferredGroupId]);

  const memberSummary = useMemo(() => {
    if (chatLocked) return 'Accept invite to see members and messages';
    if (!acceptedOthers.length) return 'No accepted members yet';
    return acceptedOthers
      .map((m) =>
        formatMemberLabel({
          alias: m.alias,
          singlesId: m.singlesId,
          prefix: m.prefix,
          memberId: m.memberId
        })
      )
      .join(', ');
  }, [acceptedOthers, chatLocked]);

  const inviteMenuRows = useMemo(() => {
    const rows = [];
    const seen = new Set();

    for (const m of members) {
      const id = Number(m.singlesId);
      if (!Number.isFinite(id) || id < 1) continue;
      if (Number.isFinite(mySinglesId) && id === mySinglesId) continue;
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({
        key: `accepted-${id}`,
        singlesId: id,
        alias: m.alias,
        prefix: m.prefix,
        memberId: m.memberId,
        profileImageFk: m.profileImageFk,
        status: 'Accepted',
        actionable: false
      });
    }

    for (const inv of pendingOut) {
      const id = Number(inv.inviteeId);
      if (!Number.isFinite(id) || id < 1 || seen.has(id)) continue;
      seen.add(id);
      rows.push({
        key: `invited-${id}`,
        singlesId: id,
        alias: inv.alias,
        prefix: inv.prefix,
        memberId: inv.memberId,
        profileImageFk: inv.profileImageFk,
        status: 'Invited',
        actionable: false
      });
    }

    for (const c of candidates) {
      const id = Number(c.singlesId);
      if (!Number.isFinite(id) || id < 1 || seen.has(id)) continue;
      seen.add(id);
      rows.push({
        key: `invite-${id}`,
        singlesId: id,
        alias: c.alias,
        prefix: c.prefix,
        memberId: c.memberId,
        profileImageFk: c.profileImageFk,
        status: null,
        actionable: true
      });
    }

    return rows;
  }, [members, pendingOut, candidates, mySinglesId]);

  const handleInviteToggle = () => {
    setInviteOpen((open) => !open);
    void (async () => {
      try {
        const [cand, mine, membershipsData] = await Promise.all([
          fetchGroupChatInviteCandidates(),
          fetchMyGroupChat(),
          fetchMyGroupChatMemberships()
        ]);
        setCandidates(Array.isArray(cand?.candidates) ? cand.candidates : []);
        setPendingOut(Array.isArray(mine?.pendingInvites) ? mine.pendingInvites : []);
        const memberships = Array.isArray(membershipsData?.groups) ? membershipsData.groups : [];
        const nextGid = pickActiveGroupId(mine, memberships, preferredGroupId) || groupId;
        if (Number.isFinite(nextGid) && nextGid > 0) {
          if (Number(mine?.group?.groupId) === nextGid && Array.isArray(mine?.members)) {
            setMembers(mine.members);
          }
          const overview = await fetchGroupChatOverview(nextGid);
          setGroupId(nextGid);
          setMembers(Array.isArray(overview?.members) ? overview.members : []);
        }
      } catch (err) {
        console.error('[group-chat] invite menu refresh failed', err);
      }
    })();
  };

  const handleInviteBuddy = async (inviteeId) => {
    if (inviteBusy) return;
    setInviteBusy(true);
    try {
      await postGroupChatInviteApi(inviteeId);
      await themedAlert('Group Chat invite sent.');
      await reload();
      setInviteOpen(true);
    } catch (err) {
      const apiMsg = err?.response?.data?.error || err?.message || 'Failed to send invite';
      await themedAlert(apiMsg);
    } finally {
      setInviteBusy(false);
    }
  };

  const handleAccept = async (inviteId, invitedGroupId) => {
    if (acceptBusyId) return;
    setAcceptBusyId(inviteId);
    try {
      const result = await acceptGroupChatInviteApi(inviteId);
      const joinedId = Number(result?.groupId || invitedGroupId);
      if (Number.isFinite(joinedId) && joinedId > 0) {
        setPreferredGroupId(joinedId);
      }
      await themedAlert('Joined Group Chat.');
      setPendingIn([]);
      if (Number.isFinite(joinedId) && joinedId > 0) {
        setLoading(true);
        try {
          await loadGroupThread(joinedId);
          const [cand, mine, stillPending] = await Promise.all([
            fetchGroupChatInviteCandidates(),
            fetchMyGroupChat(),
            fetchPendingGroupChatInvites()
          ]);
          setCandidates(Array.isArray(cand?.candidates) ? cand.candidates : []);
          setPendingOut(Array.isArray(mine?.pendingInvites) ? mine.pendingInvites : []);
          setPendingIn(Array.isArray(stillPending?.invites) ? stillPending.invites : []);
        } finally {
          setLoading(false);
        }
      } else {
        await reload();
      }
    } catch (err) {
      await themedAlert(err?.response?.data?.error || err?.message || 'Failed to accept invite');
    } finally {
      setAcceptBusyId(null);
    }
  };

  const handleDecline = async (inviteId) => {
    if (acceptBusyId) return;
    setAcceptBusyId(inviteId);
    try {
      await declineGroupChatInviteApi(inviteId);
      await reload();
    } catch (err) {
      await themedAlert(err?.response?.data?.error || err?.message || 'Failed to decline invite');
    } finally {
      setAcceptBusyId(null);
    }
  };

  const handleSend = async () => {
    const text = String(draft ?? '').trim();
    const sendGroupId = Number(groupId);
    if (!canCompose || !text || sendBusy) return;
    if (!Number.isFinite(sendGroupId) || sendGroupId < 1) {
      await themedAlert('Group chat is still loading. Try Refresh Posts & Chats, then send again.');
      await reload();
      return;
    }
    setSendBusy(true);
    try {
      const result = await sendGroupChatMessageApi(sendGroupId, text);
      setDraft('');
      if (result?.message) {
        setMessages((prev) => [...prev, result.message]);
      } else {
        await loadGroupThread(sendGroupId);
      }
    } catch (err) {
      await themedAlert(err?.response?.data?.error || err?.message || 'Failed to send message');
    } finally {
      setSendBusy(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0, flex: 1 }}>
      {!chatLocked ? (
        <Box sx={{ width: INVITE_CONTROL_WIDTH, maxWidth: '100%' }}>
          <GreenButton
            type="button"
            disabled={inviteBusy}
            onClick={handleInviteToggle}
            sx={{ width: '100%', minWidth: INVITE_CONTROL_WIDTH }}
            {...guestDemoAllowProps()}
          >
            Group Chat Invite
          </GreenButton>
          {inviteOpen ? (
            <Box sx={invitePanelSx} {...guestDemoAllowProps()}>
              {inviteMenuRows.length === 0 ? (
                <Typography sx={{ px: 1.5, py: 1, fontWeight: 700, color: GREEN_BUTTON_TEXT }}>
                  No buddies to show
                </Typography>
              ) : (
                inviteMenuRows.map((row) => {
                  const label = formatMemberLabel({
                    alias: row.alias,
                    singlesId: row.singlesId,
                    prefix: row.prefix,
                    memberId: row.memberId
                  });
                  const primary = row.status ? `${label} ${row.status}` : label;
                  const src = buildProfilePhotoUrl(row.singlesId, row.profileImageFk);
                  return (
                    <Box
                      key={row.key}
                      component={row.actionable ? 'button' : 'div'}
                      type={row.actionable ? 'button' : undefined}
                      disabled={row.actionable ? inviteBusy : undefined}
                      onClick={row.actionable ? () => void handleInviteBuddy(row.singlesId) : undefined}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        borderBottom: '1px solid rgba(0,0,0,0.15)',
                        bgcolor: GREEN_BUTTON_ENABLED_BG,
                        color: GREEN_BUTTON_TEXT,
                        px: 1.25,
                        py: 0.85,
                        cursor: row.actionable ? 'pointer' : 'default',
                        font: 'inherit',
                        '@media (hover: hover)': row.actionable
                          ? {
                              '&:hover': { filter: 'brightness(0.95)' }
                            }
                          : undefined
                      }}
                      {...guestDemoAllowProps()}
                    >
                      <Avatar src={src || undefined} alt={label} sx={{ width: 32, height: 32 }} />
                      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', color: GREEN_BUTTON_TEXT }}>
                        {primary}
                      </Typography>
                    </Box>
                  );
                })
              )}
            </Box>
          ) : null}
        </Box>
      ) : null}

      {pendingIn.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {pendingIn.map((inv) => {
            const fromLabel = formatMemberLabel({
              alias: inv.alias,
              singlesId: inv.inviterId,
              prefix: inv.prefix,
              memberId: inv.memberId
            });
            return (
              <Box
                key={inv.inviteId}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1,
                  p: 1,
                  border: '1px solid var(--theme-primary-color)',
                  borderRadius: 1,
                  bgcolor: 'var(--theme-daynight-color)'
                }}
              >
                <Typography sx={{ flex: '1 1 140px', fontWeight: 700 }}>
                  Group Chat invite from {fromLabel}
                </Typography>
                <GreenButton
                  type="button"
                  disabled={Number(acceptBusyId) === Number(inv.inviteId)}
                  onClick={() => void handleAccept(inv.inviteId, inv.groupId)}
                  {...guestDemoAllowProps()}
                >
                  Group Chat Invite Accept
                </GreenButton>
                <Button
                  type="button"
                  size="small"
                  disabled={Number(acceptBusyId) === Number(inv.inviteId)}
                  onClick={() => void handleDecline(inv.inviteId)}
                  {...guestDemoAllowProps()}
                >
                  Decline
                </Button>
              </Box>
            );
          })}
        </Box>
      ) : null}

      <Typography sx={{ fontSize: '0.85rem', opacity: 0.9 }}>
        Members: {memberSummary}
        {!chatLocked && pendingOut.length ? ` · Pending invites: ${pendingOut.length}` : ''}
      </Typography>

      <Box
        aria-disabled={chatLocked}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 180,
          maxHeight: { xs: 280, sm: 360 },
          overflowY: chatLocked ? 'hidden' : 'auto',
          border: '1px solid var(--theme-primary-color)',
          borderRadius: 1,
          p: 1,
          bgcolor: chatLocked ? '#e0e0e0' : '#fff',
          color: chatLocked ? '#757575' : '#000',
          pointerEvents: chatLocked ? 'none' : 'auto',
          userSelect: chatLocked ? 'none' : 'auto',
          filter: chatLocked ? 'grayscale(0.35)' : 'none',
          opacity: chatLocked ? 0.72 : 1
        }}
      >
        {chatLocked ? (
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
            Accept the Group Chat invite above to view past messages and send.
          </Typography>
        ) : messages.length === 0 ? (
          <Typography sx={{ opacity: 0.7, fontSize: '0.9rem' }}>
            {acceptedOthers.length > 0
              ? 'No messages yet — type below to start the group chat.'
              : 'No group messages yet. Invite buddies; after they accept, you can chat here.'}
          </Typography>
        ) : (
          messages.map((m) => {
            const isMine = m.sender === 'me';
            const who = isMine
              ? 'You'
              : formatMemberLabel({
                  alias: m.alias,
                  singlesId: m.senderId,
                  prefix: m.prefix,
                  memberId: m.memberId
                });
            const bubbleBg = isMine ? COLOR_TEMPLATE1_BG_SELECTED : incomingBubbleShadeForSender(m.senderId);
            const bubbleTextColor = isMine ? COLOR_TEMPLATE1_TEXT_SELECTED : COLOR_TEMPLATE1_TEXT_UNSELECTED;
            const avatarSrc = isMine
              ? buildProfilePhotoUrl(mySinglesId, user?.profile_image_fk)
              : buildProfilePhotoUrl(m.senderId, m.profileImageFk);
            return (
              <Box
                key={m.id}
                sx={{
                  display: 'flex',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end',
                  gap: 0.75,
                  mb: 1.25
                }}
              >
                {!isMine ? (
                  <Avatar src={avatarSrc || undefined} alt={who} sx={{ width: 32, height: 32, flexShrink: 0, mb: 0.25 }} />
                ) : null}
                <Box sx={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start' }}>
                  {!isMine ? (
                    <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', mb: 0.25, color: COLOR_TEMPLATE1_TEXT_UNSELECTED }}>
                      {who}
                    </Typography>
                  ) : null}
                  <Box
                    sx={{
                      px: 1.2,
                      py: 0.8,
                      borderRadius: '20px',
                      maxWidth: '100%',
                      mr: isMine ? '18px' : 0,
                      ml: isMine ? 0 : '18px',
                      bgcolor: bubbleBg,
                      border: '1px solid var(--theme-primary-color)',
                      color: bubbleTextColor,
                      position: 'relative',
                      zIndex: 1,
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        bottom: 6,
                        width: 22,
                        height: 22,
                        backgroundColor: bubbleBg,
                        zIndex: isMine ? 1 : 3,
                        ...(isMine
                          ? { right: -11, borderRadius: '0 0 8px 20px', transform: 'rotate(-45deg)' }
                          : {
                              left: -11,
                              borderRadius: '0 0 20px 8px',
                              transform: 'rotate(45deg)',
                              borderLeft: '1px solid var(--theme-primary-color)',
                              borderBottom: '1px solid var(--theme-primary-color)'
                            })
                      }
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.95rem',
                        color: `${bubbleTextColor} !important`,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                      }}
                    >
                      {m.text}
                    </Typography>
                  </Box>
                </Box>
                {isMine ? (
                  <Avatar src={avatarSrc || undefined} alt="You" sx={{ width: 32, height: 32, flexShrink: 0, mb: 0.25 }} />
                ) : null}
              </Box>
            );
          })
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        <TextField
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            chatLocked
              ? 'Accept invite to chat…'
              : canCompose
                ? 'Write a group message…'
                : 'Loading group chat…'
          }
          fullWidth
          size="small"
          multiline
          maxRows={3}
          disabled={chatLocked || sendBusy || !canCompose}
          inputProps={{
            'data-guest-demo-allow': 'true',
            autoComplete: 'off'
          }}
          onKeyDown={(e) => {
            if (chatLocked || !canCompose) return;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void handleSend();
            }
          }}
          sx={
            chatLocked || !canCompose
              ? {
                  '& .MuiInputBase-root': {
                    bgcolor: '#e0e0e0',
                    color: '#757575'
                  }
                }
              : {
                  '& .MuiInputBase-root': {
                    bgcolor: '#fff',
                    color: '#000'
                  }
                }
          }
          {...guestDemoAllowProps()}
        />
        <GreenButton
          type="button"
          disabled={chatLocked || sendBusy || !canCompose || !draft.trim()}
          onClick={() => void handleSend()}
          {...guestDemoAllowProps()}
        >
          Send
        </GreenButton>
      </Box>
    </Box>
  );
}

VettedFriendsGroupChatPanel.propTypes = {
  refreshNonce: PropTypes.number
};
