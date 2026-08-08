import { useCallback, useEffect, useMemo, useState } from 'react';
import Stack from '@mui/material/Stack';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import { deleteMyPosting, deleteMyPostingPhoto, invalidateMyPicksFeedCache } from 'api/myPicksFe';
import { useAuth } from 'contexts/AuthContext';
import { themedAlert } from 'utils/themedDialog';

const POSTING_FEED_DELETE_CONFIRM = {
  posting: {
    message: 'Delete this posting?',
    enterConfirms: true
  },
  postingPhoto: {
    message: 'Delete this posting photo/video?',
    enterConfirms: true
  }
};

/**
 * Shared delete-post / delete-photo flow for posting feeds (My Picks, Vetted Friends).
 * Delete X is shown when the viewer owns the feed (viewerSinglesId === feedOwnerSinglesId).
 */
export default function usePostingFeedDelete(feedOwnerSinglesId, { refetchFeed } = {}) {
  const { user } = useAuth();
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const canDeletePosts = useMemo(() => {
    const viewerId = Number(user?.singles_id);
    const ownerId = Number(feedOwnerSinglesId);
    return Number.isFinite(viewerId) && viewerId > 0 && viewerId === ownerId;
  }, [user?.singles_id, feedOwnerSinglesId]);

  const closeDeleteConfirm = useCallback(() => {
    if (deleteBusy) return;
    setDeleteConfirm(null);
  }, [deleteBusy]);

  const refreshFeed = useCallback(async () => {
    const tasks = [invalidateMyPicksFeedCache()];
    if (refetchFeed) tasks.unshift(refetchFeed());
    await Promise.all(tasks);
  }, [refetchFeed]);

  const executeDeletePosting = useCallback(
    async (numericPostId) => {
      setDeleteBusy(true);
      try {
        await deleteMyPosting(numericPostId);
        await refreshFeed();
      } catch (err) {
        const errorMessage = err?.response?.data?.error || err?.message || 'Failed to delete posting';
        await themedAlert(`Delete posting failed: ${errorMessage}`);
      } finally {
        setDeleteBusy(false);
      }
    },
    [refreshFeed]
  );

  const executeDeletePostingPhoto = useCallback(
    async (numericPhotoId) => {
      setDeleteBusy(true);
      try {
        await deleteMyPostingPhoto(numericPhotoId);
        await refreshFeed();
      } catch (err) {
        const errorMessage = err?.response?.data?.error || err?.message || 'Failed to delete posting photo';
        await themedAlert(`Delete posting photo failed: ${errorMessage}`);
      } finally {
        setDeleteBusy(false);
      }
    },
    [refreshFeed]
  );

  const confirmDeleteFromDialog = useCallback(async () => {
    const pending = deleteConfirm;
    setDeleteConfirm(null);
    if (!pending) return;
    if (pending.type === 'posting') {
      await executeDeletePosting(pending.postId);
      return;
    }
    if (pending.type === 'postingPhoto') {
      await executeDeletePostingPhoto(pending.photoId);
    }
  }, [deleteConfirm, executeDeletePosting, executeDeletePostingPhoto]);

  const handleDeletePosting = useCallback((postId) => {
    const numericPostId = Number(postId);
    if (!Number.isFinite(numericPostId) || numericPostId < 1) {
      void themedAlert(`Delete failed: invalid post id (${String(postId)})`);
      return;
    }
    setDeleteConfirm({ type: 'posting', postId: numericPostId });
  }, []);

  const handleDeletePostingPhoto = useCallback((photoId) => {
    const numericPhotoId = Number(photoId);
    if (!Number.isFinite(numericPhotoId) || numericPhotoId < 1) {
      void themedAlert(`Delete failed: invalid posting photo id (${String(photoId)})`);
      return;
    }
    setDeleteConfirm({ type: 'postingPhoto', photoId: numericPhotoId });
  }, []);

  useEffect(() => {
    if (!deleteConfirm) return undefined;
    const { enterConfirms } = POSTING_FEED_DELETE_CONFIRM[deleteConfirm.type] ?? { enterConfirms: false };
    if (!enterConfirms) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void confirmDeleteFromDialog();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteConfirm, confirmDeleteFromDialog]);

  const deleteConfirmDialog = (
    <ColorTemplate7PopupLargeDark
      open={Boolean(deleteConfirm)}
      onClose={closeDeleteConfirm}
      closeOnBackdrop={!deleteBusy}
      showCloseButton={!deleteBusy}
      closeButtonAriaLabel="Close delete confirmation"
    >
      <ColorTemplate7PopupLargeDark.Body spacing={2}>
        <ColorTemplate7PopupLargeDark.BodyText>
          {deleteConfirm ? POSTING_FEED_DELETE_CONFIRM[deleteConfirm.type]?.message : ''}
        </ColorTemplate7PopupLargeDark.BodyText>
        <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" sx={{ width: '100%' }}>
          <ColorTemplate7PopupLargeDark.ActionButton disabled={deleteBusy} onClick={closeDeleteConfirm}>
            No
          </ColorTemplate7PopupLargeDark.ActionButton>
          <ColorTemplate7PopupLargeDark.ActionButton disabled={deleteBusy} onClick={() => void confirmDeleteFromDialog()}>
            Yes
          </ColorTemplate7PopupLargeDark.ActionButton>
        </Stack>
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );

  return {
    canDeletePosts,
    deleteBusy,
    handleDeletePosting,
    handleDeletePostingPhoto,
    deleteConfirmDialog
  };
}
