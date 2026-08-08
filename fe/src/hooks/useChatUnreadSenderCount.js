import { useCallback, useEffect, useState } from 'react';

import { fetchUnreadChatSenderCount } from 'api/chatWithFriendsFe';
import { CHAT_UNREAD_UPDATED_EVENT, dispatchChatUnreadUpdated } from 'utils/chatUnreadStore';

const CHAT_UNREAD_EVENT_SOURCE = 'useChatUnreadSenderCount';

/**
 * Bell badge: count of distinct friends with new inbound chat since last visit (HTTP only).
 * @param {{ manualOnly?: boolean }} options — manualOnly: no mount fetch; refetch on bell open / Refresh Chat.
 */
export default function useChatUnreadSenderCount(enabled = true, options = {}) {
  const manualOnly = options.manualOnly === true;
  const [count, setCount] = useState(0);
  const [senders, setSenders] = useState([]);

  const refreshCount = useCallback(async ({ broadcast = true } = {}) => {
    try {
      const { count: next, senders: nextSenders } = await fetchUnreadChatSenderCount();
      setCount(next);
      setSenders(nextSenders);
      if (broadcast) dispatchChatUnreadUpdated(next, CHAT_UNREAD_EVENT_SOURCE);
      return next;
    } catch (err) {
      console.error('[useChatUnreadSenderCount] refresh failed', err);
      return 0;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setCount(0);
      setSenders([]);
      dispatchChatUnreadUpdated(0, CHAT_UNREAD_EVENT_SOURCE);
      return;
    }
    if (!manualOnly) void refreshCount();
  }, [enabled, manualOnly, refreshCount]);

  /** Sync count from other components (HTTP refresh paths only; no WebSocket). */
  useEffect(() => {
    if (!enabled || manualOnly) return undefined;
    const onCustom = (e) => {
      if (e?.detail?.source === CHAT_UNREAD_EVENT_SOURCE) return;
      const n = Number(e?.detail?.count);
      const detailSenders = e?.detail?.senders;
      if (Number.isFinite(n) && n >= 0) {
        setCount(Math.trunc(n));
        if (Array.isArray(detailSenders)) {
          setSenders(detailSenders);
          return;
        }
        if (n === 0) setSenders([]);
        else void refreshCount({ broadcast: false });
      }
    };
    window.addEventListener(CHAT_UNREAD_UPDATED_EVENT, onCustom);
    return () => window.removeEventListener(CHAT_UNREAD_UPDATED_EVENT, onCustom);
  }, [enabled, manualOnly, refreshCount]);

  return { count, senders, refreshCount };
}
