import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import MainCard from 'ui-component/cards/MainCard';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import PageInstructionPopup from 'ui-component/PageInstructionPopup';
import PageInstructionAudioTutorial from 'ui-component/PageInstructionAudioTutorial';
import ColorTemplate11Posting from 'ui-component/ColorTemplate11Posting';
import FriendshipStatesDiagramZoom from 'ui-component/FriendshipStatesDiagramZoom';
import friendShipStatesPickPostsImg from 'assets/images/friendShipStates_PickPosts.png';
import UserRound from 'assets/images/users/profile.jpeg';
import audioMyPicksSora from 'assets/sound/my_picks_instruction_Sora.m4a';
import audioMyPicksJessica from 'assets/sound/my_picks_instruction_Jessica.m4a';
import audioMyPicksMichael from 'assets/sound/my_picks_instruction_Michael.m4a';
import { IconX } from '@tabler/icons-react';
import { invalidateAllSinglesCache } from 'api/allSinglesFe';
import {
  fetchMyPicksFeedPage,
  fetchPostingLikes,
  invalidateMyPicksFeedCache,
  invalidateMyPicksListCache,
  postMyPosting,
  togglePostingLike,
  useGetMyPicksFeed,
  useGetMyPicksList
} from 'api/myPicksFe';
import PostingCommentsDialog from './PostingCommentsDialog';
import PostingLikesDialog from './PostingLikesDialog';
import { postInterestedRequestInfo, postNotInterested } from 'api/interestedSinglesFe';
import { formatMemberLabel, formatMemberNumber, getMemberDisplayLines } from 'utils/memberLabel';
import { TOUR_DEMO_MEMBER_NUMBERS } from 'utils/vsinglesTourActions';
import { getDesktopTitleFontSizeVw } from 'config/desktopFontEnv';
import {
  COLOR_TEMPLATE11_POSTING_INITIAL_LIMIT,
  COLOR_TEMPLATE11_POSTING_PHOTO_FULLSCREEN_HINT_VIEW_ONLY
} from 'config/colorTemplate11Posting';
import usePostingFeedDelete from 'hooks/usePostingFeedDelete';
import { usePostingAlbumMediaFullscreen } from 'hooks/usePostingAlbumMediaFullscreen';
import PostingAlbumMediaFullscreen from 'ui-component/PostingAlbumMediaFullscreen';
import AlbumMediaDoubleClickSurface from 'ui-component/AlbumMediaDoubleClickSurface';
import ColorTemplate8PhotoGallery from 'ui-component/ColorTemplate8PhotoGallery';
import PageInstructionEarnTokensAction from 'ui-component/PageInstructionEarnTokensAction';
import PageVideoTutorialsButton from 'ui-component/PageVideoTutorialsButton';
import EarnTokensPageTitle from 'ui-component/EarnTokensPageTitle';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import UnSelectedButtonTemplate from 'ui-component/UnSelectedButtonTemplate';
import { SELECTED_BUTTON_TEMPLATE_TEXT } from 'config/selectedUnselectedButtonTemplate';
import { colorTemplate8PhotoGalleryRemoveSpinnerSx } from 'config/colorTemplate8PhotoGallery';
import {
  MEMBER_PHOTO_STACK_SX,
  MEMBER_INCOMING_APPROVED_SASH_SX,
  MEMBER_RELATIONSHIP_TAG_SX,
  memberRelationshipRibbonKind,
  memberRelationshipRibbonLabel
} from 'config/memberRelationshipRibbon';
import { getMobileSinglesTitleFontSizeVw } from 'config/singlesMemberCardFontEnv';
import { useAuth } from 'contexts/AuthContext';
import { guestDemoAllowProps } from 'utils/guestDemoLogin';
import {
  MANUAL_REFRESH_BUTTON_SX,
  MANUAL_REFRESH_POSTS_HINT_LINES
} from 'config/manualRefreshButtonEnv';
import useManualRefreshHintSx from 'hooks/useManualRefreshHintSx';
import { dispatchBellNotificationRefresh } from 'utils/notificationBellStore';
import { themedAlert } from 'utils/themedDialog';
import { isMyPicksDedupeRefreshEnabled } from 'config/myPicksRefreshEnv';
import NotificationSection from 'layout/MainLayout/Header/NotificationSection';
import { colorTemplate1WallColorByTheme } from 'config/colorTemplate1';
import { buttonFontSizeResponsive } from 'config/buttonFontEnv';
import {
  MY_PICKS_ACQUAINTANCE_REQUEST_TOOLTIP,
  MY_PICKS_FRIEND_REQUEST_TOOLTIP,
  getMyPicksAvatarSize,
  myPicksBioGreenRequestButtonSx,
  myPicksBioRequestTooltipSlotProps
} from 'config/myPicksCardEnv';
import { isSelfIntroVideoPostingUrl, videoThumbnailUrlFromPostingUrl } from 'api/selfIntroVideoFe';

const MY_PICKS_ORDER_LS_PREFIX = 'myPicksPhotoOrder:';
const INITIAL_POSTS_LIMIT = COLOR_TEMPLATE11_POSTING_INITIAL_LIMIT;
const INSTRUCTION_POPUP_TEXT =
  'You are here because you clicked "My Picks" on someone who caught your eye (romance) or shared your hobbies (hobby partners). From here in "Picks & Posts," you can explore their life story and get a glimpse into their world.\n\n' +
  'After viewing their Public Albums & Postings, you now have two choices: click "Acquaintance Request!" or "Buddy Request!" (or x to remove).  Full Bio contains Brief Bio informations; so best request only one and wait for response, instead request both.\n\n' +
  'With an Acquaintance Request, you two mutually agree to share a "Brief Bio" (photo validation, age, height, gender, and city).\n\n' +
  'With a Buddy Request, you two mutually agree to share a "Full Bio" (employer domain, LinkedIn URL, job title, education details, and 16 other favorites/infos).\n\n' +
  'Please head over to the "My Self-Report-Bio" menu and complete all reporting there. Other members are much more likely to approve your request if they see your profile is marked "Completed" (your answers remain hidden until both of you mutually agree to swap bios).\n\n' +
  'After sending a request, wait for their approval under the "Acquaintances & Buddies" menu, where their profile will appear once approved. Get the next tutorial step by clicking the orange top-right button on that menu.';

