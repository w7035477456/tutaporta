import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import GreenButton from 'ui-component/GreenButton';
import { useAuth } from 'contexts/AuthContext';
import {
  acceptPhotoAlbumsInvite,
  previewPhotoAlbumsInvite,
  readPhotoAlbumsInviteError
} from 'api/photoAlbumsInviteFe';

export default function PhotoAlbumsAcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = String(searchParams.get('token') || '').trim();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Missing invitation token.');
      setLoading(false);
      return;
    }
    let cancelled = false;
    void previewPhotoAlbumsInvite(token)
      .then((data) => {
        if (!cancelled) setPreview(data);
      })
      .catch((err) => {
        if (!cancelled) setError(readPhotoAlbumsInviteError(err, 'Invitation not found'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    setAccepting(true);
    setError('');
    try {
      const result = await acceptPhotoAlbumsInvite(token);
      setDone(true);
      window.setTimeout(() => {
        navigate(result?.redirectPath || '/myPhotoAlbums', { replace: true });
      }, 1200);
    } catch (err) {
      setError(readPhotoAlbumsInviteError(err, 'Failed to accept invitation'));
    } finally {
      setAccepting(false);
    }
  };

  const goToLogin = () => {
    navigate('/pages/login', {
      state: {
        from: {
          pathname: '/photoAlbums/accept-invite',
          search: token ? `?token=${encodeURIComponent(token)}` : ''
        },
        email: preview?.inviteeEmail || ''
      }
    });
  };

  return (
    <Box
      sx={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 6
      }}
    >
      <Box
        sx={{
          maxWidth: 520,
          width: '100%',
          bgcolor: '#fff',
          border: '3px solid #000',
          borderRadius: 2,
          p: 3,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 1.5 }}>
          Photo album invitation
        </Typography>

        {loading ? (
          <Typography>Loading invitation…</Typography>
        ) : error && !preview ? (
          <Typography color="error">{error}</Typography>
        ) : (
          <>
            <Typography sx={{ mb: 1 }}>
              <strong>{preview?.ownerDisplayName || 'Someone'}</strong> invited you to view:
            </Typography>
            <Typography sx={{ mb: 2, fontWeight: 700 }}>
              {preview?.albumSetName || 'Album set'} / {preview?.albumName || 'Album'}
            </Typography>
            <Typography sx={{ mb: 2, color: 'text.secondary' }}>
              Invitation sent to: {preview?.inviteeEmail}
            </Typography>

            {preview?.alreadyAccepted || done ? (
              <Typography sx={{ color: 'success.main', fontWeight: 700 }}>
                {done ? 'Accepted — opening TutaPhotoAlbums…' : 'This invitation was already accepted.'}
              </Typography>
            ) : !user ? (
              <>
                <Typography sx={{ mb: 2 }}>
                  Log in with <strong>{preview?.inviteeEmail}</strong> to accept.
                </Typography>
                <GreenButton type="button" onClick={goToLogin}>
                  Log in to accept
                </GreenButton>
              </>
            ) : String(user?.email || '').trim().toLowerCase() !==
              String(preview?.inviteeEmail || '').trim().toLowerCase() ? (
              <>
                <Typography color="error" sx={{ mb: 2 }}>
                  You are logged in as {user?.email}. Switch to {preview?.inviteeEmail} to accept.
                </Typography>
                <GreenButton type="button" onClick={goToLogin}>
                  Log in as invitee
                </GreenButton>
              </>
            ) : (
              <>
                {error ? (
                  <Typography color="error" sx={{ mb: 1.5 }}>
                    {error}
                  </Typography>
                ) : null}
                <GreenButton type="button" disabled={accepting} onClick={() => void handleAccept()}>
                  {accepting ? 'Accepting…' : 'Accept invitation'}
                </GreenButton>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}
