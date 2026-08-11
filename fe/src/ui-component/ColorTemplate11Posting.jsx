import PropTypes from 'prop-types';
import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faThumbsUp } from '@fortawesome/free-solid-svg-icons';
import listPadImg from 'assets/images/listPad.png';
import { PostingFeedPhotoDeleteButton, PostingFeedPostDeleteButton } from 'ui-component/PostingFeedDeleteX';
import ColorTemplate11PostingPhotoZoomBar from 'ui-component/ColorTemplate11PostingPhotoZoomBar';
import PostingAlbumMediaFullscreen from 'ui-component/PostingAlbumMediaFullscreen';
import {
  ColorTemplate11PostingPhotoHeightProvider,
  useColorTemplate11PostingPhotoHeight
} from 'hooks/useColorTemplate11PostingPhotoHeight';
import { isSelfIntroVideoPostingUrl } from 'api/selfIntroVideoFe';
import { getApiBaseUrl } from 'config/apiBaseUrl';
import {
  colorTemplate11PostingActionsBarSx,
  colorTemplate11PostingBodyTextSx,
  colorTemplate11PostingCardSx,
  colorTemplate11PostingDeleteButtonSx,
  colorTemplate11PostingPhotoDeleteButtonSx,
  colorTemplate11PostingFeedScrollAreaSx,
  colorTemplate11PostingFeedShellSx,
  colorTemplate11PostingHeaderDateSx,
  colorTemplate11PostingHeaderPaddingSx,
  colorTemplate11PostingLoadMoreBarSx,
  colorTemplate11PostingLoadMoreButtonSx,
  colorTemplate11PostingLikesPadButtonSx,
  colorTemplate11PostingActionButtonSx,
  colorTemplate11PostingPanelTextSx,
  colorTemplate11PostingPhotoFrameSx,
  colorTemplate11PostingPhotoImgSx,
  colorTemplate11PostingPhotoResizeHandleSx,
  colorTemplate11PostingTitleSx,
  colorTemplate11PostingVisibilityMenuProps,
  colorTemplate11PostingVisibilitySelectSx,
  formatColorTemplate11PostingDate,
  normalizeColorTemplate11PostingVisibility,
  formatPostingRepostCreditLabel,
  colorTemplate11PostingRepostCreditSx
} from 'config/colorTemplate11Posting';
import { useUserTimeZoneProfile } from 'hooks/useUserTimeZoneProfile';
import { usePhotoDoubleClickOpen } from 'utils/photoDoubleClickOpen';

