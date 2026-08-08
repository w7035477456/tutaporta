import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import SelectedButtonTemplate from 'ui-component/SelectedButtonTemplate';
import { earnTokensGreenSelectedButtonSx } from 'config/earnTokensGreenButton';
import { createPostingComment, deletePostingComment, fetchPostingComments } from 'api/myPicksFe';
import { formatAliasWithMemberCode } from 'utils/memberLabel';

function formatPostingCommentDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}-${day}-${year}`;
}

function memberLabelForComment(comment) {
  return formatAliasWithMemberCode({
    alias: comment.alias,
    prefix: comment.prefix,
    memberId: comment.member_id,
    singlesId: comment.author_id
  });
}

function formatCommentLine(comment, photoLabel) {
  const photoPrefix = photoLabel ? `${photoLabel}: ` : '';
  return `${photoPrefix}${formatPostingCommentDate(comment.created_at)} ${comment.posting_text} (${memberLabelForComment(comment)})`;
}

function CommentGreenButton({ children, disabled, onClick, type = 'button', 'aria-label': ariaLabel }) {
  return (
    <SelectedButtonTemplate
      type={type}
      hoverScale={1}
      selectedLabelScale={1}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      sx={earnTokensGreenSelectedButtonSx({ popupAction: true })}
    >
      <Box component="span" className="hover-magnify-label">
        {children}
      </Box>
    </SelectedButtonTemplate>
  );
}

export default function PostingCommentsDialog({ open, postId, photos = [], onClose, onCommentsChanged }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);

  const photoList = useMemo(
    () =>
      (Array.isArray(photos) ? photos : [])
        .map((photo) => ({
          photo_id: Number(photo.photo_id),
          photo_url: photo.photo_url ?? '',
          comment_count: Number(photo.comment_count ?? 0)
        }))
        .filter((photo) => Number.isFinite(photo.photo_id) && photo.photo_id > 0),
    [photos]
  );

  const photoLabelById = useMemo(() => {
    const labels = new Map();
    photoList.forEach((photo, index) => {
      labels.set(photo.photo_id, `Photo ${index + 1}`);
    });
    return labels;
  }, [photoList]);

  useEffect(() => {
    if (!open) return;
    const firstPhotoId = photoList[0]?.photo_id ?? null;
    setSelectedPhotoId((prev) => {
      if (prev != null && photoList.some((photo) => photo.photo_id === prev)) return prev;
      return firstPhotoId;
    });
  }, [open, photoList]);

  const loadComments = useCallback(async () => {
    const numericPostId = Number(postId);
    if (!Number.isFinite(numericPostId) || numericPostId < 1) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchPostingComments(numericPostId);
      setComments(Array.isArray(data?.comments) ? data.comments : []);
    } catch (err) {
      setError(err?.message || 'Failed to load comments');
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (!open) {
      setDraft('');
      setError('');
      setComments([]);
      setSelectedPhotoId(null);
      return;
    }
    void loadComments();
  }, [open, loadComments]);

  const handleAddComment = async () => {
    const text = String(draft ?? '').trim();
    const photoId = Number(selectedPhotoId);
    if (!text || !Number.isFinite(photoId) || photoId < 1) return;
    setSaving(true);
    setError('');
    try {
      const data = await createPostingComment(photoId, text);
      if (data?.comment) {
        setComments((prev) => [...prev, data.comment]);
      } else {
        await loadComments();
      }
      setDraft('');
      onCommentsChanged?.();
    } catch (err) {
      setError(err?.message || 'Failed to add comment');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    setSaving(true);
    setError('');
    try {
      await deletePostingComment(commentId);
      setComments((prev) => prev.filter((row) => Number(row.comment_id) !== Number(commentId)));
      onCommentsChanged?.();
    } catch (err) {
      setError(err?.message || 'Failed to delete comment');
    } finally {
      setSaving(false);
    }
  };

  const hasMultiplePhotos = photoList.length > 1;

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeButtonAriaLabel="Close comments popup"
      showCloseButton
      closeOnBackdrop
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.25}>
        <ColorTemplate7PopupLargeDark.Title>Comments</ColorTemplate7PopupLargeDark.Title>

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        {!photoList.length ? (
          <ColorTemplate7PopupLargeDark.BodyText>Comments are available on posting photos only.</ColorTemplate7PopupLargeDark.BodyText>
        ) : null}

        {hasMultiplePhotos ? (
          <ColorTemplate7PopupLargeDark.FormRow label="Comment on photo">
            <ColorTemplate7PopupLargeDark.FormRowControls>
              {photoList.map((photo) => (
                <ColorTemplate7PopupLargeDark.ActionButton
                  key={photo.photo_id}
                  type="button"
                  onClick={() => setSelectedPhotoId(photo.photo_id)}
                >
                  {photoLabelById.get(photo.photo_id)}
                  {selectedPhotoId === photo.photo_id ? ' ✓' : ''}
                </ColorTemplate7PopupLargeDark.ActionButton>
              ))}
            </ColorTemplate7PopupLargeDark.FormRowControls>
          </ColorTemplate7PopupLargeDark.FormRow>
        ) : null}

        {loading ? <ColorTemplate7PopupLargeDark.BodyText>Loading…</ColorTemplate7PopupLargeDark.BodyText> : null}

        {!loading && comments.length === 0 ? (
          <ColorTemplate7PopupLargeDark.BodyText>No comments yet.</ColorTemplate7PopupLargeDark.BodyText>
        ) : null}

        {!loading
          ? comments.map((comment) => {
              const photoLabel = hasMultiplePhotos ? photoLabelById.get(Number(comment.photo_id)) : '';
              return (
                <ColorTemplate7PopupLargeDark.FormRowControls key={comment.comment_id}>
                  {comment.can_delete ? (
                    <CommentGreenButton
                      type="button"
                      onClick={() => handleDeleteComment(comment.comment_id)}
                      disabled={saving}
                      aria-label="Delete comment"
                    >
                      Delete
                    </CommentGreenButton>
                  ) : null}
                  <ColorTemplate7PopupLargeDark.BodyText>
                    {formatCommentLine(comment, photoLabel)}
                  </ColorTemplate7PopupLargeDark.BodyText>
                </ColorTemplate7PopupLargeDark.FormRowControls>
              );
            })
          : null}

        <ColorTemplate7PopupLargeDark.FormRows>
          <ColorTemplate7PopupLargeDark.FormRow label="Comment">
            <ColorTemplate7PopupLargeDark.Input
              formRow
              fullWidth
              multiline
              minRows={2}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder=""
              disabled={saving || loading || !photoList.length}
            />
          </ColorTemplate7PopupLargeDark.FormRow>
        </ColorTemplate7PopupLargeDark.FormRows>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap">
          <CommentGreenButton
            onClick={handleAddComment}
            disabled={saving || loading || !String(draft).trim() || !photoList.length}
          >
            {saving ? 'Adding…' : 'Add Comment'}
          </CommentGreenButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}
