import PropTypes from 'prop-types';
import { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import ColorTemplate7PopupLargeDark from 'ui-component/ColorTemplate7PopupLargeDark';
import GreenButton from 'ui-component/GreenButton';
import {
  fetchPhotoAlbumsInvites,
  revokePhotoAlbumsInvite,
  readPhotoAlbumsInviteError
} from 'api/photoAlbumsInviteFe';

function formatInviteDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export default function PhotoAlbumsInviteReviewDialog({
  open,
  onClose,
  noteId,
  storageType,
  onRevoked
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revokingId, setRevokingId] = useState(null);

  const load = useCallback(async () => {
    if (!open || !noteId || !storageType) return;
    setLoading(true);
    setError('');
    try {
      const list = await fetchPhotoAlbumsInvites({ noteId, storageType });
      setRows(list);
    } catch (err) {
      setError(readPhotoAlbumsInviteError(err, 'Failed to load invites'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [open, noteId, storageType]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRevoke = async (inviteId) => {
    setRevokingId(inviteId);
    setError('');
    try {
      await revokePhotoAlbumsInvite(inviteId);
      setRows((prev) => prev.filter((row) => row.inviteId !== inviteId));
      onRevoked?.();
    } catch (err) {
      setError(readPhotoAlbumsInviteError(err, 'Failed to revoke invite'));
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <ColorTemplate7PopupLargeDark
      open={open}
      onClose={onClose}
      closeButtonAriaLabel="Close invite review"
      showCloseButton
      closeOnBackdrop
    >
      <ColorTemplate7PopupLargeDark.Body spacing={1.25}>
        <ColorTemplate7PopupLargeDark.Title>Album invite review</ColorTemplate7PopupLargeDark.Title>
        <ColorTemplate7PopupLargeDark.BodyText>
          Below are emails invited to view this album.
        </ColorTemplate7PopupLargeDark.BodyText>

        {error ? <ColorTemplate7PopupLargeDark.ErrorBar>{error}</ColorTemplate7PopupLargeDark.ErrorBar> : null}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) auto auto auto',
            gap: 0.75,
            alignItems: 'center',
            fontWeight: 700,
            fontSize: '0.9rem'
          }}
        >
          <Box>Emails</Box>
          <Box>Date Invite</Box>
          <Box>View Count</Box>
          <Box>Revoke</Box>
        </Box>

        {loading ? (
          <ColorTemplate7PopupLargeDark.BodyText>Loading…</ColorTemplate7PopupLargeDark.BodyText>
        ) : rows.length === 0 ? (
          <ColorTemplate7PopupLargeDark.BodyText>No active invitations for this album.</ColorTemplate7PopupLargeDark.BodyText>
        ) : (
          rows.map((row) => (
            <Box
              key={row.inviteId}
              sx={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.4fr) auto auto auto',
                gap: 0.75,
                alignItems: 'center',
                py: 0.35,
                borderTop: '1px solid rgba(255,255,255,0.15)'
              }}
            >
              <Box sx={{ wordBreak: 'break-word' }}>{row.inviteeEmail}</Box>
              <Box>{formatInviteDate(row.invitedAt)}</Box>
              <Box>{Number(row.viewCount) || 0}</Box>
              <GreenButton
                type="button"
                disabled={revokingId === row.inviteId}
                onClick={() => void handleRevoke(row.inviteId)}
                sx={{ minWidth: 0, px: 1.25, py: 0.35 }}
              >
                {revokingId === row.inviteId ? '…' : 'Revoke'}
              </GreenButton>
            </Box>
          ))
        )}
      </ColorTemplate7PopupLargeDark.Body>
    </ColorTemplate7PopupLargeDark>
  );
}

PhotoAlbumsInviteReviewDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  noteId: PropTypes.number,
  storageType: PropTypes.string,
  onRevoked: PropTypes.func
};