const MY_PICKS_INSTRUCTION_CONTEXT_STEP = 'You are on the "Picks & Posts" step';

const MY_PICKS_INSTRUCTION_AUDIO_BY_VOICE = {
  Sora: typeof audioMyPicksSora === 'string' ? audioMyPicksSora : audioMyPicksSora?.default || '',
  Jessica: typeof audioMyPicksJessica === 'string' ? audioMyPicksJessica : audioMyPicksJessica?.default || '',
  Michael: typeof audioMyPicksMichael === 'string' ? audioMyPicksMichael : audioMyPicksMichael?.default || ''
};

function loadSavedOrderIds(storageKey, serverIds) {
  if (!storageKey) return [...serverIds];
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [...serverIds];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...serverIds];
    const saved = parsed.map(Number).filter((n) => Number.isFinite(n) && n >= 1);
    const serverSet = new Set(serverIds);
    const next = [];
    const used = new Set();
    for (const id of saved) {
      if (serverSet.has(id)) {
        next.push(id);
        used.add(id);
      }
    }
    for (const id of serverIds) {
      if (!used.has(id)) next.push(id);
    }
    return next;
  } catch {
    return [...serverIds];
  }
}

function persistMyPicksOrder(storageKey, ids) {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // ignore quota / private mode
  }
}

