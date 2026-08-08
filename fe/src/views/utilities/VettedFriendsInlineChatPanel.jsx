import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import CircularProgress from '@mui/material/CircularProgress';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import PhotoCameraOutlined from '@mui/icons-material/PhotoCameraOutlined';
import EmojiEmotionsOutlined from '@mui/icons-material/EmojiEmotionsOutlined';
import {
  buttonHoverMagnifyFontSx,
  buttonHoverMagnifyTransitionSx,
  iconButtonHoverMagnifySx
} from 'config/hoverMagnifyEnv';
import dragDropClickUploadImg from 'assets/images/dragDropClickUpload.png';
import cameraOrPhotoUploadImg from 'assets/images/cameraorphotoupload.png';
import {
  loadChatWithFriendsState,
  saveChatWithFriendsState,
  getChatWithFriendsUpdatedEventName,
  upsertFriendFromRequestRow
} from 'utils/chatWithFriendsStore';
import { formatMemberLabel } from 'utils/memberLabel';
import { fetchChatHistoryPage, markChatVisitedApi, sendChatMessageApi, uploadChatInlineImage } from 'api/chatWithFriendsFe';
import { dispatchBellNotificationRefresh } from 'utils/notificationBellStore';
import { fetchUserCustomization, saveUserCustomization } from 'api/userCustomizationFe';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import { getDesktopIconSizeVw } from 'config/desktopFontEnv';
import { useAuth } from 'contexts/AuthContext';
import {
  COLOR_TEMPLATE1_BG_SELECTED,
  COLOR_TEMPLATE1_BG_UNSELECTED,
  COLOR_TEMPLATE1_TEXT_SELECTED,
  COLOR_TEMPLATE1_TEXT_UNSELECTED,
  colorTemplate1ButtonSx
} from 'config/colorTemplate1';

function readEnvFontNumber(value, fallback) {
  const parsed = Number(String(value ?? '').trim());
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, 25);
}

function toFixedPxFromVw(vwValue, referenceWidthPx) {
  return `${(vwValue * referenceWidthPx) / 100}px`;
}

const MOBILE_TEXT_FONT_PX = toFixedPxFromVw(readEnvFontNumber(import.meta.env.MOBILE_FONT_SIZE_TEXT, 2), 390);
const DESKTOP_TEXT_FONT_PX = toFixedPxFromVw(readEnvFontNumber(import.meta.env.DESKTOP_FONT_SIZE_TEXT, 2), 1440);

function parsePxLen(cssLen) {
  const n = parseFloat(String(cssLen).replace(/px\s*$/i, ''));
  return Number.isFinite(n) ? n : 0;
}

const BASE_MOBILE_CHAT_PX = parsePxLen(MOBILE_TEXT_FONT_PX);
const BASE_DESKTOP_CHAT_PX = parsePxLen(DESKTOP_TEXT_FONT_PX);

/** Match My Photo album: drag-and-drop replaced with tap camera / gallery on narrow viewports */
const MOBILE_UPLOAD_MAX_CSS = '(max-width:768px)';
const MOBILE_UPLOAD_SURFACE_BG = '#C7E6C8';
const ACCEPT = 'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/jfif';
const ALLOWED_UPLOAD_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'jfif']);

const CHAT_IMAGE_PATH_RE = /^\/api\/chat\/image\/[a-f0-9]{48}\.(?:jpe?g|png|gif|webp)$/i;
const INITIAL_CHAT_MESSAGES_LIMIT = 5;

/** fe/.env DESKTOP_ICON_SIZE — chat composer toolbar (image, camera, emoji, A+/A−) */
const CHAT_TOOLBAR_ICON_SIZE = getDesktopIconSizeVw();

const chatToolbarCustomIconSx = {
  width: CHAT_TOOLBAR_ICON_SIZE,
  height: CHAT_TOOLBAR_ICON_SIZE,
  display: 'block'
};

const CHAT_COMPOSER_ICON_SX = {
  '& .MuiSvgIcon-root': {
    fontSize: CHAT_TOOLBAR_ICON_SIZE,
    width: CHAT_TOOLBAR_ICON_SIZE,
    height: CHAT_TOOLBAR_ICON_SIZE
  },
  p: 0.25,
  ...iconButtonHoverMagnifySx(CHAT_TOOLBAR_ICON_SIZE)
};

const CHAT_FONT_SIZE_ICON_BUTTON_SX = {
  p: 0.2,
  minWidth: CHAT_TOOLBAR_ICON_SIZE,
  width: CHAT_TOOLBAR_ICON_SIZE,
  height: CHAT_TOOLBAR_ICON_SIZE,
  borderRadius: 1,
  flexShrink: 0,
  ...iconButtonHoverMagnifySx(CHAT_TOOLBAR_ICON_SIZE)
};

const MOBILE_CHAT_COMPOSER_ICON_SX = {
  '& .MuiSvgIcon-root': {
    fontSize: CHAT_TOOLBAR_ICON_SIZE,
    width: CHAT_TOOLBAR_ICON_SIZE,
    height: CHAT_TOOLBAR_ICON_SIZE
  },
  p: 0.1,
  ...iconButtonHoverMagnifySx(CHAT_TOOLBAR_ICON_SIZE)
};

const MOBILE_FONT_CONTROL_SX = {
  minWidth: CHAT_TOOLBAR_ICON_SIZE,
  width: CHAT_TOOLBAR_ICON_SIZE,
  height: CHAT_TOOLBAR_ICON_SIZE,
  px: 0.25,
  py: 0.1,
  lineHeight: 1,
  color: '#1f2a2d',
  fontWeight: 700,
  ...buttonHoverMagnifyTransitionSx,
  '@media (hover: hover)': {
    '&:hover:not(.Mui-disabled)': buttonHoverMagnifyFontSx()
  }
};

const CHAT_LOAD_OLDER_FONT_SIZE = { xs: '1rem', sm: '1rem' };

const CHAT_LOAD_OLDER_BUTTON_SX = {
  borderRadius: 999,
  textTransform: 'none',
  fontWeight: 800,
  px: 2,
  py: 0.45,
  bgcolor: '#ffe000',
  color: '#111',
  border: '2px solid #111',
  fontSize: CHAT_LOAD_OLDER_FONT_SIZE,
  ...buttonHoverMagnifyTransitionSx,
  '&:hover:not(.Mui-disabled)': {
    bgcolor: '#ffea55',
    ...buttonHoverMagnifyFontSx({ baseFontSize: CHAT_LOAD_OLDER_FONT_SIZE })
  },
  '&.Mui-disabled': {
    bgcolor: '#bdbdbd',
    color: '#4a4a4a',
    borderColor: '#7f7f7f',
    opacity: 1,
    WebkitTextFillColor: '#4a4a4a',
    cursor: 'not-allowed'
  }
};

const CHAT_THICK_BLACK_BORDER = '3px solid #000';