function ColorTemplate11PostingEditableBody({ content, canEdit, saving, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef(null);
  const skipBlurCancelRef = useRef(false);
  const text = String(content ?? '');

  useEffect(() => {
    if (!editing) return undefined;
    const t = window.setTimeout(() => {
      inputRef.current?.focus?.();
      const el = inputRef.current;
      if (el && typeof el.setSelectionRange === 'function') {
        const len = el.value?.length ?? 0;
        el.setSelectionRange(len, len);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [editing]);

  const beginEdit = (event) => {
    if (!canEdit || saving) return;
    event.preventDefault();
    event.stopPropagation();
    setError('');
    setDraft(text);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
    setError('');
  };

  const saveEdit = async () => {
    if (saving) return;
    const next = String(draft ?? '');
    if (next.trim() === text.trim()) {
      cancelEdit();
      return;
    }
    setError('');
    try {
      skipBlurCancelRef.current = true;
      await onSave?.(next);
      setEditing(false);
      setDraft('');
    } catch (err) {
      skipBlurCancelRef.current = false;
      setError(err?.message || 'Save failed');
    }
  };

  if (editing) {
    return (
      <Box sx={{ px: 1.25, py: 1 }}>
        <Box
          component="textarea"
          ref={inputRef}
          value={draft}
          disabled={saving}
          aria-label="Edit posting text"
          title="Ctrl/Cmd+Enter to save · Esc to cancel"
          onChange={(event) => setDraft(event.target.value)}
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Escape') {
              event.preventDefault();
              skipBlurCancelRef.current = true;
              cancelEdit();
              return;
            }
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void saveEdit();
            }
          }}
          onBlur={() => {
            if (skipBlurCancelRef.current) {
              skipBlurCancelRef.current = false;
              return;
            }
            if (!saving) cancelEdit();
          }}
          sx={{
            ...colorTemplate11PostingBodyTextSx(),
            display: 'block',
            width: '100%',
            minHeight: '5.5rem',
            resize: 'vertical',
            boxSizing: 'border-box',
            m: 0,
            px: 1,
            py: 0.75,
            border: '1px solid var(--theme-primary-color)',
            borderRadius: 1,
            bgcolor: 'var(--theme-card-bg-color, #fff)',
            color: 'inherit',
            font: 'inherit',
            lineHeight: 1.45,
            outline: 'none'
          }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="contained"
            disabled={saving}
            onMouseDown={(event) => {
              event.preventDefault();
              skipBlurCancelRef.current = true;
            }}
            onClick={() => void saveEdit()}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button
            size="small"
            variant="text"
            disabled={saving}
            onMouseDown={(event) => {
              event.preventDefault();
              skipBlurCancelRef.current = true;
            }}
            onClick={cancelEdit}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Cancel
          </Button>
          {error ? (
            <Typography color="error" sx={{ fontSize: '0.85em', fontWeight: 700 }}>
              {error}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '0.8em', opacity: 0.75 }}>Ctrl/Cmd+Enter to save · Esc to cancel</Typography>
          )}
        </Box>
      </Box>
    );
  }

  if (!text && !canEdit) return null;

  return (
    <Box sx={{ px: 1.25, py: 1 }}>
      <Typography
        onDoubleClick={canEdit ? beginEdit : undefined}
        title={canEdit ? 'Double-click to edit · Ctrl/Cmd+Enter to save' : undefined}
        sx={{
          ...colorTemplate11PostingBodyTextSx(),
          ...(canEdit
            ? {
                cursor: 'text',
                borderRadius: 0.5,
                outline: '1px dashed transparent',
                '&:hover': { outlineColor: 'rgba(0,0,0,0.25)' }
              }
            : null),
          ...(!text && canEdit
            ? {
                fontStyle: 'italic',
                opacity: 0.65,
                minHeight: '1.5em'
              }
            : null)
        }}
      >
        {text || (canEdit ? 'Double-click to add posting text' : '')}
      </Typography>
    </Box>
  );
}
function ColorTemplate11PostingFeedShell({ title, scrollable, maxScrollHeight, pinFooter, footer, scrollContainerRef, sx, children }) {
  const usePinnedLayout = Boolean(pinFooter);
  const useFillHeight = usePinnedLayout && !scrollable && maxScrollHeight == null;

  return (
    <Box
      sx={{
        ...colorTemplate11PostingFeedShellSx({
          scrollable: scrollable && !usePinnedLayout,
          maxHeight: maxScrollHeight,
          pinFooter: usePinnedLayout,
          fillHeight: useFillHeight
        }),
        ...(sx || {})
      }}
    >
      {title ? (
        <Typography sx={{ ...colorTemplate11PostingTitleSx(), flexShrink: 0, gridRow: 1 }}>{title}</Typography>
      ) : null}
      {usePinnedLayout ? (
        <>
          <Box
            ref={scrollContainerRef}
            sx={{
              ...colorTemplate11PostingFeedScrollAreaSx({
                maxHeight: maxScrollHeight,
                pinned: true,
                fillHeight: useFillHeight
              }),
              gridRow: 2
            }}
          >
            {children}
          </Box>
          {footer ? <Box sx={{ gridRow: 3, minWidth: 0 }}>{footer}</Box> : null}
        </>
      ) : (
        <>
          {children}
          {footer}
        </>
      )}
    </Box>
  );
}