export default function MyPicks() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { myPicksList, myPicksListLoading, myPicksListError, refetchMyPicksList } = useGetMyPicksList();
  const [selectedSinglesId, setSelectedSinglesId] = useState(null);
  const { myPicksFeed, myPicksFeedLoading, myPicksFeedError, refetchMyPicksFeed } = useGetMyPicksFeed(selectedSinglesId, {
    limit: INITIAL_POSTS_LIMIT,
    visibilityFeed: 'public'
  });
  const [commentsDialog, setCommentsDialog] = useState(null);
  const [removePickBusyId, setRemovePickBusyId] = useState(null);
  const [likeBusyPostId, setLikeBusyPostId] = useState(null);
  const orderStorageKey = user?.singles_id ? `${MY_PICKS_ORDER_LS_PREFIX}${user.singles_id}` : null;
  const orderStorageKeyRef = useRef(orderStorageKey);
  const [orderedIds, setOrderedIds] = useState([]);
  const [draggingSinglesId, setDraggingSinglesId] = useState(null);
  const [dropTargetSinglesId, setDropTargetSinglesId] = useState(null);
  const [instructionOpen, setInstructionOpen] = useState(false);
  const [refreshPostsBusy, setRefreshPostsBusy] = useState(false);
  const [feedPosts, setFeedPosts] = useState([]);
  const [feedCursor, setFeedCursor] = useState(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [selectedGalleryImageUrl, setSelectedGalleryImageUrl] = useState('');
  const [activeRightTab, setActiveRightTab] = useState('postings');
  const [likesPostId, setLikesPostId] = useState(null);
  const [likesList, setLikesList] = useState([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesError, setLikesError] = useState('');
  const [bioRequestBusyKey, setBioRequestBusyKey] = useState('');
  const [shareRepostBusyPostId, setShareRepostBusyPostId] = useState(null);
  const manualRefreshHintSx = useManualRefreshHintSx();
  const { canDeletePosts, deleteBusy, handleDeletePosting, handleDeletePostingPhoto, deleteConfirmDialog } =
    usePostingFeedDelete(selectedSinglesId, { refetchFeed: refetchMyPicksFeed });

  const refreshPosts = useCallback(async () => {
    console.info('[picks-posts-feed]', {
      event: 'refreshPosts:start',
      selectedSinglesId,
      t: new Date().toISOString()
    });
    setRefreshPostsBusy(true);
    try {
      await refetchMyPicksList();
      if (selectedSinglesId != null) await refetchMyPicksFeed();
      dispatchBellNotificationRefresh('posts');
      console.info('[picks-posts-feed]', { event: 'refreshPosts:done', selectedSinglesId });
    } catch (err) {
      console.error('[picks-posts-feed]', {
        event: 'refreshPosts:error',
        selectedSinglesId,
        message: err?.message,
        status: err?.status
      });
      throw err;
    } finally {
      setRefreshPostsBusy(false);
    }
  }, [refetchMyPicksList, refetchMyPicksFeed, selectedSinglesId]);

  useEffect(() => {
    if (!myPicksFeed || Number(myPicksFeed.target_singles_id) !== Number(selectedSinglesId)) {
      console.info('[picks-posts-feed]', {
        event: 'page:feed-mismatch-clear',
        selectedSinglesId,
        feedTarget: myPicksFeed?.target_singles_id ?? null,
        loading: myPicksFeedLoading,
        error: myPicksFeedError?.message || null
      });
      setFeedPosts([]);
      setFeedCursor(null);
      setFeedHasMore(false);
      return;
    }
    const posts = Array.isArray(myPicksFeed.posts) ? myPicksFeed.posts : [];
    console.info('[picks-posts-feed]', {
      event: 'page:feed-applied',
      selectedSinglesId,
      postCount: posts.length,
      hasMore: Boolean(myPicksFeed.has_more),
      loading: myPicksFeedLoading
    });
    setFeedPosts(posts);
    setFeedCursor(myPicksFeed.next_cursor ?? null);
    setFeedHasMore(Boolean(myPicksFeed.has_more));
  }, [myPicksFeed, selectedSinglesId, myPicksFeedLoading, myPicksFeedError]);

  /** Legacy: on each visit, same as Refresh Posts (duplicates SWR mount fetches). Off when VITE_MY_PICKS_LEGACY_REFRESH is not true. */
  useEffect(() => {
    if (location.pathname !== '/myPicks') return;
    if (isMyPicksDedupeRefreshEnabled()) return;
    void refreshPosts();
  }, [location.pathname, location.key, refreshPosts]);

  /** Legacy: extra feed refetch when first pick is auto-selected (SWR already loads feed). */
  const prevSelectedSinglesIdRef = useRef(selectedSinglesId);
  useEffect(() => {
    if (location.pathname !== '/myPicks') return;
    if (isMyPicksDedupeRefreshEnabled()) return;
    const prev = prevSelectedSinglesIdRef.current;
    prevSelectedSinglesIdRef.current = selectedSinglesId;
    if (prev == null && selectedSinglesId != null) {
      void refetchMyPicksFeed();
    }
  }, [location.pathname, selectedSinglesId, refetchMyPicksFeed]);

  const picksById = useMemo(() => new Map(myPicksList.map((p) => [p.singles_id, p])), [myPicksList]);

  useEffect(() => {
    if (!myPicksList.length) {
      setOrderedIds([]);
      return;
    }
    const serverIds = myPicksList.map((p) => p.singles_id);
    const storageKeyChanged = orderStorageKeyRef.current !== orderStorageKey;
    orderStorageKeyRef.current = orderStorageKey;
    setOrderedIds((prev) => {
      if (!prev.length || storageKeyChanged) {
        return loadSavedOrderIds(orderStorageKey, serverIds);
      }
      const serverSet = new Set(serverIds);
      const next = [];
      const used = new Set();
      for (const id of prev) {
        if (serverSet.has(id)) {
          next.push(id);
          used.add(id);
        }
      }
      for (const id of serverIds) {
        if (!used.has(id)) next.push(id);
      }
      return next;
    });
  }, [myPicksList, orderStorageKey]);

  /** Drop selection when the pick leaves the list (e.g. target Suspend / not Active). */
  useEffect(() => {
    if (selectedSinglesId == null || myPicksListLoading) return;
    const stillListed = myPicksList.some((p) => Number(p.singles_id) === Number(selectedSinglesId));
    if (stillListed) return;
    setSelectedSinglesId(orderedIds[0] ?? null);
  }, [myPicksList, myPicksListLoading, orderedIds, selectedSinglesId]);

  useEffect(() => {
    if (selectedSinglesId != null) return;
    if (!orderedIds.length) return;
    setSelectedSinglesId(orderedIds[0]);
  }, [orderedIds, selectedSinglesId]);

  useEffect(() => {
    const qp = new URLSearchParams(location.search);
    const targetSinglesId = Number(qp.get('focusAuthor') ?? location.state?.targetSinglesId);
    if (!Number.isFinite(targetSinglesId) || targetSinglesId < 1) return;
    const inList = myPicksList.some((p) => Number(p.singles_id) === targetSinglesId);
    if (inList) setSelectedSinglesId(targetSinglesId);
    navigate({ pathname: location.pathname, search: '' }, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate, myPicksList]);

  const handleReorderDrop = (fromId, toId) => {
    const a = Number(fromId);
    const b = Number(toId);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return;
    setOrderedIds((ids) => {
      const next = [...ids];
      const fromIdx = next.indexOf(a);
      const toIdx = next.indexOf(b);
      if (fromIdx === -1 || toIdx === -1) return ids;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, a);
      persistMyPicksOrder(orderStorageKey, next);
      return next;
    });
  };

  const handleTogglePostingLike = async (postId) => {
    const numericPostId = Number(postId);
    if (!Number.isFinite(numericPostId) || numericPostId < 1 || likeBusyPostId != null) return;
    setLikeBusyPostId(numericPostId);
    try {
      await togglePostingLike(numericPostId);
      await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
    } catch (err) {
      await themedAlert(err?.message || 'Failed to update like');
    } finally {
      setLikeBusyPostId(null);
    }
  };

  const handleShowPostingLikes = async (_event, postId) => {
    const numericPostId = Number(postId);
    if (!Number.isFinite(numericPostId) || numericPostId < 1) return;
    setLikesPostId(numericPostId);
    setLikesLoading(true);
    setLikesError('');
    setLikesList([]);
    try {
      const likesPayload = await fetchPostingLikes(numericPostId);
      setLikesList(Array.isArray(likesPayload?.likes) ? likesPayload.likes : []);
    } catch (err) {
      const message = err?.message || 'Failed to load likes';
      setLikesError(message);
      await themedAlert(message);
    } finally {
      setLikesLoading(false);
    }
  };

  const closeLikesPopover = useCallback(() => {
    setLikesPostId(null);
    setLikesList([]);
    setLikesLoading(false);
    setLikesError('');
  }, []);

  const handleShareRepost = useCallback(
    async (post) => {
      const sourcePostId = Number(post?.post_id);
      const sourceOwnerId = Number(selectedSinglesId);
      if (!Number.isFinite(sourcePostId) || sourcePostId < 1 || shareRepostBusyPostId != null) return;
      if (!Number.isFinite(sourceOwnerId) || sourceOwnerId < 1) return;
      const content = String(post?.content ?? '').trim();
      const photo_urls = (Array.isArray(post?.photos) ? post.photos : [])
        .map((photo) => String(photo?.photo_url ?? '').trim())
        .filter(Boolean);
      if (!content && photo_urls.length === 0) {
        await themedAlert('Nothing to repost.');
        return;
      }
      setShareRepostBusyPostId(sourcePostId);
      try {
        const result = await postMyPosting({
          content,
          photo_urls,
          posting_visibility: 'public',
          reposted_from_singles_id: sourceOwnerId,
          reposted_from_post_id: sourcePostId
        });
        await invalidateMyPicksFeedCache();
        navigate('/myStory', {
          state: {
            storyTab: 'reviewPostings',
            repostedPostId: Number(result?.post_id) || null
          }
        });
      } catch (err) {
        await themedAlert(err?.message || 'Failed to repost');
      } finally {
        setShareRepostBusyPostId(null);
      }
    },
    [navigate, selectedSinglesId, shareRepostBusyPostId]
  );

  const handleLoadMorePosts = useCallback(
    async (count) => {
      const targetId = Number(selectedSinglesId);
      const limit = Number(count);
      if (!Number.isFinite(targetId) || targetId < 1) return;
      if (!Number.isFinite(limit) || limit < 1) return;
      if (loadMoreBusy || !feedHasMore || !feedCursor?.created_at || !feedCursor?.post_id) return;
      setLoadMoreBusy(true);
      console.info('[picks-posts-feed]', {
        event: 'load-more:start',
        targetId,
        limit,
        beforePostId: feedCursor.post_id
      });
      try {
        const page = await fetchMyPicksFeedPage(targetId, {
          limit,
          beforeCreatedAt: feedCursor.created_at,
          beforePostId: feedCursor.post_id,
          visibilityFeed: 'public'
        });
        const nextPosts = Array.isArray(page?.posts) ? page.posts : [];
        console.info('[picks-posts-feed]', {
          event: 'load-more:ok',
          targetId,
          nextCount: nextPosts.length,
          hasMore: page?.has_more
        });
        setFeedPosts((prev) => {
          const seen = new Set(prev.map((post) => Number(post.post_id)));
          const merged = [...prev];
          for (const post of nextPosts) {
            const id = Number(post?.post_id);
            if (!Number.isFinite(id) || seen.has(id)) continue;
            merged.push(post);
            seen.add(id);
          }
          return merged;
        });
        const cursor = page?.next_cursor;
        setFeedCursor(
          cursor && typeof cursor === 'object'
            ? {
                created_at: cursor.created_at ?? null,
                post_id: Number(cursor.post_id)
              }
            : null
        );
        setFeedHasMore(page?.has_more === true || page?.has_more === 1);
      } catch (err) {
        console.error('[picks-posts-feed]', {
          event: 'load-more:error',
          targetId,
          message: err?.message,
          status: err?.status
        });
        await themedAlert(err?.message || 'Failed to load older posts');
      } finally {
        setLoadMoreBusy(false);
      }
    },
    [selectedSinglesId, loadMoreBusy, feedHasMore, feedCursor]
  );

  const handleRemovePick = async (singlesIdTo) => {
    const id = Number(singlesIdTo);
    if (!Number.isFinite(id) || id < 1 || removePickBusyId != null) return;
    setRemovePickBusyId(id);
    try {
      await postNotInterested(id);
      if (Number(selectedSinglesId) === id) {
        const nextSelected = orderedIds.find((pickId) => Number(pickId) !== id);
        setSelectedSinglesId(nextSelected ?? null);
      }
      await Promise.all([refetchMyPicksList(), invalidateAllSinglesCache()]);
    } catch (err) {
      console.error('[MyPicks] remove pick failed', err?.message ?? err);
    } finally {
      setRemovePickBusyId(null);
    }
  };

  const selectedMember = useMemo(
    () => myPicksList.find((person) => Number(person.singles_id) === Number(selectedSinglesId)) ?? null,
    [myPicksList, selectedSinglesId]
  );
  const photoFullscreenOverlayLines = useMemo(() => {
    if (!selectedMember) return [];
    const { primary, secondary } = getMemberDisplayLines(selectedMember);
    return [primary, secondary].filter(Boolean);
  }, [selectedMember]);
  const {
    fullscreenOpen,
    fullscreenMediaUrl,
    fullscreenOverlayLines,
    openFullscreenMedia,
    closeFullscreenMedia
  } = usePostingAlbumMediaFullscreen();
  const openAlbumFullscreenMedia = useCallback(
    (mediaUrl) => {
      openFullscreenMedia(mediaUrl, photoFullscreenOverlayLines);
    },
    [openFullscreenMedia, photoFullscreenOverlayLines]
  );
  const selectedMemberGalleryUrls = useMemo(() => {
    if (!selectedMember) return [];
    const urls = Array.isArray(selectedMember.gallery_image_urls)
      ? selectedMember.gallery_image_urls.map((url) => String(url ?? '').trim()).filter(Boolean)
      : [];
    return urls;
  }, [selectedMember]);

  useEffect(() => {
    if (selectedMemberGalleryUrls.length === 0) {
      setSelectedGalleryImageUrl('');
      return;
    }
    if (!selectedMemberGalleryUrls.includes(selectedGalleryImageUrl)) {
      setSelectedGalleryImageUrl(selectedMemberGalleryUrls[0]);
    }
  }, [selectedMemberGalleryUrls, selectedGalleryImageUrl]);

  const isBioRequestFlagged = (value) => String(value ?? '').trim().toLowerCase() === 'requested';

  const myPicksRequestedRibbonSx = {
    position: 'absolute',
    zIndex: 100,
    top: '14%',
    left: '-38%',
    width: '100%',
    py: '0.2rem',
    bgcolor: '#e53935',
    color: '#fff',
    WebkitTextFillColor: '#fff',
    fontFamily: 'inherit',
    fontSize: { xs: '1.04rem', sm: '1.16rem' },
    fontWeight: 800,
    letterSpacing: 0.15,
    lineHeight: 1.15,
    textAlign: 'center',
    textTransform: 'none',
    whiteSpace: 'nowrap',
    transform: 'rotate(-45deg)',
    transformOrigin: 'center',
    pointerEvents: 'none',
    boxShadow: '0 1px 2px rgba(0,0,0,0.35)'
  };

  const handleSendBioRequest = useCallback(
    async (kind) => {
      const singlesIdTo = Number(selectedSinglesId);
      if (!Number.isFinite(singlesIdTo) || singlesIdTo < 1 || !selectedMember) return;
      const isBrief = kind === 'brief';
      const alreadyRequested = isBrief
        ? isBioRequestFlagged(selectedMember.brief_bio_request)
        : isBioRequestFlagged(selectedMember.full_bio_request);
      if (alreadyRequested) return;

      const busyKey = `${singlesIdTo}:${kind}`;
      if (bioRequestBusyKey) return;

      const payload = isBrief ? { brief_bio_request: 'requested' } : { full_bio_request: 'requested' };
      setBioRequestBusyKey(busyKey);
      try {
        await postInterestedRequestInfo(singlesIdTo, payload);
        await Promise.all([refetchMyPicksList(), invalidateMyPicksListCache()]);
        dispatchBellNotificationRefresh('bio');
      } catch (err) {
        await themedAlert(err?.message || 'Failed to send bio request');
      } finally {
        setBioRequestBusyKey('');
      }
    },
    [bioRequestBusyKey, refetchMyPicksList, selectedMember, selectedSinglesId]
  );

  const handleCancelBioRequest = useCallback(
    async (kind) => {
      const singlesIdTo = Number(selectedSinglesId);
      if (!Number.isFinite(singlesIdTo) || singlesIdTo < 1 || !selectedMember) return;
      const isBrief = kind === 'brief';
      const isRequested = isBrief
        ? isBioRequestFlagged(selectedMember.brief_bio_request)
        : isBioRequestFlagged(selectedMember.full_bio_request);
      if (!isRequested) return;

      const busyKey = `${singlesIdTo}:${kind}`;
      if (bioRequestBusyKey) return;

      const payload = isBrief ? { brief_bio_request: 'notrequested' } : { full_bio_request: 'notrequested' };
      setBioRequestBusyKey(busyKey);
      try {
        await postInterestedRequestInfo(singlesIdTo, payload);
        await Promise.all([refetchMyPicksList(), invalidateMyPicksListCache()]);
      } catch (err) {
        await themedAlert(err?.message || 'Failed to cancel bio request');
      } finally {
        setBioRequestBusyKey('');
      }
    },
    [bioRequestBusyKey, refetchMyPicksList, selectedMember, selectedSinglesId]
  );

  const myPicksBioStatusTextSx = (isRequested) => ({
    fontWeight: 700,
    fontSize: buttonFontSizeResponsive,
    color: isRequested ? '#43a047' : '#ffeb3b',
    WebkitTextFillColor: isRequested ? '#43a047' : '#ffeb3b',
    WebkitTextStroke: '1px #000000',
    paintOrder: 'stroke fill',
    lineHeight: 1.2,
    whiteSpace: 'nowrap'
  });

  const myPicksBioPanelGridSx = {
    display: 'grid',
    gridTemplateColumns: 'max-content max-content max-content',
    columnGap: { xs: 1, sm: 1.5 },
    rowGap: 0,
    alignItems: 'center',
    justifyContent: 'center',
    justifyItems: 'start',
    width: '100%',
    maxWidth: 680,
    mx: 'auto',
    py: 0.25
  };

  const myPicksBioKindLabelSx = {
    fontWeight: 700,
    color: SELECTED_BUTTON_TEMPLATE_TEXT,
    WebkitTextFillColor: SELECTED_BUTTON_TEMPLATE_TEXT,
    lineHeight: 1.2,
    textAlign: 'left',
    whiteSpace: 'nowrap'
  };

  const visiblePosts = useMemo(() => feedPosts, [feedPosts]);

  const myPicksTabKeys = ['postings', 'publicAlbum'];
  const myPicksTabLabelByKey = {
    postings: 'Postings',
    publicAlbum: 'Public Album'
  };
  const myPicksTabButtonLayoutSx = {
    textTransform: 'none',
    borderRadius: 1,
    minWidth: 0,
    width: '100%',
    px: 0.6,
    py: 0.55,
    fontWeight: 700,
    lineHeight: 1.15,
    transformOrigin: 'center'
  };

  const refreshRightPanelTabData = useCallback(
    async (tab) => {
      if (tab === 'publicAlbum') {
        await refetchMyPicksList();
        return;
      }
      if (tab === 'postings' && selectedSinglesId != null) {
        await Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
      }
    },
    [refetchMyPicksList, refetchMyPicksFeed, selectedSinglesId]
  );

  const handleRightTabClick = useCallback(
    (tab) => {
      setActiveRightTab(tab);
      void refreshRightPanelTabData(tab);
    },
    [refreshRightPanelTabData]
  );

  return (
    <MainCard
      sx={{
        flex: { xs: '0 1 auto', sm: 1 },
        height: { xs: 'auto', sm: '100%' },
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: { xs: 'visible', sm: 'hidden' }
      }}
      contentSX={{
        flex: { xs: '0 1 auto', sm: 1 },
        display: 'flex',
        flexDirection: 'column',
        height: { xs: 'auto', sm: '100%' },
        minHeight: 0,
        overflow: 'hidden'
      }}
      title={
        <EarnTokensPageTitle>
          <Typography
            sx={{
              fontSize: { xs: getMobileSinglesTitleFontSizeVw(), sm: getDesktopTitleFontSizeVw() },
              color: 'var(--theme-primary-color)'
            }}
          >
            Picks & Posts
          </Typography>
        </EarnTokensPageTitle>
      }
      center={<PageVideoTutorialsButton pageKey="picksPosts" />}
      secondary={<PageInstructionEarnTokensAction onInstructionClick={() => setInstructionOpen(true)} />}
    >
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
            audioByVoice={MY_PICKS_INSTRUCTION_AUDIO_BY_VOICE}
            title="Current Context Tutorial"
            contextStep={MY_PICKS_INSTRUCTION_CONTEXT_STEP}
          />
          <PageInstructionPopup.BodyText sx={{ whiteSpace: 'pre-line' }}>
            {INSTRUCTION_POPUP_TEXT}
          </PageInstructionPopup.BodyText>
          <FriendshipStatesDiagramZoom
            imageSrc={friendShipStatesPickPostsImg}
            imageAlt="Picks & Posts friendship states diagram"
          />
        </PageInstructionPopup.Body>
      </PageInstructionPopup>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 1.5, flexShrink: 0 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { xs: 1, sm: 1.5 },
            flexWrap: 'wrap'
          }}
        >
          <Button variant="contained" disabled={refreshPostsBusy} onClick={() => void refreshPosts()} sx={MANUAL_REFRESH_BUTTON_SX}>
            Refresh Posts
          </Button>
          <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
            <NotificationSection placement="inline" />
          </Box>
        </Box>
        <Box sx={manualRefreshHintSx.containerSx}>
          {MANUAL_REFRESH_POSTS_HINT_LINES.map((line) => (
            <Typography key={line} component="div" sx={manualRefreshHintSx.lineSx}>
              {line}
            </Typography>
          ))}
        </Box>
      </Box>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: 1.5,
          width: '100%',
          flex: 1,
          minHeight: 0
        }}
      >
        <ColorTemplate8PhotoGallery header="Drag photos to rearrange order" selectedGreenBackground selectedAvatarCircular>
            {myPicksListLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : null}
            {myPicksListError ? (
              <Alert severity="error" sx={{ m: 1 }}>
                Failed to load My Picks.
              </Alert>
            ) : null}
            {!myPicksListLoading && !myPicksListError && myPicksList.length === 0 ? (
              <ColorTemplate8PhotoGallery.EmptyText>No picks yet.</ColorTemplate8PhotoGallery.EmptyText>
            ) : null}
            {!myPicksListLoading && !myPicksListError
              ? orderedIds.map((singlesId, pickIndex) => {
                  const person = picksById.get(singlesId);
                  if (!person) return null;
                  const selected = Number(person.singles_id) === Number(selectedSinglesId);
                  const memberLabel = formatMemberLabel({
                    alias: person.alias,
                    singlesId: person.singles_id,
                    prefix: person.prefix,
                    memberId: person.member_id
                  });
                  const memberDisplay = getMemberDisplayLines({
                    alias: person.alias,
                    singlesId: person.singles_id,
                    prefix: person.prefix,
                    memberId: person.member_id
                  });
                  const isTourDemoPick = TOUR_DEMO_MEMBER_NUMBERS.includes(
                    formatMemberNumber(person.prefix, person.member_id)
                  );
                  const isDropTarget =
                    draggingSinglesId != null && dropTargetSinglesId === person.singles_id && draggingSinglesId !== person.singles_id;
                  const relationshipKind = memberRelationshipRibbonKind(person);
                  const relationshipLabel = memberRelationshipRibbonLabel(relationshipKind);
                  const showRequestedRibbon =
                    !relationshipKind &&
                    (isBioRequestFlagged(person.brief_bio_request) ||
                      isBioRequestFlagged(person.full_bio_request));
                  return (
                    <ColorTemplate8PhotoGallery.Item
                      key={person.singles_id}
                      impersonateSinglesId={person.singles_id}
                      selected={selected}
                      isDropTarget={isDropTarget}
                      draggable
                      title="Drag to reorder"
                      {...guestDemoAllowProps()}
                      onDragStart={(e) => {
                        if (e.target instanceof Element && e.target.closest('[data-clickable-zone="true"]')) {
                          e.preventDefault();
                          return;
                        }
                        setDraggingSinglesId(person.singles_id);
                        e.dataTransfer.setData('application/x-my-picks-singles-id', String(person.singles_id));
                        e.dataTransfer.setData('text/plain', String(person.singles_id));
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragEnd={() => {
                        setDraggingSinglesId(null);
                        setDropTargetSinglesId(null);
                      }}
                      onDragOver={(e) => {
                        if (draggingSinglesId == null) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDropTargetSinglesId(person.singles_id);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const raw = e.dataTransfer.getData('application/x-my-picks-singles-id') || e.dataTransfer.getData('text/plain');
                        const fromId = Number(raw);
                        handleReorderDrop(fromId, person.singles_id);
                        setDraggingSinglesId(null);
                        setDropTargetSinglesId(null);
                      }}
                    >
                      <ColorTemplate8PhotoGallery.RemoveButton
                        type="button"
                        aria-label="Remove from My Picks"
                        disabled={removePickBusyId === person.singles_id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRemovePick(person.singles_id);
                        }}
                      >
                        {removePickBusyId === person.singles_id ? (
                          <CircularProgress sx={colorTemplate8PhotoGalleryRemoveSpinnerSx()} />
                        ) : (
                          <IconX stroke={3} color="currentColor" />
                        )}
                      </ColorTemplate8PhotoGallery.RemoveButton>
                      <Box sx={MEMBER_PHOTO_STACK_SX}>
                        <Box
                          sx={{
                            position: 'relative',
                            zIndex: 100,
                            width: getMyPicksAvatarSize(),
                            height: getMyPicksAvatarSize(),
                            borderRadius: '50%',
                            overflow: 'visible',
                            flexShrink: 0
                          }}
                        >
                          <ColorTemplate8PhotoGallery.Avatar
                            src={person.profile_image_url || UserRound}
                            alt={memberLabel}
                            selected={selected}
                            onClick={() => setSelectedSinglesId(Number(person.singles_id))}
                            {...guestDemoAllowProps()}
                          />
                          {relationshipKind ? (
                            <Box component="span" aria-label="Approved" sx={MEMBER_INCOMING_APPROVED_SASH_SX}>
                              Approved
                            </Box>
                          ) : showRequestedRibbon ? (
                            <Box component="span" aria-label="Requested" sx={myPicksRequestedRibbonSx}>
                              Requested
                            </Box>
                          ) : null}
                        </Box>
                        {relationshipKind ? (
                          <Box component="span" aria-label={relationshipLabel} sx={MEMBER_RELATIONSHIP_TAG_SX}>
                            {relationshipLabel}
                          </Box>
                        ) : null}
                      </Box>
                      <ColorTemplate8PhotoGallery.NameButton
                        onClick={() => setSelectedSinglesId(Number(person.singles_id))}
                        {...guestDemoAllowProps()}
                      >
                        <ColorTemplate8PhotoGallery.Label
                          primary={memberDisplay.primary}
                          secondary={memberDisplay.secondary}
                          selected={selected}
                        />
                      </ColorTemplate8PhotoGallery.NameButton>
                      <ColorTemplate8PhotoGallery.BioAnchor data-vsingles-tour-my-picks-bio={pickIndex === 0 ? '' : undefined} />
                    </ColorTemplate8PhotoGallery.Item>
                  );
                })
              : null}
        </ColorTemplate8PhotoGallery>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: { xs: 360, sm: 0 },
            border: '1px solid var(--theme-primary-color)',
            borderLeft: 'none',
            borderRadius: 1,
            bgcolor: (theme) => colorTemplate1WallColorByTheme(theme),
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          {selectedSinglesId != null ? (
            <Box
              sx={{
                flexShrink: 0,
                width: '100%',
                p: 1,
                bgcolor: 'var(--theme-secondary-color)'
              }}
            >
              <Box sx={myPicksBioPanelGridSx}>
              {(['brief', 'full']).map((kind, sectionIndex) => {
                const isBrief = kind === 'brief';
                const kindLabel = isBrief ? 'Acquaintance Request:' : 'Buddy Request:';
                const requestButtonLabel = isBrief ? 'Acquaintance Request' : 'Buddy Request';
                const requestTooltipText = isBrief
                  ? MY_PICKS_ACQUAINTANCE_REQUEST_TOOLTIP
                  : MY_PICKS_FRIEND_REQUEST_TOOLTIP;
                const isRequested = isBrief
                  ? isBioRequestFlagged(selectedMember?.brief_bio_request)
                  : isBioRequestFlagged(selectedMember?.full_bio_request);
                const busyKey = `${selectedSinglesId}:${kind}`;
                const isBusy = bioRequestBusyKey === busyKey;
                const statusLabel = isRequested ? 'Requested' : 'Not Requested';
                const actionLabel = isBusy
                  ? isRequested
                    ? 'Canceling…'
                    : 'Sending…'
                  : isRequested
                    ? 'Cancel Request'
                    : requestButtonLabel;
                const rowCellSx = {
                  py: 0.75,
                  ...(sectionIndex > 0
                    ? {
                        borderTop: '1px solid rgba(255,255,255,0.35)',
                        pt: 1,
                        mt: 0.25
                      }
                    : null)
                };
                return (
                  <Box key={`${kind}-row`} sx={{ display: 'contents' }}>
                    <Typography sx={{ ...myPicksBioKindLabelSx, ...rowCellSx }}>
                      {kindLabel}
                    </Typography>
                    <Typography sx={{ ...myPicksBioStatusTextSx(isRequested), whiteSpace: 'nowrap', ...rowCellSx }}>
                      {statusLabel}
                    </Typography>
                    <Box sx={{ ...rowCellSx, display: 'flex', alignItems: 'center' }}>
                      <Tooltip
                        arrow
                        describeChild
                        title={requestTooltipText}
                        slotProps={myPicksBioRequestTooltipSlotProps()}
                      >
                        <Box component="span" sx={{ display: 'inline-flex', maxWidth: '100%' }}>
                          <UnSelectedButtonTemplate
                            type="button"
                            disabled={isBusy}
                            singleLineLabel
                            onClick={() =>
                              void (isRequested ? handleCancelBioRequest(kind) : handleSendBioRequest(kind))
                            }
                            sx={myPicksBioGreenRequestButtonSx()}
                          >
                            {actionLabel}
                          </UnSelectedButtonTemplate>
                        </Box>
                      </Tooltip>
                    </Box>
                  </Box>
                );
              })}
              </Box>
            </Box>
          ) : null}
          <Box
            sx={{
              flexShrink: 0,
              px: 1.5,
              py: 1,
              borderBottom: '1px solid var(--theme-primary-color)',
              bgcolor: (theme) => colorTemplate1WallColorByTheme(theme)
            }}
          >
            {activeRightTab === 'publicAlbum' ? (
              <Typography
                sx={{
                  color: (theme) => (colorTemplate1WallColorByTheme(theme) === '#000000' ? '#fff' : 'var(--theme-primary-color)'),
                  fontWeight: 700
                }}
              >
                Public Album
              </Typography>
            ) : (
              <Typography
                sx={{
                  color: (theme) => (colorTemplate1WallColorByTheme(theme) === '#000000' ? '#fff' : 'var(--theme-primary-color)'),
                  fontWeight: 700
                }}
              >
                Postings
              </Typography>
            )}
          </Box>
          <Box
            sx={{
              flexShrink: 0,
              width: '100%',
              px: 0.75,
              py: 0.7,
              borderBottom: '1px solid var(--theme-primary-color)',
              display: 'grid',
              gridTemplateColumns: `repeat(${myPicksTabKeys.length}, minmax(0, 1fr))`,
              gap: 0.6,
              bgcolor: (theme) => colorTemplate1WallColorByTheme(theme)
            }}
          >
            {myPicksTabKeys.map((tab) => {
              const isSelected = activeRightTab === tab;
              const TabButton = isSelected ? SelectedButtonTemplate : UnSelectedButtonTemplate;
              return (
                <TabButton
                  key={tab}
                  fullWidth
                  fitLabelWidth={false}
                  onClick={() => handleRightTabClick(tab)}
                  sx={myPicksTabButtonLayoutSx}
                  {...guestDemoAllowProps()}
                >
                  {myPicksTabLabelByKey[tab]}
                </TabButton>
              );
            })}
          </Box>
          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowY: activeRightTab === 'postings' ? 'hidden' : 'auto',
              overflowX: 'hidden',
              p: 1.25,
              ...(activeRightTab === 'postings' ? { display: 'flex', flexDirection: 'column' } : null)
            }}
          >
            {activeRightTab === 'publicAlbum' ? (
              <Box
                {...guestDemoAllowProps()}
                sx={{
                  borderRadius: 1,
                  p: 0.75,
                  mb: 1.25,
                  bgcolor: 'var(--theme-daynight-color, #fff)'
                }}
              >
                {selectedSinglesId == null ? (
                  <Typography sx={{ color: 'var(--theme-primary-color)' }}>Select a photo on the left.</Typography>
                ) : null}
                {selectedSinglesId != null && selectedMemberGalleryUrls.length === 0 ? (
                  <Typography sx={{ color: 'var(--theme-primary-color)' }}>No public album photos.</Typography>
                ) : null}
                {selectedMemberGalleryUrls.length > 0 ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 0.75, mb: 1 }}>
                    {selectedMemberGalleryUrls.map((mediaUrl) => {
                      const isSelected = selectedGalleryImageUrl === mediaUrl;
                      const isVideo = isSelfIntroVideoPostingUrl(mediaUrl);
                      return (
                        <Box
                          key={mediaUrl}
                          component="button"
                          type="button"
                          onClick={() => setSelectedGalleryImageUrl(mediaUrl)}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openAlbumFullscreenMedia(mediaUrl);
                          }}
                          {...guestDemoAllowProps()}
                          sx={{
                            p: 0,
                            m: 0,
                            border: isSelected ? '2px solid var(--theme-primary-color)' : '1px solid rgba(0,0,0,0.2)',
                            borderRadius: 0.75,
                            overflow: 'hidden',
                            width: '100%',
                            aspectRatio: '1 / 1',
                            background: 'transparent',
                            cursor: 'zoom-in'
                          }}
                        >
                          <Box
                            component="img"
                            src={isVideo ? videoThumbnailUrlFromPostingUrl(mediaUrl) : mediaUrl}
                            alt="public album thumbnail"
                            sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                          />
                        </Box>
                      );
                    })}
                  </Box>
                ) : null}
                {selectedGalleryImageUrl ? (
                  <AlbumMediaDoubleClickSurface
                    mediaUrl={selectedGalleryImageUrl}
                    onOpenFullscreen={openAlbumFullscreenMedia}
                    sx={{ width: '100%', borderRadius: 1, overflow: 'hidden', bgcolor: '#111' }}
                    {...guestDemoAllowProps()}
                  >
                    {isSelfIntroVideoPostingUrl(selectedGalleryImageUrl) ? (
                      <Box
                        component="video"
                        src={selectedGalleryImageUrl}
                        controls
                        autoPlay
                        playsInline
                        onDoubleClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          openAlbumFullscreenMedia(selectedGalleryImageUrl);
                        }}
                        sx={{
                          display: 'block',
                          width: '100%',
                          height: 'auto',
                          maxHeight: 'none',
                          objectFit: 'contain',
                          borderRadius: 1,
                          border: '1px solid rgba(0,0,0,0.22)',
                          bgcolor: '#000',
                          cursor: 'zoom-in'
                        }}
                      />
                    ) : (
                      <Box
                        component="img"
                        src={selectedGalleryImageUrl}
                        alt="public album preview"
                        sx={{
                          display: 'block',
                          width: '100%',
                          height: 'auto',
                          maxHeight: 'none',
                          objectFit: 'contain',
                          borderRadius: 1,
                          border: '1px solid rgba(0,0,0,0.22)',
                          bgcolor: '#fff',
                          pointerEvents: 'none',
                          userSelect: 'none'
                        }}
                        draggable={false}
                      />
                    )}
                  </AlbumMediaDoubleClickSurface>
                ) : null}
              </Box>
            ) : null}

            {activeRightTab === 'postings' && selectedSinglesId != null ? (
              <ColorTemplate11Posting.Feed
                title="Posts and Comments"
                posts={visiblePosts}
                loading={myPicksFeedLoading}
                error={myPicksFeedError}
                photoZoomBarVariant="full"
                photoZoomBarHint={COLOR_TEMPLATE11_POSTING_PHOTO_FULLSCREEN_HINT_VIEW_ONLY}
                photoFullscreenOverlayLines={photoFullscreenOverlayLines}
                privacyMessage={
                  myPicksFeed && !myPicksFeed.can_view_private_posts && myPicksFeed.message ? myPicksFeed.message : undefined
                }
                viewerSinglesId={user?.singles_id}
                feedOwnerSinglesId={selectedSinglesId}
                showDeletePosts={canDeletePosts}
                deleteBusy={deleteBusy}
                onDeletePost={handleDeletePosting}
                onDeletePhoto={handleDeletePostingPhoto}
                showActions
                likeBusyPostId={likeBusyPostId}
                onToggleLike={handleTogglePostingLike}
                onShowLikes={handleShowPostingLikes}
                onOpenComments={(post) => setCommentsDialog({ postId: post.post_id, photos: post.photos })}
                onShare={handleShareRepost}
                shareBusyPostId={shareRepostBusyPostId}
                showLoadMore
                feedHasMore={feedHasMore && selectedSinglesId != null}
                loadMoreBusy={loadMoreBusy}
                onLoadMore={handleLoadMorePosts}
                sx={{ flex: 1, minHeight: 0, height: '100%', maxHeight: '100%' }}
              />
            ) : null}
          </Box>
        </Box>
      </Box>
      <PostingCommentsDialog
        open={commentsDialog != null}
        postId={commentsDialog?.postId}
        photos={commentsDialog?.photos ?? []}
        onClose={() => setCommentsDialog(null)}
        onCommentsChanged={() => {
          void Promise.all([refetchMyPicksFeed(), invalidateMyPicksFeedCache()]);
        }}
      />
      <PostingLikesDialog
        open={likesPostId != null}
        loading={likesLoading}
        error={likesError}
        likesList={likesList}
        onClose={closeLikesPopover}
      />
      {deleteConfirmDialog}
      <PostingAlbumMediaFullscreen
        open={fullscreenOpen}
        mediaUrl={fullscreenMediaUrl}
        overlayLines={fullscreenOverlayLines}
        onClose={closeFullscreenMedia}
      />
    </MainCard>
  );
}