function TextSizeUpSvgIcon() {
  return (
    <Box component="svg" focusable="false" aria-hidden="true" viewBox="0 0 24 24" sx={chatToolbarCustomIconSx}>
      <path d="M0.99 19h2.42l1.27-3.58h5.65L11.59 19h2.42L8.75 4.78C8.59 4.31 8.16 4 7.68 4H7.21c-.48 0-.91.31-1.07.78L0.99 19zm5.33-5.58L8 8l1.68 5.42H6.32zM20 7v3h-3v2h3v3h2v-3h3v-2h-3V7h-2z" />
    </Box>
  );
}

function TextSizeDownSvgIcon() {
  return (
    <Box component="svg" focusable="false" aria-hidden="true" viewBox="0 0 24 24" sx={chatToolbarCustomIconSx}>
      <path d="M0.99 19h2.42l1.27-3.58h5.65L11.59 19h2.42L8.75 4.78C8.59 4.31 8.16 4 7.68 4H7.21c-.48 0-.91.31-1.07.78L0.99 19zm5.33-5.58L8 8l1.68 5.42H6.32zM16 11v2h8v-2h-8z" />
    </Box>
  );
}

/** Inactive column: darker blue-grey fill + thick frame in the same hue family */
const INACTIVE_CHAT_SURFACE = '#93a2b2';
/** Inactive / “second” header label strip (paired with member strip; both white in light mode). */
const CHAT_HEADER_SECOND_STRIP_BG = '#90a4ae';

/** Emoji fonts after theme stack so combined text+emoji messages render reliably */
const CHAT_MESSAGE_FONT_FAMILY = (theme) =>
  `${theme.typography.fontFamily}, "Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji",sans-serif`;

const CHAT_QUICK_EMOJIS = [
  '😀',
  '😃',
  '😄',
  '😁',
  '😅',
  '😂',
  '🤣',
  '😊',
  '😇',
  '🙂',
  '😉',
  '😍',
  '🥰',
  '😘',
  '😗',
  '😋',
  '😛',
  '😜',
  '🤪',
  '🤗',
  '🤔',
  '😏',
  '😒',
  '🙄',
  '😬',
  '😌',
  '😢',
  '😭',
  '😤',
  '😡',
  '🤯',
  '🥳',
  '👍',
  '👎',
  '👏',
  '🙏',
  '💪',
  '❤️',
  '💔',
  '🔥',
  '✨',
  '🎉',
  '💯'
];

function isEmojiGraphemeCluster(segment) {
  const g = String(segment);
  if (!g) return false;
  if (/^\p{Regional_Indicator}{2}$/u.test(g)) return true;
  if (/^\d\uFE0F?\u20E3$/u.test(g)) return true;
  if (/\p{Extended_Pictographic}/u.test(g)) return true;
  return false;
}

/** Split for chat bubbles: consecutive emoji grapheme clusters become one styled run (white bg, 3× size). */
function splitChatMessageForEmojiPresentation(text) {
  const raw = String(text ?? '');
  if (!raw) return [{ type: 'text', value: '' }];
  let segmenter;
  try {
    segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  } catch {
    return [{ type: 'text', value: raw }];
  }
  const runs = [];
  let textBuf = '';
  let emojiBuf = '';
  const flushText = () => {
    if (textBuf) {
      runs.push({ type: 'text', value: textBuf });
      textBuf = '';
    }
  };
  const flushEmoji = () => {
    if (emojiBuf) {
      runs.push({ type: 'emoji', value: emojiBuf });
      emojiBuf = '';
    }
  };
  for (const { segment } of segmenter.segment(raw)) {
    if (isEmojiGraphemeCluster(segment)) {
      flushText();
      emojiBuf += segment;
    } else {
      flushEmoji();
      textBuf += segment;
    }
  }
  flushText();
  flushEmoji();
  return runs.length ? runs : [{ type: 'text', value: raw }];
}

function getFileExtension(name) {
  if (!name || typeof name !== 'string') return '';
  const i = name.lastIndexOf('.');
  if (i <= 0 || i === name.length - 1) return '';
  return name.slice(i + 1).toLowerCase();
}

function chatImagePathFromMessageText(text) {
  const t = String(text || '').trim();
  if (CHAT_IMAGE_PATH_RE.test(t)) return t;
  try {
    const u = new URL(t);
    const idx = u.pathname.indexOf('/api/chat/image/');
    if (idx >= 0) {
      const p = u.pathname.slice(idx);
      return CHAT_IMAGE_PATH_RE.test(p) ? p : null;
    }
  } catch {
    /* not absolute URL */
  }
  return null;
}

function chatImageDisplaySrc(text) {
  const t = String(text || '').trim();
  if (t.startsWith('http://') || t.startsWith('https://')) return t;
  const p = chatImagePathFromMessageText(t);
  if (!p) return null;
  return `${getApiBaseUrl()}${p}`;
}

function chatDayKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'invalid';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function relativeDayLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.floor((startOfToday.getTime() - startOfDate.getTime()) / (24 * 60 * 60 * 1000));

  if (dayDiff <= 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  if (dayDiff <= 30) return `${dayDiff} days ago`;

  let years = now.getFullYear() - date.getFullYear();
  let months = now.getMonth() - date.getMonth();
  let days = now.getDate() - date.getDate();
  if (days < 0) {
    months -= 1;
    const previousMonthDays = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    days += previousMonthDays;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts = [];
  if (years > 0) parts.push(`${years} year${years === 1 ? '' : 's'}`);
  if (months > 0) parts.push(`${months} month${months === 1 ? '' : 's'}`);
  if (days > 0) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  return parts.length ? `${parts.join(' ')} ago` : `${Math.max(dayDiff, 1)} days ago`;
}

function chatDayHeaderText(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { dateLabel: String(value ?? ''), relativeLabel: '' };
  return {
    dateLabel: date.toLocaleDateString(),
    relativeLabel: relativeDayLabel(date)
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function friendPhoto(friend) {
  const src = String(friend?.profile_image_url || '').trim();
  return src || null;
}

function selfPhoto(user) {
  const photoFk = Number(user?.profile_image_fk);
  if (!Number.isFinite(photoFk) || photoFk <= 0) return null;
  return `${getApiBaseUrl()}/api/photo/${photoFk}`;
}

export default function VettedFriendsInlineChatPanel({ requestRow, focusComposerNonce = 0, refreshNonce = 0 }) {
  const theme = useTheme();
  const outgoingBubbleBg = COLOR_TEMPLATE1_BG_SELECTED;
  const outgoingBubbleTextColor = COLOR_TEMPLATE1_TEXT_SELECTED;
  const incomingBubbleBg = COLOR_TEMPLATE1_BG_UNSELECTED;
  const incomingBubbleTextColor = COLOR_TEMPLATE1_TEXT_UNSELECTED;
  const navigate = useNavigate();
  const downSM = useMediaQuery(theme.breakpoints.down('sm'));
  const isMobileUpload = useMediaQuery(MOBILE_UPLOAD_MAX_CSS);
  const { user } = useAuth();
  const friendId = Number(requestRow?.singles_id_to);
  const friendIdOk = Number.isFinite(friendId) && friendId > 0;

  const [state, setState] = useState(() => loadChatWithFriendsState());
  const [draftByFriend, setDraftByFriend] = useState({});
  const [sendingByFriend, setSendingByFriend] = useState({});
  const [openFriendIds, setOpenFriendIds] = useState([]);
  const inputRefs = useRef({});
  const chatLogRefs = useRef({});
  const skipAutoScrollRef = useRef(false);
  const [historyPagingByFriend, setHistoryPagingByFriend] = useState({});

  const [photoUploadOpen, setPhotoUploadOpen] = useState(false);
  const [photoUploadFriendId, setPhotoUploadFriendId] = useState(null);
  const [dragOverPhotoDrop, setDragOverPhotoDrop] = useState(false);
  const [chatImageBusy, setChatImageBusy] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [wrongFormatDialogOpen, setWrongFormatDialogOpen] = useState(false);
  const [wrongFormatAttemptFile, setWrongFormatAttemptFile] = useState('');
  const [fileTooLargeDialogOpen, setFileTooLargeDialogOpen] = useState(false);
  const [chatFontOffsetPx, setChatFontOffsetPx] = useState(0);
  const [chatFontPrefsLoaded, setChatFontPrefsLoaded] = useState(false);
  const [failedProfileSrcByFriendId, setFailedProfileSrcByFriendId] = useState({});
  const [failedSelfProfileSrc, setFailedSelfProfileSrc] = useState('');
  const [emojiAnchorEl, setEmojiAnchorEl] = useState(null);
  const [emojiTargetFriendId, setEmojiTargetFriendId] = useState(null);

  const chatDesktopFileInputRef = useRef(null);
  const chatMobileCameraInputRef = useRef(null);
  const chatMobileGalleryInputRef = useRef(null);
  const pendingCameraFriendRef = useRef(null);

  const appendConversationMessage = useCallback((friendId2, incoming) => {
    if (incoming == null) return;
    const key = String(Number(friendId2));
    if (!Number.isFinite(Number(key)) || Number(key) < 1) return;
    setState((prev) => {
      const existing = Array.isArray(prev?.conversations?.[key]) ? prev.conversations[key] : [];
      if (existing.some((m) => String(m.id) === String(incoming.id))) return prev;
      const next = {
        ...prev,
        conversations: {
          ...(prev?.conversations || {}),
          [key]: [...existing, incoming]
        }
      };
      saveChatWithFriendsState(next);
      return next;
    });
  }, []);

  const reloadChatFromServer = useCallback(async () => {
    if (!friendIdOk) return;
    try {
      const historyPage = await fetchChatHistoryPage(friendId, { limit: INITIAL_CHAT_MESSAGES_LIMIT });
      setState((prev) => {
        const nextConversations = { ...(prev?.conversations || {}) };
        const fromApi = historyPage?.messages;
        nextConversations[String(friendId)] = Array.isArray(fromApi) ? fromApi : [];
        const next = { ...prev, conversations: nextConversations };
        saveChatWithFriendsState(next);
        return next;
      });
      setHistoryPagingByFriend((prev) => ({
        ...prev,
        [String(friendId)]: {
          hasMore: historyPage?.has_more === true || historyPage?.has_more === 1,
          nextCursor: historyPage?.next_cursor ?? null,
          loading: false
        }
      }));
    } catch (err) {
      console.error('[VettedFriendsInlineChatPanel] failed to reload chat', err);
    }
  }, [friendId, friendIdOk]);

  const chatBodyFontSizeSx = useMemo(() => {
    const m = Math.round(BASE_MOBILE_CHAT_PX + chatFontOffsetPx);
    const d = Math.round(BASE_DESKTOP_CHAT_PX + chatFontOffsetPx);
    return { xs: `${m}px`, sm: `${d}px` };
  }, [chatFontOffsetPx]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await fetchUserCustomization();
        if (!cancelled) setChatFontOffsetPx(v.chatFontSize == null ? 0 : v.chatFontSize);
      } catch (err) {
        console.error('[VettedFriendsInlineChatPanel] load chat font preference failed', err);
      } finally {
        if (!cancelled) setChatFontPrefsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistChatFontOffset = useCallback(async (offset) => {
    try {
      const normalized = Math.trunc(offset);
      const saved = await saveUserCustomization({ chatFontSize: normalized === 0 ? null : normalized });
      setChatFontOffsetPx(saved.chatFontSize == null ? 0 : saved.chatFontSize);
    } catch (err) {
      console.error('[VettedFriendsInlineChatPanel] save chat font preference failed', err);
    }
  }, []);

  const bumpChatFontUp = useCallback(() => {
    void persistChatFontOffset(chatFontOffsetPx + 1);
  }, [chatFontOffsetPx, persistChatFontOffset]);

  const bumpChatFontDown = useCallback(() => {
    void persistChatFontOffset(chatFontOffsetPx - 1);
  }, [chatFontOffsetPx, persistChatFontOffset]);

  const friends = useMemo(() => {
    if (!friendIdOk || !requestRow) return [];
    return [
      {
        singles_id_to: friendId,
        memberLabel: formatMemberLabel({
          alias: requestRow.alias,
          singlesId: friendId,
          prefix: requestRow.prefix,
          memberId: requestRow.member_id
        }),
        profile_image_url: requestRow.profile_image_url ?? '',
        gallery_image_urls: Array.isArray(requestRow.gallery_image_urls) ? requestRow.gallery_image_urls : []
      }
    ];
  }, [friendId, friendIdOk, requestRow]);

  useEffect(() => {
    if (!friendIdOk || !requestRow) return;
    const nextState = upsertFriendFromRequestRow(requestRow);
    setState(nextState);
    setOpenFriendIds([friendId]);
  }, [requestRow, friendId, friendIdOk]);

  useEffect(() => {
    if (!friendIdOk) return;
    const name = getChatWithFriendsUpdatedEventName();
    const onStore = (e) => {
      const s = e?.detail?.state;
      if (s) setState(s);
    };
    window.addEventListener(name, onStore);
    return () => window.removeEventListener(name, onStore);
  }, [friendIdOk]);

  const activeFriend = useMemo(() => {
    if (!friendIdOk) return null;
    return friends[0] ?? null;
  }, [friends, friendIdOk]);

  useEffect(() => {
    if (!friendIdOk) return;
    void reloadChatFromServer();
  }, [friendId, friendIdOk, refreshNonce, reloadChatFromServer]);

  useLayoutEffect(() => {
    if (!activeFriend || focusComposerNonce < 1) return;
    const id = Number(activeFriend.singles_id_to);
    let raf2 = 0;
    const focusComposer = () => {
      const el = inputRefs.current[id];
      if (!el || typeof el.focus !== 'function') return;
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
      if (typeof el.setSelectionRange === 'function') {
        const len = String(el.value ?? '').length;
        try {
          el.setSelectionRange(len, len);
        } catch {
          /* ignore */
        }
      }
    };
    focusComposer();
    const raf1 = requestAnimationFrame(() => {
      focusComposer();
      raf2 = requestAnimationFrame(focusComposer);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [focusComposerNonce, activeFriend]);

  useLayoutEffect(() => {
    if (skipAutoScrollRef.current) {
      skipAutoScrollRef.current = false;
      return;
    }
    let raf1 = 0;
    let raf2 = 0;
    const scrollOpenPanels = () => {
      for (const fid of openFriendIds) {
        const el = chatLogRefs.current[fid];
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      }
    };
    scrollOpenPanels();
    raf1 = requestAnimationFrame(() => {
      scrollOpenPanels();
      raf2 = requestAnimationFrame(scrollOpenPanels);
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [state.conversations, openFriendIds]);

  const loadOlderMessages = useCallback(
    async (friendIdValue, count) => {
      const id = Number(friendIdValue);
      const limit = Number(count);
      if (!Number.isFinite(id) || id < 1 || !Number.isFinite(limit) || limit < 1) return;
      const paging = historyPagingByFriend[String(id)] ?? {};
      const cursor = paging?.nextCursor;
      if (paging?.loading || !paging?.hasMore || !cursor?.sentAt || !cursor?.id) return;

      const scrollEl = chatLogRefs.current[id];
      const prevHeight = scrollEl?.scrollHeight ?? 0;
      const prevTop = scrollEl?.scrollTop ?? 0;

      setHistoryPagingByFriend((prev) => ({
        ...prev,
        [String(id)]: {
          ...(prev[String(id)] ?? {}),
          loading: true
        }
      }));
      try {
        const page = await fetchChatHistoryPage(id, {
          limit,
          beforeSentAt: cursor.sentAt,
          beforeMsgId: cursor.id
        });
        const older = Array.isArray(page?.messages) ? page.messages : [];
        if (older.length > 0) {
          skipAutoScrollRef.current = true;
          setState((prev) => {
            const key = String(id);
            const existing = Array.isArray(prev?.conversations?.[key]) ? prev.conversations[key] : [];
            const seen = new Set(existing.map((m) => String(m.id)));
            const prepend = [];
            for (const m of older) {
              const msgId = String(m?.id);
              if (seen.has(msgId)) continue;
              prepend.push(m);
              seen.add(msgId);
            }
            const next = {
              ...prev,
              conversations: {
                ...(prev?.conversations || {}),
                [key]: [...prepend, ...existing]
              }
            };
            saveChatWithFriendsState(next);
            return next;
          });
          requestAnimationFrame(() => {
            const el = chatLogRefs.current[id];
            if (!el) return;
            const newHeight = el.scrollHeight;
            el.scrollTop = Math.max(0, prevTop + (newHeight - prevHeight));
          });
        }
        setHistoryPagingByFriend((prev) => ({
          ...prev,
          [String(id)]: {
            hasMore: page?.has_more === true || page?.has_more === 1,
            nextCursor: page?.next_cursor ?? null,
            loading: false
          }
        }));
      } catch (err) {
        console.error('[VettedFriendsInlineChatPanel] failed to load older messages', err);
        setHistoryPagingByFriend((prev) => ({
          ...prev,
          [String(id)]: {
            ...(prev[String(id)] ?? {}),
            loading: false
          }
        }));
      }
    },
    [historyPagingByFriend]
  );

  const openInterestedAlbumFromChat = useCallback(
    (friend) => {
      const targetSinglesId = Number(friend?.singles_id_to);
      if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) return;
      const profileSrc = friendPhoto(friend);
      const gallery = Array.isArray(friend?.gallery_image_urls) ? friend.gallery_image_urls.filter(Boolean) : [];
      const imageUrls = [...new Set([profileSrc, ...gallery].filter(Boolean))];
      navigate('/publicPrivateAlbum', {
        state: {
          targetSinglesId,
          memberLabel: String(friend?.memberLabel || '').trim() || 'Member',
          imageUrls
        }
      });
    },
    [navigate]
  );

  const deliverChatText = useCallback(
    async (friendId, text) => {
      const id = Number(friendId);
      if (!Number.isFinite(id)) return;
      const clean = String(text ?? '').trim();
      if (!clean) return;
      let proceed = true;
      setSendingByFriend((prev) => {
        if (prev[id]) {
          proceed = false;
          return prev;
        }
        return { ...prev, [id]: true };
      });
      if (!proceed) return;
      try {
        await sendChatMessageApi(id, clean);
        await reloadChatFromServer();
        dispatchBellNotificationRefresh('chat');
        setState((prev) => {
          const next = { ...prev, activeFriendId: id };
          saveChatWithFriendsState(next);
          return next;
        });
        requestAnimationFrame(() => inputRefs.current?.[id]?.focus?.());
      } catch (err) {
        console.error('[VettedFriendsInlineChatPanel] failed to send chat message', err);
        throw err;
      } finally {
        setSendingByFriend((prev) => ({ ...prev, [id]: false }));
      }
    },
    [reloadChatFromServer]
  );

  const getOutgoingDraftText = useCallback(
    (friendId) => {
      const id = Number(friendId);
      if (!Number.isFinite(id)) return '';
      const el = inputRefs.current?.[id];
      const dom = el != null && typeof el.value === 'string' ? el.value : null;
      const st = draftByFriend[id];
      const a = String(st ?? '').trimEnd();
      const b = dom != null ? String(dom).trimEnd() : a;
      if (a === b) return a.trim();
      // After emoji insert or IME, DOM and state can briefly disagree; keep the longer trailing content.
      return (a.length >= b.length ? a : b).trim();
    },
    [draftByFriend]
  );

  const sendMessage = async (friendId) => {
    const id = Number(friendId);
    if (!Number.isFinite(id)) return;
    const text = getOutgoingDraftText(id);
    if (!text) return;
    try {
      await deliverChatText(id, text);
      setDraftByFriend((prev) => ({ ...prev, [id]: '' }));
    } catch {
      /* deliverChatText already logged */
    }
  };

  const handleChatImageFiles = useCallback(
    async (files, friendId) => {
      const id = Number(friendId);
      if (!Number.isFinite(id)) return;
      const list = Array.from(files || []).filter(Boolean);
      if (!list.length) return;
      setMediaError(null);
      setChatImageBusy(true);
      let hadUploadErrors = false;
      let uploadedCount = 0;
      try {
        for (let i = 0; i < list.length; i += 1) {
          const file = list[i];
          const ext = getFileExtension(file.name);
          const mime = String(file.type || '').toLowerCase();
          const hasAllowedExt = ALLOWED_UPLOAD_EXT.has(ext);
          const hasImageMime = mime.startsWith('image/');
          // Some browsers/filesystems return empty MIME for otherwise valid images.
          // Accept by known extension in that case to avoid false negatives.
          if (!hasAllowedExt || (!hasImageMime && mime !== '')) {
            setWrongFormatAttemptFile(file.name);
            setWrongFormatDialogOpen(true);
            hadUploadErrors = true;
            continue;
          }
          const dataUrl = await readFileAsDataUrl(file);
          const path = await uploadChatInlineImage(dataUrl);
          if (!path) {
            setMediaError({ friendId: id, message: 'Upload failed. Please try again.' });
            hadUploadErrors = true;
            continue;
          }
          await deliverChatText(id, path);
          uploadedCount += 1;
        }
      } catch (err) {
        const status = err.response?.status;
        const code = err.response?.data?.code;
        if (status === 400 && code === 'FILE_TOO_LARGE') {
          setFileTooLargeDialogOpen(true);
        } else {
          setMediaError({
            friendId: id,
            message: err.response?.data?.error || err.message || 'Upload failed'
          });
        }
        hadUploadErrors = true;
      } finally {
        setChatImageBusy(false);
        // Keep dialog open when everything fails so user can retry quickly.
        if (!hadUploadErrors || uploadedCount > 0) {
          setPhotoUploadOpen(false);
          setPhotoUploadFriendId(null);
          setDragOverPhotoDrop(false);
        }
      }
    },
    [deliverChatText]
  );

  const onPhotoDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOverPhotoDrop(false);
      if (photoUploadFriendId == null) return;
      handleChatImageFiles(e.dataTransfer?.files, photoUploadFriendId);
    },
    [handleChatImageFiles, photoUploadFriendId]
  );

  const onPhotoDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOverPhotoDrop(true);
  }, []);

  const onPhotoDragLeave = useCallback((e) => {
    e.preventDefault();
    setDragOverPhotoDrop(false);
  }, []);

  const onChatGalleryOrDesktopFileChange = useCallback(
    (e) => {
      const files = e.target.files;
      const fid = photoUploadFriendId;
      e.target.value = '';
      if (fid == null || !files?.length) return;
      void handleChatImageFiles(files, fid);
    },
    [handleChatImageFiles, photoUploadFriendId]
  );

  const onCameraCaptureFileChange = useCallback(
    (e) => {
      const files = e.target.files;
      e.target.value = '';
      const fid = pendingCameraFriendRef.current;
      pendingCameraFriendRef.current = null;
      if (fid == null || !files?.length) return;
      void handleChatImageFiles(files, fid);
    },
    [handleChatImageFiles]
  );

  const onEmojiPick = useCallback(
    (emoji) => {
      const fid = emojiTargetFriendId;
      if (fid == null) return;
      setDraftByFriend((prev) => ({ ...prev, [fid]: `${prev[fid] ?? ''}${emoji}` }));
      setEmojiAnchorEl(null);
      setEmojiTargetFriendId(null);
      requestAnimationFrame(() => inputRefs.current?.[fid]?.focus?.());
    },
    [emojiTargetFriendId]
  );

  const openEmojiPicker = useCallback((event, fid) => {
    event.stopPropagation();
    setEmojiAnchorEl(event.currentTarget);
    setEmojiTargetFriendId(Number(fid));
  }, []);

  const closeEmojiPicker = useCallback(() => {
    setEmojiAnchorEl(null);
    setEmojiTargetFriendId(null);
  }, []);

  const panelFriend = activeFriend;
  const selfProfileSrc = selfPhoto(user);
  const showSelfProfileImage = Boolean(selfProfileSrc) && failedSelfProfileSrc !== selfProfileSrc;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {panelFriend
        ? (() => {
            const friend = panelFriend;
            const fid = Number(friend.singles_id_to);
            const msgs = Array.isArray(state?.conversations?.[String(fid)]) ? state.conversations[String(fid)] : [];
            const paging = historyPagingByFriend[String(fid)] ?? {};
            const canLoadOlder =
              Boolean(paging.hasMore) &&
              Boolean(paging?.nextCursor?.sentAt) &&
              Number.isFinite(Number(paging?.nextCursor?.id)) &&
              Number(paging.nextCursor.id) > 0;
            const disableLoadOlder = Boolean(paging.loading) || !canLoadOlder;
            const profileSrc = friendPhoto(friend);
            const profileLoadFailed = failedProfileSrcByFriendId[fid] === profileSrc;
            const showProfileImage = Boolean(profileSrc) && !profileLoadFailed;
            const canComposeInPanel = true;
            /** Chat chrome area follows menu-like panel color. */
            const activePanelBg = 'var(--theme-secondary-color)';
            /** Message canvas stays white (as annotated). */
            const chatMessageSurfaceBg = '#ffffff';
            const chatChromeBorder = theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.12)';
            const headerStripMemberBg = activePanelBg;
            const headerStripYouBg = activePanelBg;
            return (
              <Box
                key={`chat-main-${friend.singles_id_to}`}
                sx={{
                  width: '100%',
                  minWidth: 0,
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                  boxSizing: 'border-box',
                  border: CHAT_THICK_BLACK_BORDER,
                  borderRadius: 1,
                  overflow: 'hidden'
                }}
              >
                <Card
                  sx={{
                    flexShrink: 0,
                    border: 'none',
                    backgroundColor: activePanelBg,
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0
                  }}
                >
                  <Box
                    sx={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'stretch',
                      minHeight: downSM ? 52 : { xs: 92, sm: 112 },
                      boxSizing: 'border-box',
                      borderBottom: CHAT_THICK_BLACK_BORDER
                    }}
                  >
                    <Box
                      sx={{
                        flex: '1 1 50%',
                        maxWidth: '50%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        px: 1,
                        pt: 1,
                        pb: downSM ? 0.25 : 0.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        bgcolor: headerStripMemberBg
                      }}
                    >
                      {showProfileImage ? (
                        <Box
                          component="img"
                          src={profileSrc}
                          alt={friend.memberLabel ?? 'Member'}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            openInterestedAlbumFromChat(friend);
                          }}
                          onError={() =>
                            setFailedProfileSrcByFriendId((prev) => ({
                              ...prev,
                              [fid]: profileSrc
                            }))
                          }
                          sx={{
                            width: downSM ? 44 : { xs: 64, sm: 78 },
                            height: downSM ? 44 : { xs: 64, sm: 78 },
                            objectFit: 'cover',
                            borderRadius: 1,
                            cursor: 'zoom-in'
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: downSM ? 44 : { xs: 64, sm: 78 },
                            height: downSM ? 44 : { xs: 64, sm: 78 },
                            borderRadius: 1,
                            bgcolor: '#f3f5f7'
                          }}
                        />
                      )}
                    </Box>
                    <Box
                      sx={{
                        flex: '1 1 50%',
                        maxWidth: '50%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        px: 1,
                        pt: 1,
                        pb: downSM ? 0.25 : 0.5,
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        bgcolor: headerStripYouBg
                      }}
                    >
                      {showSelfProfileImage ? (
                        <Box
                          component="img"
                          src={selfProfileSrc}
                          alt="You"
                          onError={() => setFailedSelfProfileSrc(selfProfileSrc)}
                          sx={{
                            width: downSM ? 44 : { xs: 64, sm: 78 },
                            height: downSM ? 44 : { xs: 64, sm: 78 },
                            objectFit: 'cover',
                            borderRadius: 1
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            width: downSM ? 44 : { xs: 64, sm: 78 },
                            height: downSM ? 44 : { xs: 64, sm: 78 },
                            borderRadius: 1,
                            bgcolor: '#f3f5f7'
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Card>
                <Card
                  sx={{
                    flex: 1,
                    minHeight: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    border: 'none',
                    borderTop: 'none',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    backgroundColor: activePanelBg,
                    overflow: 'hidden'
                  }}
                >
                  <Box
                    sx={{
                      p: 0.8,
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 0.8,
                      borderBottom: CHAT_THICK_BLACK_BORDER,
                      bgcolor: activePanelBg
                    }}
                  >
                    <Button
                      disabled={disableLoadOlder}
                      onClick={() => void loadOlderMessages(fid, 2)}
                      sx={CHAT_LOAD_OLDER_BUTTON_SX}
                    >
                      Prev 2 Mesg
                    </Button>
                    <Button
                      disabled={disableLoadOlder}
                      onClick={() => void loadOlderMessages(fid, 5)}
                      sx={CHAT_LOAD_OLDER_BUTTON_SX}
                    >
                      Prev 5 Mesg
                    </Button>
                    <Button
                      disabled={disableLoadOlder}
                      onClick={() => void loadOlderMessages(fid, 10)}
                      sx={CHAT_LOAD_OLDER_BUTTON_SX}
                    >
                      Prev 10 Mesg
                    </Button>
                  </Box>
                  <Box
                    ref={(el) => {
                      if (el) chatLogRefs.current[fid] = el;
                      else delete chatLogRefs.current[fid];
                    }}
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      overflowX: 'hidden',
                      overflowY: 'scroll',
                      WebkitOverflowScrolling: 'touch',
                      p: 1.5,
                      bgcolor: chatMessageSurfaceBg,
                      borderLeft: CHAT_THICK_BLACK_BORDER,
                      borderRight: CHAT_THICK_BLACK_BORDER,
                      scrollbarGutter: 'stable',
                      scrollbarColor: (theme) =>
                        `${theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)'} rgba(0,0,0,0.08)`,
                      '&::-webkit-scrollbar': { width: 10 },
                      '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.08)' },
                      '&::-webkit-scrollbar-thumb': {
                        backgroundColor: (theme) =>
                          theme.palette.mode === 'dark' ? 'var(--theme-secondary-color)' : 'var(--theme-primary-color)',
                        borderRadius: 8
                      }
                    }}
                  >
                    {msgs.length === 0 ? (
                      <Typography sx={{ color: '#607d8b', fontSize: chatBodyFontSizeSx }}>Start your conversation...</Typography>
                    ) : (
                      msgs.map((m, idx) => {
                        const prev = idx > 0 ? msgs[idx - 1] : null;
                        const showDayHeader = idx === 0 || chatDayKey(prev?.sentAt) !== chatDayKey(m?.sentAt);
                        const dayHeader = chatDayHeaderText(m?.sentAt);
                        const isMine = m.sender === 'me';
                        const imageSrc = chatImageDisplaySrc(m.text);
                        const messageParts = splitChatMessageForEmojiPresentation(m.text);
                        const onlyEmoji = messageParts.length > 0 && messageParts.every((part) => part.type === 'emoji');
                        const useNeutralBubble = Boolean(imageSrc) || onlyEmoji;
                        const bubbleBg = isMine ? outgoingBubbleBg : incomingBubbleBg;
                        const bubbleTextColor = isMine ? outgoingBubbleTextColor : incomingBubbleTextColor;
                        const bubbleBorder = isMine ? '1px solid var(--theme-primary-color)' : '1px solid var(--theme-primary-color)';
                        const showBubbleTail = !useNeutralBubble;
                        return (
                          <Box key={m.id}>
                            {showDayHeader ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 1.2 }}>
                                <Box sx={{ flex: 1, borderTop: '1px solid rgba(0,0,0,0.28)' }} />
                                <Typography
                                  sx={{
                                    color: '#455a64',
                                    fontWeight: 700,
                                    fontSize: { xs: '0.72rem', sm: '0.8rem' },
                                    textAlign: 'center',
                                    lineHeight: 1.2
                                  }}
                                >
                                  {dayHeader.dateLabel}
                                  <Box component="span" sx={{ display: 'block', fontWeight: 600 }}>
                                    ({dayHeader.relativeLabel})
                                  </Box>
                                </Typography>
                                <Box sx={{ flex: 1, borderTop: '1px solid rgba(0,0,0,0.28)' }} />
                              </Box>
                            ) : null}
                            <Box sx={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', mb: 1 }}>
                              <Box
                                sx={{
                                  px: 1.2,
                                  py: 0.8,
                                  borderRadius: '20px',
                                  maxWidth: '75%',
                                  mr: showBubbleTail && isMine ? '24px' : 0,
                                  ml: showBubbleTail && !isMine ? '24px' : 0,
                                  bgcolor: bubbleBg,
                                  border: bubbleBorder,
                                  position: 'relative',
                                  zIndex: 1,
                                  ...(showBubbleTail && {
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
                                  })
                                }}
                              >
                                {imageSrc ? (
                                  <Box
                                    component="img"
                                    src={imageSrc}
                                    alt="Chat attachment"
                                    sx={{
                                      display: 'block',
                                      maxWidth: '100%',
                                      maxHeight: 220,
                                      borderRadius: 0.5,
                                      border: 'none',
                                      outline: 'none',
                                      boxShadow: 'none',
                                      objectFit: 'contain'
                                    }}
                                  />
                                ) : (
                                  <Typography
                                    sx={{
                                      fontSize: chatBodyFontSizeSx,
                                      fontFamily: CHAT_MESSAGE_FONT_FAMILY(theme),
                                      color: `${bubbleTextColor} !important`,
                                      '& span': { color: `${bubbleTextColor} !important` },
                                      whiteSpace: 'pre-wrap',
                                      wordBreak: 'break-word'
                                    }}
                                  >
                                    {messageParts.map((part, pi) =>
                                      part.type === 'emoji' ? (
                                        <Box
                                          component="span"
                                          key={`${m.id}-em-${pi}`}
                                          sx={{
                                            backgroundColor: '#ffffff',
                                            border: 'none',
                                            outline: 'none',
                                            boxShadow: 'none',
                                            borderRadius: 0,
                                            display: 'inline-block',
                                            verticalAlign: 'middle',
                                            fontSize: '3em',
                                            lineHeight: 1,
                                            px: '2px',
                                            fontFamily: CHAT_MESSAGE_FONT_FAMILY(theme)
                                          }}
                                        >
                                          {part.value}
                                        </Box>
                                      ) : (
                                        <span key={`${m.id}-tx-${pi}`}>{part.value}</span>
                                      )
                                    )}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          </Box>
                        );
                      })
                    )}
                  </Box>
                  <Box
                    sx={{
                      borderTop: CHAT_THICK_BLACK_BORDER,
                      p: downSM ? 0.2 : 0.35,
                      flexShrink: 0,
                      bgcolor: activePanelBg
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-evenly',
                        gap: 0,
                        width: '100%',
                        mb: downSM ? 0.1 : 0.2,
                        minHeight: CHAT_TOOLBAR_ICON_SIZE,
                        border: CHAT_THICK_BLACK_BORDER,
                        borderBottom: 'none'
                      }}
                    >
                      <IconButton
                        aria-label="Upload image from files or drag and drop"
                        disabled={Boolean(sendingByFriend[fid]) || chatImageBusy}
                        sx={downSM ? MOBILE_CHAT_COMPOSER_ICON_SX : CHAT_COMPOSER_ICON_SX}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMediaError(null);
                          setPhotoUploadFriendId(fid);
                          setPhotoUploadOpen(true);
                        }}
                      >
                        <ImageOutlined />
                      </IconButton>
                      <IconButton
                        aria-label="Take a photo with camera or choose from library"
                        disabled={Boolean(sendingByFriend[fid]) || chatImageBusy}
                        sx={downSM ? MOBILE_CHAT_COMPOSER_ICON_SX : CHAT_COMPOSER_ICON_SX}
                        onClick={(e) => {
                          e.stopPropagation();
                          setMediaError(null);
                          pendingCameraFriendRef.current = fid;
                          chatMobileCameraInputRef.current?.click();
                        }}
                      >
                        <PhotoCameraOutlined />
                      </IconButton>
                      <IconButton
                        aria-label="Insert emoji"
                        disabled={Boolean(sendingByFriend[fid])}
                        sx={downSM ? MOBILE_CHAT_COMPOSER_ICON_SX : CHAT_COMPOSER_ICON_SX}
                        onClick={(e) => openEmojiPicker(e, fid)}
                      >
                        <EmojiEmotionsOutlined />
                      </IconButton>
                      {downSM ? (
                        <>
                          <Button
                            aria-label="Increase chat text size"
                            disabled={Boolean(sendingByFriend[fid]) || !chatFontPrefsLoaded}
                            sx={MOBILE_FONT_CONTROL_SX}
                            onClick={(e) => {
                              e.stopPropagation();
                              bumpChatFontUp();
                            }}
                          >
                            <TextSizeUpSvgIcon />
                          </Button>
                          <Button
                            aria-label="Decrease chat text size"
                            disabled={Boolean(sendingByFriend[fid]) || !chatFontPrefsLoaded}
                            sx={MOBILE_FONT_CONTROL_SX}
                            onClick={(e) => {
                              e.stopPropagation();
                              bumpChatFontDown();
                            }}
                          >
                            <TextSizeDownSvgIcon />
                          </Button>
                        </>
                      ) : (
                        <>
                          <IconButton
                            aria-label="Increase chat text size"
                            disabled={Boolean(sendingByFriend[fid]) || !chatFontPrefsLoaded}
                            sx={CHAT_FONT_SIZE_ICON_BUTTON_SX}
                            onClick={(e) => {
                              e.stopPropagation();
                              bumpChatFontUp();
                            }}
                          >
                            <TextSizeUpSvgIcon />
                          </IconButton>
                          <IconButton
                            aria-label="Decrease chat text size"
                            disabled={Boolean(sendingByFriend[fid]) || !chatFontPrefsLoaded}
                            sx={CHAT_FONT_SIZE_ICON_BUTTON_SX}
                            onClick={(e) => {
                              e.stopPropagation();
                              bumpChatFontDown();
                            }}
                          >
                            <TextSizeDownSvgIcon />
                          </IconButton>
                        </>
                      )}
                    </Box>
                    {mediaError?.friendId === fid ? (
                      <Typography variant="caption" color="error" sx={{ display: 'block', mb: 0.5 }}>
                        {mediaError.message}
                      </Typography>
                    ) : null}
                    <Box
                      sx={{
                        display: 'flex',
                        gap: 1,
                        minHeight: downSM ? 64 : 72,
                        alignItems: 'flex-end',
                        bgcolor: canComposeInPanel ? '#ffffff' : INACTIVE_CHAT_SURFACE,
                        border: CHAT_THICK_BLACK_BORDER,
                        borderRadius: 1,
                        px: 0.75,
                        py: 0.25
                      }}
                    >
                      <TextField
                        variant="standard"
                        fullWidth
                        size="small"
                        multiline
                        minRows={1}
                        maxRows={4}
                        disabled={Boolean(sendingByFriend[fid]) || !canComposeInPanel}
                        inputRef={(el) => {
                          inputRefs.current[fid] = el;
                        }}
                        placeholder="Type a message here..."
                        InputProps={{
                          disableUnderline: true,
                          sx: {
                            fontSize: chatBodyFontSizeSx,
                            fontFamily: CHAT_MESSAGE_FONT_FAMILY(theme),
                            '& input::placeholder, & textarea::placeholder': {
                              color: '#000',
                              opacity: 0.78
                            }
                          }
                        }}
                        inputProps={{ 'data-ui-test-target': `chat-input-${fid}` }}
                        value={draftByFriend[fid] ?? ''}
                        onFocus={() => {}}
                        onChange={(e) => setDraftByFriend((prev) => ({ ...prev, [fid]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                            e.preventDefault();
                            sendMessage(fid);
                          }
                        }}
                      />
                      <Button
                        variant="contained"
                        data-ui-test-target={`chat-send-${fid}`}
                        onClick={() => sendMessage(fid)}
                        disabled={Boolean(sendingByFriend[fid]) || !canComposeInPanel}
                        sx={{
                          ...colorTemplate1ButtonSx({ selected: true }),
                          textTransform: 'none',
                          minWidth: 200,
                          minHeight: 64,
                          height: 64,
                          px: 3,
                          fontSize: '1.9rem',
                          fontWeight: 700,
                          borderRadius: 1,
                          ...buttonHoverMagnifyTransitionSx,
                          '@media (hover: hover)': {
                            '&:hover:not(.Mui-disabled)': {
                              ...colorTemplate1ButtonSx({ selected: true })['@media (hover: hover)']['&:hover'],
                              ...buttonHoverMagnifyFontSx({ baseFontSize: { xs: '1.9rem', sm: '1.9rem' } })
                            }
                          }
                        }}
                      >
                        {sendingByFriend[fid] ? 'Sending...' : 'Send'}
                      </Button>
                    </Box>
                  </Box>
                </Card>
              </Box>
            );
          })()
        : null}

      <input
        ref={chatDesktopFileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={onChatGalleryOrDesktopFileChange}
      />
      <input
        ref={chatMobileCameraInputRef}
        type="file"
        accept={ACCEPT}
        capture="user"
        style={{ display: 'none' }}
        onChange={onCameraCaptureFileChange}
      />
      <input
        ref={chatMobileGalleryInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={onChatGalleryOrDesktopFileChange}
      />

      <ColorTemplate7PopupLargeDark
        open={photoUploadOpen}
        onClose={() => {
          if (chatImageBusy) return;
          setPhotoUploadOpen(false);
          setPhotoUploadFriendId(null);
          setDragOverPhotoDrop(false);
        }}
        closeOnBackdrop={!chatImageBusy}
        showCloseButton={!chatImageBusy}
        closeButtonAriaLabel="Close send photo dialog"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={2}>
          <ColorTemplate7PopupLargeDark.Title sx={{ textAlign: 'center' }}>Send a photo</ColorTemplate7PopupLargeDark.Title>
          {chatImageBusy ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : isMobileUpload ? (
            <Box sx={{ mb: 1 }}>
              <Box
                sx={{
                  bgcolor: MOBILE_UPLOAD_SURFACE_BG,
                  borderRadius: 2,
                  p: 1.25,
                  width: '100%',
                  maxWidth: 420,
                  mx: 'auto',
                  boxSizing: 'border-box'
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    width: '100%',
                    aspectRatio: '1 / 1',
                    maxHeight: 280,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Box
                    component="img"
                    src={cameraOrPhotoUploadImg}
                    alt=""
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                      pointerEvents: 'none',
                      userSelect: 'none'
                    }}
                  />
                  <Box
                    component="button"
                    type="button"
                    aria-label="Take a photo with your camera"
                    onClick={() => {
                      if (photoUploadFriendId != null) pendingCameraFriendRef.current = photoUploadFriendId;
                      chatMobileCameraInputRef.current?.click();
                    }}
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: '50%',
                      border: 'none',
                      p: 0,
                      m: 0,
                      cursor: 'pointer',
                      bgcolor: 'transparent',
                      borderRadius: 0
                    }}
                  />
                  <Box
                    component="button"
                    type="button"
                    aria-label="Open photo library"
                    onClick={() => chatMobileGalleryInputRef.current?.click()}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: '50%',
                      border: 'none',
                      p: 0,
                      m: 0,
                      cursor: 'pointer',
                      bgcolor: 'transparent',
                      borderRadius: 0
                    }}
                  />
                </Box>
              </Box>
              <ColorTemplate7PopupLargeDark.BodyText sx={{ mt: 1.5, textAlign: 'center' }}>
                Tap camera or gallery to add your image to this chat.
              </ColorTemplate7PopupLargeDark.BodyText>
            </Box>
          ) : (
            <Box
              onDrop={onPhotoDrop}
              onDragOver={onPhotoDragOver}
              onDragLeave={onPhotoDragLeave}
              onClick={() => chatDesktopFileInputRef.current?.click()}
              sx={{
                border: '2px dashed',
                borderColor: dragOverPhotoDrop ? 'primary.main' : 'grey.400',
                borderRadius: 2,
                bgcolor: 'var(--theme-secondary-color)',
                minHeight: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background-color 0.2s, border-color 0.2s',
                px: 1.5,
                py: 2
              }}
            >
              <Box
                component="img"
                src={dragDropClickUploadImg}
                alt="Drag and drop or click to upload"
                sx={{
                  maxWidth: 'min(100%, 220px)',
                  width: '100%',
                  height: 'auto',
                  mb: 1,
                  display: 'block',
                  userSelect: 'none',
                  pointerEvents: 'none'
                }}
              />
              <ColorTemplate7PopupLargeDark.BodyText sx={{ mb: 0.5, textAlign: 'center' }}>
                Drag and drop or click here to upload your image.
              </ColorTemplate7PopupLargeDark.BodyText>
              <ColorTemplate7PopupLargeDark.SectionDescription sx={{ textAlign: 'center', maxWidth: 360 }}>
                Accept file extensions: .jpg, .jpeg, .png, .gif, and .webp
              </ColorTemplate7PopupLargeDark.SectionDescription>
            </Box>
          )}
          <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate7PopupLargeDark.ActionButton
              disabled={chatImageBusy}
              onClick={() => {
                if (chatImageBusy) return;
                setPhotoUploadOpen(false);
                setPhotoUploadFriendId(null);
                setDragOverPhotoDrop(false);
              }}
            >
              Close
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={wrongFormatDialogOpen}
        onClose={() => setWrongFormatDialogOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close unsupported file type dialog"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={2}>
          <ColorTemplate7PopupLargeDark.Title>Unsupported file type</ColorTemplate7PopupLargeDark.Title>
          <ColorTemplate7PopupLargeDark.BodyText>
            The file &quot;{wrongFormatAttemptFile}&quot; is not an allowed image type. Please use .jpg, .jpeg, .png, .gif, or .webp.
          </ColorTemplate7PopupLargeDark.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate7PopupLargeDark.ActionButton onClick={() => setWrongFormatDialogOpen(false)}>
              OK
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <ColorTemplate7PopupLargeDark
        open={fileTooLargeDialogOpen}
        onClose={() => setFileTooLargeDialogOpen(false)}
        closeOnBackdrop
        closeButtonAriaLabel="Close file too large dialog"
      >
        <ColorTemplate7PopupLargeDark.Body spacing={2}>
          <ColorTemplate7PopupLargeDark.Title>File too large</ColorTemplate7PopupLargeDark.Title>
          <ColorTemplate7PopupLargeDark.BodyText>
            Please choose a smaller image (within your account upload limit) and try again.
          </ColorTemplate7PopupLargeDark.BodyText>
          <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" sx={{ width: '100%' }}>
            <ColorTemplate7PopupLargeDark.ActionButton onClick={() => setFileTooLargeDialogOpen(false)}>
              OK
            </ColorTemplate7PopupLargeDark.ActionButton>
          </Stack>
        </ColorTemplate7PopupLargeDark.Body>
      </ColorTemplate7PopupLargeDark>

      <Popover
        open={Boolean(emojiAnchorEl)}
        anchorEl={emojiAnchorEl}
        onClose={closeEmojiPicker}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: { p: 1, maxWidth: 300 }
          }
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
          {CHAT_QUICK_EMOJIS.map((em, emojiIdx) => (
            <Button
              key={`${emojiIdx}-${em}`}
              variant="text"
              onClick={() => onEmojiPick(em)}
              sx={{ minWidth: 36, minHeight: 36, p: 0, fontSize: '1.35rem', lineHeight: 1 }}
            >
              {em}
            </Button>
          ))}
        </Box>
      </Popover>
    </Box>
  );
}