function postingVideoSrc(photoUrl) {
  const raw = String(photoUrl ?? '').trim();
  if (!raw) return '';
  if (raw.startsWith('/api/video/')) return `${getApiBaseUrl()}${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('api/video/')) return `${getApiBaseUrl()}/${raw}`;
  return raw;
}

function ColorTemplate11PostingPhotoMedia({
  photo,
  heightPx,
  showPhotoDelete,
  onDeletePhoto,
  onOpenFullscreen
}) {
  const isVideo = isSelfIntroVideoPostingUrl(photo.photo_url);
  const openFullscreen = () => onOpenFullscreen?.(String(photo.photo_url ?? '').trim());
  const { handleClick, handleDoubleClick, doubleClickSx } = usePhotoDoubleClickOpen(openFullscreen);

  return (
    <Box sx={colorTemplate11PostingPhotoFrameSx(heightPx)}>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          ...doubleClickSx
        }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {isVideo ? (
          <Box
            component="video"
            src={postingVideoSrc(photo.photo_url)}
            controls
            playsInline
            preload="metadata"
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openFullscreen();
            }}
            sx={{ ...colorTemplate11PostingPhotoImgSx(), bgcolor: '#000', cursor: 'zoom-in' }}
          />
        ) : (
          <Box
            component="img"
            src={photo.photo_url}
            alt="post"
            sx={{ ...colorTemplate11PostingPhotoImgSx(), pointerEvents: 'none', userSelect: 'none' }}
            draggable={false}
          />
        )}
      </Box>
      {showPhotoDelete ? (
        <PostingFeedPhotoDeleteButton
          sx={colorTemplate11PostingPhotoDeleteButtonSx()}
          onClick={() => onDeletePhoto?.(photo.photo_id, photo.photo_url)}
        />
      ) : null}
    </Box>
  );
}

function ColorTemplate11PostingPhotos({
  postId,
  photos,
  onDeletePhoto,
  showPhotoDelete = true,
  photoFullscreenOverlayLines = []
}) {
  const { heightPx, startResize } = useColorTemplate11PostingPhotoHeight(postId);
  const [fullscreenMediaUrl, setFullscreenMediaUrl] = useState('');
  const photoList = Array.isArray(photos) ? photos : [];
  const overlayLines = useMemo(
    () =>
      (Array.isArray(photoFullscreenOverlayLines) ? photoFullscreenOverlayLines : [])
        .map((line) => String(line ?? '').trim())
        .filter(Boolean),
    [photoFullscreenOverlayLines]
  );

  if (!photoList.length) return null;

  return (
    <Box sx={{ position: 'relative', pb: 3 }}>
      <PostingAlbumMediaFullscreen
        open={Boolean(fullscreenMediaUrl)}
        mediaUrl={fullscreenMediaUrl}
        overlayLines={overlayLines}
        onClose={() => setFullscreenMediaUrl('')}
      />
      <Box sx={{ px: 1.25, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {photoList.map((photo) => (
          <ColorTemplate11PostingPhotoMedia
            key={photo.photo_id}
            photo={photo}
            heightPx={heightPx}
            showPhotoDelete={showPhotoDelete}
            onDeletePhoto={onDeletePhoto}
            onOpenFullscreen={setFullscreenMediaUrl}
          />
        ))}
      </Box>
      <Box
        component="button"
        type="button"
        aria-label="Resize posting photo height"
        onMouseDown={startResize}
        sx={colorTemplate11PostingPhotoResizeHandleSx()}
      >
        Resize
        <Box component="span" aria-hidden sx={{ lineHeight: 1, fontSize: '1.15em' }}>
          ↓
        </Box>
      </Box>
    </Box>
  );
}

function ColorTemplate11PostingPostHeader({
  post,
  viewerSinglesId,
  feedOwnerSinglesId,
  showDeletePost,
  visibilityBusyPostId,
  onVisibilityChange
}) {
  const userTimeZoneProfile = useUserTimeZoneProfile();
  const postOwnerId = Number(post?.post_owner_id ?? feedOwnerSinglesId);
  const viewerId = Number(viewerSinglesId);
  const isOwnPost = Number.isFinite(viewerId) && viewerId > 0 && postOwnerId === viewerId;
  const showVisibility = Number.isFinite(postOwnerId) && postOwnerId > 0;
  const visibilityValue = normalizeColorTemplate11PostingVisibility(post?.posting_visibility ?? 'public');
  const repostCreditLabel = formatPostingRepostCreditLabel(post);

  return (
    <Box sx={{ p: 1.25, position: 'relative', ...colorTemplate11PostingHeaderPaddingSx(showDeletePost) }}>
      {repostCreditLabel ? (
        <Typography sx={colorTemplate11PostingRepostCreditSx()}>{repostCreditLabel}</Typography>
      ) : null}
      <Box sx={{ position: 'relative', minHeight: { xs: '2rem', sm: '2.25rem' } }}>
        <Typography sx={colorTemplate11PostingHeaderDateSx()}>{formatColorTemplate11PostingDate(post?.created_at, userTimeZoneProfile)}</Typography>
        {showVisibility ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
            <Select
              size="small"
              value={visibilityValue}
              disabled={!isOwnPost || visibilityBusyPostId === post?.post_id}
              onChange={(e) => onVisibilityChange?.(post, normalizeColorTemplate11PostingVisibility(e.target.value))}
              MenuProps={colorTemplate11PostingVisibilityMenuProps()}
              sx={colorTemplate11PostingVisibilitySelectSx()}
            >
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="friends">Buddies</MenuItem>
              <MenuItem value="mySelf">MySelf</MenuItem>
            </Select>
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}

function ColorTemplate11PostingPostActions({ post, likeBusyPostId, shareBusyPostId, showShareRepost, onToggleLike, onShowLikes, onOpenComments, onShare }) {
  const shareBusy = shareBusyPostId === post.post_id;
  return (
    <Box sx={colorTemplate11PostingActionsBarSx()}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.1 }}>
        <Button
          variant="text"
          disabled={likeBusyPostId === post.post_id}
          onClick={() => onToggleLike?.(post.post_id)}
          sx={{
            ...colorTemplate11PostingActionButtonSx(),
            fontWeight: post.viewer_has_liked ? 800 : 600
          }}
        >
          {post.viewer_has_liked ? <FontAwesomeIcon icon={faThumbsUp} style={{ marginRight: 6 }} /> : null}
          Like ({post.posting_like_count ?? 0})
        </Button>
        <ButtonBase
          aria-label="Show users who liked this post"
          title="Who liked this post"
          onClick={(event) => onShowLikes?.(event, post.post_id)}
          sx={colorTemplate11PostingLikesPadButtonSx()}
        >
          <Box
            component="img"
            src={listPadImg}
            alt="Who liked"
            sx={{ width: { xs: 52, sm: 60 }, height: { xs: 52, sm: 60 }, display: 'block', objectFit: 'contain' }}
          />
        </ButtonBase>
      </Box>
      <Button variant="text" onClick={() => onOpenComments?.(post)} sx={colorTemplate11PostingActionButtonSx()}>
        Comments{post.posting_comment_count > 0 ? ` (${post.posting_comment_count})` : ''}
      </Button>
      {showShareRepost ? (
        <Button
          variant="text"
          disabled={shareBusy}
          onClick={() => onShare?.(post)}
          sx={colorTemplate11PostingActionButtonSx()}
        >
          {shareBusy ? 'Reposting…' : 'Share/Repost'}
        </Button>
      ) : null}
    </Box>
  );
}

function ColorTemplate11PostingPost({
  post,
  viewerSinglesId,
  feedOwnerSinglesId,
  showDeletePost,
  deleteBusy,
  onDeletePost,
  onDeletePhoto,
  attachBusy = false,
  onAttachMedia,
  visibilityBusyPostId,
  onVisibilityChange,
  contentBusyPostId,
  onSaveContent,
  onPostDoubleClick,
  showActions,
  likeBusyPostId,
  shareBusyPostId,
  onToggleLike,
  onShowLikes,
  onOpenComments,
  onShare,
  renderPostExtra,
  photoFullscreenOverlayLines,
  sx
}) {
  const [attachDragOver, setAttachDragOver] = useState(false);
  const hasPhotos = Array.isArray(post?.photos) && post.photos.length > 0;
  const viewerId = Number(viewerSinglesId);
  const ownerId = Number(feedOwnerSinglesId);
  const postOwnerId = Number(post?.post_owner_id ?? feedOwnerSinglesId);
  const isOwnPost = Number.isFinite(viewerId) && viewerId > 0 && postOwnerId === viewerId;
  const canOpenInComposer = isOwnPost && typeof onPostDoubleClick === 'function';
  // Prefer composer edit (My Story) over inline text edit when both are wired.
  const canEditContent = isOwnPost && typeof onSaveContent === 'function' && !canOpenInComposer;
  const canAttachMedia = isOwnPost && typeof onAttachMedia === 'function';
  const showShareRepost =
    typeof onShare === 'function' &&
    Number.isFinite(viewerId) &&
    viewerId > 0 &&
    Number.isFinite(ownerId) &&
    ownerId > 0 &&
    viewerId !== ownerId;

  const handleAttachDragOver = (e) => {
    if (!canAttachMedia || attachBusy) return;
    const types = e.dataTransfer?.types;
    const hasFiles = types?.includes?.('Files') || (types && [...types].includes('Files'));
    if (!hasFiles && !types?.length) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    setAttachDragOver(true);
  };

  const handleAttachDragLeave = (e) => {
    const rel = e.relatedTarget;
    if (rel && e.currentTarget.contains(rel)) return;
    setAttachDragOver(false);
  };

  const handleAttachDrop = (e) => {
    if (!canAttachMedia || attachBusy) return;
    e.preventDefault();
    e.stopPropagation();
    setAttachDragOver(false);
    onAttachMedia?.(post, e);
  };

  const handleCardDoubleClick = (e) => {
    if (!canOpenInComposer) return;
    const interactive = e.target?.closest?.(
      'button, a, input, textarea, select, [role="button"], [role="menuitem"], label'
    );
    if (interactive) return;
    e.preventDefault();
    e.stopPropagation();
    onPostDoubleClick(post);
  };

  return (
    <Card
      onDoubleClick={canOpenInComposer ? handleCardDoubleClick : undefined}
      title={canOpenInComposer ? 'Double-click to edit in Add New Posting' : undefined}
      onDragOver={canAttachMedia ? handleAttachDragOver : undefined}
      onDragLeave={canAttachMedia ? handleAttachDragLeave : undefined}
      onDrop={canAttachMedia ? handleAttachDrop : undefined}
      sx={{
        ...colorTemplate11PostingCardSx(),
        ...(canOpenInComposer ? { cursor: 'pointer' } : null),
        ...(attachDragOver
          ? {
              outline: '3px dashed var(--theme-primary-color)',
              outlineOffset: 2,
              bgcolor: 'var(--theme-daynight-color)'
            }
          : null),
        ...(sx || {})
      }}
    >
      {showDeletePost ? (
        <PostingFeedPostDeleteButton
          disabled={deleteBusy || attachBusy}
          sx={colorTemplate11PostingDeleteButtonSx()}
          onClick={() => onDeletePost?.(post.post_id)}
        />
      ) : null}
      <ColorTemplate11PostingPostHeader
        post={post}
        viewerSinglesId={viewerSinglesId}
        feedOwnerSinglesId={feedOwnerSinglesId}
        showDeletePost={showDeletePost}
        visibilityBusyPostId={visibilityBusyPostId}
        onVisibilityChange={onVisibilityChange}
      />
      {hasPhotos ? <Divider /> : null}
      {hasPhotos ? (
        <ColorTemplate11PostingPhotos
          postId={post.post_id}
          photos={post.photos}
          onDeletePhoto={onDeletePhoto}
          showPhotoDelete={showDeletePost}
          photoFullscreenOverlayLines={photoFullscreenOverlayLines}
        />
      ) : null}
      {canAttachMedia && !hasPhotos ? (
        <Box
          sx={{
            mx: 1.25,
            mb: 1,
            px: 1.25,
            py: 1.5,
            border: '2px dashed var(--theme-primary-color)',
            borderRadius: 1,
            textAlign: 'center',
            opacity: attachBusy ? 0.6 : 1
          }}
        >
          <Typography sx={{ ...colorTemplate11PostingPanelTextSx(), color: 'var(--theme-primary-color)', fontWeight: 600 }}>
            {attachBusy ? 'Attaching…' : 'Drag & drop a photo here to attach'}
          </Typography>
        </Box>
      ) : null}
      <ColorTemplate11PostingEditableBody
        content={post?.content}
        canEdit={canEditContent}
        saving={contentBusyPostId === post?.post_id}
        onSave={(nextContent) => onSaveContent?.(post, nextContent)}
      />
      {showActions ? (
        <>
          <Divider />
          <ColorTemplate11PostingPostActions
            post={post}
            likeBusyPostId={likeBusyPostId}
            shareBusyPostId={shareBusyPostId}
            showShareRepost={showShareRepost}
            onToggleLike={onToggleLike}
            onShowLikes={onShowLikes}
            onOpenComments={onOpenComments}
            onShare={onShare}
          />
        </>
      ) : null}
      {renderPostExtra ? renderPostExtra(post) : null}
    </Card>
  );
}

function ColorTemplate11PostingLoadMoreBar({ feedHasMore, loadMoreBusy, feedLoading, onLoadMore, pinned = false, sx }) {
  const disabled = feedLoading || loadMoreBusy || !feedHasMore;
  const buttonSx = colorTemplate11PostingLoadMoreButtonSx(feedHasMore);

  return (
    <Box sx={{ ...colorTemplate11PostingLoadMoreBarSx({ pinned }), ...(sx || {}) }}>
      <Button disabled={disabled} onClick={() => onLoadMore?.(2)} sx={buttonSx}>
        Next 2 posts
      </Button>
      <Button disabled={disabled} onClick={() => onLoadMore?.(5)} sx={buttonSx}>
        Next 5 posts
      </Button>
      <Button disabled={disabled} onClick={() => onLoadMore?.(10)} sx={buttonSx}>
        Next 10 posts
      </Button>
    </Box>
  );
}

function ColorTemplate11PostingFeedPhotoZoomBar() {
  const { heightPx, setHeightPx } = useColorTemplate11PostingPhotoHeight();
  return <ColorTemplate11PostingPhotoZoomBar heightPx={heightPx} onChangeHeight={setHeightPx} />;
}

function ColorTemplate11PostingFeed({
  title,
  posts,
  loading,
  error,
  emptyMessage = 'No posts yet.',
  privacyMessage,
  viewerSinglesId,
  feedOwnerSinglesId,
  scrollable = false,
  maxScrollHeight,
  scrollContainerRef,
  showDeletePosts = false,
  deleteBusy = false,
  onDeletePost,
  onDeletePhoto,
  attachBusyPostId = null,
  onAttachMedia,
  visibilityBusyPostId,
  onVisibilityChange,
  contentBusyPostId,
  onSaveContent,
  onPostDoubleClick,
  showActions = false,
  likeBusyPostId,
  shareBusyPostId,
  onToggleLike,
  onShowLikes,
  onOpenComments,
  onShare,
  showLoadMore = false,
  feedHasMore = false,
  loadMoreBusy = false,
  onLoadMore,
  renderPostExtra,
  photoFullscreenOverlayLines,
  sx
}) {
  const postList = Array.isArray(posts) ? posts : [];
  const postIds = useMemo(() => postList.map((post) => post.post_id), [postList]);
  const hasPostingPhotos = useMemo(
    () => postList.some((post) => Array.isArray(post.photos) && post.photos.length > 0),
    [postList]
  );
  const usePinnedLoadMore = showLoadMore;
  const loadMoreBar = showLoadMore ? (
    <ColorTemplate11PostingLoadMoreBar
      feedHasMore={feedHasMore}
      loadMoreBusy={loadMoreBusy}
      feedLoading={loading}
      onLoadMore={onLoadMore}
      pinned={usePinnedLoadMore}
    />
  ) : null;

  return (
    <ColorTemplate11PostingFeedShell
      title={title}
      scrollable={scrollable}
      maxScrollHeight={maxScrollHeight}
      pinFooter={Boolean(showLoadMore)}
      footer={loadMoreBar}
      scrollContainerRef={scrollContainerRef}
      sx={sx}
    >
      <ColorTemplate11PostingPhotoHeightProvider postIds={postIds}>
        {!loading && !error && hasPostingPhotos ? <ColorTemplate11PostingFeedPhotoZoomBar /> : null}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : null}
        {error ? (
          <Typography color="error" sx={colorTemplate11PostingPanelTextSx()}>
            Failed to load posting feed.{error?.message ? ` (${error.message})` : ''}
          </Typography>
        ) : null}
        {privacyMessage ? (
          <Typography sx={{ color: 'var(--theme-primary-color)', mb: 1.5, fontWeight: 600, ...colorTemplate11PostingPanelTextSx() }}>
            {privacyMessage}
          </Typography>
        ) : null}
        {!loading && !error && postList.length === 0 ? (
          <Typography sx={{ color: 'var(--theme-primary-color)', ...colorTemplate11PostingPanelTextSx() }}>{emptyMessage}</Typography>
        ) : null}
        {!loading && !error
          ? postList.map((post) => (
              <ColorTemplate11PostingPost
                key={post.post_id}
                post={post}
                viewerSinglesId={viewerSinglesId}
                feedOwnerSinglesId={feedOwnerSinglesId}
                showDeletePost={showDeletePosts}
                deleteBusy={deleteBusy}
                onDeletePost={onDeletePost}
                onDeletePhoto={onDeletePhoto}
                attachBusy={Number(attachBusyPostId) === Number(post.post_id)}
                onAttachMedia={onAttachMedia}
                visibilityBusyPostId={visibilityBusyPostId}
                onVisibilityChange={onVisibilityChange}
                contentBusyPostId={contentBusyPostId}
                onSaveContent={onSaveContent}
                onPostDoubleClick={onPostDoubleClick}
                showActions={showActions}
                likeBusyPostId={likeBusyPostId}
                shareBusyPostId={shareBusyPostId}
                onToggleLike={onToggleLike}
                onShowLikes={onShowLikes}
                onOpenComments={onOpenComments}
              onShare={onShare}
              renderPostExtra={renderPostExtra}
              photoFullscreenOverlayLines={photoFullscreenOverlayLines}
            />
            ))
          : null}
      </ColorTemplate11PostingPhotoHeightProvider>
    </ColorTemplate11PostingFeedShell>
  );
}

const ColorTemplate11Posting = ColorTemplate11PostingFeed;
ColorTemplate11Posting.Feed = ColorTemplate11PostingFeed;
ColorTemplate11Posting.FeedShell = ColorTemplate11PostingFeedShell;
ColorTemplate11Posting.Post = ColorTemplate11PostingPost;
ColorTemplate11Posting.PostHeader = ColorTemplate11PostingPostHeader;
ColorTemplate11Posting.Photos = ColorTemplate11PostingPhotos;
ColorTemplate11Posting.PostActions = ColorTemplate11PostingPostActions;
ColorTemplate11Posting.LoadMoreBar = ColorTemplate11PostingLoadMoreBar;

export default ColorTemplate11Posting;

const postShape = PropTypes.shape({
  post_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  content: PropTypes.string,
  created_at: PropTypes.string,
  posting_visibility: PropTypes.string,
  post_owner_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  posting_like_count: PropTypes.number,
  posting_comment_count: PropTypes.number,
  viewer_has_liked: PropTypes.bool,
  reposted_from_singles_id: PropTypes.number,
  reposted_from_alias: PropTypes.string,
  reposted_from_member_id: PropTypes.number,
  reposted_from_prefix: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  photos: PropTypes.array
});

ColorTemplate11PostingFeed.propTypes = {
  title: PropTypes.string,
  posts: PropTypes.arrayOf(postShape),
  loading: PropTypes.bool,
  error: PropTypes.object,
  emptyMessage: PropTypes.string,
  privacyMessage: PropTypes.string,
  viewerSinglesId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  feedOwnerSinglesId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  scrollable: PropTypes.bool,
  maxScrollHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.object]),
  scrollContainerRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.any })]),
  showDeletePosts: PropTypes.bool,
  deleteBusy: PropTypes.bool,
  onDeletePost: PropTypes.func,
  onDeletePhoto: PropTypes.func,
  attachBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onAttachMedia: PropTypes.func,
  visibilityBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onVisibilityChange: PropTypes.func,
  contentBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSaveContent: PropTypes.func,
  onPostDoubleClick: PropTypes.func,
  showActions: PropTypes.bool,
  likeBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  shareBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onToggleLike: PropTypes.func,
  onShowLikes: PropTypes.func,
  onOpenComments: PropTypes.func,
  onShare: PropTypes.func,
  showLoadMore: PropTypes.bool,
  feedHasMore: PropTypes.bool,
  loadMoreBusy: PropTypes.bool,
  onLoadMore: PropTypes.func,
  renderPostExtra: PropTypes.func,
  photoFullscreenOverlayLines: PropTypes.arrayOf(PropTypes.string),
  sx: PropTypes.object
};

ColorTemplate11PostingPhotos.propTypes = {
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  photos: PropTypes.array,
  onDeletePhoto: PropTypes.func,
  showPhotoDelete: PropTypes.bool,
  photoFullscreenOverlayLines: PropTypes.arrayOf(PropTypes.string)
};

ColorTemplate11PostingPost.propTypes = {
  post: postShape.isRequired,
  viewerSinglesId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  feedOwnerSinglesId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  showDeletePost: PropTypes.bool,
  deleteBusy: PropTypes.bool,
  onDeletePost: PropTypes.func,
  onDeletePhoto: PropTypes.func,
  attachBusy: PropTypes.bool,
  onAttachMedia: PropTypes.func,
  visibilityBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onVisibilityChange: PropTypes.func,
  contentBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onSaveContent: PropTypes.func,
  onPostDoubleClick: PropTypes.func,
  showActions: PropTypes.bool,
  likeBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  shareBusyPostId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onToggleLike: PropTypes.func,
  onShowLikes: PropTypes.func,
  onOpenComments: PropTypes.func,
  onShare: PropTypes.func,
  renderPostExtra: PropTypes.func,
  sx: PropTypes.object
};

ColorTemplate11PostingLoadMoreBar.propTypes = {
  feedHasMore: PropTypes.bool,
  loadMoreBusy: PropTypes.bool,
  feedLoading: PropTypes.bool,
  onLoadMore: PropTypes.func,
  pinned: PropTypes.bool,
  sx: PropTypes.object
};
